import React, { createContext, useContext, useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'

interface ThemeContextType {
  theme: 'dark' | 'light' | 'system' | 'custom'
  accentColor: string
  customThemeColor: string
  resolvedTheme: 'dark' | 'light' | 'custom'
  setTheme: (theme: 'dark' | 'light' | 'system' | 'custom') => void
  setAccentColor: (color: string) => void
  setCustomThemeColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
  settings: AppSettings
  onSettingsChange: (settings: Partial<AppSettings>) => void
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  settings,
  onSettingsChange,
}) => {
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light' | 'custom'>(() => {
    if (settings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    if (settings.theme === 'custom') {
      return 'custom'
    }
    return settings.theme
  })

  // Update resolved theme when settings change
  useEffect(() => {
    const updateResolvedTheme = () => {
      if (settings.theme === 'system') {
        setResolvedTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      } else if (settings.theme === 'custom') {
        setResolvedTheme('custom')
      } else {
        setResolvedTheme(settings.theme)
      }
    }

    updateResolvedTheme()

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => updateResolvedTheme()
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [settings.theme])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement

    // Convert hex color to HSL string (without hsl() wrapper)
    const hexToHsl = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255
      const g = parseInt(hex.slice(3, 5), 16) / 255
      const b = parseInt(hex.slice(5, 7), 16) / 255

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      let h = 0
      let s = 0
      const l = (max + min) / 2

      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break
          case g: h = (b - r) / d + 2; break
          case b: h = (r - g) / d + 4; break
        }
        h /= 6
      }

      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
    }

    // Remove existing theme classes
    root.classList.remove('light', 'dark', 'custom')

    // Add current theme class
    if (resolvedTheme === 'light') {
      root.classList.add('light')
    } else if (resolvedTheme === 'custom') {
      root.classList.add('custom')
      // Apply custom background color as HSL
      const customColor = settings.customThemeColor || '#1a1a2e'
      const customHsl = hexToHsl(customColor)
      root.style.setProperty('--custom-background', customHsl)
      
      // Calculate if the custom color is dark or light for text contrast
      const hex = customColor.replace('#', '')
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      const isDark = luminance < 0.5
      
      // Set foreground color based on background luminance
      root.style.setProperty('--custom-foreground', isDark ? '210 40% 98%' : '222.2 84% 4.9%')
      root.style.setProperty('--custom-muted', isDark ? '217.2 32.6% 17.5%' : '210 40% 96.1%')
      root.style.setProperty('--custom-muted-foreground', isDark ? '215 20.2% 65.1%' : '215.4 16.3% 46.9%')
      root.style.setProperty('--custom-card', isDark ? '222.2 84% 6.9%' : '0 0% 100%')
      root.style.setProperty('--custom-border', isDark ? '217.2 32.6% 17.5%' : '214.3 31.8% 91.4%')
    }
    // For dark mode, we don't add any class - :root has the dark theme

    const hslColor = hexToHsl(settings.accentColor)
    root.style.setProperty('--accent-color', hslColor)
  }, [resolvedTheme, settings.accentColor, settings.customThemeColor])

  const setTheme = (theme: 'dark' | 'light' | 'system' | 'custom') => {
    onSettingsChange({ theme })
  }

  const setAccentColor = (color: string) => {
    onSettingsChange({ accentColor: color })
  }

  const setCustomThemeColor = (color: string) => {
    onSettingsChange({ customThemeColor: color })
  }

  const value: ThemeContextType = {
    theme: settings.theme,
    accentColor: settings.accentColor,
    customThemeColor: settings.customThemeColor || '#1a1a2e',
    resolvedTheme,
    setTheme,
    setAccentColor,
    setCustomThemeColor,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}