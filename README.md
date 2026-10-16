# Pin

Lightweight always-on-top task pin app for Windows, built with **Tauri**.

Write tasks, pin the window so it stays visible while you work, and stay focused. Open multiple sticky notes with custom colors and icons, plus a built-in Pomodoro timer.

## Features

- Always-on-top floating window
- **Pomodoro timer** (25 min Focus / 5 min Break)
  - Green progress bar
  - Sound notification when a session ends
  - Auto-switch between Focus and Break
- **Multiple independent notes** (click **+** to open new sticky notes)
- **Color options per note** (Yellow, Pink, Blue, Green, Purple, Orange)
- **50+ Lucide icons per note** — toggle the sidebar to pick an icon
- Add / edit / complete / delete tasks
- Dark mode toggle (persisted)
- Local storage with Tauri Store plugin
- Frameless, draggable sticky-note style UI
- Modern Lucide icons throughout (no emojis)

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Lucide React
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
- Use the Pomodoro bar (Focus 25 / Break 5)
- Toggle dark mode and always-on-top from the title bar

### Note windows
- Edit the title and body
- Click the colored circle to change color
- Click the **panel** icon to open the icon sidebar and choose from 50+ Lucide icons
- Notes auto-save (title, content, color, icon)

---

Made for focus.
