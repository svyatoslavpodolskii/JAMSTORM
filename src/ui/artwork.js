"use strict";
(function(scope){
 function cover(item){
  try{const url=new URL(item?.cover||'');if(url.protocol==='https:'&&(url.hostname==='i.ytimg.com'||url.hostname.endsWith('.googleusercontent.com')||url.hostname.endsWith('.ggpht.com'))){if(url.hostname==='i.ytimg.com'&&/^[\w-]{11}$/.test(item?.videoId||''))return 'https://i.ytimg.com/vi/'+item.videoId+'/maxresdefault.jpg';if(url.hostname.endsWith('.googleusercontent.com'))return url.href.replace(/=w\d+-h\d+[^?#]*/, '=w1000-h1000-l90-rj');return url.href;}}catch{}
  return /^[\w-]{11}$/.test(item?.videoId||'')?'https://i.ytimg.com/vi/'+item.videoId+'/maxresdefault.jpg':'cover-placeholder.svg';
 }
 function title(item){return String(item?.title||'').replace(/\s*[([][^)\]]*(?:official|feat\.?|ft\.?|lyric|audio|music video)[^)\]]*[)\]]/gi,'').trim()||item?.title||'';}
 const api={cover,title};if(typeof module!=='undefined')module.exports=api;else scope.artwork=api;
})(globalThis);
