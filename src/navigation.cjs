'use strict';
function remoteAllowed(value){
 try{
  const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return false;
  if(['music.youtube.com','accounts.google.com','consent.youtube.com','consent.google.com'].includes(u.hostname))return true;
  return u.hostname==='www.youtube.com'&&(u.pathname==='/tv'||u.pathname.startsWith('/tv/')||u.pathname==='/signin'||u.pathname.startsWith('/signin/')||u.pathname==='/oops');
 }catch{return false;}
}
function historyTargets(entries,index){
 const visible=url=>{try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='music.youtube.com'||u.hostname==='www.youtube.com'&&(u.pathname==='/tv'||u.pathname.startsWith('/tv/')));}catch{return false;}};
 const current=entries[index]?.url;let back=-1,forward=-1;
 for(let i=index-1;i>=0;i--)if(visible(entries[i].url)&&entries[i].url!==current){back=i;break;}
 for(let i=index+1;i<entries.length;i++)if(visible(entries[i].url)&&entries[i].url!==current){forward=i;break;}
 return {back,forward};
}
module.exports={remoteAllowed,historyTargets};
