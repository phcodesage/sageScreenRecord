const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getVideoSources: () => ipcRenderer.invoke('get-video-sources'),
  saveRecording: (buffer) => ipcRenderer.invoke('save-recording', buffer)
});

