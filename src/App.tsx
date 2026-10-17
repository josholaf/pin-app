import { useState, useEffect, useRef, type ComponentType } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Store } from "@tauri-apps/plugin-store";
import {
  Pin, PinOff, Moon, Sun, Plus, X, Play, Pause, RotateCcw, StickyNote,
  PanelRight, PanelRightClose, ChevronDown, ChevronRight, FolderPlus,
  Book, Bookmark, Briefcase, Calendar, Camera, Check, CheckCircle, Clock,
  Code, Coffee, Compass, Cpu, Database, Feather, FileText, Film, Flag,
  Flame, Folder, Gift, Globe, GraduationCap, Heart, Home, Image, Inbox,
  Key, Lamp, Laptop, Layers, Leaf, Lightbulb, Link, List, Lock, Mail,
  Map, MapPin, MessageCircle, Mic, Monitor, Music, Package, Palette,
  Pencil, Phone, Plane, Rocket, Search, Settings, Shield, ShoppingBag,
  Smile, Star, Target, Terminal, Thermometer, Trash2, Trophy, Umbrella,
  User, Users, Video, Wallet, Wrench, Zap, type LucideProps,
} from "lucide-react";

type Task = { id: string; text: string; done: boolean; createdAt: number };
type Theme = "light" | "dark";
type NoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange";
type PomodoroMode = "focus" | "break";

type AppSettings = {
  fontSize: number;
  fontFamily: string;
  accentColor: string;
  alwaysOnTopDefault: boolean;
  stickToDesktop: boolean; // when true, notes do not force always-on-top (can go behind / stay with desktop)
};

type NoteFolder = { id: string; name: string; icon: string; createdAt: number };
type Note = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  icon: string;
  folderId: string | null;
  createdAt: number;
};

const NOTE_COLORS: { id: NoteColor; label: string; light: string; dark: string }[] = [
  { id: "yellow", label: "Yellow", light: "#fffde7", dark: "#3d3a1f" },
  { id: "pink", label: "Pink", light: "#fce4ec", dark: "#3d1f2a" },
  { id: "blue", label: "Blue", light: "#e3f2fd", dark: "#1f2a3d" },
  { id: "green", label: "Green", light: "#e8f5e9", dark: "#1f3d24" },
  { id: "purple", label: "Purple", light: "#f3e5f5", dark: "#2a1f3d" },
  { id: "orange", label: "Orange", light: "#fff3e0", dark: "#3d2a1f" },
];

const ICON_BANK: { id: string; Icon: ComponentType<LucideProps>; label: string }[] = [
  { id: "sticky-note", Icon: StickyNote, label: "Note" },
  { id: "folder", Icon: Folder, label: "Folder" },
  { id: "book", Icon: Book, label: "Book" },
  { id: "bookmark", Icon: Bookmark, label: "Bookmark" },
  { id: "briefcase", Icon: Briefcase, label: "Work" },
  { id: "calendar", Icon: Calendar, label: "Calendar" },
  { id: "camera", Icon: Camera, label: "Camera" },
  { id: "check", Icon: Check, label: "Check" },
  { id: "check-circle", Icon: CheckCircle, label: "Done" },
  { id: "clock", Icon: Clock, label: "Clock" },
  { id: "code", Icon: Code, label: "Code" },
  { id: "coffee", Icon: Coffee, label: "Coffee" },
  { id: "compass", Icon: Compass, label: "Compass" },
  { id: "cpu", Icon: Cpu, label: "CPU" },
  { id: "database", Icon: Database, label: "Database" },
  { id: "feather", Icon: Feather, label: "Write" },
  { id: "file-text", Icon: FileText, label: "Document" },
  { id: "film", Icon: Film, label: "Film" },
  { id: "flag", Icon: Flag, label: "Flag" },
  { id: "flame", Icon: Flame, label: "Flame" },
  { id: "gift", Icon: Gift, label: "Gift" },
  { id: "globe", Icon: Globe, label: "Globe" },
  { id: "graduation-cap", Icon: GraduationCap, label: "Study" },
  { id: "heart", Icon: Heart, label: "Heart" },
  { id: "home", Icon: Home, label: "Home" },
  { id: "image", Icon: Image, label: "Image" },
  { id: "inbox", Icon: Inbox, label: "Inbox" },
  { id: "key", Icon: Key, label: "Key" },
  { id: "lamp", Icon: Lamp, label: "Idea" },
  { id: "laptop", Icon: Laptop, label: "Laptop" },
  { id: "layers", Icon: Layers, label: "Layers" },
  { id: "leaf", Icon: Leaf, label: "Leaf" },
  { id: "lightbulb", Icon: Lightbulb, label: "Lightbulb" },
  { id: "link", Icon: Link, label: "Link" },
  { id: "list", Icon: List, label: "List" },
  { id: "lock", Icon: Lock, label: "Lock" },
  { id: "mail", Icon: Mail, label: "Mail" },
  { id: "map", Icon: Map, label: "Map" },
  { id: "map-pin", Icon: MapPin, label: "Location" },
  { id: "message-circle", Icon: MessageCircle, label: "Chat" },
  { id: "mic", Icon: Mic, label: "Mic" },
  { id: "monitor", Icon: Monitor, label: "Monitor" },
  { id: "music", Icon: Music, label: "Music" },
  { id: "package", Icon: Package, label: "Package" },
  { id: "palette", Icon: Palette, label: "Design" },
  { id: "pencil", Icon: Pencil, label: "Pencil" },
  { id: "phone", Icon: Phone, label: "Phone" },
  { id: "plane", Icon: Plane, label: "Travel" },
  { id: "rocket", Icon: Rocket, label: "Rocket" },
  { id: "search", Icon: Search, label: "Search" },
  { id: "settings", Icon: Settings, label: "Settings" },
  { id: "shield", Icon: Shield, label: "Shield" },
  { id: "shopping-bag", Icon: ShoppingBag, label: "Shopping" },
  { id: "smile", Icon: Smile, label: "Smile" },
  { id: "star", Icon: Star, label: "Star" },
  { id: "target", Icon: Target, label: "Target" },
  { id: "terminal", Icon: Terminal, label: "Terminal" },
  { id: "thermometer", Icon: Thermometer, label: "Health" },
  { id: "trash", Icon: Trash2, label: "Trash" },
  { id: "trophy", Icon: Trophy, label: "Trophy" },
  { id: "umbrella", Icon: Umbrella, label: "Umbrella" },
  { id: "user", Icon: User, label: "User" },
  { id: "users", Icon: Users, label: "Team" },
  { id: "video", Icon: Video, label: "Video" },
  { id: "wallet", Icon: Wallet, label: "Wallet" },
  { id: "wrench", Icon: Wrench, label: "Tools" },
  { id: "zap", Icon: Zap, label: "Energy" },
];

const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  accentColor: "#4caf50",
  alwaysOnTopDefault: true,
  stickToDesktop: false,
};

const FONT_OPTIONS = [
  {
    id: "system",
    label: "System",
    value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: "serif",
    label: "Serif",
    value: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "mono",
    label: "Monospace",
    value: '"SF Mono", "Cascadia Code", Consolas, monospace',
  },
  {
    id: "rounded",
    label: "Rounded",
    value: '"Segoe UI", system-ui, sans-serif',
  },
  {
    id: "casual",
    label: "Casual",
    value: '"Comic Sans MS", "Chalkboard SE", cursive',
  },
];

const ACCENT_OPTIONS = [
  "#4caf50",
  "#2196f3",
  "#ff9800",
  "#e91e63",
  "#9c27b0",
  "#00bcd4",
  "#f44336",
  "#795548",
];

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.value = 1320;
      gain2.gain.setValueAtTime(0.2, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.3);
    }, 200);
  } catch (e) {
    console.warn("Could not play sound:", e);
  }
}

function getIcon(iconId: string) {
  return ICON_BANK.find((i) => i.id === iconId) || ICON_BANK[0];
}

function App() {
  const [windowLabel, setWindowLabel] = useState("main");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [pinned, setPinned] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const [store, setStore] = useState<Store | null>(null);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [iconPickerFor, setIconPickerFor] = useState<
    { type: "folder" | "note"; id: string } | null
  >(null);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState<NoteColor>("yellow");
  const [noteIcon, setNoteIcon] = useState("sticky-note");
  const [noteFolderId, setNoteFolderId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconSidebar, setShowIconSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [streak, setStreak] = useState(0);
  const [lastActiveDate, setLastActiveDate] = useState<string | null>(null);

  // Pomodoro
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const justFinishedRef = useRef(false);

  const totalSeconds = pomodoroMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  useEffect(() => {
    async function detectWindow() {
      const win = getCurrentWindow();
      setWindowLabel(win.label);
      if (win.label.startsWith("note-")) {
        setNoteId(win.label.replace("note-", ""));
      }
    }
    detectWindow();
  }, []);

  useEffect(() => {
    async function init() {
      const s = await Store.load("pin-data.json");
      setStore(s);

      const savedTasks = await s.get<Task[]>("tasks");
      if (savedTasks) setTasks(savedTasks);

      const savedFolders = await s.get<NoteFolder[]>("folders");
      if (savedFolders) setFolders(savedFolders);

      const savedNotes = await s.get<Note[]>("notes");
      if (savedNotes) setNotes(savedNotes);

      const savedTheme = await s.get<Theme>("theme");
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }

      const savedSettings = await s.get<AppSettings>("settings");
      if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });

      const savedStreak = await s.get<number>("streak");
      if (typeof savedStreak === "number") setStreak(savedStreak);
      const savedLastActive = await s.get<string>("lastActiveDate");
      if (savedLastActive) setLastActiveDate(savedLastActive);

      if (windowLabel.startsWith("note-") && noteId) {
        const allNotes = (await s.get<Note[]>("notes")) || [];
        const note = allNotes.find((n) => n.id === noteId);
        if (note) {
          setNoteTitle(note.title);
          setNoteContent(note.content);
          setNoteColor(note.color || "yellow");
          setNoteIcon(note.icon || "sticky-note");
          setNoteFolderId(note.folderId ?? null);
        }
      }
    }
    init();
  }, [windowLabel, noteId]);

  useEffect(() => {
    if (store && windowLabel === "main") {
      store.set("tasks", tasks);
      store.set("folders", folders);
      store.set("notes", notes);
      store.save();
    }
  }, [tasks, folders, notes, store, windowLabel]);

  useEffect(() => {
    if (store) {
      store.set("theme", theme);
      store.save();
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, store]);

  useEffect(() => {
    if (store) {
      store.set("settings", settings);
      store.save();
    }
    document.documentElement.style.setProperty("--app-font-size", `${settings.fontSize}px`);
    document.documentElement.style.setProperty("--app-font-family", settings.fontFamily);
    document.documentElement.style.setProperty("--accent", settings.accentColor);
  }, [settings, store]);

  // Persist streak
  useEffect(() => {
    if (store && windowLabel === "main") {
      store.set("streak", streak);
      store.set("lastActiveDate", lastActiveDate);
      store.save();
    }
  }, [streak, lastActiveDate, store, windowLabel]);

  /** Call when user creates a note or writes content. Maintains daily streak. */
  const recordActivity = () => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (lastActiveDate === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (lastActiveDate === yesterdayStr) {
      setStreak((s) => s + 1);
    } else {
      setStreak(1);
    }
    setLastActiveDate(today);
  };

  useEffect(() => {
    if (store && noteId && windowLabel.startsWith("note-")) {
      const saveNote = async () => {
        const allNotes = (await store.get<Note[]>("notes")) || [];
        const idx = allNotes.findIndex((n) => n.id === noteId);
        const updated: Note = {
          id: noteId,
          title: noteTitle || "Untitled",
          content: noteContent,
          color: noteColor,
          icon: noteIcon,
          folderId: noteFolderId,
          createdAt: idx >= 0 ? allNotes[idx].createdAt : Date.now(),
        };
        if (idx >= 0) allNotes[idx] = updated;
        else allNotes.push(updated);
        await store.set("notes", allNotes);

        // Update streak when user writes content
        if (noteContent.trim().length > 0 || (noteTitle && noteTitle !== "Untitled")) {
          const today = new Date().toISOString().slice(0, 10);
          const savedLast = (await store.get<string>("lastActiveDate")) || null;
          if (savedLast !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().slice(0, 10);
            let newStreak = 1;
            if (savedLast === yesterdayStr) {
              const prev = (await store.get<number>("streak")) || 0;
              newStreak = prev + 1;
            }
            await store.set("streak", newStreak);
            await store.set("lastActiveDate", today);
          }
        }
        await store.save();
      };
      const t = setTimeout(saveNote, 400);
      return () => clearTimeout(t);
    }
  }, [noteTitle, noteContent, noteColor, noteIcon, noteFolderId, noteId, store, windowLabel]);

  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      timerRef.current = window.setInterval(() => setSecondsLeft((p) => p - 1), 1000);
    }
    if (secondsLeft === 0 && !justFinishedRef.current) {
      justFinishedRef.current = true;
      setIsRunning(false);
      playBeep();
      const nextMode: PomodoroMode = pomodoroMode === "focus" ? "break" : "focus";
      const nextSeconds = nextMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
      setTimeout(() => {
        setPomodoroMode(nextMode);
        setSecondsLeft(nextSeconds);
        setIsRunning(true);
        justFinishedRef.current = false;
      }, 800);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, secondsLeft, pomodoroMode]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const toggleTheme = () => setTheme((p) => (p === "light" ? "dark" : "light"));
  const togglePin = async () => {
    const win = getCurrentWindow();
    await win.setAlwaysOnTop(!pinned);
    setPinned(!pinned);
  };
  const closeWindow = async () => {
    await getCurrentWindow().close();
  };

  const createFolder = () => {
    const name = newFolderName.trim() || "New Folder";
    const folder: NoteFolder = {
      id: crypto.randomUUID(),
      name,
      icon: "folder",
      createdAt: Date.now(),
    };
    setFolders([...folders, folder]);
    setExpandedFolders(new Set([...expandedFolders, folder.id]));
    setNewFolderName("");
    setShowNewFolder(false);
  };

  const deleteFolder = (id: string) => {
    setFolders(folders.filter((f) => f.id !== id));
    setNotes(notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)));
  };

  const setFolderIcon = (folderId: string, iconId: string) => {
    setFolders(folders.map((f) => (f.id === folderId ? { ...f, icon: iconId } : f)));
    setIconPickerFor(null);
  };

  const setNoteIconInList = (id: string, iconId: string) => {
    setNotes(notes.map((n) => (n.id === id ? { ...n, icon: iconId } : n)));
    setIconPickerFor(null);
  };

  const createNoteInFolder = async (folderId: string | null) => {
    const id = crypto.randomUUID();
    const note: Note = {
      id,
      title: "Untitled",
      content: "",
      color: "yellow",
      icon: "sticky-note",
      folderId,
      createdAt: Date.now(),
    };
    setNotes([note, ...notes]);
    if (folderId) {
      setExpandedFolders(new Set([...expandedFolders, folderId]));
    }
    recordActivity();

    const label = `note-${id}`;
    const onTop = settings.alwaysOnTopDefault && !settings.stickToDesktop;
    new WebviewWindow(label, {
      title: "New Note",
      width: 340,
      height: 320,
      decorations: false,
      transparent: true,
      alwaysOnTop: onTop,
      center: false,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 150,
    });
  };

  const openNote = async (note: Note) => {
    const label = `note-${note.id}`;
    try {
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        await existing.setFocus();
        return;
      }
    } catch {
      /* create */
    }
    const onTop = settings.alwaysOnTopDefault && !settings.stickToDesktop;
    new WebviewWindow(label, {
      title: note.title || "Note",
      width: 340,
      height: 320,
      decorations: false,
      transparent: true,
      alwaysOnTop: onTop,
      center: false,
      x: 120 + Math.random() * 180,
      y: 120 + Math.random() * 120,
    });
  };

  const deleteNoteFromList = (id: string) => setNotes(notes.filter((n) => n.id !== id));

  const toggleFolder = (id: string) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const addTask = () => {
    const text = input.trim();
    if (!text) return;
    setTasks([{ id: crypto.randomUUID(), text, done: false, createdAt: Date.now() }, ...tasks]);
    setInput("");
  };

  const currentColor = NOTE_COLORS.find((c) => c.id === noteColor) || NOTE_COLORS[0];
  const bgColor = theme === "light" ? currentColor.light : currentColor.dark;
  const SelectedIcon = getIcon(noteIcon).Icon;

  if (windowLabel.startsWith("note-")) {
    return (
      <div
        className="pin-window note-window"
        data-tauri-drag-region
        style={{ background: bgColor, fontSize: settings.fontSize, fontFamily: settings.fontFamily }}
      >
        <div className="note-layout">
          <div className="note-main">
            <header className="titlebar" data-tauri-drag-region style={{ background: bgColor }}>
              <div className="note-title-row" data-tauri-drag-region>
                <SelectedIcon size={16} className="note-icon-display" />
                <input
                  className="note-title-input"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note title..."
                  data-tauri-drag-region
                />
              </div>
              <div className="title-actions">
                <div className="color-picker-wrapper">
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    title="Change color"
                    className="color-btn"
                    style={{ background: currentColor.light }}
                  />
                  {showColorPicker && (
                    <div className="color-picker">
                      {NOTE_COLORS.map((c) => (
                        <button
                          key={c.id}
                          className={`color-option ${noteColor === c.id ? "active" : ""}`}
                          style={{ background: c.light }}
                          title={c.label}
                          onClick={() => {
                            setNoteColor(c.id);
                            setShowColorPicker(false);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowIconSidebar(!showIconSidebar)}
                  title="Change icon"
                  className="icon-btn"
                >
                  {showIconSidebar ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
                </button>
                <button onClick={closeWindow} title="Close" className="icon-btn">
                  <X size={16} />
                </button>
              </div>
            </header>
            <textarea
              className="note-content"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your note..."
            />
          </div>
          {showIconSidebar && (
            <aside className="icon-sidebar">
              <div className="icon-sidebar-header">Icons</div>
              <div className="icon-grid">
                {ICON_BANK.map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    className={`icon-grid-item ${noteIcon === id ? "active" : ""}`}
                    title={label}
                    onClick={() => setNoteIcon(id)}
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    );
  }

  // ========== MAIN WINDOW ==========
  const activeTasks = tasks.filter((t) => !t.done);
  const completedTasks = tasks.filter((t) => t.done);
  const unfiledNotes = notes.filter((n) => !n.folderId);

  return (
    <div className="pin-window" data-tauri-drag-region style={{ fontSize: settings.fontSize, fontFamily: settings.fontFamily }}>
      <header className="titlebar" data-tauri-drag-region>
        <span className="app-title">
          <StickyNote size={16} /> Pin
        </span>
        <div className="title-actions">
          {streak > 0 && (
            <div className="streak-badge" title={`${streak} day streak — keep writing!`}>
              <Flame size={14} className="streak-flame" />
              <span className="streak-count">{streak}</span>
            </div>
          )}
          <button onClick={() => createNoteInFolder(null)} title="New Note" className="icon-btn">
            <Plus size={16} />
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            title="New Folder"
            className="icon-btn"
          >
            <FolderPlus size={16} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
            className="icon-btn"
          >
            <Settings size={16} />
          </button>
          <button onClick={toggleTheme} title="Theme" className="icon-btn">
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button onClick={togglePin} title={pinned ? "Unpin" : "Pin"} className="icon-btn">
            {pinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <span>Settings</span>
            <button className="icon-btn" onClick={() => setShowSettings(false)}>
              <X size={16} />
            </button>
          </div>

          <label className="settings-row">
            <span>Font size</span>
            <div className="settings-control">
              <input
                type="range"
                min={12}
                max={22}
                value={settings.fontSize}
                onChange={(e) =>
                  setSettings({ ...settings, fontSize: Number(e.target.value) })
                }
              />
              <span className="settings-value">{settings.fontSize}px</span>
            </div>
          </label>

          <label className="settings-row">
            <span>Font style</span>
            <select
              value={FONT_OPTIONS.find((f) => f.value === settings.fontFamily)?.id || "system"}
              onChange={(e) => {
                const opt = FONT_OPTIONS.find((f) => f.id === e.target.value);
                if (opt) setSettings({ ...settings, fontFamily: opt.value });
              }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div className="settings-row">
            <span>Accent color</span>
            <div className="accent-swatches">
              {ACCENT_OPTIONS.map((c) => (
                <button
                  key={c}
                  className={`accent-swatch ${settings.accentColor === c ? "active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setSettings({ ...settings, accentColor: c })}
                  title={c}
                />
              ))}
            </div>
          </div>

          <label className="settings-row toggle-row">
            <span>Keep notes over other windows</span>
            <input
              type="checkbox"
              checked={settings.alwaysOnTopDefault && !settings.stickToDesktop}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  alwaysOnTopDefault: e.target.checked,
                  stickToDesktop: e.target.checked ? false : settings.stickToDesktop,
                })
              }
            />
          </label>

          <label className="settings-row toggle-row">
            <span>Stay on desktop (home layer)</span>
            <input
              type="checkbox"
              checked={settings.stickToDesktop}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  stickToDesktop: e.target.checked,
                  alwaysOnTopDefault: e.target.checked ? false : settings.alwaysOnTopDefault,
                })
              }
            />
          </label>
          <p className="settings-hint">
            Desktop mode turns off always-on-top so notes can sit behind apps like sticky notes on the home screen.
          </p>
        </div>
      )}

      <div className="pomodoro-bar">
        <div className="pomodoro-modes">
          <button
            className={pomodoroMode === "focus" ? "active" : ""}
            onClick={() => {
              setIsRunning(false);
              justFinishedRef.current = false;
              setPomodoroMode("focus");
              setSecondsLeft(FOCUS_SECONDS);
            }}
          >
            Focus 25
          </button>
          <button
            className={pomodoroMode === "break" ? "active" : ""}
            onClick={() => {
              setIsRunning(false);
              justFinishedRef.current = false;
              setPomodoroMode("break");
              setSecondsLeft(BREAK_SECONDS);
            }}
          >
            Break 5
          </button>
        </div>
        <div className="pomodoro-timer">{formatTime(secondsLeft)}</div>
        <div className="pomodoro-progress-track">
          <div className="pomodoro-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="pomodoro-controls">
          {!isRunning ? (
            <button className="pomodoro-btn start" onClick={() => setIsRunning(true)}>
              <Play size={14} /> Start
            </button>
          ) : (
            <button className="pomodoro-btn pause" onClick={() => setIsRunning(false)}>
              <Pause size={14} /> Pause
            </button>
          )}
          <button
            className="pomodoro-btn reset"
            onClick={() => {
              setIsRunning(false);
              justFinishedRef.current = false;
              setSecondsLeft(pomodoroMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      <div className="library-section">
        <div className="library-header">
          <span>Notes & Folders</span>
        </div>

        {showNewFolder && (
          <div className="new-folder-row">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createFolder()}
              placeholder="Folder name..."
              autoFocus
            />
            <button className="small-btn" onClick={createFolder}>Create</button>
            <button className="icon-btn" onClick={() => setShowNewFolder(false)}><X size={14} /></button>
          </div>
        )}

        <div className="folder-list">
          {folders.map((folder) => {
            const FolderIcon = getIcon(folder.icon).Icon;
            const folderNotes = notes.filter((n) => n.folderId === folder.id);
            const isExpanded = expandedFolders.has(folder.id);
            return (
              <div key={folder.id} className="folder-block">
                <div className="folder-row">
                  <button className="icon-btn expand-btn" onClick={() => toggleFolder(folder.id)}>
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <button
                    className="icon-btn folder-icon-btn"
                    onClick={() => setIconPickerFor({ type: "folder", id: folder.id })}
                    title="Change folder icon"
                  >
                    <FolderIcon size={14} />
                  </button>
                  <span className="folder-name">{folder.name}</span>
                  <span className="folder-count">{folderNotes.length}</span>
                  <button className="icon-btn" onClick={() => createNoteInFolder(folder.id)} title="New note in folder">
                    <Plus size={14} />
                  </button>
                  <button className="icon-btn delete-btn" onClick={() => deleteFolder(folder.id)} title="Delete folder">
                    <Trash2 size={14} />
                  </button>
                </div>
                {iconPickerFor?.type === "folder" && iconPickerFor.id === folder.id && (
                  <div className="inline-icon-picker">
                    {ICON_BANK.map(({ id, Icon, label }) => (
                      <button
                        key={id}
                        className={`icon-grid-item ${folder.icon === id ? "active" : ""}`}
                        title={label}
                        onClick={() => setFolderIcon(folder.id, id)}
                      >
                        <Icon size={16} />
                      </button>
                    ))}
                  </div>
                )}
                {isExpanded && (
                  <div className="folder-notes">
                    {folderNotes.length === 0 && <div className="empty-hint">No notes yet</div>}
                    {folderNotes.map((note) => {
                      const NoteIcon = getIcon(note.icon).Icon;
                      return (
                        <div key={note.id} className="note-row">
                          <button
                            className="icon-btn"
                            onClick={() => setIconPickerFor({ type: "note", id: note.id })}
                            title="Change note icon"
                          >
                            <NoteIcon size={13} />
                          </button>
                          <button className="note-open-btn" onClick={() => openNote(note)}>
                            {note.title || "Untitled"}
                          </button>
                          <button className="icon-btn delete-btn" onClick={() => deleteNoteFromList(note.id)}>
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                    {iconPickerFor?.type === "note" && folderNotes.some((n) => n.id === iconPickerFor.id) && (
                      <div className="inline-icon-picker">
                        {ICON_BANK.map(({ id, Icon, label }) => (
                          <button
                            key={id}
                            className={`icon-grid-item ${notes.find((n) => n.id === iconPickerFor.id)?.icon === id ? "active" : ""}`}
                            title={label}
                            onClick={() => setNoteIconInList(iconPickerFor.id, id)}
                          >
                            <Icon size={16} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="folder-row unfiled">
            <span className="folder-name">Unfiled</span>
            <span className="folder-count">{unfiledNotes.length}</span>
            <button className="icon-btn" onClick={() => createNoteInFolder(null)} title="New unfiled note">
              <Plus size={14} />
            </button>
          </div>
          {unfiledNotes.map((note) => {
            const NoteIcon = getIcon(note.icon).Icon;
            return (
              <div key={note.id} className="note-row">
                <button
                  className="icon-btn"
                  onClick={() => setIconPickerFor({ type: "note", id: note.id })}
                  title="Change note icon"
                >
                  <NoteIcon size={13} />
                </button>
                <button className="note-open-btn" onClick={() => openNote(note)}>
                  {note.title || "Untitled"}
                </button>
                <button className="icon-btn delete-btn" onClick={() => deleteNoteFromList(note.id)}>
                  <X size={12} />
                </button>
              </div>
            );
          })}
          {iconPickerFor?.type === "note" && unfiledNotes.some((n) => n.id === iconPickerFor.id) && (
            <div className="inline-icon-picker">
              {ICON_BANK.map(({ id, Icon, label }) => (
                <button
                  key={id}
                  className={`icon-grid-item ${notes.find((n) => n.id === iconPickerFor.id)?.icon === id ? "active" : ""}`}
                  title={label}
                  onClick={() => setNoteIconInList(iconPickerFor.id, id)}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="Add a task..."
        />
      </div>

      <ul className="task-list">
        {activeTasks.map((task) => (
          <li key={task.id}>
            {editingId === task.id ? (
              <input
                className="edit-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, text: editText } : t)));
                    setEditingId(null);
                  }
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={() => {
                  setTasks(tasks.map((t) => (t.id === task.id ? { ...t, text: editText } : t)));
                  setEditingId(null);
                }}
                autoFocus
              />
            ) : (
              <label>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() =>
                    setTasks(tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))
                  }
                />
                <span onDoubleClick={() => { setEditingId(task.id); setEditText(task.text); }}>
                  {task.text}
                </span>
              </label>
            )}
            <button className="icon-btn delete-btn" onClick={() => setTasks(tasks.filter((t) => t.id !== task.id))}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>

      {completedTasks.length > 0 && (
        <div className="completed-section">
          <div className="completed-header">
            <span>Completed ({completedTasks.length})</span>
            <button onClick={() => setTasks(tasks.filter((t) => !t.done))}>Clear</button>
          </div>
          <ul className="task-list">
            {completedTasks.map((task) => (
              <li key={task.id} className="done">
                <label>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() =>
                      setTasks(tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))
                    }
                  />
                  <span>{task.text}</span>
                </label>
                <button className="icon-btn delete-btn" onClick={() => setTasks(tasks.filter((t) => t.id !== task.id))}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
