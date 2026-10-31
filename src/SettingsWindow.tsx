import { useEffect, useState } from "react";
import { Settings, Moon, Sun, X, HardDriveDownload, HardDriveUpload, Trash2, ChevronDown, Check } from "lucide-react";
import type { Store } from "@tauri-apps/plugin-store";
import { appDataDir } from "@tauri-apps/api/path";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import {
  FONT_OPTIONS, ACCENT_OPTIONS,
  type Theme, type AppSettings, type Task, type NoteFolder,
} from "./appData";

type Props = {
  theme: Theme;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  toggleTheme: () => void;
  closeWindow: () => void;
  store: Store | null;
  onResetData: () => void;
};

export function SettingsWindow(p: Props) {
  const [dataDir, setDataDir] = useState("");
  const [stats, setStats] = useState<{ notes: number; tasks: number; folders: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  // v0.1.12: smart font dropdown state (issue #28)
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [fontQuery, setFontQuery] = useState("");

  useEffect(() => {
    (async () => {
      try { setDataDir(await appDataDir()); } catch { setDataDir(""); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const s = p.store;
      if (!s) return;
      const ids = (await s.get<string[]>("noteIds")) || [];
      const tasks = (await s.get<Task[]>("tasks")) || [];
      const folders = (await s.get<NoteFolder[]>("folders")) || [];
      setStats({ notes: ids.length, tasks: tasks.length, folders: folders.length });
    })();
  }, [p.store]);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3000);
  };

  /** Export every stored value (notes, tasks, folders, preferences) as JSON. */
  const exportData = async () => {
    const s = p.store;
    if (!s) return;
    try {
      const entries = await s.entries();
      const dump: Record<string, unknown> = {};
      for (const [k, v] of entries as [string, unknown][]) dump[k] = v;
      const file = await save({
        title: "Export Pin data",
        defaultPath: "pin-backup.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!file) return;
      await writeTextFile(file, JSON.stringify(dump, null, 2));
      flash("Data exported ✔");
    } catch (e) {
      flash("Export failed: " + e);
    }
  };

  /** Import a JSON backup previously exported from Pin. */
  const importData = async () => {
    const s = p.store;
    if (!s) return;
    try {
      const file = await open({
        title: "Import Pin data",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!file) return;
      const raw = JSON.parse(await readTextFile(file as string));
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) { flash("Not a valid Pin backup"); return; }
      await s.clear();
      for (const [k, v] of Object.entries(raw)) await s.set(k, v);
      await s.save();
      flash("Data imported ✔ — restart the app to see everything");
    } catch (e) {
      flash("Import failed: " + e);
    }
  };

  /** Wipe notes, tasks, folders and preferences. */
  const clearData = async () => {
    const s = p.store;
    if (!s) return;
    const sure = window.confirm("Delete ALL notes, tasks, folders and preferences? This cannot be undone.");
    if (!sure) return;
    try {
      await s.clear();
      await s.save();
      p.onResetData();
      setStats({ notes: 0, tasks: 0, folders: 0 });
      flash("All data cleared ✔");
    } catch (e) {
      flash("Clear failed: " + e);
    }
  };

  // ===== v0.1.12: smart font dropdown helpers (issue #28) =====
  const currentFont = FONT_OPTIONS.find((f) => f.value === p.settings.fontFamily) || FONT_OPTIONS[0];
  const qf = fontQuery.trim().toLowerCase();
  const filteredFonts = qf
    ? FONT_OPTIONS.filter((f) => f.label.toLowerCase().includes(qf))
    : FONT_OPTIONS;
  const pickFont = (value: string) => {
    p.setSettings({ ...p.settings, fontFamily: value });
    setFontMenuOpen(false);
    setFontQuery("");
  };

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
        {/* v0.1.12: smart modern font dropdown (issue #28) — every option
            previews in its own font, live search, Enter picks, Esc closes. */}
        <div className="settings-row">
          <span>Font style</span>
          <div className={"font-dropdown " + (fontMenuOpen ? "open" : "")}>
            <button className="font-drop-btn" onClick={() => { setFontMenuOpen((v) => !v); setFontQuery(""); }}>
              <span className="font-drop-current" style={{ fontFamily: currentFont.value }}>{"Aa 123 · " + currentFont.label}</span>
              <ChevronDown size={15} className={"font-drop-chevron " + (fontMenuOpen ? "up" : "")} />
            </button>
            {fontMenuOpen && (
              <>
                <div className="font-drop-overlay" onClick={() => setFontMenuOpen(false)} />
                <div className="font-drop-menu">
                  <input
                    className="font-drop-search"
                    autoFocus
                    placeholder="Search fonts..."
                    value={fontQuery}
                    onChange={(e) => setFontQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { e.preventDefault(); setFontMenuOpen(false); }
                      if (e.key === "Enter") { e.preventDefault(); const f = filteredFonts[0]; if (f) pickFont(f.value); }
                    }}
                  />
                  <div className="font-drop-list">
                    {filteredFonts.map((f) => (
                      <button
                        key={f.id}
                        className={"font-drop-item " + (f.id === currentFont.id ? "active" : "")}
                        onClick={() => pickFont(f.value)}
                      >
                        <span className="font-drop-item-label" style={{ fontFamily: f.value }}>{f.label}</span>
                        <span className="font-drop-item-sample" style={{ fontFamily: f.value }}>Aa 123</span>
                        {f.id === currentFont.id && <Check size={14} className="font-drop-check" />}
                      </button>
                    ))}
                    {filteredFonts.length === 0 && <div className="font-drop-empty">No matching fonts</div>}
                  </div>
                  <div className="font-drop-hint">Enter picks the first match - Esc closes</div>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="settings-row">
          <span>Accent color</span>
          <div className="accent-swatches">
            {ACCENT_OPTIONS.map((c) => (
              <button key={c} className={`accent-swatch ${p.settings.accentColor === c ? "active" : ""}`} style={{ background: c }} onClick={() => p.setSettings({ ...p.settings, accentColor: c })} />
            ))}
          </div>
        </div>
        {/* v0.1.17: Quick Note capture title mode (issue #40) — custom
            (leading * marks the title) or date (DD-MM-YY). */}
        <div className="settings-row">
          <span>Quick note title</span>
          <div className="qn-mode-row">
            <button
              className={"qn-mode-btn " + (p.settings.captureTitleMode !== "date" ? "active" : "")}
              onClick={() => p.setSettings({ ...p.settings, captureTitleMode: "custom" })}
            >Custom (* marks it)</button>
            <button
              className={"qn-mode-btn " + (p.settings.captureTitleMode === "date" ? "active" : "")}
              onClick={() => p.setSettings({ ...p.settings, captureTitleMode: "date" })}
            >Date (DD-MM-YY)</button>
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

        <div className="storage-section">
          <span className="storage-title">Storage</span>
          <p className="storage-hint">
            Notes, tasks, folders and preferences are stored locally on this device.
          </p>
          {dataDir && <p className="storage-path" title={dataDir}>{dataDir}</p>}
          {stats && (
            <p className="storage-stats">
              {stats.notes} {stats.notes === 1 ? "note" : "notes"} · {stats.tasks} {stats.tasks === 1 ? "task" : "tasks"} · {stats.folders} {stats.folders === 1 ? "folder" : "folders"}
            </p>
          )}
          <div className="storage-btns">
            <button className="small-btn storage-btn" onClick={exportData}><HardDriveDownload size={14} /> Export data</button>
            <button className="small-btn storage-btn" onClick={importData}><HardDriveUpload size={14} /> Import data</button>
            <button className="small-btn storage-btn danger-btn" onClick={clearData}><Trash2 size={14} /> Clear all data</button>
          </div>
          {status && <p className="storage-status">{status}</p>}
        </div>
      </div>
    </div>
  );
}
