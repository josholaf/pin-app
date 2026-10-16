import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Store } from "@tauri-apps/plugin-store";

type Task = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

type Theme = "light" | "dark";

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
};

function App() {
  const [windowLabel, setWindowLabel] = useState<string>("main");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [pinned, setPinned] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const [store, setStore] = useState<Store | null>(null);

  // Note-specific state (for note windows)
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);

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

      // Load note if this is a note window
      if (windowLabel.startsWith("note-") && noteId) {
        const notes = (await s.get<Note[]>("notes")) || [];
        const note = notes.find((n) => n.id === noteId);
        if (note) {
          setNoteTitle(note.title);
          setNoteContent(note.content);
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

  // Auto-save note content
  useEffect(() => {
    if (store && noteId && windowLabel.startsWith("note-")) {
      const saveNote = async () => {
        const notes = (await store.get<Note[]>("notes")) || [];
        const existingIndex = notes.findIndex((n) => n.id === noteId);

        const updatedNote: Note = {
          id: noteId,
          title: noteTitle || "Untitled",
          content: noteContent,
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
  }, [noteTitle, noteContent, noteId, store, windowLabel]);

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

  // ========== RENDER NOTE WINDOW ==========
  if (windowLabel.startsWith("note-")) {
    return (
      <div className="pin-window note-window" data-tauri-drag-region>
        <header className="titlebar" data-tauri-drag-region>
          <input
            className="note-title-input"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Note title..."
            data-tauri-drag-region
          />
          <div className="title-actions">
            <button onClick={toggleTheme} title="Toggle theme">
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button onClick={togglePin} title={pinned ? "Unpin" : "Pin"}>
              {pinned ? "📍" : "📌"}
            </button>
            <button onClick={closeWindow} title="Close">
              ×
            </button>
          </div>
        </header>

        <textarea
          className="note-content"
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Write your note here..."
          autoFocus
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
        <span>📌 Pin</span>
        <div className="title-actions">
          <button onClick={createNewNote} title="New Note">
            +
          </button>
          <button onClick={toggleTheme} title="Toggle theme">
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button onClick={togglePin} title={pinned ? "Unpin" : "Pin"}>
            {pinned ? "📍" : "📌"}
          </button>
        </div>
      </header>

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
                  className="delete-btn"
                  onClick={() => deleteTask(task.id)}
                >
                  ×
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
                  className="delete-btn"
                  onClick={() => deleteTask(task.id)}
                >
                  ×
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
