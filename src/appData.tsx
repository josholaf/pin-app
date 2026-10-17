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

/** Inline markdown: code, bold, italic, strikethrough, links. */
function inlineMd(s: string): string {
  return s
    .replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/(^|[^A-Za-z0-9_])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^A-Za-z0-9_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (_all: string, pre: string, url: string) {
      const trimmed = url.replace(/&quot;$/, "");
      const tail = url.slice(trimmed.length);
      return pre + '<a class="md-link" href="' + trimmed + '" target="_blank" rel="noopener noreferrer">' + trimmed + "</a>" + tail;
    });
}

/** Live markdown to HTML with proper escaping. Supports headings, bold,
 *  italic, strikethrough, inline and fenced code, bullet/numbered lists,
 *  interactive task checkboxes, quotes, links and horizontal rules. */
export function markdownToHtml(md: string): string {
  if (!md.trim()) return "";

  const codeBlocks: string[] = [];
  let text = md.replace(/```(\w*)\n?([\s\S]*?)```/g, function (_all: string, _lang: string, code: string) {
    codeBlocks.push(code.replace(/\n+$/, ""));
    return "\u0000CB" + (codeBlocks.length - 1) + "\u0000";
  });
  text = escapeHtml(text);

  const out: string[] = [];
  let listTag: string | null = null;
  let taskIdx = 0;
  const closeList = function () {
    if (listTag) {
      out.push("</" + listTag + ">");
      listTag = null;
    }
  };

  const lines = text.split("\n");
  for (const line of lines) {
    const cb = line.match(/^\u0000CB(\d+)\u0000$/);
    if (cb) {
      closeList();
      out.push(cb[0]);
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeList();
      out.push('<hr class="md-hr">');
      continue;
    }
    const head = line.match(/^(#{1,4})\s+(.*)$/);
    if (head) {
      closeList();
      out.push('<div class="md-h md-h' + head[1].length + '">' + inlineMd(head[2]) + "</div>");
      continue;
    }
    const task = line.match(/^(\s*)[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (task) {
      if (listTag !== "ul") {
        closeList();
        out.push('<ul class="md-list md-task-list">');
        listTag = "ul";
      }
      const done = task[2].toLowerCase() === "x";
      out.push(
        '<li class="md-task' + (done ? " done" : "") + '"><span class="md-checkbox" data-task="' + taskIdx +
        '" data-done="' + (done ? 1 : 0) + '">' + (done ? "☑" : "☐") + "</span>" + inlineMd(task[3]) + "</li>"
      );
      taskIdx += 1;
      continue;
    }
    const bullet = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bullet) {
      if (listTag !== "ul") {
        closeList();
        out.push('<ul class="md-list">');
        listTag = "ul";
      }
      out.push("<li>" + inlineMd(bullet[2]) + "</li>");
      continue;
    }
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (num) {
      if (listTag !== "ol") {
        closeList();
        out.push('<ol class="md-list">');
        listTag = "ol";
      }
      out.push("<li>" + inlineMd(num[1]) + "</li>");
      continue;
    }
    const quote = line.match(/^\s*&gt;\s?(.*)$/);
    if (quote) {
      closeList();
      out.push('<div class="md-quote">' + inlineMd(quote[1]) + "</div>");
      continue;
    }
    closeList();
    out.push('<div class="md-p">' + inlineMd(line) + "</div>");
  }
  closeList();

  return out.join("").replace(/\u0000CB(\d+)\u0000/g, function (_all: string, i: string) {
    return '<pre class="md-code-block"><code>' + escapeHtml(codeBlocks[Number(i)]) + "</code></pre>";
  });
}
