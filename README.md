<div align="center">

# 📌 Pin

**A tiny, always-on-top sticky note & focus app for your desktop.**

Write tasks, pin notes, stay focused — without leaving your workflow.

[![Release](https://img.shields.io/github/v/release/josholaf/pin-app?style=flat-square&label=release)](https://github.com/josholaf/pin-app/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/josholaf/pin-app/release.yml?style=flat-square&label=CI)](https://github.com/josholaf/pin-app/actions/workflows/release.yml)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-4caf50?style=flat-square)](https://github.com/josholaf/pin-app/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202%20%2B%20React-ff8800?style=flat-square)](https://tauri.app)

<img width="284" height="410" alt="Pin — main window" src="https://github.com/user-attachments/assets/cb08b959-9c86-43df-9077-af5501631579" />
<img width="249" height="343" alt="Pin — note editor" src="https://github.com/user-attachments/assets/3a3d05dc-9367-4ff3-81c6-ca6634a872aa" />
<img width="269" height="393" alt="Pin — dark mode" src="https://github.com/user-attachments/assets/6a5b829a-6a42-46de-b127-432997dabcc2" />

</div>

---

## ✨ Features

### Notes
- **Sticky notes in a single window** — click a note and it opens inline, no extra tabs or windows to manage
- **Folders** — group notes, expand/collapse, per-folder note counts
- **Markdown editor** — live preview, formatting toolbar (bold, italic, strikethrough, headings, code, lists, tasks, quotes, links), tables, images, macOS-style code blocks with language labels
- **Per-note format** — switch any note between Markdown (`MD`) and plain text (`TXT`)
- **Colors & icons** — pick a note color from the circle in the title bar, and a Lucide icon from the sidebar
- **Status bar** — live `Ln x, Col y` caret position and word count at the bottom of every note
- **Auto-save** — notes save as you type, debounce included

### Capture & find
- **Live search** — search across titles *and* note content, with match count
- **Global quick capture** — press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> (macOS: <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) from *any* app: Pin jumps to the front with a fresh note ready

### Focus
- **Pomodoro timer** — 25 min focus / 5 min break cycle with a progress bar, sound cue and auto-switch
- **Daily streak** — a flame badge counts consecutive days you've written
- **Task list** — quick one-line tasks; check them off and they're gone

### App
- **Dark mode** — instant theme flip, applied everywhere
- **Right-click menus** — clean note rows (icon + title); **Edit**, **Delete** (and **New note** on folders) live in the context menu
- **Settings window** — font family & size, accent color, always-on-top vs stay-on-desktop
- **Storage management** — see where your data lives, counts of notes/tasks/folders, **export** / **import** your entire library as a JSON backup, or clear all data
- **Local-only storage** — no cloud, no account, no telemetry; your notes never leave your machine

## ⌨️ Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> | Quick capture from anywhere in the OS |
| <kbd>Ctrl/Cmd</kbd>+<kbd>B</kbd> | Bold (in note editor) |
| <kbd>Ctrl/Cmd</kbd>+<kbd>I</kbd> | Italic (in note editor) |
| <kbd>Esc</kbd> | Exit edit mode → preview |
| <kbd>Enter</kbd> | Add task / confirm rename |

## 📥 Install

Grab the latest build from the [**Releases**](https://github.com/josholaf/pin-app/releases) page:

| Platform | Download |
| --- | --- |
| Windows | `.msi` or `.exe` (NSIS) |
| macOS | `.dmg` |
| Linux | `.deb` or `.AppImage` |

## 🛠️ Build from source

**Prerequisites:** [Node.js](https://nodejs.org) 20+, [Rust](https://rustup.rs) (stable), and platform build tools ([Linux requirements](https://tauri.app/start/prerequisites/)).

```bash
git clone https://github.com/josholaf/pin-app.git
cd pin-app

npm install

# run in dev mode
npm run tauri dev

# produce installers in src-tauri/target/release/bundle/
npm run tauri build
```

> Tip: after pulling changes that add dependencies, re-run `npm install` and `cargo build` will fetch any new Rust crates automatically.

## 🧱 Tech stack & structure

Built with [Tauri 2](https://tauri.app), React 18, TypeScript and [Lucide icons](https://lucide.dev). Data is persisted locally via `tauri-plugin-store`.

```
├── src/                    # React frontend
│   ├── App.tsx             # Main window: notes, folders, search, pomodoro
│   ├── MarkdownNote.tsx    # Inline note editor (markdown, colors, status bar)
│   ├── SettingsWindow.tsx  # Settings + storage management
│   ├── appData.tsx         # Types, theme, icons, markdown renderer
│   └── App.css             # Theming (CSS variables, light/dark)
├── src-tauri/              # Rust backend (Tauri config, capabilities)
│   └── capabilities/       # Permission allow-list (window, store, fs, dialog, shortcuts)
└── .github/workflows/      # CI: type-check + build installers for all platforms
```

## 🗺️ Roadmap

- [ ] Trash / undo delete
- [ ] Tags
- [ ] Wiki-links between notes (`[[like this]]`) and a graph view
- [ ] Web clipper (save articles as markdown notes)
- [ ] System tray icon
- [ ] Reminders on notes
- [ ] Distraction-free focus mode
- [ ] Photos & audio in notes

## 🤝 Contributing

Contributions are welcome! The CI runs a TypeScript type-check (`tsc --noEmit`) and builds all three platforms on every push — please keep the type-check green.

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make your change, keep it small and focused
3. Test locally with `npm run tauri dev`
4. Open a Pull Request describing **what** changed and **why**

Good first issues: anything in the [Roadmap](#-roadmap), UI polish, dark-mode contrast fixes, or improving the markdown renderer in `appData.tsx`.

## 📄 License

Released under the [MIT License](LICENSE) — © 2026 josholaf.

---

<div align="center">

**Made for focus.** ⭐ Star the repo if Pin helps you ship.

</div>
