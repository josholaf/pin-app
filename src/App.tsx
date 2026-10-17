import { useState, useEffect, useRef, type ComponentType } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Store } from "@tauri-apps/plugin-store";

// Temporary restore stub — full App will be re-pushed
export default function App() {
  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1>Pin</h1>
      <p>Restoring full app… please pull the latest after the next commit.</p>
    </div>
  );
}
