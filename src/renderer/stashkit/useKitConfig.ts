import { useCallback, useEffect, useRef, useState } from "react"
import type { KitConfig } from "@shared/types"
import { loadKitConfig, saveKitConfig } from "../lib/tauriApi"
import { buildDefaultTemplates } from "./templates"

export function defaultConfig(): KitConfig {
  const templates = buildDefaultTemplates()
  return {
    templates,
    activeTemplateId: templates[0].id,
    colorPresets: [],
    savedKits: [],
    categoryOverrides: {},
    imageAttachments: {},
    iconFontPath: null,
    flVersion: "FL 2024",
  }
}

/** Loads/persists the Stash Kit config blob via Rust `kit_config.json`. */
export function useKitConfig() {
  const [config, setConfig] = useState<KitConfig>(defaultConfig)
  const [loaded, setLoaded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    loadKitConfig()
      .then((json) => {
        if (cancelled || !json) return
        try {
          const parsed = JSON.parse(json) as Partial<KitConfig>
          const base = defaultConfig()
          // Always keep the built-in templates present (and pristine).
          const builtins = base.templates
          const customs = (parsed.templates ?? []).filter((t) => !t.builtin)
          setConfig({
            ...base,
            ...parsed,
            templates: [...builtins, ...customs],
            activeTemplateId: parsed.activeTemplateId ?? base.activeTemplateId,
          })
        } catch {
          /* keep defaults */
        }
      })
      .finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveKitConfig(JSON.stringify(config)).catch((e) => console.warn("kit config save failed:", e))
    }, 400)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [config, loaded])

  const update = useCallback((patch: Partial<KitConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  return { config, setConfig, update, loaded }
}
