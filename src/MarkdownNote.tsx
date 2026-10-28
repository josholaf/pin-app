import { useEffect, useRef, useState, type MouseEvent, type KeyboardEvent, type CSSProperties } from "react";
import {
  Moon, Sun, X, Bold, Italic, List, ListOrdered, CheckSquare,
  Heading, Code, TextQuote, Link as LinkIcon, Strikethrough, ArrowLeft,
  Pin, Download, Copy, Tag, Table,
} from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import {
  NOTE_COLORS, ICON_BANK, markdownToHtml, plainToHtml, getIcon, tagColor,
  type Theme, type NoteColor, type AppSettings,
} from "./appData";

// The inline-code toolbar button wraps the selection in backticks; spelled
// out via charCode so this file contains no raw backtick characters.
const BACKTICK = String.fromCharCode(96);

type Props = {
  theme: Theme;
  settings: AppSettings;
  onBack: () => void;
  noteTitle: string;
  setNoteTitle: (v: string) => void;
  noteContent: string;
  setNoteContent: (v: string) => void;
  noteColor: NoteColor;
  setNoteColor: (c: NoteColor) => void;
  noteIcon: string;
  setNoteIcon: (id: string) => void;
  noteFormat: "md" | "txt";
  setNoteFormat: (f: "md" | "txt") => void;
  noteTags: string[];
  /** v0.1.7: every tag used anywhere, for suggestions (issue #18). */
  allTags?: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onPin?: () => void;
  /** Timestamp of the last Ctrl+S save; shows a "Saved" flash (issue #16). */
  savedAt?: number;
  toggleTheme: () => void;
  closeWindow: () => void;
};

export function MarkdownNote(p: Props) {
  const noteEditorRef = useRef<HTMLTextAreaElement | null>(null);
  // Single-pane auto-preview: rendered view by default; tap/click to edit.
  const [editing, setEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [iconPickerPos, setIconPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestOpen, setTagSuggestOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const lastSavedAt = useRef<number>(0);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  // v0.1.6: flash "Saved" in the status bar after each Ctrl+S save (issue #16)
  useEffect(() => {
    if (p.savedAt && p.savedAt !== lastSavedAt.current) {
      lastSavedAt.current = p.savedAt;
      setFlash("Saved");
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), 1800);
    }
  }, [p.savedAt]);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const currentColor = NOTE_COLORS.find((c) => c.id === p.noteColor) || NOTE_COLORS[0];
  const bgColor = p.theme === "dark" ? currentColor.dark : currentColor.light;
  const SelectedIcon = getIcon(p.noteIcon).Icon;
  const isMd = p.noteFormat === "md";
  const liveHtml = isMd ? markdownToHtml(p.noteContent) : plainToHtml(p.noteContent);
  const words = p.noteContent.trim() ? p.noteContent.trim().split(/\s+/).length : 0;

  /** v0.1.7: tags you already created, matching what you are typing (issue #18). */
  const tagSuggestions = (p.allTags || [])
    .filter((t) => !p.noteTags.includes(t))
    .filter((t) => !tagInput.trim() || t.includes(tagInput.trim().replace(/^#/, "").toLowerCase()))
    .slice(0, 6);

  /** Show a short confirmation message in the status bar. */
  const flashMessage = (msg: string) => {
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1800);
  };

  /** Export the note as a .md / .txt file via the native save dialog (issue #7). */
  const exportNote = async () => {
    try {
      const ext = isMd ? "md" : "txt";
      const safe = (p.noteTitle || "note").replace(/[<>:"/\\|?*]+/g, "-").trim() || "note";
      const path = await save({
        defaultPath: safe + "." + ext,
        filters: [{ name: ext.toUpperCase() + " file", extensions: [ext] }],
      });
      if (!path) return;
      await writeTextFile(path, p.noteContent);
      flashMessage("Exported as ." + ext);
    } catch { flashMessage("Export failed"); }
  };

  /** Copy the note body as plain text (issue #7). */
  const copyPlainText = async () => {
    try {
      await navigator.clipboard.writeText(p.noteContent);
      flashMessage("Copied to clipboard");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = p.noteContent;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        flashMessage("Copied to clipboard");
      } catch { flashMessage("Copy failed"); }
    }
  };

  /** Track cursor position (line / column) for the status bar. */
  const updateCursor = () => {
    const el = noteEditorRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    const upto = el.value.slice(0, caret);
    const lines = upto.split("\n");
    setCursorPos({ line: lines.length, col: lines[lines.length - 1].length + 1 });
  };

  const enterEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      const el = noteEditorRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        updateCursor();
      }
    });
  };
  const exitEdit = () => setEditing(false);

  const insertMd = (before: string, after = "") => {
    const el = noteEditorRef.current;
    if (!el) {
      p.setNoteContent(p.noteContent + before + after);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = p.noteContent.slice(start, end);
    const next = p.noteContent.slice(0, start) + before + selected + after + p.noteContent.slice(end);
    p.setNoteContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length + selected.length;
      el.setSelectionRange(pos, pos);
      updateCursor();
    });
  };

  /** Flip the n-th "- [ ]" / "- [x]" task marker in the raw markdown. */
  const flipTask = (idx: number, toDone: boolean) => {
    let n = 0;
    p.setNoteContent(
      p.noteContent.replace(/^(\s*[-*]\s+\[)( |x|X)(\])/gm, function (all: string, a: string, _mark: string, b: string) {
        const res = n === idx ? a + (toDone ? "x" : " ") + b : all;
        n += 1;
        return res;
      })
    );
  };

  const onPreviewClick = (e: MouseEvent<HTMLDivElement>) => {
    const box = (e.target as HTMLElement).closest(".md-checkbox") as HTMLElement | null;
    if (box) {
      flipTask(Number(box.dataset.task), box.dataset.done !== "1");
      return;
    }
    const link = (e.target as HTMLElement).closest("a");
    if (link) return; // let links open normally
    enterEdit();
  };

  const onEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { e.preventDefault(); exitEdit(); return; }
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "b" && isMd) { e.preventDefault(); insertMd("**", "**"); }
      else if (k === "i" && isMd) { e.preventDefault(); insertMd("*", "*"); }
    }
  };

  const startToolbarAction = (e: MouseEvent<HTMLButtonElement>) => {
    // keep textarea focus so insertion works and edit mode stays on
    e.preventDefault();
    if (!editing) enterEdit();
  };

  const addTag = () => {
    p.onAddTag(tagInput);
    setTagInput("");
  };

  return (
    <div className="pin-window note-window" data-tauri-drag-region style={{ background: bgColor, fontFamily: p.settings.fontFamily, fontSize: p.settings.fontSize }}>
      <div className="note-layout">
        <div className="note-main">
          <header className="titlebar" data-tauri-drag-region style={{ background: bgColor }}>
            <button onClick={p.onBack} className="icon-btn" title="Back to notes"><ArrowLeft size={16} /></button>
            <div
              className="note-title-row"
              data-tauri-drag-region
              title="Right-click to change the note icon"
              onContextMenu={(e) => { e.preventDefault(); setIconPickerPos({ x: e.clientX, y: e.clientY }); }}
            >
              <SelectedIcon size={16} className="note-icon-display" />
              <input
                className="note-title-input"
                value={p.noteTitle}
                onChange={(e) => p.setNoteTitle(e.target.value)}
                placeholder="Note title..."
              />
            </div>
            <div className="title-actions">
              {p.onPin && (
                <button onClick={p.onPin} className="icon-btn" title="Pin to desktop"><Pin size={16} /></button>
              )}
              <button onClick={() => { exportNote(); }} className="icon-btn" title={"Export as ." + (isMd ? "md" : "txt")}><Download size={16} /></button>
              <button onClick={() => { copyPlainText(); }} className="icon-btn" title="Copy as text"><Copy size={16} /></button>
              <div className="color-picker-wrapper">
                <button className="color-btn" style={{ background: bgColor }} title="Note color" onClick={() => setShowColorPicker((v) => !v)} />
                {showColorPicker && (
                  <div className="color-picker">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        className={"color-option " + (p.noteColor === c.id ? "active" : "")}
                        style={{ background: p.theme === "dark" ? c.dark : c.light }}
                        title={c.label}
                        onClick={() => { p.setNoteColor(c.id); setShowColorPicker(false); }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <button
                className={"md-format-btn " + (isMd ? "" : "active-mode")}
                title={isMd ? "Markdown formatting — switch to plain text" : "Plain text — switch to markdown"}
                onClick={() => p.setNoteFormat(isMd ? "txt" : "md")}
              >
                {isMd ? "MD" : "TXT"}
              </button>
              <button onClick={p.toggleTheme} className="icon-btn" title="Theme">{p.theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
              <button onClick={p.closeWindow} className="icon-btn" title="Close"><X size={16} /></button>
            </div>
          </header>
          <div className="note-tags-row">
            <Tag size={11} className="note-tags-icon" />
            {p.noteTags.map((t) => (
              <span key={t} className="tag-chip" style={{ "--tag-color": tagColor(t) } as CSSProperties}>
                {"#" + t}
                <button className="tag-chip-x" title="Remove tag" onClick={() => p.onRemoveTag(t)}><X size={9} /></button>
              </span>
            ))}
            <div className="tag-suggest-wrap">
              <input
                className="cm-tag-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onFocus={() => setTagSuggestOpen(true)}
                onBlur={() => { setTimeout(() => setTagSuggestOpen(false), 150); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="+ tag"
              />
              {tagSuggestOpen && tagSuggestions.length > 0 && (
                <div className="tag-suggest-pop">
                  {tagSuggestions.map((t) => (
                    <button
                      key={t}
                      className="tag-suggest-item"
                      style={{ color: tagColor(t) }}
                      onMouseDown={(e) => { e.preventDefault(); p.onAddTag(t); setTagInput(""); }}
                    >
                      {"#" + t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {isMd && (
            <div className="md-toolbar">
              <button type="button" className="icon-btn" title="Bold (Ctrl+B)" onMouseDown={startToolbarAction} onClick={() => insertMd("**", "**")}><Bold size={14} /></button>
              <button type="button" className="icon-btn" title="Italic (Ctrl+I)" onMouseDown={startToolbarAction} onClick={() => insertMd("*", "*")}><Italic size={14} /></button>
              <button type="button" className="icon-btn" title="Strikethrough" onMouseDown={startToolbarAction} onClick={() => insertMd("~~", "~~")}><Strikethrough size={14} /></button>
              <button type="button" className="icon-btn" title="Heading" onMouseDown={startToolbarAction} onClick={() => insertMd("## ")}><Heading size={14} /></button>
              <button type="button" className="icon-btn" title="Inline code" onMouseDown={startToolbarAction} onClick={() => insertMd(BACKTICK, BACKTICK)}><Code size={14} /></button>
              <button type="button" className="icon-btn" title="Bullet list" onMouseDown={startToolbarAction} onClick={() => insertMd("- ")}><List size={14} /></button>
              <button type="button" className="icon-btn" title="Numbered list" onMouseDown={startToolbarAction} onClick={() => insertMd("1. ")}><ListOrdered size={14} /></button>
              <button type="button" className="icon-btn" title="Task" onMouseDown={startToolbarAction} onClick={() => insertMd("- [ ] ")}><CheckSquare size={14} /></button>
              <button type="button" className="icon-btn" title="Table" onMouseDown={startToolbarAction} onClick={() => insertMd("\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n\n")}><Table size={14} /></button>
              <button type="button" className="icon-btn" title="Quote" onMouseDown={startToolbarAction} onClick={() => insertMd("> ")}><TextQuote size={14} /></button>
              <button type="button" className="icon-btn" title="Link" onMouseDown={startToolbarAction} onClick={() => insertMd("[", "](https://)")}><LinkIcon size={14} /></button>
              <div className="md-toolbar-spacer" />
            </div>
          )}
          <div className="note-editor-single">
            {editing ? (
              <textarea
                ref={noteEditorRef}
                className="note-content note-content-edit"
                value={p.noteContent}
                onChange={(e) => { p.setNoteContent(e.target.value); updateCursor(); }}
                onKeyDown={onEditorKeyDown}
                onKeyUp={updateCursor}
                onClick={updateCursor}
                onSelect={updateCursor}
                onBlur={exitEdit}
                placeholder={isMd ? "Write markdown… (Esc to preview)" : "Write… (Esc to finish)"}
                autoFocus
                spellCheck={false}
              />
            ) : (
              <div
                className="note-content note-content-preview"
                onClick={onPreviewClick}
                dangerouslySetInnerHTML={{ __html: liveHtml || '<span class="md-placeholder">Tap to write…</span>' }}
              />
            )}
          </div>
          <div className="note-status-bar">
            <span className="status-pos">Ln {cursorPos.line}, Col {cursorPos.col}</span>
            <span className={"status-net " + (online ? "is-online" : "is-offline")} title={online ? "Online" : "Offline"}>
              <span className="status-net-dot" />
              {!online && <span className="status-net-label">Offline</span>}
            </span>
            <span className="status-spacer" />
            {flash && <span className="status-flash">{flash}</span>}
            <span className="status-words">{words} {words === 1 ? "word" : "words"}</span>
          </div>
        </div>
        {iconPickerPos && (
          <div
            className="picker-overlay"
            onClick={() => setIconPickerPos(null)}
            onContextMenu={(e) => { e.preventDefault(); setIconPickerPos(null); }}
          >
            <div
              className="icon-picker"
              style={{ left: iconPickerPos.x, top: iconPickerPos.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="icon-picker-header">Note icon</div>
              <div className="icon-grid">
                {ICON_BANK.map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    className={"icon-grid-item " + (p.noteIcon === id ? "active" : "")}
                    title={label}
                    onClick={() => { p.setNoteIcon(id); setIconPickerPos(null); }}
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
