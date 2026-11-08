# Quito: geospatial source register (prototype v0.11)

This game uses Quito as its default geographic setting (`?city=quito`).
The optional `?city=portoviejo` retains the earlier setting.

## Incorporated now

- OpenStreetMap highway ways, building footprints, parks and water features.
  Geometry is requested from public Overpass endpoints and projected to local
  metres around La Carolina (-0.1865, -78.4865). Building heights come from
  `height` or `building:levels`; missing heights default to 6.2 m, explicitly
  an estimate. The loaded neighborhood is about 2.5 km across.
- OSM contributors are credited in the permanent in-game footer.
  OpenStreetMap data is ODbL 1.0: https://www.openstreetmap.org/copyright
  Review derivative-database obligations before distributing extracted caches.
- Mapzen/Tilezen Terrarium elevation tiles from the public AWS dataset:
  https://registry.opendata.aws/terrain-tiles/
  Terrain elevation is sampled in metres and converted to relative heights
  around the city origin. The mesh, major road segments, spawn position and
  vehicle/player elevation follow this DEM when tiles can be loaded. If tile
  loading fails the scene remains flat. Tilezen and its DEM contributors are
  credited in the game's footer; source attribution varies by tile:
  https://github.com/tilezen/joerd/blob/master/docs/attribution.md
- Nearby facade windows are stylized, deterministic visual approximations,
  not survey-accurate or photogrammetric building imagery.

## Official Quito datasets investigated, not yet incorporated

- Geoportal REST catalog: https://geoquito.quito.gob.ec/server/rest/services
- Hosted `Cartografia_predial` MapServer:
  https://geoquito.quito.gob.ec/server/rest/services/Hosted/Cartografia_predial/MapServer
- Urban-analysis layer, use/edificability:
  https://geoquito.quito.gob.ec/server/rest/services/web_reference_dmot/analisis_espacial/MapServer/12
- Published 3D scene service list:
  https://geoquito.quito.gob.ec/server/rest/services/Hosted
- Quito municipality's 3D explorer:
  https://habitat.quito.gob.ec/explora-tu-ciudad

These ArcGIS endpoints have queryable or viewable resources but their visibility
alone is **not** proof that building meshes, textures, or bulk cadastral datasets
may be repackaged into GTA7. Do not scrape/copy proprietary 3D meshes. Obtain
dataset-specific license metadata and permission before incorporating them.

## Next production milestones

1. Obtain a licensed, versioned offline OSM extract instead of relying on
   live Overpass availability for every game startup.
2. Validate road graph connectivity and adapt spawn points and vehicle AI.
3. Validate terrain tile CORS, elevation alignment and local slopes on actual
   devices; improve road grade transitions, sidewalks and collision surfaces.
4. Create measured, recognizable landmark models and street-facing facades.
5. Stream quadtree/sector tiles with instanced meshes and LOD for mobile GPUs.

This is a geographic prototype, **not** an architectural digital twin or a
complete, photorealistic reconstruction of Quito.
