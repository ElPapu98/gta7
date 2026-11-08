/** Reproducible, licensed visual asset staging for the static Pages build. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const assets = [
  { name: 'asphalt-color.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_01/asphalt_01_diff_1k.jpg', min: 200_000 },
  { name: 'asphalt-normal.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_01/asphalt_01_nor_gl_1k.jpg', min: 200_000 },
  { name: 'pavement-color.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_pavement/floor_pavement_diff_1k.jpg', min: 100_000 },
  { name: 'pavement-normal.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floor_pavement/floor_pavement_nor_gl_1k.jpg', min: 100_000 },
  { name: 'concrete-color.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete/concrete_diff_1k.jpg', min: 100_000 },
  { name: 'concrete-normal.jpg', url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete/concrete_nor_gl_1k.jpg', min: 100_000 },
  { name: 'sunset.hdr', url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_puresky_1k.hdr', min: 200_000 },
  { name: 'concept-car.glb', url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb', min: 2_000_000 },
];

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
  await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(index, null, 2));
  return index;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  downloadAssets(resolve(process.argv[2] || 'assets')).catch(error => { console.error(error); process.exitCode = 1; });
}
