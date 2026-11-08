// Deterministic planar third-person locomotion, independent of renderer/FPS.
export function createMotor(x = 0, z = 0) { return { x, z, vx: 0, vz: 0, heading: 0, moving: false, speed: 0 }; }
export function shortestTurn(from, to) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }

export function stepMotor(state, input, cameraYaw, delta, isBlocked = () => false) {
  const dt = Math.max(0, Math.min(delta, .05));
  const f = input.forward || 0, s = input.sideways || 0;
  const magnitude = Math.min(1, Math.hypot(f,s));
  const dx = (Math.sin(cameraYaw)*f + Math.cos(cameraYaw)*s);
  const dz = (Math.cos(cameraYaw)*f - Math.sin(cameraYaw)*s);
  const length = Math.max(1, Math.hypot(dx,dz));
  const maxSpeed = input.run ? 8.5 : 4.4;
  const targetX = dx/length*maxSpeed, targetZ = dz/length*maxSpeed;
  const response = magnitude ? 12 : 18;
  const smoothing = 1-Math.exp(-response*dt);
  state.vx += (targetX-state.vx)*smoothing;
  state.vz += (targetZ-state.vz)*smoothing;
  if (!magnitude && Math.hypot(state.vx,state.vz)<.015) state.vx=state.vz=0;
  const steps = Math.max(1,Math.ceil(Math.hypot(state.vx,state.vz)*dt/.35));
  for(let i=0;i<steps;i++){
    const nx=state.x+state.vx*dt/steps;
    if (!isBlocked(nx,state.z))state.x=nx;else state.vx=0;
    const nz=state.z+state.vz*dt/steps;
    if (!isBlocked(state.x,nz))state.z=nz;else state.vz=0;
  }
  state.speed=Math.hypot(state.vx,state.vz);
  state.moving=state.speed>.1;
  if(state.moving){
    const desired=Math.atan2(state.vx,state.vz);
    state.heading+=shortestTurn(state.heading,desired)*(1-Math.exp(-14*dt));
  }
  return state;
}

// First segment hit against horizontal building rectangles; prevents a chase
// camera from repeatedly entering a wall when the player hugs a facade.
export function cameraClearance(from, to, rectangles, clearance = .65) {
  let safe = 1;
  const dx=to.x-from.x,dz=to.z-from.z;
  for(const box of rectangles) {
    let entry=0,exit=1;
    for(const [start,delta,min,max] of [
      [from.x,dx,box.x-box.w/2-clearance,box.x+box.w/2+clearance],
      [from.z,dz,box.z-box.d/2-clearance,box.z+box.d/2+clearance],
    ]){
      if(Math.abs(delta)<1e-8){if(start<min||start>max){entry=2;break;}continue;}
      const a=(min-start)/delta,b=(max-start)/delta;
      entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    }
    if(entry<=exit && entry>=0 && entry<safe)safe=Math.max(.15,entry-.04);
  }
  return safe;
}
