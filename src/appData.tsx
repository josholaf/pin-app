import { type ComponentType } from "react";
import {
  StickyNote, Book, Bookmark, Briefcase, Calendar, Check, CheckCircle, FolderCheck,
  Code, Coffee, Flame, Folder, Heart, Home, Lightbulb, List, Pencil, Star,
  Target, Zap, Music, Camera, Plane, ShoppingCart, Wallet, Clock, Bell, Mail,
  Paperclip, Lock, Flag, Award, GraduationCap, Globe, Wrench, Film, Headphones,
  Map, Cloud, Cpu, Smartphone, Key, Shield, Package, Gift, type LucideProps,
} from "lucide-react";

export type Task = { id: string; text: string; done: boolean; createdAt: number; deletedAt?: number };
export type Theme = "light" | "dark";
export type NoteColor = "yellow" | "pink" | "blue" | "green" | "purple" | "orange";
export type PomodoroMode = "focus" | "break";

export type AppSettings = {
  fontSize: number;
  fontFamily: string;
  accentColor: string;
  alwaysOnTopDefault: boolean;
  stickToDesktop: boolean;
};

export type NoteFolder = { id: string; name: string; icon: string; createdAt: number; deletedAt?: number };
export type Note = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  icon: string;
  folderId: string | null;
  createdAt: number;
  format?: "md" | "txt";
  tags?: string[];
  favorite?: boolean;
  deletedAt?: number;
};

export const NOTE_COLORS: { id: NoteColor; label: string; light: string; dark: string }[] = [
  { id: "yellow", label: "Yellow", light: "#fffde7", dark: "#3d3a1f" },
  { id: "pink", label: "Pink", light: "#fce4ec", dark: "#3d1f2a" },
  { id: "blue", label: "Blue", light: "#e3f2fd", dark: "#1f2a3d" },
  { id: "green", label: "Green", light: "#e8f5e9", dark: "#1f3d24" },
  { id: "purple", label: "Purple", light: "#f3e5f5", dark: "#2a1f3d" },
  { id: "orange", label: "Orange", light: "#fff3e0", dark: "#3d2a1f" },
];

export const ICON_BANK: { id: string; Icon: ComponentType<LucideProps>; label: string }[] = [
  { id: "sticky-note", Icon: StickyNote, label: "Note" },
  { id: "folder", Icon: Folder, label: "Folder" },
  { id: "book", Icon: Book, label: "Book" },
  { id: "bookmark", Icon: Bookmark, label: "Bookmark" },
  { id: "briefcase", Icon: Briefcase, label: "Work" },
  { id: "calendar", Icon: Calendar, label: "Calendar" },
  { id: "check", Icon: Check, label: "Check" },
  { id: "check-circle", Icon: CheckCircle, label: "Done" },
  { id: "folder-check", Icon: FolderCheck, label: "Folder check" },
  { id: "code", Icon: Code, label: "Code" },
  { id: "coffee", Icon: Coffee, label: "Coffee" },
  { id: "flame", Icon: Flame, label: "Flame" },
  { id: "heart", Icon: Heart, label: "Heart" },
  { id: "home", Icon: Home, label: "Home" },
  { id: "lightbulb", Icon: Lightbulb, label: "Lightbulb" },
  { id: "list", Icon: List, label: "List" },
  { id: "pencil", Icon: Pencil, label: "Pencil" },
  { id: "star", Icon: Star, label: "Star" },
  { id: "target", Icon: Target, label: "Target" },
  { id: "zap", Icon: Zap, label: "Energy" },
  { id: "music", Icon: Music, label: "Music" },
  { id: "camera", Icon: Camera, label: "Camera" },
  { id: "plane", Icon: Plane, label: "Travel" },
  { id: "shopping-cart", Icon: ShoppingCart, label: "Shopping" },
  { id: "wallet", Icon: Wallet, label: "Money" },
  { id: "clock", Icon: Clock, label: "Time" },
  { id: "bell", Icon: Bell, label: "Reminder" },
  { id: "mail", Icon: Mail, label: "Mail" },
  { id: "paperclip", Icon: Paperclip, label: "Attachment" },
  { id: "lock", Icon: Lock, label: "Private" },
  { id: "flag", Icon: Flag, label: "Flag" },
  { id: "award", Icon: Award, label: "Award" },
  { id: "graduation-cap", Icon: GraduationCap, label: "Study" },
  { id: "globe", Icon: Globe, label: "Web" },
  { id: "wrench", Icon: Wrench, label: "Fix" },
  { id: "film", Icon: Film, label: "Movie" },
  { id: "headphones", Icon: Headphones, label: "Audio" },
  { id: "map", Icon: Map, label: "Places" },
  { id: "cloud", Icon: Cloud, label: "Cloud" },
  { id: "cpu", Icon: Cpu, label: "Tech" },
  { id: "smartphone", Icon: Smartphone, label: "Phone" },
  { id: "key", Icon: Key, label: "Key" },
  { id: "shield", Icon: Shield, label: "Security" },
  { id: "package", Icon: Package, label: "Package" },
  { id: "gift", Icon: Gift, label: "Gift" },
];

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  accentColor: "#4caf50",
  alwaysOnTopDefault: true,
  stickToDesktop: false,
};

/** v0.1.12: font options, now including the most-used coding fonts —
 *  Fira Code, Source Code Pro and Hack — next to JetBrains Mono (issue #28). */
export const FONT_OPTIONS = [
  { id: "system", label: "System", value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: "serif", label: "Serif", value: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Monospace", value: '"SF Mono", "Cascadia Code", Consolas, monospace' },
  { id: "jetbrains", label: "JetBrains Mono", value: '"JetBrains Mono", "SF Mono", "Cascadia Code", Consolas, monospace' },
  { id: "fira", label: "Fira Code", value: '"Fira Code", "SF Mono", "Cascadia Code", Consolas, monospace' },
  { id: "source", label: "Source Code Pro", value: '"Source Code Pro", "SF Mono", "Cascadia Code", Consolas, monospace' },
  { id: "hack", label: "Hack", value: '"Hack", "SF Mono", "Cascadia Code", Consolas, monospace' },
  { id: "rounded", label: "Rounded", value: '"Segoe UI", system-ui, sans-serif' },
  { id: "casual", label: "Casual", value: '"Comic Sans MS", "Chalkboard SE", cursive' },
];

export const ACCENT_OPTIONS = ["#4caf50", "#2196f3", "#ff9800", "#e91e63", "#9c27b0", "#00bcd4", "#f44336", "#795548"];

export const TAG_PALETTE = ["#e91e63", "#9c27b0", "#2196f3", "#00bcd4", "#4caf50", "#ff9800", "#795548", "#f44336"];

/** Deterministic color for a tag, so the same tag always looks the same. */
export function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

export const FOCUS_SECONDS = 25 * 60;
export const BREAK_SECONDS = 5 * 60;

export function playBeep() {
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
  } catch (e) {
    console.warn("Could not play sound:", e);
  }
}

export function getIcon(iconId: string) {
  return ICON_BANK.find((i) => i.id === iconId) || ICON_BANK[0];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ===== v0.1.7: lightweight syntax highlighting for fenced code blocks (issue #18) =====

/** Keyword sets per language family (kept small and readable). */
const KEYWORDS: Record<string, string[]> = {
  python: ["def", "class", "return", "if", "elif", "else", "for", "while", "import", "from", "as", "in", "is", "not", "and", "or", "None", "True", "False", "try", "except", "finally", "with", "lambda", "pass", "break", "continue", "global", "raise", "assert", "yield", "del", "async", "await", "self", "print", "range", "len"],
  js: ["function", "const", "let", "var", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new", "class", "extends", "import", "export", "from", "default", "typeof", "instanceof", "null", "undefined", "true", "false", "this", "async", "await", "try", "catch", "finally", "throw", "of", "in", "delete", "void", "yield", "static", "get", "set"],
  rust: ["fn", "let", "mut", "const", "static", "return", "if", "else", "match", "loop", "while", "for", "in", "struct", "enum", "impl", "trait", "use", "mod", "pub", "crate", "self", "super", "where", "as", "move", "async", "await", "dyn", "ref", "break", "continue", "true", "false", "Some", "None", "Ok", "Err"],
  cpp: ["int", "float", "double", "char", "bool", "void", "long", "short", "unsigned", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "class", "struct", "public", "private", "protected", "new", "delete", "this", "namespace", "using", "template", "const", "nullptr", "true", "false", "auto", "include", "virtual", "override"],
  bash: ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "echo", "export", "local", "return", "source", "set", "cd", "in"],
  json: ["true", "false", "null"],
  yaml: ["true", "false", "null", "yes", "no"],
  sql: ["select", "from", "where", "insert", "into", "values", "update", "set", "delete", "create", "table", "join", "left", "right", "inner", "outer", "on", "group", "by", "order", "limit", "as", "and", "or", "not", "null", "primary", "key"],
};

/** Normalize a fence language tag like "Python" or "py" to a keyword family. */
function normLang(raw: string): string {
  const l = raw.trim().toLowerCase();
  const aliases: Record<string, string> = {
    py: "python", python3: "python", javascript: "js", node: "js",
    ts: "ts", typescript: "ts", jsx: "js", tsx: "ts",
    rust: "rust", rs: "rust",
    c: "cpp", cpp: "cpp", "c++": "cpp", cc: "cpp", h: "cpp", hpp: "cpp", java: "cpp", kotlin: "cpp", go: "cpp", swift: "cpp",
    sh: "bash", shell: "bash", zsh: "bash", console: "bash", terminal: "bash",
    json: "json", yml: "yaml", yaml: "yaml",
    sql: "sql", postgres: "sql", mysql: "sql", sqlite: "sql",
  };
  if (aliases[l]) return aliases[l];
  if (KEYWORDS[l]) return l;
  return l ? "generic" : "";
}

/** True when the language uses "#" for line comments. */
function hashComments(lang: string): boolean {
  return lang === "python" || lang === "bash" || lang === "yaml";
}

/** Tokenize raw code once and wrap tokens in colored spans.
 *  Supports keywords, strings, comments, numbers and function calls.
 *  Unknown languages still get strings and numbers colored. */
export function highlightCode(code: string, langRaw: string): string {
  const lang = normLang(langRaw);
  const kwList = KEYWORDS[lang] || [];
  const kwSet = new Set(kwList);

  const parts: string[] = [];
  const alternatives: string[] = [];
  if (lang) {
    alternatives.push(hashComments(lang) ? "#[^\\n]*" : "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/");
  }
  alternatives.push('"[^"\\n]*"|' + "'[^'\\n]*'");
  if (lang === "js" || lang === "ts" || lang === "rust") alternatives.push("`[^`]*`");
  if (kwList.length) alternatives.push("\\b(?:" + kwList.join("|") + ")\\b");
  alternatives.push("\\b\\d+(?:\\.\\d+)?\\b");
  alternatives.push("\\b[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()");
  const master = new RegExp("(" + alternatives.join(")|(") + ")", "g");

  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = master.exec(code)) !== null) {
    parts.push(escapeHtml(code.slice(last, m.index)));
    const tok = m[0];
    let cls = "";
    if (tok.startsWith("#") || tok.startsWith("//") || tok.startsWith("/*")) cls = "tok-com";
    else if (tok.startsWith('"') || tok.startsWith("'") || tok.startsWith("`")) cls = "tok-str";
    else if (kwSet.has(tok)) cls = "tok-kw";
    else if (/^\d/.test(tok)) cls = "tok-num";
    else cls = "tok-fn";
    parts.push('<span class="' + cls + '">' + escapeHtml(tok) + "</span>");
    last = m.index + tok.length;
  }
  parts.push(escapeHtml(code.slice(last)));
  return parts.join("");
}

/** v0.1.13: guess the language of an untagged fenced code block from its
 *  content, so the macOS-style title bar can name it (issue #30).
 *  Checks the strongest signatures first; returns "" when unsure. */
export function detectLang(code: string): string {
  const s = code.slice(0, 4000);
  if (/^\s*(<!DOCTYPE|<html\b|\s*<[a-z]+[\s>])/i.test(s) || /<\/[a-z]+>/i.test(s)) return "html";
  if (/^\s*[{[][\s\S]*[}\]]\s*$/.test(s) && /"[A-Za-z_]+"\s*:/.test(s)) return "json";
  if (/(\bfn\s+[A-Za-z_]\w*\s*\(|\blet\s+mut\b|\bimpl\s+[A-Za-z_]|\bmatch\s+\w+\s*\{)/.test(s)) return "rust";
  if (/(\bdef\s+[A-Za-z_]\w*\s*\(|^\s*import\s+\w+|\bprint\s*\(|\belif\b)/m.test(s)) return "python";
  if (/(#include\s*<|\bstd::|int\s+main\s*\()/.test(s)) return "cpp";
  if (/(\bpackage\s+main\b|\bfunc\s+[A-Za-z_]\w*\s*\()/.test(s)) return "go";
  if (/\bSELECT\b[\s\S]*\bFROM\b/i.test(s)) return "sql";
  if (/^\s*[.#@][\w-]+[^{\n]*\{|^[a-z-]+\s*:\s*[^;{}]+;\s*$/m.test(s)) return "css";
  if (/^\s*(\$|sudo |apt |npm |yarn |git |cd |ls |echo |export |#!)/m.test(s)) return "bash";
  if (/\b(function\s|const\s|let\s|=>|console\.log\b)/.test(s)) return "js";
  if (/^\s*[a-z-]+\s*:\s*\S/m.test(s) && !/[{};]/.test(s)) return "yaml";
  return "";
}

/** Inline markdown: code, bold, italic, strikethrough, images, links.
 *  v0.1.10: ==highlight== marks and colored <span style="color: ..."> text (issue #24).
 *  v0.1.11: embedded audio players via [[audio|data:...]] (issue #26). */
function inlineMd(s: string): string {
  return s
    // v0.1.10: re-allow a single colored-span form so text color works in
    // the preview (the raw HTML was escaped above; this un-escapes just
    // this exact pattern, everything else stays escaped and safe).
    .replace(/&lt;span style=&quot;color:\s*([^&]+)&quot;&gt;([\s\S]*?)&lt;\/span&gt;/g, '<span style="color:$1">$2</span>')
    // v0.1.10: ==text== marker highlight, MacDown/Obsidian style.
    .replace(/==([^=\n]+)==/g, '<mark class="md-highlight">$1</mark>')
    // v0.1.11: [[audio|<src>]] renders as an inline audio player kept in the note (issue #26).
    .replace(/\[\[audio\|([^\]\n]+)\]\]/g, '<audio class="md-audio" controls preload="metadata" src="$1"></audio>')
    .replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/(^|[^A-Za-z0-9_])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^A-Za-z0-9_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    // v0.1.11: images also accept data: URIs so uploaded photos render (issue #26).
    .replace(/!\[([^\]\n]*)\]\(((?:https?:\/\/|data:)[^\s)]+)\)/g, '<img class="md-img" src="$2" alt="$1" loading="lazy" />')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_all: string, pre: string, url: string) {
      const trimmed = url.replace(/&quot;$/, "");
      const tail = url.slice(trimmed.length);
      return pre + '<a class="md-link" href="' + trimmed + '" target="_blank" rel="noopener noreferrer">' + trimmed + "</a>" + tail;
    });
}

/** Split a markdown table row into trimmed cells. */
function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

/** Column alignment from a table separator row like |:---|:-:|---:| */
function tableAligns(sep: string): string[] {
  return splitTableRow(sep).map(function (c) {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
}

/** Live markdown to HTML with proper escaping. Supports headings (h1-h6),
 *  bold, italic, strikethrough, inline and fenced code (with language label
 *  and syntax coloring), nested bullet/numbered lists, interactive task
 *  checkboxes, blockquotes (multi-line merged), pipe tables with alignment,
 *  images (http and uploaded data URIs), audio players, column grids,
 *  links and horizontal rules. */
export function markdownToHtml(md: string): string {
  if (!md.trim()) return "";

  const codeBlocks: string[] = [];
  let text = md.replace(/```([\w#+.-]*)\n?([\s\S]*?)```/g, function (_all: string, lang: string, code: string) {
    codeBlocks.push(lang + " LANG" + code.replace(/\n+$/, ""));
    return " CB" + (codeBlocks.length - 1) + " ";
  });
  text = escapeHtml(text);

  const out: string[] = [];
  let taskIdx = 0;
  const listStack: { tag: string; indent: number }[] = [];
  const closeListsTo = function (depth: number) {
    while (listStack.length > depth) {
      out.push("</" + (listStack.pop() as { tag: string }).tag + ">");
    }
  };
  const closeAllLists = function () { closeListsTo(0); };

  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const cb = line.match(/^ CB(\d+) $/);
    if (cb) {
      closeAllLists();
      out.push(cb[0]);
      i += 1;
      continue;
    }
    if (!line.trim()) {
      closeAllLists();
      i += 1;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeAllLists();
      out.push('<hr class="md-hr">');
      i += 1;
      continue;
    }

    // v0.1.11: photo column grids — ":::N" opens an N-column grid,
    // ":::" closes it (issue #26).
    const gridOpen = line.match(/^:::([1-4])\s*$/);
    if (gridOpen) {
      closeAllLists();
      out.push('<div class="md-cols md-cols-' + gridOpen[1] + '">');
      i += 1;
      continue;
    }
    if (/^:::\s*$/.test(line)) {
      closeAllLists();
      out.push("</div>");
      i += 1;
      continue;
    }

    // Table: a header row containing | followed by a separator row
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      lines[i + 1].includes("-") &&
      /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])
    ) {
      closeAllLists();
      const headerCells = splitTableRow(line);
      const aligns = tableAligns(lines[i + 1]);
      let html = '<table class="md-table"><thead><tr>';
      headerCells.forEach(function (c, ci) {
        html += '<th style="text-align:' + (aligns[ci] || "left") + '">' + inlineMd(c) + "</th>";
      });
      html += "</tr></thead><tbody>";
      let j = i + 2;
      while (j < lines.length && lines[j].trim() && lines[j].includes("|")) {
        const cells = splitTableRow(lines[j]);
        html += "<tr>";
        cells.forEach(function (c, ci) {
          html += '<td style="text-align:' + (aligns[ci] || "left") + '">' + inlineMd(c) + "</td>";
        });
        html += "</tr>";
        j += 1;
      }
      html += "</tbody></table>";
      out.push(html);
      i = j;
      continue;
    }

    // Blockquote: merge consecutive > lines into one block
    const q = line.match(/^\s*&gt;\s?(.*)$/);
    if (q) {
      closeAllLists();
      const quoted: string[] = [q[1]];
      let j = i + 1;
      while (j < lines.length) {
        const q2 = lines[j].match(/^\s*&gt;\s?(.*)$/);
        if (!q2) break;
        quoted.push(q2[1]);
        j += 1;
      }
      out.push('<div class="md-quote">' + inlineMd(quoted.join(" ")) + "</div>");
      i = j;
      continue;
    }

    const headMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headMatch) {
      closeAllLists();
      out.push('<div class="md-h md-h' + headMatch[1].length + '">' + inlineMd(headMatch[2]) + "</div>");
      i += 1;
      continue;
    }

    const task = line.match(/^(\s*)[-*]\s+\[( |x|X)\]\s+(.*)$/);
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    const num = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    const listMatch = task || bullet || num;
    if (listMatch) {
      const lead = (listMatch[1] || "").replace(/\t/g, "  ");
      const indent = Math.floor(lead.length / 2);
      const tag = num ? "ol" : "ul";
      while (listStack.length && listStack[listStack.length - 1].indent > indent) {
        out.push("</" + (listStack.pop() as { tag: string }).tag + ">");
      }
      const top = listStack[listStack.length - 1];
      if (!top || top.indent < indent) {
        listStack.push({ tag: tag, indent: indent });
        out.push("<" + tag + ' class="md-list' + (task ? " md-task-list" : "") + '">');
      } else if (top.indent === indent && top.tag !== tag) {
        out.push("</" + (listStack.pop() as { tag: string }).tag + ">");
        listStack.push({ tag: tag, indent: indent });
        out.push("<" + tag + ' class="md-list' + (task ? " md-task-list" : "") + '">');
      }
      if (task) {
        const done = task[2].toLowerCase() === "x";
        out.push(
          '<li class="md-task' + (done ? " done" : "") + '"><span class="md-checkbox" data-task="' + taskIdx +
          '" data-done="' + (done ? 1 : 0) + '"></span>' + inlineMd(task[3]) + "</li>"
        );
        taskIdx += 1;
      } else if (num) {
        out.push("<li>" + inlineMd(num[2]) + "</li>");
      } else if (bullet) {
        out.push("<li>" + inlineMd(bullet[2]) + "</li>");
      }
      i += 1;
      continue;
    }

    closeAllLists();
    out.push('<div class="md-p">' + inlineMd(line) + "</div>");
    i += 1;
  }
  closeAllLists();

  return out.join("").replace(/ CB(\d+) $/g, function (_all: string, idx: string) {
    const raw = codeBlocks[Number(idx)];
    const sep = raw.indexOf(" LANG");
    const lang = sep >= 0 ? raw.slice(0, sep) : "";
    const code = sep >= 0 ? raw.slice(sep + 5) : raw;
    // v0.1.13: macOS-style code window — red/yellow/green traffic lights in
    // the title bar, language name on the right side, rendered live by the
    // preview while you edit inside the block (issue #30). Untagged blocks
    // get their language auto-detected from the code itself.
    const display = (lang || detectLang(code)).toLowerCase();
    const label = display ? '<span class="md-code-lang">' + escapeHtml(display) + "</span>" : "";
    return (
      '<div class="md-code-window"><div class="md-code-titlebar">' +
      '<span class="md-dot md-dot-red"></span><span class="md-dot md-dot-yellow"></span><span class="md-dot md-dot-green"></span>' +
      label +
      "</div>" +
      // v0.1.7: syntax coloring inside fenced blocks (issue #18)
      '<pre class="md-code-block"><code>' + highlightCode(code, lang || display) + "</code></pre></div>"
    );
  });
}

/** Render plain text (no markdown parsing) as escaped paragraphs. */
export function plainToHtml(text: string): string {
  if (!text.trim()) return "";
  return text
    .split("\n")
    .map(function (l) { return '<div class="md-p">' + escapeHtml(l) + "</div>"; })
    .join("");
}
