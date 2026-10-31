import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Store } from "@tauri-apps/plugin-store";
import { Mic, Square, Zap, CornerDownLeft } from "lucide-react";
import {
  DEFAULT_SETTINGS,
  type AppSettings, type Note, type NoteFolder,
} from "./appData";

/** v0.1.17: the hidden Spotlight-style Quick Note window (issue #40).
 *  Ctrl+Shift+N from anywhere shows it. Enter saves the note into the
 *  Quick Notes folder without opening the main app. */
export const QUICK_FOLDER_ID = "quick-notes";

const SLASH_ITEMS = [
  { id: "h2", label: "Heading", insert: "## " },
  { id: "todo", label: "To-do", insert: "- [ ] " },
  { id: "bullet", label: "Bullet", insert: "- " },
  { id: "quote", label: "Quote", insert: "> " },
  { id: "highlight", label: "Highlight", insert: "==" },
  { id: "table", label: "Table", insert: "\n| Column | Value |\n| --- | --- |\n|  |  |\n" },
  { id: "code", label: "Code block", insert: "\n```\n\n```\n" },
];

export function QuickNoteCapture() {
  const [text, setText] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [flash, setFlash] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [slashIdx, setSlashIdx] = useState(0);
  const storeRef = useRef<Store | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const caretRef = useRef(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const recordingRef = useRef(false);

  const hide = () => { try { getCurrentWindow().hide(); } catch { /* ignore */ } };

  useEffect(() => {
    (async () => {
      const s = await Store.load("pin-data.json");
      storeRef.current = s;
      const st = await s.get<AppSettings>("settings");
      if (st) setSettings({ ...DEFAULT_SETTINGS, ...st });
      const th = await s.get<"light" | "dark">("theme");
      document.documentElement.setAttribute("data-theme", th || "light");
      try { localStorage.setItem("pin-theme", th || "light"); } catch { /* ignore */ }
    })();
    // Refocus the input every time the window is shown / focused.
    const win = getCurrentWindow();
    let unlisten: (() => void) | null = null;
    win.onFocusChanged(({ payload }: { payload: boolean }) => {
      if (payload) {
        requestAnimationFrame(() => { taRef.current?.focus(); });
      } else if (!recordingRef.current) {
        // Clicking away dismisses the capture window (unless recording).
        hide();
      }
    }).then((fn: () => void) => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); if (recTimerRef.current) clearInterval(recTimerRef.current); };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accentColor);
  }, [settings.accentColor]);

  // Slash command detection on the token right before the caret.
  const slashToken = (() => {
    const before = text.slice(0, caretRef.current);
    const m = before.match(/(?:^|\s)\/(\w*)$/);
    return m ? m[1] : null;
  })();
  const slashMatches = slashToken !== null
    ? SLASH_ITEMS.filter((it) => it.id.startsWith(slashToken.toLowerCase()))
    : [];

  const applySlash = (insert: string) => {
    const ta = taRef.current;
    const before = text.slice(0, caretRef.current).replace(/(?:^|\s)\/\w*$/, (m) => (m.startsWith(" ") ? " " : ""));
    const after = text.slice(caretRef.current);
    const next = before + insert + after;
    caretRef.current = (before + insert).length;
    setText(next);
    setSlashIdx(0);
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(caretRef.current, caretRef.current); });
  };

  /** DD-MM-YY title for date mode (e.g. 31-10-26). */
  const dateTitle = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return pad(d.getDate()) + "-" + pad(d.getMonth() + 1) + "-" + String(d.getFullYear()).slice(2);
  };

  /** Ensure the Quick Notes folder exists, then save the note there. */
  const saveNote = async () => {
    const s = storeRef.current;
    const raw = text.trim();
    if (!s) return;
    if (!raw) { hide(); return; }

    const lines = raw.split("\n");
    const first = lines[0];
    let title = "";
    let content = raw;
    if (first.startsWith("*")) {
      // "* my title" at the intro marks the title explicitly.
      title = first.replace(/^\*\s*/, "").trim();
      content = lines.slice(1).join("\n").trim();
      if (!content) content = title;
    } else if (settings.captureTitleMode === "date") {
      title = dateTitle();
    } else {
      title = first.slice(0, 80);
    }
    if (!title) title = "Untitled";

    // Quick Notes folder, created automatically if missing.
    const folders = (await s.get<NoteFolder[]>("folders")) || [];
    if (!folders.some((f) => f.id === QUICK_FOLDER_ID && !f.deletedAt)) {
      folders.push({ id: QUICK_FOLDER_ID, name: "Quick Notes", icon: "zap", createdAt: Date.now() });
      await s.set("folders", folders);
    }

    const note: Note = {
      id: crypto.randomUUID(),
      title,
      content,
      color: "yellow",
      icon: "zap",
      folderId: QUICK_FOLDER_ID,
      createdAt: Date.now(),
      format: "md",
      tags: ["quick"],
    };
    await s.set("note:" + note.id, note);
    const ids = (await s.get<string[]>("noteIds")) || [];
    ids.unshift(note.id);
    await s.set("noteIds", ids);
    await s.save();

    setFlash("Saved to Quick Notes");
    setText("");
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setFlash("");
      hide();
    }, 650);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          if (dataUrl) {
            const insert = "[[audio|" + dataUrl + "]]\n";
            const next = (text ? text.replace(/\n*$/, "\n") : "") + insert;
            setText(next);
            caretRef.current = next.length;
          }
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      recordingRef.current = true;
      setRecording(true);
      setRecSecs(0);
      recTimerRef.current = window.setInterval(() => setRecSecs((p) => p + 1), 1000);
    } catch { /* mic unavailable or denied */ }
  };

  const stopRecording = () => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingRef.current = false;
    setRecording(false);
  };

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMatches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => (i + 1) % slashMatches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => (i - 1 + slashMatches.length) % slashMatches.length); return; }
      if (e.key === "Escape") { e.preventDefault(); setSlashIdx(0); caretRef.current = Math.max(0, caretRef.current - (slashToken?.length ?? 0) - 1); setText(text.slice(0, caretRef.current) + text.slice(caretRef.current + (slashToken?.length ?? 0) + 1)); return; }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); applySlash(slashMatches[slashIdx].insert); return; }
    }
    if (e.key === "Escape") { e.preventDefault(); hide(); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveNote(); return; }
  };

  const recLabel = String(Math.floor(recSecs / 60)).padStart(2, "0") + ":" + String(recSecs % 60).padStart(2, "0");

  return (
    <div className="qn-wrap" data-tauri-drag-region style={{ fontFamily: settings.fontFamily, fontSize: settings.fontSize }}>
      <div className="qn-box">
        {slashMatches.length > 0 && (
          <div className="qn-slash-menu">
            {slashMatches.map((it, i) => (
              <button
                key={it.id}
                className={"qn-slash-item " + (i === slashIdx ? "active" : "")}
                onMouseDown={(e) => { e.preventDefault(); applySlash(it.insert); }}
              >
                <span className="qn-slash-label">{it.label}</span>
                <span className="qn-slash-hint">{it.insert.trim().slice(0, 14) || "/"}</span>
              </button>
            ))}
          </div>
        )}
        <div className="qn-head">
          <Zap size={12} className="qn-head-icon" />
          <span className="qn-head-title">Quick Note</span>
          <span className="qn-head-hint">{settings.captureTitleMode === "date" ? "Title: date (DD-MM-YY) - * overrides" : "* at the start marks the title"}</span>
        </div>
        <textarea
          ref={taRef}
          className="qn-input"
          autoFocus
          spellCheck={false}
          value={text}
          onChange={(e) => { caretRef.current = e.target.selectionStart; setText(e.target.value); }}
          onClick={(e) => { caretRef.current = e.currentTarget.selectionStart; }}
          onKeyUp={(e) => { caretRef.current = e.currentTarget.selectionStart; }}
          onKeyDown={onEditorKeyDown}
          placeholder={"Markdown works: ##, [[links]], / commands…\n" + (settings.captureTitleMode === "date" ? "Title is the date, start with * for a custom one" : "Start with * to make the first line the title")}
          rows={4}
        />
        <div className="qn-actions">
          <span className="qn-actions-hint">
            {recording
              ? <span className="qn-rec"><span className="qn-rec-bars"><i /><i /><i /></span><span className="qn-rec-time">{recLabel}</span></span>
              : "Enter saves - Shift+Enter newline - Esc hides"}
          </span>
          <div className="qn-actions-btns">
            {recording ? (
              <button className="qn-mic-btn recording" title="Stop recording" onClick={stopRecording}><Square size={13} /></button>
            ) : (
              <button className="qn-mic-btn" title="Record voice note into this note" onClick={startRecording}><Mic size={14} /></button>
            )}
            <button className="qn-save-btn" title="Save to Quick Notes (Enter)" onClick={() => void saveNote()}>
              <CornerDownLeft size={12} /> Save
            </button>
          </div>
        </div>
        {flash && <div className="qn-flash"><Zap size={11} /> {flash}</div>}
      </div>
    </div>
  );
}
