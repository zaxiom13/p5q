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

test('step flood while re-running should not emit runtimeError', async () => {
  const port = 7000 + Math.floor(Math.random() * 80);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = 'setup:{createCanvas[200;120]; ([] ok:enlist 1i)};draw:{[state;input] background[0]; circle[([] x:enlist 100f; y:enlist 60f; d:enlist 30f)]; state};';

    const result = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      let frame = 0;
      let runtimeError = null;
      let runResults = 0;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Timed out. runResults=${runResults}, runtimeError=${runtimeError || 'none'}`));
      }, 6000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: sketch }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        if (msg.type === 'runtimeError') {
          runtimeError = msg.message;
          clearTimeout(timeout);
          ws.close();
          resolve({ runResults, runtimeError });
          return;
        }

        if (msg.type === 'runResult') {
          runResults += 1;

          if (runResults === 1) {
            const stepTimer = setInterval(() => {
              ws.send(JSON.stringify({ type: 'step', frame: frame++ }));
            }, 1);

            let reruns = 0;
            const rerunTimer = setInterval(() => {
              reruns += 1;
              ws.send(JSON.stringify({ type: 'run', code: sketch }));
              if (reruns >= 4) {
                clearInterval(rerunTimer);
                setTimeout(() => clearInterval(stepTimer), 220);
              }
            }, 18);
          }

          if (runResults >= 5) {
            clearTimeout(timeout);
            ws.close();
            resolve({ runResults, runtimeError });
          }
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert.equal(result.runtimeError, null, `runtimeError: ${result.runtimeError}`);
    assert.equal(result.runResults, 5);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
