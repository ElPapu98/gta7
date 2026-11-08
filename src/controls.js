export const deadzone = (value, threshold = .14) => Math.abs(value) < threshold ? 0 : Math.sign(value) * (Math.abs(value) - threshold) / (1 - threshold);

// Preserve stick angle through the dead zone: applying deadzone to axes
// independently distorts diagonals and causes abrupt steering near centre.
export function radialDeadzone(x, y, threshold = .14) {
  const length=Math.hypot(x,y);
  if(!Number.isFinite(length)||length<=threshold)return {x:0,y:0};
  const scale=Math.min(1,(length-threshold)/(1-threshold))/length;
  return {x:x*scale,y:y*scale};
}

export function readGamepad(pads) {
  const pad = Array.from(pads || []).find(p => p && p.connected && p.mapping === 'standard');
  if (!pad) return { connected: false, forward: 0, sideways: 0, lookX: 0, lookY: 0, run: false, actions: {} };
  const axis = i => Number.isFinite(pad.axes?.[i]) ? Math.max(-1,Math.min(1,pad.axes[i])) : 0;
  const pressed = i => Boolean(pad.buttons?.[i]?.pressed);
  const left=radialDeadzone(axis(0),axis(1)),right=radialDeadzone(axis(2),axis(3));
  const dpadX=Number(pressed(15))-Number(pressed(14));
  const dpadY=Number(pressed(12))-Number(pressed(13));
  return {
    connected: true, forward: dpadY || -left.y, sideways: dpadX || left.x,
    lookX: right.x, lookY: right.y,
    run: pressed(5) || pressed(7),
    actions: { interact: pressed(0), vehicle: pressed(2), camera: pressed(3), incident: pressed(1) },
  };
}

export function movement(keys, pad, touch = { x: 0, y: 0, run: false }) {
  const key = name => keys.has(name);
  const forward = Number(key('w') || key('arrowup')) - Number(key('s') || key('arrowdown')) + pad.forward + touch.y;
  const sideways = Number(key('d') || key('arrowright')) - Number(key('a') || key('arrowleft')) + pad.sideways + touch.x;
  const magnitude = Math.hypot(forward, sideways);
  return {
    forward: magnitude > 1 ? forward / magnitude : forward,
    sideways: magnitude > 1 ? sideways / magnitude : sideways,
    run: key('shift') || pad.run || touch.run,
  };
}
