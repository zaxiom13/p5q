const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qanvas5Desktop', {
  getRuntimeStatus: () => ipcRenderer.invoke('runtime:get-status'),
  autoConfigureRuntime: () => ipcRenderer.invoke('runtime:auto-configure'),
  chooseRuntimeBinary: () => ipcRenderer.invoke('runtime:choose-binary'),
  clearRuntimeBinary: () => ipcRenderer.invoke('runtime:clear-binary'),
  getUpdateState: () => ipcRenderer.invoke('updates:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdateNow: () => ipcRenderer.invoke('updates:install'),
  onUpdateState: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('updates:state', wrapped);
    return () => ipcRenderer.removeListener('updates:state', wrapped);
  },
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  getServerOrigin: () => ipcRenderer.invoke('app:get-server-origin'),
  getPlatformInfo: () => ipcRenderer.invoke('app:get-platform-info')
});
