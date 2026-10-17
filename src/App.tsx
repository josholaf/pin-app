import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Store } from "@tauri-apps/plugin-store";
import {
  Pin, Moon, Sun, Plus, X, Play, Pause, RotateCcw,
  ChevronDown, ChevronRight, FolderPlus, Flame, Folder, FolderOpen,
  Coffee, Settings,
} from "lucide-react";
import {
  DEFAULT_SETTINGS,
  FOCUS_SECONDS, BREAK_SECONDS, playBeep, getIcon,
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

function App() {
  const [windowLabel, setWindowLabel] = useState("main");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [store, setStore] = useState<Store | null>(null);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ type: "folder" | "note"; id: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState<NoteColor>("yellow");
  const [noteIcon, setNoteIcon] = useState("sticky-note");
  const [noteFolderId, setNoteFolderId] = useState<string | null>(null);
  const [noteFormat, setNoteFormat] = useState<"md" | "txt">("md");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconSidebar, setShowIconSidebar] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [streak, setStreak] = useState(0);
  const [lastActiveDate, setLastActiveDate] = useState<string | null>(null);
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const justFinishedRef = useRef(false);
  const totalSeconds = pomodoroMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  useEffect(() => {
    (async () => {
      const win = getCurrentWindow();
      setWindowLabel(win.label);
      if (win.label.startsWith("note-")) setNoteId(win.label.replace("note-", ""));
    })();
  }, []);

  // Init store + migrate legacy whole-array notes to per-note keys
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
      if (th) { setTheme(th); document.documentElement.setAttribute("data-theme", th); }
      const st = await s.get<AppSettings>("settings"); if (st) setSettings({ ...DEFAULT_SETTINGS, ...st });
      const sk = await s.get<number>("streak"); if (typeof sk === "number") setStreak(sk);
      const la = await s.get<string>("lastActiveDate"); if (la) setLastActiveDate(la);

      if (windowLabel === "main") {
        setNotes(await loadNotes(s));
      }
      if (windowLabel.startsWith("note-") && noteId) {
        let note = await s.get<Note>(noteKey(noteId));
        if (!note) {
          const all = await loadNotes(s);
          note = all.find((x) => x.id === noteId) ?? undefined;
        }
        if (note) {
          setNoteTitle(note.title); setNoteContent(note.content);
          setNoteColor(note.color || "yellow"); setNoteIcon(note.icon || "sticky-note");
          setNoteFolderId(note.folderId ?? null); setNoteFormat(note.format || "md");
        }
      }
    })();
  }, [windowLabel, noteId]);

  // Main window: persist tasks + folders (notes are per-key, see below)
  useEffect(() => {
    if (store && windowLabel === "main") {
      store.set("tasks", tasks);
      store.set("folders", folders);
      store.save();
    }
  }, [tasks, folders, store, windowLabel]);

  // Main window: live-refresh notes from disk so edits made in note windows
  // (content, title, icon, color) appear immediately in the folder tree.
  useEffect(() => {
    if (!store || windowLabel !== "main") return;
    let stopped = false;
    const tick = async () => {
      const fresh = await loadNotes(store);
      if (stopped) return;
      setNotes((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { stopped = true; clearInterval(id); };
  }, [store, windowLabel]);

  useEffect(() => {
    if (store) { store.set("theme", theme); store.save(); }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, store]);

  useEffect(() => {
    if (store) { store.set("settings", settings); store.save(); }
    document.documentElement.style.setProperty("--app-font-size", `${settings.fontSize}px`);
    document.documentElement.style.setProperty("--app-font-family", settings.fontFamily);
    document.documentElement.style.setProperty("--accent", settings.accentColor);
  }, [settings, store]);

  // All windows: poll for settings/theme changes made in any other window
  // so font, accent and theme apply live across the whole app.
  useEffect(() => {
    if (!store) return;
    const id = setInterval(async () => {
      const st = await store.get<AppSettings>("settings");
      if (st) setSettings((prev) => (JSON.stringify(prev) === JSON.stringify({ ...DEFAULT_SETTINGS, ...st }) ? prev : { ...DEFAULT_SETTINGS, ...st }));
      const th = await store.get<Theme>("theme");
      if (th && th !== theme) setTheme(th);
    }, 500);
    return () => clearInterval(id);
  }, [store, theme]);

  useEffect(() => {
    if (store && windowLabel === "main") {
      store.set("streak", streak); store.set("lastActiveDate", lastActiveDate); store.save();
    }
  }, [streak, lastActiveDate, store, windowLabel]);

  const recordActivity = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (lastActiveDate === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (lastActiveDate === y.toISOString().slice(0, 10)) setStreak((s) => s + 1);
    else setStreak(1);
    setLastActiveDate(today);
  };

  // Note window: automatic debounced save of THIS note only (single source of
  // truth per note-key; no whole-array read-modify-write, so windows can't
  // clobber each other's saves).
  useEffect(() => {
    if (!store || !noteId || !windowLabel.startsWith("note-")) return;
    const t = setTimeout(async () => {
      const existing = await store.get<Note>(noteKey(noteId));
      const updated: Note = {
        id: noteId,
        title: noteTitle || "Untitled",
        content: noteContent,
        color: noteColor,
        icon: noteIcon,
        folderId: noteFolderId,
        createdAt: existing?.createdAt ?? Date.now(),
        format: noteFormat,
      };
      await store.set(noteKey(noteId), updated);
      const ids = (await store.get<string[]>("noteIds")) || [];
      if (!ids.includes(noteId)) { ids.unshift(noteId); await store.set("noteIds", ids); }
      const today = new Date().toISOString().slice(0, 10);
      const savedLast = await store.get<string>("lastActiveDate");
      if ((noteContent.trim() || noteTitle.trim()) && savedLast !== today) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        const prev = (await store.get<number>("streak")) || 0;
        await store.set("streak", savedLast === y.toISOString().slice(0, 10) ? prev + 1 : 1);
        await store.set("lastActiveDate", today);
      }
      await store.save();
    }, 400);
    return () => clearTimeout(t);
  }, [noteTitle, noteContent, noteColor, noteIcon, noteFolderId, noteFormat, noteId, store, windowLabel]);

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
    `${Math.floor(secs / 60).toString().padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;
  const toggleTheme = () => setTheme((p) => (p === "light" ? "dark" : "light"));
  const closeWindow = async () => { await getCurrentWindow().close(); };

  const openSettingsWindow = async () => {
    const existing = await WebviewWindow.getByLabel("settings");
    if (existing) { await existing.setFocus(); return; }
    new WebviewWindow("settings", {
      title: "Settings", width: 320, height: 360,
      decorations: false, transparent: true, alwaysOnTop: true, center: true, resizable: false,
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
  const startRename = (_type: "folder" | "note", id: string, current: string) => {
    setRenamingId(id); setRenameText(current); setContextMenu(null);
  };
  const createNoteInFolder = (folderId: string | null) => {
    const id = crypto.randomUUID();
    const note: Note = { id, title: "Untitled", content: "", color: "yellow", icon: "sticky-note", folderId, createdAt: Date.now(), format: "md" };
    setNotes([note, ...notes]);
    if (folderId) setExpandedFolders(new Set([...expandedFolders, folderId]));
    persistNote(note);
    recordActivity();
    const onTop = settings.alwaysOnTopDefault && !settings.stickToDesktop;
    new WebviewWindow(`note-${id}`, { title: "New Note", width: 340, height: 400, decorations: false, transparent: true, alwaysOnTop: onTop });
  };
  const openNote = (note: Note) => {
    const onTop = settings.alwaysOnTopDefault && !settings.stickToDesktop;
    new WebviewWindow(`note-${note.id}`, { title: note.title || "Note", width: 340, height: 400, decorations: false, transparent: true, alwaysOnTop: onTop });
  };
  const deleteNoteFromList = (id: string) => {
    setNotes(notes.filter((n) => n.id !== id));
    removeNotePersist(id);
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

  const unfiledNotes = notes.filter((n) => !n.folderId);
  const activeTasks = tasks.filter((t) => !t.done);

  if (windowLabel === "settings") {
    return (
      <SettingsWindow
        theme={theme}
        settings={settings}
        setSettings={setSettings}
        toggleTheme={toggleTheme}
        closeWindow={closeWindow}
      />
    );
  }

  if (windowLabel.startsWith("note-")) {
    return (
      <MarkdownNote
        theme={theme}
        settings={settings}
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
        showColorPicker={showColorPicker}
        setShowColorPicker={setShowColorPicker}
        showIconSidebar={showIconSidebar}
        setShowIconSidebar={setShowIconSidebar}
        toggleTheme={toggleTheme}
        closeWindow={closeWindow}
      />
    );
  }

  return (
    <div className="pin-window" data-tauri-drag-region style={{ fontSize: settings.fontSize, fontFamily: settings.fontFamily }}>
      <header className="titlebar" data-tauri-drag-region>
        <span className="app-title"><Pin size={16} /> Pin</span>
        <div className="title-actions">
          {streak > 0 && (
            <div className="streak-badge" title={`${streak} day streak`}>
              <Flame size={14} className="streak-flame" />
              <span className="streak-count">{streak}</span>
            </div>
          )}
          <button onClick={openSettingsWindow} className="icon-btn" title="Settings"><Settings size={16} /></button>
          <button onClick={toggleTheme} className="icon-btn" title="Theme">{theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
        </div>
      </header>

      <div className="library-section">
        <div className="library-header">
          <span>Notes & Folders</span>
          <div className="library-header-actions">
            <button onClick={() => createNoteInFolder(null)} title="New Note" className="icon-btn"><Plus size={14} /></button>
            <button onClick={() => setShowNewFolder(true)} title="New Folder" className="icon-btn"><FolderPlus size={14} /></button>
          </div>
        </div>
        {showNewFolder && (
          <div className="new-folder-row">
            <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFolder()} placeholder="Folder name..." autoFocus />
            <button onClick={createFolder} className="small-btn">Add</button>
            <button onClick={() => setShowNewFolder(false)} className="icon-btn"><X size={14} /></button>
          </div>
        )}
        <div className="folder-list">
          {folders.map((folder) => {
            const folderNotes = notes.filter((n) => n.folderId === folder.id);
            const isExpanded = expandedFolders.has(folder.id);
            const FolderIcon = isExpanded ? FolderOpen : Folder;
            return (
              <div key={folder.id} className="folder-block">
                <div className="folder-row" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ type: "folder", id: folder.id, x: e.clientX, y: e.clientY }); }}>
                  <button className="icon-btn expand-btn" onClick={() => toggleFolder(folder.id)}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
                  <FolderIcon size={14} />
                  {renamingId === folder.id ? (
                    <input className="rename-input" value={renameText} autoFocus onChange={(e) => setRenameText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameFolder(folder.id, renameText); if (e.key === "Escape") setRenamingId(null); }} onBlur={() => renameFolder(folder.id, renameText)} />
                  ) : (
                    <span className="folder-name" onDoubleClick={() => startRename("folder", folder.id, folder.name)}>{folder.name}</span>
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
                            <button className="note-open-btn" onClick={() => openNote(note)} onDoubleClick={() => startRename("note", note.id, note.title)}>{note.title || "Untitled"}</button>
                          )}
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
                <button className="note-open-btn" onClick={() => openNote(note)} onDoubleClick={() => startRename("note", note.id, note.title)}>{note.title || "Untitled"}</button>
                <button className="icon-btn delete-btn" onClick={() => deleteNoteFromList(note.id)}><X size={12} /></button>
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
              <input type="checkbox" className="circle-checkbox" checked={false} onChange={() => setTasks(tasks.filter((t) => t.id !== task.id))} />
              <span>{task.text}</span>
            </label>
            <button className="icon-btn delete-btn" onClick={() => setTasks(tasks.filter((t) => t.id !== task.id))}><X size={14} /></button>
          </li>
        ))}
      </ul>

      {contextMenu && (
        <div className="context-menu-overlay" onClick={() => setContextMenu(null)}>
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => {
              if (contextMenu.type === "folder") {
                const f = folders.find((x) => x.id === contextMenu.id);
                if (f) startRename("folder", f.id, f.name);
              } else {
                const n = notes.find((x) => x.id === contextMenu.id);
                if (n) startRename("note", n.id, n.title);
              }
            }}>Rename</button>
            {contextMenu.type === "folder" && <button onClick={() => { createNoteInFolder(contextMenu.id); setContextMenu(null); }}>New note</button>}
            <button className="danger" onClick={() => {
              if (contextMenu.type === "folder") deleteFolder(contextMenu.id);
              else deleteNoteFromList(contextMenu.id);
              setContextMenu(null);
            }}>Delete</button>
          </div>
        </div>
      )}

      <div className="pomodoro-bar pomodoro-bottom">
        <div className="pomodoro-bottom-row">
          <span className="pomodoro-timer-sm">{formatTime(secondsLeft)}</span>
          <div className="pomodoro-progress-track pomodoro-progress-sm">
            <div className="pomodoro-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="pomodoro-controls-sm">
            <button onClick={() => { setIsRunning(false); setSecondsLeft(pomodoroMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS); }} className="icon-btn" title="Reset"><RotateCcw size={16} /></button>
            <button onClick={() => { setIsRunning(false); setPomodoroMode("break"); setSecondsLeft(BREAK_SECONDS); }} className={`icon-btn ${pomodoroMode === "break" ? "active-mode" : ""}`} title="Break"><Coffee size={16} /></button>
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
