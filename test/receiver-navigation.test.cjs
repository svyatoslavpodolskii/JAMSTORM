'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events'),{createRequire}=require('node:module');
const file=require.resolve('../src/tv-receiver.cjs'),localRequire=createRequire(file);
function make(){let views=0,focuses=0,finish;class View{constructor(){views++;this.webContents=Object.assign(new EventEmitter(),{isDestroyed:()=>false,setAudioMuted(){},setUserAgent(){},setWindowOpenHandler(){},focus(){focuses++;}});}setBackgroundColor(){}setBounds(){}setVisible(){}}
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,__dirname:path.dirname(file),require:name=>name==='electron'?{WebContentsView:View}:localRequire(name)});
 const parent={isDestroyed:()=>false,isFullScreen:()=>false,getContentSize:()=>[1320,880],contentView:{addChildView(){},removeChildView(){}}},receiver=new module.exports.TVReceiver({parent,session:{},userAgent:'test',policy:()=>({})});receiver.load=()=>new Promise(resolve=>finish=resolve);return {receiver,done:()=>finish(),counts:()=>({views,focuses})};
}
test('returning to Music during TV loading does not steal focus after loading',async()=>{const {receiver,done,counts}=make(),task=receiver.open();receiver.hide();done();await task;assert.equal(receiver.visible,false);assert.equal(counts().focuses,0);});
test('reopening TV while it loads shows the same view',async()=>{const {receiver,done,counts}=make(),first=receiver.open();receiver.hide();const second=receiver.open();assert.equal(receiver.visible,true);done();await Promise.all([first,second]);assert.equal(counts().views,1);assert.equal(counts().focuses,1);});
