const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`Server did not start. Output:\n${out}`)), 5000);

    child.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8');
      if (out.includes('p5q editor listening on')) {
        clearTimeout(timer);
        resolve();
      }
    });

    child.stderr.on('data', (chunk) => {
      out += chunk.toString('utf8');
    });
  });
}

test('helper tabs can define functions and reject non-function statements', async () => {
  const port = 7400 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = [
      'setup:{createCanvas[180;120]; ([] ok:enlist 1i)};',
      'draw:{[state;input]',
      '  mx:first input[`mx];',
      '  circle[makeCircle[mx]];',
      '  state',
      '};'
    ].join('');

    const files = [
      {
        name: 'helpers.q',
        code: 'makeCircle:{[x] ([] x:enlist x; y:enlist 60f; d:enlist 12f)};'
      }
    ];

    const runFlow = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timed out waiting for helper tab flow'));
      }, 5000);
      let phase = 'valid-run';
      let validCommands = null;

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: sketch, files }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        if ((msg.type === 'runtimeError' || msg.type === 'serverError') && phase === 'valid-run') {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.message));
          return;
        }
        if (msg.type === 'runResult' && phase === 'valid-run') {
          ws.send(JSON.stringify({ type: 'step', input: { mx: 77 } }));
          return;
        }
        if (msg.type === 'stepResult' && phase === 'valid-run') {
          validCommands = msg.commands || [];
          phase = 'invalid-run';
          ws.send(JSON.stringify({ type: 'run', code: sketch, files: [{ name: 'bad.q', code: 'x:42' }] }));
          return;
        }
        if ((msg.type === 'runtimeError' || msg.type === 'serverError') && phase === 'invalid-run') {
          clearTimeout(timeout);
          ws.close();
          resolve({ validCommands, invalidError: msg.message || '' });
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const circleCmd = runFlow.validCommands.find((c) => Array.isArray(c) && c[0] === 'circle');
    assert.ok(circleCmd, 'expected circle command');
    assert.equal(Math.round(circleCmd[1]), 77);
    assert.match(runFlow.invalidError, /must contain only function definitions/i);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
