const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { startServer } = require('../server');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            json: JSON.parse(body)
          });
        });
      })
      .on('error', reject);
  });
}

test('desktop runtime status endpoint exposes active runtime path', async () => {
  const runtimeStatus = {
    platform: 'macos',
    configured: true,
    source: 'saved',
    qBinary: '/Users/test/.kx/bin/q',
    resolvedPath: '/Users/test/.kx/bin/q',
    message: 'Connected to q at /Users/test/.kx/bin/q'
  };

  const controller = startServer({ port: 0, runtimeStatus });

  try {
    const port = await controller.listening;
    const response = await getJson(`http://127.0.0.1:${port}/desktop-runtime-status`);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json, runtimeStatus);
  } finally {
    await controller.close();
  }
});
