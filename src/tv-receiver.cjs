'use strict';
const {WebContentsView}=require('electron'),fs=require('node:fs'),path=require('node:path');
class TVReceiver{
 constructor({parent,session,userAgent,muted=false,onPlayback,policy,onState}){Object.assign(this,{parent,session,userAgent,muted,onPlayback,policy,onState});this.view=null;this.loading=null;this.visible=false;}
 contents(){return this.view&&!this.view.webContents.isDestroyed()?this.view.webContents:null;}
 handles(wc){return this.contents()===wc;}
 layout(){if(!this.view||this.parent.isDestroyed())return;const [width,height]=this.parent.getContentSize(),top=this.parent.isFullScreen()?60:72;this.view.setBounds({x:0,y:top,width,height:Math.max(1,height-top)});this.view.setVisible(this.visible);}
 hide(){this.visible=false;this.layout();this.onState?.(false);}
 open(login=false){if(this.opening)return this.opening;this.opening=this.doOpen(login).finally(()=>this.opening=null);return this.opening;}
 async doOpen(login=false){
  if(!this.contents()){
   this.view=new WebContentsView({webPreferences:{session:this.session,preload:path.join(__dirname,'music-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});this.view.setBackgroundColor('#101319');this.parent.contentView.addChildView(this.view);
   const wc=this.contents();wc.setAudioMuted(this.muted);wc.setUserAgent(this.userAgent);wc.setWindowOpenHandler(()=>({action:'deny'}));
   wc.on('will-navigate',(event,url)=>{if(!url.startsWith('https://www.youtube.com/tv'))event.preventDefault();});
   wc.on('did-finish-load',()=>{if(!wc.getURL().startsWith('https://www.youtube.com/tv'))return;wc.insertCSS(fs.readFileSync(path.join(__dirname,'tv-theme.css'),'utf8')).catch(()=>{});wc.send('filter:enabled',this.policy());});
   wc.on('media-started-playing',()=>this.onPlayback?.());
   wc.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F11'&&!input.isAutoRepeat){event.preventDefault();this.parent.setFullScreen(!this.parent.isFullScreen());}});
   this.loading=(async()=>{await wc.loadURL('about:blank');wc.debugger.attach('1.3');await wc.debugger.sendCommand('Page.enable');if(this.muted)await wc.debugger.sendCommand('Emulation.setFocusEmulationEnabled',{enabled:true});await wc.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(__dirname,'page-hooks.js'),'utf8')});await wc.debugger.sendCommand('Emulation.setUserAgentOverride',{userAgent:this.userAgent,userAgentMetadata:{brands:[{brand:'JamDesktop',version:'27'}],fullVersionList:[{brand:'JamDesktop',version:'27.lts.3'}],platform:'Starboard',platformVersion:'',architecture:'x86',model:'',mobile:false,bitness:'64',wow64:false}});await wc.loadURL('https://www.youtube.com/tv#/');})();
  }
  this.visible=true;this.layout();this.onState?.(true);try{await this.loading;}catch(error){this.close();throw error;}
  if(!this.muted)this.contents().focus();
  if(login&&await this.status()!==true&&!await this.contents().executeJavaScript(require('./accounts.cjs').tvLoginScript))throw Error('TV sign-in is not ready');return {open:true};
 }
 async status(){return this.contents()?.executeJavaScript(require('./accounts.cjs').tvScript);}
 pause(){this.contents()?.executeJavaScript(`document.querySelector('video')?.pause()`).catch(()=>{});}
 close(){const view=this.view;this.view=null;this.loading=null;this.visible=false;if(view){if(!this.parent.isDestroyed())this.parent.contentView.removeChildView(view);if(!view.webContents.isDestroyed())view.webContents.close({waitForBeforeUnload:false});}this.onState?.(false);}
}
module.exports={TVReceiver};
