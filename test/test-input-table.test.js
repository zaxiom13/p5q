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

test('draw receives packed input snapshot table values', async () => {
  const port = 7180 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = [
      'setup:{[document]createCanvas[200;120]};',
      'draw:{[state;input;document]',
      '  tick:first input[`tick];',
      '  m:first input[`m];',
      '  mx:m 0;',
      '  text[([] txt:enlist string tick , ":" , string mx; p:enlist 10 18f)];',
      '  circle[([] p:enlist (mx;60f); d:enlist 12f)];',
      '  state',
      '};'
    ].join('');

    const result = await new Promise((resolve, reject) => {
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
          ws.send(
            JSON.stringify({
              type: 'step',
              frame: 4,
              input: {
                mx: 77,
                my: 44,
                pmx: 75,
                pmy: 44,
                mousePressed: true,
                mouseButton: 'left',
                keysDown: ['a', 'shift'],
                key: 'a',
                keyCode: 65,
                keyPressed: true,
                keyReleased: false,
                wheelDelta: -2,
                ts: 1700000000123
              }
            })
          );
          return;
        }

        if (msg.type === 'stepResult') {
          clearTimeout(timeout);
          ws.close();
          resolve(msg.commands);
        }
      });
    });

    const circleCmd = result.find((c) => Array.isArray(c) && c[0] === 'circle');
    const textCmd = result.find((c) => Array.isArray(c) && c[0] === 'text');
    assert.ok(circleCmd, 'expected circle command from draw');
    assert.equal(Array.isArray(textCmd[1]) ? textCmd[1].join('') : textCmd[1], '4:77');
    assert.equal(Math.round(circleCmd[1]), 77);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
