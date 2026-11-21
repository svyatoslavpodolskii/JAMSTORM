'use strict';
(function(scope){
 const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 function normalize(rgb){
  let result=rgb.map(v=>Math.max(0,Math.min(255,Number(v)||0)));
  // Keep the cover's hue while lifting dark golds, blues and reds into a
  // restrained luminous tint. Controls always use the same dark foreground.
  const base=[21,25,31],contrast=()=> (luminance(result)+.05)/(luminance(base)+.05);
  while(contrast()<7)result=result.map(v=>v+(255-v)*.08);
  return result.map(Math.round);
 }
 const api={normalize,luminance,css:rgb=>'rgb('+normalize(rgb).join(' ')+')'};
 if(typeof module!=='undefined')module.exports=api;else scope.accentColor=api;
})(globalThis);
