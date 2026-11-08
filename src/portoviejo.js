// OpenStreetMap geometry in local metres. Coordinates are deliberately kept
// separate from the game's physics and camera code.
export const PORTOVIEJO = Object.freeze({ lat: -1.0545, lon: -80.4545, radius: 1250 });
export const QUITO = Object.freeze({ lat: -0.1865, lon: -78.4865, radius: 1250 });
export const CITY_CONFIG = Object.freeze({
  quito: { ...QUITO, name: 'Quito', province: 'Pichincha' },
  portoviejo: { ...PORTOVIEJO, name: 'Portoviejo', province: 'Manabí' }
});
const metresPerDegree = 111_320;

export function project(lat, lon, origin = PORTOVIEJO) {
  return { x: (lon - origin.lon) * metresPerDegree * Math.cos(origin.lat * Math.PI / 180),
    z: -(lat - origin.lat) * metresPerDegree };
}

export function classifyWays(elements, origin = PORTOVIEJO) {
  const roads = [], buildings = [], parks = [], waters = [];
  for (const way of elements) {
    if (way.type !== 'way' || !Array.isArray(way.geometry) || way.geometry.length < 2) continue;
    const points = way.geometry.map(p => project(p.lat, p.lon, origin));
    const tags = way.tags || {};
    if (tags.highway && !['footway', 'path', 'steps', 'cycleway', 'proposed', 'construction'].includes(tags.highway)) roads.push({ points, tags });
    if (tags.building && tags.building !== 'no' && points.length >= 4) buildings.push({ points, tags });
    if (tags.leisure === 'park' || tags.landuse === 'grass' || tags.landuse === 'recreation_ground') parks.push({ points, tags });
    if (tags.natural === 'water' || tags.waterway === 'riverbank') waters.push({ points, tags });
  }
  return { roads, buildings, parks, waters };
}

export function buildingHeight(tags) {
  const explicit = Number.parseFloat(tags.height);
  if (Number.isFinite(explicit) && explicit > 1 && explicit < 250) return explicit;
  const levels = Number.parseFloat(tags['building:levels']);
  return Number.isFinite(levels) && levels > 0 && levels < 80 ? levels * 3.1 : 6.2;
}

export function roadWidth(highway) {
  return ({ motorway: 17, trunk: 14, primary: 12, secondary: 10, tertiary: 9,
    residential: 7, unclassified: 7, service: 4.5, living_street: 5 })[highway] || 6;
}

export async function fetchCity(origin = PORTOVIEJO, { signal } = {}) {
  const { lat, lon } = origin;
  const dLat = 0.0113, dLon = 0.0113;
  const bbox = `${lat-dLat},${lon-dLon},${lat+dLat},${lon+dLon}`;
  const query = `[out:json][timeout:35];(way["highway"](${bbox});way["building"](${bbox});way["leisure"="park"](${bbox});way["natural"="water"](${bbox});way["waterway"="riverbank"](${bbox}););out geom;`;
  const endpoints = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter'];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { signal });
      if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
      const json = await response.json();
      if (!Array.isArray(json.elements)) throw new Error('Formato OSM inválido');
      const features = classifyWays(json.elements, origin);
      if (features.roads.length < 15) throw new Error('Cobertura vial insuficiente');
      return features;
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  throw new Error(`No fue posible descargar el mapa OSM de ${origin.name || 'la ciudad'}`);
}

export const fetchPortoviejo = options => fetchCity(PORTOVIEJO, options);
