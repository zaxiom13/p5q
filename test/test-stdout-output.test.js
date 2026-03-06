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

test('q show output is streamed back over websocket', async () => {
  const port = 7300 + Math.floor(Math.random() * 120);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = [
      'setup:{[document] createCanvas[200;120]; ([] ok:enlist 1b)};',
      'draw:{[state;input;document]',
      '  show 5;',
      '  state',
      '};'
    ].join('');

    const result = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const seenStdout = [];
      let sawStep = false;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Timed out. stdout=${JSON.stringify(seenStdout)}`));
      }, 6000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: sketch }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));

        if (msg.type === 'runtimeError' || msg.type === 'serverError') {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.message));
          return;
        }

        if (msg.type === 'stdout') {
          seenStdout.push(String(msg.line || ''));
        }

        if (msg.type === 'runResult') {
          ws.send(
            JSON.stringify({
              type: 'step',
              input: {
                mx: 0,
                my: 0,
                pmx: 0,
                pmy: 0,
                mousePressed: false,
                mouseButton: 'none',
                keysDown: [],
                key: '',
                keyCode: 0,
                keyPressed: false,
                keyReleased: false,
                wheelDelta: 0,
                ts: 1700000000000
              }
            })
          );
          return;
        }

        if (msg.type === 'stepResult') {
          sawStep = true;
          if (seenStdout.length > 0) {
            clearTimeout(timeout);
            ws.close();
            resolve({ seenStdout, sawStep });
          }
          return;
        }

        if (msg.type === 'stdout' && sawStep) {
          clearTimeout(timeout);
          ws.close();
          resolve({ seenStdout, sawStep });
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert.ok(result.seenStdout.some((line) => line.includes('5')), `expected stdout to include 5, got: ${JSON.stringify(result.seenStdout)}`);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
