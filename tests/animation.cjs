// Run with: node demo/tests/animation.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
let matrix = [1,0,0,1,0,0], stack = [], draws = [], markup = [];
function multiply(b) { const a=matrix; matrix=[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]; }
const ctx = new Proxy({
 save(){stack.push([...matrix]);}, restore(){matrix=stack.pop();},
 translate(x,y){multiply([1,0,0,1,x,y]);}, scale(x,y){multiply([x,0,0,y,0,0]);},
 rotate(t){multiply([Math.cos(t),Math.sin(t),-Math.sin(t),Math.cos(t),0,0]);},
 clearRect(){draws=[];markup=[];},
 drawImage(image,x,y){assert(matrix.every(Number.isFinite));draws.push({image,x,y,matrix:[...matrix]});
 if(process.env.PREVIEW){const uri='data:image/png;base64,'+image.data.toString('base64');markup.push(`<image href="${uri}" x="${x}" y="${y}" width="${image.naturalWidth}" height="${image.naturalHeight}" transform="matrix(${matrix.join(' ')})"/>`);}},
}, {get(target,key){return key in target?target[key]:()=>{};}});
const elements = new Map();
function element(id){if(!elements.has(id))elements.set(id,{value:id==='total'?'32':'4',hidden:false,listeners:{},textContent:'',style:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(key,value){this[key]=value;}});return elements.get(id);}
class Image {
 set src(value){this.file=value;try{this.data=fs.readFileSync(path.join(root,value));this.naturalWidth=this.data.readUInt32BE(16);this.naturalHeight=this.data.readUInt32BE(20);this.complete=true;queueMicrotask(()=>this.onload());}catch{queueMicrotask(()=>this.onerror());}}
}
const sandbox={console,Image,Intl,Math,Promise,Error,window:{devicePixelRatio:1,matchMedia:()=>({matches:false})},document:{getElementById:element,querySelectorAll:()=>[]},requestAnimationFrame(){}};
element('scene').getContext=()=>ctx;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'ramman.js'),'utf8'),sandbox);
sandbox.Ramman=sandbox.window.Ramman;
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),sandbox);
const run=code=>vm.runInContext(code,sandbox);
(async()=>{
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(element('loading').hidden,true,'all body parts and facial expressions load before rendering');
 assert.equal(run('Object.keys(Ramman.artwork.parts).length'),15);
 assert.equal(run('Object.keys(Ramman.artwork.faces).length'),4);
 for(const [ratio,face] of [[0,'furious'],[.3,'annoyed'],[.5,'uneasy'],[1,'calm']])assert.equal(run(`Ramman.faceForUsage(${ratio})`),face);
 const originalScales = new Map();
 for(const ratio of [0,.125,.3,.5,.9,1]){
  run(`state.used=state.total*${ratio};state.shown=${ratio};updateUI();puppet.render();`);
  assert.equal(draws.length,16,'every part is drawn once');
  const faceFile=run(`Ramman.artwork.faces[Ramman.faceForUsage(${ratio})].file`);
  assert(draws.some(d=>d.image.file===`assets/caras/${faceFile}.png`),'the selected expression is actually rendered');
  assert.equal(new Set(draws.map(d=>d.image.file)).size,16,'left and right use separate PNGs');
  assert.equal(stack.length,0,'canvas transforms are balanced');
  for(const [name,endpoints] of Object.entries(run('state.pose'))){
   const part=run(`Ramman.artwork.parts.${name}`);
   const draw=draws.find(d=>d.image.file===`assets/partes/${part.file}.png`);
   const w=draw.image.naturalWidth,h=draw.image.naturalHeight,m=draw.matrix;
   for(const [i,p] of [part.p,part.end].entries()){
    const x=p[0]*w+draw.x,y=p[1]*h+draw.y;
    assert(Math.abs(m[0]*x+m[2]*y+m[4]-endpoints[i].x)<1e-8,`${name}: x anchor`);
    assert(Math.abs(m[1]*x+m[3]*y+m[5]-endpoints[i].y)<1e-8,`${name}: y anchor`);
   }
  }
  // Equal basis lengths and perpendicular axes prohibit stretching and shearing.
  for(const {matrix:m,image} of draws){
   const sx=Math.hypot(m[0],m[1]),sy=Math.hypot(m[2],m[3]);
   assert(Math.abs(sx-sy)<1e-10,`${image.file}: original aspect ratio`);
   if(originalScales.has(image.file))assert(Math.abs(sx-originalScales.get(image.file))<1e-8,`${image.file}: constant size while bending`);
   else originalScales.set(image.file,sx);
   assert(Math.abs(m[0]*m[2]+m[1]*m[3])<1e-10,`${image.file}: no shear`);
  }
  if(process.env.PREVIEW)fs.writeFileSync(`/tmp/ramman-rig-${ratio}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1000" height="930"><rect width="1000" height="930" fill="#e7e9de"/>${markup.join('')}</svg>`);
 }
 element('used').listeners.input({target:{value:'16'}});assert.equal(run('state.used'),16);
 element('total').listeners.change({target:{value:'64'}});assert.equal(run('state.used'),32);assert.equal(element('used').max,64);
 element('joints').listeners.click();assert.equal(run('state.joints'),true);run('puppet.render()');
 element('auto').listeners.click();assert.equal(run('state.auto'),true);run('frame(1000);frame(1050)');assert.notEqual(run('state.used'),32);
 console.log('PASS: 15 body parts + four facial expressions; six RAM postures with original aspect ratios; eight limb attachments; slider, capacity, joints and animation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
