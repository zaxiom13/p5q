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

test('text[table] supports packed per-row position and fill columns', async () => {
  const port = 7280 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = [
      'setup:{[document]createCanvas[200;120]; ([] ok:enlist 1b)};',
      'draw:{[state;input;document]',
      '  t:([] txt:("a";"b"); p:(20 24f;80 48f); fill:(255 0 0i;0 255 120i));',
      '  text[t];',
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

    const textCmds = commands.filter((c) => Array.isArray(c) && c[0] === 'text');
    assert.equal(textCmds.length, 2);
    assert.equal(textCmds[0][1], 'a');
    assert.equal(textCmds[1][1], 'b');

    const fillCmds = commands.filter((c) => Array.isArray(c) && c[0] === 'fill');
    assert.equal(fillCmds.length, 2);
    assert.deepEqual(fillCmds[0].slice(1), [255, 0, 0]);
    assert.deepEqual(fillCmds[1].slice(1), [0, 255, 120]);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
