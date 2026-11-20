const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jam', {
  addons: () => ipcRenderer.invoke('addons:state'),
  setAddon: (key,value) => ipcRenderer.invoke('addons:set',key,value),
  mode: value => ipcRenderer.invoke('app:mode', value),
  room: action => ipcRenderer.invoke('room:' + ({ start:'start', stop:'stop', state:'state', copy:'copy', qr:'qr', internet:'internet', local:'local' }[action] || 'state')),
  state: () => ipcRenderer.invoke('jam:state'),
  join: invite => ipcRenderer.invoke('jam:join', invite),
  host: () => ipcRenderer.invoke('jam:host'),
  leave: () => ipcRenderer.invoke('jam:leave'),
  command: (op, fields) => ipcRenderer.invoke('jam:command', op, fields),
  tab: tab => ipcRenderer.invoke('app:tab', tab),
  retry: () => ipcRenderer.invoke('app:retry'),
  copy: () => ipcRenderer.invoke('jam:copy'),
  qr: () => ipcRenderer.invoke('jam:qr'),
  onState: callback => { const listener = (_e, state) => callback(state); ipcRenderer.on('jam:state', listener); return () => ipcRenderer.removeListener('jam:state', listener); },
  onPlayer: callback => { const listener = (_e, state) => callback(state); ipcRenderer.on('player:state', listener); return () => ipcRenderer.removeListener('player:state', listener); }
});
