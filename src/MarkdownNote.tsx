import { useEffect, useRef, useState, type MouseEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import {
  Moon, Sun, X, Bold, Italic, List, ListOrdered, CheckSquare,
  Heading, Code, TextQuote, Link as LinkIcon, Strikethrough, ArrowLeft,
  Pin, Download, Copy, Table, Highlighter, Palette, ImagePlus, Mic, Square, LayoutGrid, Link2,
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
const FENCE = BACKTICK + BACKTICK + BACKTICK;

// v0.1.10: the colored-text snippet. Kept in one place so the toolbar
// button and the slash menu always insert the same thing.
const COLOR_SPAN_OPEN = '<span style="color: #e91e63">';
const COLOR_SPAN_CLOSE = "</span>";

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
  /** v0.1.14: other notes, for [[wiki-link]] autocomplete (issue #34). */
  allNotes?: { id: string; title: string }[];
  /** v0.1.14: open (or create) the note a [[wiki-link]] points to. */
  onOpenWikiLink?: (title: string) => void;
  /** v0.1.14: notes that link to this one ("Linked mentions"). */
  backlinks?: { id: string; title: string }[];
  /** v0.1.14: open a backlink by id. */
  onOpenNoteById?: (id: string) => void;
};

/** v0.1.9: blocks insertable via the "/" slash menu (issue #22).
 *  `wrap` items place the caret inside the inserted markers.
 *  v0.1.10: `action: "tags"` opens the tag picker instead of inserting (issue #24).
 *  v0.1.11: `action: "image"` opens the photo picker instead of inserting (issue #26). */
type SlashItem = { id: string; label: string; hint: string; md: string; wrap?: boolean; action?: "tags" | "image" };
const SLASH_ITEMS: SlashItem[] = [
  { id: "tags", label: "Tags", hint: "add / remove", md: "", action: "tags" },
  { id: "image", label: "Image", hint: "upload photo", md: "", action: "image" },
  { id: "h1", label: "Heading 1", hint: "#", md: "# " },
  { id: "h2", label: "Heading 2", hint: "##", md: "## " },
  { id: "h3", label: "Heading 3", hint: "###", md: "### " },
  { id: "h4", label: "Heading 4", hint: "####", md: "#### " },
  { id: "task", label: "Task", hint: "Checkbox", md: "- [ ] " },
  { id: "bullet", label: "Bullet list", hint: "List", md: "- " },
  { id: "numbered", label: "Numbered list", hint: "1. 2. 3.", md: "1. " },
  { id: "bold", label: "Bold", hint: "**text**", md: "**text**", wrap: true },
  { id: "italic", label: "Italic", hint: "*text*", md: "*text*", wrap: true },
  { id: "strike", label: "Strikethrough", hint: "~~text~~", md: "~~text~~", wrap: true },
  { id: "highlight", label: "Highlight", hint: "==text==", md: "==text==", wrap: true },
  { id: "color", label: "Colored text", hint: "<span>", md: COLOR_SPAN_OPEN + "text" + COLOR_SPAN_CLOSE },
  { id: "code", label: "Code block", hint: FENCE + "lang", md: FENCE + "python\n\n" + FENCE + "\n" },
  { id: "quote", label: "Quote", hint: ">", md: "> " },
  { id: "table", label: "Table", hint: "| col |", md: "\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n\n" },
  { id: "link", label: "Link", hint: "[text](url)", md: "[text](https://)" },
  { id: "divider", label: "Divider", hint: "---", md: "\n---\n" },
];

export function MarkdownNote(p: Props) {
  const noteEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumRef = useRef<HTMLDivElement | null>(null);
  // v0.1.11: hidden file input for photo uploads (issue #26)
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Single-pane auto-preview: rendered view by default; tap/click to edit.
  const [editing, setEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [iconPickerPos, setIconPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const lastSavedAt = useRef<number>(0);
  // v0.1.9: slash command menu (issue #22)
  const [slashMenu, setSlashMenu] = useState<{ top: number; left: number; tokenStart: number } | null>(null);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIdx, setSlashIdx] = useState(0);
  // v0.1.14: [[wiki-link]] autocomplete (issue #34)
  const [wikiMenu, setWikiMenu] = useState<{ top: number; left: number; tokenStart: number } | null>(null);
  const [wikiQuery, setWikiQuery] = useState("");
  const [wikiIdx, setWikiIdx] = useState(0);
  // v0.1.10: tag picker opened by the "/tags" slash command (issue #24).
  const [tagPanel, setTagPanel] = useState<{ top: number; left: number } | null>(null);
  const [newTag, setNewTag] = useState("");
  // v0.1.11: photo column picker (1-4 columns) over the selection (issue #26)
  const [colsMenuOpen, setColsMenuOpen] = useState(false);
  // v0.1.11: in-note audio recording (issue #26)
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
  /** v0.1.8: one gutter number per content line, like VS Code (issue #20). */
  const lineCount = p.noteContent.split("\n").length;

  /** v0.1.9: slash items matching what was typed after the "/". */
  const slashFiltered = SLASH_ITEMS.filter((it) =>
    !slashQuery ||
    it.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
    it.id.startsWith(slashQuery.toLowerCase())
  );

  /** v0.1.14: note titles matching the [[wiki-link query. */
  const wikiFiltered = (p.allNotes || [])
    .filter((n) => n.title.toLowerCase().includes(wikiQuery.toLowerCase()))
    .slice(0, 8);

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

  /** v0.1.8: keep the line-number gutter glued to the editor scroll (issue #20). */
  const syncGutterScroll = () => {
    const ta = noteEditorRef.current;
    const gutter = lineNumRef.current;
    if (ta && gutter) gutter.scrollTop = ta.scrollTop;
  };

  /** Shared caret-to-popup math for the slash and wiki menus. */
  const caretPopupPos = (value: string, tokenStart: number) => {
    const before = value.slice(0, tokenStart);
    const lines = before.split("\n");
    const lineIdx = lines.length - 1;
    const col = lines[lines.length - 1].length;
    const ta = noteEditorRef.current;
    const scrollTop = ta ? ta.scrollTop : 0;
    const fs = p.settings.fontSize || 14;
    const top = Math.max(4, 12 + lineIdx * fs * 1.5 - scrollTop + fs * 1.7);
    const left = 44 + col * fs * 0.6;
    return { top, left: Math.min(left, 170) };
  };

  /** v0.1.9: open the slash menu when a "/" word is being typed (issue #22).
   *  Anchors the popup near the caret and remembers where the token starts. */
  const detectSlash = (value: string, caret: number) => {
    const upto = value.slice(0, caret);
    const m = upto.match(/(?:^|\n|\s)\/([\w-]*)$/);
    if (!m) { setSlashMenu(null); return; }
    const query = m[1];
    setSlashQuery(query);
    const tokenStart = caret - query.length - 1;
    const pos = caretPopupPos(value, tokenStart);
    setSlashMenu({ top: pos.top, left: pos.left, tokenStart });
    setSlashIdx(0);
  };

  /** v0.1.14: open the [[wiki-link]] autocomplete while typing "[[query"
   *  (issue #34). Remembers where the "[[" token starts. */
  const detectWiki = (value: string, caret: number) => {
    const upto = value.slice(0, caret);
    const m = upto.match(/\[\[([^\]\n]*)$/);
    if (!m || !p.allNotes || p.allNotes.length === 0) { setWikiMenu(null); return; }
    const query = m[1];
    const tokenStart = caret - query.length - 2;
    const pos = caretPopupPos(value, tokenStart);
    setWikiMenu({ top: pos.top, left: pos.left, tokenStart });
    setWikiQuery(query);
    setWikiIdx(0);
  };

  /** v0.1.14: complete "[[que" into "[[Note Title]]" (issue #34). */
  const applyWiki = (note: { id: string; title: string }) => {
    const ta = noteEditorRef.current;
    if (!wikiMenu || !ta) { setWikiMenu(null); return; }
    const start = wikiMenu.tokenStart;
    const end = ta.selectionStart;
    const insertion = "[[" + note.title + "]]";
    const next = p.noteContent.slice(0, start) + insertion + p.noteContent.slice(end);
    p.setNoteContent(next);
    setWikiMenu(null);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insertion.length;
      ta.setSelectionRange(pos, pos);
      updateCursor();
    });
  };

  /** v0.1.9: insert the chosen block, replacing the "/query" token.
   *  v0.1.10: the "/tags" command opens the tag picker instead (issue #24).
   *  v0.1.11: the "/image" command opens the photo picker (issue #26). */
  const applySlash = (item: SlashItem) => {
    const ta = noteEditorRef.current;
    if (!slashMenu || !ta) { setSlashMenu(null); return; }
    const start = slashMenu.tokenStart;
    const end = ta.selectionStart;
    if (item.action === "tags") {
      // strip the "/tags" token from the text and open the picker there
      p.setNoteContent(p.noteContent.slice(0, start) + p.noteContent.slice(end));
      setSlashMenu(null);
      setTagPanel({ top: slashMenu.top, left: Math.min(slashMenu.left + 16, 190) });
      setNewTag("");
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start, start);
        updateCursor();
      });
      return;
    }
    if (item.action === "image") {
      // strip the "/image" token, then open the photo file picker
      p.setNoteContent(p.noteContent.slice(0, start) + p.noteContent.slice(end));
      setSlashMenu(null);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(start, start);
        updateCursor();
      });
      if (fileInputRef.current) fileInputRef.current.click();
      return;
    }
    const next = p.noteContent.slice(0, start) + item.md + p.noteContent.slice(end);
    p.setNoteContent(next);
    setSlashMenu(null);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + (item.wrap ? 2 : item.md.length);
      ta.setSelectionRange(pos, pos);
      updateCursor();
    });
  };

  const enterEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      const el = noteEditorRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        updateCursor();
        syncGutterScroll();
      }
    });
  };
  const exitEdit = () => { setEditing(false); setSlashMenu(null); setWikiMenu(null); setTagPanel(null); };

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
    // v0.1.14: [[wiki-links]] open the target note (issue #34)
    const wl = (e.target as HTMLElement).closest(".md-wikilink") as HTMLElement | null;
    if (wl && p.onOpenWikiLink) { p.onOpenWikiLink(wl.dataset.note || wl.textContent || ""); return; }
    const box = (e.target as HTMLElement).closest(".md-checkbox") as HTMLElement | null;
    if (box) {
      flipTask(Number(box.dataset.task), box.dataset.done !== "1");
      return;
    }
    // v0.1.11: clicks inside audio players play/pause, they do not open the editor (issue #26)
    if ((e.target as HTMLElement).closest("audio")) return;
    const link = (e.target as HTMLElement).closest("a");
    if (link) return; // let links open normally
    enterEdit();
  };

  const onEditorChange = (v: string) => {
    p.setNoteContent(v);
    updateCursor();
    const ta = noteEditorRef.current;
    const caret = ta ? (ta.selectionStart ?? v.length) : v.length;
    detectSlash(v, caret);
    detectWiki(v, caret);
  };

  // v0.1.11: paste photos straight into the note (issue #26)
  const onEditorPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const f = items[i].getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length === 0) return; // normal text paste
    e.preventDefault();
    insertImageFiles(imageFiles);
  };

  const onEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // v0.1.10: Esc closes the tag picker first (issue #24)
    if (tagPanel && e.key === "Escape") { e.preventDefault(); setTagPanel(null); return; }
    // v0.1.14: [[wiki-link]] autocomplete keyboard control (issue #34)
    if (wikiMenu && wikiFiltered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setWikiIdx((i) => (i + 1) % wikiFiltered.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setWikiIdx((i) => (i - 1 + wikiFiltered.length) % wikiFiltered.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); applyWiki(wikiFiltered[wikiIdx]); return; }
      if (e.key === "Escape") { e.preventDefault(); setWikiMenu(null); return; }
    }
    // v0.1.9: slash menu keyboard control (issue #22)
    if (slashMenu && slashFiltered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => (i + 1) % slashFiltered.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => (i - 1 + slashFiltered.length) % slashFiltered.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); applySlash(slashFiltered[slashIdx]); return; }
      if (e.key === "Escape") { e.preventDefault(); setSlashMenu(null); return; }
    }
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

  /** v0.1.10: add a brand-new tag from the picker's little input (issue #24). */
  const submitNewTag = () => {
    if (!newTag.trim()) return;
    p.onAddTag(newTag);
    setNewTag("");
  };

  // ===== v0.1.11: photo upload + column grids + audio recording (issue #26) =====

  const blobToDataURL = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });

  /** Turn picked/pasted image files into markdown photo lines at the caret. */
  const insertImageFiles = async (files: File[]) => {
    for (const f of files) {
      try {
        const dataUrl = await blobToDataURL(f);
        insertMd("\n![photo](" + dataUrl + ")\n");
      } catch { flashMessage("Could not add image"); }
    }
    flashMessage(files.length + (files.length === 1 ? " photo added" : " photos added"));
  };

  const onFileInputPicked = () => {
    const input = fileInputRef.current;
    if (!input || !input.files || input.files.length === 0) return;
    insertImageFiles(Array.from(input.files));
    input.value = ""; // allow picking the same file twice
  };

  /** Wrap the current selection in a :::N column grid block. */
  const applyColumns = (n: number) => {
    setColsMenuOpen(false);
    const el = noteEditorRef.current;
    if (!el) { p.setNoteContent(":::" + n + "\n" + p.noteContent + "\n:::"); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = p.noteContent.slice(0, start);
    const sel = p.noteContent.slice(start, end);
    const after = p.noteContent.slice(end);
    // keep grid markers on their own lines
    const pre = before.endsWith("\n") || before === "" ? before : before + "\n";
    const post = after.startsWith("\n") || after === "" ? after : "\n" + after;
    const next = pre + ":::" + n + "\n" + (sel || "![photo](https://)") + "\n:::\n" + post;
    p.setNoteContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, start + sel.length);
      updateCursor();
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size === 0) { flashMessage("Recording empty"); return; }
        try {
          const dataUrl = await blobToDataURL(blob);
          insertMd("\n[[audio|" + dataUrl + "]]\n");
          flashMessage("Recording added to note");
        } catch { flashMessage("Could not save recording"); }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      recTimerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      flashMessage("Microphone unavailable");
    }
  };

  const stopRecording = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
    setRecording(false);
  };

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      try { if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    };
  }, []);

  const recLabel = Math.floor(recSeconds / 60).toString() + ":" + (recSeconds % 60).toString().padStart(2, "0");

  return (
    <div className="pin-window note-window" data-tauri-drag-region style={{ background: bgColor, fontFamily: p.settings.fontFamily, fontSize: p.settings.fontSize }}>
      <div className="note-layout">
        <div className="note-main">
          {/* v0.1.11: hidden photo picker used by the toolbar button and "/image" */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={onFileInputPicked}
          />
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
          {/* v0.1.10: the always-visible tag row is gone — tags live in the
              "/tags" slash picker now (issue #24). */}
          {isMd && (
            <div className="md-toolbar">
              <button type="button" className="icon-btn" title="Bold (Ctrl+B)" onMouseDown={startToolbarAction} onClick={() => insertMd("**", "**")}><Bold size={14} /></button>
              <button type="button" className="icon-btn" title="Italic (Ctrl+I)" onMouseDown={startToolbarAction} onClick={() => insertMd("*", "*")}><Italic size={14} /></button>
              <button type="button" className="icon-btn" title="Strikethrough" onMouseDown={startToolbarAction} onClick={() => insertMd("~~", "~~")}><Strikethrough size={14} /></button>
              <button type="button" className="icon-btn" title="Highlight (==text==)" onMouseDown={startToolbarAction} onClick={() => insertMd("==", "==")}><Highlighter size={14} /></button>
              <button type="button" className="icon-btn" title="Colored text" onMouseDown={startToolbarAction} onClick={() => insertMd(COLOR_SPAN_OPEN, COLOR_SPAN_CLOSE)}><Palette size={14} /></button>
              <button type="button" className="icon-btn" title="Wiki-link ([[note]])" onMouseDown={startToolbarAction} onClick={() => insertMd("[[", "]]")}><Link2 size={14} /></button>
              <button type="button" className="icon-btn" title="Heading" onMouseDown={startToolbarAction} onClick={() => insertMd("## ")}><Heading size={14} /></button>
              <button type="button" className="icon-btn" title="Inline code" onMouseDown={startToolbarAction} onClick={() => insertMd(BACKTICK, BACKTICK)}><Code size={14} /></button>
              <button type="button" className="icon-btn" title="Bullet list" onMouseDown={startToolbarAction} onClick={() => insertMd("- ")}><List size={14} /></button>
              <button type="button" className="icon-btn" title="Numbered list" onMouseDown={startToolbarAction} onClick={() => insertMd("1. ")}><ListOrdered size={14} /></button>
              <button type="button" className="icon-btn" title="Task" onMouseDown={startToolbarAction} onClick={() => insertMd("- [ ] ")}><CheckSquare size={14} /></button>
              <button type="button" className="icon-btn" title="Table" onMouseDown={startToolbarAction} onClick={() => insertMd("\n| Column | Column |\n| --- | --- |\n| Cell | Cell |\n\n")}><Table size={14} /></button>
              <button type="button" className="icon-btn" title="Quote" onMouseDown={startToolbarAction} onClick={() => insertMd("> ")}><TextQuote size={14} /></button>
              <button type="button" className="icon-btn" title="Link" onMouseDown={startToolbarAction} onClick={() => insertMd("[", "](https://)")}><LinkIcon size={14} /></button>
              <button type="button" className="icon-btn" title="Add photo (or paste an image)" onMouseDown={startToolbarAction} onClick={() => { if (fileInputRef.current) fileInputRef.current.click(); }}><ImagePlus size={14} /></button>
              <div className="cols-menu-wrapper">
                <button type="button" className="icon-btn" title="Arrange selected photos in columns" onMouseDown={startToolbarAction} onClick={() => setColsMenuOpen((v) => !v)}><LayoutGrid size={14} /></button>
                {colsMenuOpen && (
                  <div className="cols-menu">
                    <div className="cols-menu-title">Columns</div>
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} className="cols-menu-item" onMouseDown={(e) => { e.preventDefault(); applyColumns(n); }}>{n}</button>
                    ))}
                    <div className="cols-menu-hint">Select photos first</div>
                  </div>
                )}
              </div>
              {recording ? (
                <>
                  <span className="rec-indicator"><span className="rec-dot" />{recLabel}</span>
                  <button type="button" className="icon-btn rec-stop-btn" title="Stop recording and add to note" onMouseDown={startToolbarAction} onClick={stopRecording}><Square size={14} /></button>
                </>
              ) : (
                <button type="button" className="icon-btn" title="Record audio into this note" onMouseDown={startToolbarAction} onClick={startRecording}><Mic size={14} /></button>
              )}
              <div className="md-toolbar-spacer" />
            </div>
          )}
          <div className="note-editor-single">
            {editing ? (
              <div className="note-editor-with-lines">
                <div className="line-numbers" ref={lineNumRef} aria-hidden="true">
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i} className={"line-number" + (cursorPos.line === i + 1 ? " current" : "")}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  ref={noteEditorRef}
                  className="note-content note-content-edit note-content-lines"
                  value={p.noteContent}
                  onChange={(e) => onEditorChange(e.target.value)}
                  onKeyDown={onEditorKeyDown}
                  onKeyUp={updateCursor}
                  onClick={updateCursor}
                  onSelect={updateCursor}
                  onScroll={syncGutterScroll}
                  onPaste={onEditorPaste}
                  onBlur={exitEdit}
                  placeholder={isMd ? "Write markdown… (Esc to preview, / for blocks, [[ for note links, /tags for tags)" : "Write… (Esc to finish)"}
                  autoFocus
                  spellCheck={false}
                />
                {slashMenu && slashFiltered.length > 0 && (
                  <div className="slash-menu" style={{ top: slashMenu.top, left: slashMenu.left }}>
                    {slashFiltered.map((it, i) => (
                      <button
                        key={it.id}
                        className={"slash-item " + (i === slashIdx ? "active" : "")}
                        onMouseDown={(e) => { e.preventDefault(); applySlash(it); }}
                        onMouseEnter={() => setSlashIdx(i)}
                      >
                        <span className="slash-item-label">{it.label}</span>
                        <span className="slash-item-hint">{it.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* v0.1.14: [[wiki-link]] autocomplete (issue #34). */}
                {wikiMenu && wikiFiltered.length > 0 && (
                  <div className="slash-menu wiki-menu" style={{ top: wikiMenu.top, left: wikiMenu.left }}>
                    {wikiFiltered.map((n, i) => (
                      <button
                        key={n.id}
                        className={"slash-item " + (i === wikiIdx ? "active" : "")}
                        onMouseDown={(e) => { e.preventDefault(); applyWiki(n); }}
                        onMouseEnter={() => setWikiIdx(i)}
                      >
                        <span className="slash-item-label">[[{n.title}]]</span>
                      </button>
                    ))}
                    <div className="wiki-menu-hint">Enter to link - Esc to close</div>
                  </div>
                )}
                {/* v0.1.10: "/tags" picker — Obsidian-style colored text,
                    no chip boxes; tap to toggle a tag on this note (issue #24). */}
                {tagPanel && (
                  <div className="tag-panel" style={{ top: tagPanel.top, left: tagPanel.left }}>
                    <div className="tag-panel-title">Tags</div>
                    <div className="tag-panel-list">
                      {(p.allTags || []).length === 0 && (
                        <div className="tag-panel-empty">No tags yet.</div>
                      )}
                      {(p.allTags || []).map((t) => {
                        const on = p.noteTags.includes(t);
                        return (
                          <button
                            key={t}
                            className={"tag-panel-item" + (on ? " on" : "")}
                            style={{ color: tagColor(t) }}
                            onMouseDown={(e) => { e.preventDefault(); on ? p.onRemoveTag(t) : p.onAddTag(t); }}
                          >
                            {"#" + t}
                            {on && <span className="tag-panel-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      className="tag-panel-new"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNewTag(); } }}
                      onMouseDown={(e) => e.stopPropagation()}
                      placeholder="+ new tag"
                    />
                    <div className="tag-panel-hint">Tap to add / remove - Esc closes</div>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="note-content note-content-preview"
                onClick={onPreviewClick}
                dangerouslySetInnerHTML={{ __html: liveHtml || '<span class="md-placeholder">Tap to write…</span>' }}
              />
            )}
          </div>
          {/* v0.1.14: backlinks — other notes that link to this one (issue #34). */}
          {!editing && (p.backlinks?.length ?? 0) > 0 && (
            <div className="backlinks-section">
              <div className="backlinks-title">Linked mentions ({p.backlinks!.length})</div>
              <div className="backlinks-list">
                {p.backlinks!.map((b) => (
                  <button key={b.id} className="backlink-item" onClick={() => p.onOpenNoteById?.(b.id)}>
                    <Link2 size={11} />
                    <span>{b.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
