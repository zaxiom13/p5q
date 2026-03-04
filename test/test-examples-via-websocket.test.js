const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const EXAMPLE_WS_TIMEOUT_MS = 12000;
const EXAMPLE_WS_RETRIES = 1;

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

function extractExamplesFromApp(source) {
  const defaultSketchDecl = source.match(/const DEFAULT_SKETCH = `[\s\S]*?`;/);
  assert.ok(defaultSketchDecl, 'DEFAULT_SKETCH declaration not found');

  const examplesDecl = source.match(/const EXAMPLES = \[[\s\S]*?\n\];/);
  assert.ok(examplesDecl, 'EXAMPLES declaration not found');

  const sandbox = {};
  const script = `${defaultSketchDecl[0]}\n${examplesDecl[0]}\nresult = EXAMPLES;`;
  vm.runInNewContext(script, sandbox);

  assert.ok(Array.isArray(sandbox.result), 'EXAMPLES must evaluate to an array');
  return sandbox.result;
}

function getMainAndHelpers(example) {
  const ws = example && example.workspace;
  assert.ok(ws && Array.isArray(ws.tabs), `example ${example?.id} is missing workspace tabs`);

  const main = ws.tabs.find((t) => t.kind === 'main') || ws.tabs[0];
  const helpers = ws.tabs.filter((t) => t.kind === 'helper');

  assert.ok(main && typeof main.code === 'string' && main.code.length > 0, `example ${example.id} missing main sketch code`);
  return {
    code: main.code,
    files: helpers.map((t) => ({ name: t.name || `${t.id || 'helper'}.q`, code: t.code || '' }))
  };
}

function runExampleViaWs(port, payload) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timed out waiting for run/step result'));
    }, EXAMPLE_WS_TIMEOUT_MS);

    const documentSnapshot = {
      cw: 720,
      ch: 420,
      vw: 1280,
      vh: 800,
      dw: 1280,
      dh: 2200,
      sx: 0,
      sy: 0,
      dpr: 2,
      ts: 1700000000000
    };

    const inputSnapshot = {
      mx: 140,
      my: 90,
      pmx: 138,
      pmy: 88,
      mousePressed: true,
      mouseButton: 'left',
      keysDown: ['a'],
      key: 'a',
      keyCode: 65,
      keyPressed: true,
      keyReleased: false,
      wheelDelta: 0,
      ts: 1700000000001
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'run', ...payload, document: documentSnapshot }));
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
        ws.send(JSON.stringify({ type: 'step', input: inputSnapshot, document: documentSnapshot }));
        return;
      }

      if (msg.type === 'stepResult') {
        clearTimeout(timeout);
        ws.close();
        resolve(msg.commands || []);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function runExampleViaWsWithRetry(port, payload, exampleId) {
  let attempt = 0;
  while (true) {
    try {
      return await runExampleViaWs(port, payload);
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      const timedOut = msg.includes('Timed out waiting for run/step result');
      if (!timedOut || attempt >= EXAMPLE_WS_RETRIES) {
        throw new Error(`example ${exampleId} failed: ${msg}`);
      }
      attempt += 1;
    }
  }
}

test('bundled examples run via websocket API without runtime errors', async () => {
  const appPath = path.join(__dirname, '..', 'public', 'app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  const examples = extractExamplesFromApp(source);

  const port = 7250 + Math.floor(Math.random() * 200);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(server);

    for (const example of examples) {
      const payload = getMainAndHelpers(example);
      const commands = await runExampleViaWsWithRetry(port, payload, example.id);

      assert.ok(Array.isArray(commands), `example ${example.id} should return command list`);
      assert.ok(commands.length > 0, `example ${example.id} should emit at least one command on step`);
    }
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => server.once('exit', r));
  }
});
