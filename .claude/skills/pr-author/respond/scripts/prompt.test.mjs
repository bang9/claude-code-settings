import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHostHTML } from './prompt.mjs';

test('buildHostHTML loads payload from the dedicated endpoint', () => {
  const html = buildHostHTML('app.mjs');

  assert.ok(html.includes("await fetch('/__payload')"));
  assert.ok(html.includes("await import('/__entry.mjs')"));
  assert.ok(!html.includes('const data = {'));
});

test('buildHostHTML never inlines entry filenames', () => {
  const html = buildHostHTML("evil</script><script>alert(1)</script>.mjs");

  assert.ok(!html.includes('evil</script><script>alert(1)</script>.mjs'));
});
