'use strict';
(function(scope){
 const defaults={vinyl:false,paper:true,layout:'airy',theme:'dark',background:'ambient',palette:'album',motion:55,opacity:55,grain:3,lyrics:'soft',visualizer:'trail',dock:'auto',glass:true,material:'acrylic'};
 const options={layout:['airy','large'],theme:['dark','light','system'],background:['ambient','artwork','horizon','bloom','plain'],palette:['album','mono','noir'],lyrics:['none','soft','mist','prism','particles'],visualizer:['none','trail','wave','spectrum','orbit'],dock:['always','auto'],material:['acrylic','mica','none']};
 function normalize(value){const result={...defaults};if(!value||typeof value!=='object')return result;for(const [key,values] of Object.entries(options))if(values.includes(value[key]))result[key]=value[key];for(const key of ['opacity','grain','motion'])if(Number.isFinite(Number(value[key])))result[key]=Math.max(0,Math.min(100,Number(value[key])));for(const key of ['glass','vinyl','paper'])if(typeof value[key]==='boolean')result[key]=value[key];return result;}
 const builtins=[
  {id:'glass',name:'Стекло',settings:normalize({})},
  {id:'cover',name:'Обложка',settings:normalize({background:'artwork',opacity:50,motion:65,grain:4})},
  {id:'silver',name:'Серебро',settings:normalize({palette:'mono',material:'mica',opacity:45,grain:2})},
  {id:'noir',name:'Нуар',settings:normalize({background:'artwork',palette:'noir',opacity:20,motion:35,grain:7})},
  {id:'daylight',name:'Светлая',settings:normalize({theme:'light',opacity:30,grain:2})},
  {id:'quiet',name:'Спокойная',settings:normalize({background:'plain',opacity:0,motion:0,grain:0,glass:false,material:'none',visualizer:'none',dock:'always'})}
 ];
 function readCustom(text){try{const rows=JSON.parse(text||'[]');return Array.isArray(rows)?rows.filter(row=>row&&typeof row.id==='string'&&row.id.startsWith('user:')&&typeof row.name==='string'&&row.name.trim()).map(row=>({id:row.id,name:row.name.trim().slice(0,60),settings:normalize(row.settings)})):[];}catch{return [];}}
 const api={defaults,normalize,builtins,readCustom};if(typeof module!=='undefined')module.exports=api;else scope.appearancePresets=api;
})(globalThis);
