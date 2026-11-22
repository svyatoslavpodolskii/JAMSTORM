'use strict';
function nativeFeedback(action,perform){
 const music=document.querySelector('ytmusic-player-bar'),bar=music||(document.querySelector('video')&&document.querySelector('ytlr-player,ytlr-player-container-renderer,ytlr-app'));
 if(!bar)return {available:false,pressed:false};
 const root=music?(action==='menu'?bar.querySelector('ytmusic-menu-renderer'):bar.querySelector('ytmusic-like-button-renderer')):null;
 const selector=action==='menu'?'button,tp-yt-paper-icon-button':action==='like'?'#like-button button,#like-button':'#dislike-button button,#dislike-button';
 const label=action==='like'?/^(?:unlike|like)(?: this (?:video|song).*)?$|^Нравится(?:\s.*)?$/i:/^(?:undo )?dislike(?: this (?:video|song).*)?$|^Не нравится(?:\s.*)?$/i;
 const candidates=[...(bar.querySelectorAll?.('button[aria-label],ytlr-button[aria-label],ytlr-toggle-button[aria-label],[role="button"][aria-label]')||[])];
 const button=root?.querySelector(selector)||(action!=='menu'?candidates.find(e=>label.test(e.getAttribute('aria-label')||'')||e.data?.icon?.iconType===(action==='like'?'LIKE':'DISLIKE')):null);
 if(!button||button.disabled||button.getAttribute('aria-disabled')==='true')return {available:false,pressed:false};
 if(perform)button.click();
 return {available:true,pressed:button.getAttribute('aria-pressed')==='true'||button.closest?.('[aria-pressed]')?.getAttribute('aria-pressed')==='true'||button.data?.isToggled===true};
}
function script(action,perform=true){if(!['like','dislike','menu'].includes(action))throw Error('Unknown feedback action');return '('+nativeFeedback.toString()+')('+JSON.stringify(action)+','+!!perform+')';}
const stateScript=()=>`(()=>{return {videoId:document.querySelector('.html5-video-player,#movie_player')?.getVideoData?.()?.video_id||'',like:${script('like',false)},dislike:${script('dislike',false)}};})()`;
module.exports={script,stateScript};