import { useState, useEffect, useRef } from "react";
import { getCurrentWindow, getAllWindows } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Store } from "@tauri-apps/plugin-store";
import { save, open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile, readTextFile } from "@tauri-apps/plugin-fs";
import JSZip from "jszip";
import { register, unregister, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { TrayIcon } from "@tauri-apps/api/tray";
import { Menu } from "@tauri-apps/api/menu";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import {
  Pin, Moon, Sun, Plus, X, Play, Pause, RotateCcw, Search,
  ChevronDown, ChevronRight, FolderPlus, Flame, Folder, FolderOpen,
  Coffee, Settings, Trash2, Undo2, Command, Minus, Clock, Zap,
} from "lucide-react";
import {
  DEFAULT_SETTINGS, NOTE_COLORS,
  FOCUS_SECONDS, BREAK_SECONDS, playBeep, getIcon, ICON_BANK,
  type Task, type Theme, type NoteColor, type PomodoroMode, type AppSettings,
  type NoteFolder, type Note,
} from "./appData";
import { MarkdownNote } from "./MarkdownNote";
import { SettingsWindow } from "./SettingsWindow";
import { QuickNoteCapture } from "./QuickNoteCapture";
import { WebClipOverlay, WEB_CLIPS_FOLDER_ID, type WebClip } from "./WebClipper";
import { readText as readClipboardText } from "@tauri-apps/plugin-clipboard-manager";

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
  // v0.1.7: read the cached theme synchronously so dark mode never flashes
  // light on launch (issue #18). index.html applies it before React mounts.
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem("pin-theme") === "dark" ? "dark" : "light"; } catch { return "light"; }
  });
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
  // v0.1.10: the tag filter row is gone from the list (issue #24) — tags are
  // managed through the "/tags" picker inside a note. The state stays so
  // the search/filter logic is untouched.
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  // v0.1.6: focus sessions per day, save safety net (issue #16)
  const [focusDone, setFocusDone] = useState<{ date: string; count: number } | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const undoStackRef = useRef<string[]>([]);
  const lastPushRef = useRef(0);
  // v0.1.14: note reminders (issue #34) — draft input in the context menu
  // and the toast shown when a reminder comes due.
  const [reminderDraft, setReminderDraft] = useState("");
  const [reminderToast, setReminderToast] = useState<{ id: string; title: string } | null>(null);
  // v0.1.15: quick capture box opened by the global hotkey, and the
  // wiki-link graph view with its search box (issue #36).
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);
  const [quickCaptureText, setQuickCaptureText] = useState("");
  // v0.1.18: web clipper overlay (paste a URL, save the clean article)
  const [clipOpen, setClipOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [graphQuery, setGraphQuery] = useState("");
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
      const fd = await s.get<{ date: string; count: number }>("focusDone"); if (fd) setFocusDone(fd);
      setNotes(await loadNotes(s));
      setReady(true);
    })();
  }, []);

  // Apply theme attribute immediately (never blocked), but only persist
  // after the initial load finished.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // v0.1.7: cache in localStorage too so the NEXT launch starts dark
    // with zero flash (the inline script in index.html reads it).
    try { localStorage.setItem("pin-theme", theme); } catch { /* ignore */ }
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

  // Poll for settings/theme changes made in the Settings window.
  // v0.1.7: 150ms so a theme flip from Settings feels instant (issue #18).
  useEffect(() => {
    if (!store || !ready) return;
    const id = setInterval(async () => {
      const st = await store.get<AppSettings>("settings");
      if (st) setSettings((prev) => (JSON.stringify(prev) === JSON.stringify({ ...DEFAULT_SETTINGS, ...st }) ? prev : { ...DEFAULT_SETTINGS, ...st }));
      const th = await store.get<Theme>("theme");
      if (th && th !== theme) setTheme(th);
    }, 150);
    return () => clearInterval(id);
  }, [store, ready, theme]);

  useEffect(() => {
    if (ready && store && windowLabel === "main") {
      store.set("streak", streak); store.set("lastActiveDate", lastActiveDate); store.save();
    }
  }, [streak, lastActiveDate, store, ready, windowLabel]);

  // v0.1.6: persist today's focus session count (issue #16)
  useEffect(() => {
    if (ready && store && windowLabel === "main") {
      store.set("focusDone", focusDone); store.save();
    }
  }, [focusDone, store, ready, windowLabel]);

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
      // v0.1.6: count each completed focus session toward today's total (issue #16)
      if (pomodoroMode === "focus") {
        const today = new Date().toISOString().slice(0, 10);
        setFocusDone((prev) => (prev && prev.date === today ? { date: today, count: prev.count + 1 } : { date: today, count: 1 }));
      }
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
    // v0.1.17: closing the main window hides it to the tray instead of
    // quitting — the tray menu keeps Pin reachable (issue #40).
    if (windowLabel === "main") {
      try { await win.hide(); } catch { /* ignore */ }
      return;
    }
    try {
      await win.close();
    } catch {
      try { await win.destroy(); } catch { /* ignore */ }
    }
  };
  // v0.1.7: themed window controls (native decorations are off, issue #18)
  const minimizeWindow = async () => {
    const win = getCurrentWindow();
    try { await win.minimize(); } catch { /* ignore */ }
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
    // v0.1.15: leaving the list view also closes the graph (issue #36)
    setGraphOpen(false);
    // v0.1.6: fresh undo history per opened note (issue #16)
    undoStackRef.current = [];
    lastPushRef.current = 0;
  };
  const backToList = () => {
    setOpenNoteId(null);
  };

  // v0.1.6: save safety net (issue #16).
  // Ctrl+S forces an immediate save and flashes "Saved" in the status bar;
  // Ctrl+Z restores the last content snapshot (60-deep, throttled while
  // typing) so a bad paste can never destroy a long note.
  const saveNow = async () => {
    if (!store || !openNoteId) return;
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
    setSavedAt(Date.now());
  };
  const undoOne = () => {
    const stack = undoStackRef.current;
    if (!stack.length) return;
    const prev = stack.pop() as string;
    setNoteContent(prev);
  };
  const setNoteContentTracked = (v: string) => {
    const now = Date.now();
    if (now - lastPushRef.current > 500) {
      undoStackRef.current.push(noteContent);
      if (undoStackRef.current.length > 60) undoStackRef.current.shift();
      lastPushRef.current = now;
    }
    setNoteContent(v);
  };
  useEffect(() => {
    if (!openNoteId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "s") { e.preventDefault(); saveNow(); }
        else if (k === "z") { e.preventDefault(); undoOne(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNoteId, store, noteTitle, noteContent, noteColor, noteIcon, noteFolderId, noteFormat]);

  const createFolder = () => {
    const folder: NoteFolder = { id: crypto.randomUUID(), name: newFolderName.trim() || "New Folder", icon: "folder", createdAt: Date.now() };
    setFolders([...folders, folder]);
    setExpandedFolders(new Set([...expandedFolders, folder.id]));
    setNewFolderName(""); setShowNewFolder(false);
  };
  const deleteFolder = (id: string) => {
    const ts = Date.now();
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, deletedAt: ts } : f)));
    const moved = notes.filter((n) => n.folderId === id && !n.deletedAt);
    setNotes((prev) => prev.map((n) => (n.folderId === id && !n.deletedAt ? { ...n, deletedAt: ts } : n)));
    moved.forEach((n) => { persistNote({ ...n, deletedAt: ts }); });
  };
  const restoreFolder = (id: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, deletedAt: undefined } : f)));
    const moved = notes.filter((n) => n.folderId === id && n.deletedAt);
    setNotes((prev) => prev.map((n) => (n.folderId === id && n.deletedAt ? { ...n, deletedAt: undefined } : n)));
    moved.forEach((n) => { persistNote({ ...n, deletedAt: undefined }); });
  };
  const purgeFolder = (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    const inside = notes.filter((n) => n.folderId === id);
    setNotes((prev) => prev.filter((n) => n.folderId !== id));
    inside.forEach((n) => { removeNotePersist(n.id); });
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
  /** v0.1.13: change a note's color straight from the list context menu (issue #30). */
  const setNoteColorFor = (id: string, color: NoteColor) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, color };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
    if (openNoteId === id) setNoteColor(color);
    setContextMenu(null);
  };
  /** Toggle a note's favorite; favorites sort to the top of every list (issue #10). */
  const toggleFavorite = (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, favorite: !n.favorite };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
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
  // v0.1.15: save the quick capture box. First line becomes the title,
  // the whole text stays as the note content (issue #36).
  const quickCaptureSave = () => {
    const text = quickCaptureText.trim();
    if (!text) return;
    const firstLine = text.split("\n")[0].trim().slice(0, 80);
    const note: Note = { id: crypto.randomUUID(), title: firstLine || "Untitled", content: text, color: "yellow", icon: "sticky-note", folderId: null, createdAt: Date.now(), format: "md" };
    setNotes([note, ...notes]);
    persistNote(note);
    recordActivity();
    setQuickCaptureText("");
    setQuickCaptureOpen(false);
  };
  // ===== v0.1.18: web clipper — save pages and selections as clean notes (issue #42) =====

  /** Save a clipped page / selection into the Web Clips folder. The page
   *  address and ad boilerplate never make it into the note. */
  const saveClipNote = (clip: { title: string; markdown: string }, tag: string) => {
    if (!clip.markdown.trim()) return;
    const note: Note = {
      id: crypto.randomUUID(),
      title: (clip.title || "Web clip").slice(0, 80),
      content: clip.markdown,
      color: "yellow",
      icon: "globe",
      folderId: WEB_CLIPS_FOLDER_ID,
      createdAt: Date.now(),
      format: "md",
      tags: [tag],
    };
    if (!folders.some((f) => f.id === WEB_CLIPS_FOLDER_ID && !f.deletedAt)) {
      const folder: NoteFolder = { id: WEB_CLIPS_FOLDER_ID, name: "Web Clips", icon: "globe", createdAt: Date.now() };
      setFolders([...folders, folder]);
    }
    setNotes([note, ...notes]);
    persistNote(note);
    recordActivity();
  };

  // Global Ctrl/Cmd+Shift+C: copy selected text anywhere in the OS, hit
  // the hotkey, and the clipboard text becomes a note in Web Clips.
  const clipSelectionRef = useRef<() => void>(() => {});
  clipSelectionRef.current = async () => {
    try {
      const text = (await readClipboardText()).trim();
      if (!text) return;
      const firstLine = text.split("\n")[0].trim().slice(0, 80);
      saveClipNote({ title: firstLine || "Clipped selection", markdown: text }, "clip");
    } catch { /* clipboard unavailable */ }
  };
  useEffect(() => {
    if (windowLabel !== "main") return;
    (async () => {
      try {
        const already = await isRegistered("CommandOrControl+Shift+C").catch(() => false);
        if (!already) {
          await register("CommandOrControl+Shift+C", async (event) => {
            if (event.state === "Pressed") clipSelectionRef.current();
          });
        }
      } catch { /* shortcut unavailable (already taken by another app) */ }
    })();
    return () => { unregister("CommandOrControl+Shift+C").catch(() => {}); };
  }, [windowLabel]);

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
    if (!window.confirm("Permanently delete everything in trash? This cannot be undone.")) return;
    notes.filter((n) => n.deletedAt).forEach((n) => { removeNotePersist(n.id); });
    setNotes((prev) => prev.filter((n) => !n.deletedAt));
    setFolders((prev) => prev.filter((f) => !f.deletedAt));
    setTasks((prev) => prev.filter((t) => !t.deletedAt));
  };
  // v0.1.5: note tags (issue #5). v0.1.10: tags are added/removed from the
  // "/tags" picker inside the note editor (issue #24).
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
  const markTaskDeleted = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, deletedAt: Date.now() } : t)));
  };
  const restoreTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, deletedAt: undefined } : t)));
  };
  const purgeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
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
    setTrashOpen(false);
    setFocusDone(null);
    setGraphOpen(false);
    setQuickCaptureOpen(false);
  };

  // ===== v0.1.14: wiki-links, reminders, export / import (issue #34) =====

  /** Open (or create) the note a [[wiki-link]] points to, Obsidian-style. */
  const openWikiLink = (title: string) => {
    const t = title.trim();
    if (!t) return;
    const found = notes.find((n) => !n.deletedAt && (n.title || "").trim().toLowerCase() === t.toLowerCase());
    if (found) { openNote(found); return; }
    const note: Note = { id: crypto.randomUUID(), title: t, content: "", color: "yellow", icon: "sticky-note", folderId: null, createdAt: Date.now(), format: "md" };
    setNotes([note, ...notes]);
    persistNote(note);
    recordActivity();
    openNote(note);
  };
  const openNoteById = (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (n) openNote(n);
  };

  /** Set / clear a reminder on a note from the right-click menu. */
  const setReminderFor = (id: string) => {
    if (!reminderDraft) return;
    const ts = new Date(reminderDraft).getTime();
    if (isNaN(ts)) return;
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, reminderAt: ts, reminderFiredAt: undefined };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
    setReminderDraft("");
    setContextMenu(null);
  };
  const clearReminderFor = (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const updated = { ...n, reminderAt: undefined, reminderFiredAt: undefined };
    setNotes(notes.map((x) => (x.id === id ? updated : x)));
    persistNote(updated);
    setContextMenu(null);
  };

  // Poll for due reminders: fires once per reminder, plays the same beep
  // as the pomodoro timer and raises the in-app toast.
  useEffect(() => {
    if (!ready || !store || windowLabel !== "main") return;
    const tick = async () => {
      const now = Date.now();
      const due = notes.filter((n) => !n.deletedAt && n.reminderAt && n.reminderAt <= now && !n.reminderFiredAt);
      if (due.length === 0) return;
      setNotes((prev) => prev.map((n) => {
        const hit = due.find((d) => d.id === n.id);
        return hit ? { ...n, reminderFiredAt: now } : n;
      }));
      for (const n of due) await persistNote({ ...n, reminderFiredAt: now });
      playBeep();
      setReminderToast({ id: due[0].id, title: due[0].title || "Untitled" });
    };
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [ready, store, notes, windowLabel]);

  /** Export every active note as a .md file inside one ZIP archive. */
  const exportLibraryZip = async () => {
    try {
      const path = await save({ defaultPath: "pin-notes.zip", filters: [{ name: "ZIP archive", extensions: ["zip"] }] });
      if (!path) return;
      const zip = new JSZip();
      const used = new Set<string>();
      activeNotes.forEach((n) => {
        let base = (n.title || "untitled").replace(/[<>:"/\\|?*]+/g, "-").trim() || "untitled";
        let name = base + ".md";
        let k = 2;
        while (used.has(name)) { name = base + "-" + k + ".md"; k += 1; }
        used.add(name);
        zip.file(name, (n.content || "") + "\n");
      });
      const data = await zip.generateAsync({ type: "uint8array" });
      await writeFile(path, data);
    } catch { /* user cancelled or write failed */ }
  };

  /** Import .md files or a ZIP backup exported earlier; each file becomes a note. */
  const importNotes = async () => {
    try {
      const picked = await openFileDialog({ multiple: true, filters: [{ name: "Notes", extensions: ["md", "zip"] }] });
      if (!picked) return;
      const paths = Array.isArray(picked) ? picked : [picked];
      const created: Note[] = [];
      for (const path of paths) {
        if (path.toLowerCase().endsWith(".zip")) {
          const data = await readFile(path);
          const zip = await JSZip.loadAsync(data);
          for (const entry of Object.values(zip.files)) {
            if (entry.dir || !entry.name.toLowerCase().endsWith(".md")) continue;
            const text = await entry.async("string");
            const base = (entry.name.split("/").pop() || "Imported").replace(/\.md$/i, "");
            created.push({ id: crypto.randomUUID(), title: base, content: text.replace(/\n+$/, ""), color: "yellow", icon: "sticky-note", folderId: null, createdAt: Date.now(), format: "md" });
          }
        } else {
          const text = await readTextFile(path);
          const base = (path.split(/[\\/]/).pop() || "Imported").replace(/\.md$/i, "");
          created.push({ id: crypto.randomUUID(), title: base, content: text.replace(/\n+$/, ""), color: "yellow", icon: "sticky-note", folderId: null, createdAt: Date.now(), format: "md" });
        }
      }
      if (created.length === 0) return;
      setNotes([...created, ...notes]);
      for (const n of created) await persistNote(n);
      recordActivity();
    } catch { /* user cancelled or read failed */ }
  };

  // Global quick-capture hotkey (Ctrl/Cmd+Shift+P): bring Pin to the
  // front and open the quick capture box, from anywhere in the OS (issue #36).
  const quickCaptureRef = useRef<() => void>(() => {});
  quickCaptureRef.current = () => { setQuickCaptureText(""); setQuickCaptureOpen(true); };
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

  // ===== v0.1.17: Quick Note capture window + tray icon (issue #40) =====

  /** Show the hidden Spotlight-style quicknote window, creating it on
   *  first use (it is declared in tauri.conf.json as visible:false). */
  const showQuickNote = async () => {
    try {
      let w = await WebviewWindow.getByLabel("quicknote");
      if (!w) {
        w = new WebviewWindow("quicknote", {
          url: "index.html",
          title: "Quick Note",
          width: 460, height: 240,
          decorations: false, transparent: false, alwaysOnTop: true, skipTaskbar: true, visible: false, center: true,
        });
        await new Promise((r) => setTimeout(r, 250));
      }
      await w.show();
      await w.setFocus();
    } catch { /* ignore */ }
  };
  const showQuickNoteRef = useRef<() => void>(() => {});
  showQuickNoteRef.current = () => { showQuickNote(); };

  // Global hotkey: Ctrl/Cmd+Shift+N summons the Quick Note window from
  // anywhere in the OS, without opening the main app.
  useEffect(() => {
    if (windowLabel !== "main") return;
    (async () => {
      try {
        const already = await isRegistered("CommandOrControl+Shift+N").catch(() => false);
        if (!already) {
          await register("CommandOrControl+Shift+N", async (event) => {
            if (event.state === "Pressed") {
              showQuickNoteRef.current();
            }
          });
        }
      } catch { /* shortcut unavailable (already taken by another app) */ }
    })();
    return () => { unregister("CommandOrControl+Shift+N").catch(() => {}); };
  }, [windowLabel]);

  // Tray icon keeps Pin reachable after the main window is hidden to the
  // tray: Show Pin, Quick Note, Quit.
  useEffect(() => {
    if (windowLabel !== "main") return;
    (async () => {
      try {
        const existing = await TrayIcon.getById("main");
        if (existing) return;
        const menu = await Menu.new({
          items: [
            {
              id: "show",
              text: "Show Pin",
              action: async () => {
                try {
                  const win = getCurrentWindow();
                  await win.show();
                  await win.setFocus();
                } catch { /* ignore */ }
              },
            },
            { id: "quick", text: "Quick Note", action: () => { showQuickNoteRef.current(); } },
            { id: "quit", text: "Quit", action: async () => { const ws = await getAllWindows(); for (const w of ws) { await w.destroy(); } } },
          ],
        });
        const trayIcon = await defaultWindowIcon();
        await TrayIcon.new({
          id: "main",
          icon: trayIcon ?? undefined,
          tooltip: "Pin",
          menu,
          showMenuOnLeftClick: true,
        });
      } catch { /* tray unavailable */ }
    })();
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

  const activeNotes = notes.filter((n) => !n.deletedAt)
    .sort((x, y) => Number(y.favorite || false) - Number(x.favorite || false) || y.createdAt - x.createdAt);
  const trashedNotes = notes.filter((n) => n.deletedAt);
  const allTags = Array.from(new Set(activeNotes.flatMap((n) => n.tags || []))).sort();
  const searchMatches = q ? activeNotes.filter(matches).length : 0;

  const activeFolders = folders.filter((f) => !f.deletedAt);
  const trashedFolders = folders.filter((f) => f.deletedAt);
  const trashedTasks = tasks.filter((t) => t.deletedAt);
  const trashCount = trashedFolders.length + trashedNotes.length + trashedTasks.length;

  const unfiledNotes = activeNotes.filter((n) => !n.folderId && matches(n));
  const activeTasks = tasks.filter((t) => !t.done && !t.deletedAt);

  // v0.1.6: stats footer (issue #16)
  const totalWords = activeNotes.reduce(
    (acc: number, n: Note) => acc + ((n.content || "").trim() ? (n.content || "").trim().split(/\s+/).length : 0),
    0
  );

  // v0.1.14: backlinks — other notes whose content links to the open note.
  const backlinks = openNoteId && noteTitle.trim()
    ? activeNotes
        .filter((n) => n.id !== openNoteId && (n.content || "").includes("[[" + noteTitle.trim() + "]]"))
        .map((n) => ({ id: n.id, title: n.title || "Untitled" }))
    : [];
  const linkableNotes = activeNotes.map((n) => ({ id: n.id, title: n.title || "Untitled" }));

  // ===== v0.1.15: graph view over the wiki-links (issue #36) =====
  // Nodes are notes, edges are [[wiki-links]] between note titles.
  // Layout: deterministic ring, favorites pulled toward the center so
  // hubs are easy to spot. The search box dims non-matching nodes.
  const gq = graphQuery.trim().toLowerCase();
  const graphNodes = activeNotes.map((n, i) => {
    const count = Math.max(activeNotes.length, 1);
    const angle = (i / count) * Math.PI * 2;
    const radius = n.favorite ? 60 : 110;
    const cx = 160;
    const cy = 150;
    return {
      id: n.id,
      title: n.title || "Untitled",
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      favorite: !!n.favorite,
      dimmed: !!gq && !((n.title || "").toLowerCase().includes(gq) || (n.content || "").toLowerCase().includes(gq)),
    };
  });
  const nodePos = new Map(graphNodes.map((g) => [g.id, g]));
  const titleToId = new Map(activeNotes.map((n) => [(n.title || "").trim().toLowerCase(), n.id]));
  const graphEdges: { from: string; to: string }[] = [];
  activeNotes.forEach((n) => {
    const raw = (n.content || "").match(/\[\[([^\]\n]+)\]\]/g) || [];
    raw.forEach((link) => {
      const target = titleToId.get(link.slice(2, -2).trim().toLowerCase());
      if (target && target !== n.id) {
        graphEdges.push({ from: n.id, to: target });
      }
    });
  });
  const linkedCount = new Set([...graphEdges.map((e) => e.from), ...graphEdges.map((e) => e.to)]).size;

  // v0.1.17: hidden Quick Note capture window (issue #40)
  if (windowLabel === "quicknote") {
    return <QuickNoteCapture />;
  }

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
        setNoteContent={setNoteContentTracked}
        noteColor={noteColor}
        setNoteColor={setNoteColor}
        noteIcon={noteIcon}
        setNoteIcon={setNoteIcon}
        noteFormat={noteFormat}
        setNoteFormat={setNoteFormat}
        noteTags={notes.find((n) => n.id === openNoteId)?.tags || []}
        allTags={allTags}
        onAddTag={(t) => { addTagToNote(openNoteId, t); }}
        onRemoveTag={(t) => { removeTagFromNote(openNoteId, t); }}
        onPin={() => {
          const n = notes.find((x) => x.id === openNoteId);
          if (n) pinNoteToDesktop(n);
        }}
        savedAt={savedAt}
        toggleTheme={toggleTheme}
        closeWindow={closeWindow}
        allNotes={linkableNotes}
        onOpenWikiLink={openWikiLink}
        backlinks={backlinks}
        onOpenNoteById={openNoteById}
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
    { id: "open-trash", title: "Open trash", subtitle: "Restore deleted notes, folders and tasks", run: () => { setTrashOpen(true); } },
    // v0.1.14: library backup (issue #34)
    { id: "export-zip", title: "Export library (ZIP)", subtitle: "Backup all notes as .md files in a ZIP", run: () => { exportLibraryZip(); } },
    { id: "import-notes", title: "Import notes", subtitle: "Bring in .md files or a ZIP backup", run: () => { importNotes(); } },
    // v0.1.15: quick capture box + wiki-link graph (issue #36)
    { id: "quick-capture", title: "Quick capture", subtitle: "Type a thought, Enter to save (also Ctrl+Shift+P anywhere)", run: () => { setQuickCaptureText(""); setQuickCaptureOpen(true); } },
    { id: "graph-view", title: "Graph view", subtitle: "Map of notes and their wiki-links, with search", run: () => { setGraphOpen(true); } },
    // v0.1.17: Quick Note window (issue #40)
    { id: "quick-note-window", title: "Quick Note window", subtitle: "Spotlight-style capture window (also Ctrl+Shift+N anywhere)", run: () => { showQuickNote(); } },
    // v0.1.18: web clipper (issue #42)
    { id: "clip-webpage", title: "Clip webpage", subtitle: "Paste a URL, save the clean article without ads (Ctrl+K then type clip)", run: () => { setClipOpen(true); } },
    { id: "clip-selection", title: "Clip selected text", subtitle: "Save copied text as a note (also Ctrl+Shift+C anywhere)", run: () => { clipSelectionRef.current(); } },
  ];
  if (trashCount > 0) {
    paletteItems.push({ id: "empty-trash", title: "Empty trash", subtitle: "Delete all trashed notes forever", run: () => emptyTrash() });
  }
  activeNotes.slice(0, 20).forEach((n) => {
    const label = n.title || "Untitled";
    paletteItems.push({ id: "open-" + n.id, title: "Open: " + label, subtitle: "Note", run: () => openNote(n) });
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
          <button onClick={minimizeWindow} className="icon-btn win-ctrl" title="Minimize"><Minus size={16} /></button>
          <button onClick={closeWindow} className="icon-btn win-ctrl" title="Hide to tray"><X size={16} /></button>
        </div>
      </header>

      {graphOpen ? (
        <div className="graph-section">
          <div className="graph-header">
            <span>Graph{" (" + linkedCount + " linked)"}</span>
            <div className="graph-header-actions">
              <div className="graph-search-row">
                <Search size={12} className="search-icon" />
                <input
                  className="graph-search-input"
                  value={graphQuery}
                  onChange={(e) => setGraphQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setGraphQuery(""); } }}
                  placeholder="Search notes in graph..."
                  autoFocus
                />
              </div>
              <button className="small-btn trash-back-btn" onClick={() => { setGraphOpen(false); setGraphQuery(""); }} title="Back to notes">Back</button>
            </div>
          </div>
          <div className="graph-canvas">
            {activeNotes.length === 0 ? (
              <p className="graph-empty">No notes yet. Create a note and link it with [[double brackets]] to build your graph.</p>
            ) : (
              <svg viewBox="0 0 320 300" className="graph-svg">
                {graphEdges.map((e, i) => {
                  const a = nodePos.get(e.from);
                  const b = nodePos.get(e.to);
                  if (!a || !b) return null;
                  const dim = !!gq && (a.dimmed || b.dimmed);
                  return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="graph-edge" style={{ opacity: dim ? 0.06 : 0.5 }} />;
                })}
                {graphNodes.map((g) => (
                  <g key={g.id} className={"graph-node" + (g.dimmed ? " dimmed" : "") + (g.favorite ? " favorite" : "")} onClick={() => openNoteById(g.id)}>
                    <circle cx={g.x} cy={g.y} r={g.favorite ? 9 : 7} className="graph-node-dot" />
                    <text x={g.x} y={g.y + 18} textAnchor="middle" className="graph-node-label">{g.title.slice(0, 18)}</text>
                  </g>
                ))}
              </svg>
            )}
          </div>
          <div className="graph-legend">
            <span><span className="graph-legend-dot" /> note</span>
            <span><span className="graph-legend-dot favorite" /> favorite</span>
            <span className="graph-legend-hint">Click a node to open its note. Type [[ in a note to link notes.</span>
          </div>
        </div>
      ) : trashOpen ? (
        <div className="trash-section">
          <div className="trash-view-header">
            <span>Trash{trashCount > 0 ? " (" + trashCount + ")" : ""}</span>
            <div className="library-header-actions">
              {trashCount > 0 && <button className="small-btn trash-danger-btn" onClick={emptyTrash} title="Permanently delete everything in trash">Empty trash</button>}
              <button className="small-btn trash-back-btn" onClick={() => setTrashOpen(false)} title="Back to notes">Back</button>
            </div>
          </div>
          <div className="trash-list">
            {trashedFolders.map((f) => (
              <div key={f.id} className="trash-item">
                <Folder size={13} />
                <span className="trash-item-kind">Folder</span>
                <span className="trash-item-title">{f.name}</span>
                <button className="icon-btn" title="Restore folder and its notes" onClick={() => restoreFolder(f.id)}><Undo2 size={12} /></button>
                <button className="icon-btn delete-btn" title="Delete forever" onClick={() => purgeFolder(f.id)}><X size={12} /></button>
              </div>
            ))}
            {trashedNotes.map((n) => (
              <div key={n.id} className="trash-item">
                <Trash2 size={13} className="trash-item-icon" />
                <span className="trash-item-kind">Note</span>
                <span className="trash-item-title">{n.title || "Untitled"}</span>
                <button className="icon-btn" title="Restore note" onClick={() => restoreNote(n.id)}><Undo2 size={12} /></button>
                <button className="icon-btn delete-btn" title="Delete forever" onClick={() => purgeNote(n.id)}><X size={12} /></button>
              </div>
            ))}
            {trashedTasks.map((t) => (
              <div key={t.id} className="trash-item">
                <span className="trash-item-kind">Task</span>
                <span className="trash-item-title">{t.text}</span>
                <button className="icon-btn" title="Restore task" onClick={() => restoreTask(t.id)}><Undo2 size={12} /></button>
                <button className="icon-btn delete-btn" title="Delete forever" onClick={() => purgeTask(t.id)}><X size={12} /></button>
              </div>
            ))}
            {trashCount === 0 && <p className="trash-empty-hint">Trash is empty. Deleted notes, folders and tasks land here first.</p>}
          </div>
        </div>
      ) : (
      <>
      <div className="library-section">
        <div className="library-header">
          <span>Notes &amp; Folders</span>
          <div className="library-header-actions">
            <button onClick={() => { setQuickCaptureText(""); setQuickCaptureOpen(true); }} title="Quick capture (Ctrl+Shift+P)" className="icon-btn"><Zap size={14} /></button>
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
        {/* v0.1.10: the tag filter chip row is hidden (issue #24) — search
            still matches tags, and tags are managed via "/tags" in a note. */}
        {showNewFolder && (
          <div className="new-folder-row">
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFolder()} placeholder="Folder name..." autoFocus />
            <button onClick={createFolder} className="small-btn">Add</button>
            <button onClick={() => setShowNewFolder(false)} className="icon-btn"><X size={14} /></button>
          </div>
        )}
        <div className="folder-list">
          {activeFolders.map((folder) => {
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
                </div>
                {isExpanded && (
                  <div className="folder-notes">
                    {folderNotes.map((note) => {
                      const NoteIcon = getIcon(note.icon).Icon;
                      const due = note.reminderAt !== undefined && note.reminderAt <= Date.now();
                      return (
                        <div key={note.id} className="note-row" title="Right-click for options" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ type: "note", id: note.id, x: e.clientX, y: e.clientY }); }}>
                          <NoteIcon size={13} />
                          {renamingId === note.id ? (
                            <input className="rename-input" value={renameText} autoFocus onChange={(e) => setRenameText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameNote(note.id, renameText); if (e.key === "Escape") setRenamingId(null); }} onBlur={() => renameNote(note.id, renameText)} />
                          ) : (
                            <button className="note-open-btn" onClick={() => openNote(note)}>{note.title || "Untitled"}</button>
                          )}
                          {note.reminderAt !== undefined && (
                            <Clock size={11} className={"reminder-badge" + (due ? " due" : "")} />
                          )}
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
            const due = note.reminderAt !== undefined && note.reminderAt <= Date.now();
            return (
              <div key={note.id} className="note-row" title="Right-click for options" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ type: "note", id: note.id, x: e.clientX, y: e.clientY }); }}>
                <NoteIcon size={13} />
                {renamingId === note.id ? (
                  <input className="rename-input" value={renameText} autoFocus onChange={(e) => setRenameText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameNote(note.id, renameText); if (e.key === "Escape") setRenamingId(null); }} onBlur={() => renameNote(note.id, renameText)} />
                ) : (
                  <button className="note-open-btn" onClick={() => openNote(note)}>{note.title || "Untitled"}</button>
                )}
                {note.reminderAt !== undefined && (
                  <Clock size={11} className={"reminder-badge" + (due ? " due" : "")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="input-area">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="What are you focusing on?" />
      </div>
      <ul className="task-list">
        {activeTasks.map((task) => (
          <li key={task.id}>
            <label>
              <input type="checkbox" className="circle-checkbox" checked={false} onChange={() => markTaskDeleted(task.id)} />
              <span>{task.text}</span>
            </label>
            <button className="icon-btn delete-btn" onClick={() => markTaskDeleted(task.id)}><X size={14} /></button>
          </li>
        ))}
      </ul>
      </>
      )}

      {quickCaptureOpen && (
        <div className="capture-overlay" onClick={() => setQuickCaptureOpen(false)}>
          <div className="capture-box" onClick={(e) => e.stopPropagation()}>
            <div className="capture-header">
              <Zap size={13} className="capture-icon" />
              <span className="capture-title">Quick capture</span>
              <button className="icon-btn" title="Close (Esc)" onClick={() => setQuickCaptureOpen(false)}><X size={14} /></button>
            </div>
            <textarea
              className="capture-input"
              autoFocus
              value={quickCaptureText}
              onChange={(e) => setQuickCaptureText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); quickCaptureSave(); }
                if (e.key === "Escape") { e.preventDefault(); setQuickCaptureOpen(false); }
              }}
              placeholder="Type a thought... Enter to save, Shift+Enter for a new line"
              rows={3}
            />
            <div className="capture-footer">
              <span className="capture-hint">First line becomes the title</span>
              <button className="small-btn capture-save-btn" onClick={quickCaptureSave}>Save note</button>
            </div>
          </div>
        </div>
      )}

      {/* v0.1.18: web clipper overlay (issue #42) */}
      <WebClipOverlay
        open={clipOpen}
        onClose={() => setClipOpen(false)}
        onSave={(clip: WebClip) => saveClipNote(clip, "web")}
      />

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
            {contextMenu.type === "note" && (
              <button onClick={() => {
                const n = notes.find((x) => x.id === contextMenu.id);
                if (n) openNote(n);
              }}>Edit</button>
            )}
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
            {contextMenu.type === "note" && (
              <button onClick={() => toggleFavorite(contextMenu.id)}>{notes.find((x) => x.id === contextMenu.id)?.favorite ? "Remove favorite" : "Add favorite"}</button>
            )}
            <button className="danger" onClick={() => {
              if (contextMenu.type === "folder") deleteFolder(contextMenu.id);
              else deleteNoteFromList(contextMenu.id);
              setContextMenu(null);
            }}>Delete</button>
            {contextMenu.type === "note" && (() => {
              const n = notes.find((x) => x.id === contextMenu.id);
              return (
                <div className="context-menu-reminder">
                  <div className="context-menu-icons-title">Reminder</div>
                  <input
                    type="datetime-local"
                    className="reminder-input"
                    value={reminderDraft}
                    onChange={(e) => setReminderDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="reminder-actions">
                    <button className="small-btn reminder-set-btn" onClick={() => setReminderFor(contextMenu.id)}>Set</button>
                    {n?.reminderAt !== undefined && (
                      <button className="small-btn trash-back-btn" onClick={() => clearReminderFor(contextMenu.id)}>Clear</button>
                    )}
                  </div>
                  {n?.reminderAt !== undefined && (
                    <div className="reminder-when">{n.reminderAt <= Date.now() ? "Due / fired" : new Date(n.reminderAt).toLocaleString()}</div>
                  )}
                </div>
              );
            })()}
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
            {contextMenu.type === "note" && (
              <div className="context-menu-icons">
                <div className="context-menu-icons-title">Change color</div>
                <div className="context-color-grid">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      className={"color-option " + (notes.find((x) => x.id === contextMenu.id)?.color === c.id ? "active" : "")}
                      style={{ background: c.light }}
                      title={c.label}
                      onClick={() => setNoteColorFor(contextMenu.id, c.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {reminderToast && (
        <div className="reminder-toast">
          <Clock size={14} className="reminder-toast-icon" />
          <div className="reminder-toast-text">
            <strong>Reminder</strong>
            <span>{reminderToast.title}</span>
          </div>
          <button
            className="small-btn"
            onClick={() => {
              const n = notes.find((x) => x.id === reminderToast.id);
              setReminderToast(null);
              if (n) openNote(n);
            }}
          >Open</button>
          <button className="icon-btn" title="Dismiss" onClick={() => setReminderToast(null)}><X size={14} /></button>
        </div>
      )}

      {windowLabel === "main" && (
        <div className="stats-bar" title="Live library stats">
          <span title="Active notes">{activeNotes.length} {activeNotes.length === 1 ? "note" : "notes"}</span>
          <span title="Open tasks">{activeTasks.length} {activeTasks.length === 1 ? "task" : "tasks"}</span>
          <span title="Total words across active notes">{totalWords} {totalWords === 1 ? "word" : "words"}</span>
          <span title="Items in trash">{trashCount} in trash</span>
        </div>
      )}

      <div className="pomodoro-bar pomodoro-bottom">
        <div className="pomodoro-bottom-row">
          <span className="pomodoro-timer-sm">{formatTime(secondsLeft)}</span>
          {focusDone && focusDone.count > 0 && (
            <span className="focus-count" title="Focus sessions completed today">{focusDone.count}/4</span>
          )}
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


