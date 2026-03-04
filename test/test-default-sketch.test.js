const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function extractDefaultSketch(source) {
  const match = source.match(/const DEFAULT_SKETCH = `([\s\S]*?)`;/);
  assert.ok(match, 'DEFAULT_SKETCH template string not found');
  return match[1];
}

test('default sketch loads in q without syntax error', () => {
  const appPath = path.join(__dirname, '..', 'public', 'app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  const sketch = extractDefaultSketch(source);

  const sketchPath = path.join(os.tmpdir(), `p5q-default-${Date.now()}.q`);
  fs.writeFileSync(sketchPath, `${sketch}\n`, 'utf8');

  const res = spawnSync('q', ['-q', sketchPath], { encoding: 'utf8' });

  assert.equal(
    res.status,
    0,
    `Expected q to load sketch successfully.\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`
  );
});
