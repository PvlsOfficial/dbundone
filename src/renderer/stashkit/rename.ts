export interface RenameOptions {
  find: string
  replace: string
  useRegex: boolean
  prefix: string
  suffix: string
  numbering: boolean
  numberStart: number
  numberPadding: number
  numberPosition: "prefix" | "suffix"
  caseMode: "none" | "lower" | "upper" | "title"
}

export const DEFAULT_RENAME: RenameOptions = {
  find: "",
  replace: "",
  useRegex: false,
  prefix: "",
  suffix: "",
  numbering: false,
  numberStart: 1,
  numberPadding: 2,
  numberPosition: "suffix",
  caseMode: "none",
}

function splitExt(name: string): [string, string] {
  const dot = name.lastIndexOf(".")
  if (dot <= 0) return [name, ""]
  return [name.slice(0, dot), name.slice(dot)]
}

function toTitle(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function applyCase(s: string, mode: RenameOptions["caseMode"]): string {
  switch (mode) {
    case "lower": return s.toLowerCase()
    case "upper": return s.toUpperCase()
    case "title": return toTitle(s)
    default: return s
  }
}

/**
 * Apply the advanced batch-rename pipeline to a list of file names.
 * The extension is always preserved; only the stem is transformed.
 * Order: find/replace → case → prefix/suffix → sequential numbering.
 */
export function applyRename(names: string[], opts: RenameOptions): string[] {
  let regex: RegExp | null = null
  if (opts.useRegex && opts.find) {
    try {
      regex = new RegExp(opts.find, "g")
    } catch {
      regex = null // invalid regex → leave names untouched by find/replace
    }
  }

  return names.map((name, i) => {
    let [stem, ext] = splitExt(name)

    if (opts.find) {
      if (regex) {
        stem = stem.replace(regex, opts.replace)
      } else if (!opts.useRegex) {
        stem = stem.split(opts.find).join(opts.replace)
      }
    }

    stem = applyCase(stem, opts.caseMode)

    if (opts.prefix) stem = opts.prefix + stem
    if (opts.suffix) stem = stem + opts.suffix

    if (opts.numbering) {
      const n = String(opts.numberStart + i).padStart(Math.max(0, opts.numberPadding), "0")
      stem = opts.numberPosition === "prefix" ? `${n}_${stem}` : `${stem}_${n}`
    }

    return stem + ext
  })
}
