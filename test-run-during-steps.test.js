const test = require('node:test');
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

test('run while step stream is active does not runtimeError', async () => {
  const port = 6500 + Math.floor(Math.random() * 200);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    const sketch = 'setup:{createCanvas[200;120]; ([] ok:enlist 1i)};draw:{[state;input] background[0]; circle[([] x:enlist 100f; y:enlist 60f; d:enlist 30f)]; state};';

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      const events = [];
      let frame = 0;
      let intervalId;

      const fail = (err) => {
        clearInterval(intervalId);
        ws.close();
        reject(err);
      };

      const done = () => {
        clearInterval(intervalId);
        ws.close();
        resolve();
      };

      const timeout = setTimeout(() => {
        fail(new Error(`Timed out. Events: ${JSON.stringify(events)}`));
      }, 4000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'run', code: sketch }));
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString('utf8'));
        events.push(msg.type);

        if (msg.type === 'runtimeError') {
          clearTimeout(timeout);
          fail(new Error(`runtimeError: ${msg.message}`));
          return;
        }

        if (msg.type === 'runResult' && events.filter((e) => e === 'runResult').length === 1) {
          intervalId = setInterval(() => {
            ws.send(JSON.stringify({ type: 'step', frame: frame++ }));
          }, 5);

          setTimeout(() => {
            ws.send(JSON.stringify({ type: 'run', code: sketch }));
          }, 35);
        }

        if (msg.type === 'runResult' && events.filter((e) => e === 'runResult').length >= 2) {
          setTimeout(() => {
            clearTimeout(timeout);
            done();
          }, 120);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        fail(err);
      });
    });
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
