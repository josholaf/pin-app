# Pin

Lightweight always-on-top task pin app for Windows, built with **Tauri**.

Organize notes in folders, assign Lucide icons to notes and folders, use a Pomodoro timer, and keep tasks pinned on screen.

## Features

- Always-on-top floating window
- **Folders** — create folders and put notes inside them
- **Icons for notes & folders** — 50+ Lucide icons, change anytime
- **Multiple independent note windows**
- **Color options per note**
- **Pomodoro timer** (25 / 5) with sound + auto-switch
- Task list with edit / complete / clear
- Dark mode (persisted)
- Local storage via Tauri Store

## Usage

### Main window
- **Folder+** icon → create a folder
- **+** → new unfiled note
- On a folder row: **+** → new note in that folder
- Click a folder icon → pick a folder icon
- Click a note icon → pick a note icon
- Click a note name → open it as a floating window

### Note windows
- Title, body, color, and icon (sidebar toggle)
- Auto-save

```bash
npm install
npm run tauri dev
```

---

Made for focus.
