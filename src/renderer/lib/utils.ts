import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
