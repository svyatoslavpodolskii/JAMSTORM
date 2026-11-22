const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('appearancePanel',{event:value=>ipcRenderer.send('appearance:event',value),onSnapshot:fn=>ipcRenderer.on('appearance:snapshot',(_e,value)=>fn(value))});
