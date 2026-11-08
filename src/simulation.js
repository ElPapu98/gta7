// Deterministic reference simulation. Rust core is the planned authoritative replacement.
export function rng(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const streets = [90, 210, 330, 450, 570, 690, 810, 930, 1050, 1170];
export const WORLD_SIZE = 1260;
export const STREETS = streets;
const occupations = ['Barista', 'Mecánica', 'Repartidor', 'Enfermera', 'Comerciante', 'Diseñadora', 'Taxista'];
const names = ['Lucía', 'Mateo', 'Valeria', 'Elías', 'Sofía', 'Bruno', 'Camila', 'Diego', 'Isabela', 'Nicolás'];

function streetLocation(random) {
  const avenue = streets[Math.floor(random() * streets.length)];
  const coord = 45 + random() * (WORLD_SIZE - 90);
  return random() < .5 ? { x: avenue, y: coord } : { x: coord, y: avenue };
}
export function createWorld(seed = 7, count = 75) {
  const random = rng(seed);
  const agents = Array.from({ length: count }, (_, id) => {
    const home = streetLocation(random);
    const work = streetLocation(random);
    const at = streetLocation(random);
    return { id, name: names[id % names.length] + ' ' + (id + 1), job: occupations[id % occupations.length], x: at.x, y: at.y, home, work, target: work,
      speed: 10 + random() * 8, state: 'work', fear: 0, memory: [], scheduleOffset: random() * 2 - 1, mood: .3 + random() * .6 };
  });
  return { seed, tick: 0, time: 8 * 60, player: { x: 630, y: 690, heat: 0, reputation: 0 }, agents, incidents: [], dispatches: [], stats: { witnessed: 0, reports: 0 }, random };
}
export function incident(world, type = 'vehicle_theft') {
  const event = { id: world.incidents.length + 1, type, x: world.player.x, y: world.player.y, time: world.time, witnesses: [], reported: false };
  world.incidents.push(event);
  for (const agent of world.agents) {
    if (distance(agent, event) < 115) {
      agent.memory.push({ incidentId: event.id, type, time: world.time, strength: 1 });
      agent.fear = Math.max(agent.fear, .8);
      agent.state = 'flee';
      event.witnesses.push(agent.id);
    }
  }
  world.stats.witnessed += event.witnesses.length;
  if (event.witnesses.length) world.player.heat = clamp(world.player.heat + 1, 0, 5);
  return event;
}
export function step(world, dt = 1 / 30) {
  dt = clamp(dt, 0, .1);
  world.tick++;
  world.time += dt * 3;
  const hour = (world.time / 60) % 24;
  for (const a of world.agents) {
    for (const memory of a.memory) memory.strength = Math.max(.15, memory.strength - dt * .0005);
    if (a.fear > 0) a.fear = Math.max(0, a.fear - dt * .035);
    if (a.state === 'flee' && a.fear < .3) a.state = 'work';
    if (a.state !== 'flee') {
      const localHour = (hour + a.scheduleOffset + 24) % 24;
      a.state = localHour >= 7.5 && localHour < 17.5 ? 'work' : 'home';
      a.target = a.state === 'work' ? a.work : a.home;
    } else {
      a.target = { x: clamp(a.x + (a.x - world.player.x) * .5, 15, WORLD_SIZE - 15), y: clamp(a.y + (a.y - world.player.y) * .5, 15, WORLD_SIZE - 15) };
    }
    const dx = a.target.x - a.x, dy = a.target.y - a.y, len = Math.hypot(dx, dy);
    if (len > 3) { const travel = Math.min(len, a.speed * (a.state === 'flee' ? 2.4 : 1) * dt); a.x += dx / len * travel; a.y += dy / len * travel; }
  }
  for (const event of world.incidents) {
    if (!event.reported && event.witnesses.length && world.time - event.time > 1.2) {
      event.reported = true;
      world.stats.reports++;
      world.dispatches.push({ incidentId: event.id, x: event.x, y: event.y, time: world.time });
    }
  }
  world.player.heat = Math.max(0, world.player.heat - dt * .004);
}
export function snapshot(world) {
  return { seed: world.seed, tick: world.tick, time: world.time, player: { ...world.player }, agents: world.agents.map(({ id, x, y, state, fear, memory }) => ({ id, x, y, state, fear, memory: memory.map(m => ({ ...m })) })), incidents: world.incidents.map(e => ({ ...e, witnesses: [...e.witnesses] })), dispatches: world.dispatches.map(e => ({ ...e })), stats: { ...world.stats } };
}
