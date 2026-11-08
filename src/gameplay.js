// Data-driven, headless mission system. No renderer or browser dependencies.
export const JOBS = [
  { id: 'coastal-run', title: 'Entrega costera', client: 'Mara', pickup: { x: 184, z: -92 }, dropoff: { x: -184, z: 184 }, seconds: 200, reward: 450 },
  { id: 'market-express', title: 'Mercado express', client: 'Nico', pickup: { x: -92, z: -184 }, dropoff: { x: 276, z: 92 }, seconds: 190, reward: 550 },
  { id: 'night-shift', title: 'Turno de madrugada', client: 'Vega', pickup: { x: 276, z: -276 }, dropoff: { x: -276, z: -92 }, seconds: 230, reward: 700 }
];

export function newGame(saved = {}) {
  return { cash: Number.isFinite(saved.cash) ? Math.max(0, saved.cash) : 0, completed: Number.isInteger(saved.completed) ? Math.max(0, saved.completed) : 0,
    mission: null, stage: 'idle', secondsLeft: 0, result: null, history: [] };
}

export const distanceTo = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function activeJob(game) { return game.mission ? JOBS.find(j => j.id === game.mission) : null; }
export function objective(game) {
  const job = activeJob(game);
  if (!job) return { x: 8, z: -9, text: 'Punto de encargos', type: 'start' };
  if (game.stage === 'pickup') return { ...job.pickup, text: 'Recoger paquete', type: 'pickup' };
  if (game.stage === 'delivery') return { ...job.dropoff, text: 'Entregar paquete', type: 'delivery' };
  return { x: 8, z: -9, text: 'Punto de encargos', type: 'start' };
}
export function interact(game, position, radius = 15) {
  if (distanceTo(position, objective(game)) > radius) return null;
  if (game.stage === 'idle') {
    const job = JOBS[game.completed % JOBS.length];
    game.mission = job.id; game.stage = 'pickup'; game.secondsLeft = job.seconds; game.result = null;
    return { type: 'accepted', job };
  }
  if (game.stage === 'pickup') { game.stage = 'delivery'; return { type: 'collected', job: activeJob(game) }; }
  if (game.stage === 'delivery') {
    const job = activeJob(game); game.cash += job.reward; game.completed++; game.history.push({ id: job.id, result: 'completed', reward: job.reward });
    game.mission = null; game.stage = 'idle'; game.secondsLeft = 0; game.result = 'completed';
    return { type: 'completed', job };
  }
  return null;
}
export function tickGame(game, dt) {
  if (game.stage === 'idle') return null;
  game.secondsLeft = Math.max(0, game.secondsLeft - Math.max(0, dt));
  if (game.secondsLeft > 0) return null;
  const job = activeJob(game);
  game.history.push({ id: job.id, result: 'failed', reward: 0 });
  game.mission = null; game.stage = 'idle'; game.result = 'failed';
  return { type: 'failed', job };
}
export function saveProgress(game) { return { cash: game.cash, completed: game.completed }; }
