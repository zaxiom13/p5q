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

    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early (${code}). Output:\n${out}`));
    });
  });
}

test('double run does not produce runtimeError', async () => {
  const port = 6200 + Math.floor(Math.random() * 200);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  await waitForServer(server);

  const sketch = 'setup:{createCanvas[200;120]; ([] ok:enlist 1i)};draw:{[state;input] background[0]; circle[([] x:enlist 100f; y:enlist 60f; d:enlist 30f)]; state};';

  const events = [];
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timed out waiting for messages. Events: ${JSON.stringify(events)}`));
    }, 3000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'run', code: sketch }));
      ws.send(JSON.stringify({ type: 'run', code: sketch }));
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString('utf8'));
      events.push(msg);

      if (msg.type === 'runtimeError') {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`Received runtimeError: ${msg.message}`));
      }

      const runResults = events.filter((e) => e.type === 'runResult').length;
      if (runResults >= 2) {
        clearTimeout(timeout);
        ws.close();
        resolve();
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  server.kill('SIGTERM');
  await new Promise((r) => server.once('exit', r));

  assert.ok(true);
});
