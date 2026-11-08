# GTA7 — production-quality input and visual research

This project is a WebGL browser vertical slice. The following distinguishes
implemented features from future art/engine production requirements.

## Input: design and reliability

1. **Desktop:** normalized camera-space WASD/arrow movement, Shift held to run,
   discrete E/F actions, drag-to-orbit camera, wheel zoom. Clear key state on
   window blur. Avoid triggering gameplay shortcuts when focus is inside a
   form field if text inputs are added later.
2. **Mobile:** movement stick is fixed to the lower-left safe zone; right-side
   drag rotates the camera. Sprint is **tap-to-toggle**, because holding a
   second button next to the left stick is impractical with one thumb. Visual
   `aria-pressed` state and explicit on/off labels make the state observable.
   Track each touch by `pointerId`, use pointer capture, `touch-action:none`,
   and handle pointer cancellation and focus loss.
3. **Gamepad:** use the browser's `standard` mapping, circular stick dead zones,
   explicit D-pad fallback and one-shot edges for discrete actions. Test real
   Xbox/PlayStation controllers; emulated browser tests alone cannot certify
   latency or mapping for all physical devices.
4. **Physics:** the present collision system is intentionally planar and
   approximate. For stairs, slopes, moving platforms, vehicles and precise
   contacts, evaluate Rapier's kinematic character controller and raycast
   vehicle controller in a separate benchmark before migrating gameplay.

Research:
- MDN Pointer Events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- MDN pointer capture: https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
- MDN touch-action: https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- NippleJS virtual sticks: https://github.com/yoannmoinet/nipplejs
- Rapier controller: https://rapier.rs/docs/user_guides/javascript/character_controller/

NippleJS is an excellent candidate for more advanced customizable controls,
but the current fixed joystick requires no new runtime dependency and now
supports dedicated pointer ownership and sprint toggling. Do not adopt a
library solely to disguise an unresolved mapping error.

## Characters: achievable asset pipeline

The existing CesiumMan is a glTF interoperability sample, not a digital human.
A professional hero character needs licensed high-resolution scans or an
artist-produced model, retopology, 2–4 LODs, PBR skin textures, eyes, hair
cards, clothing layers, a humanoid skeleton, and an animation state machine
for idle/walk/jog/run/turn/enter-vehicle. Animation blending should be
speed-driven; replaying one walk clip at a higher time scale is insufficient.

- **Adobe Mixamo**: potential source of rigged humanoid animations; Adobe says
  the characters/animations may be used royalty-free in video games. An Adobe
  account and manual selection are required. Verify each chosen asset's terms.
  https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html
- **Epic MetaHuman**: strong high-fidelity authoring ecosystem, but its Unreal
  tooling and DNA runtime are a substantial pipeline decision; do not assume
  MetaHuman content is a drop-in redistributable browser GLB.
  https://dev.epicgames.com/documentation/metahuman/metahuman-creator-in-unreal-engine
- **Khronos glTF samples**: retain CesiumMan for regression testing while a
  production character is sourced.

## Vehicles: achievable asset pipeline

The drivable CarConcept is a high-detail showroom model, but professional
driving requires dedicated wheel pivots, tire/contact shaders, suspension,
vehicle body collider, light states, interior cockpit, damage LODs and engine
audio. Procedural traffic cars remain placeholders. Add licensed automotive
models by class (sedan, pickup, taxi, bus) and verify scale/pivots before
enabling physical driving. The covered car from Poly Haven is **static street
set dressing**, not a replacement for a driveable car.

- CarConcept license: https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/CarConcept/LICENSE.md
- Poly Haven vehicle: https://polyhaven.com/a/covered_car

## Visual delivery gates

1. **Foreground sector:** physically plausible geometry, PBR normal/roughness,
   curated props and decals, consistent lighting and contact shadows.
2. **Asset budgets:** compressed meshes and textures, distance-based LODs,
   instancing for repeated props, streamed loading tiers and fallback models.
   Avoid placing multi-million-triangle 8K assets everywhere in a mobile scene.
3. **Validation:** GPU frame captures on desktop and mobile, draw calls,
   texture memory, shader compilation stalls, p50/p95 frame time, reload and
   offline/error states. Target 60 FPS desktop / 30 FPS midrange phone,
   explicitly **targets rather than measured performance**.
4. **Studio-grade path:** photorealistic cinematic open-world quality likely
   requires a substantial art team and potentially an Unreal Engine 5
   production branch (Lumen/Nanite/MetaHuman/Chaos), rather than promising
   equivalent fidelity from this current browser prototype.

Licenses and asset provenance remain in `ASSET-CREDITS.md`. Do not use leaked
or unlicensed commercial-game assets.
