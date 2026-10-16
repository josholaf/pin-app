import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Store } from "@tauri-apps/plugin-store";

type Task = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

type Theme = "light" | "dark";

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [pinned, setPinned] = useState(true);
  const [theme, setTheme] = useState<Theme>("light");
  const [store, setStore] = useState<Store | null>(null);

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
    }
    init();
  }, []);

  // Save tasks
  useEffect(() => {
    if (store) {
      store.set("tasks", tasks);
      store.save();
    }
  }, [tasks, store]);

  // Save theme
  useEffect(() => {
    if (store) {
      store.set("theme", theme);
      store.save();
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, store]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

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
    setTasks(
      tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditText(task.text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const text = editText.trim();
    if (!text) return;

    setTasks(
      tasks.map((t) => (t.id === editingId ? { ...t, text } : t))
    );
    setEditingId(null);
    setEditText("");
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const clearCompleted = () => {
    setTasks(tasks.filter((t) => !t.done));
  };

  const togglePin = async () => {
    const win = getCurrentWindow();
    await win.setAlwaysOnTop(!pinned);
    setPinned(!pinned);
  };

  const activeTasks = tasks.filter((t) => !t.done);
  const completedTasks = tasks.filter((t) => t.done);

  return (
    <div className="pin-window" data-tauri-drag-region>
      {/* Title bar */}
      <header className="titlebar" data-tauri-drag-region>
        <span>📌 Pin</span>
        <div className="title-actions">
          <button onClick={toggleTheme} title="Toggle theme">
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <button onClick={togglePin} title={pinned ? "Unpin" : "Pin"}>
            {pinned ? "📍" : "📌"}
          </button>
        </div>
      </header>

      {/* Input */}
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          placeholder="What are you focusing on?"
          autoFocus
        />
      </div>

      {/* Active tasks */}
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

      {/* Completed section */}
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
