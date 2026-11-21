'use strict';
(function(scope){
  const normalize=value=>value===true?'side':['side','center'].includes(value)?value:'hidden';
  function nextPanel(state,key){
    const next={lyrics:normalize(state.lyrics),queue:normalize(state.queue)};
    next[key]=['hidden','side','center'][(['hidden','side','center'].indexOf(next[key])+1)%3];
    const other=key==='lyrics'?'queue':'lyrics';
    if(next[key]==='center'&&next[other]==='center')next[other]='hidden';
    return next;
  }
  const api={normalize,nextPanel};
  if(typeof module!=='undefined')module.exports=api;else scope.panelModes=api;
})(globalThis);
