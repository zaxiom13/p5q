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

test('generic q runtime errors include phase and source context', async () => {
  const port = 7480 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = [
      'spawnParticles:{[origin;n]',
      '  :1 2 + 1 2 3;',
      '};',
      'setup:{[document] createCanvas[120;80]; ([] ok:enlist 1i)};',
      'draw:{[state;input;document]',
      '  ps:spawnParticles[(10f;20f);10];',
      '  background[0];',
      '  state',
      '};'
    ].join('\n');

    const runtimeError = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timed out waiting for runtimeError'));
      }, 7000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: sketch }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        if (msg.type === 'runResult') {
          ws.send(JSON.stringify({ type: 'step', frame: 1, input: {}, document: {} }));
          return;
        }

        if (msg.type === 'runtimeError') {
          clearTimeout(timeout);
          ws.close();
          resolve({
            message: String(msg.message || ''),
            trace: String(msg.trace || '')
          });
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert.match(runtimeError.message, /Runtime error in draw:/i);
    assert.match(runtimeError.message, /length/i);
    assert.doesNotMatch(runtimeError.message, /q backtrace:/i);
    assert.match(runtimeError.trace, /spawnParticles/i);
    assert.match(runtimeError.trace, /\^/i);
    assert.doesNotMatch(runtimeError.trace, /\[8\]/);
    assert.doesNotMatch(runtimeError.trace, /\[5\]/);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
