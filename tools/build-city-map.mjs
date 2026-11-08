// Build-time OSM snapshots keep mobile players off rate-limited Overpass APIs.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CITY_CONFIG, fetchCity, classifyGeoJSON } from '../src/portoviejo.js';

const directory = resolve('assets/maps');
await mkdir(directory, {recursive:true});
let failures = 0;
for(const key of ['quito']) {
  const city=CITY_CONFIG[key];
  try {
    const data=process.argv[2]
      ? classifyGeoJSON(JSON.parse(await readFile(resolve(process.argv[2]),'utf8')),city)
      : await fetchCity(city,{useBundled:false,signal:AbortSignal.timeout(95000)});
    if(data.roads.length<15 || data.buildings.length<15)throw Error('Insufficient real-world coverage');
    const file=resolve(directory,`${key}.json`);
    await writeFile(file,JSON.stringify(data));
    console.log(`MAP ${key}: ${data.roads.length} roads, ${data.buildings.length} buildings`);
  }catch(error) {
    failures++;
    console.warn(`MAP ${key}: live fallback required (${error.message})`);
  }
}
if(failures)process.exitCode=1;
