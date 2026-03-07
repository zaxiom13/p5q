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

test('rerun clears stale session bindings after load-time failure', async () => {
  const port = 7460 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const firstSketch =
      'a:10; show a; setup:{[document]createCanvas[100;100]; ([] ok:enlist 1i)}; draw:{[state;input;document] state};';
    const secondSketch =
      'show a; setup:{[document]createCanvas[100;100]; ([] ok:enlist 2i)}; draw:{[state;input;document] state};';

    const events = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const seen = [];
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Timed out waiting for rerun failure: ${JSON.stringify(seen)}`));
      }, 7000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: firstSketch }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        seen.push(msg);

        if (msg.type === 'runResult' && seen.filter((x) => x.type === 'runResult').length === 1) {
          ws.send(JSON.stringify({ type: 'run', code: secondSketch }));
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
    const stdoutLines = events.filter((msg) => msg.type === 'stdout').map((msg) => msg.line);

    assert.equal(runResults.length, 1, `expected rerun to reject stale bindings: ${JSON.stringify(events)}`);
    assert.ok(runtimeError, `expected runtimeError after load-time failure: ${JSON.stringify(events)}`);
    assert.match(runtimeError.message || '', /setup not loaded/i);
    assert.deepEqual(stdoutLines, ['10'], `expected only first run to emit stdout: ${JSON.stringify(events)}`);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
