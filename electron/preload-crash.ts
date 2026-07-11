import electron from 'electron';
const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args),

  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  send: (channel: string, ...args: unknown[]) =>
    ipcRenderer.send(channel, ...args),

  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('crash:closeWindow'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onResized: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('window:resized', handler);
    return () => ipcRenderer.removeListener('window:resized', handler);
  },

  getTheme: () => ipcRenderer.invoke('window:getTheme'),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
});
