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

test('valid run after an invalid run should recover cleanly', async () => {
  const port = 6900 + Math.floor(Math.random() * 80);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const badSketch = 'this is invalid q';
    const goodSketch = 'setup:{createCanvas[200;120]; ([] ok:enlist 1i)};draw:{[state;input] background[0]; state};';

    const result = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const events = [];
      let settled = false;

      const done = (fn, value) => {
        if (settled) {
          return;
        }
        settled = true;
        fn(value);
      };

      const timeout = setTimeout(() => {
        ws.close();
        done(reject, new Error(`Timed out. Events: ${JSON.stringify(events)}`));
      }, 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: badSketch }));
        ws.send(JSON.stringify({ type: 'run', code: goodSketch }));
        ws.send(JSON.stringify({ type: 'run', code: goodSketch }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        events.push(msg.type);

        if (events.filter((t) => t === 'runResult').length >= 2) {
          clearTimeout(timeout);
          ws.close();
          done(resolve, events);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        done(reject, err);
      });

      ws.on('close', () => {
        if (!settled) {
          clearTimeout(timeout);
          done(reject, new Error(`Socket closed before completion. Events: ${JSON.stringify(events)}`));
        }
      });
    });

    assert.ok(result.includes('runtimeError'));
    assert.equal(result.filter((t) => t === 'runResult').length, 2);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
