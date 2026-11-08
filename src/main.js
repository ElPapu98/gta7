import { createWorld, step, incident, STREETS, WORLD_SIZE, clamp, distance, snapshot } from './simulation.js';

const $ = id => document.getElementById(id);
const canvas = $('city'), ctx = canvas.getContext('2d');
let world = createWorld(), paused = false, zoom = 1, last = performance.now(), accumulated = 0, uiTimer = 0, toastTimer = 0;
const keys = new Set();
const camera = { x: world.player.x, y: world.player.y };
const blocks = [];
for (let i = 0; i < STREETS.length - 1; i++) for (let j = 0; j < STREETS.length - 1; j++) {
  const x = STREETS[i] + 16, y = STREETS[j] + 16, w = STREETS[i + 1] - STREETS[i] - 32, h = STREETS[j + 1] - STREETS[j] - 32;
  blocks.push({ x, y, w, h, park: (i * 13 + j * 7) % 11 === 0, shade: (i * 9 + j * 13) % 4 });
}
function notify(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000); }
function resize() { const ratio = devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio); }
new ResizeObserver(resize).observe(canvas);
function viewport() { const dpr = devicePixelRatio || 1; const scale = Math.min(canvas.width, canvas.height) / 650 * zoom; return { w: canvas.width, h: canvas.height, scale, dpr }; }
function project(x, y, v) { return { x: (x - camera.x) * v.scale + v.w / 2, y: (y - camera.y) * v.scale + v.h / 2 }; }
function draw() {
  const v = viewport(); ctx.fillStyle = '#14231e'; ctx.fillRect(0, 0, v.w, v.h);
  ctx.save(); ctx.translate(v.w / 2 - camera.x * v.scale, v.h / 2 - camera.y * v.scale); ctx.scale(v.scale, v.scale);
  ctx.fillStyle = '#1f3229'; ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);
  ctx.fillStyle = '#313c36'; for (const x of STREETS) ctx.fillRect(x - 14, 0, 28, WORLD_SIZE); for (const y of STREETS) ctx.fillRect(0, y - 14, WORLD_SIZE, 28);
  ctx.strokeStyle = '#768071'; ctx.lineWidth = 1; ctx.setLineDash([5, 11]); for (const x of STREETS) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_SIZE); ctx.stroke(); } for (const y of STREETS) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_SIZE, y); ctx.stroke(); } ctx.setLineDash([]);
  for (const b of blocks) {
    ctx.fillStyle = b.park ? '#335841' : ['#42564b','#4c6256','#3a4e44','#54685b'][b.shade]; ctx.fillRect(b.x, b.y, b.w, b.h);
    if (b.park) { ctx.fillStyle = '#75a777'; for (let i = 0; i < 7; i++) { const tx = b.x + 9 + (i * 37 % (b.w - 18)); const ty = b.y + 9 + (i * 29 % (b.h - 18)); ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.fill(); } }
    else { ctx.fillStyle = '#202f29'; ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12); ctx.strokeStyle = '#718777'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16); ctx.fillStyle = '#61766a'; for (let t = 0; t < 3; t++) ctx.fillRect(b.x + 14 + t * 19, b.y + 16, 9, 4); }
  }
  for (const event of world.incidents) { ctx.strokeStyle = event.reported ? '#ef7168' : '#e7b464'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(event.x, event.y, 18, 0, Math.PI * 2); ctx.stroke(); }
  for (const a of world.agents) {
    ctx.fillStyle = a.state === 'flee' ? '#ff8f65' : a.state === 'work' ? '#9dcbba' : '#8f9bc4';
    ctx.beginPath(); ctx.arc(a.x, a.y, 3.2, 0, Math.PI * 2); ctx.fill();
    if (a.memory.length) { ctx.strokeStyle = '#f3b36f'; ctx.lineWidth = .9; ctx.beginPath(); ctx.arc(a.x, a.y, 5.5, 0, Math.PI * 2); ctx.stroke(); }
  }
  const p = world.player; ctx.fillStyle = '#caff74'; ctx.shadowBlur = 18; ctx.shadowColor = '#caff74'; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#dcffb3'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.restore(); const pos = project(p.x, p.y, v); ctx.fillStyle = '#e6ffb7'; ctx.font = `${Math.max(10, 11 * v.dpr)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('TÚ', pos.x, pos.y - 18 * v.dpr);
}
function updateUI() {
  const hours = Math.floor(world.time / 60) % 24, minutes = Math.floor(world.time % 60);
  const time = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
  $('clock').textContent = time; $('timeDetail').textContent = time;
  $('population').textContent = world.agents.length; $('witnesses').textContent = world.stats.witnessed; $('reports').textContent = world.stats.reports;
  $('working').textContent = world.agents.filter(a => a.state === 'work').length; $('fleeing').textContent = world.agents.filter(a => a.state === 'flee').length;
  const wanted = Math.ceil(world.player.heat); $('stars').textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
  const events = world.incidents.slice(-5).reverse();
  if (events.length) $('events').innerHTML = events.map(e => `<div class="event"><b>Incidente #${e.id} · Robo simulado</b><small>${e.witnesses.length} testigos · ${e.reported ? 'Reportado a policía' : 'Sin reporte aún'}</small></div>`).join('');
}
function frame(now) {
  const delta = Math.min((now - last) / 1000, .1); last = now;
  if (!paused) {
    accumulated += delta;
    while (accumulated >= 1 / 30) {
      const speed = (keys.has('shift') ? 150 : 85) / 30;
      let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
      let dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
      const len = Math.hypot(dx, dy) || 1;
      world.player.x = clamp(world.player.x + dx / len * speed, 3, WORLD_SIZE - 3);
      world.player.y = clamp(world.player.y + dy / len * speed, 3, WORLD_SIZE - 3);
      step(world); accumulated -= 1 / 30;
    }
    camera.x += (world.player.x - camera.x) * .09; camera.y += (world.player.y - camera.y) * .09;
  }
  draw(); uiTimer += delta; if (uiTimer > .2) { updateUI(); uiTimer = 0; }
  requestAnimationFrame(frame);
}
function trigger() { const e = incident(world); notify(`Incidente registrado · ${e.witnesses.length} testigos cercanos`); updateUI(); }
document.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if ([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) e.preventDefault(); if (k === ' ' && !e.repeat) trigger(); keys.add(k); });
document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = clamp(zoom * (e.deltaY > 0 ? .9 : 1.1), .5, 2.5); }, { passive: false });
$('trigger').onclick = trigger;
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'Reanudar' : 'Pausar'; $('mode').textContent = paused ? 'PAUSA' : 'EN VIVO'; };
$('count').oninput = e => $('countLabel').textContent = e.target.value;
$('reset').onclick = () => { world = createWorld(7, +$('count').value); accumulated = 0; camera.x = world.player.x; camera.y = world.player.y; notify('Simulación reiniciada con semilla 7'); updateUI(); };
$('export').onclick = () => { const blob = new Blob([JSON.stringify(snapshot(world), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'gta7-city-snapshot.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
updateUI(); requestAnimationFrame(frame);
