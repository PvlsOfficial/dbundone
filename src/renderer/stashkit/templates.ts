import type { KitCategory, KitTemplate } from "@shared/types"
import { SOUND_TYPES } from "./soundTypes"

function makeCategory(idx: number, layout: "type-first" | "category-first"): KitCategory {
  const s = SOUND_TYPES[idx]
  const folderPath = layout === "type-first" ? `${s.group}/${s.label}` : s.label
  return {
    id: s.id,
    name: s.label,
    folderPath,
    keywords: [],
    color: s.color,
    iconIndex: null,
    tip: s.label,
    sortGroup: idx + 1,
    heightOfs: null,
    visible: true,
    splitBy: "none",
  }
}

export function buildDefaultTemplates(): KitTemplate[] {
  return [
    {
      id: "builtin-type-first",
      name: "Type-first (Drums / Bass / Melodic…)",
      layout: "type-first",
      builtin: true,
      categories: SOUND_TYPES.map((_, i) => makeCategory(i, "type-first")),
    },
    {
      id: "builtin-category-first",
      name: "Category-first (Kicks / 808s / Snares…)",
      layout: "category-first",
      builtin: true,
      categories: SOUND_TYPES.map((_, i) => makeCategory(i, "category-first")),
    },
  ]
}

export function cloneTemplate(t: KitTemplate, name: string): KitTemplate {
  return {
    id: `custom-${Date.now()}`,
    name,
    layout: "custom",
    builtin: false,
    categories: t.categories.map((c) => ({ ...c, keywords: [...c.keywords] })),
  }
}

/** Reset a template's category colors back to the canonical defaults. */
export function resetTemplateColors(t: KitTemplate): KitTemplate {
  const byId = new Map<string, string>(SOUND_TYPES.map((s) => [s.id, s.color]))
  return {
    ...t,
    categories: t.categories.map((c) => ({ ...c, color: byId.get(c.id) ?? c.color })),
  }
}
