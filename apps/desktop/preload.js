// =========================================================================
// Electron Preload Script — expose safe APIs to renderer
// =========================================================================

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
});
