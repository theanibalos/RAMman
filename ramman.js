'use strict';
// Shared artwork is loaded once, even when several computers are on screen.
window.Ramman = (() => {
// Anchors are fractions of each PNG, independent of its exported resolution.
// p = proximal pivot; end = distal pivot. All artwork uses uniform scaling.
const parts = {
  neck: { file: 'cuello', p: [.50, .28] },
  torso: { file: 'torso', p: [.50, .12] },
  pelvis: { file: 'pelvis', p: [.50, .24] },
  upperLeft: { file: 'brazo_izquierdo', p: [.65, .12], end: [.36, .88] },
  upperRight: { file: 'brazo_derecho', p: [.44, .19], end: [.59, .85] },
  foreLeft: { file: 'antebrazo_izquierdo', p: [.49, .14], end: [.58, .87] },
  foreRight: { file: 'antebrazo_derecho', p: [.52, .13], end: [.48, .90] },
  handLeft: { file: 'mano_izquierda', p: [.50, .15] },
  handRight: { file: 'mano_derecha', p: [.52, .15] },
  thighLeft: { file: 'muslo_izquierdo', p: [.74, .18], end: [.24, .85] },
  thighRight: { file: 'muslo_derecho', p: [.26, .19], end: [.70, .82] },
  shinLeft: { file: 'pantorrilla_izquierda', p: [.69, .155], end: [.34, .91] },
  shinRight: { file: 'pantorrilla_derecha', p: [.36, .17], end: [.69, .88] },
  shoeLeft: { file: 'zapato_izquierdo', p: [.77, .32] },
  shoeRight: { file: 'zapato_derecho', p: [.22, .32] }
};
// Separate photographs act as replacement cutouts, not a stretch of one face.
const faces = {
  calm: { file: 'tranquilo', p: [.5, .94] },
  uneasy: { file: 'incomodo', p: [.5, .94] },
  annoyed: { file: 'molesto', p: [.5, .94] },
  furious: { file: 'furioso', p: [.5, .94] }
};
function faceForUsage(ratio) {
  return ratio < .2 ? 'furious' : ratio < .45 ? 'annoyed' : ratio < .72 ? 'uneasy' : 'calm';
}

let assetPromise;
function loadArtwork() {
  if (!assetPromise) {
    const assets = [
      ...Object.values(parts).map(part => [part, 'partes']),
      ...Object.values(faces).map(part => [part, 'caras'])
    ];
    assetPromise = Promise.all(assets.map(([part, folder]) => new Promise((resolve, reject) => {
      const image = new Image();
      part.image = image;
      image.onload = resolve;
      image.onerror = () => reject(new Error(`No se pudo cargar ${part.file}.png`));
      image.src = `assets/${folder}/${part.file}.png`;
    }))).catch(error => { assetPromise = undefined; throw error; });
  }
  return assetPromise;
}
function create(canvas) {
  const ctx = canvas.getContext('2d');
  const state = { total:32, used:4, shown:.125, auto:false, joints:false, time:0 };
  const fmt = n => new Intl.NumberFormat('es', { maximumFractionDigits:1 }).format(n);
  let loaded = false;
function point(x, y) { return { x, y }; }
function distance(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function solve(a, b, l1, l2, bend = 1) {
  const d = Math.max(.01, distance(a, b));
  const reach = Math.min(d, l1 + l2 - .001);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const offset = Math.acos(Math.max(-1, Math.min(1, (l1*l1 + reach*reach - l2*l2) / (2*l1*reach))));
  return point(a.x + Math.cos(angle + bend * offset) * l1, a.y + Math.sin(angle + bend * offset) * l1);
}
function piece(name, at, width, angle = 0) {
  const part = parts[name] || faces[name], image = part.image;
  const scale = width / image.naturalWidth;
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.drawImage(image, -part.p[0] * image.naturalWidth, -part.p[1] * image.naturalHeight);
  ctx.restore();
}
function bone(name, a, b) {
  const part = parts[name] || faces[name], image = part.image;
  const px = part.p[0] * image.naturalWidth, py = part.p[1] * image.naturalHeight;
  const dx = (part.end[0] - part.p[0]) * image.naturalWidth;
  const dy = (part.end[1] - part.p[1]) * image.naturalHeight;
  // One scale for both axes preserves the PNG aspect ratio at every joint angle.
  const scale = distance(a, b) / Math.hypot(dx, dy);
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
  ctx.scale(scale, scale);
  ctx.rotate(-Math.atan2(dy, dx));
  ctx.drawImage(image, -px, -py);
  ctx.restore();
}
function line(a,b,color,width=1) { ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); }
function label(text,x,y,size=14,color='#58634e',align='left') { ctx.save(); ctx.fillStyle=color;ctx.font=`${size}px "DM Sans", sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);ctx.restore(); }
function rounded(x,y,w,h,r,fill) { ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill(); }
// Keep the arm lengths fixed; move the wrists sideways to reach a taller gauge.
function wristAt(shoulder, markerY, desiredX, reach = 220) {
  const y = Math.max(shoulder.y-reach+1, Math.min(shoulder.y+reach-1, markerY+11));
  const horizontal = Math.sqrt(Math.max(0, reach*reach-(y-shoulder.y)**2));
  return point(Math.min(desiredX, shoulder.x+horizontal), y);
}
function render() {
  const ratio=state.shown, free=1-ratio;
  const bar={x:708,y:310,w:55,h:380};
  const usedY=bar.y+bar.h*(1-ratio);
  if (!loaded) return;
  ctx.clearRect(0,0,1000,930);
  ctx.fillStyle='#cbd1c1';
  for(let x=40;x<1000;x+=30)for(let y=30;y<890;y+=30){ctx.beginPath();ctx.arc(x,y,.7,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#29352215';ctx.beginPath();ctx.ellipse(447,851,173,13,0,0,Math.PI*2);ctx.fill();
  line(point(90,865),point(917,865),'#c2cbb7');
  rounded(bar.x,bar.y,bar.w,bar.h,9,'#c4d0b3');
  ctx.save();ctx.beginPath();ctx.roundRect(bar.x,bar.y,bar.w,bar.h,9);ctx.clip();ctx.fillStyle='#344d36';ctx.fillRect(bar.x,usedY,bar.w,bar.y+bar.h-usedY);ctx.restore();
  for(let i=0;i<=4;i++){const y=bar.y+bar.h*i/4;line(point(bar.x+bar.w+11,y),point(bar.x+bar.w+20,y),'#9fae93');label(fmt(state.total*(1-i/4)),bar.x+bar.w+31,y+7,20);}
  label(state.unit || 'GB',bar.x+bar.w+31,bar.y-27,15);label('RAM',bar.x+bar.w/2,bar.y+bar.h+42,12,'#526247','center');
  if(free>.12){ctx.save();ctx.translate(bar.x+bar.w/2,(bar.y+usedY)/2);ctx.rotate(-Math.PI/2);label('MEMORIA LIBRE',0,4,11,'#3c5430','center');ctx.restore();}
  // A separate readout makes the available memory visible at a glance.
  label(`${fmt(state.total*(1-ratio))}`,190,590,64,'#344d36','center');
  label(`${state.unit || 'GB'} FREE`,190,619,18,'#526247','center');
  // The pelvis drops as free memory increases. The feet stay planted.
  const hip=point(450-free*10,560+free*130);
  const shoulder=point(hip.x+free*8,hip.y-203);
  const leftHip=point(hip.x-35,hip.y+18),rightHip=point(hip.x+35,hip.y+18);
  const leftFoot=point(347,827),rightFoot=point(548,827);
  const leftKnee=solve(leftHip,leftFoot,135,145,1),rightKnee=solve(rightHip,rightFoot,135,145,-1);
  bone('thighLeft',leftHip,leftKnee);bone('shinLeft',leftKnee,leftFoot);piece('shoeLeft',leftFoot,112);
  bone('thighRight',rightHip,rightKnee);bone('shinRight',rightKnee,rightFoot);piece('shoeRight',rightFoot,112);
  piece('pelvis',point(hip.x,hip.y-8),160);
  const topShoulder=point(shoulder.x-52,shoulder.y+6),lowShoulder=point(shoulder.x+52,shoulder.y+6);
  // Separate horizontal tips keep both markers legible even at 100% usage.
  const topWrist=wristAt(topShoulder,bar.y,bar.x-52),lowWrist=wristAt(lowShoulder,usedY,bar.x-52);
  const topHand=point(topWrist.x+21,bar.y),lowHand=point(lowWrist.x+21,usedY);
  const topElbow=solve(topShoulder,topWrist,115,115,-1),lowElbow=solve(lowShoulder,lowWrist,110,120,1);
  bone('upperLeft',topShoulder,topElbow);bone('foreLeft',topElbow,topWrist);
  piece('handLeft',topWrist,76,-Math.PI/2);
  piece('torso',shoulder,180,free*.045);
  const neck=point(shoulder.x-3,shoulder.y-6);
  const headAngle=-free*.16;
  piece('neck',point(neck.x,neck.y-1),65,headAngle);
  const face=point(neck.x,neck.y+5);
  const headScale = 2; // Modifica este multiplicador para ajustar el tamaño de la cabeza (ej. 1, 2, 3)
  piece(faceForUsage(ratio),face,118*headScale,headAngle);
  bone('upperRight',lowShoulder,lowElbow);bone('foreRight',lowElbow,lowWrist);
  piece('handRight',lowWrist,76,-Math.PI/2);
  // Hands mark the boundaries, not a second independently moving reading.
  line(point(topHand.x+5,bar.y),point(bar.x+bar.w,bar.y),'#344d36',2);
  line(point(lowHand.x+5,usedY),point(bar.x+bar.w,usedY),'#344d36',2);
  ctx.fillStyle='#344d36';for(const y of [bar.y,usedY]){ctx.beginPath();ctx.arc(bar.x,y,4,0,Math.PI*2);ctx.fill();}
  const badgeY=Math.min(820,usedY+20);
  rounded(bar.x+72,badgeY,145,43,7,'#344d36');label(`${fmt(state.total*ratio)} ${state.unit || 'GB'} usados`,bar.x+144,badgeY+28,17,'#f0f1e9','center');
  label(`${fmt(state.total)} ${state.unit || 'GB'} · TOTAL`,bar.x-31,bar.y-24,16,'#344d36','center');
  if(free>.6){
    // Attach the four anger-vein corners to the temple in head-local coordinates.
    ctx.save();
    ctx.translate(face.x,face.y);ctx.rotate(headAngle);
    ctx.translate(43*headScale,-100*headScale);
    ctx.strokeStyle='#b94d32';ctx.lineWidth=headScale > 1 ? 5 : 3;ctx.lineCap='round';ctx.lineJoin='round';
    ctx.beginPath();
    const vScale = headScale > 1 ? 2 : 1;
    for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
      ctx.moveTo(x*4*vScale,y*13*vScale);ctx.lineTo(x*4*vScale,y*4*vScale);ctx.lineTo(x*13*vScale,y*4*vScale);
    }
    ctx.stroke();ctx.restore();
    label('So much memory',180,neck.y-67,18,'#526247','center');label('going unused…!',180,neck.y-43,18,'#526247','center');line(point(240,neck.y-35),point(275,neck.y-20),'#9aa98b');
    for(let i=0;i<3;i++){line(point(shoulder.x-195-i*10,shoulder.y-80),point(shoulder.x-201-i*14,shoulder.y-101),'#7d8b6d',2);}}
  state.pose = {
    thighLeft:[leftHip,leftKnee], shinLeft:[leftKnee,leftFoot],
    thighRight:[rightHip,rightKnee], shinRight:[rightKnee,rightFoot],
    upperLeft:[topShoulder,topElbow], foreLeft:[topElbow,topWrist],
    upperRight:[lowShoulder,lowElbow], foreRight:[lowElbow,lowWrist]
  };
  if(state.joints){const joints=[hip,shoulder,leftHip,rightHip,leftKnee,rightKnee,leftFoot,rightFoot,topShoulder,lowShoulder,topElbow,lowElbow,topWrist,lowWrist];
    for(const [a,b] of [[leftHip,leftKnee],[leftKnee,leftFoot],[rightHip,rightKnee],[rightKnee,rightFoot],[hip,shoulder],[topShoulder,topElbow],[topElbow,topWrist],[lowShoulder,lowElbow],[lowElbow,lowWrist]])line(a,b,'#b94d32aa',2);
    for(const p of joints){ctx.strokeStyle='#b94d32';ctx.fillStyle='#f0f1e9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}}
}

  function setMemory(total, used, snap = false) {
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(used) || used < 0) return false;
    state.total = total;
    state.used = Math.min(used, total);
    if (snap) state.shown = state.used / state.total;
    return true;
  }
  function step(dt, reducedMotion = false) {
    const target = state.used / state.total;
    state.shown = reducedMotion ? target : state.shown + (target-state.shown)*(1-Math.exp(-dt*9));
    if (Math.abs(target-state.shown)<.0001) state.shown=target;
    render();
  }
  const ready = loadArtwork().then(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 1000*dpr; canvas.height = 930*dpr;
    ctx.scale(dpr,dpr); loaded = true;
    render();
  });
  return { state, ready, render, step, setMemory };
}
return { create, faceForUsage, artwork:{parts,faces} };
})();
