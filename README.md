# Pin

Lightweight always-on-top task pin app for Windows, built with **Tauri**.

Write tasks, pin the window so it stays visible while you work, and stay focused. You can also open multiple independent sticky notes with custom colors and use a built-in Pomodoro timer.

## Features

- Always-on-top floating window
- **Pomodoro timer** (25 min Focus / 5 min Break) with green progress bar
- **Multiple independent notes** (click **+** to open new sticky notes)
- **Color options per note** (Yellow, Pink, Blue, Green, Purple, Orange)
- Add / edit / complete / delete tasks
- Dark mode toggle (persisted)
- Local storage with Tauri Store plugin
- Frameless, draggable sticky-note style UI
- Clear completed tasks
- Each note has its own title, content, color, pin and theme controls

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
- Use the **Pomodoro bar** (Focus 25 / Break 5) with Start, Pause and Reset
- Green progress bar shows elapsed time
- Click the moon/sun to toggle dark mode
- Click the pin icon to toggle always-on-top

### Note windows
- Edit the title at the top
- Write freely in the body
- Click the colored circle to change the note color
- Notes auto-save
- Each note can be pinned / themed / colored independently

---

Made for focus.
