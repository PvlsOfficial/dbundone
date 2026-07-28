// Remembers the editable Cover Lab document behind a project's cover, so a cover
// made here can be reopened later with all its layers, effects and animation
// intact instead of a flattened image. Persisted to disk via the Tauri backend
// (no size limit), keyed by project id; falls back to localStorage when the
// desktop bridge isn't available (tests / web preview).

import { CoverDoc } from "./engine/types"

const LS_KEY = (projectId: string) => `dbundone:coverLab:projectDoc:${projectId}`
const hasBridge = () =>
  typeof window !== "undefined" && !!window.electron?.saveCoverDoc

// On-disk envelope: the editable doc plus the cover path it produced. The path
// lets us detect when a project's cover was later replaced outside Cover Lab, in
// which case the saved design is stale and shouldn't be restored.
interface DocEnvelope {
  v: 1
  coverPath: string | null
  doc: CoverDoc
}

function isCoverDoc(x: unknown): x is CoverDoc {
  return (
    !!x &&
    typeof x === "object" &&
    Array.isArray((x as CoverDoc).layers) &&
    (x as CoverDoc).layers.length > 0
  )
}

export async function saveProjectDoc(
  projectId: string,
  doc: CoverDoc,
  coverPath: string | null = null
): Promise<void> {
  let json: string
  try {
    const envelope: DocEnvelope = { v: 1, coverPath, doc }
    json = JSON.stringify(envelope)
  } catch {
    return
  }
  if (hasBridge()) {
    try {
      await window.electron!.saveCoverDoc(projectId, json)
      return
    } catch {
      /* fall through to localStorage */
    }
  }
  try {
    // localStorage fallback is quota-limited; skip very large docs.
    if (json.length < 4_500_000) localStorage.setItem(LS_KEY(projectId), json)
    else localStorage.removeItem(LS_KEY(projectId))
  } catch {
    /* ignore quota / serialization errors */
  }
}

/**
 * Load a project's saved editable design. When `expectedCoverPath` is given, the
 * design is only returned if it still matches the project's current cover (so a
 * cover replaced outside Cover Lab falls back to its flattened image instead of a
 * stale design). Older bare-doc records (no envelope) are always accepted.
 */
export async function loadProjectDoc(
  projectId: string,
  expectedCoverPath?: string | null
): Promise<CoverDoc | null> {
  let raw: string | null = null
  if (hasBridge()) {
    try {
      raw = await window.electron!.loadCoverDoc(projectId)
    } catch {
      raw = null
    }
  }
  if (raw == null) {
    try {
      raw = localStorage.getItem(LS_KEY(projectId))
    } catch {
      raw = null
    }
  }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    // Envelope format: validate the cover path still matches.
    if (parsed && parsed.v === 1 && isCoverDoc(parsed.doc)) {
      const env = parsed as DocEnvelope
      if (
        expectedCoverPath !== undefined &&
        env.coverPath != null &&
        env.coverPath !== expectedCoverPath
      ) {
        return null
      }
      return env.doc
    }
    // Back-compat: a bare doc written before envelopes existed.
    if (isCoverDoc(parsed)) return parsed as CoverDoc
  } catch {
    /* ignore corrupt state */
  }
  return null
}

export async function deleteProjectDoc(projectId: string): Promise<void> {
  if (hasBridge()) {
    try {
      await window.electron!.deleteCoverDoc(projectId)
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(LS_KEY(projectId))
  } catch {
    /* ignore */
  }
}
