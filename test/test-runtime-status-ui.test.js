const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fallbackRuntimeStatus,
  inferRuntimeStatusFromSketch,
  sourceLabel
} = require('../public/runtimeStatus.js');

test('fallback runtime status is disconnected and does not invent setup instructions', () => {
  const status = fallbackRuntimeStatus();

  assert.equal(status.platform, 'desktop');
  assert.equal(status.configured, false);
  assert.equal(status.resolvedPath, null);
  assert.match(status.message, /If a sketch runs, q is available/i);
  assert.doesNotMatch(status.message, /Launch the Electron app/i);
});

test('successful sketch run upgrades runtime state to connected session', () => {
  const status = inferRuntimeStatusFromSketch(fallbackRuntimeStatus());

  assert.equal(status.configured, true);
  assert.equal(status.source, 'session');
  assert.equal(status.resolvedPath, 'Connected for this session');
  assert.match(status.message, /started successfully/i);
});

test('successful sketch run preserves configured runtime path', () => {
  const initial = {
    configured: true,
    source: 'saved',
    resolvedPath: '/tmp/q',
    qBinary: '/tmp/q',
    message: 'Connected to q at /tmp/q'
  };

  assert.deepEqual(inferRuntimeStatusFromSketch(initial), initial);
});

test('runtime source label includes active session state', () => {
  assert.equal(sourceLabel('session'), 'Active session');
});
