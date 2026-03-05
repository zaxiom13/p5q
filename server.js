const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const TMP_DIR = path.join(ROOT, 'tmp');
const PORT = Number(process.env.PORT || 5173);
const EMPTY_SETUP_ERROR = 'setup not loaded';
const EMPTY_DRAW_ERROR = 'draw not loaded';

function getQSpawnSpec() {
  const override = process.env.P5Q_Q_BIN;
  if (override) {
    return { command: override, args: ['-q'], viaWsl: false };
  }

  // On Windows, q may only be available inside an interactive WSL shell.
  if (process.platform === 'win32') {
    return { command: 'wsl.exe', args: ['bash', '-ic', 'q -q'], viaWsl: true };
  }

  return { command: 'q', args: ['-q'], viaWsl: false };
}

function toQLoadPath(filePath, qSpawn) {
  const normalized = filePath.replace(/\\/g, '/');
  if (!qSpawn?.viaWsl) {
    return normalized;
  }

  const driveMatch = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!driveMatch) {
    return normalized;
  }

  const [, drive, rest] = driveMatch;
  return `/mnt/${drive.toLowerCase()}/${rest}`;
}

const RUNTIME_BOOT = [
  '.p5.cmds:();',
  '.p5.state:([]);',
  '.p5.document:([]);',
  '.p5.phase:`idle;',
  `.p5.userSetup:{[doc] ("error";"${EMPTY_SETUP_ERROR}")};`,
  `.p5.userDraw:{[state;input;doc] ("error";"${EMPTY_DRAW_ERROR}")};`,
  '.p5.activeRunId:"";',
  '.p5.reset:{.p5.cmds:()};',
  '.p5.emit:{[name;args] .p5.cmds,: enlist ((enlist name),args);::};',
  '.p5.emit0:{[name] .p5.emit[name;()]};',
  '.p5.emit1:{[name;a] .p5.emit[name;enlist a]};',
  '.p5.emit2:{[name;a;b] .p5.emit[name;(a;b)]};',
  '.p5.emit3:{[name;a;b;c] .p5.emit[name;(a;b;c)]};',
  '.p5.emit4:{[name;a;b;c;d] .p5.emit[name;(a;b;c;d)]};',
  '.p5.emit5:{[name;a;b;c;d;e] .p5.emit[name;(a;b;c;d;e)]};',
  '.p5.emit6:{[name;a;b;c;d;e;f] .p5.emit[name;(a;b;c;d;e;f)]};',
  '.p5.tab:{[x] (98h=type x) or 99h=type x};',
  '.p5.istable:{[x] (98h=type x) or 99h=type x};',
  '.p5.aslist:{[x] $[0h=type x; x; enlist x]};',
  '.p5.emitcolor:{[name;xs] n:count xs; if[1=n; :.p5.emit1[name;xs 0]]; if[2=n; :.p5.emit2[name;xs 0;xs 1]]; if[3=n; :.p5.emit3[name;xs 0;xs 1;xs 2]]; if[4=n; :.p5.emit4[name;xs 0;xs 1;xs 2;xs 3]]; ::};',
  '.p5.hasfill:{[ks] (`fill in ks) or (`fillR in ks) or (`noFill in ks)};',
  '.p5.hasstroke:{[ks] (`stroke in ks) or (`strokeR in ks) or (`noStroke in ks)};',
  '.p5.req:{[row;pri;alts;fname] ks:key row; if[pri in ks; :row pri]; if[0<count alts; hits:ks inter alts; if[0<count hits; :row first hits]]; \'(fname,": missing column ",string pri)};',
  '.p5.applycolor:{[row;dofill;dostroke] ks:key row; if[dofill and not .p5.hasfill ks; .p5.emit1["fill";255]]; if[dostroke and not .p5.hasstroke ks; .p5.emit3["stroke";0;0;0]]; if[dostroke and not (`strokeWeight in ks); .p5.emit1["strokeWeight";4]]; if[`noFill in ks; if[row`noFill; .p5.emit0["noFill"]]]; if[`fill in ks; .p5.emitcolor["fill";.p5.aslist row`fill]]; if[`fillR in ks; .p5.emitcolor["fill";$[`fillA in ks;(row`fillR;row`fillG;row`fillB;row`fillA);(row`fillR;row`fillG;row`fillB)]]]; if[`stroke in ks; .p5.emitcolor["stroke";.p5.aslist row`stroke]]; if[`strokeR in ks; .p5.emitcolor["stroke";$[`strokeA in ks;(row`strokeR;row`strokeG;row`strokeB;row`strokeA);(row`strokeR;row`strokeG;row`strokeB)]]]; if[`strokeWeight in ks; .p5.emit1["strokeWeight";row`strokeWeight]]; ::};',
  '.p5.circlerow:{[row] .p5.applycolor[row;1b;0b]; xv:.p5.req[row;`x;enlist `cx;"circle"]; yv:.p5.req[row;`y;enlist `cy;"circle"]; dv:.p5.req[row;`d;enlist `diameter;"circle"]; .p5.emit3["circle";xv;yv;dv]};',
  '.p5.circlerows:{[t] {.p5.circlerow x} each t;::};',
  '.p5.rectrow:{[row] .p5.applycolor[row;1b;0b]; xv:.p5.req[row;`x;();"rect"]; yv:.p5.req[row;`y;();"rect"]; wv:.p5.req[row;`w;enlist `width;"rect"]; hv:.p5.req[row;`h;enlist `height;"rect"]; $[`r in key row; .p5.emit5["rect";xv;yv;wv;hv;row`r]; .p5.emit4["rect";xv;yv;wv;hv]]};',
  '.p5.rectrows:{[t] {.p5.rectrow x} each t;::};',
  '.p5.linerow:{[row] .p5.applycolor[row;0b;1b]; x1:.p5.req[row;`x1;();"line"]; y1:.p5.req[row;`y1;();"line"]; x2:.p5.req[row;`x2;();"line"]; y2:.p5.req[row;`y2;();"line"]; .p5.emit4["line";x1;y1;x2;y2]};',
  '.p5.linerows:{[t] {.p5.linerow x} each t;::};',
  '.p5.ellipserow:{[row] .p5.applycolor[row;1b;0b]; xv:.p5.req[row;`x;();"ellipse"]; yv:.p5.req[row;`y;();"ellipse"]; wv:.p5.req[row;`w;enlist `width;"ellipse"]; hv:.p5.req[row;`h;enlist `height;"ellipse"]; .p5.emit4["ellipse";xv;yv;wv;hv]};',
  '.p5.ellipserows:{[t] {.p5.ellipserow x} each t;::};',
  '.p5.trianglerow:{[row] .p5.applycolor[row;1b;0b]; .p5.emit6["triangle"; .p5.req[row;`x1;();"triangle"]; .p5.req[row;`y1;();"triangle"]; .p5.req[row;`x2;();"triangle"]; .p5.req[row;`y2;();"triangle"]; .p5.req[row;`x3;();"triangle"]; .p5.req[row;`y3;();"triangle"]]};',
  '.p5.trianglerows:{[t] {.p5.trianglerow x} each t;::};',
  '.p5.pointrow:{[row] .p5.applycolor[row;0b;1b]; .p5.emit2["point"; .p5.req[row;`x;();"point"]; .p5.req[row;`y;();"point"]]};',
  '.p5.pointrows:{[t] {.p5.pointrow x} each t;::};',
  '.p5.textrow:{[row] .p5.applycolor[row;1b;0b]; tv:.p5.req[row;`txt;enlist `text;"text"]; xv:.p5.req[row;`x;();"text"]; yv:.p5.req[row;`y;();"text"]; .p5.emit3["text";tv;xv;yv]};',
  '.p5.textrows:{[t] {.p5.textrow x} each t;::};',
  '.p5createcanvas:{[w;h] .p5.emit2["createCanvas";w;h]};',
  '.p5resizecanvas:{[w;h] .p5.emit2["resizeCanvas";w;h]};',
  '.p5framerate:{[f] .p5.emit1["frameRate";f]};',
  '.p5background:{[x] xs:$[(1<count x) and ((type x)>0h) and ((type x)<20h);x;.p5.aslist x]; n:count xs; if[1=n; :.p5.emit1["background";xs 0]]; if[2=n; :.p5.emit2["background";xs 0;xs 1]]; if[3=n; :.p5.emit3["background";xs 0;xs 1;xs 2]]; \' "background expects 1-3 args"};',
  '.p5clear:{[] .p5.emit0["clear"]};',
  '.p5fill:{[a;b;c] if[11h=type b; :.p5.emit1["fill";a]]; if[11h=type c; :.p5.emit2["fill";a;b]]; .p5.emit3["fill";a;b;c]};',
  '.p5nofill:{[] .p5.emit0["noFill"]};',
  '.p5stroke:{[a;b;c] if[11h=type b; :.p5.emit1["stroke";a]]; if[11h=type c; :.p5.emit2["stroke";a;b]]; .p5.emit3["stroke";a;b;c]};',
  '.p5nostroke:{[] .p5.emit0["noStroke"]};',
  '.p5strokeweight:{[w] .p5.emit1["strokeWeight";w]};',
  '.p5line:{[x] if[.p5.tab x; :.p5.linerows $[99h=type x;value x;x]]; \' "line expects table"};',
  '.p5rect:{[x] if[.p5.tab x; :.p5.rectrows $[99h=type x;value x;x]]; \' "rect expects table"};',
  '.p5circle:{[x] if[.p5.tab x; :.p5.circlerows $[99h=type x;value x;x]]; \' "circle expects table"};',
  '.p5ellipse:{[x] if[.p5.tab x; :.p5.ellipserows $[99h=type x;value x;x]]; \' "ellipse expects table"};',
  '.p5triangle:{[x] if[.p5.tab x; :.p5.trianglerows $[99h=type x;value x;x]]; \' "triangle expects table"};',
  '.p5point:{[x] if[.p5.tab x; :.p5.pointrows $[99h=type x;value x;x]]; \' "point expects table"};',
  '.p5text:{[x] if[.p5.tab x; :.p5.textrows $[99h=type x;value x;x]]; \' "text expects table"};',
  '.p5textsize:{[x] .p5.emit1["textSize";x]};',
  '.p5textalign:{[a;b] if[11h=type b; :.p5.emit1["textAlign";a]]; .p5.emit2["textAlign";a;b]};',
  '.p5textfont:{[a;b] if[11h=type b; :.p5.emit1["textFont";a]]; .p5.emit2["textFont";a;b]};',
  '.p5push:{[] .p5.emit0["push"]};',
  '.p5pop:{[] .p5.emit0["pop"]};',
  '.p5translate:{[x;y] .p5.emit2["translate";x;y]};',
  '.p5rotate:{[x] .p5.emit1["rotate";x]};',
  '.p5scale:{[x;y] if[11h=type y; :.p5.emit1["scale";x]]; .p5.emit2["scale";x;y]};',
  '.p5random:{[x;y] if[11h=type y; :x*rand 1f]; x + (y-x)*rand 1f};',
  '.p5map:{[v;a1;a2;b1;b2] b1 + ((v-a1) % (a2-a1)) * (b2-b1)};',
  '.p5constrain:{[v;lo;hi] lo | (hi & v)};',
  '.p5.fromret:{[r] if[0h<>type r; :()]; if[0=count r; :()]; if[0h=type first r; :r]; if[10h=type first r; :enlist r]; :()};',
  '.p5.setstate:{[r] if[104h=type r; :()]; if[0h=type r; if[0<count r; if["error"~first r; :r]]]; if[.p5.istable r; .p5.state:$[99h=type r;value r;r]; :()]; if[0<count .p5.cmds; :()]; ("error";"state must be a table")};',
  `.p5.runsetup:{[doc] .p5.reset[]; .p5.state:([]); .p5.document:doc; document:doc; .p5.phase:\`setup; r:@[.p5.userSetup;doc;{("error";string x)}]; if[0h=type r; if[0<count r; if["error"~first r; if["${EMPTY_SETUP_ERROR}"~string r 1; :r]; r0:@[.p5.userSetup;();{("error";string x)}]; if[(104h<>type r0) and not ("error"~first r0); r:r0]]]]; .p5.phase:\`idle; if[0h=type r; if[0<count r; if["error"~first r; :r]]]; sr:.p5.setstate r; if[0h=type sr; if[0<count sr; if["error"~first sr; :sr]]]; if[0=count .p5.cmds; : .p5.fromret r]; .p5.cmds};`,
  `.p5.rundraw:{[input;doc] .p5.reset[]; .p5.document:doc; document:doc; .p5.phase:\`draw; r:.[.p5.userDraw;(.p5.state;input;doc);{("error";string x)}]; if[0h=type r; if[0<count r; if["error"~first r; if["${EMPTY_DRAW_ERROR}"~string r 1; :r]; r1:.[.p5.userDraw;(.p5.state;input);{("error";string x)}]; if[(104h<>type r1) and not ("error"~first r1); r:r1]]]]; if[0h=type r; if[0<count r; if["error"~first r; r2:.[.p5.userDraw;enlist input;{("error";string x)}]; if[(104h<>type r2) and not ("error"~first r2); r:r2]]]]; if[0h=type r; if[0<count r; if["error"~first r; r3:@[.p5.userDraw;();{("error";string x)}]; if[(104h<>type r3) and not ("error"~first r3); r:r3]]]]; .p5.phase:\`idle; if[0h=type r; if[0<count r; if["error"~first r; :r]]]; sr:.p5.setstate r; if[0h=type sr; if[0<count sr; if["error"~first sr; :sr]]]; if[0=count .p5.cmds; : .p5.fromret r]; .p5.cmds};`,
  '.p5.dispatch:{[id;fn] r:@[fn;();{("error";string x)}]; -1 .j.j (`id`result!(id;r))};'
].join('\n');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function sendJson(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function qString(str) {
  return `"${String(str ?? '').replace(/"/g, '""')}"`;
}

function qSymbol(str) {
  return '`$' + qString(String(str ?? ''));
}

function qBool(value) {
  return value ? '1b' : '0b';
}

function qFloat(value, fallback = 0) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : fallback;
  return `${safe}f`;
}

function qInt(value, fallback = 0) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? Math.trunc(n) : fallback;
  return `${safe}i`;
}

function qInputTableLiteral(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const keys = Array.isArray(input.keysDown) ? input.keysDown : [];
  const keysExpr = keys.length ? `(${keys.map((k) => qSymbol(k)).join(';')})` : '()';
  const columns = '`mx`my`pmx`pmy`mousePressed`mouseButton`keysDown`key`keyCode`keyPressed`keyReleased`wheelDelta`ts';
  const values = [
    `enlist ${qFloat(input.mx)}`,
    `enlist ${qFloat(input.my)}`,
    `enlist ${qFloat(input.pmx)}`,
    `enlist ${qFloat(input.pmy)}`,
    `enlist ${qBool(input.mousePressed)}`,
    `enlist ${qSymbol(input.mouseButton || 'none')}`,
    `enlist ${keysExpr}`,
    `enlist ${qString(input.key || '')}`,
    `enlist ${qInt(input.keyCode)}`,
    `enlist ${qBool(input.keyPressed)}`,
    `enlist ${qBool(input.keyReleased)}`,
    `enlist ${qFloat(input.wheelDelta)}`,
    `enlist ${qFloat(input.ts)}`
  ];
  return `flip ${columns}!(${values.join(';')})`;
}

function qDocumentTableLiteral(raw) {
  const doc = raw && typeof raw === 'object' ? raw : {};
  const columns = '`cw`ch`vw`vh`dw`dh`sx`sy`dpr`ts';
  const values = [
    `enlist ${qFloat(doc.cw)}`,
    `enlist ${qFloat(doc.ch)}`,
    `enlist ${qFloat(doc.vw)}`,
    `enlist ${qFloat(doc.vh)}`,
    `enlist ${qFloat(doc.dw)}`,
    `enlist ${qFloat(doc.dh)}`,
    `enlist ${qFloat(doc.sx)}`,
    `enlist ${qFloat(doc.sy)}`,
    `enlist ${qFloat(doc.dpr, 1)}`,
    `enlist ${qFloat(doc.ts)}`
  ];
  return `flip ${columns}!(${values.join(';')})`;
}

function toRuntimeError(result) {
  if (!Array.isArray(result) || result[0] !== 'error') {
    return null;
  }
  const detail = Array.isArray(result[1]) ? result[1].join('') : String(result[1] || 'q runtime error');
  return new Error(detail);
}

function normalizeCommands(payload) {
  if (!Array.isArray(payload) || payload.length === 0) {
    return [];
  }
  if (Array.isArray(payload[0])) {
    return payload;
  }
  if (typeof payload[0] === 'string') {
    return [payload];
  }
  return [];
}

function stripSketchComments(code) {
  return String(code || '')
    .split('\n')
    .filter((line) => {
      const t = line.trimStart();
      if (!t) {
        return false;
      }
      return !(t.startsWith('//') || (t.startsWith('/') && !t.startsWith('/:')));
    })
    .join('\n');
}

function splitTopLevelStatements(code) {
  const src = String(code || '');
  const out = [];
  let cur = '';
  let inString = false;
  let braces = 0;
  let brackets = 0;
  let parens = 0;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    cur += ch;

    if (ch === '"') {
      if (inString && src[i + 1] === '"') {
        cur += '"';
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === '{') braces += 1;
    if (ch === '}') braces -= 1;
    if (ch === '[') brackets += 1;
    if (ch === ']') brackets -= 1;
    if (ch === '(') parens += 1;
    if (ch === ')') parens -= 1;

    if (braces < 0 || brackets < 0 || parens < 0) {
      throw new Error('unbalanced brackets');
    }

    if (ch === ';' && braces === 0 && brackets === 0 && parens === 0) {
      const stmt = cur.trim().replace(/;$/, '').trim();
      if (stmt) {
        out.push(stmt);
      }
      cur = '';
    }
  }

  if (inString || braces !== 0 || brackets !== 0 || parens !== 0) {
    throw new Error('unbalanced function definition');
  }

  const tail = cur.trim();
  if (tail) {
    out.push(tail);
  }

  return out;
}

function validateHelperTabCode(tabName, code) {
  const cleaned = stripSketchComments(code);
  if (!cleaned.trim()) {
    return;
  }
  const statements = splitTopLevelStatements(cleaned);
  for (const stmt of statements) {
    const m = stmt.match(/^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*:\s*\{[\s\S]*\}\s*$/);
    if (!m) {
      throw new Error(`Tab "${tabName}" must contain only function definitions (name:{...};)`);
    }
    const fnName = m[1];
    if (fnName === 'setup' || fnName === 'draw') {
      throw new Error(`Tab "${tabName}" cannot redefine ${fnName}`);
    }
  }
}

function combineRunCode(mainCode, helperFiles) {
  const main = String(mainCode || '');
  const helpers = Array.isArray(helperFiles) ? helperFiles : [];
  const validatedHelpers = helpers.map((file, i) => {
    const name = String(file?.name || `helper-${i + 1}.q`);
    const code = String(file?.code || '');
    validateHelperTabCode(name, code);
    return code.trim();
  });

  return [...validatedHelpers.filter(Boolean), main].join('\n');
}

const API_REWRITE = [
  ['createCanvas', '.p5createcanvas'],
  ['resizeCanvas', '.p5resizecanvas'],
  ['frameRate', '.p5framerate'],
  ['clear', '.p5clear'],
  ['fill', '.p5fill'],
  ['noFill', '.p5nofill'],
  ['stroke', '.p5stroke'],
  ['noStroke', '.p5nostroke'],
  ['strokeWeight', '.p5strokeweight'],
  ['line', '.p5line'],
  ['rect', '.p5rect'],
  ['circle', '.p5circle'],
  ['ellipse', '.p5ellipse'],
  ['triangle', '.p5triangle'],
  ['point', '.p5point'],
  ['textSize', '.p5textsize'],
  ['textAlign', '.p5textalign'],
  ['textFont', '.p5textfont'],
  ['text', '.p5text'],
  ['push', '.p5push'],
  ['pop', '.p5pop'],
  ['translate', '.p5translate'],
  ['rotate', '.p5rotate'],
  ['scale', '.p5scale'],
  ['random', '.p5random'],
  ['map', '.p5map'],
  ['constrain', '.p5constrain']
];

function preprocessSketchCode(code) {
  let out = String(code || '');
  out = stripSketchComments(out);

  let flat = '';
  let inString = false;
  for (let i = 0; i < out.length; i += 1) {
    const ch = out[i];
    if (ch === '"') {
      if (inString && out[i + 1] === '"') {
        flat += '""';
        i += 1;
        continue;
      }
      inString = !inString;
      flat += ch;
      continue;
    }
    if (!inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
      flat += ' ';
      continue;
    }
    flat += ch;
  }
  out = flat.replace(/\s+/g, ' ').trim();

  out = out.replace(/\bbackground\s*\[([^\]]*)\]/g, (_, inner) => `.p5background[(${inner})]`);

  const tupleArgMin = {
    circle: 3,
    line: 4,
    rect: 4,
    ellipse: 4,
    triangle: 6,
    point: 2,
    text: 3
  };

  for (const [name, minArgs] of Object.entries(tupleArgMin)) {
    out = out.replace(new RegExp(`\\b${name}\\s*\\[([^\\[\\]]*)\\]`, 'g'), (_, inner) => {
      const parts = inner.split(';');
      if (parts.length >= minArgs) {
        return `${name}[(${inner})]`;
      }
      return `${name}[${inner}]`;
    });
  }
  for (const [from, to] of API_REWRITE) {
    out = out.replace(new RegExp(`\\b${from}\\s*\\[`, 'g'), `${to}[`);
  }
  return out;
}

class QSession {
  constructor() {
    this.proc = null;
    this.qSpawn = null;
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.pending = new Map();
    this.nextId = 1;
    this.onStdoutLine = null;
  }

  async start() {
    await fsp.mkdir(TMP_DIR, { recursive: true });
    this.qSpawn = getQSpawnSpec();
    const proc = spawn(this.qSpawn.command, this.qSpawn.args, {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    this.proc = proc;

    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');

    proc.stdout.on('data', (chunk) => {
      this.stdoutBuffer += chunk;
      this._drainStdout();
    });

    proc.stderr.on('data', (chunk) => {
      this.stderrBuffer += chunk;
    });

    proc.on('exit', () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error('q process exited'));
      }
      this.pending.clear();
      if (this.proc === proc) {
        this.proc = null;
      }
    });

    proc.stdin.write(`${RUNTIME_BOOT}\n`);
  }

  _drainStdout() {
    let idx = this.stdoutBuffer.indexOf('\n');
    while (idx >= 0) {
      const raw = this.stdoutBuffer.slice(0, idx);
      this.stdoutBuffer = this.stdoutBuffer.slice(idx + 1);
      const line = raw.replace(/\r$/, '');
      const trimmed = line.trim();
      let handledProtocol = false;

      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const msg = JSON.parse(trimmed);
          const pending = this.pending.get(msg.id);
          if (pending) {
            this.pending.delete(msg.id);
            pending.resolve(msg.result);
            handledProtocol = true;
          }
        } catch {
          // Fall through to regular stdout forwarding.
        }
      }

      if (!handledProtocol && trimmed && typeof this.onStdoutLine === 'function') {
        this.onStdoutLine(line);
      }

      idx = this.stdoutBuffer.indexOf('\n');
    }
  }

  async resetAndLoad(code) {
    if (!this.proc) {
      this.stdoutBuffer = '';
      this.stderrBuffer = '';
      this.pending.clear();
      this.nextId = 1;
      await this.start();
    }

    const sketchId = crypto.randomBytes(8).toString('hex');
    const sketchPath = path.join(TMP_DIR, `sketch-${sketchId}.q`);
    const rewritten = preprocessSketchCode(code);
    const runNamespace = `.p5run${sketchId}`;
    const wrapped = [
      `.p5.userSetup:{[doc] ("error";"${EMPTY_SETUP_ERROR}")};`,
      `.p5.userDraw:{[state;input;doc] ("error";"${EMPTY_DRAW_ERROR}")};`,
      '.p5.activeRunId:"";',
      `\\d ${runNamespace}`,
      rewritten,
      '.p5.userSetup:setup;',
      '.p5.userDraw:draw;',
      `.p5.activeRunId:"${sketchId}";`,
      '\\d .'
    ].join('\n');
    await fsp.writeFile(sketchPath, `${wrapped}\n`, 'utf8');

    this.proc.stdin.write(`\\l ${toQLoadPath(sketchPath, this.qSpawn)}\n`);
    await new Promise((resolve) => setTimeout(resolve, 90));
    // q can emit non-fatal stderr lines around \l even when the script loads.
    // Actual setup/draw failures are surfaced through .p5.runsetup/.p5.rundraw.
    this.stderrBuffer = '';
  }

  invoke(fnExpr) {
    if (!this.proc) {
      return Promise.reject(new Error('q session not started'));
    }

    const id = this.nextId++;
    // Trailing semicolon suppresses q REPL echo (e.g. internal `-1` spam).
    const cmd = `.p5.dispatch[${id};{${fnExpr}}];\n`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Timed out waiting for q response'));
      }, 1800);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      this.proc.stdin.write(cmd);
    });
  }

  async close() {
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
  }
}

function serveStatic(req, res) {
  const cleanPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(PUBLIC_DIR, cleanPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', async (ws) => {
  const q = new QSession();
  let running = false;
  let messageQueue = Promise.resolve();
  let ready = false;
  const pendingMessages = [];
  q.onStdoutLine = (line) => {
    sendJson(ws, { type: 'stdout', line });
  };

  const processMessage = (raw) => {
    messageQueue = messageQueue
      .then(async () => {
        let msg;
        try {
          msg = JSON.parse(raw.toString('utf8'));
        } catch {
          return;
        }

        try {
      if (msg.type === 'run') {
        running = false;
        const mergedCode = combineRunCode(msg.code || '', msg.files || []);
        await q.resetAndLoad(mergedCode);
        const docTableExpr = qDocumentTableLiteral(msg.document);
        const setupResult = await q.invoke(`.p5.runsetup[${docTableExpr}]`);
        const setupError = toRuntimeError(setupResult);
        if (setupError) {
          throw setupError;
        }
        const setupCommands = normalizeCommands(setupResult);
        running = true;
        sendJson(ws, { type: 'runResult', ok: true, setup: setupCommands });
      }

      if (msg.type === 'step' && running) {
        const frame = Number(msg.frame || 0);
        const inputTableExpr = qInputTableLiteral(msg.input);
        const docTableExpr = qDocumentTableLiteral(msg.document);
        const stepResult = await q.invoke(`.p5.rundraw[${inputTableExpr};${docTableExpr}]`);
        const stepError = toRuntimeError(stepResult);
        if (stepError) {
          throw stepError;
        }
        const commands = normalizeCommands(stepResult);
        sendJson(ws, { type: 'stepResult', frame, commands });
      }

          if (msg.type === 'stop') {
            running = false;
            sendJson(ws, { type: 'stopped' });
          }
        } catch (err) {
          sendJson(ws, { type: 'runtimeError', message: err.message });
        }
      })
      .catch(() => {});
  };

  ws.on('message', (raw) => {
    if (!ready) {
      pendingMessages.push(raw);
      return;
    }
    processMessage(raw);
  });

  try {
    await q.start();
    ready = true;
    for (const raw of pendingMessages.splice(0)) {
      processMessage(raw);
    }
  } catch (err) {
    sendJson(ws, { type: 'serverError', message: `Unable to start q: ${err.message}` });
    ws.close();
    return;
  }

  ws.on('close', async () => {
    running = false;
    q.onStdoutLine = null;
    await q.close();
  });
});

server.listen(PORT, () => {
  console.log(`p5q editor listening on http://localhost:${PORT}`);
});
