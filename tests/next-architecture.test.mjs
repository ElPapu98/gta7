import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAPTURES, validateCapture } from '../src/next/assets.js';

test('all photogrammetry captures have explicit source and reusable license', () => {
  assert.ok(Object.keys(CAPTURES).length >= 2);
  for (const [key,capture] of Object.entries(CAPTURES)) {
    assert.ok(validateCapture(capture),key);
    assert.match(capture.url,/^https:\/\//);
    assert.match(capture.url,/\.sog$/);
    assert.equal(capture.walking.bounds.length,2);
    assert.ok(capture.walking.bounds.every(n=>Number.isFinite(n)&&n>0));
  }
});

test('next-generation demo is isolated from existing game entry', () => {
  const html=readFileSync(new URL('../next.html',import.meta.url),'utf8');
  const classic=readFileSync(new URL('../realism.html',import.meta.url),'utf8');
  assert.match(html,/playcanvas@2\.23\.3/);
  assert.match(html,/src\/next\/main\.js/);
  assert.match(classic,/src\/realism\.js/);
});
