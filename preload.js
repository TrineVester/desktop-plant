const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('plantApi', {
  getState: () => ipcRenderer.invoke('plant:getState'),
  water: () => ipcRenderer.invoke('plant:water'),
  fertilize: () => ipcRenderer.invoke('plant:fertilize'),
  reset: () => ipcRenderer.invoke('plant:reset'),
  moveWindow: (x, y) => ipcRenderer.send('plant:move', { x, y })
});
