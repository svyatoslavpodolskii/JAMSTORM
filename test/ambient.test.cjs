const test=require('node:test');
const assert=require('node:assert/strict');
const {dominantColor}=require('../src/ambient.cjs');
test('cover lighting follows the colored artwork rather than black margins or white text',()=>{
 const pixels=Buffer.from([...Array.from({length:50},()=>[0,0,0,255]).flat(),...Array.from({length:30},()=>[250,250,250,255]).flat(),...Array.from({length:20},()=>[30,100,210,255]).flat()]);
 assert.deepEqual(dominantColor(pixels),[210,100,30]);
});
test('monochrome and missing artwork keep a calm neutral ambient',()=>{
 assert.deepEqual(dominantColor(Buffer.alloc(0)),[170,174,180]);
 assert.deepEqual(dominantColor(Buffer.from([120,120,120,255])),[120,120,120]);
});
