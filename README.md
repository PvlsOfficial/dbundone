# DBundone - Music Project Manager

A lightweight, offline-first desktop application for managing music production projects. Built with Electron, React, and SQLite.

![DBundone Screenshot](assets/screenshot.png)

## Features

### 📁 Project Management
- **Project Grid**: Visual grid layout with rounded cards displaying project artwork
- **Rich Metadata**: Store BPM, musical key, tags, and collection names
- **DAW Integration**: Quick-launch projects directly in your DAW
- **Audio Previews**: Built-in audio player with waveform visualization

### 🎵 Audio Player
- Play/pause, stop, previous/next controls
- Visual waveform display using WaveSurfer.js
- Volume control with dB level indicator
- Progress bar with seek functionality

### 📂 Project Groups
- Organize projects into custom groups
- Custom group artwork and descriptions
- Easy project selection interface

### ✅ Task Scheduler
- Kanban-style board with three columns: To Do, In Progress, Done
- Drag-and-drop task management
- Due date tracking with overdue indicators
- Task descriptions and notes

### 🔍 Search & Filter
- Full-text search across project titles, collections, and tags
- Sort by name, date, BPM, or musical key
- Tag-based filtering

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/dbundone.git
cd dbundone
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

5. Package the application:
```bash
# For Windows
npm run package:win

# For macOS
npm run package:mac

# For Linux
npm run package:linux
```

## Usage

### Creating a Project

1. Click the **"New Project"** button in the dashboard
2. Fill in the project details:
   - **Title**: Required project name
   - **Artwork**: Click to select an image file
   - **BPM**: Enter the tempo
   - **Key**: Select the musical key
   - **Tags**: Add searchable tags
   - **Collection**: Group by album/EP name
   - **Audio Preview**: Select an audio file for preview
   - **DAW Project**: Link to your DAW project file

### Playing Audio Previews

- Hover over a project card and click the play button
- Use the audio player bar at the bottom for playback controls
- Click on the waveform to seek to a specific position

### Opening in DAW

- Click the DAW icon on the project card to open the linked project file
- Supported formats: Ableton (.als), FL Studio (.flp), Logic Pro (.logic), Pro Tools (.ptx), Cubase (.cpr), Reaper (.rpp)

### Creating Groups

1. Navigate to the **Groups** section
2. Click **"New Group"**
3. Add a name and optional description
4. Click **"Select Projects"** to add projects to the group

### Managing Tasks

1. Navigate to the **Tasks** section
2. Click **"Add task"** in any column
3. Fill in the task details
4. Drag and drop tasks between columns

## Project Structure

```
dbundone/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # Main entry point
│   │   ├── preload.ts     # Preload script
│   │   └── database.ts    # SQLite database operations
│   ├── renderer/          # React frontend
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── styles/        # Global styles
│   │   ├── App.tsx        # Main App component
│   │   └── main.tsx       # Renderer entry point
│   └── shared/            # Shared types
│       └── types.ts       # TypeScript interfaces
├── assets/                # Static assets
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Database Schema

### Projects Table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| title | TEXT | Project name |
| artwork_path | TEXT | Path to artwork image |
| audio_preview_path | TEXT | Path to audio preview |
| daw_project_path | TEXT | Path to DAW project file |
| daw_type | TEXT | DAW type (e.g., "Ableton Live") |
| bpm | INTEGER | Beats per minute |
| musical_key | TEXT | Musical key |
| tags | TEXT | JSON array of tags |
| collection_name | TEXT | Collection/album name |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

### Groups Table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| name | TEXT | Group name |
| artwork_path | TEXT | Path to group artwork |
| description | TEXT | Group description |
| project_ids | TEXT | JSON array of project IDs |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

### Tasks Table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (UUID) |
| title | TEXT | Task title |
| description | TEXT | Task description |
| status | TEXT | Status (todo/in-progress/done) |
| due_date | TEXT | Due date |
| task_order | INTEGER | Order within column |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

## Configuration

Data is stored in the user's application data folder:
- **Windows**: `%APPDATA%/dbundone/`
- **macOS**: `~/Library/Application Support/dbundone/`
- **Linux**: `~/.config/dbundone/`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause audio |
| `Escape` | Close modal |

## Extending the Application

### Adding New Features

The application is designed to be extensible. Key extension points:

1. **Database**: Add new tables in `src/main/database.ts`
2. **IPC Channels**: Define new channels in `src/shared/types.ts`
3. **Components**: Create new components in `src/renderer/components/`
4. **Pages**: Add new pages in `src/renderer/pages/`

### Future Considerations

- Cloud sync integration
- Plugin system for DAW-specific features
- Export/import functionality
- Batch operations
- Advanced audio analysis

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **SQLite (better-sqlite3)**: Embedded database
- **Vite**: Build tool
- **WaveSurfer.js**: Audio waveform visualization

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and feature requests, please use the GitHub Issues page.
