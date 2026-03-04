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

test('background supports single-argument call', async () => {
  const port = 7380 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = 'setup:{[document]createCanvas[120;80]; ([] ok:enlist 1i)};draw:{[state;input;document] background[9]; circle[([] x:enlist 20f; y:enlist 20f; d:enlist 8f)]; state};';

    const commands = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timed out waiting for step result'));
      }, 5000);

      ws.on('open', () => ws.send(JSON.stringify({ type: 'run', code: sketch })));

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        if (msg.type === 'runtimeError') {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.message));
        }
        if (msg.type === 'runResult') {
          ws.send(JSON.stringify({ type: 'step', frame: 0, input: { mx: 0 } }));
        }
        if (msg.type === 'stepResult') {
          clearTimeout(timeout);
          ws.close();
          resolve(msg.commands || []);
        }
      });
    });

    const backgroundCmd = commands.find((c) => Array.isArray(c) && c[0] === 'background');
    assert.ok(backgroundCmd, 'expected background command');
    assert.equal(backgroundCmd[1], 9);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
