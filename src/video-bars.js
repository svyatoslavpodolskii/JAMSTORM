'use strict';
(function(scope){
 function detect(data,width,height){
  if(!data||width<16||height<16||data.length<width*height*4)return null;
  const dark=(x,y)=>{const i=(y*width+x)*4;return Math.max(data[i],data[i+1],data[i+2])<15;};
  const column=x=>{let black=0;for(let n=0;n<24;n++)if(dark(x,Math.min(height-1,Math.floor(height*(.05+n/24*.9)))))black++;return black>=23;};
  const row=y=>{let black=0;for(let n=0;n<24;n++)if(dark(Math.min(width-1,Math.floor(width*(.05+n/24*.9))),y))black++;return black>=23;};
  const maxX=Math.floor(width*.3),maxY=Math.floor(height*.25);let left=0,right=0,top=0,bottom=0;
  while(left<maxX&&column(left))left++;while(right<maxX&&column(width-right-1))right++;
  while(top<maxY&&row(top))top++;while(bottom<maxY&&row(height-bottom-1))bottom++;
  if(left===maxX&&right===maxX&&top===maxY&&bottom===maxY)return null;
  if(left>=maxX||right>=maxX||Math.abs(left-right)>Math.max(3,width*.02)||Math.min(left,right)<3)left=right=0;
  if(top>=maxY||bottom>=maxY||Math.abs(top-bottom)>Math.max(3,height*.02)||Math.min(top,bottom)<3)top=bottom=0;
  return {left:left/width,right:right/width,top:top/height,bottom:bottom/height};
 }
 const api={detect};if(typeof module!=='undefined')module.exports=api;else scope.JamVideoBars=api;
})(globalThis);
