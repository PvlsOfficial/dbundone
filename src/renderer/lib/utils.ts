import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { convertFileSrc } from "@tauri-apps/api/core"
import { invoke } from "@tauri-apps/api/core"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a local file path to a URL the webview can load.
 * Uses Tauri's asset protocol (convertFileSrc).
 */
export function assetUrl(filePath: string | null | undefined): string {
  if (!filePath) return ""
  return convertFileSrc(filePath)
}

// Cache for base64 image data URLs
const imageCache = new Map<string, string>()
// Monotonic counter - bumped on invalidation to trigger re-renders
let imageCacheVersion = 0
// Listeners that want to know when cache is invalidated
const cacheListeners = new Set<() => void>()

/**
 * Load an image from a local file path.
 * Uses Tauri's asset protocol (convertFileSrc) for zero-copy streaming —
 * much faster than base64 encoding over IPC.
 * Falls back to base64 data URL if the asset protocol fails.
 */
export async function loadImageUrl(filePath: string | null | undefined): Promise<string> {
  if (!filePath) return ""
  
  const cached = imageCache.get(filePath)
  if (cached) return cached
  
  // Primary: use Tauri asset protocol (streams file directly to webview, no IPC/base64 overhead)
  const url = convertFileSrc(filePath)
  imageCache.set(filePath, url)
  return url
}

/**
 * Invalidate cached image(s). Call after artwork is generated/changed.
 * Pass a specific path to clear just that entry, or no args to clear all.
 */
export function invalidateImageCache(filePath?: string) {
  if (filePath) {
    imageCache.delete(filePath)
  } else {
    imageCache.clear()
  }
  imageCacheVersion++
  cacheListeners.forEach(fn => fn())
}

export function getImageCacheVersion() {
  return imageCacheVersion
}

export function onImageCacheInvalidated(fn: () => void) {
  cacheListeners.add(fn)
  return () => { cacheListeners.delete(fn) }
}

/**
 * Format time spent (in minutes) to human readable format
 * Shows hours + minutes for >= 60min, just minutes for >= 1min, seconds for < 1min
 */
export function formatTimeSpent(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '0m'
  
  const totalSeconds = Math.round(minutes * 60)
  
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }
  
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  
  if (hours > 0) {
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }
  
  return `${mins}m`
}

/**
 * Format time spent with full labels
 */
export function formatTimeSpentFull(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '0 minutes'
  
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  
  if (hours > 0) {
    const hourLabel = hours === 1 ? 'hour' : 'hours'
    const minLabel = mins === 1 ? 'minute' : 'minutes'
    if (mins === 0) return `${hours} ${hourLabel}`
    return `${hours} ${hourLabel} ${mins} ${minLabel}`
  }
  
  const minLabel = mins === 1 ? 'minute' : 'minutes'
  return `${mins} ${minLabel}`
}

/**
 * Sanitize a string to prevent XSS when used in HTML contexts.
 * Escapes HTML special characters.
 */
export function sanitizeHtml(input: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  return input.replace(/[&<>"'/]/g, (char) => map[char] || char)
}

/**
 * Sanitize user input for database queries.
 * Strips null bytes and control characters.
 */
export function sanitizeInput(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim()
}

/**
 * Validate a file path is safe (no path traversal).
 */
export function isPathSafe(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return !normalized.includes('..') && !normalized.startsWith('/')
}
