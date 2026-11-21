"use strict";
function dominantColor(bitmap){
 const bins=new Map();
 for(let i=0;i+3<bitmap.length;i+=4){const b=bitmap[i],g=bitmap[i+1],r=bitmap[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);if(max<40||min>225||max-min<24)continue;const key=[r,g,b].map(v=>Math.floor(v/40)).join(',');const bin=bins.get(key)||{weight:0,r:0,g:0,b:0};const weight=(max-min)/255;bin.weight+=weight;bin.r+=r*weight;bin.g+=g*weight;bin.b+=b*weight;bins.set(key,bin);}
 const best=[...bins.values()].sort((a,b)=>b.weight-a.weight)[0];if(best)return [best.r,best.g,best.b].map(v=>Math.round(v/best.weight));
 if(!bitmap.length)return [170,174,180];
 let light=0,count=0;for(let i=0;i+3<bitmap.length;i+=4){light+=bitmap[i]*.0722+bitmap[i+1]*.7152+bitmap[i+2]*.2126;count++;}
 const neutral=Math.round(Math.max(90,Math.min(205,light/Math.max(1,count))));return [neutral,neutral,neutral];
}
function artworkPalette(bitmap){
 const primary=dominantColor(bitmap),bins=new Map(),colors=[primary];
 for(let i=0;i+3<bitmap.length;i+=4){const color=[bitmap[i+2],bitmap[i+1],bitmap[i]],max=Math.max(...color),min=Math.min(...color);if(max<45||min>225||max-min<28)continue;const key=color.map(v=>Math.floor(v/48)).join(',');const bin=bins.get(key)||{n:0,sum:[0,0,0]};bin.n++;color.forEach((v,j)=>bin.sum[j]+=v);bins.set(key,bin);}
 for(const bin of [...bins.values()].sort((a,b)=>b.n-a.n)){const next=bin.sum.map(v=>Math.round(v/bin.n));if(colors.every(color=>Math.hypot(...color.map((v,i)=>v-next[i]))>85))colors.push(next);if(colors.length===3)break;}
 if(colors.length===1)colors.push(primary.map(v=>Math.round(v*.55+45)));
 if(colors.length===2)colors.push(primary.map(v=>Math.round(v*.3+100)));
 return colors;
}
module.exports={dominantColor,artworkPalette};
