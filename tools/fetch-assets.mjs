/** Reproducible, licensed visual asset staging for the static Pages build. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { packGltf } from './pack-gltf.mjs';

export const assets = [
  { name: 'asphalt-color.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_01/asphalt_01_diff_1k.jpg', min: 200_000 },
  { name: 'asphalt-normal.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_01/asphalt_01_nor_gl_1k.jpg', min: 200_000 },
  { name: 'pavement-color.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_pavement/floor_pavement_diff_1k.jpg', min: 100_000 },
  { name: 'pavement-normal.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_pavement/floor_pavement_nor_gl_1k.jpg', min: 100_000 },
  { name: 'concrete-color.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete/concrete_diff_1k.jpg', min: 100_000 },
  { name: 'concrete-normal.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete/concrete_nor_gl_1k.jpg', min: 100_000 },
  { name: 'weathered-asphalt-color.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/asphalt_02/asphalt_02_diff_2k.jpg', min: 300_000 },
  { name: 'weathered-asphalt-normal.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/asphalt_02/asphalt_02_nor_gl_2k.jpg', min: 300_000 },
  { name: 'stone-brick-color.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/concrete_brick_wall_001/concrete_brick_wall_001_diffuse_2k.jpg', min: 300_000 },
  { name: 'stone-brick-normal.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/concrete_brick_wall_001/concrete_brick_wall_001_nor_gl_2k.jpg', min: 300_000 },
  { name: 'urban-paving-color.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/concrete_pavement_02/concrete_pavement_02_diff_2k.jpg', min: 300_000 },
  { name: 'urban-paving-normal.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/concrete_pavement_02/concrete_pavement_02_nor_gl_2k.jpg', min: 300_000 },
  { name: 'sunset.hdr', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_puresky_1k.hdr', min: 200_000 },
  { name: 'concept-car.glb', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb', min: 2_000_000 },
  { name: 'cesium-man.glb', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb', min: 200_000 },
];

const polyModels = [
  { id: 'modular_urban_apartments_facade', name: 'urban-facade.glb' },
  { id: 'street_lamp_01', name: 'street-lamp.glb' },
  { id: 'metal_trash_can', name: 'trash-can.glb' },
  { id: 'fire_hydrant', name: 'fire-hydrant.glb' },
  { id: 'modular_street_seating', name: 'street-seating.glb' },
  { id: 'shrub_02', name: 'shrub.glb' },
];

async function downloadPolyModel(model, directory, fetcher) {
  const path=resolve(directory,model.name);
  try { const cached=await readFile(path);if(cached.length>50000)return cached; }catch{}
  const manifestResponse=await fetcher(`https://api.polyhaven.com/files/${model.id}`);
  if(!manifestResponse.ok)throw Error(`Poly Haven files/${model.id}: HTTP ${manifestResponse.status}`);
  const descriptor=(await manifestResponse.json()).gltf?.['1k']?.gltf;
  if(!descriptor?.url||!descriptor.include)throw Error(`Invalid glTF package ${model.id}`);
  const get=async url=>{const response=await fetcher(url,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw Error(`HTTP ${response.status} ${url}`);return Buffer.from(await response.arrayBuffer());};
  const json=JSON.parse((await get(descriptor.url)).toString('utf8'));
  const entries=await Promise.all(Object.entries(descriptor.include).map(async ([name,data])=>[name,await get(data.url)]));
  const glb=packGltf(json,new Map(entries));
  await writeFile(path,glb);
  return glb;
}

export async function downloadAssets(directory, fetcher = fetch) {
  await mkdir(directory, { recursive: true });
  const index = [];
  for (const item of assets) {
    const path = resolve(directory, item.name);
    let bytes;
    try {
      bytes = await readFile(path);
      if (bytes.byteLength < item.min) throw Error('incomplete cache');
    } catch {
      const response = await fetcher(item.url, { signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw Error(`Asset ${item.name}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength < item.min) throw Error(`Asset ${item.name}: unexpectedly short (${bytes.byteLength} bytes)`);
      await writeFile(path, bytes);
    }
    index.push({ name: item.name, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex'), source: item.url });
    console.log(`ASSET ${item.name}: ${(bytes.byteLength / 1048576).toFixed(2)} MiB`);
  }
  for(const model of polyModels){
    const bytes=await downloadPolyModel(model,directory,fetcher);
    index.push({name:model.name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:`https://polyhaven.com/a/${model.id}`});
    console.log(`ASSET ${model.name}: ${(bytes.length/1048576).toFixed(2)} MiB`);
  }
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(index, null, 2));
  return index;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  downloadAssets(resolve(process.argv[2] || 'assets')).catch(error => { console.error(error); process.exitCode = 1; });
}
