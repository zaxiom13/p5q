const statusEl = document.getElementById('status');
const consoleEl = document.getElementById('console');
const editorEl = document.getElementById('editor');
const runBtn = document.getElementById('runBtn');
const stopBtn = document.getElementById('stopBtn');
const newSketchBtn = document.getElementById('newSketchBtn');
const resendBtn = document.getElementById('resendBtn');
const menuBtn = document.getElementById('menuBtn');
const menuPanel = document.getElementById('menuPanel');
const menuSaveBtn = document.getElementById('menuSaveBtn');
const menuResetBtn = document.getElementById('menuResetBtn');
const tabListEl = document.getElementById('tabList');
const addTabBtn = document.getElementById('addTabBtn');
const exampleBtn = document.getElementById('exampleBtn');
const examplePanel = document.getElementById('examplePanel');
const previewTabBtn = document.getElementById('previewTabBtn');
const helpTabBtn = document.getElementById('helpTabBtn');
const previewView = document.getElementById('previewView');
const helpView = document.getElementById('helpView');
const setupDrawGuideEl = document.getElementById('setupDrawGuide');
const apiGlossaryEl = document.getElementById('apiGlossary');
const primitiveColumnsEl = document.getElementById('primitiveColumns');
const inputDocumentFieldsEl = document.getElementById('inputDocumentFields');

const STORAGE_KEY = 'p5q:workspace:v1';
const LEGACY_SKETCH_KEY = 'p5q:lastSketch:v3';

const DEFAULT_SKETCH = `// q sketch contract (function-style API):
// - setup[document] initializes and returns state table
// - draw[state;input;document] updates and returns state table
// - shape primitives + text are table-only

setup:{[document]
  viewport:first document[\`v];
  w:360f | 0.82 * (viewport 0);
  h:220f | 0.56 * w;
  createCanvas[w;h];
  frameRate[24];
  textSize[16];
  ([] demo:enlist 0i)
};

draw:{[state;input;document]
  tick:first input[\`tick];
  mouse:first input[\`m];
  canvas:first document[\`c];
  viewport:first document[\`v];
  mx:mouse 0;
  cw:canvas 0;
  ch:canvas 1;
  vw:viewport 0;
  dpr:first document[\`dpr];
  cx:0.22 0.36 0.5 0.64 0.78 * cw;
  cy:5#(0.52 * ch);
  wobble:10f * sin tick * 0.12;
  t:([] p:flip (cx + wobble; cy);
    d:0.07 0.085 0.1 0.085 0.07 * ch;
    fill:flip (235 235 235 235 235i; 94 120 140 170 200i; 40 60 90 120 160i));

  background[20;20;24];
  circle[t];

  txt:([] txt:("mouse x:"; string floor mx; "canvas:" , string floor cw , "x" , string floor ch; "viewport:" , string floor vw , " dpr=" , string dpr);
    p:flip (20 108 20 20f; 32 32 58 80f);
    fill:flip (245 235 205 180i; 245 120 225 200i; 245 40 245 220i));
  text[txt];
  rect[([] p:enlist 18 44f;
    size:enlist 160 4f)];
  triangle[([] p1:enlist 188 48f;
    p2:enlist 204 40f;
    p3:enlist 204 56f)];

  state
};
`;

const EMPTY_SKETCH = `setup:{[document]
  createCanvas[360;220];
  ([] ready:enlist 1b)
};

draw:{[state;input;document]
  background[20;20;24];
  state
};
`;

const HELPER_TEMPLATE = `// Helper tabs may only contain function definitions.
// Example:
// wave:{[tick;lo;hi] lo + (hi-lo) * 0.5 * (1 + sin tick * 0.08)};
`;

const API_GLOSSARY = [
  'Canvas: createCanvas[w;h], resizeCanvas[w;h], frameRate[f], background[r;g;b], clear[]',
  'Style: fill[...], noFill[], stroke[...], noStroke[], strokeWeight[w]',
  'Primitives (table-only): line[t], rect[t], circle[t], ellipse[t], triangle[t], point[t], text[t] with packed vector columns',
  'Text options: textSize[n], textAlign[a; b], textFont[name; size]',
  'Transforms: push[], pop[], translate[x;y], rotate[a], scale[sx; sy]',
  'Math/utils: random[a; b], map[v;a1;a2;b1;b2], constrain[v;lo;hi], sin[x], cos[x]'
];

const P5Q_API_FUNCTIONS = [
  'createCanvas',
  'resizeCanvas',
  'frameRate',
  'background',
  'clear',
  'fill',
  'noFill',
  'stroke',
  'noStroke',
  'strokeWeight',
  'line',
  'rect',
  'circle',
  'ellipse',
  'triangle',
  'point',
  'text',
  'textSize',
  'textAlign',
  'textFont',
  'push',
  'pop',
  'translate',
  'rotate',
  'scale',
  'random',
  'map',
  'constrain',
  'sin',
  'cos'
];

const PRIMITIVE_COLUMN_HELP = [
  'circle[t]: prefer p:[x y] plus d; aliases x+y, cx+cy, diameter; optional fill/stroke as [r g b] or [r g b a]',
  'rect[t]: prefer p:[x y] plus size:[w h]; aliases x+y, w+h, width+height, wh; optional r + fill/stroke arrays',
  'line[t]: prefer p1:[x1 y1] and p2:[x2 y2]; aliases x1+y1 and x2+y2; optional stroke array, strokeWeight',
  'ellipse[t]: prefer p:[x y] plus size:[w h]; aliases x+y, w+h, width+height, wh; optional fill/stroke arrays',
  'triangle[t]: prefer p1/p2/p3 point arrays; aliases x1..y3; optional fill/stroke arrays',
  'point[t]: prefer p:[x y]; aliases x+y; optional stroke array, strokeWeight',
  'text[t]: required txt (or text) plus p:[x y]; aliases x+y; optional fill/stroke arrays'
];

const TABLE_SNIPPETS = [
  {
    label: '/circle',
    documentation: 'Insert circle table template',
    insertText: 'circle[([] p:enlist ${1:120 90f}; d:enlist ${2:36f}; fill:enlist ${3:255 255 255i})];'
  },
  {
    label: '/rect',
    documentation: 'Insert rect table template',
    insertText: 'rect[([] p:enlist ${1:100 70f}; size:enlist ${2:140 80f}; fill:enlist ${3:255 255 255i})];'
  },
  {
    label: '/line',
    documentation: 'Insert line table template',
    insertText: 'line[([] p1:enlist ${1:20 20f}; p2:enlist ${2:180 100f}; stroke:enlist ${3:255 255 255i}; strokeWeight:enlist ${4:2f})];'
  },
  {
    label: '/ellipse',
    documentation: 'Insert ellipse table template',
    insertText: 'ellipse[([] p:enlist ${1:120 90f}; size:enlist ${2:70 40f}; fill:enlist ${3:255 255 255i})];'
  },
  {
    label: '/triangle',
    documentation: 'Insert triangle table template',
    insertText: 'triangle[([] p1:enlist ${1:80 50f}; p2:enlist ${2:130 120f}; p3:enlist ${3:30 120f}; fill:enlist ${4:255 255 255i})];'
  },
  {
    label: '/point',
    documentation: 'Insert point table template',
    insertText: 'point[([] p:enlist ${1:120 90f}; stroke:enlist ${2:255 255 255i}; strokeWeight:enlist ${3:2f})];'
  },
  {
    label: '/text',
    documentation: 'Insert text table template',
    insertText: 'text[([] txt:enlist "${1:hello}"; p:enlist ${2:24 40f}; fill:enlist ${3:255 255 255i})];'
  }
];

const INPUT_DOCUMENT_HELP = [
  'input[`tick]: current frame/tick number for this draw step',
  'input[`m]: current mouse [x y] in canvas coordinates',
  'input[`pm]: previous frame mouse [x y]',
  'input[`mx], input[`my], input[`pmx], input[`pmy]: split aliases for the packed mouse vectors',
  'input[`mousePressed]: true while mouse button is down',
  'input[`mouseButton]: `left | `center | `right | `none',
  'input[`keysDown]: symbols for currently-held keys (lowercase)',
  'input[`key]: last key string seen by key events',
  'input[`keyCode]: last key code (integer)',
  'input[`keyPressed], input[`keyReleased]: one-frame edge flags',
  'input[`wheelDelta]: wheel delta accumulated for this frame',
  'input[`ts]: input snapshot timestamp (ms)',
  'document[`c]: current canvas [w h]',
  'document[`v]: browser viewport [w h]',
  'document[`d]: full document scrollable [w h]',
  'document[`s]: page scroll [x y]',
  'document[`cw], document[`ch], document[`vw], document[`vh], document[`dw], document[`dh], document[`sx], document[`sy]: split aliases for those packed vectors',
  'document[`dpr]: device pixel ratio',
  'document[`ts]: document snapshot timestamp (ms)'
];

const SETUP_DRAW_GUIDE = [
  '`setup[document]` runs once per Run and must return a table state.',
  '`draw[state;input;document]` runs every frame and must return the next state table.',
  '`input` is a one-row table for frame/mouse/keyboard fields, including `tick`.',
  '`document` is a separate one-row global table with packed vectors (`c`, `v`, `d`, `s`) plus split aliases, available in setup and draw.',
  'Each helper tab must contain only function definitions (`name:{...};`).',
  'Helper functions are loaded before the main sketch and can be called from setup/draw.',
  'Shapes and text are table-only. One row = one draw call; many rows = vectorized draw.'
];

const EXAMPLES = [
  {
    id: 'bouncers',
    label: 'Bouncing Dots',
    workspace: {
      activeTabId: 'sketch',
      tabs: [
        {
          id: 'sketch',
          name: 'Sketch.q',
          kind: 'main',
          code: `setup:{[document]
  viewport:first document[\`v];
  w:420f | 0.82 * (viewport 0);
  h:260f | 0.58 * w;
  createCanvas[w;h];
  frameRate[30];
  textSize[15];
  n:90;
  p:([] p:flip (14f + n?(w-28f); 16f + n?(h-32f));
    v:flip ((n?2f)-1f; (n?2f)-1f);
    d:3.5 + n?6f;
    fill:flip (120 + n?120i; 140 + n?110i; 190 + n?65i));
  ([] particles:enlist p)
};

draw:{[state;input;document]
  canvas:first document[\`c];
  ps:stepBouncers[first state[\`particles]; canvas];
  cw:canvas 0;
  ch:canvas 1;

  background[12;16;24];
  circle[ps];
  text[([] txt:("Bouncing dots"; "canvas " , string floor cw , "x" , string floor ch);
    p:flip (24 24f; 30 52f);
    fill:flip (252 210i; 252 220i; 252 230i))];

  update particles:enlist ps from state
};`
        },
        {
          id: 'helpers',
          name: 'bouncers.q',
          kind: 'helper',
          code: `stepBouncers:{[t;size]
  t1:update p:p+v from t;
  update
    p:{[size;x] ((0f;0f) | (size & x))}[size] each p,
    v:{[size;p;v] v * (1f - 2f * ((p < (0f;0f)) or p > size))}[size]'[p;v]
  from t1
};`
        }
      ]
    }
  },
  {
    id: 'default',
    label: 'Default Orbit',
    workspace: {
      activeTabId: 'sketch',
      tabs: [{ id: 'sketch', name: 'Sketch.q', kind: 'main', code: DEFAULT_SKETCH }]
    }
  },
  {
    id: 'particles',
    label: 'Particle Fountain',
    workspace: {
      activeTabId: 'sketch',
      tabs: [
        {
          id: 'sketch',
          name: 'Sketch.q',
          kind: 'main',
          code: `setup:{[document]
  viewport:first document[\`v];
  w:460f | 0.84 * (viewport 0);
  h:280f | 0.56 * w;
  createCanvas[w;h];
  frameRate[30];
  textSize[16];
  empty:([] p:0#enlist 0 0f;
    v:0#enlist 0 0f;
    life:0#0f;
    d:0#0f;
    fill:0#enlist 0 0 0i);
  ([] particles:enlist empty)
};

draw:{[state;input;document]
  tick:first input[\`tick];
  mouse:first input[\`m];
  canvas:first document[\`c];
  cw:canvas 0;
  ch:canvas 1;
  dpr:first document[\`dpr];
  ps:stepParticles select from (first state[\`particles]) where life > 0;
  if[first input[\`mousePressed]; ps:ps,spawnParticles[mouse;10]];

  background[12;16;22];
  circle[ps];
  text[([] txt:("Hold mouse and drag to emit particles"; "particles " , string count ps; "canvas " , string floor cw , "x" , string floor ch , " dpr=" , string dpr);
    p:flip (20 20 20f; 28 52 76f);
    fill:flip (245 245 205i; 245 245 225i; 245 245 245i))];

  update particles:enlist ps from state
};`
        },
        {
          id: 'helpers',
          name: 'particles.q',
          kind: 'helper',
          code: `spawnParticles:{[m;n]
  da:((n?1f)-0.5;n?1f);
  ([]
    p:flip m+(10;4)*da;
    v:flip (2.2;2.8)*da;
    life:0.6 + 0.4*(n?1f);
    d:2 + 8*(n?1f);
    fill:flip (220 + n?35i; 130 + n?90i; 50 + n?60i))
};

stepParticles:{[t]
  update p:p+v, v:{x+0 0.08} each v, life:life-0.02, d:1 + 10*life from t where life>0
};`
        }
      ]
    }
  }
];

let monacoEditor = null;
let ws;
let sketchRunning = false;
let awaitingFrame = false;
let activeCommands = [];
let setupApplied = false;
let canvasEl = null;
const runGate = createRunGate((payload) => send({ type: 'run', ...payload }));
const keysDown = new Set();
const inputState = {
  mx: 0,
  my: 0,
  pmx: 0,
  pmy: 0,
  mousePressed: false,
  mouseButton: 'none',
  key: '',
  keyCode: 0,
  keyPressed: false,
  keyReleased: false,
  wheelDelta: 0,
  ts: Date.now()
};

let workspace = loadWorkspace();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultWorkspace() {
  return clone(EXAMPLES[0].workspace);
}

function sanitizeWorkspace(raw) {
  if (!raw || typeof raw !== 'object') {
    return createDefaultWorkspace();
  }
  const tabs = Array.isArray(raw.tabs) ? raw.tabs : [];
  const normalized = tabs
    .filter((t) => t && typeof t === 'object')
    .map((t, idx) => ({
      id: String(t.id || `tab-${idx + 1}`),
      name: String(t.name || `Tab${idx + 1}.q`),
      kind: t.kind === 'helper' ? 'helper' : 'main',
      code: String(t.code || '')
    }));

  const mainTabs = normalized.filter((t) => t.kind === 'main');
  if (mainTabs.length === 0) {
    normalized.unshift({ id: 'sketch', name: 'Sketch.q', kind: 'main', code: DEFAULT_SKETCH });
  }
  if (normalized.filter((t) => t.kind === 'main').length > 1) {
    const firstMain = normalized.find((t) => t.kind === 'main');
    for (const t of normalized) {
      if (t !== firstMain && t.kind === 'main') {
        t.kind = 'helper';
      }
    }
  }

  const activeTabId = normalized.some((t) => t.id === raw.activeTabId) ? raw.activeTabId : normalized[0].id;
  return { tabs: normalized, activeTabId };
}

function loadWorkspace() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return sanitizeWorkspace(JSON.parse(saved));
    } catch {
      return createDefaultWorkspace();
    }
  }

  const legacySketch = localStorage.getItem(LEGACY_SKETCH_KEY);
  if (legacySketch) {
    return sanitizeWorkspace({
      activeTabId: 'sketch',
      tabs: [{ id: 'sketch', name: 'Sketch.q', kind: 'main', code: legacySketch }]
    });
  }

  return createDefaultWorkspace();
}

function persistActiveTabCode() {
  const tab = workspace.tabs.find((t) => t.id === workspace.activeTabId);
  if (!tab) {
    return;
  }
  tab.code = getEditorCode();
}

function saveWorkspace() {
  persistActiveTabCode();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

function activeTab() {
  return workspace.tabs.find((t) => t.id === workspace.activeTabId) || workspace.tabs[0];
}

function mainTab() {
  return workspace.tabs.find((t) => t.kind === 'main') || workspace.tabs[0];
}

function helperTabs() {
  return workspace.tabs.filter((t) => t.kind === 'helper');
}

function renderTabs() {
  tabListEl.innerHTML = '';
  for (const tab of workspace.tabs) {
    const chip = document.createElement('div');
    chip.className = `tabChip ${tab.id === workspace.activeTabId ? 'active' : ''}`;
    chip.textContent = tab.name;
    chip.addEventListener('click', () => switchTab(tab.id));

    if (tab.kind === 'helper') {
      const close = document.createElement('button');
      close.className = 'tabClose';
      close.textContent = 'x';
      close.title = 'Delete helper tab';
      close.addEventListener('click', (event) => {
        event.stopPropagation();
        removeTab(tab.id);
      });
      chip.appendChild(close);
    }

    tabListEl.appendChild(chip);
  }
}

function switchTab(tabId) {
  if (tabId === workspace.activeTabId) {
    return;
  }
  persistActiveTabCode();
  workspace.activeTabId = tabId;
  const tab = activeTab();
  setEditorCode(tab.code);
  renderTabs();
  saveWorkspace();
}

function removeTab(tabId) {
  const tab = workspace.tabs.find((t) => t.id === tabId);
  if (!tab || tab.kind !== 'helper') {
    return;
  }
  persistActiveTabCode();
  workspace.tabs = workspace.tabs.filter((t) => t.id !== tabId);
  if (workspace.activeTabId === tabId) {
    workspace.activeTabId = mainTab().id;
    setEditorCode(activeTab().code);
  }
  renderTabs();
  saveWorkspace();
}

function addHelperTab() {
  persistActiveTabCode();
  let idx = 1;
  while (workspace.tabs.some((t) => t.name === `helper${idx}.q`)) {
    idx += 1;
  }
  const tab = {
    id: `helper-${Date.now()}`,
    name: `helper${idx}.q`,
    kind: 'helper',
    code: HELPER_TEMPLATE
  };
  workspace.tabs.push(tab);
  workspace.activeTabId = tab.id;
  setEditorCode(tab.code);
  renderTabs();
  saveWorkspace();
}

function buildRunPayload() {
  persistActiveTabCode();
  const main = mainTab();
  const files = helperTabs().map((t) => ({ name: t.name, code: t.code }));
  return { code: main.code, files, document: getDocumentSnapshot() };
}

function loadExample(exampleId) {
  const found = EXAMPLES.find((x) => x.id === exampleId);
  if (!found) {
    return;
  }
  workspace = sanitizeWorkspace(clone(found.workspace));
  setEditorCode(activeTab().code);
  renderTabs();
  saveWorkspace();
  closeExamplesMenu();
  log(`Loaded example: ${found.label}`);
}

function createEmptyWorkspace() {
  return sanitizeWorkspace({
    activeTabId: 'sketch',
    tabs: [{ id: 'sketch', name: 'Sketch.q', kind: 'main', code: EMPTY_SKETCH }]
  });
}

function loadNewSketch() {
  runGate.cancelRun();
  sketchRunning = false;
  awaitingFrame = false;
  setupApplied = false;
  activeCommands = [];
  workspace = createEmptyWorkspace();
  setEditorCode(activeTab().code);
  renderTabs();
  saveWorkspace();
  send({ type: 'stop' });
  clearConsole();
  log('Loaded new empty sketch');
}

function fillExamplesDropdown() {
  examplePanel.innerHTML = '';
  for (const ex of EXAMPLES) {
    const btn = document.createElement('button');
    btn.className = 'ghost menuItem';
    btn.type = 'button';
    btn.textContent = ex.label;
    btn.addEventListener('click', () => {
      loadExample(ex.id);
    });
    examplePanel.appendChild(btn);
  }
}

function fillHelpContent() {
  setupDrawGuideEl.innerHTML = '';
  apiGlossaryEl.innerHTML = '';
  primitiveColumnsEl.innerHTML = '';
  inputDocumentFieldsEl.innerHTML = '';

  for (const line of SETUP_DRAW_GUIDE) {
    const li = document.createElement('li');
    li.textContent = line;
    setupDrawGuideEl.appendChild(li);
  }

  for (const line of API_GLOSSARY) {
    const li = document.createElement('li');
    li.textContent = line;
    apiGlossaryEl.appendChild(li);
  }

  for (const line of PRIMITIVE_COLUMN_HELP) {
    const li = document.createElement('li');
    li.textContent = line;
    primitiveColumnsEl.appendChild(li);
  }

  for (const line of INPUT_DOCUMENT_HELP) {
    const li = document.createElement('li');
    li.textContent = line;
    inputDocumentFieldsEl.appendChild(li);
  }
}

function log(message) {
  const ts = new Date().toLocaleTimeString();
  consoleEl.textContent += `[${ts}] ${message}\n`;
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function clearConsole() {
  consoleEl.textContent = '';
}

function setStatus(text) {
  statusEl.textContent = text;
}

function getEditorCode() {
  if (monacoEditor) {
    return monacoEditor.getValue();
  }
  return editorEl.textContent || '';
}

function setEditorCode(code) {
  if (monacoEditor) {
    monacoEditor.setValue(code);
    return;
  }
  editorEl.textContent = code;
}

function toggleLineComments(editor, monaco) {
  const model = editor.getModel();
  if (!model) {
    return;
  }

  const selections = editor.getSelections() || [];
  if (selections.length === 0) {
    return;
  }

  const lineNums = [];
  for (const sel of selections) {
    const start = sel.startLineNumber;
    const end = sel.endLineNumber;
    for (let line = start; line <= end; line += 1) {
      lineNums.push(line);
    }
  }

  const uniqueLines = Array.from(new Set(lineNums)).sort((a, b) => a - b);
  const allCommented = uniqueLines.every((line) => {
    const text = model.getLineContent(line);
    return text.trimStart().startsWith('//');
  });

  const edits = [];
  for (const line of uniqueLines) {
    const text = model.getLineContent(line);
    const indent = text.match(/^\s*/)?.[0].length || 0;

    if (allCommented) {
      const commentPos = text.indexOf('//', indent);
      if (commentPos >= 0) {
        edits.push({
          range: new monaco.Range(line, commentPos + 1, line, commentPos + 3),
          text: ''
        });
      }
    } else {
      edits.push({
        range: new monaco.Range(line, indent + 1, line, indent + 1),
        text: '//'
      });
    }
  }

  if (edits.length > 0) {
    editor.executeEdits('p5q-toggle-line-comment', edits);
  }
}

function registerQCompletions(monaco) {
  const keywords = Array.isArray(window.BOOTHROYD_Q_SYNTAX?.keywords) ? window.BOOTHROYD_Q_SYNTAX.keywords : [];
  const allWords = Array.from(new Set([...keywords, ...P5Q_API_FUNCTIONS]));
  if (allWords.length === 0) {
    return;
  }

  monaco.languages.registerCompletionItemProvider('kbd/q', {
    triggerCharacters: ['.', '`', '_'],
    provideCompletionItems(model, position) {
      const wordInfo = model.getWordUntilPosition(position);
      const range = new monaco.Range(
        position.lineNumber,
        wordInfo.startColumn,
        position.lineNumber,
        wordInfo.endColumn
      );
      const prefix = (wordInfo.word || '').toLowerCase();

      const suggestions = allWords
        .filter((word) => !prefix || word.toLowerCase().startsWith(prefix))
        .map((word) => ({
          label: word,
          kind: P5Q_API_FUNCTIONS.includes(word)
            ? monaco.languages.CompletionItemKind.Function
            : monaco.languages.CompletionItemKind.Keyword,
          insertText: word,
          range
        }));

      return { suggestions };
    }
  });

  monaco.languages.registerCompletionItemProvider('kbd/q', {
    triggerCharacters: ['/'],
    provideCompletionItems(model, position) {
      const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const match = linePrefix.match(/\/[A-Za-z]*$/);
      if (!match) {
        return { suggestions: [] };
      }
      const typed = match[0].toLowerCase();
      const startCol = position.column - match[0].length;
      const range = new monaco.Range(position.lineNumber, startCol, position.lineNumber, position.column);

      const suggestions = TABLE_SNIPPETS.filter((s) => s.label.startsWith(typed)).map((s) => ({
        label: s.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        documentation: s.documentation,
        insertText: s.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range
      }));

      return { suggestions };
    }
  });
}

function initMonacoEditor() {
  const initial = activeTab().code;
  if (!window.require) {
    setEditorCode(initial);
    return;
  }

  window.require.config({
    paths: {
      vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs'
    }
  });

  window.require(['vs/editor/editor.main'], () => {
    const monaco = window.monaco;
    if (!monaco) {
      setEditorCode(initial);
      return;
    }

    if (!monaco.languages.getLanguages().some((lang) => lang.id === 'kbd/q')) {
      monaco.languages.register({ id: 'kbd/q' });
      monaco.languages.setMonarchTokensProvider('kbd/q', window.BOOTHROYD_Q_SYNTAX || {});
    }
    registerQCompletions(monaco);

    monaco.editor.defineTheme('p5q-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'E9EDF2' },
        { token: 'keyword', foreground: '5FB3FF', fontStyle: 'bold' },
        { token: 'variable', foreground: 'E6F2FF' },
        { token: 'delimiter', foreground: 'FFB86C' },
        { token: 'symbol', foreground: 'A6E22E' },
        { token: 'number', foreground: 'F8D66D' },
        { token: 'number.float', foreground: 'F8D66D' },
        { token: 'date', foreground: '9BE9A8' },
        { token: 'time', foreground: '9BE9A8' },
        { token: 'string', foreground: 'F6A5C0' },
        { token: 'comment', foreground: '7D8B99', fontStyle: 'italic' }
      ],
      colors: {
        'editor.background': '#121722',
        'editor.foreground': '#E9EDF2',
        'editorLineNumber.foreground': '#5B6572',
        'editorLineNumber.activeForeground': '#9FB2C6',
        'editorCursor.foreground': '#FFD166',
        'editor.selectionBackground': '#2A3A52',
        'editor.inactiveSelectionBackground': '#243246',
        'editorIndentGuide.background1': '#1E2736',
        'editorIndentGuide.activeBackground1': '#2F415B'
      }
    });

    monacoEditor = monaco.editor.create(editorEl, {
      value: initial,
      language: 'kbd/q',
      theme: 'p5q-dark',
      minimap: { enabled: false },
      fontFamily: 'IBM Plex Mono',
      fontSize: 14,
      lineHeight: 21,
      automaticLayout: true,
      wordWrap: 'off'
    });

    monacoEditor.onDidChangeModelContent(() => {
      const tab = activeTab();
      if (tab) {
        tab.code = monacoEditor.getValue();
      }
    });

    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      toggleLineComments(monacoEditor, monaco);
    });
  });
}

function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);

  ws.addEventListener('open', () => setStatus('Connected'));
  ws.addEventListener('close', () => {
    setStatus('Disconnected - retrying');
    runGate.cancelRun();
    setTimeout(connect, 1000);
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'runResult') {
      setupApplied = true;
      activeCommands = [];
      applyCommands(msg.setup || []);
      sketchRunning = true;
      runGate.resolveRun();
      log('Sketch started');
    }

    if (msg.type === 'stepResult') {
      awaitingFrame = false;
      activeCommands = msg.commands || [];
    }

    if (msg.type === 'stdout') {
      log(String(msg.line || ''));
    }

    if (msg.type === 'runtimeError' || msg.type === 'serverError') {
      sketchRunning = false;
      awaitingFrame = false;
      runGate.resolveRun();
      const detail = String(msg.message || '').trim();
      log(detail ? `Error:\n${detail}` : 'Error');
    }

    if (msg.type === 'stopped') {
      sketchRunning = false;
      awaitingFrame = false;
      log('Sketch stopped');
    }
  });
}

function send(msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log('Socket not connected yet');
    return false;
  }
  ws.send(JSON.stringify(msg));
  return true;
}

function toMouseButtonName(btn) {
  if (btn === 'left' || (typeof LEFT !== 'undefined' && btn === LEFT)) {
    return 'left';
  }
  if (btn === 'right' || (typeof RIGHT !== 'undefined' && btn === RIGHT)) {
    return 'right';
  }
  if (btn === 'center' || (typeof CENTER !== 'undefined' && btn === CENTER)) {
    return 'center';
  }
  return 'none';
}

function isCanvasEvent(event) {
  if (!canvasEl || !event) {
    return false;
  }
  if (event.target instanceof Node && canvasEl.contains(event.target)) {
    return true;
  }
  const { clientX, clientY } = event;
  if (typeof clientX !== 'number' || typeof clientY !== 'number') {
    return false;
  }
  const rect = canvasEl.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function getInputSnapshot() {
  inputState.ts = Date.now();
  const mx = Number(inputState.mx) || 0;
  const my = Number(inputState.my) || 0;
  const pmx = Number(inputState.pmx) || 0;
  const pmy = Number(inputState.pmy) || 0;
  return {
    m: [mx, my],
    pm: [pmx, pmy],
    mx,
    my,
    pmx,
    pmy,
    mousePressed: Boolean(inputState.mousePressed),
    mouseButton: inputState.mouseButton || 'none',
    keysDown: Array.from(keysDown),
    key: inputState.key || '',
    keyCode: Number(inputState.keyCode) || 0,
    keyPressed: Boolean(inputState.keyPressed),
    keyReleased: Boolean(inputState.keyReleased),
    wheelDelta: Number(inputState.wheelDelta) || 0,
    ts: Number(inputState.ts) || Date.now()
  };
}

function getDocumentSnapshot() {
  const docEl = document.documentElement;
  const body = document.body;
  const docWidth = Math.max(
    docEl ? docEl.scrollWidth : 0,
    docEl ? docEl.clientWidth : 0,
    body ? body.scrollWidth : 0,
    body ? body.clientWidth : 0
  );
  const docHeight = Math.max(
    docEl ? docEl.scrollHeight : 0,
    docEl ? docEl.clientHeight : 0,
    body ? body.scrollHeight : 0,
    body ? body.clientHeight : 0
  );

  const cw = Number(p.width) || 0;
  const ch = Number(p.height) || 0;
  const vw = Number(window.innerWidth) || 0;
  const vh = Number(window.innerHeight) || 0;
  const dw = Number(docWidth) || 0;
  const dh = Number(docHeight) || 0;
  const sx = Number(window.scrollX) || 0;
  const sy = Number(window.scrollY) || 0;

  return {
    c: [cw, ch],
    v: [vw, vh],
    d: [dw, dh],
    s: [sx, sy],
    cw,
    ch,
    vw,
    vh,
    dw,
    dh,
    sx,
    sy,
    dpr: Number(window.devicePixelRatio) || 1,
    ts: Date.now()
  };
}

function clearInputFrameEdges() {
  inputState.keyPressed = false;
  inputState.keyReleased = false;
  inputState.wheelDelta = 0;
}

runBtn.addEventListener('click', () => {
  clearConsole();
  saveWorkspace();
  sketchRunning = false;
  awaitingFrame = false;
  activeCommands = [];
  setupApplied = false;
  const sentNow = runGate.requestRun(buildRunPayload());
  if (!sentNow) {
    log('Run queued');
  }
});

stopBtn.addEventListener('click', () => {
  runGate.cancelRun();
  sketchRunning = false;
  awaitingFrame = false;
  send({ type: 'stop' });
});

newSketchBtn.addEventListener('click', () => {
  loadNewSketch();
});

resendBtn.addEventListener('click', () => {
  clearConsole();
});

menuSaveBtn.addEventListener('click', () => {
  saveWorkspace();
  closeMenu();
  log('Saved to local storage');
});

menuResetBtn.addEventListener('click', () => {
  loadExample('bouncers');
  closeMenu();
});

addTabBtn.addEventListener('click', () => {
  addHelperTab();
});

function openMenu() {
  menuPanel.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
  closeExamplesMenu();
}

function closeMenu() {
  menuPanel.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
}

function openExamplesMenu() {
  examplePanel.hidden = false;
  exampleBtn.setAttribute('aria-expanded', 'true');
  closeMenu();
}

function closeExamplesMenu() {
  examplePanel.hidden = true;
  exampleBtn.setAttribute('aria-expanded', 'false');
}

function showPreviewTab() {
  previewView.hidden = false;
  helpView.hidden = true;
  previewTabBtn.classList.add('active');
  helpTabBtn.classList.remove('active');
}

function showHelpTab() {
  previewView.hidden = true;
  helpView.hidden = false;
  helpTabBtn.classList.add('active');
  previewTabBtn.classList.remove('active');
}

menuBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (menuPanel.hidden) {
    openMenu();
  } else {
    closeMenu();
  }
});

menuPanel.addEventListener('click', (event) => {
  event.stopPropagation();
});

exampleBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (examplePanel.hidden) {
    openExamplesMenu();
  } else {
    closeExamplesMenu();
  }
});

examplePanel.addEventListener('click', (event) => {
  event.stopPropagation();
});

previewTabBtn.addEventListener('click', () => {
  showPreviewTab();
});

helpTabBtn.addEventListener('click', () => {
  showHelpTab();
});

document.addEventListener('click', () => {
  closeMenu();
  closeExamplesMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenu();
    closeExamplesMenu();
  }
  inputState.key = event.key || '';
  inputState.keyCode = event.keyCode || 0;
  inputState.keyPressed = true;
  keysDown.add(String(event.key || '').toLowerCase());
});

document.addEventListener('keyup', (event) => {
  inputState.key = event.key || '';
  inputState.keyCode = event.keyCode || 0;
  inputState.keyReleased = true;
  keysDown.delete(String(event.key || '').toLowerCase());
});

document.addEventListener(
  'wheel',
  (event) => {
    if (!isCanvasEvent(event)) {
      return;
    }
    inputState.wheelDelta += Number(event.deltaY) || 0;
  },
  { passive: true }
);

document.addEventListener('mouseup', () => {
  inputState.mousePressed = false;
  inputState.mouseButton = 'none';
});

function applyCommands(commands) {
  for (const command of normalizeCommands(commands)) {
    if (!Array.isArray(command) || command.length === 0) {
      continue;
    }

    const [fnName, ...args] = command;
    const fn = p[fnName];
    const safeArgs = fnName === 'text' ? normalizeTextArgs(args) : args;

    if (typeof fn === 'function') {
      try {
        fn.apply(p, safeArgs);
      } catch (err) {
        log(`Command failed (${fnName}): ${err.message}`);
      }
    }
  }
}

function normalizeTextArgs(args) {
  if (!Array.isArray(args) || args.length === 0) {
    return args;
  }
  if (!Array.isArray(args[0])) {
    return args;
  }

  // q char/general lists can arrive as JS arrays; p5 would stringify with commas.
  // Collapse to a readable string before applying the text command.
  const text = args[0]
    .map((part) => (part == null ? '' : String(part)))
    .join('');
  return [text, ...args.slice(1)];
}

function normalizeCommands(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  if (raw.length > 0 && typeof raw[0] === 'string') {
    return [raw];
  }
  return raw;
}

const p = new p5((sketch) => {
  sketch.setup = () => {
    const renderer = sketch.createCanvas(640, 360);
    canvasEl = renderer.elt;
    sketch.background(230);
  };

  sketch.draw = () => {
    if (!setupApplied) {
      return;
    }

    const pointerInsideCanvas =
      sketch.mouseX >= 0 &&
      sketch.mouseX < sketch.width &&
      sketch.mouseY >= 0 &&
      sketch.mouseY < sketch.height;

    inputState.pmx = inputState.mx;
    inputState.pmy = inputState.my;
    if (pointerInsideCanvas) {
      inputState.mx = sketch.mouseX;
      inputState.my = sketch.mouseY;
      inputState.mousePressed = sketch.mouseIsPressed;
      inputState.mouseButton = sketch.mouseIsPressed ? toMouseButtonName(sketch.mouseButton) : 'none';
    } else {
      inputState.mousePressed = false;
      inputState.mouseButton = 'none';
    }

    applyCommands(activeCommands);

    if (sketchRunning && !awaitingFrame && ws && ws.readyState === WebSocket.OPEN) {
      awaitingFrame = true;
      const sent = send({ type: 'step', input: getInputSnapshot(), document: getDocumentSnapshot() });
      if (sent) {
        clearInputFrameEdges();
      }
    }
  };
}, 'canvasHost');

window.addEventListener('beforeunload', () => {
  saveWorkspace();
});

fillExamplesDropdown();
fillHelpContent();
renderTabs();
initMonacoEditor();
connect();
log('Ready. Press Run.');
