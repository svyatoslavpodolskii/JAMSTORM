const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jam', {
  material:value=>ipcRenderer.invoke('app:material',value),visuals:value=>ipcRenderer.invoke('app:visuals',value),
  onAmbient:callback=>{ipcRenderer.on('app:ambient',(_e,value)=>callback(value));},onLevel:callback=>{ipcRenderer.on('app:level',(_e,value)=>callback(value));},
  panels:()=>ipcRenderer.invoke('app:panels'),queue:()=>ipcRenderer.invoke('app:queue'),lyrics:track=>ipcRenderer.invoke('app:lyrics',track),panel:value=>ipcRenderer.invoke('app:panel',value),
  onFullscreen:callback=>{ipcRenderer.on('app:fullscreen',(_e,value)=>callback(value));},
  onBackdrop:callback=>{ipcRenderer.on('app:backdrop',(_e,value)=>callback(value));},
  onPanel:callback=>{ipcRenderer.on('app:panel',(_e,value)=>callback(value));},
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
