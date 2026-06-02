import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Show any crash on screen instead of white screen
window.onerror = (msg, src, line, col, err) => {
  document.getElementById('root').innerHTML = `
    <div style="background:#0d0d14;color:#ef4444;padding:32px;font-family:monospace;min-height:100vh">
      <div style="color:#f59e0b;font-size:18px;margin-bottom:16px">FreeTime — Startup Error</div>
      <div style="margin-bottom:8px"><b>Message:</b> ${msg}</div>
      <div style="margin-bottom:8px"><b>Source:</b> ${src}</div>
      <div style="margin-bottom:8px"><b>Line:</b> ${line} Col: ${col}</div>
      <div style="color:#6b6b8a;font-size:12px;margin-top:24px">Screenshot this and send it to support</div>
    </div>`;
};

window.onunhandledrejection = (e) => {
  document.getElementById('root').innerHTML = `
    <div style="background:#0d0d14;color:#ef4444;padding:32px;font-family:monospace;min-height:100vh">
      <div style="color:#f59e0b;font-size:18px;margin-bottom:16px">FreeTime — Unhandled Error</div>
      <div>${e.reason?.message || String(e.reason)}</div>
      <div style="color:#6b6b8a;font-size:12px;margin-top:24px">Screenshot this and send it to support</div>
    </div>`;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
