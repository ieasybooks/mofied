import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Installation stays in the browser's menu; do not show its automatic banner.
window.addEventListener("beforeinstallprompt", (event) =>
  event.preventDefault(),
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
