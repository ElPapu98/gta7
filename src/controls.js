export const deadzone = (value, threshold = .14) => Math.abs(value) < threshold ? 0 : Math.sign(value) * (Math.abs(value) - threshold) / (1 - threshold);

export function readGamepad(pads) {
  const pad = Array.from(pads || []).find(p => p && p.connected && p.mapping === 'standard');
  if (!pad) return { connected: false, forward: 0, sideways: 0, lookX: 0, lookY: 0, run: false, actions: {} };
  const axis = i => deadzone(Number(pad.axes?.[i] || 0));
  const pressed = i => Boolean(pad.buttons?.[i]?.pressed);
  return {
    connected: true, forward: -axis(1), sideways: axis(0), lookX: axis(2), lookY: axis(3),
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
