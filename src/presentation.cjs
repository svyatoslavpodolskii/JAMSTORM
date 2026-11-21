'use strict';
function normalize(value={}){return {theme:value.theme==='light'?'light':'dark',glass:value.glass!==false,opacity:Number.isFinite(value.opacity)?Math.max(0,Math.min(100,value.opacity)):55};}
function script(value){const state=normalize(value);return `(()=>{const root=document.documentElement;root.dataset.jamTheme=${JSON.stringify(state.theme)};root.dataset.jamGlass=${JSON.stringify(state.glass&&state.opacity>0?'on':'off')};root.style.setProperty('--jam-transparency',${JSON.stringify(String(state.glass?state.opacity/100:0))});})()`;}
module.exports={normalize,script};
