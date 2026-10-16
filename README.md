# Pin

Lightweight always-on-top task pin app for Windows, built with **Tauri**.

Write tasks, pin the window so it stays visible while you work, and stay focused.

## Features

- Always-on-top floating window
- Add / edit / complete / delete tasks
- Dark mode toggle (persisted)
- Local storage with Tauri Store plugin
- Frameless, draggable sticky-note style UI
- Clear completed tasks

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

- Type a task and press Enter
- Double-click a task to edit
- Click the moon/sun to toggle dark mode
- Click the pin icon to toggle always-on-top
- Tasks are saved automatically

---

Made for focus.
