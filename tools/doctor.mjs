/** Verifies the minimum host contract required by rangeplay's threaded runtime. */
export async function diagnose(baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl);
  const result = { url: base.href, checks: [] };
  const check = (name, ok, detail) => result.checks.push({ name, ok: !!ok, detail });
  let response;
  try {
    response = await fetcher(base, { redirect: 'follow' });
  } catch (error) {
    check('Página accesible', false, String(error));
    return result;
  }
  check('Página accesible', response.ok, `HTTP ${response.status}`);
  check('COOP', response.headers.get('cross-origin-opener-policy') === 'same-origin', response.headers.get('cross-origin-opener-policy') || 'ausente');
  const coep = response.headers.get('cross-origin-embedder-policy');
  check('COEP', coep === 'require-corp' || coep === 'credentialless', coep || 'ausente');
  return result;
}

export function healthy(report) {
  return report.checks.length === 3 && report.checks.every(c => c.ok);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const site = process.argv[2] || 'http://127.0.0.1:4173/';
  try {
    const result = await diagnose(site);
    console.log(`GTA7 / Rangeplay host doctor — ${result.url}`);
    for (const c of result.checks) console.log(`${c.ok ? 'OK' : 'FAIL'} ${c.name}: ${c.detail}`);
    if (!healthy(result)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
