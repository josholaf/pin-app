import { Settings, Moon, Sun, X } from "lucide-react";
import {
  FONT_OPTIONS, ACCENT_OPTIONS,
  type Theme, type AppSettings,
} from "./appData";

type Props = {
  theme: Theme;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  toggleTheme: () => void;
  closeWindow: () => void;
};

export function SettingsWindow(p: Props) {
  return (
    <div className="pin-window settings-window" data-tauri-drag-region style={{ fontFamily: p.settings.fontFamily }}>
      <header className="titlebar" data-tauri-drag-region>
        <span className="app-title"><Settings size={16} /> Settings</span>
        <div className="title-actions">
          <button onClick={p.toggleTheme} className="icon-btn" title="Theme">{p.theme === "light" ? <Moon size={16} /> : <Sun size={16} />}</button>
          <button onClick={p.closeWindow} className="icon-btn" title="Close"><X size={16} /></button>
        </div>
      </header>
      <div className="settings-panel settings-panel-standalone">
        <label className="settings-row">
          <span>Font style</span>
          <select className="settings-select" value={FONT_OPTIONS.find((f) => f.value === p.settings.fontFamily)?.id || "system"} onChange={(e) => {
            const opt = FONT_OPTIONS.find((f) => f.id === e.target.value);
            if (opt) p.setSettings({ ...p.settings, fontFamily: opt.value });
          }}>
            {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
        <div className="settings-row">
          <span>Accent color</span>
          <div className="accent-swatches">
            {ACCENT_OPTIONS.map((c) => (
              <button key={c} className={`accent-swatch ${p.settings.accentColor === c ? "active" : ""}`} style={{ background: c }} onClick={() => p.setSettings({ ...p.settings, accentColor: c })} />
            ))}
          </div>
        </div>
        <label className="settings-row toggle-row">
          <span>Keep notes over other windows</span>
          <input type="checkbox" checked={p.settings.alwaysOnTopDefault && !p.settings.stickToDesktop} onChange={(e) => p.setSettings({ ...p.settings, alwaysOnTopDefault: e.target.checked, stickToDesktop: e.target.checked ? false : p.settings.stickToDesktop })} />
        </label>
        <label className="settings-row toggle-row">
          <span>Stay on desktop</span>
          <input type="checkbox" checked={p.settings.stickToDesktop} onChange={(e) => p.setSettings({ ...p.settings, stickToDesktop: e.target.checked, alwaysOnTopDefault: e.target.checked ? false : p.settings.alwaysOnTopDefault })} />
        </label>
        <p className="settings-hint">Desktop mode turns off always-on-top so notes can sit behind apps.</p>
      </div>
    </div>
  );
}
