const test=require('node:test');
const assert=require('node:assert/strict');
const {dominantColor}=require('../src/ambient.cjs');
test('cover lighting follows the colored artwork rather than black margins or white text',()=>{
 const pixels=Buffer.from([...Array.from({length:50},()=>[0,0,0,255]).flat(),...Array.from({length:30},()=>[250,250,250,255]).flat(),...Array.from({length:20},()=>[30,100,210,255]).flat()]);
 assert.deepEqual(dominantColor(pixels),[210,100,30]);
});
test('ambient keeps distinct colors from an album instead of flattening it to one hue',()=>{
 const {artworkPalette}=require('../src/ambient.cjs');const pixels=Buffer.from([...Array.from({length:30},()=>[30,70,210,255]).flat(),...Array.from({length:20},()=>[190,130,40,255]).flat()]);
 const colors=artworkPalette(pixels);assert.equal(colors.length,3);assert.deepEqual(colors[0],[210,70,30]);assert(colors.some(color=>color[2]>150));
 assert(artworkPalette(Buffer.alloc(0)).flat().every(v=>Number.isInteger(v)&&v>=0&&v<=255));
});
test('monochrome and missing artwork keep a calm neutral ambient',()=>{
 assert.deepEqual(dominantColor(Buffer.alloc(0)),[170,174,180]);
 assert.deepEqual(dominantColor(Buffer.from([120,120,120,255])),[120,120,120]);
});
