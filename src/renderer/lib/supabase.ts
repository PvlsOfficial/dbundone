import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js'

// ── Hardcoded Supabase config ──────────────────────────────────────────────
// Public publishable key — safe to embed (RLS protects all data).
export const SUPABASE_URL = 'https://ubioscgegzuswogkytsc.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_mO2TNulaeJyXxG87j3ExRQ_DtGN02yz'

let _client: SupabaseClient | null = null

/** Default timeout for all Supabase fetch requests (ms). */
const FETCH_TIMEOUT = 15000

/**
 * Fetch wrapper that adds an AbortController timeout to every request.
 * Prevents any single network call from hanging the app indefinitely.
 */
function fetchWithTimeout(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

/**
 * Get the singleton Supabase client.
 * Always returns a valid client (config is baked in).
 */
export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'dbundone_auth',
        detectSessionInUrl: false, // Not needed in Tauri
        flowType: 'implicit',
        // Disable navigator.locks — prevents deadlocks in Tauri's WebView.
        // Single-window app doesn't need cross-tab lock coordination.
        lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
          return await fn()
        },
      },
      global: {
        fetch: fetchWithTimeout,
      },
    })
    console.log('[Supabase] Client initialized (lock disabled for Tauri)')
  }
  return _client
}

/**
 * Clear any stored auth session from localStorage.
 * Useful when a stale/corrupt session is blocking auth operations.
 */
export function clearStoredSession(): void {
  try {
    localStorage.removeItem('dbundone_auth')
    // supabase-js may also store under a versioned key
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith('dbundone_auth')) {
        localStorage.removeItem(key)
      }
    }
    console.log('[Supabase] Cleared stored session from localStorage')
  } catch (e) {
    console.warn('[Supabase] Could not clear stored session:', e)
  }
}

/**
 * Quick connectivity check — hits the Supabase auth health endpoint.
 * Returns { ok, status, ms } so we can debug connection issues.
 * Any HTTP response (even 4xx) means the server is reachable.
 */
export async function testSupabaseConnection(): Promise<{
  reachable: boolean
  status: number | null
  ms: number
  error?: string
}> {
  const start = performance.now()
  try {
    // Use the auth settings endpoint — always responds, no key needed
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
    })
    const ms = Math.round(performance.now() - start)
    // Any HTTP response means the server is reachable (even 401/403)
    return { reachable: true, status: res.status, ms }
  } catch (e: any) {
    return { reachable: false, status: null, ms: Math.round(performance.now() - start), error: e.message }
  }
}

export type { SupabaseClient, User, Session }

// ── Storage: Shared media upload/download ───────────────────────────────────

const MEDIA_BUCKET = 'shared-media'

/**
 * Upload an audio file to Supabase Storage for sharing.
 * Path: shared-media/audio/{fromUserId}/{shareId}/{filename}
 * Returns the public URL.
 */
export async function uploadSharedAudio(
  fromUserId: string,
  shareId: string,
  fileName: string,
  fileData: ArrayBuffer,
  contentType = 'audio/wav'
): Promise<string> {
  const sb = getSupabase()
  const path = `audio/${fromUserId}/${shareId}/${fileName}`
  console.log('[Supabase] Uploading audio:', path, `(${(fileData.byteLength / 1024 / 1024).toFixed(1)} MB)`)

  const { error } = await sb.storage
    .from(MEDIA_BUCKET)
    .upload(path, fileData, {
      contentType,
      upsert: true,
    })

  if (error) throw new Error(`Audio upload failed: ${error.message}`)

  const { data: urlData } = sb.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path)

  console.log('[Supabase] Audio uploaded OK:', urlData.publicUrl)
  return urlData.publicUrl
}

/**
 * Upload an image file to Supabase Storage for sharing.
 * Path: shared-media/images/{fromUserId}/{shareId}/{filename}
 * Returns the public URL.
 */
export async function uploadSharedImage(
  fromUserId: string,
  shareId: string,
  fileName: string,
  fileData: ArrayBuffer,
  contentType = 'image/png'
): Promise<string> {
  const sb = getSupabase()
  const path = `images/${fromUserId}/${shareId}/${fileName}`
  console.log('[Supabase] Uploading image:', path, `(${(fileData.byteLength / 1024).toFixed(0)} KB)`)

  const { error } = await sb.storage
    .from(MEDIA_BUCKET)
    .upload(path, fileData, {
      contentType,
      upsert: true,
    })

  if (error) throw new Error(`Image upload failed: ${error.message}`)

  const { data: urlData } = sb.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(path)

  console.log('[Supabase] Image uploaded OK:', urlData.publicUrl)
  return urlData.publicUrl
}

/**
 * Delete all shared media files for a share.
 */
export async function deleteSharedMedia(
  fromUserId: string,
  shareId: string,
): Promise<void> {
  const sb = getSupabase()

  // Delete audio files
  const { data: audioFiles } = await sb.storage
    .from(MEDIA_BUCKET)
    .list(`audio/${fromUserId}/${shareId}`)
  if (audioFiles && audioFiles.length > 0) {
    const paths = audioFiles.map(f => `audio/${fromUserId}/${shareId}/${f.name}`)
    await sb.storage.from(MEDIA_BUCKET).remove(paths)
  }

  // Delete image files
  const { data: imageFiles } = await sb.storage
    .from(MEDIA_BUCKET)
    .list(`images/${fromUserId}/${shareId}`)
  if (imageFiles && imageFiles.length > 0) {
    const paths = imageFiles.map(f => `images/${fromUserId}/${shareId}/${f.name}`)
    await sb.storage.from(MEDIA_BUCKET).remove(paths)
  }
}
