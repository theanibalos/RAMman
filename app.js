'use strict';
const $ = id => document.getElementById(id);
const puppet = Ramman.create($('scene'));
const state = puppet.state;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const fmt = n => new Intl.NumberFormat('es', { maximumFractionDigits:1 }).format(n);
function updateUI(announce=false){
  const free=state.total-state.used, fraction=free/state.total;
  $('free').textContent=fmt(free);$('percent').textContent=`${fmt(fraction*100)} %`;
  $('free-track').style.width=`${fraction*100}%`;
  $('used-output').textContent=`${fmt(state.used)} GB`;$('used').value=state.used;
  $('used').setAttribute('aria-valuetext',`${fmt(state.used)} GB usados de ${state.total} GB`);
  const moods={
    calm:['Ahora sí. Mucho mejor.','La memoria está trabajando. Sam vuelve a estar tranquilo.','Por fin, tranquilo','✓'],
    uneasy:['Todavía sobra bastante.','Empieza a fruncir el ceño al mirar el espacio libre.','Algo impaciente','~'],
    annoyed:['¿Para qué tanta RAM?','Más memoria libre, menos paciencia. Ya se está agachando.','Bastante molesto','↯'],
    furious:['¡¿Toda esa RAM sin usar?!','Se agacha al máximo y pierde completamente la paciencia.','Furioso con tanta RAM libre','↯']
  };
  const mood=moods[Ramman.faceForUsage(state.used/state.total)];
  $('mood-title').textContent=mood[0];$('mood-description').textContent=mood[1];$('mood').textContent=mood[2];$('mood-icon').textContent=mood[3];
  if(announce)$('announcement').textContent=`${fmt(state.used)} GB usados, ${fmt(free)} GB libres. ${mood[2]}.`;
}
function setAuto(value){state.auto=value;$('auto').setAttribute('aria-pressed',String(value));$('play-icon').textContent=value?'Ⅱ':'▶';$('play-label').textContent=value?'Pausar animación':'Animar uso de RAM';}
$('used').addEventListener('input',e=>{setAuto(false);state.used=Number(e.target.value);updateUI();});
$('used').addEventListener('change',()=>updateUI(true));
$('scene').addEventListener('wheel',e=>{
  if(!e.shiftKey || e.deltaY===0 && e.deltaX===0)return;
  e.preventDefault();
  setAuto(false);
  const delta=e.deltaY || e.deltaX;
  state.used=Math.max(0,Math.min(state.total,state.used+(delta<0?.5:-.5)));
  updateUI(true);
},{passive:false});
$('total').addEventListener('change',e=>{const fraction=state.used/state.total;state.total=Number(e.target.value);state.used=Math.round(fraction*state.total*2)/2;$('used').max=state.total;$('range-max').textContent=`${state.total} GB`;updateUI(true);});
document.querySelectorAll('[data-ratio]').forEach(button=>button.addEventListener('click',()=>{setAuto(false);state.used=Math.round(state.total*Number(button.dataset.ratio)*2)/2;updateUI(true);}));
$('auto').addEventListener('click',()=>{setAuto(!state.auto);state.time=Math.asin(Math.max(-1,Math.min(1,(state.used/state.total-.5)/.45)));});
$('joints').addEventListener('click',()=>{state.joints=!state.joints;$('joints').setAttribute('aria-pressed',String(state.joints));});
let last=0;
function frame(now){const dt=Math.min((now-(last||now))/1000,.06);last=now;
  if(state.auto){state.time+=dt*.48;state.used=Math.round(state.total*(.5+Math.sin(state.time)*.45)*2)/2;updateUI();}
  puppet.step(dt,reducedMotion.matches);requestAnimationFrame(frame);
}

puppet.ready.then(() => {
  $('loading').hidden = true;
  requestAnimationFrame(frame);
  initLiveRam();
}).catch(error => {
  $('loading').textContent = `${error.message}. Comprueba las carpetas assets/partes y assets/caras.`;
});

function initLiveRam() {
  if (typeof window === 'undefined' || !window.location || !window.location.protocol.startsWith('http') || typeof EventSource === 'undefined') {
    return;
  }
  let isLive = true;
  const source = new EventSource('/api/ram/stream');
  source.onmessage = e => {
    if (!isLive || state.auto) return;
    try {
      const data = JSON.parse(e.data);
      if (!data || !data.total) return;
      state.total = data.total;
      state.used = data.used;
      puppet.setMemory(data.total, data.used);
      $('used').max = data.total;
      $('range-max').textContent = `${data.total} GB`;
      const opt = Array.from($('total').options).find(o => Number(o.value) === Math.round(data.total));
      if (opt) $('total').value = opt.value;
      const note = document.querySelector('.local-note');
      if (note) {
        note.innerHTML = '<span></span><strong>RAM real conectada:</strong> midiendo el sistema en vivo.';
        note.style.color = 'var(--lime)';
      }
      const badge = document.querySelector('.badge');
      if (badge) {
        badge.innerHTML = '<i></i> EN VIVO · SISTEMA LOCAL';
        badge.style.color = 'var(--lime)';
      }
      updateUI();
    } catch {}
  };
  $('used').addEventListener('input', () => { isLive = false; });
  $('total').addEventListener('change', () => { isLive = false; });
  document.querySelectorAll('[data-ratio]').forEach(btn => btn.addEventListener('click', () => { isLive = false; }));
}
updateUI();
