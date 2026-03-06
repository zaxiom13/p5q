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

test('function-style setup[document] and draw[state;input;document] produce render commands', async () => {
  const port = 7100 + Math.floor(Math.random() * 80);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = [
      'setup:{[document]',
      '  canvas:first document[`c];',
      '  cw:canvas 0;',
      '  ch:canvas 1;',
      '  createCanvas[cw;ch];',
      '  background[20;20;24];',
      '  textSize[14];',
      '  ([] ready:enlist 1b)',
      '};',
      'draw:{[state;input;document]',
      '  tick:first input[`tick];',
      '  mouse:first input[`m];',
      '  canvasW:first document[`cw];',
      '  mouseXAlias:first input[`mx];',
      '  dpr:first document[`dpr];',
      '  x:mouseXAlias + 10 * sin tick * 0.1 + 0*canvasW;',
      '  background[0];',
      '  circle[([] p:enlist (x;60f); d:enlist 24f)];',
      '  text[([] txt:enlist "ok dpr=" , string dpr; p:enlist 20 18f)];',
      '  state',
      '};'
    ].join('');

    const result = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timed out waiting for run/step result'));
      }, 5000);

      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'run',
            code: sketch,
            document: {
              c: [200, 120],
              v: [1200, 800],
              d: [1200, 1800],
              s: [0, 0],
              dpr: 2,
              ts: 1700000000000
            }
          })
        );
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
              frame: 1,
              input: {
                m: [42, 80],
                pm: [40, 79],
                mousePressed: false,
                mouseButton: 'none',
                keysDown: ['a'],
                key: 'a',
                keyCode: 65,
                keyPressed: true,
                keyReleased: false,
                wheelDelta: 0,
                ts: 1700000000000
              },
              document: {
                c: [200, 120],
                v: [1200, 800],
                d: [1200, 1800],
                s: [0, 0],
                dpr: 2,
                ts: 1700000000001
              }
            })
          );
          return;
        }

        if (msg.type === 'stepResult') {
          clearTimeout(timeout);
          ws.close();
          resolve(msg);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert.ok(Array.isArray(result.commands));
    assert.ok(result.commands.some((c) => Array.isArray(c) && c[0] === 'circle'));
    assert.ok(result.commands.some((c) => Array.isArray(c) && c[0] === 'text'));
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
