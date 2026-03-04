const statusEl = document.getElementById('status');
const consoleEl = document.getElementById('console');
const editorEl = document.getElementById('editor');
const runBtn = document.getElementById('runBtn');
const stopBtn = document.getElementById('stopBtn');
const resendBtn = document.getElementById('resendBtn');
const menuBtn = document.getElementById('menuBtn');
const menuPanel = document.getElementById('menuPanel');
const menuSaveBtn = document.getElementById('menuSaveBtn');
const menuResetBtn = document.getElementById('menuResetBtn');
const tabListEl = document.getElementById('tabList');
const addTabBtn = document.getElementById('addTabBtn');
const exampleBtn = document.getElementById('exampleBtn');
const examplePanel = document.getElementById('examplePanel');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const helpCloseBtn = document.getElementById('helpCloseBtn');
const setupDrawGuideEl = document.getElementById('setupDrawGuide');
const apiGlossaryEl = document.getElementById('apiGlossary');

const STORAGE_KEY = 'p5q:workspace:v1';
const LEGACY_SKETCH_KEY = 'p5q:lastSketch:v3';

const DEFAULT_SKETCH = `// q sketch contract (function-style API):
// - setup[document] initializes and returns state table
// - draw[state;input;document] updates and returns state table
// - shape primitives + text are table-only

setup:{[document]
  vw:first document[\`vw];
  w:360f | 0.82 * vw;
  h:220f | 0.56 * w;
  createCanvas[w;h];
  frameRate[24];
  textSize[16];
  ([] tick:enlist 0i)
};

draw:{[state;input;document]
  tick:first state[\`tick];
  mx:first input[\`mx];
  cw:first document[\`cw];
  ch:first document[\`ch];
  vw:first document[\`vw];
  dpr:first document[\`dpr];
  cx:0.22 0.36 0.5 0.64 0.78 * cw;
  cy:5#(0.52 * ch);
  wobble:10f * sin tick * 0.12;
  t:([] x:cx + wobble;
    y:cy;
    d:0.07 0.085 0.1 0.085 0.07 * ch;
    fillR:235 235 235 235 235i;
    fillG:94 120 140 170 200i;
    fillB:40 60 90 120 160i);

  background[20;20;24];
  circle[t];

  txt:([] txt:("mouse x:"; string floor mx; "canvas:" , string floor cw , "x" , string floor ch; "viewport:" , string floor vw , " dpr=" , string dpr);
    x:20 108 20 20f;
    y:32 32 58 80f;
    fillR:245 235 205 180i;
    fillG:245 120 225 200i;
    fillB:245 40 245 220i);
  text[txt];
  rect[([] x:enlist 18f;
    y:enlist 44f;
    w:enlist 160f;
    h:enlist 4f)];
  triangle[([] x1:enlist 188f;
    y1:enlist 48f;
    x2:enlist 204f;
    y2:enlist 40f;
    x3:enlist 204f;
    y3:enlist 56f)];

  update tick:tick+1i from state
};
`;

const HELPER_TEMPLATE = `// Helper tabs may only contain function definitions.
// Example:
// wave:{[tick;lo;hi] lo + (hi-lo) * 0.5 * (1 + sin tick * 0.08)};
`;

const API_GLOSSARY = [
  'Canvas: createCanvas[w;h], resizeCanvas[w;h], frameRate[f], background[r;g;b], clear[]',
  'Style: fill[...], noFill[], stroke[...], noStroke[], strokeWeight[w]',
  'Primitives (table-only): line[t], rect[t], circle[t], ellipse[t], triangle[t], point[t], text[t]',
  'Text options: textSize[n], textAlign[a; b], textFont[name; size]',
  'Transforms: push[], pop[], translate[x;y], rotate[a], scale[sx; sy]',
  'Math/utils: random[a; b], map[v;a1;a2;b1;b2], constrain[v;lo;hi], sin[x], cos[x]'
];

const SETUP_DRAW_GUIDE = [
  '`setup[document]` runs once per Run and must return a table state.',
  '`draw[state;input;document]` runs every frame and must return the next state table.',
  '`input` is a one-row table for mouse/keyboard fields.',
  '`document` is a separate one-row global table (cw/ch, vw/vh, dw/dh, sx/sy, dpr), available in setup and draw.',
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
  vw:first document[\`vw];
  w:420f | 0.82 * vw;
  h:260f | 0.58 * w;
  createCanvas[w;h];
  frameRate[30];
  textSize[15];
  n:90;
  p:([] x:14f + n?(w-28f);
    y:16f + n?(h-32f);
    vx:(n?2f)-1f;
    vy:(n?2f)-1f;
    d:3.5 + n?6f;
    fillR:120 + n?120i;
    fillG:140 + n?110i;
    fillB:190 + n?65i);
  ([] tick:enlist 0i;
    particles:enlist p)
};

draw:{[state;input;document]
  tick:first state[\`tick];
  cw:first document[\`cw];
  ch:first document[\`ch];
  ps:stepBouncers[first state[\`particles]; cw; ch];

  background[12;16;24];
  circle[ps];
  text[([] txt:("Bouncing dots"; "canvas " , string floor cw , "x" , string floor ch);
    x:24 24f;
    y:30 52f;
    fillR:252 210i;
    fillG:252 220i;
    fillB:252 230i)];

  update tick:tick+1i, particles:enlist ps from state
};`
        },
        {
          id: 'helpers',
          name: 'bouncers.q',
          kind: 'helper',
          code: `stepBouncers:{[t;w;h]
  t1:update x:x+vx, y:y+vy from t;
  t2:update vx:0f-vx from t1 where (x<0f) or x>w;
  t3:update vy:0f-vy from t2 where (y<0f) or y>h;
  update x:0f|w&x, y:0f|h&y from t3
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
  vw:first document[\`vw];
  w:460f | 0.84 * vw;
  h:280f | 0.56 * w;
  createCanvas[w;h];
  frameRate[30];
  textSize[16];
  empty:([] x:0#0f;
    y:0#0f;
    vx:0#0f;
    vy:0#0f;
    life:0#0f;
    d:0#0f;
    fillR:0#0i;
    fillG:0#0i;
    fillB:0#0i);
  ([] particles:enlist empty;
    tick:enlist 0i)
};

draw:{[state;input;document]
  cw:first document[\`cw];
  ch:first document[\`ch];
  dpr:first document[\`dpr];
  ps:stepParticles select from (first state[\`particles]) where life > 0;
  if[first input[\`mousePressed]; ps:ps,spawnParticles[first input[\`mx]; first input[\`my]; 10]];

  background[12;16;22];
  circle[ps];
  text[([] txt:("Hold mouse and drag to emit particles"; "particles " , string count ps; "canvas " , string floor cw , "x" , string floor ch , " dpr=" , string dpr);
    x:20 20 20f;
    y:28 52 76f;
    fillR:245 245 205i;
    fillG:245 245 225i;
    fillB:245 245 245i)];

  update particles:enlist ps, tick:first state[\`tick]+1i from state
};`
        },
        {
          id: 'helpers',
          name: 'particles.q',
          kind: 'helper',
          code: `spawnParticles:{[mx;my;n]
  dx:(n?1f)-0.5;
  dy:n?1f;
  ([]
    x:mx + 10*dx;
    y:my + 4*dy;
    vx:2.2*dx;
    vy:-2.8*dy;
    life:0.6 + 0.4*(n?1f);
    d:2 + 8*(n?1f);
    fillR:220 + n?35i;
    fillG:130 + n?90i;
    fillB:50 + n?60i)
};

stepParticles:{[t]
  update x:x+vx, y:y+vy, vy:vy+0.08, life:life-0.02, d:1 + 10*life from t where life>0
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
}

function log(message) {
  const ts = new Date().toLocaleTimeString();
  consoleEl.textContent = `[${ts}] ${message}\n${consoleEl.textContent}`;
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

    monacoEditor = monaco.editor.create(editorEl, {
      value: initial,
      language: 'kbd/q',
      theme: 'vs-dark',
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

    if (msg.type === 'runtimeError' || msg.type === 'serverError') {
      sketchRunning = false;
      awaitingFrame = false;
      runGate.resolveRun();
      log(`Error: ${msg.message}`);
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

function getInputSnapshot() {
  inputState.ts = Date.now();
  return {
    mx: Number(inputState.mx) || 0,
    my: Number(inputState.my) || 0,
    pmx: Number(inputState.pmx) || 0,
    pmy: Number(inputState.pmy) || 0,
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

  return {
    cw: Number(p.width) || 0,
    ch: Number(p.height) || 0,
    vw: Number(window.innerWidth) || 0,
    vh: Number(window.innerHeight) || 0,
    dw: Number(docWidth) || 0,
    dh: Number(docHeight) || 0,
    sx: Number(window.scrollX) || 0,
    sy: Number(window.scrollY) || 0,
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

resendBtn.addEventListener('click', () => {
  consoleEl.textContent = '';
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

helpBtn.addEventListener('click', () => {
  helpModal.hidden = false;
});

helpCloseBtn.addEventListener('click', () => {
  helpModal.hidden = true;
});

helpModal.addEventListener('click', (event) => {
  if (event.target === helpModal) {
    helpModal.hidden = true;
  }
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

document.addEventListener('click', () => {
  closeMenu();
  closeExamplesMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenu();
    closeExamplesMenu();
    helpModal.hidden = true;
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
    sketch.createCanvas(640, 360);
    sketch.background(230);
  };

  sketch.draw = () => {
    if (!setupApplied) {
      return;
    }

    inputState.pmx = inputState.mx;
    inputState.pmy = inputState.my;
    inputState.mx = sketch.mouseX;
    inputState.my = sketch.mouseY;
    inputState.mousePressed = sketch.mouseIsPressed;
    inputState.mouseButton = toMouseButtonName(sketch.mouseButton);

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
