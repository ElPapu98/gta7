// Measures actual network bytes, not a timer or an estimated animation.
export async function fetchVisualAssets(manifestUrl, { onProgress = () => {}, fetcher = fetch, concurrency = 3, select = () => true } = {}) {
  const manifestHref = new URL(manifestUrl, globalThis.location?.href || 'http://localhost/');
  const response = await fetcher(manifestHref, { cache: 'no-cache', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`Manifiesto gráfico: HTTP ${response.status}`);
  const all = await response.json();
  if (!Array.isArray(all) || !all.length) throw Error('Manifiesto gráfico vacío');
  const manifest = all.filter(select);
  if (!manifest.length) throw Error('No hay recursos para esta fase');
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
        // GitHub Pages permits up to 10 minutes of browser/CDN caching.
        // A content hash makes updated assets a new URL without forcing a
        // full no-store download on every visit.
        if(asset.sha256)url.searchParams.set('asset',asset.sha256.slice(0,16));
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
        if(asset.sha256 && globalThis.crypto?.subtle){
          const hash=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
          if(hash!==asset.sha256)throw Error('SHA-256 de recurso incorrecto');
        }
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
