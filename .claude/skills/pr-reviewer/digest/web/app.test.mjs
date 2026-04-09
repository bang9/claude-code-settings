import test from 'node:test';
import assert from 'node:assert/strict';

import { isSafeHref, startHeartbeat, stopHeartbeat } from './app.mjs';

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

test('startHeartbeat immediately pings and schedules repeated heartbeats', async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const originalClearInterval = globalThis.clearInterval;

  const intervalCallbacks = [];
  const cleared = [];
  const calls = [];

  globalThis.window = {
    setInterval(fn, ms) {
      intervalCallbacks.push({ fn, ms });
      return 123;
    },
  };
  globalThis.fetch = async (url) => {
    calls.push(url);
    return { ok: true };
  };

  try {
    const stop = startHeartbeat();
    await Promise.resolve();

    assert.deepEqual(calls, ['/heartbeat']);
    assert.equal(intervalCallbacks.length, 1);
    assert.equal(intervalCallbacks[0].ms, 5000);

    await intervalCallbacks[0].fn();
    assert.deepEqual(calls, ['/heartbeat', '/heartbeat']);

    globalThis.clearInterval = (id) => {
      cleared.push(id);
    };

    stop();
    assert.deepEqual(cleared, [123]);
  } finally {
    stopHeartbeat();
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    globalThis.clearInterval = originalClearInterval;
  }
});
