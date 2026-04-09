import test from 'node:test';
import assert from 'node:assert/strict';

import { isSafeHref } from './app.mjs';

test('isSafeHref allows web, mail, and relative links', () => {
  assert.equal(isSafeHref('https://example.com'), true);
  assert.equal(isSafeHref('http://example.com'), true);
  assert.equal(isSafeHref('mailto:test@example.com'), true);
  assert.equal(isSafeHref('/pull/123'), true);
  assert.equal(isSafeHref('../docs/guide.md'), true);
  assert.equal(isSafeHref('#summary'), true);
});

test('isSafeHref rejects dangerous schemes', () => {
  assert.equal(isSafeHref('javascript:alert(1)'), false);
  assert.equal(isSafeHref('data:text/html,<svg/onload=alert(1)>'), false);
  assert.equal(isSafeHref('vbscript:msgbox(1)'), false);
  assert.equal(isSafeHref('jav\tascript:alert(1)'), false);
  assert.equal(isSafeHref('java\nscript:alert(1)'), false);
});
