const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { getAppStatePath, startServer } = require('../server');

test('app-state endpoint persists saved sketches across server restarts', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qanvas5-app-state-'));
  const originalUserDataPath = process.env.QANVAS5_USER_DATA_PATH;
  let controller = null;

  process.env.QANVAS5_USER_DATA_PATH = path.join(tmpRoot, 'user-data');

  const payload = {
    workspace: {
      activeTabId: 'sketch',
      tabs: [{ id: 'sketch', name: 'Sketch.q', kind: 'main', code: 'show "hello";' }]
    },
    savedSketches: [
      {
        id: 'saved-1',
        name: 'Hello',
        workspace: {
          activeTabId: 'sketch',
          tabs: [{ id: 'sketch', name: 'Sketch.q', kind: 'main', code: 'show "saved";' }]
        },
        createdAt: 1,
        updatedAt: 2
      }
    ],
    currentSketchId: 'saved-1',
    showFpsOverlay: false,
    walkthroughSeen: true
  };

  try {
    controller = startServer({ port: 0 });
    const port = await controller.listening;
    const url = `http://127.0.0.1:${port}/app-state`;

    const putResponse = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(putResponse.status, 200);
    assert.deepEqual(await putResponse.json(), payload);

    const getResponse = await fetch(url);
    assert.equal(getResponse.status, 200);
    assert.deepEqual(await getResponse.json(), payload);

    const stored = JSON.parse(await fs.readFile(getAppStatePath(), 'utf8'));
    assert.deepEqual(stored, payload);

    await controller.close();
    controller = startServer({ port: 0 });

    const nextPort = await controller.listening;
    const reloadResponse = await fetch(`http://127.0.0.1:${nextPort}/app-state`);
    assert.equal(reloadResponse.status, 200);
    assert.deepEqual(await reloadResponse.json(), payload);
  } finally {
    await controller?.close().catch(() => {});
    if (originalUserDataPath === undefined) {
      delete process.env.QANVAS5_USER_DATA_PATH;
    } else {
      process.env.QANVAS5_USER_DATA_PATH = originalUserDataPath;
    }
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});
