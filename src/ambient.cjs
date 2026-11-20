"use strict";
function dominantColor(bitmap){
 const bins=new Map();
 for(let i=0;i+3<bitmap.length;i+=4){const b=bitmap[i],g=bitmap[i+1],r=bitmap[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);if(max<40||min>225||max-min<24)continue;const key=[r,g,b].map(v=>Math.floor(v/40)).join(',');const bin=bins.get(key)||{weight:0,r:0,g:0,b:0};const weight=(max-min)/255;bin.weight+=weight;bin.r+=r*weight;bin.g+=g*weight;bin.b+=b*weight;bins.set(key,bin);}
 const best=[...bins.values()].sort((a,b)=>b.weight-a.weight)[0];return best?[best.r,best.g,best.b].map(v=>Math.round(v/best.weight)):[154,125,104];
}
module.exports={dominantColor};
