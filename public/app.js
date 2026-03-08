const statusEl = document.getElementById('status');
const consoleEl = document.getElementById('console');
const editorEl = document.getElementById('editor');
const runBtn = document.getElementById('runBtn');
const stopBtn = document.getElementById('stopBtn');
const newSketchBtn = document.getElementById('newSketchBtn');
const resendBtn = document.getElementById('resendBtn');
const menuBtn = document.getElementById('menuBtn');
const menuPanel = document.getElementById('menuPanel');
const menuSaveAsBtn = document.getElementById('menuSaveAsBtn');
const menuUpdateSavedBtn = document.getElementById('menuUpdateSavedBtn');
const menuResetBtn = document.getElementById('menuResetBtn');
const menuCurrentSketchEl = document.getElementById('menuCurrentSketch');
const menuWalkthroughBtn = document.getElementById('menuWalkthroughBtn');
const savedSketchesListEl = document.getElementById('savedSketchesList');
const tabListEl = document.getElementById('tabList');
const addTabBtn = document.getElementById('addTabBtn');
const exampleBtn = document.getElementById('exampleBtn');
const examplePanel = document.getElementById('examplePanel');
const previewTabBtn = document.getElementById('previewTabBtn');
const helpTabBtn = document.getElementById('helpTabBtn');
const setupTabBtn = document.getElementById('setupTabBtn');
const previewView = document.getElementById('previewView');
const previewEmptyStateEl = document.getElementById('previewEmptyState');
const helpView = document.getElementById('helpView');
const setupView = document.getElementById('setupView');
const previewToggleWrap = document.getElementById('previewToggleWrap');
const fpsToggleEl = document.getElementById('fpsToggle');
const fpsOverlayEl = document.getElementById('fpsOverlay');
const setupDrawGuideEl = document.getElementById('setupDrawGuide');
const apiGlossaryEl = document.getElementById('apiGlossary');
const primitiveColumnsEl = document.getElementById('primitiveColumns');
const inputDocumentFieldsEl = document.getElementById('inputDocumentFields');
const runtimeSummaryEl = document.getElementById('runtimeSummary');
const runtimeBadgeEl = document.getElementById('runtimeBadge');
const runtimePlatformEl = document.getElementById('runtimePlatform');
const runtimePathEl = document.getElementById('runtimePath');
const runtimeSourceEl = document.getElementById('runtimeSource');
const runtimeAutoBtn = document.getElementById('runtimeAutoBtn');
const runtimePickBtn = document.getElementById('runtimePickBtn');
const runtimeClearBtn = document.getElementById('runtimeClearBtn');
const runtimeActionsEl = document.getElementById('runtimeActions');
const openProductBtn = document.getElementById('openProductBtn');
const openDownloadBtn = document.getElementById('openDownloadBtn');
const openDocsBtn = document.getElementById('openDocsBtn');
const checkUpdatesBtn = document.getElementById('checkUpdatesBtn');
const installUpdateBtn = document.getElementById('installUpdateBtn');
const updateActionsEl = document.getElementById('updateActions');
const updateCardEl = document.getElementById('updateCard');
const updateBadgeEl = document.getElementById('updateBadge');
const updateVersionEl = document.getElementById('updateVersion');
const updateAvailableEl = document.getElementById('updateAvailable');
const updateMessageEl = document.getElementById('updateMessage');

const desktopApi = window.qanvas5Desktop || null;
const runtimeStatusApi = window.qanvas5RuntimeStatus || null;

const APP_STATE_KEY = 'qanvas5:app-state:v2';
const APP_STATE_SAVE_DELAY_MS = 250;
const APP_STATE_ENDPOINT = '/app-state';
const LEGACY_WORKSPACE_STATE_KEY = 'qanvas5:workspace:v1';
const LEGACY_SKETCH_KEY = 'qanvas5:lastSketch:v3';
const FPS_TOGGLE_KEY = 'qanvas5:showFps:v1';

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
  'Primitives (table-only): line[t], rect[t], circle[t], ellipse[t], triangle[t], point[t], text[t] with packed vector columns',
  'Text options: textSize[n], textAlign[a; b], textFont[name; size]',
  'Transforms: push[], pop[], translate[x;y], rotate[a], scale[sx; sy]',
  'Math: use q built-ins directly where needed'
];

const QANVAS5_API_FUNCTIONS = [
  'createCanvas',
  'resizeCanvas',
  'frameRate',
  'background',
  'clear',
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
  'scale'
];

const PRIMITIVE_COLUMN_HELP = [
  'circle[t]: requires packed p:[x y] plus d; optional packed fill/stroke as [r g b] or [r g b a]',
  'rect[t]: requires packed p:[x y] plus size:[w h]; optional r plus packed fill/stroke arrays',
  'line[t]: requires packed p1:[x1 y1] and p2:[x2 y2]; optional packed stroke array and strokeWeight',
  'ellipse[t]: requires packed p:[x y] plus size:[w h]; optional packed fill/stroke arrays',
  'triangle[t]: requires packed p1/p2/p3 point arrays; optional packed fill/stroke arrays',
  'point[t]: requires packed p:[x y]; optional packed stroke array and strokeWeight',
  'text[t]: required txt (or text) plus packed p:[x y]; optional packed fill/stroke arrays'
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


const WALKTHROUGH_STEPS = [
  {
    selector: '#runBtn',
    title: 'Run your sketch',
    body: 'Start here: Run sends setup once, then streams draw frames so the Preview comes alive.'
  },
  {
    selector: '#editor',
    title: 'Edit q code',
    body: 'Write setup/draw in the main tab, then add helper functions in extra tabs with + Tab.'
  },
  {
    selector: '#exampleBtn',
    title: 'Load examples',
    body: 'Open Examples to quickly swap in working sketches and learn the table patterns.'
  },
  {
    selector: '#helpTabBtn',
    title: 'Use Help when stuck',
    body: 'Help summarizes setup/draw, primitive columns, and input/document fields.'
  },
  {
    selector: '#setupTabBtn',
    title: 'Connect runtime in Setup',
    body: 'Setup links your local q runtime once so future runs are one-click.'
  },
  {
    selector: '#menuBtn',
    title: 'Save + walkthrough',
    body: 'Use the menu for saving named sketches, reopening them later, and restarting this walkthrough any time.'
  }
];

let walkthroughState = {
  active: false,
  index: 0
};

const SETUP_DRAW_GUIDE = [
  '`setup[document]` runs once per Run and must return a table state.',
  '`draw[state;input;document]` runs every frame and must return the next state table.',
  '`input` is a one-row table for frame/mouse/keyboard fields, including `tick`.',
  '`document` is a separate one-row global table with packed vectors (`c`, `v`, `d`, `s`) plus split aliases, available in setup and draw.',
  'Primitive tables are packed-only: use `p`, `size`, `p1`/`p2`/`p3`, `fill`, `stroke`, and `strokeWeight` inside the table itself.',
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
let showFpsOverlay = true;
let fpsDisplayValue = 0;
let fpsSampleCount = 0;
let fpsLastPaintAt = 0;
let runtimeStatus = null;
let updateState = null;
let currentSketchId = null;
let savedSketches = [];
let walkthroughSeen = false;
let appStateLoaded = false;
let persistAppStateTimer = null;
let sketchDialogState = null;
const INPUT_WIRE_FIELDS = Object.freeze({
  mx: 0,
  my: 1,
  pmx: 2,
  pmy: 3,
  mousePressed: 4,
  mouseButton: 5,
  keysDown: 6,
  key: 7,
  keyCode: 8,
  keyPressed: 9,
  keyReleased: 10,
  wheelDelta: 11,
  ts: 12
});
const DOCUMENT_WIRE_FIELDS = Object.freeze({
  cw: 0,
  ch: 1,
  vw: 2,
  vh: 3,
  dw: 4,
  dh: 5,
  sx: 6,
  sy: 7,
  dpr: 8,
  ts: 9
});
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

let workspace = createDefaultWorkspace();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readLocalAppState() {
  const saved = localStorage.getItem(APP_STATE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }

  const legacyWorkspaceState = localStorage.getItem(LEGACY_WORKSPACE_STATE_KEY);
  if (legacyWorkspaceState) {
    try {
      const parsed = JSON.parse(legacyWorkspaceState);
      return {
        workspace: parsed,
        showFpsOverlay: localStorage.getItem(FPS_TOGGLE_KEY) == null ? undefined : localStorage.getItem(FPS_TOGGLE_KEY) === 'true'
      };
    } catch {}
  }

  const legacyWorkspace = localStorage.getItem(LEGACY_SKETCH_KEY);
  const legacyFps = localStorage.getItem(FPS_TOGGLE_KEY);
  if (legacyWorkspace || legacyFps != null) {
    return {
      workspace: legacyWorkspace
        ? {
            activeTabId: 'sketch',
            tabs: [{ id: 'sketch', name: 'Sketch.q', kind: 'main', code: legacyWorkspace }]
          }
        : undefined,
      showFpsOverlay: legacyFps == null ? undefined : legacyFps === 'true'
    };
  }

  return null;
}

function writeLocalAppState(nextState) {
  localStorage.setItem(APP_STATE_KEY, JSON.stringify(nextState));
  localStorage.setItem(FPS_TOGGLE_KEY, nextState.showFpsOverlay ? 'true' : 'false');
}

async function loadStoredAppState() {
  try {
    const response = await fetch(APP_STATE_ENDPOINT, { cache: 'no-store' });
    if (response.ok) {
      const payload = await response.json();
      if (payload && typeof payload === 'object') {
        writeLocalAppState(payload);
        return payload;
      }
    }
  } catch {}

  return readLocalAppState();
}

async function writeStoredAppState(nextState) {
  writeLocalAppState(nextState);

  try {
    await fetch(APP_STATE_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextState)
    });
  } catch {}
}

function persistAppStateWithBeacon() {
  if (!appStateLoaded || typeof navigator.sendBeacon !== 'function') {
    return false;
  }

  try {
    const payload = JSON.stringify(collectAppState());
    const sent = navigator.sendBeacon(APP_STATE_ENDPOINT, new Blob([payload], { type: 'application/json' }));
    if (sent) {
      writeLocalAppState(collectAppState());
    }
    return sent;
  } catch {
    return false;
  }
}

function syncFpsOverlay() {
  if (!fpsOverlayEl) {
    return;
  }
  fpsOverlayEl.hidden = !showFpsOverlay;
}

function setFpsOverlayEnabled(nextValue) {
  showFpsOverlay = Boolean(nextValue);
  if (fpsToggleEl) {
    fpsToggleEl.checked = showFpsOverlay;
  }
  syncFpsOverlay();
  schedulePersistAppState();
}

function paintFps(reading) {
  if (!fpsOverlayEl || !showFpsOverlay) {
    return;
  }
  fpsOverlayEl.textContent = `FPS ${Math.round(reading)}`;
}

function updateFpsOverlay(sketch) {
  const now = performance.now();
  const measured = Number(sketch.frameRate()) || 0;
  if (measured > 0) {
    fpsSampleCount += 1;
    fpsDisplayValue += (measured - fpsDisplayValue) / Math.min(fpsSampleCount, 12);
  }
  if (now - fpsLastPaintAt < 250) {
    return;
  }
  fpsLastPaintAt = now;
  paintFps(fpsDisplayValue || measured || 0);
}

function createDefaultWorkspace() {
  return clone(EXAMPLES[0].workspace);
}

function createDefaultAppState() {
  return {
    workspace: createDefaultWorkspace(),
    savedSketches: [],
    currentSketchId: null,
    showFpsOverlay: true,
    walkthroughSeen: false
  };
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

function sanitizeSavedSketches(raw) {
  const seenIds = new Set();
  return (Array.isArray(raw) ? raw : [])
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => {
      const id = String(item.id || `saved-${idx + 1}`);
      if (seenIds.has(id)) {
        return null;
      }
      seenIds.add(id);
      return {
        id,
        name: String(item.name || `Sketch ${idx + 1}`),
        workspace: sanitizeWorkspace(item.workspace),
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Date.now()
      };
    })
    .filter(Boolean);
}

function sanitizeAppState(raw) {
  const fallback = readLocalAppState();
  const source = raw && typeof raw === 'object' ? raw : fallback && typeof fallback === 'object' ? fallback : {};
  const defaults = createDefaultAppState();
  const sketches = sanitizeSavedSketches(source.savedSketches);
  const currentId = typeof source.currentSketchId === 'string' ? source.currentSketchId : null;

  return {
    workspace: sanitizeWorkspace(source.workspace || defaults.workspace),
    savedSketches: sketches,
    currentSketchId: sketches.some((sketch) => sketch.id === currentId) ? currentId : null,
    showFpsOverlay: typeof source.showFpsOverlay === 'boolean' ? source.showFpsOverlay : defaults.showFpsOverlay,
    walkthroughSeen: Boolean(source.walkthroughSeen)
  };
}

function applyAppState(raw) {
  const nextState = sanitizeAppState(raw);
  workspace = nextState.workspace;
  savedSketches = nextState.savedSketches;
  currentSketchId = nextState.currentSketchId;
  showFpsOverlay = nextState.showFpsOverlay;
  walkthroughSeen = nextState.walkthroughSeen;
}

function collectAppState() {
  persistActiveTabCode();
  return {
    workspace: sanitizeWorkspace(clone(workspace)),
    savedSketches: savedSketches.map((sketch) => ({
      id: sketch.id,
      name: sketch.name,
      workspace: sanitizeWorkspace(clone(sketch.workspace)),
      createdAt: sketch.createdAt,
      updatedAt: sketch.updatedAt
    })),
    currentSketchId,
    showFpsOverlay,
    walkthroughSeen
  };
}

function schedulePersistAppState() {
  if (!appStateLoaded) {
    return;
  }
  if (persistAppStateTimer) {
    clearTimeout(persistAppStateTimer);
  }
  persistAppStateTimer = setTimeout(() => {
    persistAppStateTimer = null;
    void persistAppState();
  }, APP_STATE_SAVE_DELAY_MS);
}

async function persistAppState() {
  if (!appStateLoaded) {
    return;
  }
  const snapshot = collectAppState();
  await writeStoredAppState(snapshot);
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
  schedulePersistAppState();
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

function currentSavedSketch() {
  return savedSketches.find((sketch) => sketch.id === currentSketchId) || null;
}

function sketchTimestampLabel(value) {
  const stamp = Number(value);
  if (!stamp) {
    return 'Saved just now';
  }
  return `Updated ${new Date(stamp).toLocaleString()}`;
}

function renderSavedSketches() {
  if (!savedSketchesListEl) {
    return;
  }

  savedSketchesListEl.innerHTML = '';
  if (savedSketches.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'savedSketchesEmpty';
    empty.textContent = 'No saved sketches yet.';
    savedSketchesListEl.appendChild(empty);
  } else {
    const ordered = [...savedSketches].sort((a, b) => b.updatedAt - a.updatedAt);
    for (const sketch of ordered) {
      const item = document.createElement('div');
      item.className = `savedSketchItem ${sketch.id === currentSketchId ? 'active' : ''}`;

      const meta = document.createElement('button');
      meta.className = 'savedSketchMeta';
      meta.type = 'button';
      meta.title = `Open ${sketch.name}`;
      const title = document.createElement('strong');
      title.textContent = sketch.name;
      const stamp = document.createElement('span');
      stamp.textContent = sketchTimestampLabel(sketch.updatedAt);
      meta.append(title, stamp);
      meta.addEventListener('click', () => {
        openSavedSketch(sketch.id);
      });
      item.appendChild(meta);

      const renameBtn = document.createElement('button');
      renameBtn.className = 'ghost savedSketchAction';
      renameBtn.type = 'button';
      renameBtn.textContent = 'Rename';
      renameBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        renameSavedSketch(sketch.id);
      });
      item.appendChild(renameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'ghost savedSketchAction';
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteSavedSketch(sketch.id);
      });
      item.appendChild(deleteBtn);

      savedSketchesListEl.appendChild(item);
    }
  }

  if (menuCurrentSketchEl) {
    const current = currentSavedSketch();
    menuCurrentSketchEl.textContent = current ? `Current: ${current.name}` : 'Current: Unsaved draft';
  }
  if (menuUpdateSavedBtn) {
    menuUpdateSavedBtn.disabled = !currentSavedSketch();
  }
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

  renderSavedSketches();
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

function nextSketchName(baseName, excludeId = null) {
  const base = String(baseName || 'Untitled Sketch').trim() || 'Untitled Sketch';
  if (!savedSketches.some((sketch) => sketch.id !== excludeId && sketch.name === base)) {
    return base;
  }

  let idx = 2;
  while (savedSketches.some((sketch) => sketch.id !== excludeId && sketch.name === `${base} (${idx})`)) {
    idx += 1;
  }
  return `${base} (${idx})`;
}

function ensureSketchDialogElements() {
  let overlay = document.getElementById('sketchDialogOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sketchDialogOverlay';
    overlay.className = 'sketchDialogOverlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section id="sketchDialogCard" class="sketchDialogCard" role="dialog" aria-modal="true" aria-labelledby="sketchDialogTitle">
        <p id="sketchDialogEyebrow" class="eyebrow">Sketch</p>
        <h3 id="sketchDialogTitle" class="sketchDialogTitle"></h3>
        <p id="sketchDialogBody" class="sketchDialogBody"></p>
        <label id="sketchDialogFieldWrap" class="sketchDialogFieldWrap" hidden>
          <span class="sketchDialogLabel">Name</span>
          <input id="sketchDialogInput" class="sketchDialogInput" type="text" maxlength="120" />
        </label>
        <div class="sketchDialogActions">
          <button id="sketchDialogCancelBtn" class="ghost" type="button">Cancel</button>
          <button id="sketchDialogConfirmBtn" type="button">Save</button>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);
  }

  if (!overlay.dataset.bound) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeSketchDialog(null);
      }
    });
    overlay.dataset.bound = '1';
  }

  const input = document.getElementById('sketchDialogInput');
  const cancelBtn = document.getElementById('sketchDialogCancelBtn');
  const confirmBtn = document.getElementById('sketchDialogConfirmBtn');

  if (cancelBtn && !cancelBtn.dataset.bound) {
    cancelBtn.addEventListener('click', () => {
      closeSketchDialog(null);
    });
    cancelBtn.dataset.bound = '1';
  }

  if (confirmBtn && !confirmBtn.dataset.bound) {
    confirmBtn.addEventListener('click', () => {
      if (!sketchDialogState) {
        return;
      }
      if (sketchDialogState.mode === 'text') {
        const clean = String(input?.value || '').trim();
        closeSketchDialog(clean || null);
        return;
      }
      closeSketchDialog(true);
    });
    confirmBtn.dataset.bound = '1';
  }

  if (input && !input.dataset.bound) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const clean = String(input.value || '').trim();
        closeSketchDialog(clean || null);
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSketchDialog(null);
      }
    });
    input.dataset.bound = '1';
  }

  return {
    overlay,
    title: document.getElementById('sketchDialogTitle'),
    body: document.getElementById('sketchDialogBody'),
    fieldWrap: document.getElementById('sketchDialogFieldWrap'),
    input,
    confirmBtn
  };
}

function closeSketchDialog(result) {
  if (!sketchDialogState) {
    return;
  }
  const { overlay, resolve } = sketchDialogState;
  sketchDialogState = null;
  if (overlay) {
    overlay.hidden = true;
  }
  resolve(result);
}

function openSketchNameDialog({ title, body, defaultValue, confirmLabel }) {
  const { overlay, title: titleEl, body: bodyEl, fieldWrap, input, confirmBtn } = ensureSketchDialogElements();
  if (!overlay || !titleEl || !bodyEl || !fieldWrap || !input || !confirmBtn) {
    return Promise.resolve(null);
  }

  titleEl.textContent = title;
  bodyEl.textContent = body;
  fieldWrap.hidden = false;
  input.value = defaultValue || '';
  confirmBtn.textContent = confirmLabel || 'Save';
  overlay.hidden = false;
  sketchDialogState = {
    mode: 'text',
    overlay,
    resolve: (value) => value
  };

  return new Promise((resolve) => {
    sketchDialogState.resolve = resolve;
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}

function openSketchConfirmDialog({ title, body, confirmLabel }) {
  const { overlay, title: titleEl, body: bodyEl, fieldWrap, input, confirmBtn } = ensureSketchDialogElements();
  if (!overlay || !titleEl || !bodyEl || !fieldWrap || !confirmBtn) {
    return Promise.resolve(false);
  }

  titleEl.textContent = title;
  bodyEl.textContent = body;
  fieldWrap.hidden = true;
  if (input) {
    input.value = '';
  }
  confirmBtn.textContent = confirmLabel || 'Confirm';
  overlay.hidden = false;
  sketchDialogState = {
    mode: 'confirm',
    overlay,
    resolve: (value) => value
  };

  return new Promise((resolve) => {
    sketchDialogState.resolve = resolve;
    requestAnimationFrame(() => {
      confirmBtn.focus();
    });
  });
}

async function saveCurrentSketchAs() {
  persistActiveTabCode();
  const suggested = nextSketchName(currentSavedSketch()?.name || 'Untitled Sketch');
  const name = await openSketchNameDialog({
    title: 'Save Sketch As',
    body: 'Give this sketch a name so you can reopen and update it later.',
    defaultValue: suggested,
    confirmLabel: 'Save'
  });
  if (!name) {
    return;
  }

  const stamp = Date.now();
  const sketch = {
    id: `saved-${stamp}`,
    name: nextSketchName(name),
    workspace: sanitizeWorkspace(clone(workspace)),
    createdAt: stamp,
    updatedAt: stamp
  };
  savedSketches = [...savedSketches, sketch];
  currentSketchId = sketch.id;
  renderSavedSketches();
  saveWorkspace();
  closeMenu();
  log(`Saved sketch: ${sketch.name}`);
}

function updateCurrentSavedSketch() {
  persistActiveTabCode();
  const current = currentSavedSketch();
  if (!current) {
    saveCurrentSketchAs();
    return;
  }

  current.workspace = sanitizeWorkspace(clone(workspace));
  current.updatedAt = Date.now();
  renderSavedSketches();
  saveWorkspace();
  closeMenu();
  log(`Updated sketch: ${current.name}`);
}

function openSavedSketch(sketchId) {
  const sketch = savedSketches.find((item) => item.id === sketchId);
  if (!sketch) {
    return;
  }

  persistActiveTabCode();
  workspace = sanitizeWorkspace(clone(sketch.workspace));
  currentSketchId = sketch.id;
  sketch.updatedAt = Math.max(Number(sketch.updatedAt) || 0, Date.now());
  setEditorCode(activeTab().code);
  renderTabs();
  saveWorkspace();
  closeMenu();
  log(`Opened sketch: ${sketch.name}`);
}

async function renameSavedSketch(sketchId = currentSketchId) {
  const sketch = savedSketches.find((item) => item.id === sketchId);
  if (!sketch) {
    return;
  }

  const nextName = await openSketchNameDialog({
    title: 'Rename Sketch',
    body: 'Choose a new name for this saved sketch.',
    defaultValue: sketch.name,
    confirmLabel: 'Rename'
  });
  if (!nextName) {
    return;
  }

  sketch.name = nextSketchName(nextName, sketch.id);
  sketch.updatedAt = Date.now();
  renderSavedSketches();
  saveWorkspace();
  closeMenu();
  log(`Renamed sketch to ${sketch.name}`);
}

async function deleteSavedSketch(sketchId = currentSketchId) {
  const sketch = savedSketches.find((item) => item.id === sketchId);
  if (!sketch) {
    return;
  }
  const confirmed = await openSketchConfirmDialog({
    title: 'Delete Saved Sketch',
    body: `Delete "${sketch.name}" from your saved sketches? This will not change the currently open draft unless it is reopened later.`,
    confirmLabel: 'Delete'
  });
  if (!confirmed) {
    return;
  }

  savedSketches = savedSketches.filter((item) => item.id !== sketch.id);
  if (currentSketchId === sketch.id) {
    currentSketchId = null;
  }
  renderSavedSketches();
  saveWorkspace();
  closeMenu();
  log(`Deleted sketch: ${sketch.name}`);
}

function buildRunPayload() {
  persistActiveTabCode();
  const main = mainTab();
  const files = helperTabs().map((t) => ({ name: t.name, code: t.code }));
  return { code: main.code, files, document: getDocumentWireSnapshot() };
}

function loadExample(exampleId) {
  const found = EXAMPLES.find((x) => x.id === exampleId);
  if (!found) {
    return;
  }
  persistActiveTabCode();
  workspace = sanitizeWorkspace(clone(found.workspace));
  currentSketchId = null;
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
  currentSketchId = null;
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

function renderRuntimeStatus(status) {
  runtimeStatus = status;
  const linkedPath = status?.resolvedPath || status?.qBinary || 'Issue: q path not set';
  const configured = Boolean(status?.configured);
  const hasRuntimeControls = Boolean(desktopApi?.getRuntimeStatus);
  const hasUpdateControls = Boolean(desktopApi?.getUpdateState);

  runtimeSummaryEl.textContent = status?.message || 'Issue: the app has not resolved a q runtime path yet.';
  runtimePlatformEl.textContent = status?.platform || 'desktop';
  runtimePathEl.textContent = linkedPath;
  runtimeSourceEl.textContent = runtimeStatusApi?.sourceLabel ? runtimeStatusApi.sourceLabel(status?.source) : 'Not connected';
  runtimeBadgeEl.textContent = configured ? 'Connected' : 'Not connected';
  runtimeBadgeEl.className = `runtimeBadge ${configured ? 'runtimeBadge-ready' : 'runtimeBadge-pending'}`;
  if (runtimeActionsEl) {
    runtimeActionsEl.hidden = !hasRuntimeControls;
  }
  if (updateCardEl) {
    updateCardEl.hidden = !hasUpdateControls;
  }
  if (updateActionsEl) {
    updateActionsEl.hidden = !hasUpdateControls;
  }
}

function updateBadgeClass(status) {
  if (status === 'up-to-date' || status === 'downloaded') {
    return 'runtimeBadge-ready';
  }
  if (status === 'error') {
    return 'runtimeBadge-pending';
  }
  return 'runtimeBadge-pending';
}

function updateBadgeText(status) {
  if (status === 'checking') {
    return 'Checking';
  }
  if (status === 'available') {
    return 'Found';
  }
  if (status === 'downloading') {
    return 'Downloading';
  }
  if (status === 'downloaded') {
    return 'Ready to install';
  }
  if (status === 'up-to-date') {
    return 'Up to date';
  }
  if (status === 'error') {
    return 'Update error';
  }
  return 'Idle';
}

function renderUpdateState(state) {
  updateState = state;
  const status = state?.status || 'idle';
  updateBadgeEl.textContent = updateBadgeText(status);
  updateBadgeEl.className = `runtimeBadge ${updateBadgeClass(status)}`;
  updateVersionEl.textContent = state?.version || '-';
  updateAvailableEl.textContent = state?.availableVersion || '-';
  updateMessageEl.textContent = state?.message || 'Updates have not been checked yet.';
  installUpdateBtn.disabled = status !== 'downloaded';
}

async function refreshRuntimeStatus() {
  if (!desktopApi?.getRuntimeStatus) {
    try {
      const response = await fetch('/desktop-runtime-status', { cache: 'no-store' });
      if (response.ok) {
        const status = await response.json();
        if (status) {
          renderRuntimeStatus(status);
          return;
        }
      }
    } catch {}

    renderRuntimeStatus(
      runtimeStatusApi?.fallbackRuntimeStatus
        ? runtimeStatusApi.fallbackRuntimeStatus()
        : {
            configured: false,
            platform: 'desktop',
            source: null,
            qBinary: null,
            resolvedPath: null,
            message: 'Runtime actions are limited in this build. If a sketch runs, q is available for this session.'
          }
    );
    return;
  }

  renderRuntimeStatus(await desktopApi.getRuntimeStatus());
}

async function refreshUpdateState() {
  if (!desktopApi?.getUpdateState) {
    renderUpdateState({
      status: 'idle',
      version: '-',
      availableVersion: null,
      message: 'Update checks are available in the packaged desktop app.'
    });
    return;
  }

  renderUpdateState(await desktopApi.getUpdateState());
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

function setPreviewLiveState(isLive) {
  if (!previewView) {
    return;
  }
  previewView.classList.toggle('is-live', Boolean(isLive));
  if (previewEmptyStateEl) {
    previewEmptyStateEl.setAttribute('aria-hidden', isLive ? 'true' : 'false');
  }
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
    editor.executeEdits('qanvas5-toggle-line-comment', edits);
  }
}

function registerQCompletions(monaco) {
  const keywords = Array.isArray(window.BOOTHROYD_Q_SYNTAX?.keywords) ? window.BOOTHROYD_Q_SYNTAX.keywords : [];
  const allWords = Array.from(new Set([...keywords, ...QANVAS5_API_FUNCTIONS]));
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
          kind: QANVAS5_API_FUNCTIONS.includes(word)
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
      vs: '/vendor/monaco-editor/min/vs'
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

    monaco.editor.defineTheme('qanvas5-dark', {
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
      theme: 'qanvas5-dark',
      minimap: { enabled: false },
      fontFamily: 'Menlo, Consolas, monospace',
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
      schedulePersistAppState();
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
      setPreviewLiveState(true);
      if (!desktopApi?.getRuntimeStatus && runtimeStatusApi?.inferRuntimeStatusFromSketch) {
        renderRuntimeStatus(runtimeStatusApi.inferRuntimeStatusFromSketch(runtimeStatus));
      }
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
      setPreviewLiveState(false);
      runGate.resolveRun();
      const detail = String(msg.message || '').trim();
      log(detail ? `Error:\n${detail}` : 'Error');
    }

    if (msg.type === 'stopped') {
      sketchRunning = false;
      awaitingFrame = false;
      setPreviewLiveState(false);
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

function getInputWireSnapshot() {
  inputState.ts = Date.now();
  const mx = Number(inputState.mx) || 0;
  const my = Number(inputState.my) || 0;
  const pmx = Number(inputState.pmx) || 0;
  const pmy = Number(inputState.pmy) || 0;
  const payload = [];
  payload[INPUT_WIRE_FIELDS.mx] = mx;
  payload[INPUT_WIRE_FIELDS.my] = my;
  payload[INPUT_WIRE_FIELDS.pmx] = pmx;
  payload[INPUT_WIRE_FIELDS.pmy] = pmy;
  payload[INPUT_WIRE_FIELDS.mousePressed] = Boolean(inputState.mousePressed);
  payload[INPUT_WIRE_FIELDS.mouseButton] = inputState.mouseButton || 'none';
  payload[INPUT_WIRE_FIELDS.keysDown] = Array.from(keysDown);
  payload[INPUT_WIRE_FIELDS.key] = inputState.key || '';
  payload[INPUT_WIRE_FIELDS.keyCode] = Number(inputState.keyCode) || 0;
  payload[INPUT_WIRE_FIELDS.keyPressed] = Boolean(inputState.keyPressed);
  payload[INPUT_WIRE_FIELDS.keyReleased] = Boolean(inputState.keyReleased);
  payload[INPUT_WIRE_FIELDS.wheelDelta] = Number(inputState.wheelDelta) || 0;
  payload[INPUT_WIRE_FIELDS.ts] = Number(inputState.ts) || Date.now();
  return payload;
}

function getDocumentWireSnapshot() {
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
  const payload = [];
  payload[DOCUMENT_WIRE_FIELDS.cw] = cw;
  payload[DOCUMENT_WIRE_FIELDS.ch] = ch;
  payload[DOCUMENT_WIRE_FIELDS.vw] = vw;
  payload[DOCUMENT_WIRE_FIELDS.vh] = vh;
  payload[DOCUMENT_WIRE_FIELDS.dw] = dw;
  payload[DOCUMENT_WIRE_FIELDS.dh] = dh;
  payload[DOCUMENT_WIRE_FIELDS.sx] = sx;
  payload[DOCUMENT_WIRE_FIELDS.sy] = sy;
  payload[DOCUMENT_WIRE_FIELDS.dpr] = Number(window.devicePixelRatio) || 1;
  payload[DOCUMENT_WIRE_FIELDS.ts] = Date.now();
  return payload;
}

function clearInputFrameEdges() {
  inputState.keyPressed = false;
  inputState.keyReleased = false;
  inputState.wheelDelta = 0;
}


function ensureWalkthroughElements() {
  let overlay = document.getElementById('walkthroughOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'walkthroughOverlay';
    overlay.className = 'walkthroughOverlay';
    overlay.hidden = true;
  }

  let card = document.getElementById('walkthroughCard');
  if (!card) {
    card = document.createElement('section');
    card.id = 'walkthroughCard';
    card.className = 'walkthroughCard';
    card.hidden = true;
    card.innerHTML = `
      <p id="walkthroughStep" class="walkthroughStep"></p>
      <h3 id="walkthroughTitle" class="walkthroughTitle"></h3>
      <p id="walkthroughBody" class="walkthroughBody"></p>
      <div class="walkthroughActions">
        <button id="walkthroughSkipBtn" class="ghost" type="button">Skip</button>
        <button id="walkthroughNextBtn" type="button">Next</button>
      </div>
    `;
  }

  if (!overlay.parentElement) {
    document.body.appendChild(overlay);
  }
  if (!card.parentElement) {
    document.body.appendChild(card);
  }

  return { overlay, card };
}

function getWalkthroughStepElements() {
  return {
    stepEl: document.getElementById('walkthroughStep'),
    titleEl: document.getElementById('walkthroughTitle'),
    bodyEl: document.getElementById('walkthroughBody'),
    nextBtn: document.getElementById('walkthroughNextBtn'),
    skipBtn: document.getElementById('walkthroughSkipBtn')
  };
}

function clearWalkthroughHighlights() {
  document.querySelectorAll('.walkthroughFocus').forEach((el) => {
    el.classList.remove('walkthroughFocus');
  });
}

function syncWalkthroughCard(target) {
  const card = document.getElementById('walkthroughCard');
  if (!card || !target) {
    return;
  }
  const rect = target.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const margin = 14;
  const desiredLeft = rect.left + window.scrollX;
  const maxLeft = Math.max(margin, window.scrollX + window.innerWidth - cardRect.width - margin);
  const left = Math.min(Math.max(window.scrollX + margin, desiredLeft), maxLeft);

  const belowTop = rect.bottom + window.scrollY + margin;
  const aboveTop = rect.top + window.scrollY - cardRect.height - margin;
  const placeAbove = belowTop + cardRect.height > window.scrollY + window.innerHeight - margin && aboveTop >= window.scrollY + margin;
  const top = placeAbove ? aboveTop : belowTop;

  card.style.left = `${Math.round(left)}px`;
  card.style.top = `${Math.round(top)}px`;
}

function stopWalkthrough(message) {
  walkthroughState.active = false;
  walkthroughState.index = 0;
  clearWalkthroughHighlights();
  walkthroughSeen = true;
  schedulePersistAppState();
  const overlay = document.getElementById('walkthroughOverlay');
  const card = document.getElementById('walkthroughCard');
  if (overlay) {
    overlay.hidden = true;
  }
  if (card) {
    card.hidden = true;
  }
  if (message) {
    log(message);
  }
}

function renderWalkthroughStep() {
  if (!walkthroughState.active) {
    return;
  }
  const step = WALKTHROUGH_STEPS[walkthroughState.index];
  if (!step) {
    stopWalkthrough('Walkthrough complete. Happy sketching.');
    return;
  }

  const target = document.querySelector(step.selector);
  if (!target) {
    stopWalkthrough('Walkthrough ended early because a target element was not found.');
    return;
  }

  closeMenu();
  closeExamplesMenu();

  if (step.selector === '#helpTabBtn') {
    showHelpTab();
  }
  if (step.selector === '#setupTabBtn') {
    showSetupTab();
  }
  if (step.selector === '#runBtn' || step.selector === '#editor' || step.selector === '#exampleBtn' || step.selector === '#menuBtn') {
    showPreviewTab();
  }

  clearWalkthroughHighlights();
  target.classList.add('walkthroughFocus');
  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });

  const { stepEl, titleEl, bodyEl, nextBtn } = getWalkthroughStepElements();
  if (!stepEl || !titleEl || !bodyEl || !nextBtn) {
    stopWalkthrough('Walkthrough UI failed to initialize.');
    return;
  }

  stepEl.textContent = `Step ${walkthroughState.index + 1} of ${WALKTHROUGH_STEPS.length}`;
  titleEl.textContent = step.title;
  bodyEl.textContent = step.body;
  nextBtn.textContent = walkthroughState.index === WALKTHROUGH_STEPS.length - 1 ? 'Finish' : 'Next';

  const overlay = document.getElementById('walkthroughOverlay');
  const card = document.getElementById('walkthroughCard');
  if (overlay) {
    overlay.hidden = false;
  }
  if (card) {
    card.hidden = false;
  }
  requestAnimationFrame(() => {
    syncWalkthroughCard(target);
  });
}

function nextWalkthroughStep() {
  if (!walkthroughState.active) {
    return;
  }
  walkthroughState.index += 1;
  renderWalkthroughStep();
}

function startWalkthrough() {
  ensureWalkthroughElements();
  const { nextBtn, skipBtn } = getWalkthroughStepElements();
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.addEventListener('click', () => {
      nextWalkthroughStep();
    });
    nextBtn.dataset.bound = '1';
  }
  if (skipBtn && !skipBtn.dataset.bound) {
    skipBtn.addEventListener('click', () => {
      stopWalkthrough('Walkthrough skipped. Start it again from the menu any time.');
    });
    skipBtn.dataset.bound = '1';
  }

  walkthroughSeen = true;
  schedulePersistAppState();
  walkthroughState.active = true;
  walkthroughState.index = 0;
  renderWalkthroughStep();
  log('Walkthrough started.');
}

runBtn.addEventListener('click', () => {
  clearConsole();
  saveWorkspace();
  sketchRunning = false;
  awaitingFrame = false;
  activeCommands = [];
  setupApplied = false;
  setPreviewLiveState(false);
  const sentNow = runGate.requestRun(buildRunPayload());
  if (!sentNow) {
    log('Run queued');
  }
});

stopBtn.addEventListener('click', () => {
  runGate.cancelRun();
  sketchRunning = false;
  awaitingFrame = false;
  setPreviewLiveState(false);
  send({ type: 'stop' });
});

newSketchBtn.addEventListener('click', () => {
  loadNewSketch();
});

resendBtn.addEventListener('click', () => {
  clearConsole();
});

menuSaveAsBtn?.addEventListener('click', () => {
  saveCurrentSketchAs();
});

menuUpdateSavedBtn?.addEventListener('click', () => {
  updateCurrentSavedSketch();
});

menuResetBtn.addEventListener('click', () => {
  loadExample('bouncers');
  closeMenu();
});

menuWalkthroughBtn?.addEventListener('click', () => {
  closeMenu();
  startWalkthrough();
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
  setupView.hidden = true;
  previewToggleWrap.hidden = false;
  previewTabBtn.classList.add('active');
  helpTabBtn.classList.remove('active');
  setupTabBtn.classList.remove('active');
}

function showHelpTab() {
  previewView.hidden = true;
  helpView.hidden = false;
  setupView.hidden = true;
  previewToggleWrap.hidden = true;
  helpTabBtn.classList.add('active');
  previewTabBtn.classList.remove('active');
  setupTabBtn.classList.remove('active');
}

function showSetupTab() {
  previewView.hidden = true;
  helpView.hidden = true;
  setupView.hidden = false;
  previewToggleWrap.hidden = true;
  setupTabBtn.classList.add('active');
  previewTabBtn.classList.remove('active');
  helpTabBtn.classList.remove('active');
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

setupTabBtn.addEventListener('click', () => {
  showSetupTab();
});

document.addEventListener('click', () => {
  closeMenu();
  closeExamplesMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && sketchDialogState) {
    closeSketchDialog(null);
    return;
  }
  if (event.key === 'Escape') {
    closeMenu();
    closeExamplesMenu();
    if (walkthroughState.active) {
      stopWalkthrough('Walkthrough closed.');
    }
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

fpsToggleEl?.addEventListener('change', () => {
  setFpsOverlayEnabled(fpsToggleEl.checked);
});

runtimeAutoBtn?.addEventListener('click', async () => {
  if (!desktopApi?.autoConfigureRuntime) {
    showSetupTab();
    return;
  }
  runtimeSummaryEl.textContent = 'Testing and connecting your local q runtime...';
  renderRuntimeStatus(await desktopApi.autoConfigureRuntime());
});

runtimePickBtn?.addEventListener('click', async () => {
  if (!desktopApi?.chooseRuntimeBinary) {
    showSetupTab();
    return;
  }
  runtimeSummaryEl.textContent = 'Choose the q executable you installed with KDB-X...';
  renderRuntimeStatus(await desktopApi.chooseRuntimeBinary());
});

runtimeClearBtn?.addEventListener('click', async () => {
  if (!desktopApi?.clearRuntimeBinary) {
    return;
  }
  runtimeSummaryEl.textContent = 'Clearing the saved runtime path...';
  renderRuntimeStatus(await desktopApi.clearRuntimeBinary());
});

checkUpdatesBtn?.addEventListener('click', async () => {
  if (!desktopApi?.checkForUpdates) {
    return;
  }
  renderUpdateState({
    ...(updateState || {}),
    status: 'checking',
    message: 'Checking GitHub Releases for a newer version...'
  });
  renderUpdateState(await desktopApi.checkForUpdates());
});

installUpdateBtn?.addEventListener('click', async () => {
  if (!desktopApi?.installUpdateNow) {
    return;
  }
  await desktopApi.installUpdateNow();
});

openProductBtn?.addEventListener('click', () => {
  const url = runtimeStatus?.guides?.links?.product || 'https://kx.com/products/kdb-x/';
  if (desktopApi?.openExternal) {
    desktopApi.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
});

openDownloadBtn?.addEventListener('click', () => {
  const url = runtimeStatus?.guides?.links?.download || 'https://kx.com/developer/downloads/';
  if (desktopApi?.openExternal) {
    desktopApi.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
});

openDocsBtn?.addEventListener('click', () => {
  const url = runtimeStatus?.guides?.links?.docs || 'https://code.kx.com/';
  if (desktopApi?.openExternal) {
    desktopApi.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
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
    syncFpsOverlay();
    paintFps(0);
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
    updateFpsOverlay(sketch);

    if (sketchRunning && !awaitingFrame && ws && ws.readyState === WebSocket.OPEN) {
      awaitingFrame = true;
      const sent = send({ type: 'step', input: getInputWireSnapshot(), document: getDocumentWireSnapshot() });
      if (sent) {
        clearInputFrameEdges();
      }
    }
  };
}, 'canvasHost');

window.addEventListener('beforeunload', () => {
  stopWalkthrough();
  saveWorkspace();
  if (!persistAppStateWithBeacon()) {
    void persistAppState();
  }
});

window.addEventListener('resize', () => {
  if (!walkthroughState.active) {
    return;
  }
  const step = WALKTHROUGH_STEPS[walkthroughState.index];
  const target = step ? document.querySelector(step.selector) : null;
  if (target) {
    syncWalkthroughCard(target);
  }
});

async function bootstrapApp() {
  applyAppState(await loadStoredAppState());
  appStateLoaded = true;
  initializeAppUi();
}

bootstrapApp().catch((error) => {
  applyAppState(readLocalAppState());
  appStateLoaded = true;
  initializeAppUi();
  log(`Fell back to local draft state: ${String(error?.message || error || 'Unknown bootstrap error')}`);
});

function initializeAppUi() {
  fillExamplesDropdown();
  fillHelpContent();
  renderTabs();
  initMonacoEditor();
  setFpsOverlayEnabled(showFpsOverlay);
  connect();
  refreshRuntimeStatus();
  refreshUpdateState();
  desktopApi?.onUpdateState?.((state) => {
    renderUpdateState(state);
  });
  log('Ready. Press Run.');
  setPreviewLiveState(false);
  if (!walkthroughSeen) {
    startWalkthrough();
  }
}
