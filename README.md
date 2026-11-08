# GTA7.WASM — Living City Lab

**Escenario autoral — Plaza Bahía (versión 0.8):** el bloque
central noreste incorpora una plaza cívica de 62 × 62 m con pabellón cultural
acristalado, marquesina iluminada, pavimento con juntas y apliques metálicos,
fuente animada, escultura, jardineras, árboles y bancos. El pabellón y los
elementos principales tienen colisión para el personaje y el vehículo. La
escena utiliza nuevos mapas CC0 de asfalto envejecido 2K y bloque de concreto
2K, además del sistema de materiales PBR y el HDRI descargados por el
proyecto, y dispone de iluminación adaptada a las tres franjas horarias.
Se llega caminando desde el origen hacia el noreste, aproximadamente a
`x=46, z=46`. Es un *set piece* completo dentro de la ciudad existente,
**no una conversión de toda la ciudad a gráficos fotorrealistas AAA**.

> **Investigación de streaming (ADR-001):** [arquitectura, plan de assets hiperrealistas y requisitos de `rangeplay`](docs/ADR-001-rangeplay.md). Hay un precheck de cabeceras con `npm run doctor -- https://HOST/` y un archivo `_headers` para hosts compatibles. **La preview actual aún no ejecuta rangeplay; los nuevos recursos PBR no convierten por sí solos el distrito procedural en una ciudad fotorrealista.**

**Visual milestone 0.3:** la construcción de Pages descarga materiales PBR de asfalto, pavimento y concreto, un HDRI real y un vehículo glTF detallado. El prototipo sigue siendo una ciudad procedural estilizada, no un entorno AAA; ahora utiliza algunos recursos fotográficos reales y una malla de vehículo de producción. Véase [licencias y créditos](ASSET-CREDITS.md).

**Interaction milestone 0.4:** la pantalla de inicio muestra bytes reales recibidos de los recursos, porcentaje, etapa de decodificación y errores explícitos. Permite reintentar o iniciar el modo de compatibilidad con materiales de respaldo cuando una descarga falla. Compatible con teclado/ratón, gamepads estándar mediante Gamepad API y controles táctiles con joystick virtual. El motor sigue siendo WebGL 2 y JavaScript; el núcleo Rust/WASM y el streaming Rangeplay están en la hoja de ruta, no conectados aún.

**Character and environment milestone 0.5:** controlador de personaje con aceleración, desaceleración, giro angular corto, desplazamiento por paredes y pasos de colisión subsegmentados. Se carga un personaje CesiumMan animado y una muestra de fachadas/farolas urbanas CC0 de Poly Haven, empaquetadas como GLB autónomos por el proceso de compilación. Son recursos de alta fidelidad relativa, pero no garantizan realismo cinematográfico. El escenario completo, el tráfico y muchos peatones siguen siendo prototipos procedurales.

**Movement and scene milestone 0.6:** corregida la inversión de direcciones de cámara: W se aleja de ella, A/D corresponden a izquierda/derecha visuales, y el vehículo se orienta al entrar para avanzar en esa dirección. Pruebas específicas cubren cuatro direcciones y cámara girada. La simulación de NPC ahora usa paso fijo de 30 Hz, independientemente de FPS; 18 ciudadanos cercanos reutilizan esqueletos animados clonados correctamente. Nuevos props CC0 (contenedores, hidrantes, asientos y arbustos). La carga se divide en **escena jugable inicial** y **detalle 3D progresivo**, con estado de descarga visible en el HUD; en dispositivos táctiles se descarga un subconjunto más ligero. Algunos agentes lejanos y árboles siguen siendo procedurales y requieren reemplazo/LOD en futuras entregas.

**Release verification 0.7:** `/v0.7.html` es una entrada con nombre único que evita el HTML anterior retenido en caché de GitHub Pages. El HUD muestra `VERSIÓN 0.7.0`, la hoja de estilos y los módulos JS llevan su versión en URL, y cada asset utiliza su SHA-256 como clave de caché, con verificación de integridad cuando WebCrypto está disponible. El workflow hace comprobaciones HTTP **después** del despliegue y falla si el HTML o modelos no están publicados. También se corrigió que los planos de carretera PBR quedaban tapados por cajas de asfalto plano. URL de prueba: [v0.7.html](https://elpapu98.github.io/gta7/v0.7.html). Esto verifica publicación y archivos, no demuestra FPS ni WebGL en todos los dispositivos.

La escena incorpora cielo atmosférico `Sky` con posición solar para tres franjas horarias, mapeado PBR y un límite de resolución más conservador en pantallas táctiles. No hay medidas de FPS certificadas en teléfonos o mandos físicos; el rendimiento y la compatibilidad deben validarse en hardware real. La barra de carga mide **bytes de red reales**, no el progreso interno de descompresión o subida de texturas a GPU; esa fase se indica separadamente.

Original open-world simulation research project. This repository is **pre-alpha**, not a GTA VI-scale game or an official Rockstar product. Version 0.2 adds an interactive, procedural 3D city preview powered by Three.js/WebGL 2. The simulation remains a JavaScript reference; Rust/WASM integration remains a future milestone.

## Run the verified browser prototype

Requires Node.js 20+; no npm dependencies. The visual upgrade downloads third-party licensed assets into `assets/`.

```bash
npm run dev
# open http://127.0.0.1:4173
npm test
npm run assets   # descarga los recursos gráficos para la misma experiencia que Pages
```

### GitHub Pages

The `.github/workflows/pages.yml` workflow runs tests and deploys a static preview on every push to `main`. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Public project URL: `https://elpapu98.github.io/gta7/`. The workflow publishes only browser assets; the Rust native/WASM build remains experimental.

Move with WASD/arrow keys; hold Shift to run; drag the mouse to rotate the camera; mouse wheel zooms. Approach the golden car and press E to enter/exit; drive with WASD. Press F at the yellow mission marker to accept, collect and deliver packages against a countdown. Contracts earn cash, unlock longer routes and save progress in localStorage. Change the camera, lighting and traffic from the controls. Space records a simulated incident in the underlying reference simulation.

**Mandos estándar (Xbox/PlayStation compatible):** stick izquierdo para caminar o conducir; stick derecho para cámara; botón inferior (A/Cruz) para interactuar; botón izquierdo (X/Cuadrado) para entrar/salir del coche; botón superior (Y/Triángulo) cambia cámara; botón derecho (B/Círculo) activa incidente de simulación; RB/R2 para correr a pie. El navegador debe reconocer el mando con mapeo `standard`; el reconocimiento puede requerir pulsar un botón. **Táctil:** joystick izquierdo, deslizar en zona derecha para cámara, botones CORRER/COCHE/ACCIÓN. El móvil requiere suficiente GPU para WebGL 2 y la escena puede tener bajo rendimiento en hardware modesto.

The 3D scene loads Three.js 0.170.0 as a pinned ES module from jsDelivr. An internet connection is required. It uses procedural geometry with real CC0 PBR materials and HDRI, and a CC BY 4.0 showcase vehicle with attribution. This is still a **stylized architectural preview**, not photorealistic AAA content.

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
| Missions and economy | 3 timed courier jobs, cash and local progress | Data-driven jobs, world economy, server authority |
| Simulation clock | Fixed 30 Hz | Fixed tick, rollback/replay logs |
| Graphics | Three.js WebGL 2 procedural district | Bevy / wgpu / WebGPU with a native target |
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

1. **M0 / Research prototype (this repository):** deterministic citizen agents, time-based routines, witnessing, delayed incident reports, movement and snapshot; procedural 3D streets and buildings, third-person navigation and one driveable vehicle. Browser simulation tests verified.
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

- The 3D presentation is a procedural visual prototype, not a complete open-world game or a photorealistic production environment.
- The current rendering implementation uses WebGL 2/Three.js, not WebGPU; the production Rust/WGPU architecture is future work.
- Agents currently travel in straight lines, may pass through structures and don't have obstacle avoidance.
- Report timing is simulated and police dispatch is a recorded event, not a physical pursuing police unit.
- `Rust` crate is an initial API sketch with a smaller behavior set than the browser reference.
- Runtime compilation is not verified in environments without Rust/Cargo.
- No multiplayer, dialogue model, persistence backend or bundled third-party asset pipeline exists yet. Local progress storage exists only for mission cash/count.

## Project structure

```text
gta7/
  index.html                    Browser diagnostics
  src/scene3d.js                Procedural Three.js environment + 3D controls
  src/gameplay.js               Headless mission state machine and economy
  src/main.js                   Retained legacy 2D diagnostics renderer
  src/simulation.js             Deterministic JS reference
  src/style.css                 UI
  tests/simulation.test.mjs     Automated invariants
  crates/gta7-core/src/lib.rs   Rust/WASM core scaffold
  tools/serve.mjs               No-dependency dev server
```
