// Terrarium DEM sampling. Mapzen/Tilezen terrain tiles aggregate open elevation
// datasets; provider-specific attribution is documented in docs/QUITO-DATA.md.
const DEG = Math.PI / 180;
export function tilePosition(lat, lon, zoom = 12) {
  const n = 2 ** zoom;
  const x = (lon + 180) / 360 * n;
  const y = (1 - Math.log(Math.tan(lat * DEG) + 1 / Math.cos(lat * DEG)) / Math.PI) / 2 * n;
  return { x, y };
}
export function terrariumHeight(r, g, b) {
  return r * 256 + g + b / 256 - 32768;
}
export function createElevationSampler(origin, tiles, zoom = 12) {
  const originPosition = tilePosition(origin.lat, origin.lon, zoom);
  const sample = (lat, lon) => {
    const p = tilePosition(lat, lon, zoom), tx = Math.floor(p.x), ty = Math.floor(p.y);
    const tile = tiles.get(`${tx}/${ty}`);
    if (!tile) return null;
    const px = Math.max(0, Math.min(255, (p.x-tx)*255));
    const py = Math.max(0, Math.min(255, (p.y-ty)*255));
    const at = (x,y) => {
      const i = (Math.floor(y)*256+Math.floor(x))*4;
      return terrariumHeight(tile[i],tile[i+1],tile[i+2]);
    };
    const x=Math.floor(px),y=Math.floor(py),fx=px-x,fy=py-y;
    const h0=at(x,y)*(1-fx)+at(Math.min(x+1,255),y)*fx;
    const h1=at(x,Math.min(y+1,255))*(1-fx)+at(Math.min(x+1,255),Math.min(y+1,255))*fx;
    return h0*(1-fy)+h1*fy;
  };
  const base = sample(origin.lat,origin.lon);
  const cos = Math.cos(origin.lat * DEG);
  return (x,z) => {
    const lat=origin.lat-z/111320,lon=origin.lon+x/(111320*cos);
    return (sample(lat,lon) ?? base ?? 0)-(base ?? 0);
  };
}
export async function loadTerrain(origin, { signal } = {}) {
  const zoom=12, tiles=new Map();
  const corners=[[-1450,-1450],[-1450,1450],[1450,-1450],[1450,1450],[0,0]];
  const cos=Math.cos(origin.lat*DEG);
  const keys=new Set(corners.map(([x,z])=>{
    const p=tilePosition(origin.lat-z/111320,origin.lon+x/(111320*cos),zoom);
    return `${Math.floor(p.x)}/${Math.floor(p.y)}`;
  }));
  await Promise.all([...keys].map(async key=>{
    const [x,y]=key.split('/');
    const response=await fetch(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${zoom}/${x}/${y}.png`, { signal });
    if(!response.ok)throw Error(`DEM HTTP ${response.status}`);
    const bitmap=await createImageBitmap(await response.blob());
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    context.drawImage(bitmap,0,0,256,256);bitmap.close();
    tiles.set(key,context.getImageData(0,0,256,256).data);
  }));
  return createElevationSampler(origin,tiles,zoom);
}
