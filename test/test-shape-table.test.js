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
      if (out.includes('Qanvas5 editor listening on')) {
        clearTimeout(timer);
        resolve();
      }
    });

    child.stderr.on('data', (chunk) => {
      out += chunk.toString('utf8');
    });
  });
}

test('table input works for packed rect/triangle/line/ellipse/point columns', async () => {
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
      '  rect[([] p:(10 15f;60 15f); size:(20 30f;25 35f))];',
      '  triangle[([] p1:(10 80f;30 80f); p2:(20 90f;40 90f); p3:(15 100f;35 100f))];',
      '  line[([] p1:(5 5f;7 7f); p2:(40 5f;42 7f))];',
      '  ellipse[([] p:(120 40f;150 50f); size:(20 10f;30 12f))];',
      '  point[([] p:(200 20f;205 25f))];',
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
