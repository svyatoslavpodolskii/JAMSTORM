'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalize,bounds}=require('../src/video-view.cjs');
test('video keeps an explicit opt-in and clamps ambient intensity',()=>{assert.equal(normalize().enabled,false);assert.deepEqual(normalize({enabled:true,ambient:false,intensity:200}),{enabled:true,followCatalog:true,ambient:false,intensity:100,size:76});assert.equal(normalize({enabled:'true'}).enabled,false);});
test('video bounds stay below the toolbar and inside an ultrawide surface',()=>{assert.deepEqual(bounds({x:-20,y:0,width:9000,height:9000},2560,1080),{x:0,y:72,width:2560,height:1008});assert.equal(bounds({x:NaN,y:0,width:10,height:10},2560,1080),null);assert.deepEqual(bounds({x:200,y:100,width:1400,height:600},2560,1080),{x:200,y:100,width:1400,height:600});});
