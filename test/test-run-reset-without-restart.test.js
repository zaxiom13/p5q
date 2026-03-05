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

test('rerun resets helper definitions without restarting q', async () => {
  const port = 7420 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = 'setup:{[document]createCanvas[200;120]; ([] n:enlist helper[]) };draw:{[state;input;document] background[0]; state};';
    const events = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const seen = [];
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Timed out waiting for rerun results: ${JSON.stringify(seen)}`));
      }, 7000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: sketch, files: [{ name: 'helper.q', code: 'helper:{[] 7i};' }] }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        seen.push(msg);

        if (msg.type === 'runResult' && seen.filter((x) => x.type === 'runResult').length === 1) {
          ws.send(JSON.stringify({ type: 'run', code: sketch, files: [] }));
          return;
        }

        if (msg.type === 'runtimeError') {
          clearTimeout(timeout);
          ws.close();
          resolve(seen);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const runResults = events.filter((msg) => msg.type === 'runResult');
    const runtimeError = events.find((msg) => msg.type === 'runtimeError');

    assert.equal(runResults.length, 1, `expected first run only to succeed: ${JSON.stringify(events)}`);
    assert.ok(runtimeError, `expected rerun to fail after helper removal: ${JSON.stringify(events)}`);
    assert.match(runtimeError.message || '', /helper/i);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
