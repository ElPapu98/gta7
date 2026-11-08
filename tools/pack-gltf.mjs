// Packs glTF 2.0 + its external buffer and JPEG/PNG images as one GLB.
// Exact GLB v2 chunk encoding per Khronos glTF 2.0 §4.4.
const aligned = n => (n + 3) & ~3;
export function packGltf(source, parts) {
  const json=structuredClone(source);
  if(json.buffers?.length!==1 || !json.buffers[0].uri)throw Error('Only single-buffer glTF supported');
  const geometry=parts.get(json.buffers[0].uri);
  if(!geometry)throw Error('Missing geometry buffer');
  let offset=aligned(geometry.byteLength);
  const chunks=[geometry,Buffer.alloc(offset-geometry.byteLength)];
  json.bufferViews ||= [];
  for(const image of json.images||[]){
    if(!image.uri)continue;
    const data=parts.get(image.uri);
    if(!data)throw Error(`Missing texture ${image.uri}`);
    const mime=image.uri.toLowerCase().endsWith('.png')?'image/png':'image/jpeg';
    image.bufferView=json.bufferViews.push({buffer:0,byteOffset:offset,byteLength:data.byteLength})-1;
    image.mimeType=mime;
    delete image.uri;
    chunks.push(data);
    const padding=aligned(data.byteLength)-data.byteLength;
    if(padding)chunks.push(Buffer.alloc(padding));
    offset+=aligned(data.byteLength);
  }
  json.buffers=[{byteLength:offset}];
  const binary=Buffer.concat(chunks);
  const string=Buffer.from(JSON.stringify(json));
  const jsonChunk=Buffer.alloc(aligned(string.byteLength),0x20);
  string.copy(jsonChunk);
  const header=Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67,0);
  header.writeUInt32LE(2,4);
  header.writeUInt32LE(12+8+jsonChunk.length+8+binary.length,8);
  header.writeUInt32LE(jsonChunk.length,12);
  header.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);
  binHeader.writeUInt32LE(binary.length,0);
  binHeader.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,jsonChunk,binHeader,binary]);
}
