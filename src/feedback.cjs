'use strict';
function script(action){
 if(!['like','dislike','menu'].includes(action))throw Error('Unknown feedback action');
 return `(()=>{const action=${JSON.stringify(action)},bar=document.querySelector('ytmusic-player-bar');if(!bar)return {available:false};const root=action==='menu'?bar.querySelector('ytmusic-menu-renderer'):bar.querySelector('ytmusic-like-button-renderer');const selector=action==='menu'?'button,tp-yt-paper-icon-button':action==='like'?'#like-button button,#like-button':'#dislike-button button,#dislike-button';const label=action==='like'?/^(like( this video.*)?|\\u041d\\u0440\\u0430\\u0432\\u0438\\u0442\\u0441\\u044f)$/i:/^(dislike( this video.*)?|\\u041d\\u0435 \\u043d\\u0440\\u0430\\u0432\\u0438\\u0442\\u0441\\u044f)$/i;const button=root?.querySelector(selector)|| (action!=='menu'?[...bar.querySelectorAll('button[aria-label]')].find(e=>label.test(e.getAttribute('aria-label')||'')):null);if(!button||button.disabled||button.getAttribute('aria-disabled')==='true')return {available:false};button.click();return {available:true};})()`;
}
module.exports={script};
