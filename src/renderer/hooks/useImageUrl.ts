import { useState, useEffect, useRef } from "react"
import { loadImageUrl, onImageCacheInvalidated } from "@/lib/utils"

/**
 * React hook to load a local file path as an image URL.
 * Returns a data URL from the Rust backend.
 * Automatically reloads when the cache is invalidated.
 */
export function useImageUrl(filePath: string | null | undefined): string {
  const [url, setUrl] = useState("")
  const versionRef = useRef(0)

  useEffect(() => {
    if (!filePath) {
      setUrl("")
      return
    }

    // Bump version to cancel any in-flight load
    const thisVersion = ++versionRef.current

    loadImageUrl(filePath).then((result) => {
      if (versionRef.current === thisVersion) {
        setUrl(result)
      }
    })
  }, [filePath])

  // Re-load when cache is invalidated (artwork changed)
  useEffect(() => {
    if (!filePath) return

    return onImageCacheInvalidated(() => {
      const thisVersion = ++versionRef.current
      loadImageUrl(filePath).then((result) => {
        if (versionRef.current === thisVersion) {
          setUrl(result)
        }
      })
    })
  }, [filePath])

  return url
}
