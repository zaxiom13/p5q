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

test('manual table indexing with tick mod count drives animation', async () => {
  const port = 7340 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = [
      'setup:{',
      '  createCanvas[200;120];',
      '  t:([] x:10 30 50f; y:40 40 40f; d:9 9 9f);',
      '  ([] tick:enlist 0i; circles:enlist t)',
      '};',
      'draw:{[state;input]',
      '  background[0];',
      '  circles:first state[`circles];',
      '  i:first state[`tick] mod count circles;',
      '  circle[circles enlist i];',
      '  update tick:tick+1i from state',
      '};'
    ].join('');

    const frames = [0, 1, 2, 3];
    const xs = [];

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timed out collecting frame outputs'));
      }, 7000);

      let idx = 0;

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: sketch }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));

        if (msg.type === 'runtimeError') {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.message));
          return;
        }

        if (msg.type === 'runResult') {
          ws.send(JSON.stringify({ type: 'step', frame: frames[idx], input: { mx: 0 } }));
          return;
        }

        if (msg.type === 'stepResult') {
          const circle = (msg.commands || []).find((c) => Array.isArray(c) && c[0] === 'circle');
          xs.push(circle ? Math.round(circle[1]) : null);
          idx += 1;

          if (idx >= frames.length) {
            clearTimeout(timeout);
            ws.close();
            resolve();
            return;
          }

          ws.send(JSON.stringify({ type: 'step', frame: frames[idx], input: { mx: 0 } }));
        }
      });
    });

    assert.deepEqual(xs, [10, 30, 50, 10]);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
