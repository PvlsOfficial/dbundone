import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  getSupabase,
  clearStoredSession,
  type User,
  type Session,
} from '@/lib/supabase'

// ── Types ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  session: Session | null
  profile: UserProfile | null
  error: string | null
}

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  updateDisplayName: (name: string) => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Race a promise against a timeout. Returns the promise result or throws on timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ])
}

// ── Provider ────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    session: null,
    profile: null,
    error: null,
  })

  const patch = useCallback((partial: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  // Fetch the user's profile from profiles table
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const sb = getSupabase()
      const { data, error } = await withTimeout(
        Promise.resolve(
          sb.from('profiles')
            .select('id, email, display_name, avatar_url')
            .eq('id', userId)
            .single()
        ),
        8000,
        'fetchProfile',
      )
      if (error || !data) {
        console.warn('[Auth] fetchProfile failed:', error?.message)
        return null
      }
      return {
        id: data.id,
        email: data.email,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
      }
    } catch (e: any) {
      console.warn('[Auth] fetchProfile exception:', e.message)
      return null
    }
  }, [])

  // ── Initialize on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const sb = getSupabase()
    let cancelled = false

    // 1) Check for existing session
    const init = async () => {
      console.log('[Auth] Initializing...')
      try {
        const result = await withTimeout(sb.auth.getSession(), 8000, 'getSession')
        const session = result.data.session
        console.log('[Auth] getSession:', session ? session.user.email : 'no session')

        if (cancelled) return
        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          patch({ isAuthenticated: true, isLoading: false, user: session.user, session, profile })
          return
        }
      } catch (e: any) {
        console.warn('[Auth] getSession failed:', e.message, '— clearing stored session')
        clearStoredSession()
      }
      if (!cancelled) patch({ isLoading: false })
    }
    init()

    // 2) Listen for auth state changes
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (_event, session) => {
      console.log('[Auth] onAuthStateChange:', _event, session?.user?.email || 'none')
      if (cancelled) return
      if (session?.user) {
        patch({ isAuthenticated: true, user: session.user, session })
        const profile = await fetchProfile(session.user.id)
        if (!cancelled) patch({ profile })
      } else {
        patch({ isAuthenticated: false, user: null, session: null, profile: null })
      }
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [fetchProfile, patch])

  // ── Sign Up ─────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const sb = getSupabase()
    patch({ error: null })
    try {
      console.log('[Auth] signUp for:', email)
      const { data, error } = await withTimeout(
        sb.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split('@')[0] } },
        }),
        15000,
        'signUp',
      )
      if (error) { patch({ error: error.message }); return }
      console.log('[Auth] signUp result — user:', !!data.user, 'session:', !!data.session)
      if (data.user && data.session) {
        const profile = await fetchProfile(data.user.id)
        patch({ isAuthenticated: true, user: data.user, session: data.session, profile })
      } else if (data.user && !data.session) {
        patch({ error: 'Account created! Check your email for the confirmation link before signing in.' })
      }
    } catch (e: any) {
      console.error('[Auth] signUp error:', e)
      patch({ error: e.message || 'Sign up failed' })
    }
  }, [fetchProfile, patch])

  // ── Sign In ─────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase()
    patch({ error: null })

    try {
      console.log('[Auth] signIn for:', email)

      // Use signInWithPassword directly — the lock is disabled so no deadlock.
      // If this works, the session is automatically set on the client →
      // all subsequent DB queries (shares, profiles, user search) work.
      const { data, error } = await withTimeout(
        sb.auth.signInWithPassword({ email, password }),
        15000,
        'signIn',
      )

      if (error) {
        console.error('[Auth] signIn error:', error.message)
        let msg = error.message
        if (msg.toLowerCase().includes('email not confirmed')) {
          msg = 'Email not yet confirmed. Check your inbox for the confirmation link.'
        } else if (msg.toLowerCase().includes('invalid login credentials')) {
          msg = 'Invalid email or password.'
        }
        patch({ error: msg })
        return
      }

      console.log('[Auth] signIn OK — user:', data.user?.email, 'session:', !!data.session)

      if (data.user && data.session) {
        const profile = await fetchProfile(data.user.id)
        patch({
          isAuthenticated: true,
          isLoading: false,
          user: data.user,
          session: data.session,
          profile,
        })
        console.log('[Auth] Fully signed in as:', data.user.email)
      }
    } catch (e: any) {
      console.error('[Auth] signIn exception:', e)
      patch({ error: e.message || 'Sign in failed' })
    }
  }, [fetchProfile, patch])

  // ── Sign Out ────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    // Always clear local state first so the UI is never stuck
    patch({ isAuthenticated: false, isLoading: false, user: null, session: null, profile: null, error: null })
    clearStoredSession()
    try {
      await withTimeout(getSupabase().auth.signOut(), 5000, 'signOut')
    } catch (e) {
      console.warn('[Auth] signOut error (local state already cleared):', e)
    }
  }, [patch])

  // ── Update Display Name ─────────────────────────────────────────────────
  const updateDisplayName = useCallback(async (name: string) => {
    if (!state.user) return
    try {
      const { error } = await withTimeout(
        Promise.resolve(
          getSupabase()
            .from('profiles')
            .update({ display_name: name })
            .eq('id', state.user.id)
        ),
        8000,
        'updateDisplayName',
      )
      if (error) {
        patch({ error: error.message })
      } else if (state.profile) {
        patch({ profile: { ...state.profile, displayName: name } })
      }
    } catch (e: any) {
      console.warn('[Auth] updateDisplayName error:', e)
      patch({ error: e.message || 'Failed to update display name' })
    }
  }, [state.user, state.profile, patch])

  const clearError = useCallback(() => patch({ error: null }), [patch])

  return (
    <AuthContext.Provider
      value={{ ...state, signUp, signIn, signOut, updateDisplayName, clearError }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
