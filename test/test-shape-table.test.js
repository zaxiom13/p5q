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

test('table input works for rect/triangle/line/ellipse/point', async () => {
  const port = 7360 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = [
      'setup:{[document]createCanvas[240;160]; ([] ok:enlist 1b)};',
      'draw:{[state;input;document]',
      '  rect[([] x:10 60f; y:15 15f; w:20 25f; h:30 35f)];',
      '  triangle[([] x1:10 30f; y1:80 80f; x2:20 40f; y2:90 90f; x3:15 35f; y3:100 100f)];',
      '  line[([] x1:5 7f; y1:5 7f; x2:40 42f; y2:5 7f)];',
      '  ellipse[([] x:120 150f; y:40 50f; w:20 30f; h:10 12f)];',
      '  point[([] x:200 205f; y:20 25f)];',
      '  state',
      '};'
    ].join('');

    const commands = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timed out waiting for step result'));
      }, 5000);

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
          ws.send(JSON.stringify({ type: 'step', input: {} }));
          return;
        }
        if (msg.type === 'stepResult') {
          clearTimeout(timeout);
          ws.close();
          resolve(msg.commands || []);
        }
      });
    });

    assert.equal(commands.filter((c) => Array.isArray(c) && c[0] === 'rect').length, 2);
    assert.equal(commands.filter((c) => Array.isArray(c) && c[0] === 'triangle').length, 2);
    assert.equal(commands.filter((c) => Array.isArray(c) && c[0] === 'line').length, 2);
    assert.equal(commands.filter((c) => Array.isArray(c) && c[0] === 'ellipse').length, 2);
    assert.equal(commands.filter((c) => Array.isArray(c) && c[0] === 'point').length, 2);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
