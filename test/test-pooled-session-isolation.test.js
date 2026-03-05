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

function runSketch(port, sketch) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timed out waiting for pooled session result'));
    }, 7000);

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

      if (msg.type === 'runResult') {
        ws.send(JSON.stringify({ type: 'step', frame: 0, input: {} }));
        return;
      }

      if (msg.type === 'stepResult') {
        clearTimeout(timeout);
        ws.close();
        resolve(msg.commands || []);
      }
    });
  });
}

test('two websocket sessions stay isolated when sharing one q worker', async () => {
  const port = 7520 + Math.floor(Math.random() * 40);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), P5Q_WORKER_POOL_SIZE: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketchA =
      'setup:{[document]createCanvas[160;100]; ([] x:enlist 10f)};draw:{[state;input;document] background[0]; circle[([] x:first state[`x]; y:enlist 30f; d:enlist 8f)]; state};';
    const sketchB =
      'setup:{[document]createCanvas[160;100]; ([] x:enlist 90f)};draw:{[state;input;document] background[0]; circle[([] x:first state[`x]; y:enlist 70f; d:enlist 8f)]; state};';

    const [commandsA, commandsB] = await Promise.all([runSketch(port, sketchA), runSketch(port, sketchB)]);

    const circleA = commandsA.find((cmd) => Array.isArray(cmd) && cmd[0] === 'circle');
    const circleB = commandsB.find((cmd) => Array.isArray(cmd) && cmd[0] === 'circle');

    assert.ok(circleA, `expected session A to emit a circle: ${JSON.stringify(commandsA)}`);
    assert.ok(circleB, `expected session B to emit a circle: ${JSON.stringify(commandsB)}`);
    assert.equal(Math.round(circleA[1]), 10);
    assert.equal(Math.round(circleB[1]), 90);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
