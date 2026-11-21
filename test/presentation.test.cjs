const test=require('node:test'),assert=require('node:assert/strict');
const presets=require('../src/ui/appearance-presets.js'),presentation=require('../src/presentation.cjs');
test('standard and custom presets restore validated independent snapshots',()=>{
 assert.equal(presets.builtins.length,6);const saved={id:'user:one',name:'Мой вечер',settings:{...presets.builtins[1].settings,opacity:38}};
 const rows=presets.readCustom(JSON.stringify([saved]));assert.equal(rows[0].settings.opacity,38);assert.equal(rows[0].settings.background,'artwork');
 rows[0].settings.opacity=0;assert.equal(presets.builtins[1].settings.opacity,50);
 assert.deepEqual(presets.readCustom('{broken'),[]);assert.equal(presets.normalize({theme:'injected',opacity:500}).theme,'dark');assert.equal(presets.normalize({opacity:500}).opacity,100);
});
test('catalog presentation follows light/dark and truly opaque settings',()=>{
 assert.match(presentation.script({theme:'light',glass:false,opacity:90}),/jamTheme="light"/);
 assert.match(presentation.script({theme:'light',glass:false,opacity:90}),/jamGlass="off"/);
 assert.match(presentation.script({theme:'dark',glass:true,opacity:0}),/jamGlass="off"/);
 assert.match(presentation.script({theme:'dark',glass:true,opacity:60}),/jamGlass="on"/);
});
