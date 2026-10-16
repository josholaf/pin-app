# Pin

Lightweight sticky-note style task & note app built with **Tauri + React**.

Small floating windows that stay on top (or on the desktop layer) so you can keep what you're working on always visible.

## Features

- **Sticky-note windows** — frameless, transparent, always-on-top or desktop layer
- **Folders** — organize notes under folders
- **50+ Lucide icons** — assign icons to notes and folders
- **Per-note colors**
- **Pomodoro timer** (25 min focus / 5 min break) with sound + auto-switch
- **Daily writing streak** — fire icon in the title bar that grows when you create or write notes
- **Settings** — font size, font style, accent color, always-on-top vs stay on desktop
- **Dark mode**
- Local-only storage (no cloud)

## Usage

### Main window
- **+** → new sticky note
- **Folder+** → create a folder
- Click folder / note icons to change them
- Click a note name to open it as a floating window
- Gear icon → Settings (font, accent, window behavior)
- Fire badge (top right) → your current daily writing streak

### Note windows
- Title + body, color picker, icon sidebar
- Auto-saves as you type

## Develop

```bash
npm install
npm run tauri dev
```

## Build / Release

Multi-platform builds (Windows, macOS, Linux) are handled by GitHub Actions.

To create a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Or run the **Release** workflow manually from the Actions tab.

---

Made for focus.
