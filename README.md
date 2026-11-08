# GTA7.WASM — Living City Lab

Original open-world simulation research project. This repository is **pre-alpha**, not a GTA VI-scale game or an official Rockstar product. It starts with an observable, deterministic citizen simulation and a 2D systems-debugger; the production renderer is a later phase.

## Run the verified browser prototype

Requires Node.js 20+; no dependencies or downloads.

```bash
npm run dev
# open http://127.0.0.1:4173
npm test
```

### GitHub Pages

The `.github/workflows/pages.yml` workflow runs tests and deploys a static preview on every push to `main`. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Public project URL: `https://elpapu98.github.io/gta7/`. The workflow publishes only browser assets; the Rust native/WASM build remains experimental.

Move with WASD/arrow keys; Shift accelerates; Space generates a simulated vehicle-theft incident; mouse wheel zooms; Pause freezes time. Use the sidebar to change population (applies after reset), watch witnesses and police reports, and export a JSON snapshot.

## Rust / WebAssembly core (experimental, not yet wired to browser)

Install stable Rust, `wasm-pack` and the `wasm32-unknown-unknown` target.

```bash
cargo test --workspace
wasm-pack build crates/gta7-core --target web --out-dir ../../pkg
```

The WASM artifact created by the second command is `pkg/gta7_core_bg.wasm`. Rename it only when the final loader and build pipeline support the desired `gta7.wasm` product naming. **The current browser prototype runs the JavaScript reference implementation**, not the experimental Rust core. The two cores are not yet feature-parity compatible; integrating them is an explicit milestone.

## Architecture decision record

| Subsystem | First delivery | Long-term implementation |
| --- | --- | --- |
| Citizen simulation | JS deterministic reference | Rust `gta7-core`, compiled to WASM and native |
| Simulation clock | Fixed 30 Hz | Fixed tick, rollback/replay logs |
| Graphics | Canvas 2D city diagnostics | Bevy / wgpu / WebGPU with a native target |
| Physics | Point navigation prototype | Rapier 3D with authoritative collision |
| Navigation | Direct destinations | Hierarchical street graph, navmesh and steering |
| AI | Home/work/flee, individual event memory | Needs, relationships, witnesses, evidence and investigation |
| Persistent data | Snapshot JSON | Versioned save schema, OPFS and server database |
| Multiplayer | Not implemented | Server-authoritative Rust, interest management |
| Production | Local prototype | Assets pipeline, sector streaming, telemetry and profiling |

### Architecture boundaries

```text
INPUT / GAMEPLAY           RENDERER (WebGPU/native)
        |                         ^
        v                         |
  COMMAND QUEUE -> SIMULATION CORE -> READ-ONLY WORLD SNAPSHOTS
                       |
                       v
                 EVENTS / MEMORY
                       |
                       v
                 PERSISTENCE / NET
```

- Game logic runs at a fixed step independent of rendering FPS.
- `seed + ordered commands + version` must eventually reproduce a simulation.
- Models and language inference operate off the critical path; behavior trees/utility systems decide each frame.
- On multiplayer servers, the client sends intent, not authoritative position or economic state.
- The citizen and crime systems are original IP. Avoid importing copyrighted game assets or leaked code.

## Milestones and acceptance gates

1. **M0 / Research prototype (this repository):** deterministic citizen agents, time-based routines, witnessing, delayed incident reports, movement and snapshot. Browser and JS tests verified.
2. **M1 / Rust parity:** define serializable command and snapshot schema, reproduce golden test traces across JS/Rust, replace JS simulation with actual WASM, exercise native Rust CLI/headless build.
3. **M2 / 3D district:** one 500 m × 500 m sector with streaming terrain/buildings, third-person controller, vehicles and interaction; profile the CPU/GPU independently.
4. **M3 / Urban behavior:** graph routing, jobs, services, conversations, police evidence; record replayable scenarios and performance benchmarks.
5. **M4 / vertical slice:** one polished district and complete mission loop, accessibility, optimization and save/load.
6. **M5 / scale-out:** server authority, user-created content, district streaming, load testing, anti-cheat and production tooling.

### Performance budgets (targets, not measured results)

- 60 FPS at 1080p on an explicitly selected desktop GPU, giving 16.7 ms total per frame.
- 30 Hz simulation: 33.3 ms per tick; target less than 5 ms on the simulation thread at initial NPC density.
- Report p50/p95/p99 tick cost, frame time, draw calls, number of active agents and resident memory before claiming scale.
- Profile both WebGPU browsers and native builds; no assertion of parity until measured.

## Known limitations

- This is a systems-debugging 2D map, not a 3D open-world game.
- Agents currently travel in straight lines, may pass through structures and don't have obstacle avoidance.
- Report timing is simulated and police dispatch is a recorded event, not a physical pursuing police unit.
- `Rust` crate is an initial API sketch with a smaller behavior set than the browser reference.
- Runtime compilation is not verified in environments without Rust/Cargo.
- No multiplayer, dialogue model, vehicle driving, persistence backend or third-party asset pipeline exists yet.

## Project structure

```text
gta7/
  index.html                    Browser diagnostics
  src/main.js                   Canvas renderer + controls
  src/simulation.js             Deterministic JS reference
  src/style.css                 UI
  tests/simulation.test.mjs     Automated invariants
  crates/gta7-core/src/lib.rs   Rust/WASM core scaffold
  tools/serve.mjs               No-dependency dev server
```
