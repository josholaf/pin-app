import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Store } from "@tauri-apps/plugin-store";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import {
  Pin, Moon, Sun, Plus, X, Play, Pause, RotateCcw, Search,
  ChevronDown, ChevronRight, FolderPlus, Flame, Folder, FolderOpen,
  Coffee, Settings, Pencil, Trash2, Undo2, Command,
} from "lucide-react";
import {
  DEFAULT_SETTINGS, NOTE_COLORS, tagColor,
  FOCUS_SECONDS, BREAK_SECONDS, playBeep, getIcon, ICON_BANK,
  type Task, type Theme, type NoteColor, type PomodoroMode, type AppSettings,
  type NoteFolder, type Note,
} from "./appData";
import { MarkdownNote } from "./MarkdownNote";
import { SettingsWindow } from "./SettingsWindow";

const noteKey = (id: string) => "note:" + id;

async function loadNotes(s: Store): Promise<Note[]> {
  const ids = (await s.get<string[]>("noteIds")) || [];
  const out: Note[] = [];
  for (const id of ids) {
    const n = await s.get<Note>(noteKey(id));
    if (n) out.push(n);
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

/** A note floated on the desktop as its own tiny always-on-top window (issue #3). */
function PinnedNote({ noteId }: { noteId: string }) {
  const [note, setNote] = useState<Note | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const storeRef = useRef<Store | null>(null);

  useEffect(() => {
    (async () => {
      const s = await Store.load("pin-data.json");
      storeRef.current = s;
      const n = await s.get<Note>(noteKey(noteId));
      if (n) setNote(n);
      const th = await s.get<Theme>("theme");
      if (th) setTheme(th);
    })();
  }, [noteId]);

  // Debounced save: keep every other field of the stored note intact.
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(async () => {
      const s = storeRef.current;
      if (!s) return;
      const existing = await s.get<Note>(noteKey(noteId));
      const updated: Note = { ...((existing || { id: noteId, createdAt: Date.now() }) as Note), ...note };
      await s.set(noteKey(noteId), updated);
      await s.save();
    }, 400);
    return () => clearTimeout(t);
  }, [note, noteId]);

  const currentColor = note ? (NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0]) : NOTE_COLORS[0];
  const bgColor = theme === "dark" ? currentColor.dark : currentColor.light;

  return (
    <div className="pinned-window" data-tauri-drag-region style={{ background: bgColor, color: theme === "dark" ? "#eee" : "#222" }}>
      <div className="pinned-header" data-tauri-drag-region>
        <span className="pinned-title">{(note && note.title) || "Untitled"}</span>
        <button
          className="icon-btn"
          title="Unpin"
          onClick={async () => {
            const win = getCurrentWindow();
            try { await win.close(); } catch { try { await win.destroy(); } catch { /* ignore */ } }
          }}
        ><X size={12} /></button>
      </div>
      {note ? (
        <textarea
          className="pinned-content"
          value={note.content}
          onChange={(e) => setNote({ ...note, content: e.target.value })}
          placeholder="Pinned note..."
          spellCheck={false}
        />
      ) : (
        <div className="pinned-content" />
      )}
    </div>
  );
}

function App() {
  const [windowLabel, setWindowLabel] = useState("main");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [store, setStore] = useState<Store | null>(null);
  const [ready, setReady] = useState(false);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ type: "folder" | "note"; id: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  // Inline note editor (single window — no separate note windows/tabs anymore)
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState<NoteColor>("yellow");
  const [noteIcon, setNoteIcon] = useState("sticky-note");
  const [noteFolderId, setNoteFolderId] = useState<string | null>(null);
  const [noteFormat, setNoteFormat] = useState<"md" | "txt">("md");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [streak, setStreak] = useState(0);
  const [lastActiveDate, setLastActiveDate] = useState<string | null>(null);
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const justFinishedRef = useRef(false);
  // v0.1.5: tags filter, trash, command palette
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const totalSeconds = pomodoroMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  useEffect(() => {
    (async () => {
      const win = getCurrentWindow();
      setWindowLabel(win.label);
    })();
  }, []);

  // Init store + migrate legacy whole-array notes to per-note keys.
  // Everything is read BEFORE any effect is allowed to write back
  // (see "ready"), so a fresh window can never clobber the saved
  // theme/settings with defaults.
  useEffect(() => {
    (async () => {
      const s = await Store.load("pin-data.json");
      setStore(s);

      const legacy = await s.get<Note[]>("notes");
      const existingIds = await s.get<string[]>("noteIds");
      if (legacy && legacy.length && !existingIds) {
        for (const n of legacy) await s.set(noteKey(n.id), n);
        await s.set("noteIds", legacy.map((n) => n.id));
        await s.delete("notes");
        await s.save();
      }

      const t = await s.get<Task[]>("tasks"); if (t) setTasks(t);
      const f = await s.get<NoteFolder[]>("folders"); if (f) setFolders(f);
      const th = await s.get<Theme>("theme");
      if (th) {
        setTheme(th);
        document.documentElement.setAttribute("data-theme", th);
      }
      const st = await s.get<AppSettings>("settings"); if (st) setSettings({ ...DEFAULT_SETTINGS, ...st });
      const sk = await s.get<number>("streak"); if (typeof sk === "number") setStreak(sk);
      const la = await s.get<string>("lastActiveDate"); if (la) setLastActiveDate(la);
      setNotes(await loadNotes(s));
      setReady(true);
    })();
  }, []);

  // Apply theme attribute immediately (never blocked), but only persist
  // after the initial load finished.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (ready && store) { store.set("theme", theme); store.save(); }
  }, [theme, store, ready]);

  // Main window: persist tasks + folders
  useEffect(() => {
    if (ready && store && windowLabel === "main") {
      store.set("tasks", tasks);
      store.set("folders", folders);
      store.save();
    }
  }, [tasks, folders, store, ready, windowLabel]);

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-size", settings.fontSize + "px");
    document.documentElement.style.setProperty("--app-font-family", settings.fontFamily);
    document.documentElement.style.setProperty("--accent", settings.accentColor);
  }, [settings]);

  useEffect(() => {
    if (ready && store) { store.set("settings", settings); store.save(); }
  }, [settings, store, ready]);

  // Poll for settings/theme changes made in the Settings window
  useEffect(() => {
    if (!store || !ready) return;
    const id = setInterval(async () => {
      const st = await store.get<AppSettings>("settings");
      if (st) setSettings((prev) => (JSON.stringify(prev) === JSON.stringify({ ...DEFAULT_SETTINGS, ...st }) ? prev : { ...DEFAULT_SETTINGS, ...st }));
      const th = await store.get<Theme>("theme");
      if (th && th !== theme) setTheme(th);
    }, 500);
    return () => clearInterval(id);
  }, [store, ready, theme]);

  useEffect(() => {
    if (ready && store && windowLabel === "main") {
      store.set("streak", streak); store.set("lastActiveDate", lastActiveDate); store.save();
    }
  }, [streak, lastActiveDate, store, ready, windowLabel]);

  const recordActivity = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastActiveDate === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (lastActiveDate === y.toISOString().slice(0, 10)) setStreak((s) => s + 1);
    else setStreak(1);
    setLastActiveDate(today);
  };

  // Inline note editor: automatic debounced save of the open note,
  // plus a local list update so the icon/title show immediately in the UI.
  // The stored note is spread first so tags/trash state survive saves.
  useEffect(() => {
    if (!store || !openNoteId) return;
    const t = setTimeout(async () => {
      const existing = await store.get<Note>(noteKey(openNoteId));
      const updated: Note = {
        ...((existing || { id: openNoteId, createdAt: Date.now() }) as Note),
        id: openNoteId,
        title: noteTitle || "Untitled",
        content: noteContent,
        color: noteColor,
        icon: noteIcon,
        folderId: noteFolderId,
        format: noteFormat,
      };
      await store.set(noteKey(openNoteId), updated);
      const ids = (await store.get<string[]>("noteIds")) || [];
      if (!ids.includes(openNoteId)) { ids.unshift(openNoteId); await store.set("noteIds", ids); }
      await store.save();
      setNotes((prev) => prev.map((n) => (n.id === openNoteId ? updated : n)));
      if (noteContent.trim() || noteTitle.trim()) recordActivity();
    }, 400);
    return () => clearTimeout(t);
  }, [noteTitle, noteContent, noteColor, noteIcon, noteFolderId, noteFormat, openNoteId, store]);

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      timerRef.current = window.setInterval(() => setSecondsLeft((p) => p - 1), 1000);
    }
    if (secondsLeft === 0 && !justFinishedRef.current) {
      justFinishedRef.current = true;
      setIsRunning(false);
      playBeep();
      const next: PomodoroMode = pomodoroMode === "focus" ? "break" : "focus";
      setTimeout(() => {
        setPomodoroMode(next);
        setSecondsLeft(next === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
        setIsRunning(true);
        justFinishedRef.current = false;
      }, 800);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning, secondsLeft, pomodoroMode]);

  const formatTime = (secs: number) =>
    Math.floor(secs / 60).toString().padStart(2, "0") + ":" + (secs % 60).toString().padStart(2, "0");
  const toggleTheme = () => setTheme((p) => (p === "light" ? "dark" : "light"));
  const closeWindow = async () => {
    const win = getCurrentWindow();
    try {
      await win.close();
    } catch {
      try { await win.destroy(); } catch { /* ignore */ }
    }
  };

  const openSettingsWindow = async () => {
    const existing = await WebviewWindow.getByLabel("settings");
    if (existing) { await existing.setFocus(); return; }
    new WebviewWindow("settings", {
      title: "Settings", width: 320, height: 420,
      decorations: true, transparent: false, alwaysOnTop: true, center: true, resizable: false,
    });
  };

  const persistNote = async (n: Note) => {
    if (!store) return;
    await store.set(noteKey(n.id), n);
    const ids = (await store.get<string[]>("noteIds")) || [];
    if (!ids.includes(n.id)) { ids.unshift(n.id); await store.set("noteIds", ids); }
    await store.save();
  };
  const removeNotePersist = async (id: string) => {
    if (!store) return;
    const ids = ((await store.get<string[]>("noteIds")) || []).filter((x) => x !== id);
    await store.set("noteIds", ids);
    await store.delete(noteKey(id));
    await store.save();
  };

  // Open a note inside the main window (single window, no separate tab)
  const openNote = (note: Note) => {
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteColor(note.color || "yellow");
    setNoteIcon(note.icon || "sticky-note");
    setNoteFolderId(note.folderId ?? null);
    setNoteFormat(note.format || "md");
    setOpenNoteId(note.id);
    setContextMenu(null);
  };
  const backToList = () => {
    setOpenNoteId(null);
  };

  const createFolder = () => {
    const folder: NoteFolder = { id: crypto.randomUUID(), name: newFolderName.trim() || "New Folder", icon: "folder", createdAt: Date.now() };
    setFolders([...folders, folder]);
    setExpandedFolders(new Set([...expandedFolders, folder.id]));
    setNewFolderName(""); setShowNewFolder(false);
  };
  const deleteFolder = (id: string) => {
    setFolders(folders.filter((f) => f.id !== id));
    const moved = notes.filter((n) => n.folderId === id);
    setNotes(notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)));
    moved.forEach((n) => { persistNote({ ...n, folderId: null }); });
  };
  const renameFolder = (id: string, name: string) => {
    if (!name.trim()) return;
    setFolders(folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f)));
    setRenamingId(null);
  };
  const renameNote = (id: string, title: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) { setRenamingId(null); return; }
    const updated = { ...n, title: title.trim() || "Untitled" };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
    setRenamingId(null);
  };
  const startRename = (id: string, current: string) => {
    setRenamingId(id); setRenameText(current); setContextMenu(null);
  };
  /** Change a note's icon straight from the list context menu (issue #1). */
  const setNoteIconFor = (id: string, iconId: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, icon: iconId };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
    if (openNoteId === id) setNoteIcon(iconId);
    setContextMenu(null);
  };
  const createNoteInFolder = (folderId: string | null) => {
    const id = crypto.randomUUID();
    const note: Note = { id, title: "Untitled", content: "", color: "yellow", icon: "sticky-note", folderId, createdAt: Date.now(), format: "md" };
    setNotes([note, ...notes]);
    if (folderId) setExpandedFolders(new Set([...expandedFolders, folderId]));
    persistNote(note);
    recordActivity();
    openNote(note);
  };
  // v0.1.5: deleting a note moves it to Trash (soft delete) instead of
  // destroying it immediately (issue #4).
  const deleteNoteFromList = (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, deletedAt: Date.now() };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
    if (openNoteId === id) backToList();
  };
  const restoreNote = (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, deletedAt: undefined };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
  };
  const purgeNote = (id: string) => {
    setNotes(notes.filter((x) => x.id !== id));
    removeNotePersist(id);
  };
  const emptyTrash = () => {
    notes.filter((n) => n.deletedAt).forEach((n) => { removeNotePersist(n.id); });
    setNotes(notes.filter((n) => !n.deletedAt));
  };
  // v0.1.5: note tags (issue #5)
  const addTagToNote = (id: string, raw: string) => {
    const tag = raw.trim().replace(/^#/, "").toLowerCase();
    if (!tag) return;
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, tags: Array.from(new Set([...(n.tags || []), tag])) };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
  };
  const removeTagFromNote = (id: string, tag: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, tags: (n.tags || []).filter((t) => t !== tag) };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
  };
  // v0.1.5: float a note on the desktop as its own tiny window (issue #3)
  const pinNoteToDesktop = async (note: Note) => {
    const label = "note-" + note.id;
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) { await existing.setFocus(); return; }
    new WebviewWindow(label, {
      url: "index.html",
      title: note.title || "Pinned note",
      width: 280, height: 220, resizable: true,
      decorations: false, transparent: false, alwaysOnTop: true, skipTaskbar: true,
    });
    setContextMenu(null);
  };
  const toggleFolder = (id: string) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedFolders(next);
  };
  const addTask = () => {
    const text = input.trim();
    if (!text) return;
    setTasks([{ id: crypto.randomUUID(), text, done: false, createdAt: Date.now() }, ...tasks]);
    setInput("");
  };

  /** Local mirror of "Clear all data" from Settings -> Storage. */
  const resetAllData = () => {
    setTasks([]);
    setNotes([]);
    setFolders([]);
    setStreak(0);
    setLastActiveDate(null);
    setOpenNoteId(null);
    setExpandedFolders(new Set());
    setTagFilter(null);
  };

  // Global quick-capture hotkey (Ctrl/Cmd+Shift+P): bring Pin to the
  // front and drop you straight into a fresh note, from anywhere.
  const quickCaptureRef = useRef<() => void>(() => {});
  quickCaptureRef.current = () => createNoteInFolder(null);
  useEffect(() => {
    if (windowLabel !== "main") return;
    (async () => {
      try {
        const already = await isRegistered("CommandOrControl+Shift+P").catch(() => false);
        if (!already) {
          await register("CommandOrControl+Shift+P", async (event) => {
            if (event.state === "Pressed") {
              try {
                const win = getCurrentWindow();
                await win.show();
                await win.setFocus();
              } catch { /* ignore */ }
              quickCaptureRef.current();
            }
          });
        }
      } catch { /* shortcut unavailable (already taken by another app) */ }
    })();
    return () => { unregister("CommandOrControl+Shift+P").catch(() => {}); };
  }, [windowLabel]);

  // v0.1.5: command palette toggle (issue #6)
  useEffect(() => {
    if (windowLabel !== "main" || openNoteId) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        setPaletteQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [windowLabel, openNoteId]);

  // ----- Note search (titles + content + tags, live) -----
  const q = search.trim().toLowerCase();
  const noteMatches = (n: Note) =>
    !q ||
    (n.title || "").toLowerCase().includes(q) ||
    (n.content || "").toLowerCase().includes(q) ||
    (n.tags || []).some((t) => t.toLowerCase().includes(q));
  const applyTagFilter = (n: Note) => !tagFilter || (n.tags || []).includes(tagFilter);
  const matches = (n: Note) => noteMatches(n) && applyTagFilter(n);

  const activeNotes = notes.filter((n) => !n.deletedAt);
  const trashedNotes = notes.filter((n) => n.deletedAt);
  const allTags = Array.from(new Set(activeNotes.flatMap((n) => n.tags || []))).sort();
  const searchMatches = q ? activeNotes.filter(matches).length : 0;

  const unfiledNotes = activeNotes.filter((n) => !n.folderId && matches(n));
  const activeTasks = tasks.filter((t) => !t.done);

  if (windowLabel === "settings") {
    return (
      <SettingsWindow
        theme={theme}
        settings={settings}
        setSettings={setSettings}
        toggleTheme={toggleTheme}
        closeWindow={closeWindow}
        store={store}
        onResetData={resetAllData}
      />
    );
  }

  // Pinned desktop note windows (issue #3)
  if (windowLabel.startsWith("note-")) {
    return <PinnedNote noteId={windowLabel.slice(5)} />;
  }

  // Inline note editor view (replaces the list inside the main window)
  if (openNoteId) {
    return (
      <MarkdownNote
        theme={theme}
        settings={settings}
        onBack={backToList}
        noteTitle={noteTitle}
        setNoteTitle={setNoteTitle}
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        noteColor={noteColor}
        setNoteColor={setNoteColor}
        noteIcon={noteIcon}
        setNoteIcon={setNoteIcon}
        noteFormat={noteFormat}
        setNoteFormat={setNoteFormat}
        noteTags={notes.find((n) => n.id === openNoteId)?.tags || []}
        onAddTag={(t) => { addTagToNote(openNoteId, t); }}
        onRemoveTag={(t) => { removeTagFromNote(openNoteId, t); }}
        onPin={() => {
          const n = notes.find((x) => x.id === openNoteId);
          if (n) pinNoteToDesktop(n);
        }}
        toggleTheme={toggleTheme}
        closeWindow={closeWindow}
      />
    );
  }

  // ----- Command palette (issue #6) -----
  const fuzzy = (needle: string, hay: string) => {
    if (!needle) return true;
    let i = 0;
    for (const ch of hay.toLowerCase()) { if (ch === needle[i]) i += 1; }
    return i === needle.length;
  };
  type PaletteItem = { id: string; title: string; subtitle: string; run: () => void };
  const closePalette = () => { setPaletteOpen(false); setPaletteQuery(""); };
  const paletteItems: PaletteItem[] = [
    { id: "new-note", title: "New note", subtitle: "Create a note", run: () => createNoteInFolder(null) },
    { id: "new-folder", title: "New folder", subtitle: "Create a folder", run: () => { setShowNewFolder(true); } },
    { id: "toggle-theme", title: "Toggle theme", subtitle: "Light / dark", run: () => toggleTheme() },
    { id: "settings", title: "Open settings", subtitle: "Preferences", run: () => { openSettingsWindow(); } },
  ];
  if (trashedNotes.length > 0) {
    paletteItems.push({ id: "empty-trash", title: "Empty trash", subtitle: "Delete all trashed notes forever", run: () => emptyTrash() });
  }
  activeNotes.slice(0, 20).forEach((n) => {
    const label = n.title || "Untitled";
    paletteItems.push({ id: "open-" + n.id, title: "Open: " + label, subtitle: (n.tags || []).map((t) => "#" + t).join(" ") || "Note", run: () => openNote(n) });
    paletteItems.push({ id: "pin-" + n.id, title: "Pin to desktop: " + label, subtitle: "Float this note on top", run: () => { pinNoteToDesktop(n); } });
  });
  const pq = paletteQuery.trim().toLowerCase();
  const visibleItems = pq ? paletteItems.filter((it) => fuzzy(pq, it.title + " " + it.subtitle)) : paletteItems.slice(0, 12);

  return (
    <div className="pin-window" data-tauri-drag-region style={{ fontSize: settings.fontSize, fontFamily: settings.fontFamily }}>
      <header className="titlebar" data-tauri-drag-region>
        <span className="app-title"><Pin size={16} /> Pin</span>
        <div className="title-actions">
          {streak > 0 && (
            <div className="streak-badge" title={streak + " day streak"}>
              <Flame size={14} className="streak-flame" />
              <span className="streak-count">{streak}</span>
            </div>
          )}
          <button onClick={() => setPaletteOpen(true)} className="icon-btn" title="Command palette (Ctrl+K)"><Command size={16} /></button>
          <button onClick={openSettingsWindow} className="icon-btn" title="Settings"><Settings size={16} /></button>
          <button onClick={toggleTheme} className="icon-btn" title="Theme">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
        </div>
      </header>

      <div className="library-section">
        <div className="library-header">
          <span>Notes &amp; Folders</span>
          <div className="library-header-actions">
            <button onClick={() => createNoteInFolder(null)} title="New Note" className="icon-btn"><Plus size={14} /></button>
            <button onClick={() => setShowNewFolder(true)} title="New Folder" className="icon-btn"><FolderPlus size={14} /></button>
          </div>
        </div>
        <div className="note-search-row">
          <Search size={13} className="search-icon" />
          <input className="note-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes..." />
          {q ? (
            <>
              <span className="search-count">{searchMatches} {searchMatches === 1 ? "match" : "matches"}</span>
              <button className="icon-btn" title="Clear search" onClick={() => setSearch("")}><X size={14} /></button>
            </>
          ) : null}
        </div>
        {allTags.length > 0 && (
          <div className="tag-filter-row">
            {allTags.map((t) => (
              <button
                key={t}
                className={"tag-filter-chip " + (tagFilter === t ? "active" : "")}
                style={{ borderColor: tagColor(t) }}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
              >{"#" + t}</button>
            ))}
            {tagFilter && <button className="icon-btn" title="Clear tag filter" onClick={() => setTagFilter(null)}><X size={12} /></button>}
          </div>
        )}
        {showNewFolder && (
          <div className="new-folder-row">
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFolder()} placeholder="Folder name..." autoFocus />
            <button onClick={createFolder} className="small-btn">Add</button>
            <button onClick={() => setShowNewFolder(false)} className="icon-btn"><X size={14} /></button>
          </div>
        )}
        <div className="folder-list">
          {folders.map((folder) => {
            const folderNotes = activeNotes.filter((n) => n.folderId === folder.id && matches(n));
            const isExpanded = q || tagFilter ? true : expandedFolders.has(folder.id);
            const FolderIcon = isExpanded ? FolderOpen : Folder;
            if ((q || tagFilter) && !folder.name.toLowerCase().includes(q) && folderNotes.length === 0) return null;
            return (
              <div key={folder.id} className="folder-block">
                <div className="folder-row" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ type: "folder", id: folder.id, x: e.clientX, y: e.clientY }); }}>
                  <button className="icon-btn expand-btn" onClick={() => toggleFolder(folder.id)}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                  <FolderIcon size={14} />
                  {renamingId === folder.id ? (
                    <input className="rename-input" value={renameText} autoFocus onChange={(e) => setRenameText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameFolder(folder.id, renameText); if (e.key === "Escape") setRenamingId(null); }} onBlur={() => renameFolder(folder.id, renameText)} />
                  ) : (
                    <span className="folder-name" onDoubleClick={() => startRename(folder.id, folder.name)}>{folder.name}</span>
                  )}
                  <span className="folder-count">{folderNotes.length}</span>
                  <button className="icon-btn" onClick={() => createNoteInFolder(folder.id)}><Plus size={14} /></button>
                  <button className="icon-btn delete-btn" onClick={() => deleteFolder(folder.id)}><X size={12} /></button>
                </div>
                {isExpanded && (
                  <div className="folder-notes">
                    {folderNotes.map((note) => {
                      const NoteIcon = getIcon(note.icon).Icon;
                      return (
                        <div key={note.id} className="note-row" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ type: "note", id: note.id, x: e.clientX, y: e.clientY }); }}>
                          <NoteIcon size={13} />
                          {renamingId === note.id ? (
                            <input className="rename-input" value={renameText} autoFocus onChange={(e) => setRenameText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameNote(note.id, renameText); if (e.key === "Escape") setRenamingId(null); }} onBlur={() => renameNote(note.id, renameText)} />
                          ) : (
                            <button className="note-open-btn" onClick={() => openNote(note)}>{note.title || "Untitled"}</button>
                          )}
                          <button className="icon-btn" title="Pin to desktop" onClick={() => pinNoteToDesktop(note)}><Pin size={12} /></button>
                          <button className="icon-btn" title="Rename" onClick={() => startRename(note.id, note.title || "Untitled")}><Pencil size={12} /></button>
                          <button className="icon-btn delete-btn" onClick={() => deleteNoteFromList(note.id)}><X size={12} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {unfiledNotes.map((note) => {
            const NoteIcon = getIcon(note.icon).Icon;
            return (
              <div key={note.id} className="note-row" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ type: "note", id: note.id, x: e.clientX, y: e.clientY }); }}>
                <NoteIcon size={13} />
                {renamingId === note.id ? (
                  <input className="rename-input" value={renameText} autoFocus onChange={(e) => setRenameText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameNote(note.id, renameText); if (e.key === "Escape") setRenamingId(null); }} onBlur={() => renameNote(note.id, renameText)} />
                ) : (
                  <button className="note-open-btn" onClick={() => openNote(note)}>{note.title || "Untitled"}</button>
                )}
                <button className="icon-btn" title="Pin to desktop" onClick={() => pinNoteToDesktop(note)}><Pin size={12} /></button>
                <button className="icon-btn" title="Rename" onClick={() => startRename(note.id, note.title || "Untitled")}><Pencil size={12} /></button>
                <button className="icon-btn delete-btn" onClick={() => deleteNoteFromList(note.id)}><X size={12} /></button>
              </div>
            );
          })}
          {trashedNotes.length > 0 && (
            <div className="trash-block">
              <div className="trash-header" onClick={() => setTrashOpen((v) => !v)}>
                {trashOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Trash2 size={13} />
                <span>Trash</span>
                <span className="folder-count">{trashedNotes.length}</span>
                <button className="icon-btn delete-btn" title="Empty trash" onClick={(e) => { e.stopPropagation(); emptyTrash(); }}><X size={12} /></button>
              </div>
              {trashOpen && (
                <div className="trash-items">
                  {trashedNotes.map((n) => (
                    <div key={n.id} className="trash-item">
                      <span className="trash-item-title">{n.title || "Untitled"}</span>
                      <button className="icon-btn" title="Restore" onClick={() => restoreNote(n.id)}><Undo2 size={12} /></button>
                      <button className="icon-btn delete-btn" title="Delete forever" onClick={() => purgeNote(n.id)}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="input-area">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="What are you focusing on?" />
      </div>
      <ul className="task-list">
        {activeTasks.map((task) => (
          <li key={task.id}>
            <label>
              <input type="checkbox" className="circle-checkbox" checked={false} onChange={() => setTasks(tasks.filter((t) => t.id !== task.id))} />
              <span>{task.text}</span>
            </label>
            <button className="icon-btn delete-btn" onClick={() => setTasks(tasks.filter((t) => t.id !== task.id))}><X size={14} /></button>
          </li>
        ))}
      </ul>

      {paletteOpen && (
        <div className="palette-overlay" onClick={closePalette}>
          <div className="palette" onClick={(e) => e.stopPropagation()}>
            <input
              className="palette-input"
              autoFocus
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.preventDefault(); closePalette(); }
                if (e.key === "Enter") { e.preventDefault(); const first = visibleItems[0]; if (first) { first.run(); closePalette(); } }
              }}
              placeholder="Type a command or search notes..."
            />
            <div className="palette-items">
              {visibleItems.length === 0 && <div className="palette-empty">No matching commands</div>}
              {visibleItems.map((it) => (
                <button key={it.id} className="palette-item" onClick={() => { it.run(); closePalette(); }}>
                  <div className="palette-item-title">{it.title}</div>
                  <div className="palette-item-sub">{it.subtitle}</div>
                </button>
              ))}
            </div>
            <div className="palette-hint">Enter to run - Esc to close</div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div className="context-menu-overlay" onClick={() => setContextMenu(null)}>
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => {
              if (contextMenu.type === "folder") {
                const f = folders.find((x) => x.id === contextMenu.id);
                if (f) startRename(f.id, f.name);
              } else {
                const n = notes.find((x) => x.id === contextMenu.id);
                if (n) startRename(n.id, n.title);
              }
            }}>Rename</button>
            {contextMenu.type === "folder" && <button onClick={() => { createNoteInFolder(contextMenu.id); setContextMenu(null); }}>New note</button>}
            {contextMenu.type === "note" && (
              <button onClick={() => {
                const n = notes.find((x) => x.id === contextMenu.id);
                if (n) pinNoteToDesktop(n);
              }}>Pin to desktop</button>
            )}
            <button className="danger" onClick={() => {
              if (contextMenu.type === "folder") deleteFolder(contextMenu.id);
              else deleteNoteFromList(contextMenu.id);
              setContextMenu(null);
            }}>Delete</button>
            {contextMenu.type === "note" && (
              <div className="context-menu-icons">
                <div className="context-menu-icons-title">Change icon</div>
                <div className="icon-grid context-icon-grid">
                  {ICON_BANK.map(({ id, Icon, label }) => (
                    <button
                      key={id}
                      className={"icon-grid-item " + (notes.find((x) => x.id === contextMenu.id)?.icon === id ? "active" : "")}
                      title={label}
                      onClick={() => setNoteIconFor(contextMenu.id, id)}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pomodoro-bar pomodoro-bottom">
        <div className="pomodoro-bottom-row">
          <span className="pomodoro-timer-sm">{formatTime(secondsLeft)}</span>
          <div className="pomodoro-progress-track pomodoro-progress-sm">
            <div className="pomodoro-progress-fill" style={{ width: progress + "%" }} />
          </div>
          <div className="pomodoro-controls-sm">
            <button onClick={() => { setIsRunning(false); setSecondsLeft(pomodoroMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS); }} className="icon-btn" title="Reset"><RotateCcw size={16} /></button>
            <button onClick={() => { setIsRunning(false); setPomodoroMode("break"); setSecondsLeft(BREAK_SECONDS); }} className={"icon-btn " + (pomodoroMode === "break" ? "active-mode" : "")} title="Break"><Coffee size={16} /></button>
            {isRunning ? (
              <button onClick={() => setIsRunning(false)} className="icon-btn" title="Pause"><Pause size={16} /></button>
            ) : (
              <button onClick={() => setIsRunning(true)} className="icon-btn" title="Start"><Play size={16} /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
