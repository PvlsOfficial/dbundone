import * as BetterSqlite3 from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectGroup, Task, Tag, AudioVersion, Annotation } from '../shared/types';

export class Database {
  private db: any;

  constructor(dbPath: string) {
    this.db = new (BetterSqlite3 as any).default(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    // Create projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artwork_path TEXT,
        audio_preview_path TEXT,
        daw_project_path TEXT,
        daw_type TEXT,
        bpm INTEGER DEFAULT 0,
        musical_key TEXT DEFAULT 'None',
        tags TEXT DEFAULT '[]',
        collection_name TEXT,
        favorite_version_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        file_modified_at TEXT
      )
    `);

    // Create groups table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        artwork_path TEXT,
        description TEXT,
        project_ids TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'todo',
        due_date TEXT,
        task_order INTEGER DEFAULT 0,
        project_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `);

    // Add project_id column if it doesn't exist (migration for existing databases)
    try {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`);
    } catch (e) {
      // Column already exists
    }

    // Add status column to projects if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'idea'`);
    } catch (e) {
      // Column already exists
    }

    // Add favorite_version_id column to projects if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE projects ADD COLUMN favorite_version_id TEXT`);
    } catch (e) {
      // Column already exists
    }

    // Add archived column to projects if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE projects ADD COLUMN archived INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists
    }

    // Add timeSpent column to projects if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE projects ADD COLUMN time_spent INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists
    }

    // Add created_at and updated_at columns to projects if they don't exist
    try {
      this.db.exec(`ALTER TABLE projects ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`);
    } catch (e) {
      // Column already exists
    }
    try {
      this.db.exec(`ALTER TABLE projects ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`);
    } catch (e) {
      // Column already exists
    }

    // Populate created_at and updated_at for existing projects that don't have them
    try {
      const projectsWithoutTimestamps = this.db.prepare('SELECT id FROM projects WHERE created_at = "" OR created_at IS NULL').all() as any[];
      if (projectsWithoutTimestamps.length > 0) {
        const now = new Date().toISOString();
        projectsWithoutTimestamps.forEach((project) => {
          this.db.prepare('UPDATE projects SET created_at = ?, updated_at = ? WHERE id = ?').run(now, now, project.id);
        });
      }
    } catch (e) {
      // Migration already applied or error occurred
    }

    // Add test tags to projects that don't have any (for demonstration)
    try {
      const projectsWithoutTags = this.db.prepare('SELECT id FROM projects WHERE tags = "[]" OR tags IS NULL').all() as any[];
      if (projectsWithoutTags.length > 0) {
        const testTags = [
          ['electronic', 'original'],
          ['hip-hop', 'beats'],
          ['vocal', 'pop'],
          ['instrumental', 'remix'],
          ['rock', 'collaboration']
        ];
        projectsWithoutTags.forEach((project, index) => {
          const tags = testTags[index % testTags.length];
          this.db.prepare('UPDATE projects SET tags = ? WHERE id = ?').run(JSON.stringify(tags), project.id);
        });
      }
    } catch (e) {
      // Migration already applied or error occurred
    }

    // Create tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#6366f1'
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_title ON projects(title);
      CREATE INDEX IF NOT EXISTS idx_projects_bpm ON projects(bpm);
      CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(task_order);
    `);

    // Create audio_versions table for version control
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audio_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        notes TEXT,
        version_number INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Create annotations table for audio timestamps
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY,
        version_id TEXT NOT NULL,
        timestamp REAL NOT NULL,
        text TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (version_id) REFERENCES audio_versions(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for versions and annotations
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_versions_project ON audio_versions(project_id);
      CREATE INDEX IF NOT EXISTS idx_annotations_version ON annotations(version_id);
      CREATE INDEX IF NOT EXISTS idx_annotations_timestamp ON annotations(timestamp);
    `);
  }

// Project methods
getProjects(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[];
    return rows.map(this.mapRowToProject);
  }

  getProjectsPaginated(limit: number, offset: number): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as any[];
    return rows.map(this.mapRowToProject);
  }

  getProjectsCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM projects').get() as any;
    return row.count;
  }

  getProject(id: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    return row ? this.mapRowToProject(row) : null;
  }

  createProject(project: Omit<Project, 'id'> & { createdAt?: string; updatedAt?: string }): Project {
    const id = uuidv4();
    const now = new Date().toISOString();
    const createdAt = project.createdAt || now;
    const updatedAt = project.updatedAt || now;
    
    this.db.prepare(`
      INSERT INTO projects (id, title, artwork_path, audio_preview_path, daw_project_path, daw_type, bpm, musical_key, tags, collection_name, status, favorite_version_id, created_at, updated_at, file_modified_at, time_spent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      project.title,
      project.artworkPath,
      project.audioPreviewPath,
      project.dawProjectPath,
      project.dawType,
      project.bpm || 0,
      project.musicalKey || 'None',
      JSON.stringify(project.tags || []),
      project.collectionName,
      project.status || 'idea',
      project.favoriteVersionId || null,
      now,
      now,
      project.fileModifiedAt || null,
      project.timeSpent !== undefined ? project.timeSpent : null
    );

    return this.getProject(id)!;
  }

  updateProject(id: string, project: Partial<Project>): Project | null {
    const existing = this.getProject(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (project.title !== undefined) { updates.push('title = ?'); values.push(project.title); }
    if (project.artworkPath !== undefined) { updates.push('artwork_path = ?'); values.push(project.artworkPath); }
    if (project.audioPreviewPath !== undefined) { updates.push('audio_preview_path = ?'); values.push(project.audioPreviewPath); }
    if (project.dawProjectPath !== undefined) { updates.push('daw_project_path = ?'); values.push(project.dawProjectPath); }
    if (project.dawType !== undefined) { updates.push('daw_type = ?'); values.push(project.dawType); }
    if (project.bpm !== undefined) { updates.push('bpm = ?'); values.push(project.bpm); }
    if (project.musicalKey !== undefined) { updates.push('musical_key = ?'); values.push(project.musicalKey); }
    if (project.tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(project.tags)); }
    if (project.collectionName !== undefined) { updates.push('collection_name = ?'); values.push(project.collectionName); }
    if (project.status !== undefined) { updates.push('status = ?'); values.push(project.status); }
    if (project.favoriteVersionId !== undefined) { updates.push('favorite_version_id = ?'); values.push(project.favoriteVersionId); }
    if (project.fileModifiedAt !== undefined) { updates.push('file_modified_at = ?'); values.push(project.fileModifiedAt); }
    if (project.timeSpent !== undefined) { updates.push('time_spent = ?'); values.push(project.timeSpent); }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getProject(id);
  }

  deleteProject(id: string): boolean {
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      title: row.title,
      artworkPath: row.artwork_path,
      audioPreviewPath: row.audio_preview_path,
      dawProjectPath: row.daw_project_path,
      dawType: row.daw_type,
      bpm: row.bpm,
      musicalKey: row.musical_key,
      tags: JSON.parse(row.tags || '[]'),
      collectionName: row.collection_name,
      favoriteVersionId: row.favorite_version_id,
      status: row.status || 'idea',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      fileModifiedAt: row.file_modified_at,
      archived: Boolean(row.archived),
      timeSpent: row.time_spent !== null && row.time_spent !== undefined ? row.time_spent : null,
    };
  }

  // Group methods
  getGroups(): ProjectGroup[] {
    const rows = this.db.prepare('SELECT * FROM project_groups ORDER BY created_at DESC').all() as any[];
    return rows.map(this.mapRowToGroup);
  }

  getGroup(id: string): ProjectGroup | null {
    const row = this.db.prepare('SELECT * FROM project_groups WHERE id = ?').get(id) as any;
    return row ? this.mapRowToGroup(row) : null;
  }

  createGroup(group: Omit<ProjectGroup, 'id' | 'createdAt' | 'updatedAt'>): ProjectGroup {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    this.db.prepare(`
      INSERT INTO project_groups (id, name, artwork_path, description, project_ids, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      group.name,
      group.artworkPath,
      group.description,
      JSON.stringify(group.projectIds || []),
      now,
      now
    );

    return this.getGroup(id)!;
  }

  updateGroup(id: string, group: Partial<ProjectGroup>): ProjectGroup | null {
    const existing = this.getGroup(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (group.name !== undefined) { updates.push('name = ?'); values.push(group.name); }
    if (group.artworkPath !== undefined) { updates.push('artwork_path = ?'); values.push(group.artworkPath); }
    if (group.description !== undefined) { updates.push('description = ?'); values.push(group.description); }
    if (group.projectIds !== undefined) { updates.push('project_ids = ?'); values.push(JSON.stringify(group.projectIds)); }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db.prepare(`UPDATE project_groups SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getGroup(id);
  }

  deleteGroup(id: string): boolean {
    const result = this.db.prepare('DELETE FROM project_groups WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapRowToGroup(row: any): ProjectGroup {
    return {
      id: row.id,
      name: row.name,
      artworkPath: row.artwork_path,
      description: row.description,
      projectIds: JSON.parse(row.project_ids || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Task methods
  getTasks(): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY task_order ASC').all() as any[];
    return rows.map(this.mapRowToTask);
  }

  createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Get the max order for the status
    const maxOrder = this.db.prepare('SELECT MAX(task_order) as max_order FROM tasks WHERE status = ?').get(task.status) as any;
    const order = (maxOrder?.max_order || 0) + 1;
    
    this.db.prepare(`
      INSERT INTO tasks (id, title, description, status, due_date, task_order, project_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      task.title,
      task.description,
      task.status,
      task.dueDate,
      task.order || order,
      task.projectId || null,
      now,
      now
    );

    return this.getTask(id)!;
  }

  getTask(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    return row ? this.mapRowToTask(row) : null;
  }

  updateTask(id: string, task: Partial<Task>): Task | null {
    const existing = this.getTask(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (task.title !== undefined) { updates.push('title = ?'); values.push(task.title); }
    if (task.description !== undefined) { updates.push('description = ?'); values.push(task.description); }
    if (task.status !== undefined) { updates.push('status = ?'); values.push(task.status); }
    if (task.dueDate !== undefined) { updates.push('due_date = ?'); values.push(task.dueDate); }
    if (task.order !== undefined) { updates.push('task_order = ?'); values.push(task.order); }
    if (task.projectId !== undefined) { updates.push('project_id = ?'); values.push(task.projectId); }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getTask(id);
  }

  deleteTask(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  reorderTasks(tasks: { id: string; order: number; status: Task['status'] }[]): boolean {
    const stmt = this.db.prepare('UPDATE tasks SET task_order = ?, status = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();
    
    const transaction = this.db.transaction(() => {
      for (const task of tasks) {
        stmt.run(task.order, task.status, now, task.id);
      }
    });

    transaction();
    return true;
  }

  private mapRowToTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      dueDate: row.due_date,
      order: row.task_order,
      projectId: row.project_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Get tasks for a specific project
  getTasksByProject(projectId: string): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY task_order ASC').all(projectId) as any[];
    return rows.map(this.mapRowToTask);
  }

  // Tag methods
  getTags(): Tag[] {
    const rows = this.db.prepare('SELECT * FROM tags ORDER BY name ASC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
    }));
  }

  createTag(tag: Omit<Tag, 'id'>): Tag {
    const id = uuidv4();
    
    this.db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(
      id,
      tag.name,
      tag.color
    );

    return { id, ...tag };
  }

  deleteTag(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    return result.changes > 0;
  }

  clearAllProjects(): number {
    const result = this.db.prepare('DELETE FROM projects').run();
    return result.changes;
  }

  // Audio Version methods
  getVersionsByProject(projectId: string): AudioVersion[] {
    const rows = this.db.prepare('SELECT * FROM audio_versions WHERE project_id = ? ORDER BY version_number DESC').all(projectId) as any[];
    return rows.map(this.mapRowToVersion);
  }

  getVersion(id: string): AudioVersion | null {
    const row = this.db.prepare('SELECT * FROM audio_versions WHERE id = ?').get(id) as any;
    return row ? this.mapRowToVersion(row) : null;
  }

  createVersion(version: Omit<AudioVersion, 'id' | 'createdAt' | 'versionNumber'>): AudioVersion {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    // Get the next version number for this project
    const maxVersion = this.db.prepare('SELECT MAX(version_number) as max_version FROM audio_versions WHERE project_id = ?').get(version.projectId) as any;
    const versionNumber = (maxVersion?.max_version || 0) + 1;
    
    this.db.prepare(`
      INSERT INTO audio_versions (id, project_id, name, file_path, notes, version_number, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      version.projectId,
      version.name,
      version.filePath,
      version.notes,
      versionNumber,
      now
    );

    return this.getVersion(id)!;
  }

  updateVersion(id: string, version: Partial<AudioVersion>): AudioVersion | null {
    const existing = this.getVersion(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: any[] = [];

    if (version.name !== undefined) { updates.push('name = ?'); values.push(version.name); }
    if (version.filePath !== undefined) { updates.push('file_path = ?'); values.push(version.filePath); }
    if (version.notes !== undefined) { updates.push('notes = ?'); values.push(version.notes); }

    if (updates.length === 0) return existing;

    values.push(id);
    this.db.prepare(`UPDATE audio_versions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getVersion(id);
  }

  deleteVersion(id: string): boolean {
    const result = this.db.prepare('DELETE FROM audio_versions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapRowToVersion(row: any): AudioVersion {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      filePath: row.file_path,
      notes: row.notes,
      versionNumber: row.version_number,
      createdAt: row.created_at,
    };
  }

  // Annotation methods
  getAnnotationsByVersion(versionId: string): Annotation[] {
    const rows = this.db.prepare('SELECT * FROM annotations WHERE version_id = ? ORDER BY timestamp ASC').all(versionId) as any[];
    return rows.map(this.mapRowToAnnotation);
  }

  createAnnotation(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Annotation {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    this.db.prepare(`
      INSERT INTO annotations (id, version_id, timestamp, text, color, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      annotation.versionId,
      annotation.timestamp,
      annotation.text,
      annotation.color || '#6366f1',
      now,
      now
    );

    return this.getAnnotation(id)!;
  }

  getAnnotation(id: string): Annotation | null {
    const row = this.db.prepare('SELECT * FROM annotations WHERE id = ?').get(id) as any;
    return row ? this.mapRowToAnnotation(row) : null;
  }

  updateAnnotation(id: string, annotation: Partial<Annotation>): Annotation | null {
    const existing = this.getAnnotation(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (annotation.timestamp !== undefined) { updates.push('timestamp = ?'); values.push(annotation.timestamp); }
    if (annotation.text !== undefined) { updates.push('text = ?'); values.push(annotation.text); }
    if (annotation.color !== undefined) { updates.push('color = ?'); values.push(annotation.color); }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db.prepare(`UPDATE annotations SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getAnnotation(id);
  }

  deleteAnnotation(id: string): boolean {
    const result = this.db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapRowToAnnotation(row: any): Annotation {
    return {
      id: row.id,
      versionId: row.version_id,
      timestamp: row.timestamp,
      text: row.text,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  close(): void {
    this.db.close();
  }
}
