// Build-time OSM snapshots keep mobile players off rate-limited Overpass APIs.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CITY_CONFIG, fetchCity } from '../src/portoviejo.js';

const directory = resolve('assets/maps');
await mkdir(directory, {recursive:true});
let failures = 0;
for(const key of ['quito']) {
  const city=CITY_CONFIG[key];
  try {
    const data=await fetchCity(city,{useBundled:false,signal:AbortSignal.timeout(95000)});
    const file=resolve(directory,`${key}.json`);
    await writeFile(file,JSON.stringify(data));
    console.log(`MAP ${key}: ${data.roads.length} roads, ${data.buildings.length} buildings`);
  }catch(error) {
    failures++;
    console.warn(`MAP ${key}: live fallback required (${error.message})`);
  }
}
if(failures)console.warn('Some city snapshots unavailable; the client can still request Overpass at runtime.');
