import { useRef } from "react";
import {
  Moon, Sun, X, PanelRight, PanelRightClose, Bold, Italic, List, ListOrdered, CheckSquare,
} from "lucide-react";
import {
  NOTE_COLORS, markdownToHtml, getIcon,
  type Theme, type NoteColor, type AppSettings,
} from "./appData";

type Props = {
  theme: Theme;
  settings: AppSettings;
  noteTitle: string;
  setNoteTitle: (v: string) => void;
  noteContent: string;
  setNoteContent: (v: string) => void;
  noteColor: NoteColor;
  setNoteColor: (c: NoteColor) => void;
  noteIcon: string;
  setNoteIcon: (id: string) => void;
  showColorPicker: boolean;
  setShowColorPicker: (v: boolean) => void;
  showIconSidebar: boolean;
  setShowIconSidebar: (v: boolean) => void;
  toggleTheme: () => void;
  closeWindow: () => void;
};

export function MarkdownNote(p: Props) {
  const noteEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const currentColor = NOTE_COLORS.find((c) => c.id === p.noteColor) || NOTE_COLORS[0];
  const bgColor = p.theme === "dark" ? currentColor.dark : currentColor.light;
  const SelectedIcon = getIcon(p.noteIcon).Icon;
  const liveHtml = markdownToHtml(p.noteContent);

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

  return (
    <div className="pin-window note-window" data-tauri-drag-region style={{ background: bgColor, fontFamily: p.settings.fontFamily, fontSize: p.settings.fontSize }}>
      <div className="note-layout">
        <div className="note-main">
          <header className="titlebar" data-tauri-drag-region style={{ background: bgColor }}>
            <div className="note-title-row" data-tauri-drag-region>
              <SelectedIcon size={16} className="note-icon-display" />
              <input className="note-title-input" value={p.noteTitle} onChange={(e) => p.setNoteTitle(e.target.value)} placeholder="Note title..." data-tauri-drag-region />
            </div>
            <div className="title-actions">
              <div className="color-picker-wrapper">
                <button onClick={() => p.setShowColorPicker(!p.showColorPicker)} className="color-btn" style={{ background: bgColor, boxShadow: "0 0 0 2px rgba(0,0,0,0.25)" }} />
                {p.showColorPicker && (
                  <div className="color-picker">
                    {NOTE_COLORS.map((c) => (
                      <button key={c.id} className={`color-option ${p.noteColor === c.id ? "active" : ""}`} style={{ background: p.theme === "dark" ? c.dark : c.light }} onClick={() => { p.setNoteColor(c.id); p.setShowColorPicker(false); }} />
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => p.setShowIconSidebar(!p.showIconSidebar)} className="icon-btn">{p.showIconSidebar ? <PanelRightClose size={16} /> : <PanelRight size={16} />}</button>
              <button onClick={p.toggleTheme} className="icon-btn">{p.theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
              <button onClick={p.closeWindow} className="icon-btn"><X size={16} /></button>
            </div>
          </header>
          <div className="md-toolbar">
            <button type="button" className="icon-btn" title="Bold" onClick={() => insertMd("**", "**")}><Bold size={14} /></button>
            <button type="button" className="icon-btn" title="Italic" onClick={() => insertMd("*", "*")}><Italic size={14} /></button>
            <button type="button" className="icon-btn" title="Bullet" onClick={() => insertMd("- ")}><List size={14} /></button>
            <button type="button" className="icon-btn" title="Numbered" onClick={() => insertMd("1. ")}><ListOrdered size={14} /></button>
            <button type="button" className="icon-btn" title="Task" onClick={() => insertMd("- [ ] ")}><CheckSquare size={14} /></button>
          </div>
          <div className="note-editor-split">
            <textarea
              ref={noteEditorRef}
              className="note-content note-content-edit"
              value={p.noteContent}
              onChange={(e) => p.setNoteContent(e.target.value)}
              placeholder={"Write markdown…\n**bold**  *italic*\n- bullet\n- [ ] task"}
              autoFocus
              style={{ background: "transparent" }}
            />
            <div
              className="note-content note-content-preview"
              dangerouslySetInnerHTML={{ __html: liveHtml || '<span class="md-placeholder">Live preview</span>' }}
            />
          </div>
        </div>
        {p.showIconSidebar && (
          <aside className="icon-sidebar">
            <div className="icon-sidebar-header">Icons</div>
            <div className="icon-grid">
              {["sticky-note","folder","book","bookmark","briefcase","calendar","check","clock","code","coffee","flame","heart","home","lightbulb","list","pencil","star","target","zap"].map((id) => {
                const { Icon, label } = getIcon(id);
                return <button key={id} className={`icon-grid-item ${p.noteIcon === id ? "active" : ""}`} title={label} onClick={() => p.setNoteIcon(id)}><Icon size={18} /></button>;
              })}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
