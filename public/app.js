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
const exampleSelect = document.getElementById('exampleSelect');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const helpCloseBtn = document.getElementById('helpCloseBtn');
const setupDrawGuideEl = document.getElementById('setupDrawGuide');
const apiGlossaryEl = document.getElementById('apiGlossary');

const STORAGE_KEY = 'p5q:workspace:v1';
const LEGACY_SKETCH_KEY = 'p5q:lastSketch:v3';

const DEFAULT_SKETCH = `// q sketch contract (function-style API):
// - setup[] initializes and returns state table
// - draw[state;input] updates and returns state table
// - shape primitives + text are table-only

setup:{
  createCanvas[640;360];
  frameRate[24];
  textSize[16];
  t:([] x:120 220 320 420 520f;
    y:180 180 180 180 180f;
    d:28 34 40 34 28f;
    fillR:235 235 235 235 235i;
    fillG:94 120 140 170 200i;
    fillB:40 60 90 120 160i);
  ([] label:enlist "mouse x:";
    mxLast:enlist 0f;
    tick:enlist 0i;
    circles:enlist t)
};

draw:{[state;input]
  mx:first input[\`mx];
  tick:first state[\`tick];
  circles:first state[\`circles];
  i:tick mod count circles;

  background[20;20;24];
  circle[circles enlist i];

  txt:([] txt:(first state[\`label]; string mx);
    x:20 108f;
    y:32 32f;
    fillR:245 235i;
    fillG:245 120i;
    fillB:245 40i);
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

  update mxLast:mx, tick:tick+1i from state
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
  '`setup[]` runs once per Run and must return a table state.',
  '`draw[state;input]` runs every frame and must return the next state table.',
  '`input` is a one-row table (mx, my, mousePressed, keysDown, key, keyCode, etc.).',
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
          code: `setup:{
  createCanvas[720;420];
  frameRate[30];
  textSize[15];
  n:90;
  p:([] x:40f + n?640f;
    y:24f + n?372f;
    vx:(n?2f)-1f;
    vy:(n?2f)-1f;
    d:3.5 + n?6f;
    fillR:120 + n?120i;
    fillG:140 + n?110i;
    fillB:190 + n?65i);
  ([] tick:enlist 0i;
    particles:enlist p)
};

draw:{[state;input]
  tick:first state[\`tick];
  ps:stepBouncers[first state[\`particles]; 720f; 420f];

  background[12;16;24];
  circle[ps];
  text[([] txt:enlist "Bouncing dots";
    x:enlist 24f;
    y:enlist 30f;
    fillR:enlist 252i;
    fillG:enlist 252i;
    fillB:enlist 252i)];

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
          code: `setup:{
  createCanvas[720;420];
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

draw:{[state;input]
  ps:stepParticles select from (first state[\`particles]) where life > 0;
  if[first input[\`mousePressed]; ps:ps,spawnParticles[first input[\`mx]; first input[\`my]; 10]];

  background[12;16;22];
  circle[ps];
  text[([] txt:("Hold mouse to emit particles"; string count ps);
    x:20 50f;
    y:90 28f;
    fillR:245 245i;
    fillG:245 245i;
    fillB:245 245i)];

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
  return { code: main.code, files };
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
  log(`Loaded example: ${found.label}`);
}

function fillExamplesDropdown() {
  for (const ex of EXAMPLES) {
    const option = document.createElement('option');
    option.value = ex.id;
    option.textContent = ex.label;
    exampleSelect.appendChild(option);
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

exampleSelect.addEventListener('change', () => {
  if (!exampleSelect.value) {
    return;
  }
  loadExample(exampleSelect.value);
  exampleSelect.value = '';
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
}

function closeMenu() {
  menuPanel.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
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

document.addEventListener('click', () => {
  closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenu();
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

    if (typeof fn === 'function') {
      try {
        fn.apply(p, args);
      } catch (err) {
        log(`Command failed (${fnName}): ${err.message}`);
      }
    }
  }
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
      const sent = send({ type: 'step', input: getInputSnapshot() });
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
