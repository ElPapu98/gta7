import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { diagnose, healthy } from '../tools/doctor.mjs';

const fake = (headers, status = 200) => async () => ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers) });

test('a properly isolated host can run rangeplay', async () => {
  const r = await diagnose('https://example.org/', fake({
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp',
  }));
  assert.equal(healthy(r), true);
});

test('GitHub Pages style missing isolation headers is rejected', async () => {
  const r = await diagnose('https://example.org/', fake({}));
  assert.equal(healthy(r), false);
  assert.deepEqual(r.checks.filter(c => !c.ok).map(c => c.name), ['COOP', 'COEP']);
});

test('server failure is rejected even if isolation headers are supplied', async () => {
  const r = await diagnose('https://example.org/', fake({
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp',
  }, 503));
  assert.equal(healthy(r), false);
});
