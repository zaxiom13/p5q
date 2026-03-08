const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Function ${name} not found`);

  const openBrace = source.indexOf('{', start);
  assert.notEqual(openBrace, -1, `Function ${name} body not found`);

  let depth = 0;
  let inString = false;
  for (let i = openBrace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"') {
      if (inString && source[i + 1] === '"') {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error(`Function ${name} did not terminate`);
}

function createDocumentStub() {
  return {
    createElement(tagName) {
      return {
        tagName,
        className: '',
        children: [],
        _textContent: '',
        appendChild(node) {
          this.children.push(node);
        },
        set textContent(value) {
          this._textContent = String(value);
          this.children = [];
        },
        get textContent() {
          if (this.children.length > 0) {
            return this.children.map((child) => child.textContent || '').join('');
          }
          return this._textContent;
        }
      };
    },
    createTextNode(text) {
      return { textContent: String(text) };
    }
  };
}

function loadRenderTraceLine() {
  const appPath = path.join(__dirname, '..', 'public', 'app.js');
  const source = fs.readFileSync(appPath, 'utf8');
  const script = `
${extractFunctionSource(source, 'renderTraceLine')}
module.exports = { renderTraceLine };
`;
  const sandbox = {
    document: createDocumentStub(),
    module: { exports: {} },
    exports: {}
  };
  vm.runInNewContext(script, sandbox);
  return sandbox.module.exports.renderTraceLine;
}

test('renderTraceLine highlights the clause at q caret for length errors', () => {
  const renderTraceLine = loadRenderTraceLine();
  const line =
    'spawnParticles:{[m;n] da:((n?1f)-0.5;n?1f); ([] p:flip m+(10;4;4)*da; v:flip (2.2;2.8)*da; life:0.6 + 0.4*(n?1f); d:2 + 8*(n?1f); fill:flip (220 + n?35i; 130 + n?90i; 50 + n?60i)) }';
  const caretIndex = line.indexOf('life');
  const row = renderTraceLine(line, caretIndex, 'length');

  assert.equal(row.children[1].textContent, 'life:0.6 + 0.4*(n?1f)');
});
