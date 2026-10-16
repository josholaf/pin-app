# Pin

Lightweight always-on-top task pin app for Windows, built with **Tauri**.

Write tasks, pin the window so it stays visible while you work, and stay focused. You can also open multiple independent sticky notes.

## Features

- Always-on-top floating window
- **Multiple independent notes** (click **+** to open new sticky notes)
- Add / edit / complete / delete tasks
- Dark mode toggle (persisted)
- Local storage with Tauri Store plugin
- Frameless, draggable sticky-note style UI
- Clear completed tasks
- Each note has its own title, content, pin and theme controls

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri 2 + Rust
- **Storage**: `@tauri-apps/plugin-store`

## Getting Started

### Prerequisites

- Node.js (LTS)
- Rust
- Windows build tools (Visual Studio C++ workload) + WebView2

### Install & Run

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Usage

### Main window
- Type a task and press Enter
- Double-click a task to edit
- Click **+** to open a new independent sticky note
- Click the moon/sun to toggle dark mode
- Click the pin icon to toggle always-on-top

### Note windows
- Edit the title at the top
- Write freely in the body
- Notes auto-save
- Each note can be pinned / themed independently

---

Made for focus.
