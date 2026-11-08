# ADR-001 — Streaming de assets de GTA7 con rangeplay

**Estado: candidato validado conceptualmente; integración de motor pendiente.**

## Decisión

Usar [HKTITAN/rangeplay](https://github.com/HKTITAN/rangeplay) (licencia MIT, conservar su aviso de copyright al redistribuirlo) como candidato para el **subsistema de archivos remotos** de la futura versión WASM. No confundirlo con un motor de render ni con una colección de assets: `rangeplay` hace streaming mediante HTTP Range, anticipación de lecturas, caché OPFS, workers y memoria compartida; sus ejemplos (tile-world, Freedoom, LibreQuake) no son escenas fotorrealistas.

No integrar todavía su bucle de GPU a nuestro Three.js actual: la API de `rangeplay` espera un worker de motor y un worker GPU conectados por anillos de comandos, mientras que `src/scene3d.js` renderiza en el hilo principal. Requiere una migración explícita y pruebas funcionales, no solo un `<script>`.

## Arquitectura objetivo

```text
Rust (nativo / WASM)  -> simulación a 30 Hz + física + IA
       | instantáneas de mundo, comandos, peticiones de sectors
       v
Render WebGPU / wgpu -> iluminación, materiales PBR, LOD, instancias, culling
       ^
       | geometría + texturas KTX2 + mallas optimizadas
       |
Catálogo de sectores -> rangeplay IO worker -> HTTP Range / CDN
                                      -> OPFS (caché persistente)
```

`rangeplay` utiliza su propio protocolo de GPU y no ofrece integración directa con `wgpu`/Bevy. Antes de comprometer el motor hay que elegir entre **adaptar sus anillos GPU**, **usar solamente su capa de IO** con un adaptador propio, o **mantener el streaming de assets del motor** y copiar patrones de diseño; esa compatibilidad todavía no está probada.

## Pipeline de calidad visual (independiente de rangeplay)

1. Adquirir legalmente modelos urbanos y superficies PBR de alta calidad; primera fuente: **Poly Haven CC0**, con inventario de autoría, licencia, URI y SHA-256 por recurso. La API pública tiene términos de uso independientes.
2. Autoría de un distrito pequeño, coherente (intersección, manzana accesible, interiores limitados, tráfico y peatones), en Blender; modelos exportados a **glTF 2.0**.
3. Horneado de detalles donde convenga; crear LOD por activo, reducir draw calls con instancing, preparar materiales metálico/rugosidad, normales, AO y texturas comprimidas **KTX2/Basis Universal**. Optimizar mallas con **meshoptimizer**.
4. Iluminación física: HDRI, sombras en cascada si la implementación las soporta, reflexión por probes/SSR, exposición y postproceso. Medir calidad visual contra capturas de referencia; no prometer ray tracing de hardware en WebGPU estándar.
5. Empaquetar sectores y `bootset` mediante las herramientas oficiales de `rangeplay`, cuando exista un motor/loader compatible. Medir tiempos de primer frame, latencia de lecturas, calidad perceptual y FPS p95 en hardware definido.

## Contrato de hosting

- `rangeplay` requiere `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp` (o una variante `credentialless` compatible), además de `SharedArrayBuffer` y `OffscreenCanvas`.
- **GitHub Pages no admite la configuración directa** de estas cabeceras. Seguirá mostrando la *preview* Three.js, pero no debe anunciarse como runtime `rangeplay` listo para producción. Los trucos con service worker para aislar Pages añaden complejidad y restricciones a recursos de terceros; no se toman como base de producción.
- Se aporta `_headers` para **Cloudflare Pages/Netlify** (ajustar despliegue del host elegido). Se debe publicar el archivo en la raíz de salida, y comprobar cabeceras de respuesta y respuesta `206 Partial Content` sobre cada paquete de datos.
- `npm run doctor -- https://HOST/` comprueba acceso, COOP y COEP. Es un **precheck**: no sustituye `rangeplay doctor`, que además valida manifest, hashes y rangos de bytes cuando existan paquetes reales.
- En despliegue de producción, todos los scripts/CDN externos deberán funcionar con COEP; idealmente alojar localmente módulos, texturas y ejecutables.

## Gates para cambiar la preview pública

- [ ] Escena de referencia con assets licenciados y coherentes, no solo cubos procedurales.
- [ ] Controlador con colisiones, vehículo, una misión completada, guardado/carga y NPCs navegando sobre malla.
- [ ] `wgpu` dibuja escena tanto en nativo como WASM, con pruebas en al menos un navegador WebGPU compatible.
- [ ] Adaptador de lectura `rangeplay` integrado en motor real y trazas verificadas de demanda/hints.
- [ ] Hosting aislado y `rangeplay doctor` verde; datos devuelven `206` y caché inmutable.
- [ ] Presupuesto de calidad: escena inicial rápida y un frame estable a 1080p en GPU objetivo, medidos, no supuestos.

**Referencias:** [rangeplay architecture](https://github.com/HKTITAN/rangeplay/blob/main/docs/architecture.md), [deploying](https://github.com/HKTITAN/rangeplay/blob/main/docs/deploying.md), [Poly Haven](https://polyhaven.com/license), [wgpu](https://wgpu.rs/doc/wgpu/).
