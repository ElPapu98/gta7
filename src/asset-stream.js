// Measures actual network bytes, not a timer or an estimated animation.
export async function fetchVisualAssets(manifestUrl, { onProgress = () => {}, fetcher = fetch, concurrency = 3 } = {}) {
  const manifestHref = new URL(manifestUrl, globalThis.location?.href || 'http://localhost/');
  const response = await fetcher(manifestHref, { cache: 'no-cache', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`Manifiesto gráfico: HTTP ${response.status}`);
  const manifest = await response.json();
  if (!Array.isArray(manifest) || !manifest.length) throw Error('Manifiesto gráfico vacío');
  const total = manifest.reduce((sum, asset) => sum + asset.bytes, 0);
  if (!total || manifest.some(a => !/^[a-z0-9-]+\.(jpg|hdr|glb)$/.test(a.name) || !Number.isSafeInteger(a.bytes) || a.bytes <= 0)) {
    throw Error('Manifiesto gráfico inválido');
  }
  let downloaded = 0, completed = 0, cursor = 0;
  const files = new Map(), errors = [];
  const update = (name = '') => onProgress({ loaded: downloaded, total, completed, count: manifest.length, name, errors: [...errors] });
  update('Preparando recursos');
  async function worker() {
    while (cursor < manifest.length) {
      const asset = manifest[cursor++];
      try {
        const url = new URL(asset.name, manifestHref);
        const file = await fetcher(url, { signal: AbortSignal.timeout(60000) });
        if (!file.ok) throw Error(`HTTP ${file.status}`);
        if (!file.body?.getReader) throw Error('Streaming no disponible');
        const reader = file.body.getReader(), chunks = [];
        let length = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          length += value.byteLength;
          downloaded += value.byteLength;
          update(asset.name);
        }
        if (length !== asset.bytes) throw Error(`Tamaño incorrecto: ${length} / ${asset.bytes}`);
        const bytes = new Uint8Array(length);let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset);offset += chunk.byteLength; }
        files.set(asset.name, bytes);
      } catch (error) {
        errors.push(`${asset.name}: ${error.message}`);
      }
      completed++;
      update(asset.name);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), manifest.length) }, () => worker()));
  return { files, errors, total, downloaded };
}
