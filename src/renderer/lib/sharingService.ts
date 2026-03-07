/**
 * Sharing service — all Supabase-backed collaboration functions.
 * Talks directly to the Supabase REST API via the JS client.
 */
import { getSupabase, uploadSharedAudio, uploadSharedImage, uploadProjectFile } from '@/lib/supabase'
import type { FlpAnalysis } from '@shared/types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CloudProfile {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
}

export interface SharedAnnotation {
  id: string
  timestamp: number
  text: string
  color: string
  isTask: boolean
  taskStatus: 'todo' | 'in-progress' | 'done' | null
  createdBy: string
  createdByName: string
  createdAt: string
}

export interface SharedVersion {
  id: string
  name: string
  fileUrl: string
  fileName: string
  versionNumber: number
  isFavorite: boolean
  annotations: SharedAnnotation[]
}

export interface SharedTask {
  id: string
  title: string
  description: string | null
  status: 'todo' | 'in-progress' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null
  dueDate?: string | null
  order: number
  createdAt: string
  updatedAt: string
}

export interface SharedPluginInfo {
  name: string
  isInstrument: boolean
  isSampler: boolean
  presetName: string | null
  dllName: string | null
}

export interface CloudShare {
  id: string
  fromUserId: string
  toUserId: string
  projectLocalId: string
  projectTitle: string
  projectDaw: string | null
  projectBpm: number | null
  projectKey: string | null
  projectGenre: string | null
  // Extended metadata
  projectArtists: string | null
  projectStatus: string | null
  projectTags: string[]
  projectCollection: string | null
  projectTimeSpent: number | null
  projectCreatedAt: string | null
  projectUpdatedAt: string | null
  // Media
  audioUrl: string | null
  audioName: string | null
  imageUrl: string | null
  imageName: string | null
  // Project file (FLP/ZIP) for download
  projectFileUrl: string | null
  projectFileName: string | null
  // Collaboration
  permission: 'view' | 'edit'
  sharedVersions: SharedVersion[]
  // Tasks shared with the project
  sharedTasks: SharedTask[]
  // Plugin list from FLP analysis for collaborator checklist
  sharedPlugins: SharedPluginInfo[]
  // Full FLP analysis (plugins, channels, mixer, samples, patterns)
  sharedAnalysis: FlpAnalysis | null
  //
  message: string | null
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
  updatedAt: string
  // Joined profile of the other user
  fromUser?: CloudProfile
  toUser?: CloudProfile
}

/** Version data to include when sharing a project */
export interface VersionToShare {
  name: string
  filePath: string
  versionNumber: number
  isFavorite: boolean
  annotations: Array<{
    id: string
    timestamp: number
    text: string
    color: string
    isTask?: boolean
    taskStatus?: string | null
    createdAt?: string
  }>
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function ensureClient() {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase not configured')
  return sb
}

function mapProfile(row: any): CloudProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  }
}

const SHARE_SELECT = `
  *,
  from_user:profiles!from_user_id(id, email, display_name, avatar_url),
  to_user:profiles!to_user_id(id, email, display_name, avatar_url)
`

function mapShare(row: any): CloudShare {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    projectLocalId: row.project_local_id,
    projectTitle: row.project_title,
    projectDaw: row.project_daw,
    projectBpm: row.project_bpm,
    projectKey: row.project_key,
    projectGenre: row.project_genre,
    projectArtists: row.project_artists,
    projectStatus: row.project_status,
    projectTags: row.project_tags || [],
    projectCollection: row.project_collection,
    projectTimeSpent: row.project_time_spent,
    projectCreatedAt: row.project_created_at,
    projectUpdatedAt: row.project_updated_at,
    audioUrl: row.audio_url,
    audioName: row.audio_name,
    imageUrl: row.image_url,
    imageName: row.image_name,
    projectFileUrl: row.project_file_url || null,
    projectFileName: row.project_file_name || null,
    permission: row.permission || 'view',
    sharedVersions: row.shared_versions || [],
    sharedTasks: row.shared_tasks || [],
    sharedPlugins: row.shared_plugins || [],
    sharedAnalysis: row.shared_analysis || null,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fromUser: row.from_user ? mapProfile(row.from_user) : undefined,
    toUser: row.to_user ? mapProfile(row.to_user) : undefined,
  }
}

// ── User Search ─────────────────────────────────────────────────────────────

/**
 * Search users by email prefix (case-insensitive).
 * Returns up to 10 matching profiles. Excludes the current user.
 */
export async function searchUsers(query: string, currentUserId: string): Promise<CloudProfile[]> {
  const sb = ensureClient()
  const { data, error } = await sb
    .from('profiles')
    .select('id, email, display_name, avatar_url')
    .ilike('email', `${query}%`)
    .neq('id', currentUserId)
    .limit(10)
  if (error) throw new Error(error.message)
  return (data || []).map(mapProfile)
}

// ── Share a Project ─────────────────────────────────────────────────────────

export interface ShareProjectInput {
  toUserId: string
  projectLocalId: string
  projectTitle: string
  projectDaw?: string | null
  projectBpm?: number | null
  projectKey?: string | null
  projectGenre?: string | null
  projectArtists?: string | null
  projectStatus?: string | null
  projectTags?: string[]
  projectCollection?: string | null
  projectTimeSpent?: number | null
  projectCreatedAt?: string | null
  projectUpdatedAt?: string | null
  permission?: 'view' | 'edit'
  /** Local path of artwork image to upload */
  imagePath?: string | null
  /** Audio versions with annotations to upload */
  versions?: VersionToShare[]
  message?: string
  /** Tasks to share with the project */
  tasks?: SharedTask[]
  /** Plugin list from FLP analysis */
  plugins?: SharedPluginInfo[]
  /** Full FLP analysis to store for collaborators */
  analysis?: FlpAnalysis | null
  /** Local path of FLP/ZIP project file to upload */
  projectFilePath?: string | null
}

/**
 * Share a project with another user.
 * Pre-generates a share ID, uploads all media FIRST, then does a single INSERT.
 * This avoids RLS issues with UPDATE after INSERT.
 */
export async function shareProject(
  fromUserId: string,
  fromUserName: string,
  input: ShareProjectInput
): Promise<CloudShare> {
  const sb = ensureClient()
  const shareId = crypto.randomUUID()

  let imageUrl: string | null = null
  let imageName: string | null = null
  let projectFileUrl: string | null = null
  let projectFileName: string | null = null
  const sharedVersions: SharedVersion[] = []

  // 1) Upload artwork image
  if (input.imagePath) {
    try {
      console.log('[Share] Uploading artwork image...')
      const imageData = await window.electron?.loadAudioFile(input.imagePath)
      if (imageData && imageData.byteLength > 0) {
        const fn = input.imagePath.split(/[\\/]/).pop() || 'artwork.png'
        const ext = fn.split('.').pop()?.toLowerCase() || 'png'
        const ct = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
        imageUrl = await uploadSharedImage(fromUserId, shareId, fn, imageData, ct)
        imageName = fn
        console.log('[Share] Image uploaded:', imageUrl)
      }
    } catch (e: any) {
      console.warn('[Share] Image upload failed:', e.message)
    }
  }

  // 2) Upload audio versions (max 10) with their annotations
  const versionsToUpload = (input.versions || []).slice(0, 10)
  for (let i = 0; i < versionsToUpload.length; i++) {
    const v = versionsToUpload[i]
    try {
      console.log(`[Share] Uploading version ${i + 1}/${versionsToUpload.length}: "${v.name}"`)
      const audioData = await window.electron?.loadAudioFile(v.filePath)
      if (!audioData || audioData.byteLength === 0) {
        console.warn(`[Share] Version "${v.name}" - file empty or unreadable`)
        continue
      }
      const fn = v.filePath.split(/[\\/]/).pop() || 'audio.wav'
      const ext = fn.split('.').pop()?.toLowerCase() || 'wav'
      const ct = ext === 'mp3' ? 'audio/mpeg' : ext === 'ogg' ? 'audio/ogg' : ext === 'flac' ? 'audio/flac' : 'audio/wav'
      const storageName = `v${v.versionNumber}_${fn}`
      const fileUrl = await uploadSharedAudio(fromUserId, shareId, storageName, audioData, ct)

      sharedVersions.push({
        id: crypto.randomUUID(),
        name: v.name,
        fileUrl,
        fileName: fn,
        versionNumber: v.versionNumber,
        isFavorite: v.isFavorite,
        annotations: v.annotations.map(a => ({
          id: a.id || crypto.randomUUID(),
          timestamp: a.timestamp,
          text: a.text,
          color: a.color,
          isTask: a.isTask || false,
          taskStatus: (a.taskStatus as SharedAnnotation['taskStatus']) || null,
          createdBy: fromUserId,
          createdByName: fromUserName,
          createdAt: a.createdAt || new Date().toISOString(),
        })),
      })
      console.log(`[Share] Version "${v.name}" uploaded (${(audioData.byteLength / 1024 / 1024).toFixed(1)} MB)`)
    } catch (e: any) {
      console.warn(`[Share] Version "${v.name}" upload failed:`, e.message)
    }
  }

  // 3) Upload project file (FLP/ZIP) if provided
  if (input.projectFilePath) {
    try {
      console.log('[Share] Uploading project file...')
      const fileData = await window.electron?.loadAudioFile(input.projectFilePath)
      if (fileData && fileData.byteLength > 0) {
        const fn = input.projectFilePath.split(/[\\/]/).pop() || 'project.flp'
        const ext = fn.split('.').pop()?.toLowerCase() || 'flp'
        const ct = ext === 'zip' ? 'application/zip' : 'application/octet-stream'
        projectFileUrl = await uploadProjectFile(fromUserId, shareId, fn, fileData, ct)
        projectFileName = fn
        console.log('[Share] Project file uploaded:', projectFileUrl)
      }
    } catch (e: any) {
      console.warn('[Share] Project file upload failed:', e.message)
    }
  }

  // 4) Single INSERT with all data — no UPDATE needed!
  const { data, error } = await sb
    .from('project_shares')
    .insert({
      id: shareId,
      from_user_id: fromUserId,
      to_user_id: input.toUserId,
      project_local_id: input.projectLocalId,
      project_title: input.projectTitle,
      project_daw: input.projectDaw || null,
      project_bpm: input.projectBpm || null,
      project_key: input.projectKey || null,
      project_genre: input.projectGenre || null,
      project_artists: input.projectArtists || null,
      project_status: input.projectStatus || null,
      project_tags: input.projectTags?.length ? input.projectTags : null,
      project_collection: input.projectCollection || null,
      project_time_spent: input.projectTimeSpent || null,
      project_created_at: input.projectCreatedAt || null,
      project_updated_at: input.projectUpdatedAt || null,
      permission: input.permission || 'view',
      image_url: imageUrl,
      image_name: imageName,
      audio_url: sharedVersions[0]?.fileUrl || null,
      audio_name: sharedVersions[0]?.fileName || null,
      shared_versions: sharedVersions,
      project_file_url: projectFileUrl,
      project_file_name: projectFileName,
      shared_tasks: input.tasks?.length ? input.tasks : null,
      shared_plugins: input.plugins?.length ? input.plugins : null,
      shared_analysis: input.analysis || null,
      message: input.message || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  console.log(`[Share] Done! ${sharedVersions.length} versions uploaded, image: ${!!imageUrl}, project file: ${!!projectFileUrl}`)
  return mapShare(data)
}

// ── Get Shares ──────────────────────────────────────────────────────────────

/**
 * Get all shares for a specific project (sent by current user).
 */
export async function getProjectShares(
  projectLocalId: string,
  fromUserId: string
): Promise<CloudShare[]> {
  const sb = ensureClient()
  const { data, error } = await sb
    .from('project_shares')
    .select(SHARE_SELECT)
    .eq('project_local_id', projectLocalId)
    .eq('from_user_id', fromUserId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(mapShare)
}

/**
 * Get all shares received by the current user.
 */
export async function getReceivedShares(userId: string): Promise<CloudShare[]> {
  const sb = ensureClient()
  const { data, error } = await sb
    .from('project_shares')
    .select(SHARE_SELECT)
    .eq('to_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(mapShare)
}

/**
 * Get all shares sent by the current user.
 */
export async function getSentShares(userId: string): Promise<CloudShare[]> {
  const sb = ensureClient()
  const { data, error } = await sb
    .from('project_shares')
    .select(SHARE_SELECT)
    .eq('from_user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map(mapShare)
}

// ── Update Share Status ─────────────────────────────────────────────────────

/**
 * Accept or decline a share (as recipient).
 */
export async function updateShareStatus(
  shareId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  const sb = ensureClient()
  const { error } = await sb
    .from('project_shares')
    .update({ status })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

// ── Update Permission ───────────────────────────────────────────────────────

export async function updateSharePermission(
  shareId: string,
  permission: 'view' | 'edit'
): Promise<void> {
  const sb = ensureClient()
  const { error } = await sb
    .from('project_shares')
    .update({ permission })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

// ── Update Project Status (collaborator) ────────────────────────────────────

export async function updateShareProjectStatus(
  shareId: string,
  projectStatus: string
): Promise<void> {
  const sb = ensureClient()
  const { error } = await sb
    .from('project_shares')
    .update({ project_status: projectStatus })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

// ── Shared Annotation CRUD ──────────────────────────────────────────────────

export async function addSharedAnnotation(
  shareId: string,
  versionId: string,
  annotation: Omit<SharedAnnotation, 'id'>
): Promise<SharedAnnotation> {
  const sb = ensureClient()
  const { data: share, error: fetchError } = await sb
    .from('project_shares')
    .select('shared_versions')
    .eq('id', shareId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const versions: SharedVersion[] = share.shared_versions || []
  const version = versions.find(v => v.id === versionId)
  if (!version) throw new Error('Version not found')

  const newAnnotation: SharedAnnotation = {
    id: crypto.randomUUID(),
    ...annotation,
  }
  version.annotations.push(newAnnotation)

  const { error } = await sb
    .from('project_shares')
    .update({ shared_versions: versions })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
  return newAnnotation
}

export async function updateSharedAnnotation(
  shareId: string,
  versionId: string,
  annotationId: string,
  updates: Partial<Pick<SharedAnnotation, 'text' | 'color' | 'taskStatus'>>
): Promise<void> {
  const sb = ensureClient()
  const { data: share, error: fetchError } = await sb
    .from('project_shares')
    .select('shared_versions')
    .eq('id', shareId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const versions: SharedVersion[] = share.shared_versions || []
  const version = versions.find(v => v.id === versionId)
  if (!version) throw new Error('Version not found')

  const ann = version.annotations.find(a => a.id === annotationId)
  if (!ann) throw new Error('Annotation not found')
  Object.assign(ann, updates)

  const { error } = await sb
    .from('project_shares')
    .update({ shared_versions: versions })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

export async function deleteSharedAnnotation(
  shareId: string,
  versionId: string,
  annotationId: string
): Promise<void> {
  const sb = ensureClient()
  const { data: share, error: fetchError } = await sb
    .from('project_shares')
    .select('shared_versions')
    .eq('id', shareId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const versions: SharedVersion[] = share.shared_versions || []
  const version = versions.find(v => v.id === versionId)
  if (!version) throw new Error('Version not found')

  version.annotations = version.annotations.filter(a => a.id !== annotationId)

  const { error } = await sb
    .from('project_shares')
    .update({ shared_versions: versions })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

// ── Shared Task CRUD ────────────────────────────────────────────────────────

export async function addSharedTask(
  shareId: string,
  task: Omit<SharedTask, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SharedTask> {
  const sb = ensureClient()
  const { data: share, error: fetchError } = await sb
    .from('project_shares')
    .select('shared_tasks')
    .eq('id', shareId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const tasks: SharedTask[] = share.shared_tasks || []
  const now = new Date().toISOString()
  const newTask: SharedTask = {
    id: crypto.randomUUID(),
    order: tasks.length,
    ...task,
    createdAt: now,
    updatedAt: now,
  }
  tasks.push(newTask)

  const { error } = await sb
    .from('project_shares')
    .update({ shared_tasks: tasks })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
  return newTask
}

export async function updateSharedTask(
  shareId: string,
  taskId: string,
  updates: Partial<Pick<SharedTask, 'title' | 'description' | 'status' | 'priority' | 'dueDate'>>
): Promise<void> {
  const sb = ensureClient()
  const { data: share, error: fetchError } = await sb
    .from('project_shares')
    .select('shared_tasks')
    .eq('id', shareId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const tasks: SharedTask[] = share.shared_tasks || []
  const task = tasks.find(t => t.id === taskId)
  if (!task) throw new Error('Task not found')
  Object.assign(task, updates, { updatedAt: new Date().toISOString() })

  const { error } = await sb
    .from('project_shares')
    .update({ shared_tasks: tasks })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

export async function deleteSharedTask(
  shareId: string,
  taskId: string
): Promise<void> {
  const sb = ensureClient()
  const { data: share, error: fetchError } = await sb
    .from('project_shares')
    .select('shared_tasks')
    .eq('id', shareId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const tasks: SharedTask[] = (share.shared_tasks || []).filter((t: SharedTask) => t.id !== taskId)

  const { error } = await sb
    .from('project_shares')
    .update({ shared_tasks: tasks })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

export async function reorderSharedTasks(
  shareId: string,
  updates: { id: string; order: number; status: SharedTask['status'] }[]
): Promise<void> {
  const sb = ensureClient()
  const { data: share, error: fetchError } = await sb
    .from('project_shares')
    .select('shared_tasks')
    .eq('id', shareId)
    .single()
  if (fetchError) throw new Error(fetchError.message)

  const tasks: SharedTask[] = share.shared_tasks || []
  for (const u of updates) {
    const task = tasks.find(t => t.id === u.id)
    if (task) { task.order = u.order; task.status = u.status; task.updatedAt = new Date().toISOString() }
  }
  tasks.sort((a, b) => a.order - b.order)

  const { error } = await sb
    .from('project_shares')
    .update({ shared_tasks: tasks })
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

// ── Delete Share ────────────────────────────────────────────────────────────

/**
 * Remove a share (sender can delete).
 */
export async function deleteShare(shareId: string): Promise<void> {
  const sb = ensureClient()
  const { error } = await sb
    .from('project_shares')
    .delete()
    .eq('id', shareId)
  if (error) throw new Error(error.message)
}

// ── Auto-Sync: Push new versions to existing shares ─────────────────────────

/**
 * Sync a newly added audio version to all active shares for this project.
 * Uploads the audio file and appends it to shared_versions on each share.
 * Returns the number of shares updated.
 */
export async function syncVersionToShares(
  fromUserId: string,
  fromUserName: string,
  projectLocalId: string,
  version: {
    name: string
    filePath: string
    versionNumber: number
    isFavorite: boolean
    annotations?: Array<{
      id: string
      timestamp: number
      text: string
      color: string
      isTask?: boolean
      taskStatus?: string | null
      createdAt?: string
    }>
  },
): Promise<number> {
  const sb = ensureClient()

  // Find all active shares for this project from this user
  const { data: shares, error: fetchError } = await sb
    .from('project_shares')
    .select('id, shared_versions')
    .eq('from_user_id', fromUserId)
    .eq('project_local_id', projectLocalId)
    .neq('status', 'declined')

  if (fetchError) {
    console.warn('[Sync] Failed to fetch shares:', fetchError.message)
    return 0
  }

  if (!shares || shares.length === 0) return 0

  // Read and upload the audio file once (reuse URL across all shares)
  let fileUrl: string | null = null
  let fileName: string | null = null
  try {
    const audioData = await window.electron?.loadAudioFile(version.filePath)
    if (!audioData || audioData.byteLength === 0) {
      console.warn('[Sync] Could not read audio file:', version.filePath)
      return 0
    }
    fileName = version.filePath.split(/[\\/]/).pop() || 'audio.wav'
    const ext = fileName.split('.').pop()?.toLowerCase() || 'wav'
    const ct = ext === 'mp3' ? 'audio/mpeg' : ext === 'ogg' ? 'audio/ogg' : ext === 'flac' ? 'audio/flac' : 'audio/wav'

    // Upload to first share's path (all shares from same user can reference the same file)
    const storageName = `v${version.versionNumber}_${fileName}`
    fileUrl = await uploadSharedAudio(fromUserId, shares[0].id, storageName, audioData, ct)
    console.log(`[Sync] Audio uploaded: ${fileUrl}`)
  } catch (e: any) {
    console.warn('[Sync] Failed to upload audio:', e.message)
    return 0
  }

  if (!fileUrl || !fileName) return 0

  const newSharedVersion: SharedVersion = {
    id: crypto.randomUUID(),
    name: version.name,
    fileUrl,
    fileName,
    versionNumber: version.versionNumber,
    isFavorite: version.isFavorite,
    annotations: (version.annotations || []).map(a => ({
      id: a.id || crypto.randomUUID(),
      timestamp: a.timestamp,
      text: a.text,
      color: a.color,
      isTask: a.isTask || false,
      taskStatus: (a.taskStatus as SharedAnnotation['taskStatus']) || null,
      createdBy: fromUserId,
      createdByName: fromUserName,
      createdAt: a.createdAt || new Date().toISOString(),
    })),
  }

  // Update each share's shared_versions array
  let updated = 0
  for (const share of shares) {
    try {
      const existingVersions: SharedVersion[] = share.shared_versions || []

      // Skip if this version number already exists (avoid duplicates)
      if (existingVersions.some(v => v.versionNumber === version.versionNumber)) {
        console.log(`[Sync] Version ${version.versionNumber} already exists in share ${share.id}, skipping`)
        continue
      }

      const updatedVersions = [...existingVersions, newSharedVersion]

      const { error: updateError } = await sb
        .from('project_shares')
        .update({
          shared_versions: updatedVersions,
          // Also update the primary audio URL to the latest version
          audio_url: fileUrl,
          audio_name: fileName,
        })
        .eq('id', share.id)

      if (updateError) {
        console.warn(`[Sync] Failed to update share ${share.id}:`, updateError.message)
      } else {
        updated++
        console.log(`[Sync] Share ${share.id} updated with version ${version.versionNumber}`)
      }
    } catch (e: any) {
      console.warn(`[Sync] Error updating share ${share.id}:`, e.message)
    }
  }

  return updated
}

// ── Get Profile ─────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<CloudProfile | null> {
  const sb = ensureClient()
  const { data, error } = await sb
    .from('profiles')
    .select('id, email, display_name, avatar_url')
    .eq('id', userId)
    .single()
  if (error) return null
  return mapProfile(data)
}