'use strict';
(()=>{
 const canvas=document.createElement('canvas');canvas.className='immersion-canvas immersion-background fluid-light';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;document.body.append(canvas);
 let gl,program,failed=false,lastTime=0,flowTime=0;
 const fragment=`precision highp float;
 uniform vec2 size,origin;uniform float time,energy,style;uniform vec3 c0,c1,c2;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
 float fbm(vec2 p){float v=0.,a=.55;for(int i=0;i<3;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+3.1;a*=.48;}return v;}
 void main(){
 vec2 p=(gl_FragCoord.xy-size*origin)/size.y;float r=length(p),angle=atan(p.y,p.x);float t=time*.065;
 float travel=log(r+.16)*1.55-t;
 vec2 ring=vec2(cos(angle),sin(angle));
 float curl=fbm(ring*2.2+travel*.34+vec2(t*.18,-t*.11));
 float bend=angle+(curl-.5)*1.9+sin(travel*1.4+curl*3.)*.3;
 vec2 flow=vec2(cos(bend),sin(bend))*(2.1+travel*.45);
 vec2 warp=vec2(fbm(flow+vec2(t*.2,0)),fbm(flow+vec2(3.,t*.13)));
 float dye=fbm(flow*1.8+warp*2.8);
 float folds=.5+.5*sin(bend*(3.+style*2.)+travel*.65+dye*4.5);
 folds=smoothstep(.08,.92,folds);
 vec3 color=mix(c0,c1,smoothstep(.16,.85,dye));color=mix(color,c2,folds*.6);
 float light=(.18+.38*folds+.16*dye)*(1.+energy*.35);
 float center=smoothstep(.035,.25,r);
 gl_FragColor=vec4(color,light*center);
 }`;
 function init(){
  if(gl)return true;if(failed)return false;
  try{gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL unavailable');
   const shader=(kind,source)=>{const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
   program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 pos;void main(){gl_Position=vec4(pos,0.,1.);}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'pos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
   canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();failed=true;gl=null;canvas.hidden=true;});return true;
  }catch{failed=true;gl=null;canvas.hidden=true;return false;}
 }
 function render({width,height,time,energy,colors,mode,origin=[.5,.5],motion=1}){
  if(!init())return false;canvas.hidden=false;canvas.style.opacity='1';const h=216,w=Math.round(h*width/height);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
  gl.uniform2f(gl.getUniformLocation(program,'origin'),...origin);
  flowTime+=lastTime?Math.min(.1,Math.max(0,(time-lastTime)/1000))*Math.max(0,Math.min(1,motion)):0;lastTime=time;
  gl.useProgram(program);gl.uniform2f(gl.getUniformLocation(program,'size'),w,h);gl.uniform1f(gl.getUniformLocation(program,'time'),flowTime);gl.uniform1f(gl.getUniformLocation(program,'energy'),energy);gl.uniform1f(gl.getUniformLocation(program,'style'),mode==='corona'?1:0);
  colors.forEach((color,i)=>{const values=color.split(',').map(v=>Number(v)/255);gl.uniform3f(gl.getUniformLocation(program,'c'+i),...values);});gl.drawArrays(gl.TRIANGLES,0,6);return true;
 }
 function sample(){if(!gl||failed)return null;const data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);let count=0,total=0,hash=0;for(let i=3;i<data.length;i+=64){total++;if(data[i]>10)count++;hash=(hash*31+data[i-3]+data[i])>>>0;}return {coverage:count/total,width:canvas.width,height:canvas.height,hash};}
 window.fluidLight={render,hide:()=>canvas.style.opacity='0',available:()=>!!gl&&!failed,sample};
})();
