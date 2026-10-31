import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
// v0.1.12: popular coding fonts for the Settings font picker (issue #28).
// v0.1.19: Hack removed - @fontsource/hack does not exist on npm and broke
// npm install (issue #44).
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/700.css";
import "@fontsource/source-code-pro/400.css";
import "@fontsource/source-code-pro/700.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
