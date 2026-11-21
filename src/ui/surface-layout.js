'use strict';
(function(scope){
  function surfaceLayout(tab,mode){
    return {remoteVisible:tab==='catalog'||tab==='music'&&mode==='tv',sceneVisible:tab==='music'&&mode!=='tv',dockVisible:tab!=='catalog'&&mode!=='tv'};
  }
  if(typeof module!=='undefined')module.exports=surfaceLayout;else scope.surfaceLayout=surfaceLayout;
})(globalThis);
