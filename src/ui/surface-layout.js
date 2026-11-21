'use strict';
(function(scope){
  function surfaceLayout(tab,mode){
    return {remoteVisible:tab==='catalog',sceneVisible:tab==='music',dockVisible:tab!=='catalog'};
  }
  if(typeof module!=='undefined')module.exports=surfaceLayout;else scope.surfaceLayout=surfaceLayout;
})(globalThis);
