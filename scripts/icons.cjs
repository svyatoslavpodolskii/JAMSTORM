'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const root = path.join(__dirname, '..'), svg = fs.readFileSync(path.join(root, 'assets/icon-source.svg'));
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, sandbox: true, contextIsolation: true } });
  await win.loadURL('data:text/html,<canvas></canvas>');
  const entries = [];
  for (const size of [16,32,48,64,128,256]) {
    const data = await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const c=document.querySelector('canvas');c.width=c.height=${size};c.getContext('2d').drawImage(image,0,0,${size},${size});resolve(c.toDataURL('image/png').split(',')[1]);};image.onerror=reject;image.src='data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}';})`);
    entries.push({ size, png: Buffer.from(data, 'base64') });
  }
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'assets/icon.png'),entries.at(-1).png);
  const header=Buffer.alloc(6+entries.length*16); header.writeUInt16LE(1,2); header.writeUInt16LE(entries.length,4); let offset=header.length;
  entries.forEach(({size,png},i)=>{const p=6+i*16; header[p]=header[p+1]=size===256?0:size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(png.length,p+8);header.writeUInt32LE(offset,p+12);offset+=png.length;});
  fs.writeFileSync(path.join(root,'assets/icon.ico'),Buffer.concat([header,...entries.map(e=>e.png)]));
  console.log('JAMSTORM icons generated');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
