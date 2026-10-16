export type AppSettings = {
  fontSize: number;
  fontFamily: string;
  accentColor: string;
  alwaysOnTopDefault: boolean;
  stickToDesktop: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 14,
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  accentColor: "#4caf50",
  alwaysOnTopDefault: true,
  stickToDesktop: false,
};

export const FONT_OPTIONS = [
  {
    id: "system",
    label: "System",
    value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    id: "serif",
    label: "Serif",
    value: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "mono",
    label: "Monospace",
    value: '"SF Mono", "Cascadia Code", Consolas, monospace',
  },
  {
    id: "rounded",
    label: "Rounded",
    value: '"Segoe UI", system-ui, sans-serif',
  },
  {
    id: "casual",
    label: "Casual",
    value: '"Comic Sans MS", "Chalkboard SE", cursive',
  },
];

export const ACCENT_OPTIONS = [
  "#4caf50",
  "#2196f3",
  "#ff9800",
  "#e91e63",
  "#9c27b0",
  "#00bcd4",
  "#f44336",
  "#795548",
];
