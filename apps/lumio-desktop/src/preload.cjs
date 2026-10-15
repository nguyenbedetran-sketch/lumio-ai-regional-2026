"use strict";
const { contextBridge, ipcRenderer } = require("electron");

// Metadata only: no IPC, file access, shell access or credential bridge.
contextBridge.exposeInMainWorld("lumioDesktop", Object.freeze({
  platform: process.platform,
  version: "0.1.0",
  systemAudio: process.platform === "win32",
  auth: "browser-only",
}));

// Main-to-renderer only: the native Stop menu uses the same cleanup path as UI.
ipcRenderer.on("lumio:stop-capture", () => {
  window.dispatchEvent(new Event("lumio:stop-capture"));
});
