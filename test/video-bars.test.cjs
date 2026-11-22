'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{detect}=require('../src/video-bars.js');
const frame=(width,height,left,right,top,bottom)=>{const data=new Uint8ClampedArray(width*height*4);for(let y=top;y<height-bottom;y++)for(let x=left;x<width-right;x++){const i=(y*width+x)*4;data[i]=180;data[i+1]=90;data[i+2]=50;data[i+3]=255;}return data;};
test('encoded black bars are distinguished from an all-black frame',()=>{
 assert.deepEqual(detect(frame(320,180,70,70,0,0),320,180),{left:70/320,right:70/320,top:0,bottom:0});assert.deepEqual(detect(frame(320,180,0,0,22,22),320,180),{left:0,right:0,top:22/180,bottom:22/180});assert.equal(detect(new Uint8ClampedArray(320*180*4),320,180),null);
});
test('one dark side of a scene does not crop the picture',()=>{assert.deepEqual(detect(frame(320,180,30,0,0,0),320,180),{left:0,right:0,top:0,bottom:0});});
