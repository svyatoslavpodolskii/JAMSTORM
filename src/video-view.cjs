'use strict';
function normalize(value={}){return {enabled:value.enabled===true,followCatalog:value.followCatalog!==false,ambient:value.ambient!==false,intensity:Number.isFinite(value.intensity)?Math.max(0,Math.min(100,value.intensity)):75,size:Number.isFinite(value.size)?Math.max(55,Math.min(100,value.size)):76};}
function bounds(value,width,height,top=72){
 if(!value||!['x','y','width','height'].every(k=>Number.isFinite(value[k])))return null;
 const x=Math.max(0,Math.min(width-1,Math.round(value.x))),y=Math.max(top,Math.min(height-1,Math.round(value.y)));
 return {x,y,width:Math.max(1,Math.min(width-x,Math.round(value.width))),height:Math.max(1,Math.min(height-y,Math.round(value.height)))};
}
module.exports={normalize,bounds};
