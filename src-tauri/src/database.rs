use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub title: String,
    pub artwork_path: Option<String>,
    pub audio_preview_path: Option<String>,
    pub daw_project_path: Option<String>,
    pub daw_type: Option<String>,
    pub bpm: i64,
    pub musical_key: String,
    pub tags: Vec<String>,
    pub collection_name: Option<String>,
    pub status: String,
    pub favorite_version_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub file_modified_at: Option<String>,
    pub archived: bool,
    pub time_spent: Option<i64>,
    pub genre: Option<String>,
    pub artists: Option<String>,
    pub sort_order: i64,
    #[serde(default)]
    pub share_count: i64,
    #[serde(default)]
    pub plugin_linked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGroup {
    pub id: String,
    pub name: String,
    pub artwork_path: Option<String>,
    pub description: Option<String>,
    pub project_ids: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub due_date: Option<String>,
    pub order: i64,
    pub project_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AudioVersion {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub file_path: String,
    pub notes: Option<String>,
    pub source: String, // "manual", "auto", "offline"
    pub version_number: i64,
    pub created_at: String,
    pub peak_db: Option<f64>,
    pub rms_db: Option<f64>,
    pub lufs_integrated: Option<f64>,
    pub analysis_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkHistoryEntry {
    pub id: String,
    pub project_id: String,
    pub file_path: String,
    pub source: String, // "file", "ai", "unsplash"
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Annotation {
    pub id: String,
    pub version_id: String,
    pub timestamp: f64,
    pub text: String,
    pub color: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_task: bool,
    pub task_status: Option<String>,
    pub task_priority: Option<String>,
    pub task_due_date: Option<String>,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS projects (
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
            );

            CREATE TABLE IF NOT EXISTS project_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                artwork_path TEXT,
                description TEXT,
                project_ids TEXT DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

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
            );

            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT DEFAULT '#6366f1'
            );

            CREATE TABLE IF NOT EXISTS audio_versions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                notes TEXT,
                version_number INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS annotations (
                id TEXT PRIMARY KEY,
                version_id TEXT NOT NULL,
                timestamp REAL NOT NULL,
                text TEXT NOT NULL,
                color TEXT DEFAULT '#6366f1',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (version_id) REFERENCES audio_versions(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_projects_title ON projects(title);
            CREATE INDEX IF NOT EXISTS idx_projects_bpm ON projects(bpm);
            CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
            CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(task_order);
            CREATE INDEX IF NOT EXISTS idx_versions_project ON audio_versions(project_id);
            CREATE INDEX IF NOT EXISTS idx_annotations_version ON annotations(version_id);
            CREATE INDEX IF NOT EXISTS idx_annotations_timestamp ON annotations(timestamp);",
        )?;

        // Artwork history table (created via migration so it's safe for existing DBs)
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS artwork_history (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                source TEXT DEFAULT 'file',
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_artwork_history_project ON artwork_history(project_id);
            CREATE INDEX IF NOT EXISTS idx_artwork_history_created ON artwork_history(created_at);",
        );

        // Migrations - add columns if they don't exist (ignore errors)
        let migrations = vec![
            "ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'idea'",
            "ALTER TABLE projects ADD COLUMN favorite_version_id TEXT",
            "ALTER TABLE projects ADD COLUMN archived INTEGER DEFAULT 0",
            "ALTER TABLE projects ADD COLUMN time_spent INTEGER DEFAULT 0",
            "ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL",
            "ALTER TABLE projects ADD COLUMN genre TEXT",
            "ALTER TABLE projects ADD COLUMN artists TEXT",
            "ALTER TABLE projects ADD COLUMN sort_order INTEGER DEFAULT 0",
            "ALTER TABLE audio_versions ADD COLUMN source TEXT DEFAULT 'manual'",
            // Extended features - user profile
            "ALTER TABLE annotations ADD COLUMN is_task INTEGER DEFAULT 0",
            "ALTER TABLE annotations ADD COLUMN task_status TEXT DEFAULT 'todo'",
            "ALTER TABLE annotations ADD COLUMN task_priority TEXT DEFAULT 'medium'",
            "ALTER TABLE annotations ADD COLUMN task_due_date TEXT",
            // Audio analysis columns
            "ALTER TABLE audio_versions ADD COLUMN peak_db REAL",
            "ALTER TABLE audio_versions ADD COLUMN rms_db REAL",
            "ALTER TABLE audio_versions ADD COLUMN lufs_integrated REAL",
            "ALTER TABLE audio_versions ADD COLUMN analysis_path TEXT",
            // Plugin bridge persistent link flag
            "ALTER TABLE projects ADD COLUMN plugin_linked INTEGER DEFAULT 0",
        ];

        for migration in migrations {
            let _ = conn.execute(migration, []);
        }

        // User profile table
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS user_profile (
                id TEXT PRIMARY KEY DEFAULT 'default',
                display_name TEXT NOT NULL DEFAULT 'Producer',
                avatar_path TEXT,
                bio TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT OR IGNORE INTO user_profile (id, display_name, created_at) VALUES ('default', 'Producer', datetime('now'));"
        );

        // Collaboration shares
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS project_shares (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                share_token TEXT NOT NULL UNIQUE,
                shared_with TEXT,
                permissions TEXT DEFAULT 'view',
                message TEXT,
                created_by TEXT,
                created_at TEXT NOT NULL,
                expires_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_shares_project ON project_shares(project_id);
            CREATE INDEX IF NOT EXISTS idx_shares_token ON project_shares(share_token);"
        );

        // Onboarding state
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS onboarding_state (
                id TEXT PRIMARY KEY DEFAULT 'default',
                completed_steps TEXT DEFAULT '[]',
                dismissed INTEGER DEFAULT 0,
                current_step INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT OR IGNORE INTO onboarding_state (id, created_at) VALUES ('default', datetime('now'));"
        );

        // Distribution links
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS project_distribution_links (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                platform TEXT NOT NULL,
                url TEXT NOT NULL,
                label TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_dist_links_project ON project_distribution_links(project_id);"
        );

        // Plugin instance → project persistent mapping (survives plugin state loss)
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS plugin_instance_links (
                plugin_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                linked_at TEXT NOT NULL DEFAULT (datetime('now'))
            );"
        );

        // FLP analysis cache
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS flp_analysis_cache (
                project_id TEXT PRIMARY KEY,
                analysis_json TEXT NOT NULL,
                file_hash TEXT,
                analyzed_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );"
        );

        // Versioned cache: clear stale analysis when format changes
        let _ = conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _cache_version (
                key TEXT PRIMARY KEY,
                version INTEGER NOT NULL
            );"
        );
        let current_analysis_version: i64 = 2; // bump when analysis JSON format changes
        let stored_version: i64 = conn
            .query_row(
                "SELECT version FROM _cache_version WHERE key = 'flp_analysis'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if stored_version < current_analysis_version {
            let _ = conn.execute_batch("DELETE FROM flp_analysis_cache;");
            let _ = conn.execute(
                "INSERT OR REPLACE INTO _cache_version (key, version) VALUES ('flp_analysis', ?1)",
                rusqlite::params![current_analysis_version],
            );
        }

        Ok(())
    }

    // ---- Projects ----

    pub fn get_projects(&self) -> Result<Vec<Project>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT p.*, COALESCE(s.cnt, 0) as share_count
                 FROM projects p
                 LEFT JOIN (SELECT project_id, COUNT(*) as cnt FROM project_shares GROUP BY project_id) s
                 ON p.id = s.project_id
                 ORDER BY p.created_at DESC"
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok(Self::map_row_to_project(row)))
            .map_err(|e| e.to_string())?;
        let mut projects = Vec::new();
        for row in rows {
            match row {
                Ok(p) => projects.push(p),
                Err(e) => log::error!("Error mapping project row: {}", e),
            }
        }
        Ok(projects)
    }

    pub fn get_project(&self, id: &str) -> Result<Option<Project>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM projects WHERE id = ?")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map(params![id], |row| Ok(Self::map_row_to_project(row)))
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(p)) => Ok(Some(p)),
            Some(Err(e)) => Err(e.to_string()),
            None => Ok(None),
        }
    }

    pub fn create_project(&self, project: &serde_json::Value) -> Result<Project, String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let created_at = project
            .get("createdAt")
            .and_then(|v| v.as_str())
            .unwrap_or(&now);
        let updated_at = project
            .get("updatedAt")
            .and_then(|v| v.as_str())
            .unwrap_or(&now);
        let title = project
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled");
        let artwork_path = project.get("artworkPath").and_then(|v| v.as_str());
        let audio_preview_path = project.get("audioPreviewPath").and_then(|v| v.as_str());
        let daw_project_path = project.get("dawProjectPath").and_then(|v| v.as_str());
        let daw_type = project.get("dawType").and_then(|v| v.as_str());
        let bpm = project
            .get("bpm")
            .and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64)))
            .unwrap_or(0);
        let musical_key = project
            .get("musicalKey")
            .and_then(|v| v.as_str())
            .unwrap_or("None");
        let tags_json = project
            .get("tags")
            .map(|v| v.to_string())
            .unwrap_or_else(|| "[]".to_string());
        let collection_name = project.get("collectionName").and_then(|v| v.as_str());
        let status = project
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("idea");
        let favorite_version_id = project.get("favoriteVersionId").and_then(|v| v.as_str());
        let file_modified_at = project.get("fileModifiedAt").and_then(|v| v.as_str());
        let time_spent = project.get("timeSpent").and_then(|v| v.as_i64());
        let genre = project.get("genre").and_then(|v| v.as_str());
        let artists = project.get("artists").and_then(|v| v.as_str());

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (id, title, artwork_path, audio_preview_path, daw_project_path, daw_type, bpm, musical_key, tags, collection_name, status, favorite_version_id, created_at, updated_at, file_modified_at, time_spent, genre, artists)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
            params![id, title, artwork_path, audio_preview_path, daw_project_path, daw_type, bpm, musical_key, tags_json, collection_name, status, favorite_version_id, created_at, updated_at, file_modified_at, time_spent, genre, artists],
        ).map_err(|e| e.to_string())?;
        drop(conn);

        self.get_project(&id)?
            .ok_or_else(|| "Failed to get created project".to_string())
    }

    pub fn update_project(
        &self,
        id: &str,
        updates: &serde_json::Value,
    ) -> Result<Option<Project>, String> {
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();

        let mut set_clauses = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        macro_rules! add_field {
            ($field:expr, $col:expr) => {
                if let Some(v) = updates.get($field) {
                    if v.is_null() {
                        set_clauses.push(format!("{} = ?", $col));
                        values.push(Box::new(Option::<String>::None));
                    } else if let Some(s) = v.as_str() {
                        set_clauses.push(format!("{} = ?", $col));
                        values.push(Box::new(s.to_string()));
                    } else if let Some(i) = v.as_i64() {
                        set_clauses.push(format!("{} = ?", $col));
                        values.push(Box::new(i));
                    } else if let Some(f) = v.as_f64() {
                        set_clauses.push(format!("{} = ?", $col));
                        values.push(Box::new(f as i64));
                    } else if let Some(b) = v.as_bool() {
                        set_clauses.push(format!("{} = ?", $col));
                        values.push(Box::new(b as i64));
                    }
                }
            };
        }

        add_field!("title", "title");
        add_field!("artworkPath", "artwork_path");
        add_field!("audioPreviewPath", "audio_preview_path");
        add_field!("dawProjectPath", "daw_project_path");
        add_field!("dawType", "daw_type");
        add_field!("bpm", "bpm");
        add_field!("musicalKey", "musical_key");
        add_field!("collectionName", "collection_name");
        add_field!("status", "status");
        add_field!("favoriteVersionId", "favorite_version_id");
        add_field!("fileModifiedAt", "file_modified_at");
        add_field!("timeSpent", "time_spent");
        add_field!("genre", "genre");
        add_field!("artists", "artists");
        add_field!("createdAt", "created_at");
        add_field!("sortOrder", "sort_order");

        if let Some(tags) = updates.get("tags") {
            set_clauses.push("tags = ?".to_string());
            values.push(Box::new(tags.to_string()));
        }

        if let Some(archived) = updates.get("archived") {
            set_clauses.push("archived = ?".to_string());
            values.push(Box::new(if archived.as_bool().unwrap_or(false) {
                1i64
            } else {
                0i64
            }));
        }

        if let Some(plugin_linked) = updates.get("pluginLinked") {
            set_clauses.push("plugin_linked = ?".to_string());
            values.push(Box::new(if plugin_linked.as_bool().unwrap_or(false) {
                1i64
            } else {
                0i64
            }));
        }

        set_clauses.push("updated_at = ?".to_string());
        if let Some(ua) = updates.get("updatedAt").and_then(|v| v.as_str()) {
            values.push(Box::new(ua.to_string()));
        } else {
            values.push(Box::new(now));
        }
        values.push(Box::new(id.to_string()));

        if set_clauses.is_empty() {
            drop(conn);
            return self.get_project(id);
        }

        let sql = format!(
            "UPDATE projects SET {} WHERE id = ?",
            set_clauses.join(", ")
        );
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params_ref.as_slice())
            .map_err(|e| e.to_string())?;
        drop(conn);

        self.get_project(id)
    }

    pub fn delete_project(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let changes = conn
            .execute("DELETE FROM projects WHERE id = ?", params![id])
            .map_err(|e| e.to_string())?;
        Ok(changes > 0)
    }

    pub fn clear_all_projects(&self) -> Result<i64, String> {
        let conn = self.conn.lock().unwrap();
        let changes = conn
            .execute("DELETE FROM projects", [])
            .map_err(|e| e.to_string())?;
        Ok(changes as i64)
    }

    fn map_row_to_project(row: &rusqlite::Row) -> Project {
        let tags_str: String = row
            .get::<_, String>("tags")
            .unwrap_or_else(|_| "[]".to_string());
        let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
        let archived: i64 = row.get("archived").unwrap_or(0);

        Project {
            id: row.get("id").unwrap_or_default(),
            title: row.get("title").unwrap_or_default(),
            artwork_path: row.get("artwork_path").ok(),
            audio_preview_path: row.get("audio_preview_path").ok(),
            daw_project_path: row.get("daw_project_path").ok(),
            daw_type: row.get("daw_type").ok(),
            bpm: row.get("bpm").unwrap_or(0),
            musical_key: row
                .get::<_, String>("musical_key")
                .unwrap_or_else(|_| "None".to_string()),
            tags,
            collection_name: row.get("collection_name").ok(),
            status: row
                .get::<_, String>("status")
                .unwrap_or_else(|_| "idea".to_string()),
            favorite_version_id: row.get("favorite_version_id").ok(),
            created_at: row.get("created_at").unwrap_or_default(),
            updated_at: row.get("updated_at").unwrap_or_default(),
            file_modified_at: row.get("file_modified_at").ok(),
            archived: archived != 0,
            time_spent: row.get("time_spent").ok(),
            genre: row.get("genre").ok(),
            artists: row.get("artists").ok(),
            sort_order: row.get("sort_order").unwrap_or(0),
            share_count: row.get("share_count").unwrap_or(0),
            plugin_linked: row.get::<_, i64>("plugin_linked").unwrap_or(0) != 0,
        }
    }

    // ---- Groups ----

    pub fn get_groups(&self) -> Result<Vec<ProjectGroup>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM project_groups ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok(Self::map_row_to_group(row)))
            .map_err(|e| e.to_string())?;
        let mut groups = Vec::new();
        for row in rows {
            if let Ok(g) = row {
                groups.push(g);
            }
        }
        Ok(groups)
    }

    pub fn get_group(&self, id: &str) -> Result<Option<ProjectGroup>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM project_groups WHERE id = ?")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map(params![id], |row| Ok(Self::map_row_to_group(row)))
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(g)) => Ok(Some(g)),
            _ => Ok(None),
        }
    }

    pub fn create_group(&self, group: &serde_json::Value) -> Result<ProjectGroup, String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let name = group
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled");
        let artwork_path = group.get("artworkPath").and_then(|v| v.as_str());
        let description = group.get("description").and_then(|v| v.as_str());
        let project_ids = group
            .get("projectIds")
            .map(|v| v.to_string())
            .unwrap_or_else(|| "[]".to_string());

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO project_groups (id, name, artwork_path, description, project_ids, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, name, artwork_path, description, project_ids, now, now],
        ).map_err(|e| e.to_string())?;
        drop(conn);

        self.get_group(&id)?
            .ok_or_else(|| "Failed to get created group".to_string())
    }

    pub fn update_group(
        &self,
        id: &str,
        updates: &serde_json::Value,
    ) -> Result<Option<ProjectGroup>, String> {
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();

        let mut set_clauses = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(v) = updates.get("name").and_then(|v| v.as_str()) {
            set_clauses.push("name = ?");
            values.push(Box::new(v.to_string()));
        }
        if let Some(v) = updates.get("artworkPath") {
            set_clauses.push("artwork_path = ?");
            values.push(Box::new(v.as_str().map(|s| s.to_string())));
        }
        if let Some(v) = updates.get("description") {
            set_clauses.push("description = ?");
            values.push(Box::new(v.as_str().map(|s| s.to_string())));
        }
        if let Some(v) = updates.get("projectIds") {
            set_clauses.push("project_ids = ?");
            values.push(Box::new(v.to_string()));
        }

        set_clauses.push("updated_at = ?");
        values.push(Box::new(now));
        values.push(Box::new(id.to_string()));

        let placeholders: Vec<&str> = set_clauses.iter().map(|s| *s).collect();
        let sql = format!(
            "UPDATE project_groups SET {} WHERE id = ?",
            placeholders.join(", ")
        );
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params_ref.as_slice())
            .map_err(|e| e.to_string())?;
        drop(conn);

        self.get_group(id)
    }

    pub fn delete_group(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let changes = conn
            .execute("DELETE FROM project_groups WHERE id = ?", params![id])
            .map_err(|e| e.to_string())?;
        Ok(changes > 0)
    }

    fn map_row_to_group(row: &rusqlite::Row) -> ProjectGroup {
        let ids_str: String = row
            .get::<_, String>("project_ids")
            .unwrap_or_else(|_| "[]".to_string());
        let project_ids: Vec<String> = serde_json::from_str(&ids_str).unwrap_or_default();

        ProjectGroup {
            id: row.get("id").unwrap_or_default(),
            name: row.get("name").unwrap_or_default(),
            artwork_path: row.get("artwork_path").ok(),
            description: row.get("description").ok(),
            project_ids,
            created_at: row.get("created_at").unwrap_or_default(),
            updated_at: row.get("updated_at").unwrap_or_default(),
        }
    }

    // ---- Tasks ----

    pub fn get_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM tasks ORDER BY task_order ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok(Self::map_row_to_task(row)))
            .map_err(|e| e.to_string())?;
        let mut tasks = Vec::new();
        for row in rows {
            if let Ok(t) = row {
                tasks.push(t);
            }
        }
        Ok(tasks)
    }

    pub fn get_tasks_by_project(&self, project_id: &str) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY task_order ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![project_id], |row| Ok(Self::map_row_to_task(row)))
            .map_err(|e| e.to_string())?;
        let mut tasks = Vec::new();
        for row in rows {
            if let Ok(t) = row {
                tasks.push(t);
            }
        }
        Ok(tasks)
    }

    pub fn create_task(&self, task: &serde_json::Value) -> Result<Task, String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let title = task
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled");
        let description = task.get("description").and_then(|v| v.as_str());
        let status = task
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("todo");
        let due_date = task.get("dueDate").and_then(|v| v.as_str());
        let project_id = task.get("projectId").and_then(|v| v.as_str());

        let conn = self.conn.lock().unwrap();
        // Get max order
        let max_order: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(task_order), 0) FROM tasks WHERE status = ?",
                params![status],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let order = task
            .get("order")
            .and_then(|v| v.as_i64())
            .unwrap_or(max_order + 1);

        conn.execute(
            "INSERT INTO tasks (id, title, description, status, due_date, task_order, project_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id, title, description, status, due_date, order, project_id, now, now],
        ).map_err(|e| e.to_string())?;
        drop(conn);

        self.get_task(&id)?
            .ok_or_else(|| "Failed to get created task".to_string())
    }

    pub fn get_task(&self, id: &str) -> Result<Option<Task>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM tasks WHERE id = ?")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map(params![id], |row| Ok(Self::map_row_to_task(row)))
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(t)) => Ok(Some(t)),
            _ => Ok(None),
        }
    }

    pub fn update_task(
        &self,
        id: &str,
        updates: &serde_json::Value,
    ) -> Result<Option<Task>, String> {
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();

        let mut set_clauses: Vec<String> = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(v) = updates.get("title").and_then(|v| v.as_str()) {
            set_clauses.push("title = ?".to_string());
            values.push(Box::new(v.to_string()));
        }
        if let Some(v) = updates.get("description") {
            set_clauses.push("description = ?".to_string());
            values.push(Box::new(v.as_str().map(|s| s.to_string())));
        }
        if let Some(v) = updates.get("status").and_then(|v| v.as_str()) {
            set_clauses.push("status = ?".to_string());
            values.push(Box::new(v.to_string()));
        }
        if let Some(v) = updates.get("dueDate") {
            set_clauses.push("due_date = ?".to_string());
            values.push(Box::new(v.as_str().map(|s| s.to_string())));
        }
        if let Some(v) = updates.get("order").and_then(|v| v.as_i64()) {
            set_clauses.push("task_order = ?".to_string());
            values.push(Box::new(v));
        }
        if let Some(v) = updates.get("projectId") {
            set_clauses.push("project_id = ?".to_string());
            values.push(Box::new(v.as_str().map(|s| s.to_string())));
        }

        set_clauses.push("updated_at = ?".to_string());
        values.push(Box::new(now));
        values.push(Box::new(id.to_string()));

        let sql = format!("UPDATE tasks SET {} WHERE id = ?", set_clauses.join(", "));
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params_ref.as_slice())
            .map_err(|e| e.to_string())?;
        drop(conn);

        self.get_task(id)
    }

    pub fn delete_task(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let changes = conn
            .execute("DELETE FROM tasks WHERE id = ?", params![id])
            .map_err(|e| e.to_string())?;
        Ok(changes > 0)
    }

    /// Batch-update sort_order for projects. Each entry should have "id" and "sortOrder".
    pub fn reorder_projects(&self, projects: &[serde_json::Value]) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        for p in projects {
            let id = p.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let order = p.get("sortOrder").and_then(|v| v.as_i64()).unwrap_or(0);
            tx.execute(
                "UPDATE projects SET sort_order = ? WHERE id = ?",
                params![order, id],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(true)
    }

    pub fn reorder_tasks(&self, tasks: &[serde_json::Value]) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        for task in tasks {
            let id = task.get("id").and_then(|v| v.as_str()).unwrap_or_default();
            let order = task.get("order").and_then(|v| v.as_i64()).unwrap_or(0);
            let status = task
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("todo");
            tx.execute(
                "UPDATE tasks SET task_order = ?, status = ?, updated_at = ? WHERE id = ?",
                params![order, status, now, id],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(true)
    }

    fn map_row_to_task(row: &rusqlite::Row) -> Task {
        Task {
            id: row.get("id").unwrap_or_default(),
            title: row.get("title").unwrap_or_default(),
            description: row.get("description").ok(),
            status: row.get("status").unwrap_or_else(|_| "todo".to_string()),
            due_date: row.get("due_date").ok(),
            order: row.get("task_order").unwrap_or(0),
            project_id: row.get("project_id").ok(),
            created_at: row.get("created_at").unwrap_or_default(),
            updated_at: row.get("updated_at").unwrap_or_default(),
        }
    }

    // ---- Tags ----

    pub fn get_tags(&self) -> Result<Vec<Tag>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM tags ORDER BY name ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Tag {
                    id: row.get("id")?,
                    name: row.get("name")?,
                    color: row.get("color")?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut tags = Vec::new();
        for row in rows {
            if let Ok(t) = row {
                tags.push(t);
            }
        }
        Ok(tags)
    }

    pub fn create_tag(&self, tag: &serde_json::Value) -> Result<Tag, String> {
        let id = Uuid::new_v4().to_string();
        let name = tag
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled");
        let color = tag
            .get("color")
            .and_then(|v| v.as_str())
            .unwrap_or("#6366f1");

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
            params![id, name, color],
        )
        .map_err(|e| e.to_string())?;

        Ok(Tag {
            id,
            name: name.to_string(),
            color: color.to_string(),
        })
    }

    pub fn delete_tag(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let changes = conn
            .execute("DELETE FROM tags WHERE id = ?", params![id])
            .map_err(|e| e.to_string())?;
        Ok(changes > 0)
    }

    // ---- Audio Versions ----

    pub fn get_versions_by_project(&self, project_id: &str) -> Result<Vec<AudioVersion>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT * FROM audio_versions WHERE project_id = ? ORDER BY version_number DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![project_id], |row| Ok(Self::map_row_to_version(row)))
            .map_err(|e| e.to_string())?;
        let mut versions = Vec::new();
        for row in rows {
            if let Ok(v) = row {
                versions.push(v);
            }
        }
        Ok(versions)
    }

    pub fn get_version(&self, id: &str) -> Result<Option<AudioVersion>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM audio_versions WHERE id = ?")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map(params![id], |row| Ok(Self::map_row_to_version(row)))
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(v)) => Ok(Some(v)),
            _ => Ok(None),
        }
    }

    pub fn create_version(&self, version: &serde_json::Value) -> Result<AudioVersion, String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let project_id = version
            .get("projectId")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let name = version
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled");
        let file_path = version
            .get("filePath")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let notes = version.get("notes").and_then(|v| v.as_str());
        let source = version
            .get("source")
            .and_then(|v| v.as_str())
            .unwrap_or("manual");
        let peak_db = version.get("peakDb").and_then(|v| v.as_f64());
        let rms_db = version.get("rmsDb").and_then(|v| v.as_f64());
        let lufs_integrated = version.get("lufsIntegrated").and_then(|v| v.as_f64());
        let analysis_path = version.get("analysisPath").and_then(|v| v.as_str());

        let conn = self.conn.lock().unwrap();
        let max_version: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(version_number), 0) FROM audio_versions WHERE project_id = ?",
                params![project_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let version_number = max_version + 1;

        conn.execute(
            "INSERT INTO audio_versions (id, project_id, name, file_path, notes, source, version_number, created_at, peak_db, rms_db, lufs_integrated, analysis_path) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![id, project_id, name, file_path, notes, source, version_number, now, peak_db, rms_db, lufs_integrated, analysis_path],
        ).map_err(|e| e.to_string())?;
        drop(conn);

        self.get_version(&id)?
            .ok_or_else(|| "Failed to get created version".to_string())
    }

    pub fn update_version(
        &self,
        id: &str,
        updates: &serde_json::Value,
    ) -> Result<Option<AudioVersion>, String> {
        let conn = self.conn.lock().unwrap();
        let mut set_clauses: Vec<String> = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(v) = updates.get("name").and_then(|v| v.as_str()) {
            set_clauses.push("name = ?".to_string());
            values.push(Box::new(v.to_string()));
        }
        if let Some(v) = updates.get("filePath").and_then(|v| v.as_str()) {
            set_clauses.push("file_path = ?".to_string());
            values.push(Box::new(v.to_string()));
        }
        if let Some(v) = updates.get("notes") {
            set_clauses.push("notes = ?".to_string());
            values.push(Box::new(v.as_str().map(|s| s.to_string())));
        }

        if set_clauses.is_empty() {
            drop(conn);
            return self.get_version(id);
        }

        values.push(Box::new(id.to_string()));
        let sql = format!(
            "UPDATE audio_versions SET {} WHERE id = ?",
            set_clauses.join(", ")
        );
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params_ref.as_slice())
            .map_err(|e| e.to_string())?;
        drop(conn);

        self.get_version(id)
    }

    pub fn delete_version(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let changes = conn
            .execute("DELETE FROM audio_versions WHERE id = ?", params![id])
            .map_err(|e| e.to_string())?;
        Ok(changes > 0)
    }

    /// Update analysis fields on an audio version.
    pub fn update_version_analysis(
        &self,
        id: &str,
        peak_db: f64,
        rms_db: f64,
        lufs_integrated: f64,
        analysis_path: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE audio_versions SET peak_db = ?1, rms_db = ?2, lufs_integrated = ?3, analysis_path = ?4 WHERE id = ?5",
            params![peak_db, rms_db, lufs_integrated, analysis_path, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Delete all audio versions for a specific project. Returns the deleted versions
    /// so callers can clean up files on disk.
    pub fn delete_versions_by_project(
        &self,
        project_id: &str,
    ) -> Result<Vec<AudioVersion>, String> {
        let versions = self.get_versions_by_project(project_id)?;
        let conn = self.conn.lock().unwrap();
        // Delete associated annotations first
        conn.execute(
            "DELETE FROM annotations WHERE version_id IN (SELECT id FROM audio_versions WHERE project_id = ?)",
            params![project_id],
        ).map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM audio_versions WHERE project_id = ?",
            params![project_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(versions)
    }

    /// Delete all audio versions across all projects. Returns the deleted versions
    /// so callers can clean up files on disk.
    pub fn delete_all_versions(&self) -> Result<Vec<AudioVersion>, String> {
        let conn = self.conn.lock().unwrap();
        // Gather all versions first
        let mut stmt = conn
            .prepare("SELECT * FROM audio_versions")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok(Self::map_row_to_version(row)))
            .map_err(|e| e.to_string())?;
        let mut versions = Vec::new();
        for row in rows {
            if let Ok(v) = row {
                versions.push(v);
            }
        }
        drop(stmt);
        // Delete all annotations then all versions
        conn.execute("DELETE FROM annotations", [])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM audio_versions", [])
            .map_err(|e| e.to_string())?;
        Ok(versions)
    }

    /// Get a map of project_id -> list of distinct version sources for that project
    pub fn get_project_version_sources(
        &self,
    ) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT project_id, source FROM audio_versions ORDER BY project_id")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>("project_id").unwrap_or_default(),
                    row.get::<_, String>("source")
                        .unwrap_or_else(|_| "manual".to_string()),
                ))
            })
            .map_err(|e| e.to_string())?;
        let mut map: std::collections::HashMap<String, std::collections::HashSet<String>> =
            std::collections::HashMap::new();
        for row in rows {
            if let Ok((pid, src)) = row {
                map.entry(pid).or_default().insert(src);
            }
        }
        Ok(map
            .into_iter()
            .map(|(k, v)| (k, v.into_iter().collect()))
            .collect())
    }

    fn map_row_to_version(row: &rusqlite::Row) -> AudioVersion {
        AudioVersion {
            id: row.get("id").unwrap_or_default(),
            project_id: row.get("project_id").unwrap_or_default(),
            name: row.get("name").unwrap_or_default(),
            file_path: row.get("file_path").unwrap_or_default(),
            notes: row.get("notes").ok(),
            source: row
                .get::<_, String>("source")
                .unwrap_or_else(|_| "manual".to_string()),
            version_number: row.get("version_number").unwrap_or(0),
            created_at: row.get("created_at").unwrap_or_default(),
            peak_db: row.get("peak_db").ok(),
            rms_db: row.get("rms_db").ok(),
            lufs_integrated: row.get("lufs_integrated").ok(),
            analysis_path: row.get("analysis_path").ok(),
        }
    }

    // ---- Annotations ----

    pub fn get_annotations_by_version(&self, version_id: &str) -> Result<Vec<Annotation>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM annotations WHERE version_id = ? ORDER BY timestamp ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![version_id], |row| {
                Ok(Self::map_row_to_annotation(row))
            })
            .map_err(|e| e.to_string())?;
        let mut annotations = Vec::new();
        for row in rows {
            if let Ok(a) = row {
                annotations.push(a);
            }
        }
        Ok(annotations)
    }

    pub fn create_annotation(&self, annotation: &serde_json::Value) -> Result<Annotation, String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let version_id = annotation
            .get("versionId")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let timestamp = annotation
            .get("timestamp")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        let text = annotation
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let color = annotation
            .get("color")
            .and_then(|v| v.as_str())
            .unwrap_or("#6366f1");

        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO annotations (id, version_id, timestamp, text, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, version_id, timestamp, text, color, now, now],
        ).map_err(|e| e.to_string())?;
        drop(conn);

        self.get_annotation(&id)?
            .ok_or_else(|| "Failed to get created annotation".to_string())
    }

    pub fn get_annotation(&self, id: &str) -> Result<Option<Annotation>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM annotations WHERE id = ?")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map(params![id], |row| Ok(Self::map_row_to_annotation(row)))
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(a)) => Ok(Some(a)),
            _ => Ok(None),
        }
    }

    pub fn update_annotation(
        &self,
        id: &str,
        updates: &serde_json::Value,
    ) -> Result<Option<Annotation>, String> {
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();

        let mut set_clauses: Vec<String> = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(v) = updates.get("timestamp").and_then(|v| v.as_f64()) {
            set_clauses.push("timestamp = ?".to_string());
            values.push(Box::new(v));
        }
        if let Some(v) = updates.get("text").and_then(|v| v.as_str()) {
            set_clauses.push("text = ?".to_string());
            values.push(Box::new(v.to_string()));
        }
        if let Some(v) = updates.get("color").and_then(|v| v.as_str()) {
            set_clauses.push("color = ?".to_string());
            values.push(Box::new(v.to_string()));
        }

        set_clauses.push("updated_at = ?".to_string());
        values.push(Box::new(now));
        values.push(Box::new(id.to_string()));

        let sql = format!(
            "UPDATE annotations SET {} WHERE id = ?",
            set_clauses.join(", ")
        );
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params_ref.as_slice())
            .map_err(|e| e.to_string())?;
        drop(conn);

        self.get_annotation(id)
    }

    pub fn delete_annotation(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let changes = conn
            .execute("DELETE FROM annotations WHERE id = ?", params![id])
            .map_err(|e| e.to_string())?;
        Ok(changes > 0)
    }

    fn map_row_to_annotation(row: &rusqlite::Row) -> Annotation {
        Annotation {
            id: row.get("id").unwrap_or_default(),
            version_id: row.get("version_id").unwrap_or_default(),
            timestamp: row.get("timestamp").unwrap_or(0.0),
            text: row.get("text").unwrap_or_default(),
            color: row
                .get::<_, String>("color")
                .unwrap_or_else(|_| "#6366f1".to_string()),
            created_at: row.get("created_at").unwrap_or_default(),
            updated_at: row.get("updated_at").unwrap_or_default(),
            is_task: row.get::<_, i64>("is_task").unwrap_or(0) != 0,
            task_status: row.get("task_status").ok(),
            task_priority: row.get("task_priority").ok(),
            task_due_date: row.get("task_due_date").ok(),
        }
    }

    // ---- Artwork History ----

    pub fn get_artwork_history(
        &self,
        project_id: &str,
    ) -> Result<Vec<ArtworkHistoryEntry>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM artwork_history WHERE project_id = ? ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![project_id], |row| {
                Ok(ArtworkHistoryEntry {
                    id: row.get("id")?,
                    project_id: row.get("project_id")?,
                    file_path: row.get("file_path")?,
                    source: row
                        .get::<_, String>("source")
                        .unwrap_or_else(|_| "file".to_string()),
                    created_at: row.get("created_at")?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut entries = Vec::new();
        for row in rows {
            if let Ok(e) = row {
                entries.push(e);
            }
        }
        Ok(entries)
    }

    pub fn add_artwork_history(
        &self,
        project_id: &str,
        file_path: &str,
        source: &str,
    ) -> Result<ArtworkHistoryEntry, String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        // Don't add duplicate consecutive entries
        let conn = self.conn.lock().unwrap();
        let existing: Option<String> = conn
            .query_row(
                "SELECT file_path FROM artwork_history WHERE project_id = ? ORDER BY created_at DESC LIMIT 1",
                params![project_id],
                |row| row.get(0),
            )
            .ok();
        if existing.as_deref() == Some(file_path) {
            // Return the existing entry instead of creating a duplicate
            let mut stmt = conn
                .prepare("SELECT * FROM artwork_history WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
                .map_err(|e| e.to_string())?;
            let entry = stmt
                .query_row(params![project_id], |row| {
                    Ok(ArtworkHistoryEntry {
                        id: row.get("id")?,
                        project_id: row.get("project_id")?,
                        file_path: row.get("file_path")?,
                        source: row
                            .get::<_, String>("source")
                            .unwrap_or_else(|_| "file".to_string()),
                        created_at: row.get("created_at")?,
                    })
                })
                .map_err(|e| e.to_string())?;
            return Ok(entry);
        }

        conn.execute(
            "INSERT INTO artwork_history (id, project_id, file_path, source, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, project_id, file_path, source, now],
        ).map_err(|e| e.to_string())?;

        Ok(ArtworkHistoryEntry {
            id,
            project_id: project_id.to_string(),
            file_path: file_path.to_string(),
            source: source.to_string(),
            created_at: now,
        })
    }

    pub fn delete_artwork_history_entry(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let changes = conn
            .execute("DELETE FROM artwork_history WHERE id = ?", params![id])
            .map_err(|e| e.to_string())?;
        Ok(changes > 0)
    }

    // ---- User Profile ----

    pub fn get_user_profile(&self) -> Result<UserProfile, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM user_profile WHERE id = 'default'")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row([], |row| {
                Ok(UserProfile {
                    id: row.get("id")?,
                    display_name: row.get("display_name")?,
                    avatar_path: row.get("avatar_path").ok(),
                    bio: row.get("bio").ok(),
                    created_at: row.get("created_at")?,
                })
            })
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    pub fn update_user_profile(&self, data: &serde_json::Value) -> Result<UserProfile, String> {
        let conn = self.conn.lock().unwrap();
        if let Some(name) = data.get("displayName").and_then(|v| v.as_str()) {
            conn.execute(
                "UPDATE user_profile SET display_name = ? WHERE id = 'default'",
                params![name],
            ).map_err(|e| e.to_string())?;
        }
        if let Some(avatar) = data.get("avatarPath") {
            let avatar_str = avatar.as_str();
            conn.execute(
                "UPDATE user_profile SET avatar_path = ? WHERE id = 'default'",
                params![avatar_str],
            ).map_err(|e| e.to_string())?;
        }
        if let Some(bio) = data.get("bio") {
            let bio_str = bio.as_str();
            conn.execute(
                "UPDATE user_profile SET bio = ? WHERE id = 'default'",
                params![bio_str],
            ).map_err(|e| e.to_string())?;
        }
        drop(conn);
        self.get_user_profile()
    }

    // ---- Collaboration / Shares ----

    pub fn create_share(&self, project_id: &str, permissions: &str, message: Option<&str>, created_by: Option<&str>) -> Result<ProjectShare, String> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let token = format!("dbundone_{}", Uuid::new_v4().to_string().replace('-', ""));
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO project_shares (id, project_id, share_token, permissions, message, created_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, project_id, token, permissions, message, created_by, now],
        ).map_err(|e| e.to_string())?;
        Ok(ProjectShare {
            id,
            project_id: project_id.to_string(),
            share_token: token,
            shared_with: None,
            permissions: permissions.to_string(),
            message: message.map(|s| s.to_string()),
            created_by: created_by.map(|s| s.to_string()),
            created_at: now,
            expires_at: None,
        })
    }

    pub fn get_shares_by_project(&self, project_id: &str) -> Result<Vec<ProjectShare>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM project_shares WHERE project_id = ? ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![project_id], |row| {
                Ok(ProjectShare {
                    id: row.get("id")?,
                    project_id: row.get("project_id")?,
                    share_token: row.get("share_token")?,
                    shared_with: row.get("shared_with").ok(),
                    permissions: row.get::<_, String>("permissions").unwrap_or_else(|_| "view".to_string()),
                    message: row.get("message").ok(),
                    created_by: row.get("created_by").ok(),
                    created_at: row.get("created_at")?,
                    expires_at: row.get("expires_at").ok(),
                })
            })
            .map_err(|e| e.to_string())?;
        let mut shares = Vec::new();
        for row in rows {
            match row {
                Ok(s) => shares.push(s),
                Err(e) => log::error!("Error mapping share row: {}", e),
            }
        }
        Ok(shares)
    }

    pub fn delete_share(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let changes = conn
            .execute("DELETE FROM project_shares WHERE id = ?", params![id])
            .map_err(|e| e.to_string())?;
        Ok(changes > 0)
    }

    // ---- FLP Analysis Cache ----

    pub fn get_flp_analysis_cache(&self, project_id: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT analysis_json FROM flp_analysis_cache WHERE project_id = ?")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row(params![project_id], |row| row.get::<_, String>(0))
            .ok();
        Ok(result)
    }

    pub fn save_flp_analysis_cache(&self, project_id: &str, analysis_json: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO flp_analysis_cache (project_id, analysis_json, analyzed_at) VALUES (?1, ?2, ?3)",
            params![project_id, analysis_json, now],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    // ---- Onboarding ----

    pub fn get_onboarding_state(&self) -> Result<OnboardingState, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM onboarding_state WHERE id = 'default'")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row([], |row| {
                let steps_json: String = row.get::<_, String>("completed_steps").unwrap_or_else(|_| "[]".to_string());
                let steps: Vec<String> = serde_json::from_str(&steps_json).unwrap_or_default();
                Ok(OnboardingState {
                    completed_steps: steps,
                    dismissed: row.get::<_, i64>("dismissed").unwrap_or(0) != 0,
                    current_step: row.get::<_, i64>("current_step").unwrap_or(0) as usize,
                })
            })
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    pub fn update_onboarding_state(&self, state: &serde_json::Value) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        if let Some(steps) = state.get("completedSteps") {
            let json = serde_json::to_string(steps).unwrap_or_else(|_| "[]".to_string());
            conn.execute(
                "UPDATE onboarding_state SET completed_steps = ? WHERE id = 'default'",
                params![json],
            ).map_err(|e| e.to_string())?;
        }
        if let Some(dismissed) = state.get("dismissed").and_then(|v| v.as_bool()) {
            conn.execute(
                "UPDATE onboarding_state SET dismissed = ? WHERE id = 'default'",
                params![dismissed as i64],
            ).map_err(|e| e.to_string())?;
        }
        if let Some(step) = state.get("currentStep").and_then(|v| v.as_u64()) {
            conn.execute(
                "UPDATE onboarding_state SET current_step = ? WHERE id = 'default'",
                params![step as i64],
            ).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    // ---- Annotation Task Extension ----

    pub fn convert_annotation_to_task(&self, annotation_id: &str) -> Result<Annotation, String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE annotations SET is_task = 1, task_status = 'todo' WHERE id = ?",
            params![annotation_id],
        ).map_err(|e| e.to_string())?;
        drop(conn);
        // Return updated annotation
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM annotations WHERE id = ?")
            .map_err(|e| e.to_string())?;
        stmt.query_row(params![annotation_id], |row| Ok(Self::map_row_to_annotation(row)))
            .map_err(|e| e.to_string())
    }

    pub fn unconvert_annotation_from_task(&self, annotation_id: &str) -> Result<Annotation, String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE annotations SET is_task = 0, task_status = NULL, task_priority = NULL, task_due_date = NULL WHERE id = ?",
            params![annotation_id],
        ).map_err(|e| e.to_string())?;
        drop(conn);
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM annotations WHERE id = ?")
            .map_err(|e| e.to_string())?;
        stmt.query_row(params![annotation_id], |row| Ok(Self::map_row_to_annotation(row)))
            .map_err(|e| e.to_string())
    }

    pub fn update_annotation_task(&self, annotation_id: &str, data: &serde_json::Value) -> Result<Annotation, String> {
        let conn = self.conn.lock().unwrap();
        if let Some(status) = data.get("taskStatus").and_then(|v| v.as_str()) {
            conn.execute(
                "UPDATE annotations SET task_status = ? WHERE id = ?",
                params![status, annotation_id],
            ).map_err(|e| e.to_string())?;
        }
        if let Some(priority) = data.get("taskPriority").and_then(|v| v.as_str()) {
            conn.execute(
                "UPDATE annotations SET task_priority = ? WHERE id = ?",
                params![priority, annotation_id],
            ).map_err(|e| e.to_string())?;
        }
        if let Some(due_date) = data.get("taskDueDate") {
            let dd = due_date.as_str();
            conn.execute(
                "UPDATE annotations SET task_due_date = ? WHERE id = ?",
                params![dd, annotation_id],
            ).map_err(|e| e.to_string())?;
        }
        drop(conn);
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT * FROM annotations WHERE id = ?")
            .map_err(|e| e.to_string())?;
        stmt.query_row(params![annotation_id], |row| Ok(Self::map_row_to_annotation(row)))
            .map_err(|e| e.to_string())
    }

    pub fn get_task_annotations_by_project(&self, project_id: &str) -> Result<Vec<Annotation>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT a.* FROM annotations a 
                 JOIN audio_versions v ON a.version_id = v.id 
                 WHERE v.project_id = ? AND a.is_task = 1 
                 ORDER BY a.timestamp ASC"
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![project_id], |row| Ok(Self::map_row_to_annotation(row)))
            .map_err(|e| e.to_string())?;
        let mut annotations = Vec::new();
        for row in rows {
            match row {
                Ok(a) => annotations.push(a),
                Err(e) => log::error!("Error mapping task annotation: {}", e),
            }
        }
        Ok(annotations)
    }

    // ---- Distribution Links ----

    pub fn get_distribution_links(&self, project_id: &str) -> Result<Vec<DistributionLink>, String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, project_id, platform, url, label, created_at FROM project_distribution_links WHERE project_id = ? ORDER BY created_at ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![project_id], |row| {
                Ok(DistributionLink {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    platform: row.get(2)?,
                    url: row.get(3)?,
                    label: row.get(4)?,
                    created_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut links = Vec::new();
        for row in rows {
            match row {
                Ok(l) => links.push(l),
                Err(e) => log::error!("Error mapping distribution link row: {}", e),
            }
        }
        Ok(links)
    }

    pub fn create_distribution_link(
        &self,
        project_id: &str,
        platform: &str,
        url: &str,
        label: Option<&str>,
    ) -> Result<DistributionLink, String> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO project_distribution_links (id, project_id, platform, url, label, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, project_id, platform, url, label, now],
        )
        .map_err(|e| e.to_string())?;
        Ok(DistributionLink {
            id,
            project_id: project_id.to_string(),
            platform: platform.to_string(),
            url: url.to_string(),
            label: label.map(|s| s.to_string()),
            created_at: now,
        })
    }

    pub fn delete_distribution_link(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().unwrap();
        let count = conn
            .execute("DELETE FROM project_distribution_links WHERE id = ?", params![id])
            .map_err(|e| e.to_string())?;
        Ok(count > 0)
    }

    // ---- Plugin instance → project persistent links ----

    /// Persist a plugin_id → project_id mapping so dbundone can auto-relink
    /// even when the plugin has no saved state (e.g. freshly added to a DAW project).
    pub fn save_plugin_link(&self, plugin_id: &str, project_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO plugin_instance_links (plugin_id, project_id, linked_at)
             VALUES (?1, ?2, datetime('now'))",
            params![plugin_id, project_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Look up the last project a plugin instance was linked to.
    pub fn get_plugin_project(&self, plugin_id: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT project_id FROM plugin_instance_links WHERE plugin_id = ?1",
            params![plugin_id],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(pid) => Ok(Some(pid)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
}

// ── New struct definitions ─────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: String,
    pub display_name: String,
    pub avatar_path: Option<String>,
    pub bio: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectShare {
    pub id: String,
    pub project_id: String,
    pub share_token: String,
    pub shared_with: Option<String>,
    pub permissions: String,
    pub message: Option<String>,
    pub created_by: Option<String>,
    pub created_at: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingState {
    pub completed_steps: Vec<String>,
    pub dismissed: bool,
    pub current_step: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DistributionLink {
    pub id: String,
    pub project_id: String,
    pub platform: String,
    pub url: String,
    pub label: Option<String>,
    pub created_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        Database::new(":memory:").expect("Failed to create in-memory database")
    }

    // ---- Project CRUD (10 tests) ----

    #[test]
    fn test_create_project_minimal() {
        let db = test_db();
        let data = serde_json::json!({ "title": "My Beat" });
        let project = db.create_project(&data).unwrap();
        assert_eq!(project.title, "My Beat");
        assert!(!project.id.is_empty());
        assert_eq!(project.bpm, 0);
        assert_eq!(project.status, "idea");
        assert_eq!(project.archived, false);
    }

    #[test]
    fn test_create_project_full_fields() {
        let db = test_db();
        let data = serde_json::json!({
            "title": "Full Track",
            "artworkPath": "/art.png",
            "audioPreviewPath": "/preview.mp3",
            "dawProjectPath": "/project.flp",
            "dawType": "FL Studio",
            "bpm": 140,
            "musicalKey": "C minor",
            "tags": ["trap", "dark"],
            "collectionName": "Album 1",
            "status": "mixing",
            "timeSpent": 120
        });
        let p = db.create_project(&data).unwrap();
        assert_eq!(p.title, "Full Track");
        assert_eq!(p.artwork_path.as_deref(), Some("/art.png"));
        assert_eq!(p.audio_preview_path.as_deref(), Some("/preview.mp3"));
        assert_eq!(p.daw_project_path.as_deref(), Some("/project.flp"));
        assert_eq!(p.daw_type.as_deref(), Some("FL Studio"));
        assert_eq!(p.bpm, 140);
        assert_eq!(p.musical_key, "C minor");
        assert_eq!(p.tags, vec!["trap", "dark"]);
        assert_eq!(p.collection_name.as_deref(), Some("Album 1"));
        assert_eq!(p.status, "mixing");
        assert_eq!(p.time_spent, Some(120));
    }

    #[test]
    fn test_get_project_by_id() {
        let db = test_db();
        let created = db
            .create_project(&serde_json::json!({"title": "Test"}))
            .unwrap();
        let fetched = db.get_project(&created.id).unwrap();
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().title, "Test");
    }

    #[test]
    fn test_get_project_nonexistent() {
        let db = test_db();
        let result = db.get_project("nonexistent-id").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_get_projects_empty() {
        let db = test_db();
        let projects = db.get_projects().unwrap();
        assert!(projects.is_empty());
    }

    #[test]
    fn test_get_projects_ordered_by_created_at_desc() {
        let db = test_db();
        db.create_project(&serde_json::json!({"title": "First"}))
            .unwrap();
        db.create_project(&serde_json::json!({"title": "Second"}))
            .unwrap();
        let projects = db.get_projects().unwrap();
        assert_eq!(projects.len(), 2);
        // Most recent first
        assert_eq!(projects[0].title, "Second");
        assert_eq!(projects[1].title, "First");
    }

    #[test]
    fn test_update_project_title() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "Old"}))
            .unwrap();
        let updated = db
            .update_project(&p.id, &serde_json::json!({"title": "New"}))
            .unwrap();
        assert!(updated.is_some());
        assert_eq!(updated.unwrap().title, "New");
    }

    #[test]
    fn test_update_project_multiple_fields() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "Track"}))
            .unwrap();
        let updated = db
            .update_project(
                &p.id,
                &serde_json::json!({
                    "bpm": 128,
                    "musicalKey": "A minor",
                    "status": "completed",
                    "tags": ["edm"],
                    "archived": true,
                    "timeSpent": 60
                }),
            )
            .unwrap()
            .unwrap();
        assert_eq!(updated.bpm, 128);
        assert_eq!(updated.musical_key, "A minor");
        assert_eq!(updated.status, "completed");
        assert_eq!(updated.tags, vec!["edm"]);
        assert_eq!(updated.archived, true);
        assert_eq!(updated.time_spent, Some(60));
    }

    #[test]
    fn test_delete_project() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "Delete Me"}))
            .unwrap();
        assert!(db.delete_project(&p.id).unwrap());
        assert!(db.get_project(&p.id).unwrap().is_none());
    }

    #[test]
    fn test_delete_project_nonexistent() {
        let db = test_db();
        assert!(!db.delete_project("no-such-id").unwrap());
    }

    #[test]
    fn test_clear_all_projects() {
        let db = test_db();
        db.create_project(&serde_json::json!({"title": "A"}))
            .unwrap();
        db.create_project(&serde_json::json!({"title": "B"}))
            .unwrap();
        let count = db.clear_all_projects().unwrap();
        assert_eq!(count, 2);
        assert!(db.get_projects().unwrap().is_empty());
    }

    // ---- Group CRUD (7 tests) ----

    #[test]
    fn test_create_group() {
        let db = test_db();
        let g = db
            .create_group(&serde_json::json!({"name": "My Group"}))
            .unwrap();
        assert_eq!(g.name, "My Group");
        assert!(!g.id.is_empty());
        assert!(g.project_ids.is_empty());
    }

    #[test]
    fn test_create_group_with_project_ids() {
        let db = test_db();
        let g = db
            .create_group(&serde_json::json!({
                "name": "Group",
                "projectIds": ["id1", "id2"],
                "description": "A group"
            }))
            .unwrap();
        assert_eq!(g.project_ids, vec!["id1", "id2"]);
        assert_eq!(g.description.as_deref(), Some("A group"));
    }

    #[test]
    fn test_get_group_by_id() {
        let db = test_db();
        let g = db.create_group(&serde_json::json!({"name": "G"})).unwrap();
        let fetched = db.get_group(&g.id).unwrap().unwrap();
        assert_eq!(fetched.name, "G");
    }

    #[test]
    fn test_get_groups_list() {
        let db = test_db();
        db.create_group(&serde_json::json!({"name": "G1"})).unwrap();
        db.create_group(&serde_json::json!({"name": "G2"})).unwrap();
        assert_eq!(db.get_groups().unwrap().len(), 2);
    }

    #[test]
    fn test_update_group() {
        let db = test_db();
        let g = db
            .create_group(&serde_json::json!({"name": "Old"}))
            .unwrap();
        let updated = db
            .update_group(
                &g.id,
                &serde_json::json!({
                    "name": "New",
                    "projectIds": ["p1"]
                }),
            )
            .unwrap()
            .unwrap();
        assert_eq!(updated.name, "New");
        assert_eq!(updated.project_ids, vec!["p1"]);
    }

    #[test]
    fn test_delete_group() {
        let db = test_db();
        let g = db
            .create_group(&serde_json::json!({"name": "Del"}))
            .unwrap();
        assert!(db.delete_group(&g.id).unwrap());
        assert!(db.get_group(&g.id).unwrap().is_none());
    }

    #[test]
    fn test_delete_group_nonexistent() {
        let db = test_db();
        assert!(!db.delete_group("no-id").unwrap());
    }

    // ---- Task CRUD (8 tests) ----

    #[test]
    fn test_create_task() {
        let db = test_db();
        let t = db
            .create_task(&serde_json::json!({"title": "Mix drums"}))
            .unwrap();
        assert_eq!(t.title, "Mix drums");
        assert_eq!(t.status, "todo");
        assert!(!t.id.is_empty());
    }

    #[test]
    fn test_create_task_with_fields() {
        let db = test_db();
        let t = db
            .create_task(&serde_json::json!({
                "title": "Master track",
                "description": "Final mastering",
                "status": "in-progress",
                "dueDate": "2025-12-31"
            }))
            .unwrap();
        assert_eq!(t.description.as_deref(), Some("Final mastering"));
        assert_eq!(t.status, "in-progress");
        assert_eq!(t.due_date.as_deref(), Some("2025-12-31"));
    }

    #[test]
    fn test_get_task_by_id() {
        let db = test_db();
        let t = db.create_task(&serde_json::json!({"title": "T"})).unwrap();
        let fetched = db.get_task(&t.id).unwrap().unwrap();
        assert_eq!(fetched.title, "T");
    }

    #[test]
    fn test_get_tasks_all() {
        let db = test_db();
        db.create_task(&serde_json::json!({"title": "A"})).unwrap();
        db.create_task(&serde_json::json!({"title": "B"})).unwrap();
        assert_eq!(db.get_tasks().unwrap().len(), 2);
    }

    #[test]
    fn test_get_tasks_by_project() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "Proj"}))
            .unwrap();
        db.create_task(&serde_json::json!({"title": "T1", "projectId": p.id}))
            .unwrap();
        db.create_task(&serde_json::json!({"title": "T2", "projectId": p.id}))
            .unwrap();
        db.create_task(&serde_json::json!({"title": "T3"})).unwrap();
        assert_eq!(db.get_tasks_by_project(&p.id).unwrap().len(), 2);
    }

    #[test]
    fn test_update_task() {
        let db = test_db();
        let t = db
            .create_task(&serde_json::json!({"title": "Old"}))
            .unwrap();
        let updated = db
            .update_task(
                &t.id,
                &serde_json::json!({
                    "title": "New",
                    "status": "done"
                }),
            )
            .unwrap()
            .unwrap();
        assert_eq!(updated.title, "New");
        assert_eq!(updated.status, "done");
    }

    #[test]
    fn test_delete_task() {
        let db = test_db();
        let t = db
            .create_task(&serde_json::json!({"title": "Del"}))
            .unwrap();
        assert!(db.delete_task(&t.id).unwrap());
        assert!(db.get_task(&t.id).unwrap().is_none());
    }

    #[test]
    fn test_reorder_tasks() {
        let db = test_db();
        let t1 = db
            .create_task(&serde_json::json!({"title": "A", "status": "todo"}))
            .unwrap();
        let t2 = db
            .create_task(&serde_json::json!({"title": "B", "status": "todo"}))
            .unwrap();
        let reorder = vec![
            serde_json::json!({"id": t1.id, "order": 2, "status": "done"}),
            serde_json::json!({"id": t2.id, "order": 1, "status": "todo"}),
        ];
        assert!(db.reorder_tasks(&reorder).unwrap());
        let t1_after = db.get_task(&t1.id).unwrap().unwrap();
        assert_eq!(t1_after.order, 2);
        assert_eq!(t1_after.status, "done");
    }

    // ---- Tag CRUD (4 tests) ----

    #[test]
    fn test_create_tag() {
        let db = test_db();
        let tag = db
            .create_tag(&serde_json::json!({"name": "trap", "color": "#ff0000"}))
            .unwrap();
        assert_eq!(tag.name, "trap");
        assert_eq!(tag.color, "#ff0000");
    }

    #[test]
    fn test_create_tag_default_color() {
        let db = test_db();
        let tag = db
            .create_tag(&serde_json::json!({"name": "chill"}))
            .unwrap();
        assert_eq!(tag.color, "#6366f1");
    }

    #[test]
    fn test_get_tags() {
        let db = test_db();
        db.create_tag(&serde_json::json!({"name": "a"})).unwrap();
        db.create_tag(&serde_json::json!({"name": "b"})).unwrap();
        let tags = db.get_tags().unwrap();
        assert_eq!(tags.len(), 2);
        // Ordered by name ASC
        assert_eq!(tags[0].name, "a");
        assert_eq!(tags[1].name, "b");
    }

    #[test]
    fn test_delete_tag() {
        let db = test_db();
        let tag = db.create_tag(&serde_json::json!({"name": "del"})).unwrap();
        assert!(db.delete_tag(&tag.id).unwrap());
        assert!(db.get_tags().unwrap().is_empty());
    }

    // ---- Audio Version CRUD (6 tests) ----

    #[test]
    fn test_create_version() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "Proj"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id,
                "name": "Mix v1",
                "filePath": "/audio/mix1.wav"
            }))
            .unwrap();
        assert_eq!(v.name, "Mix v1");
        assert_eq!(v.version_number, 1);
        assert_eq!(v.project_id, p.id);
    }

    #[test]
    fn test_create_version_auto_increments() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "Proj"}))
            .unwrap();
        let v1 = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        let v2 = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V2", "filePath": "/b.wav"
            }))
            .unwrap();
        assert_eq!(v1.version_number, 1);
        assert_eq!(v2.version_number, 2);
    }

    #[test]
    fn test_get_versions_by_project() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        db.create_version(
            &serde_json::json!({"projectId": p.id, "name": "V1", "filePath": "/a.wav"}),
        )
        .unwrap();
        db.create_version(
            &serde_json::json!({"projectId": p.id, "name": "V2", "filePath": "/b.wav"}),
        )
        .unwrap();
        let versions = db.get_versions_by_project(&p.id).unwrap();
        assert_eq!(versions.len(), 2);
        // Ordered by version_number DESC
        assert_eq!(versions[0].name, "V2");
    }

    #[test]
    fn test_update_version() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        let updated = db
            .update_version(
                &v.id,
                &serde_json::json!({
                    "name": "Final Mix",
                    "notes": "Sounds great"
                }),
            )
            .unwrap()
            .unwrap();
        assert_eq!(updated.name, "Final Mix");
        assert_eq!(updated.notes.as_deref(), Some("Sounds great"));
    }

    #[test]
    fn test_delete_version() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        assert!(db.delete_version(&v.id).unwrap());
        assert!(db.get_version(&v.id).unwrap().is_none());
    }

    #[test]
    fn test_get_version_by_id() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        let fetched = db.get_version(&v.id).unwrap().unwrap();
        assert_eq!(fetched.name, "V1");
    }

    // ---- Annotation CRUD (6 tests) ----

    #[test]
    fn test_create_annotation() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        let a = db
            .create_annotation(&serde_json::json!({
                "versionId": v.id,
                "timestamp": 12.5,
                "text": "Needs more bass",
                "color": "#ff0000"
            }))
            .unwrap();
        assert_eq!(a.text, "Needs more bass");
        assert!((a.timestamp - 12.5).abs() < 0.01);
        assert_eq!(a.color, "#ff0000");
        assert_eq!(a.version_id, v.id);
    }

    #[test]
    fn test_create_annotation_default_color() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        let a = db
            .create_annotation(&serde_json::json!({
                "versionId": v.id, "timestamp": 0.0, "text": "Note"
            }))
            .unwrap();
        assert_eq!(a.color, "#6366f1");
    }

    #[test]
    fn test_get_annotations_by_version() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        db.create_annotation(
            &serde_json::json!({"versionId": v.id, "timestamp": 5.0, "text": "A"}),
        )
        .unwrap();
        db.create_annotation(
            &serde_json::json!({"versionId": v.id, "timestamp": 1.0, "text": "B"}),
        )
        .unwrap();
        let anns = db.get_annotations_by_version(&v.id).unwrap();
        assert_eq!(anns.len(), 2);
        // Ordered by timestamp ASC
        assert_eq!(anns[0].text, "B");
        assert_eq!(anns[1].text, "A");
    }

    #[test]
    fn test_update_annotation() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        let a = db
            .create_annotation(&serde_json::json!({
                "versionId": v.id, "timestamp": 1.0, "text": "Old"
            }))
            .unwrap();
        let updated = db
            .update_annotation(
                &a.id,
                &serde_json::json!({
                    "text": "New text",
                    "timestamp": 3.0,
                    "color": "#00ff00"
                }),
            )
            .unwrap()
            .unwrap();
        assert_eq!(updated.text, "New text");
        assert!((updated.timestamp - 3.0).abs() < 0.01);
        assert_eq!(updated.color, "#00ff00");
    }

    #[test]
    fn test_delete_annotation() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        let a = db
            .create_annotation(&serde_json::json!({
                "versionId": v.id, "timestamp": 1.0, "text": "Del"
            }))
            .unwrap();
        assert!(db.delete_annotation(&a.id).unwrap());
        assert!(db.get_annotation(&a.id).unwrap().is_none());
    }

    #[test]
    fn test_get_annotation_by_id() {
        let db = test_db();
        let p = db
            .create_project(&serde_json::json!({"title": "P"}))
            .unwrap();
        let v = db
            .create_version(&serde_json::json!({
                "projectId": p.id, "name": "V1", "filePath": "/a.wav"
            }))
            .unwrap();
        let a = db
            .create_annotation(&serde_json::json!({
                "versionId": v.id, "timestamp": 2.0, "text": "Note"
            }))
            .unwrap();
        let fetched = db.get_annotation(&a.id).unwrap().unwrap();
        assert_eq!(fetched.text, "Note");
    }
}
