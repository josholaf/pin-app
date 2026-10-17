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

/** Live markdown → HTML (bold, italic, code, lists, tasks). */
export function markdownToHtml(md: string): string {
  const esc = md
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
  return esc
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\*])\*([^\*]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^- \[ \] (.+)$/gm, '<div class="md-task">☐ $1</div>')
    .replace(/^- \[x\] (.+)$/gim, '<div class="md-task done">☑ $1</div>')
    .replace(/^- (.+)$/gm, '<div class="md-li">• $1</div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="md-oli">$1</div>')
    .replace(/\n/g, "<br>");
}
