const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { resolveDesktopRuntimeStatus } = require('../desktop/runtime-status');

test('resolveDesktopRuntimeStatus uses saved/detected q binary path', async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'p5q-desktop-runtime-'));
  const fakeQ = path.join(tmpRoot, 'q');
  const userDataPath = path.join(tmpRoot, 'user-data');
  const originalEnv = process.env.P5Q_Q_BIN;

  try {
    await fs.writeFile(fakeQ, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    process.env.P5Q_Q_BIN = fakeQ;

    const status = await resolveDesktopRuntimeStatus({
      platform: 'darwin',
      userDataPath
    });

    assert.equal(status.configured, true);
    assert.equal(status.resolvedPath, fakeQ);
    assert.equal(status.qBinary, fakeQ);
  } finally {
    if (originalEnv === undefined) {
      delete process.env.P5Q_Q_BIN;
    } else {
      process.env.P5Q_Q_BIN = originalEnv;
    }
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
});
