# GTA7 Next / PlayCanvas WebGPU + Gaussian Splatting

This is an independent **photographic rendering experiment**, not a GTA 6
competitor or an accurate Quito reconstruction. It intentionally leaves the
previous Three.js scenes and their links intact.

## Architecture

- `next.html`: separate entry point for PlayCanvas 2.23.3 via pinned ESM CDN.
- `src/next/main.js`: graphics-device selection, PlayCanvas AppBase, GSplat
  resource handler, orbit/inspection and limited first-person controller.
- `src/next/assets.js`: source-of-truth for licensed captures and initial
  camera/inspection bounds.
- `src/next/style.css`: responsive UI and mobile input overlay.

## Real photographic datasets

| Dataset | Author | License | Source | Runtime |
| --- | --- | --- | --- | --- |
| Apartment | Stephane Agullo | CC BY 4.0 | https://superspl.at/view?id=cdcec084 | `apartment.sog` from PlayCanvas Engine examples |
| Knock Community Hall | scbenoit | CC BY 4.0 | https://superspl.at/scene/0ff2e6dc | `knock-community-hall.sog` from PlayCanvas Engine examples |

Files are downloaded from the public PlayCanvas Engine example CDN at user
request, without repackaging or misrepresenting their location. License and
author are visible in the scene footer. A production asset manifest should
pin cryptographic hashes and stage verified copies when binary distribution
is introduced.

## Technical limitations

1. Gaussian splats represent photographed appearance, not solid gameplay
   collision meshes or relightable PBR geometry. Current movement uses bounded
   inspection volumes, **not physically correct collisions**.
2. The first release deliberately begins with an orbit camera so the scan can
   be inspected even if its original world orientation is unfamiliar.
3. WebGPU is requested first, with WebGL2 fallback. Safari 26+ and recent
   browsers have WebGPU support, but device capability must be measured.
4. Input and FPS must be tested on actual iPhones and GPUs before declaring a
   mobile performance target achieved.
5. Future roadmapped work: legally captured Quito block, clean collision mesh,
   mesh/splat depth integration, animation, vehicles, and LOD streaming.

## Local test

```bash
npm run dev
# /next.html
npm test
```
