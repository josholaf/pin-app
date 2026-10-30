# Pin

Lightweight sticky-note style task & note app built with **Tauri + React**.

Small floating windows that stay on top (or on the desktop layer) so you can keep what you're working on always visible.

## Features

- **Sticky-note windows** — frameless, always-on-top or desktop layer
- **Folders** — organize notes under folders
- **Lucide icons** — assign icons to notes and folders
- **Per-note colors** — pick from the right-click menu or the note title bar
- **Markdown notes** — headings, lists, interactive task checkboxes, tables, quotes, images, links, `==highlight==` and colored text
- **macOS-style code blocks** — every fenced code block renders as a little Mac window: red / yellow / green traffic lights and the language name on the right side
- **Code language detection** — fence tags accept any language (````html`, ````rust`, ````c++` ...), and untagged blocks get their language auto-detected from the code itself
- **Syntax highlighting** — keywords, strings, numbers, comments and functions colored in light and dark themes
- **Coding fonts** — Fira Code, Source Code Pro, Hack and JetBrains Mono bundled for offline use, plus system, serif, rounded and casual fonts
- **Smart font dropdown** — each font previews in its own typeface with an "Aa 123" sample, live search, keyboard navigation
- **Wiki-links** — type `[[` to autocomplete note titles, click a link in the preview to open (or create) the target note, with a "Linked mentions" backlinks section
- **Graph view** — an SVG map of notes (nodes) and wiki-links (edges); click a node to open its note, search filters nodes by title or content
- **Quick capture** — global Ctrl+Shift+P hotkey from anywhere in the OS opens a small capture box; type, hit Enter, the note saves instantly (first line becomes the title)
- **Focus mode** — distraction-free overlay on the open note: just the title and your words, typewriter scrolling keeps the caret centered, quiet word count at the bottom, Esc exits
- **Reminders** — right-click a note → Reminder, pick a date and time; get a beep + in-app toast when due, with a clock badge on the note (red when due)
- **Library export / import** — command palette: export all notes as a ZIP of Markdown files, import .md files or .zip archives back into Pin
- **Clean note list** — rows are just icon + title; every action lives in the right-click menu: Edit, Rename, Pin to desktop, Favorite, Reminder, Change color, Change icon, Delete
- **Tags** — Obsidian-style colored tags added with the `/tags` picker, searchable across notes
- **Photos & audio** — upload photos (soft 12px radius), lay them out in 1–4 column grids, record audio straight into a note
- **Editor extras** — line numbers, slash command menu (`/`), live markdown preview, `Ctrl+S` save flash and `Ctrl+Z` undo, themed cursor and selection that follow your accent color
- **Trash** — deleted notes, folders and tasks land in trash first, restore or purge from there
- **Command palette** — `Ctrl+K` for everything, `Ctrl+Shift+P` quick capture from anywhere
- **Pomodoro timer** (25 min focus / 5 min break) with sound + auto-switch, and a daily focus-session counter
- **Daily writing streak** — fire icon in the title bar that grows when you create or write notes
- **Settings** — font size, font style, accent color, always-on-top vs stay on desktop
- **Dark mode** — instant flip, themed controls
- Local-only storage (no cloud)

## Usage

### Main window
- **+** → new sticky note
- **⚡ (Zap)** → quick capture box (same as global Ctrl+Shift+P)
- **Folder+** → create a folder
- **Click a note** → open it in the editor
- **Right-click a note** → full menu: Edit, Rename, Pin to desktop, Favorite, Reminder, Change color, Change icon, Delete
- **Right-click a folder** → Rename, New note, Delete
- **Search box** → live search across titles, content and tags
- **Ctrl+K** → command palette (graph view, quick capture, export library, import notes, everything else)
- Gear icon → Settings (fonts, accent, window behavior)
- Fire badge (top right) → your current daily writing streak
<img width="284" height="410" alt="Screenshot 2026-10-25 202521" src="https://github.com/user-attachments/assets/cb08b959-9c86-43df-9077-af5501631579" />
<img width="249" height="343" alt="Screenshot 2026-10-25 202627" src="https://github.com/user-attachments/assets/3a3d05dc-9367-4ff3-81c6-ca6634a872aa" />
<img width="269" height="393" alt="Screenshot 2026-10-25 203017" src="https://github.com/user-attachments/assets/5a829a9a-6a42-46de-b127-432997dabcc2" />




### Note editor
- Markdown with live preview, toolbar shortcuts, line numbers and slash commands
- Expand button (or focus mode) → distraction-free writing with typewriter scrolling; Esc exits
- Type ````html` (or any language) to get a macOS-style code window with syntax coloring
- Type `[[` to link another note; the "Linked mentions" section under the preview lists notes linking here
- `/tags` → tag picker; `==text==` → highlight; upload photos and record audio from the toolbar
- Auto-saves as you type, `Ctrl+S` for an instant save, `Ctrl+Z` to undo


---

Made for focus.
