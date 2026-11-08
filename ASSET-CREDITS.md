# GTA7.WASM — third-party visual assets

The original game code and procedural district remain separate from the following third-party assets, downloaded during the GitHub Pages build by `tools/fetch-assets.mjs`.

| Asset | Source | License | Credit |
| --- | --- | --- | --- |
| `asphalt-color.jpg`, `asphalt-normal.jpg` | [Poly Haven: Asphalt 01](https://polyhaven.com/a/asphalt_01) | CC0 1.0 | Charlotte Baglioni (photography), Dario Barresi (processing) |
| `pavement-color.jpg`, `pavement-normal.jpg` | [Poly Haven: Floor Pavement](https://polyhaven.com/a/floor_pavement) | CC0 1.0 | Poly Haven; see current asset page for authors |
| `concrete-color.jpg`, `concrete-normal.jpg` | [Poly Haven: Concrete](https://polyhaven.com/a/concrete) | CC0 1.0 | Poly Haven; see current asset page for authors |
| `sunset.hdr` | [Poly Haven: Industrial Sunset (Pure Sky)](https://polyhaven.com/a/industrial_sunset_puresky) | CC0 1.0 | Poly Haven; see current asset page for authors |
| `concept-car.glb` | [Khronos glTF Sample Assets: CarConcept](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept) | CC BY 4.0 | © 2024 Darmstadt Graphics Group GmbH; Eric Chadwick — model and textures. Logos carry independent Khronos trademark terms. |
| `cesium-man.glb` | [Khronos glTF Sample Assets: CesiumMan](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan) | CC BY 4.0 | © 2017 Cesium, model, texture and skeletal animation. Cesium marks carry separate trademark terms. |
| `urban-facade.glb` | [Poly Haven: Modular Urban Apartments Facade](https://polyhaven.com/a/modular_urban_apartments_facade) | CC0 1.0 | Poly Haven artists |
| `street-lamp.glb` | [Poly Haven: Street Lamp 01](https://polyhaven.com/a/street_lamp_01) | CC0 1.0 | Poly Haven artists |

The source materials have not been artistically altered; Poly Haven's `.gltf` plus referenced texture files are repacked as `.glb` for static distribution, and models are resized or scaled at render time. Attribution is required for the car and CesiumMan and is retained here. This project does not claim affiliation with Khronos, Darmstadt Graphics Group, Cesium or Poly Haven.

Note: Poly Haven API service terms differ from CC0 asset licensing. Our build fetches explicitly pinned resource URLs and does not ship its API client. Production builds should mirror/cache assets under suitable distribution policies, monitor source availability and verify SHA-256 values in `assets/manifest.json`.
