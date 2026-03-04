const test = require('node:test');
const assert = require('node:assert/strict');
const { createRunGate } = require('../public/runGate');

test('run gate allows one in-flight run and coalesces rapid retries', () => {
  const sent = [];
  const gate = createRunGate((code) => sent.push(code));

  gate.requestRun('A');
  gate.requestRun('B');
  gate.requestRun('C');

  assert.deepEqual(sent, ['A']);

  gate.resolveRun();
  assert.deepEqual(sent, ['A', 'C']);

  gate.resolveRun();
  assert.deepEqual(sent, ['A', 'C']);
});

test('run gate does not lock in-flight when send fails', () => {
  let attempts = 0;
  const gate = createRunGate(() => {
    attempts += 1;
    return false;
  });

  const sentNow = gate.requestRun('A');
  const sentAgain = gate.requestRun('B');

  assert.equal(sentNow, false);
  assert.equal(sentAgain, false);
  assert.equal(attempts, 2);
});
