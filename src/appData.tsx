import { type ComponentType } from "react";
import {
  StickyNote, Book, Bookmark, Briefcase, Calendar, Check, CheckCircle, Clock,
  Code, Coffee, Flame, Folder, Heart, Home, Lightbulb, List, Pencil, Star,
  Target, Zap, type LucideProps,
} from "lucide-react";

export type Task = { id: string; text: string; done: boolean; createdAt: number };
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

export type NoteFolder = { id: string; name: string; icon: string; createdAt: number };
export type Note = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  icon: string;
  folderId: string | null;
  createdAt: number;
  format?: "md" | "txt";
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
  { id: "clock", Icon: Clock, label: "Clock" },
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
];

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  accentColor: "#4caf50",
  alwaysOnTopDefault: true,
  stickToDesktop: false,
};

export const FONT_OPTIONS = [
  { id: "system", label: "System", value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: "serif", label: "Serif", value: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Monospace", value: '"SF Mono", "Cascadia Code", Consolas, monospace' },
  { id: "rounded", label: "Rounded", value: '"Segoe UI", system-ui, sans-serif' },
  { id: "casual", label: "Casual", value: '"Comic Sans MS", "Chalkboard SE", cursive' },
];

export const ACCENT_OPTIONS = ["#4caf50", "#2196f3", "#ff9800", "#e91e63", "#9c27b0", "#00bcd4", "#f44336", "#795548"];

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

/** Inline markdown: code, bold, italic, strikethrough, images, links. */
function inlineMd(s: string): string {
  return s
    .replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/(^|[^A-Za-z0-9_])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^A-Za-z0-9_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    .replace(/!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img class="md-img" src="$2" alt="$1" loading="lazy" />')
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
 *  bold, italic, strikethrough, inline and fenced code (with language label),
 *  nested bullet/numbered lists, interactive task checkboxes, blockquotes
 *  (multi-line merged), pipe tables with alignment, images, links and
 *  horizontal rules. */
export function markdownToHtml(md: string): string {
  if (!md.trim()) return "";

  const codeBlocks: string[] = [];
  let text = md.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_all: string, lang: string, code: string) {
    codeBlocks.push(lang + "\u0000LANG" + code.replace(/\n+$/, ""));
    return "\u0000CB" + (codeBlocks.length - 1) + "\u0000";
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

    const cb = line.match(/^\u0000CB(\d+)\u0000$/);
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
          '" data-done="' + (done ? 1 : 0) + '">' + (done ? "\u2611" : "\u2610") + "</span>" + inlineMd(task[3]) + "</li>"
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

  return out.join("").replace(/\u0000CB(\d+)\u0000/g, function (_all: string, idx: string) {
    const raw = codeBlocks[Number(idx)];
    const sep = raw.indexOf("\u0000LANG");
    const lang = sep >= 0 ? raw.slice(0, sep) : "";
    const code = sep >= 0 ? raw.slice(sep + 5) : raw;
    const label = lang ? '<div class="md-code-lang">' + lang + "</div>" : "";
    return label + '<pre class="md-code-block"><code>' + escapeHtml(code) + "</code></pre>";
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
