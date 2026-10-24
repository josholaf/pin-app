import { useRef, useState, type MouseEvent, type KeyboardEvent } from "react";
import {
  Moon, Sun, X, PanelRight, PanelRightClose, Bold, Italic, List, ListOrdered, CheckSquare,
  Heading, Code, TextQuote, Link as LinkIcon, Strikethrough, ArrowLeft,
} from "lucide-react";
import {
  NOTE_COLORS, ICON_BANK, markdownToHtml, plainToHtml, getIcon,
  type Theme, type NoteColor, type AppSettings,
} from "./appData";

type Props = {
  theme: Theme;
  settings: AppSettings;
  onBack: () => void;
  noteTitle: string;
  setNoteTitle: (v: string) => void;
  noteContent: string;
  setNoteContent: (v: string) => void;
  noteColor: NoteColor;
  noteIcon: string;
  setNoteIcon: (id: string) => void;
  noteFormat: "md" | "txt";
  setNoteFormat: (f: "md" | "txt") => void;
  showIconSidebar: boolean;
  setShowIconSidebar: (v: boolean) => void;
  toggleTheme: () => void;
  closeWindow: () => void;
};

export function MarkdownNote(p: Props) {
  const noteEditorRef = useRef<HTMLTextAreaElement | null>(null);
  // Single-pane auto-preview: rendered view by default; tap/click to edit.
  const [editing, setEditing] = useState(false);
  const currentColor = NOTE_COLORS.find((c) => c.id === p.noteColor) || NOTE_COLORS[0];
  const bgColor = p.theme === "dark" ? currentColor.dark : currentColor.light;
  const SelectedIcon = getIcon(p.noteIcon).Icon;
  const isMd = p.noteFormat === "md";
  const liveHtml = isMd ? markdownToHtml(p.noteContent) : plainToHtml(p.noteContent);

  const enterEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      const el = noteEditorRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
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

  return (
    <div className="pin-window note-window" data-tauri-drag-region style={{ background: bgColor, fontFamily: p.settings.fontFamily, fontSize: p.settings.fontSize }}>
      <div className="note-layout">
        <div className="note-main">
          <header className="titlebar" data-tauri-drag-region style={{ background: bgColor }}>
            <button onClick={p.onBack} className="icon-btn" title="Back to notes"><ArrowLeft size={16} /></button>
            <div className="note-title-row" data-tauri-drag-region>
              <SelectedIcon size={16} className="note-icon-display" />
              <input
                className="note-title-input"
                value={p.noteTitle}
                onChange={(e) => p.setNoteTitle(e.target.value)}
                placeholder="Note title..."
              />
            </div>
            <div className="title-actions">
              <button
                className={"md-format-btn " + (isMd ? "" : "active-mode")}
                title={isMd ? "Markdown formatting — switch to plain text" : "Plain text — switch to markdown"}
                onClick={() => p.setNoteFormat(isMd ? "txt" : "md")}
              >
                {isMd ? "MD" : "TXT"}
              </button>
              <button onClick={() => p.setShowIconSidebar(!p.showIconSidebar)} className="icon-btn" title="Icons">{p.showIconSidebar ? <PanelRightClose size={16} /> : <PanelRight size={16} />}</button>
              <button onClick={p.toggleTheme} className="icon-btn" title="Theme">{p.theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
              <button onClick={p.closeWindow} className="icon-btn" title="Close"><X size={16} /></button>
            </div>
          </header>
          {isMd && (
            <div className="md-toolbar">
              <button type="button" className="icon-btn" title="Bold (Ctrl+B)" onMouseDown={startToolbarAction} onClick={() => insertMd("**", "**")}><Bold size={14} /></button>
              <button type="button" className="icon-btn" title="Italic (Ctrl+I)" onMouseDown={startToolbarAction} onClick={() => insertMd("*", "*")}><Italic size={14} /></button>
              <button type="button" className="icon-btn" title="Strikethrough" onMouseDown={startToolbarAction} onClick={() => insertMd("~~", "~~")}><Strikethrough size={14} /></button>
              <button type="button" className="icon-btn" title="Heading" onMouseDown={startToolbarAction} onClick={() => insertMd("## ")}><Heading size={14} /></button>
              <button type="button" className="icon-btn" title="Inline code" onMouseDown={startToolbarAction} onClick={() => insertMd("`", "`")}><Code size={14} /></button>
              <button type="button" className="icon-btn" title="Bullet list" onMouseDown={startToolbarAction} onClick={() => insertMd("- ")}><List size={14} /></button>
              <button type="button" className="icon-btn" title="Numbered list" onMouseDown={startToolbarAction} onClick={() => insertMd("1. ")}><ListOrdered size={14} /></button>
              <button type="button" className="icon-btn" title="Task" onMouseDown={startToolbarAction} onClick={() => insertMd("- [ ] ")}><CheckSquare size={14} /></button>
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
                onChange={(e) => p.setNoteContent(e.target.value)}
                onKeyDown={onEditorKeyDown}
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
        </div>
        {p.showIconSidebar && (
          <aside className="icon-sidebar">
            <div className="icon-sidebar-header">Icons</div>
            <div className="icon-grid">
              {ICON_BANK.map(({ id, Icon, label }) => (
                <button key={id} className={"icon-grid-item " + (p.noteIcon === id ? "active" : "")} title={label} onClick={() => p.setNoteIcon(id)}><Icon size={18} /></button>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
