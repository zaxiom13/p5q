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

    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early (${code}). Output:\n${out}`));
    });
  });
}

test('rapid repeated run requests should not emit runtimeError', async () => {
  const port = 6700 + Math.floor(Math.random() * 200);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = 'setup:{[document]createCanvas[200;120]; ([] ok:enlist 1i)};draw:{[state;input;document] background[0]; circle[([] p:enlist 100 60f; d:enlist 30f)]; state};';

    const runResults = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      let runCount = 0;
      let runtimeErrors = [];

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Timed out. runResult=${runCount}, errors=${JSON.stringify(runtimeErrors)}`));
      }, 6000);

      ws.on('open', () => {
        for (let i = 0; i < 10; i += 1) {
          ws.send(JSON.stringify({ type: 'run', code: sketch }));
        }
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));

        if (msg.type === 'runtimeError') {
          runtimeErrors.push(msg.message);
        }

        if (msg.type === 'runResult') {
          runCount += 1;
          if (runCount === 10) {
            clearTimeout(timeout);
            ws.close();
            resolve({ runCount, runtimeErrors });
          }
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert.equal(runResults.runCount, 10);
    assert.equal(runResults.runtimeErrors.length, 0, `Got runtimeErrors: ${JSON.stringify(runResults.runtimeErrors)}`);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
