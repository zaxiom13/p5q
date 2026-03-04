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

test('scalar draw primitive calls are rejected', async () => {
  const port = 7360 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = [
      'setup:{createCanvas[240;160]; ([] ok:enlist 1b)};',
      'draw:{[state;input]',
      '  line[1;2;3;4];',
      '  rect[10;20;30;40];',
      '  ellipse[4;5;6;7];',
      '  triangle[20;20;50;30;10;60];',
      '  point[8;9];',
      '  text["hi";12;14];',
      '  circle[10;20;30];',
      '  state',
      '};'
    ].join('');

    const runtimeError = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timed out waiting for runtimeError'));
      }, 5000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: sketch }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        if (msg.type === 'runResult') {
          ws.send(JSON.stringify({ type: 'step', input: {} }));
          return;
        }
        if (msg.type === 'runtimeError') {
          clearTimeout(timeout);
          ws.close();
          resolve(msg.message || '');
        }
      });
    });

    assert.match(
      runtimeError,
      /(line expects table|rect expects table|ellipse expects table|triangle expects table|point expects table|text expects table|circle expects table)/i
    );
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
