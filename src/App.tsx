import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Store } from "@tauri-apps/plugin-store";
import {
  Pin,
  PinOff,
  Moon,
  Sun,
  Plus,
  X,
  Play,
  Pause,
  RotateCcw,
  StickyNote,
} from "lucide-react";

type Task = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

type Theme = "light" | "dark";

type NoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange";

type Note = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  createdAt: number;
};

type PomodoroMode = "focus" | "break";

const NOTE_COLORS: { id: NoteColor; label: string; light: string; dark: string }[] = [
  { id: "yellow", label: "Yellow", light: "#fffde7", dark: "#3d3a1f" },
  { id: "pink", label: "Pink", light: "#fce4ec", dark: "#3d1f2a" },
  { id: "blue", label: "Blue", light: "#e3f2fd", dark: "#1f2a3d" },
  { id: "green", label: "Green", light: "#e8f5e9", dark: "#1f3d24" },
  { id: "purple", label: "Purple", light: "#f3e5f5", dark: "#2a1f3d" },
  { id: "orange", label: "Orange", light: "#fff3e0", dark: "#3d2a1f" },
];

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

/** Play a short pleasant beep using Web Audio API */
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

function App() {
  const [windowLabel, setWindowLabel] = useState<string>("main");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [pinned, setPinned] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const [store, setStore] = useState<Store | null>(null);

  // Note-specific state
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState<NoteColor>("yellow");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Pomodoro state
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const justFinishedRef = useRef(false);

  const totalSeconds = pomodoroMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  // Detect current window label
  useEffect(() => {
    async function detectWindow() {
      const win = getCurrentWindow();
      const label = win.label;
      setWindowLabel(label);

      if (label.startsWith("note-")) {
        const id = label.replace("note-", "");
        setNoteId(id);
      }
    }
    detectWindow();
  }, []);

  // Initialize store + load data
  useEffect(() => {
    async function init() {
      const s = await Store.load("pin-data.json");
      setStore(s);

      const savedTasks = await s.get<Task[]>("tasks");
      if (savedTasks) setTasks(savedTasks);

      const savedTheme = await s.get<Theme>("theme");
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.setAttribute("data-theme", savedTheme);
      }

      if (windowLabel.startsWith("note-") && noteId) {
        const notes = (await s.get<Note[]>("notes")) || [];
        const note = notes.find((n) => n.id === noteId);
        if (note) {
          setNoteTitle(note.title);
          setNoteContent(note.content);
          setNoteColor(note.color || "yellow");
        }
      }
    }
    init();
  }, [windowLabel, noteId]);

  // Save tasks
  useEffect(() => {
    if (store && windowLabel === "main") {
      store.set("tasks", tasks);
      store.save();
    }
  }, [tasks, store, windowLabel]);

  // Save theme
  useEffect(() => {
    if (store) {
      store.set("theme", theme);
      store.save();
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, store]);

  // Auto-save note
  useEffect(() => {
    if (store && noteId && windowLabel.startsWith("note-")) {
      const saveNote = async () => {
        const notes = (await store.get<Note[]>("notes")) || [];
        const existingIndex = notes.findIndex((n) => n.id === noteId);

        const updatedNote: Note = {
          id: noteId,
          title: noteTitle || "Untitled",
          content: noteContent,
          color: noteColor,
          createdAt: existingIndex >= 0 ? notes[existingIndex].createdAt : Date.now(),
        };

        if (existingIndex >= 0) {
          notes[existingIndex] = updatedNote;
        } else {
          notes.push(updatedNote);
        }

        await store.set("notes", notes);
        await store.save();
      };

      const timeout = setTimeout(saveNote, 400);
      return () => clearTimeout(timeout);
    }
  }, [noteTitle, noteContent, noteColor, noteId, store, windowLabel]);

  // Pomodoro timer logic + auto-switch + sound
  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, secondsLeft, pomodoroMode]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startPomodoro = () => setIsRunning(true);
  const pausePomodoro = () => setIsRunning(false);

  const resetPomodoro = () => {
    setIsRunning(false);
    justFinishedRef.current = false;
    setSecondsLeft(pomodoroMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  };

  const switchMode = (mode: PomodoroMode) => {
    setIsRunning(false);
    justFinishedRef.current = false;
    setPomodoroMode(mode);
    setSecondsLeft(mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const togglePin = async () => {
    const win = getCurrentWindow();
    await win.setAlwaysOnTop(!pinned);
    setPinned(!pinned);
  };

  const closeWindow = async () => {
    const win = getCurrentWindow();
    await win.close();
  };

  // ========== MAIN WINDOW FUNCTIONS ==========
  const addTask = () => {
    const text = input.trim();
    if (!text) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      text,
      done: false,
      createdAt: Date.now(),
    };

    setTasks([newTask, ...tasks]);
    setInput("");
  };

  const toggleDone = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditText(task.text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const text = editText.trim();
    if (!text) return;

    setTasks(tasks.map((t) => (t.id === editingId ? { ...t, text } : t)));
    setEditingId(null);
    setEditText("");
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const clearCompleted = () => {
    setTasks(tasks.filter((t) => !t.done));
  };

  const createNewNote = async () => {
    const id = crypto.randomUUID();
    const label = `note-${id}`;

    const newWindow = new WebviewWindow(label, {
      title: "New Note",
      width: 300,
      height: 280,
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      center: false,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 150,
    });

    newWindow.once("tauri://created", () => {
      console.log("Note window created:", label);
    });

    newWindow.once("tauri://error", (e) => {
      console.error("Failed to create note window:", e);
    });
  };

  const currentColor = NOTE_COLORS.find((c) => c.id === noteColor) || NOTE_COLORS[0];
  const bgColor = theme === "light" ? currentColor.light : currentColor.dark;

  // ========== RENDER NOTE WINDOW ==========
  if (windowLabel.startsWith("note-")) {
    return (
      <div
        className="pin-window note-window"
        data-tauri-drag-region
        style={{ background: bgColor }}
      >
        <header className="titlebar" data-tauri-drag-region style={{ background: bgColor }}>
          <input
            className="note-title-input"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Note title..."
            data-tauri-drag-region
          />
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
            <button onClick={toggleTheme} title="Toggle theme" className="icon-btn">
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button onClick={togglePin} title={pinned ? "Unpin" : "Pin"} className="icon-btn">
              {pinned ? <Pin size={16} /> : <PinOff size={16} />}
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
          placeholder="Write your note here..."
          autoFocus
          style={{ background: "transparent" }}
        />
      </div>
    );
  }

  // ========== RENDER MAIN WINDOW ==========
  const activeTasks = tasks.filter((t) => !t.done);
  const completedTasks = tasks.filter((t) => t.done);

  return (
    <div className="pin-window" data-tauri-drag-region>
      <header className="titlebar" data-tauri-drag-region>
        <span className="app-title">
          <StickyNote size={16} />
          Pin
        </span>
        <div className="title-actions">
          <button onClick={createNewNote} title="New Note" className="icon-btn">
            <Plus size={16} />
          </button>
          <button onClick={toggleTheme} title="Toggle theme" className="icon-btn">
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button onClick={togglePin} title={pinned ? "Unpin" : "Pin"} className="icon-btn">
            {pinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
        </div>
      </header>

      {/* Pomodoro Bar */}
      <div className="pomodoro-bar">
        <div className="pomodoro-modes">
          <button
            className={pomodoroMode === "focus" ? "active" : ""}
            onClick={() => switchMode("focus")}
          >
            Focus 25
          </button>
          <button
            className={pomodoroMode === "break" ? "active" : ""}
            onClick={() => switchMode("break")}
          >
            Break 5
          </button>
        </div>

        <div className="pomodoro-timer">{formatTime(secondsLeft)}</div>

        <div className="pomodoro-progress-track">
          <div
            className="pomodoro-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="pomodoro-controls">
          {!isRunning ? (
            <button onClick={startPomodoro} className="pomodoro-btn start">
              <Play size={14} />
              Start
            </button>
          ) : (
            <button onClick={pausePomodoro} className="pomodoro-btn pause">
              <Pause size={14} />
              Pause
            </button>
          )}
          <button onClick={resetPomodoro} className="pomodoro-btn reset">
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="What are you focusing on?"
          autoFocus
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
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onBlur={saveEdit}
                autoFocus
              />
            ) : (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleDone(task.id)}
                  />
                  <span onDoubleClick={() => startEditing(task)}>
                    {task.text}
                  </span>
                </label>
                <button
                  className="delete-btn icon-btn"
                  onClick={() => deleteTask(task.id)}
                  title="Delete"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {completedTasks.length > 0 && (
        <div className="completed-section">
          <div className="completed-header">
            <span>Completed ({completedTasks.length})</span>
            <button onClick={clearCompleted}>Clear</button>
          </div>
          <ul className="task-list completed">
            {completedTasks.map((task) => (
              <li key={task.id} className="done">
                <label>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleDone(task.id)}
                  />
                  <span>{task.text}</span>
                </label>
                <button
                  className="delete-btn icon-btn"
                  onClick={() => deleteTask(task.id)}
                  title="Delete"
                >
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
