const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const VENDOR_DIR = path.join(ROOT, 'node_modules');
const PORT = Number(process.env.PORT || 5173);
const EMPTY_SETUP_ERROR = 'setup not loaded';
const EMPTY_DRAW_ERROR = 'draw not loaded';

function getTmpDir() {
  return path.resolve(process.env.QANVAS5_TMP_DIR || path.join(ROOT, 'tmp'));
}

function getRuntimeCwd() {
  return path.resolve(process.env.QANVAS5_RUNTIME_CWD || getTmpDir());
}

function envInt(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : fallback;
}

const Q_LOAD_SETTLE_MS = envInt('QANVAS5_LOAD_SETTLE_MS', 90);
const Q_INVOKE_TIMEOUT_MS = envInt('QANVAS5_INVOKE_TIMEOUT_MS', 1800);
const Q_CLOSE_TIMEOUT_MS = envInt('QANVAS5_CLOSE_TIMEOUT_MS', 400);
const Q_MAX_RUNS_PER_SESSION = envInt('QANVAS5_MAX_RUNS_PER_SESSION', 50);
const WS_PENDING_LIMIT = envInt('QANVAS5_WS_PENDING_LIMIT', 64);
const TMP_FILE_MAX_AGE_MS = envInt('QANVAS5_TMP_FILE_MAX_AGE_MS', 60 * 60 * 1000);
const Q_WORKER_POOL_SIZE = envInt('QANVAS5_WORKER_POOL_SIZE', 1);

function getQSpawnSpec(overrideBinary = process.env.QANVAS5_Q_BIN) {
  const override = overrideBinary;
  if (override) {
    return { command: override, args: ['-q'], viaWsl: false };
  }

  // On Windows, q may only be available inside an interactive WSL shell.
  if (process.platform === 'win32') {
    return { command: 'wsl.exe', args: ['bash', '-ic', 'q -q'], viaWsl: true };
  }

  return { command: 'q', args: ['-q'], viaWsl: false };
}

function formatQSpawnError(error, qSpawn = getQSpawnSpec()) {
  const detail = String(error?.message || error || '').trim();
  const command = qSpawn?.command || 'q';
  if (error?.code === 'ENOENT') {
    return `Unable to launch q. The executable "${command}" was not found. Open Setup and choose your q executable, or install KDB-X first.`;
  }
  return detail || 'Unable to launch q.';
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

async function pruneTmpDir() {
  const tmpDir = getTmpDir();
  const now = Date.now();
  let entries;
  try {
    entries = await fsp.readdir(tmpDir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^sketch-.*\.q$/i.test(entry.name))
      .map(async (entry) => {
        const fullPath = path.join(tmpDir, entry.name);
        try {
          const stat = await fsp.stat(fullPath);
          if (now - stat.mtimeMs > TMP_FILE_MAX_AGE_MS) {
            await fsp.unlink(fullPath);
          }
        } catch {
          // Ignore concurrent cleanup races.
        }
      })
  );
}

const RUNTIME_BOOT = [
  '.p5.currentSession:`symbol$();',
  '.p5.sessions:(`symbol$())!();',
  '.p5.phase:`idle;',
  `.p5.emptysetup:{[doc] ("error";"${EMPTY_SETUP_ERROR}")};`,
  `.p5.emptydraw:{[state;input;doc] ("error";"${EMPTY_DRAW_ERROR}")};`,
  '.p5.mksession:{[] `state`document`cmds`setup`draw`runId!(([]);([]);();.p5.emptysetup;.p5.emptydraw;"")};',
  '.p5.ensuresession:{[sid] if[not sid in key .p5.sessions; .[`.p5.sessions;enlist sid;:;.p5.mksession[]]]; ::};',
  '.p5.delsession:{[sid] if[sid in key .p5.sessions; delete sid from `.p5.sessions]; ::};',
  '.p5.sget:{[sid;k] (.p5.sessions sid) k};',
  '.p5.sset:{[sid;k;v] .[`.p5.sessions;(sid;k);:;v]; ::};',
  '.p5.begin:{[sid;phase] .p5.currentSession:sid; .p5.phase:phase; ::};',
  '.p5.finish:{[priorSession] .p5.phase:`idle; .p5.currentSession:priorSession; ::};',
  '.p5.setdocument:{[sid;doc] .p5.sset[sid;`document;doc]; document:doc; ::};',
  '.p5.clearstate:{[sid] .p5.sset[sid;`state;([])]; ::};',
  '.p5.preparerun:{[sid] .p5.ensuresession sid; .p5.sset[sid;`state;([])]; .p5.sset[sid;`document;([])]; .p5.sset[sid;`cmds;()]; .p5.sset[sid;`setup;.p5.emptysetup]; .p5.sset[sid;`draw;.p5.emptydraw]; .p5.sset[sid;`runId;""]; ::};',
  '.p5.reset:{[] sid:.p5.currentSession; .p5.sset[sid;`cmds;()]; ::};',
  '.p5.emit:{[name;args] sid:.p5.currentSession; cmds:.p5.sget[sid;`cmds]; .p5.sset[sid;`cmds;cmds,enlist ((enlist name),args)]; ::};',
  '.p5.emit0:{[name] .p5.emit[name;()]};',
  '.p5.emit1:{[name;a] .p5.emit[name;enlist a]};',
  '.p5.emit2:{[name;a;b] .p5.emit[name;(a;b)]};',
  '.p5.emit3:{[name;a;b;c] .p5.emit[name;(a;b;c)]};',
  '.p5.emit4:{[name;a;b;c;d] .p5.emit[name;(a;b;c;d)]};',
  '.p5.emit5:{[name;a;b;c;d;e] .p5.emit[name;(a;b;c;d;e)]};',
  '.p5.emit6:{[name;a;b;c;d;e;f] .p5.emit[name;(a;b;c;d;e;f)]};',
  '.p5.tab:{[x] (98h=type x) or 99h=type x};',
  '.p5.istable:{[x] (98h=type x) or 99h=type x};',
  '.p5.aslist:{[x] $[(type x)>=0h; x; enlist x]};',
  '.p5.emitcolor:{[name;xs] n:count xs; if[1=n; :.p5.emit1[name;xs 0]]; if[2=n; :.p5.emit2[name;xs 0;xs 1]]; if[3=n; :.p5.emit3[name;xs 0;xs 1;xs 2]]; if[4=n; :.p5.emit4[name;xs 0;xs 1;xs 2;xs 3]]; ::};',
  '.p5.hasfill:{[ks] (`fill in ks) or (`noFill in ks)};',
  '.p5.hasstroke:{[ks] (`stroke in ks) or (`noStroke in ks)};',
  '.p5.req:{[row;pri;alts;fname] ks:key row; if[pri in ks; :row pri]; if[0<count alts; hits:ks inter alts; if[0<count hits; :row first hits]]; \'(fname,": missing column ",string pri)};',
  '.p5.reqidx:{[row;col;idx;fname] v:row col; if[(type v)<0h; if[0=idx; :v]; \'(fname,": column ",string col," must have at least ",string (1+idx)," values")]; if[idx<count v; :v idx]; \'(fname,": column ",string col," must have at least ",string (1+idx)," values")};',
  '.p5.reqvecidx:{[row;col;idx;fname] if[not col in key row; \'(fname,": missing column ",string col)]; .p5.reqidx[row;col;idx;fname]};',
  '.p5.reqfromvec:{[row;vec;idx;pri;alts;fname] if[vec in key row; :.p5.reqidx[row;vec;idx;fname]]; .p5.req[row;pri;alts;fname]};',
  '.p5.applycolor:{[row;dofill;dostroke] ks:key row; if[dofill and not .p5.hasfill ks; .p5.emit1["fill";255]]; if[dostroke and not .p5.hasstroke ks; .p5.emit3["stroke";0;0;0]]; if[dostroke and not (`strokeWeight in ks); .p5.emit1["strokeWeight";4]]; if[`noFill in ks; if[row`noFill; .p5.emit0["noFill"]]]; if[`fill in ks; .p5.emitcolor["fill";.p5.aslist row`fill]]; if[`stroke in ks; .p5.emitcolor["stroke";.p5.aslist row`stroke]]; if[`strokeWeight in ks; .p5.emit1["strokeWeight";row`strokeWeight]]; ::};',
  '.p5.circlerow:{[row] .p5.applycolor[row;1b;0b]; xv:.p5.reqvecidx[row;`p;0;"circle"]; yv:.p5.reqvecidx[row;`p;1;"circle"]; dv:.p5.req[row;`d;();"circle"]; .p5.emit3["circle";xv;yv;dv]};',
  '.p5.circlerows:{[t] {.p5.circlerow x} each t;::};',
  '.p5.rectrow:{[row] .p5.applycolor[row;1b;0b]; xv:.p5.reqvecidx[row;`p;0;"rect"]; yv:.p5.reqvecidx[row;`p;1;"rect"]; wv:.p5.reqvecidx[row;`size;0;"rect"]; hv:.p5.reqvecidx[row;`size;1;"rect"]; $[`r in key row; .p5.emit5["rect";xv;yv;wv;hv;row`r]; .p5.emit4["rect";xv;yv;wv;hv]]};',
  '.p5.rectrows:{[t] {.p5.rectrow x} each t;::};',
  '.p5.linerow:{[row] .p5.applycolor[row;0b;1b]; x1:.p5.reqvecidx[row;`p1;0;"line"]; y1:.p5.reqvecidx[row;`p1;1;"line"]; x2:.p5.reqvecidx[row;`p2;0;"line"]; y2:.p5.reqvecidx[row;`p2;1;"line"]; .p5.emit4["line";x1;y1;x2;y2]};',
  '.p5.linerows:{[t] {.p5.linerow x} each t;::};',
  '.p5.ellipserow:{[row] .p5.applycolor[row;1b;0b]; xv:.p5.reqvecidx[row;`p;0;"ellipse"]; yv:.p5.reqvecidx[row;`p;1;"ellipse"]; wv:.p5.reqvecidx[row;`size;0;"ellipse"]; hv:.p5.reqvecidx[row;`size;1;"ellipse"]; .p5.emit4["ellipse";xv;yv;wv;hv]};',
  '.p5.ellipserows:{[t] {.p5.ellipserow x} each t;::};',
  '.p5.trianglerow:{[row] .p5.applycolor[row;1b;0b]; .p5.emit6["triangle"; .p5.reqvecidx[row;`p1;0;"triangle"]; .p5.reqvecidx[row;`p1;1;"triangle"]; .p5.reqvecidx[row;`p2;0;"triangle"]; .p5.reqvecidx[row;`p2;1;"triangle"]; .p5.reqvecidx[row;`p3;0;"triangle"]; .p5.reqvecidx[row;`p3;1;"triangle"]]};',
  '.p5.trianglerows:{[t] {.p5.trianglerow x} each t;::};',
  '.p5.pointrow:{[row] .p5.applycolor[row;0b;1b]; .p5.emit2["point"; .p5.reqvecidx[row;`p;0;"point"]; .p5.reqvecidx[row;`p;1;"point"]]};',
  '.p5.pointrows:{[t] {.p5.pointrow x} each t;::};',
  '.p5.textrow:{[row] .p5.applycolor[row;1b;0b]; tv:.p5.req[row;`txt;enlist `text;"text"]; xv:.p5.reqvecidx[row;`p;0;"text"]; yv:.p5.reqvecidx[row;`p;1;"text"]; .p5.emit3["text";tv;xv;yv]};',
  '.p5.textrows:{[t] {.p5.textrow x} each t;::};',
  '.p5createcanvas:{[w;h] .p5.emit2["createCanvas";w;h]};',
  '.p5resizecanvas:{[w;h] .p5.emit2["resizeCanvas";w;h]};',
  '.p5framerate:{[f] .p5.emit1["frameRate";f]};',
  '.p5background:{[x] xs:$[(1<count x) and ((type x)>0h) and ((type x)<20h);x;.p5.aslist x]; n:count xs; if[1=n; :.p5.emit1["background";xs 0]]; if[2=n; :.p5.emit2["background";xs 0;xs 1]]; if[3=n; :.p5.emit3["background";xs 0;xs 1;xs 2]]; \' "background expects 1-3 args"};',
  '.p5clear:{[] .p5.emit0["clear"]};',
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
  '.p5.fromret:{[r] if[0h<>type r; :()]; if[0=count r; :()]; if[0h=type first r; :r]; if[10h=type first r; :enlist r]; :()};',
  '.p5.setstate:{[sid;r] if[104h=type r; :()]; if[0h=type r; if[0<count r; if["error"~first r; :r]]]; if[.p5.istable r; .p5.sset[sid;`state;$[99h=type r;value r;r]]; :()]; if[0<count .p5.sget[sid;`cmds]; :()]; ("error";"state must be a table")};',
  '.p5.runsetup:{[sid;doc] .p5.ensuresession sid; priorSession:.p5.currentSession; .p5.begin[sid;`setup]; .p5.reset[]; .p5.clearstate[sid]; .p5.setdocument[sid;doc]; setupFn:.p5.sget[sid;`setup]; r:@[setupFn;doc;{("error";string x)}]; if[0h=type r; if[0<count r; if["error"~first r; r0:@[setupFn;();{("error";string x)}]; if[(104h<>type r0) and not ("error"~first r0); r:r0]]]]; .p5.finish priorSession; if[0h=type r; if[0<count r; if["error"~first r; :r]]]; sr:.p5.setstate[sid;r]; if[0h=type sr; if[0<count sr; if["error"~first sr; :sr]]]; if[0=count .p5.sget[sid;`cmds]; : .p5.fromret r]; .p5.sget[sid;`cmds]};',
  '.p5.rundraw:{[sid;input;doc] .p5.ensuresession sid; priorSession:.p5.currentSession; .p5.begin[sid;`draw]; .p5.reset[]; .p5.setdocument[sid;doc]; drawFn:.p5.sget[sid;`draw]; st:.p5.sget[sid;`state]; r:.[drawFn;(st;input;doc);{("error";string x)}]; if[0h=type r; if[0<count r; if["error"~first r; r1:.[drawFn;(st;input);{("error";string x)}]; if[(104h<>type r1) and not ("error"~first r1); r:r1]]]]; if[0h=type r; if[0<count r; if["error"~first r; r2:.[drawFn;enlist input;{("error";string x)}]; if[(104h<>type r2) and not ("error"~first r2); r:r2]]]]; if[0h=type r; if[0<count r; if["error"~first r; r3:@[drawFn;();{("error";string x)}]; if[(104h<>type r3) and not ("error"~first r3); r:r3]]]]; .p5.finish priorSession; if[0h=type r; if[0<count r; if["error"~first r; :r]]]; sr:.p5.setstate[sid;r]; if[0h=type sr; if[0<count sr; if["error"~first sr; :sr]]]; if[0=count .p5.sget[sid;`cmds]; : .p5.fromret r]; .p5.sget[sid;`cmds]};',
  '.p5.dispatch:{[id;fn] r:@[fn;();{("error";string x)}]; -1 .j.j (`id`result!(id;r))};'
].join('\n');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
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

function qFloatPair(value, fallbackA = 0, fallbackB = 0) {
  const pair = Array.isArray(value) ? value : [];
  return `(${qFloat(pair[0], fallbackA)};${qFloat(pair[1], fallbackB)})`;
}

function normalizeWireInput(raw, frame = 0) {
  if (Array.isArray(raw)) {
    const keys = Array.isArray(raw[6]) ? raw[6] : [];
    return {
      mx: raw[0],
      my: raw[1],
      pmx: raw[2],
      pmy: raw[3],
      mousePressed: raw[4],
      mouseButton: raw[5],
      keysDown: keys,
      key: raw[7],
      keyCode: raw[8],
      keyPressed: raw[9],
      keyReleased: raw[10],
      wheelDelta: raw[11],
      ts: raw[12],
      tick: frame
    };
  }

  return raw && typeof raw === 'object' ? raw : {};
}

function normalizeWireDocument(raw) {
  if (Array.isArray(raw)) {
    return {
      c: [raw[0], raw[1]],
      v: [raw[2], raw[3]],
      d: [raw[4], raw[5]],
      s: [raw[6], raw[7]],
      cw: raw[0],
      ch: raw[1],
      vw: raw[2],
      vh: raw[3],
      dw: raw[4],
      dh: raw[5],
      sx: raw[6],
      sy: raw[7],
      dpr: raw[8],
      ts: raw[9]
    };
  }

  return raw && typeof raw === 'object' ? raw : {};
}

function qInputTableLiteral(raw, frame = 0) {
  const input = normalizeWireInput(raw, frame);
  const keys = Array.isArray(input.keysDown) ? input.keysDown : [];
  const keysExpr = keys.length ? `(${keys.map((k) => qSymbol(k)).join(';')})` : '()';
  const m = Array.isArray(input.m) ? input.m : [input.mx, input.my];
  const pm = Array.isArray(input.pm) ? input.pm : [input.pmx, input.pmy];
  const mx = input.mx ?? m[0];
  const my = input.my ?? m[1];
  const pmx = input.pmx ?? pm[0];
  const pmy = input.pmy ?? pm[1];
  const tick = input.tick ?? frame;
  const columns = '`tick`m`pm`mx`my`pmx`pmy`mousePressed`mouseButton`keysDown`key`keyCode`keyPressed`keyReleased`wheelDelta`ts';
  const values = [
    `enlist ${qInt(tick)}`,
    `enlist ${qFloatPair(m)}`,
    `enlist ${qFloatPair(pm)}`,
    `enlist ${qFloat(mx)}`,
    `enlist ${qFloat(my)}`,
    `enlist ${qFloat(pmx)}`,
    `enlist ${qFloat(pmy)}`,
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
  const doc = normalizeWireDocument(raw);
  const c = Array.isArray(doc.c) ? doc.c : [doc.cw, doc.ch];
  const v = Array.isArray(doc.v) ? doc.v : [doc.vw, doc.vh];
  const d = Array.isArray(doc.d) ? doc.d : [doc.dw, doc.dh];
  const s = Array.isArray(doc.s) ? doc.s : [doc.sx, doc.sy];
  const cw = doc.cw ?? c[0];
  const ch = doc.ch ?? c[1];
  const vw = doc.vw ?? v[0];
  const vh = doc.vh ?? v[1];
  const dw = doc.dw ?? d[0];
  const dh = doc.dh ?? d[1];
  const sx = doc.sx ?? s[0];
  const sy = doc.sy ?? s[1];
  const columns = '`c`v`d`s`cw`ch`vw`vh`dw`dh`sx`sy`dpr`ts';
  const values = [
    `enlist ${qFloatPair(c)}`,
    `enlist ${qFloatPair(v)}`,
    `enlist ${qFloatPair(d)}`,
    `enlist ${qFloatPair(s)}`,
    `enlist ${qFloat(cw)}`,
    `enlist ${qFloat(ch)}`,
    `enlist ${qFloat(vw)}`,
    `enlist ${qFloat(vh)}`,
    `enlist ${qFloat(dw)}`,
    `enlist ${qFloat(dh)}`,
    `enlist ${qFloat(sx)}`,
    `enlist ${qFloat(sy)}`,
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

function extractQContextLine(stderrText) {
  const lines = String(stderrText || '').split('\n');
  for (const line of lines) {
    const match = line.match(/\[\d+\]\s+(.*)$/);
    if (!match) {
      continue;
    }
    const snippet = match[1].trimEnd();
    if (!snippet || snippet.startsWith('\\l ')) {
      continue;
    }
    return snippet;
  }
  return '';
}

function findSnippetLineNumber(source, snippet) {
  const wanted = String(snippet || '').trim();
  if (!wanted) {
    return null;
  }

  const lines = String(source || '').split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed === wanted || raw.includes(wanted) || wanted.includes(trimmed)) {
      hits.push(i + 1);
    }
  }

  return hits.length === 1 ? hits[0] : null;
}

function formatCodeFrame(source, targetLine, context = 2) {
  const lines = String(source || '').split('\n');
  if (!Number.isInteger(targetLine) || targetLine < 1 || targetLine > lines.length) {
    return '';
  }

  const start = Math.max(1, targetLine - context);
  const end = Math.min(lines.length, targetLine + context);
  const width = String(end).length;
  return lines
    .slice(start - 1, end)
    .map((line, idx) => {
      const lineNo = start + idx;
      const marker = lineNo === targetLine ? '>' : ' ';
      return `${marker} ${String(lineNo).padStart(width, ' ')} | ${line}`;
    })
    .join('\n');
}

function formatSketchLoadError({ code, loadStderr, parserStderr, missingSetup, missingDraw }) {
  const issues = [];
  if (missingSetup) {
    issues.push('setup not loaded');
  }
  if (missingDraw) {
    issues.push('draw not loaded');
  }

  const detailText = String(parserStderr || loadStderr || '').trim();
  const contextLine = extractQContextLine(detailText);
  const lineNumber = findSnippetLineNumber(code, contextLine);
  const frame = formatCodeFrame(code, lineNumber);
  const parts = [];

  parts.push(
    issues.length
      ? `${issues.join(' and ')} because the sketch failed to load. This usually means a syntax error or top-level evaluation error.`
      : 'The sketch failed to load. This usually means a syntax error or top-level evaluation error.'
  );

  if (lineNumber) {
    parts.push(`Likely source near line ${lineNumber}:\n${frame}`);
  } else if (contextLine) {
    parts.push(`Likely source snippet:\n${contextLine}`);
  }

  if (detailText) {
    parts.push(`q reported:\n${detailText}`);
  }

  parts.push('Check brackets, semicolons, and any top-level expressions that run before `setup`/`draw` are assigned.');
  return parts.join('\n\n');
}

async function captureQParserDiagnostics(code, qSpawn = getQSpawnSpec()) {
  const source = String(code || '').trim();
  if (!source) {
    return '';
  }

  let proc;
  try {
    proc = spawn(qSpawn.command, qSpawn.args, {
      cwd: getRuntimeCwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    });
  } catch (error) {
    return formatQSpawnError(error, qSpawn);
  }

  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  let stderr = '';
  proc.once('error', (error) => {
    stderr = formatQSpawnError(error, qSpawn);
  });
  proc.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const exited = new Promise((resolve) => {
    proc.once('exit', resolve);
  });

  proc.stdin.write(`${source}\n\\\\\n`);

  const killTimer = setTimeout(() => {
    if (proc.exitCode == null) {
      proc.kill('SIGTERM');
    }
  }, Math.max(250, Q_LOAD_SETTLE_MS * 3));

  await exited.catch(() => {});
  clearTimeout(killTimer);
  return stderr.trim();
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

function splitTopLevelStatementsDetailed(code) {
  const src = String(code || '');
  const out = [];
  let cur = '';
  let inString = false;
  let braces = 0;
  let brackets = 0;
  let parens = 0;
  let line = 1;
  let stmtStartLine = 1;
  let sawNonWhitespace = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (!sawNonWhitespace && !/\s/.test(ch)) {
      stmtStartLine = line;
      sawNonWhitespace = true;
    }
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
        out.push({ text: stmt, startLine: stmtStartLine, endLine: line });
      }
      cur = '';
      sawNonWhitespace = false;
    }

    if (ch === '\n') {
      line += 1;
    }
  }

  if (inString || braces !== 0 || brackets !== 0 || parens !== 0) {
    throw new Error('unbalanced function definition');
  }

  const tail = cur.trim();
  if (tail) {
    out.push({ text: tail, startLine: sawNonWhitespace ? stmtStartLine : line, endLine: line });
  }

  return out;
}

function splitTopLevelStatements(code) {
  return splitTopLevelStatementsDetailed(code).map((entry) => entry.text);
}

function formatCodeRange(source, startLine, endLine) {
  const lines = String(source || '').split('\n');
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
    return '';
  }

  const safeEnd = Math.min(endLine, lines.length);
  const width = String(safeEnd).length;
  return lines
    .slice(startLine - 1, safeEnd)
    .map((line, idx) => `${String(startLine + idx).padStart(width, ' ')} | ${line}`)
    .join('\n');
}

function findTopLevelFunctionSource(code, fnName) {
  let statements;
  try {
    statements = splitTopLevelStatementsDetailed(code);
  } catch {
    return null;
  }

  const pattern = new RegExp(`^\\s*${fnName}\\s*:\\s*\\{`);
  return statements.find((stmt) => pattern.test(stmt.text)) || null;
}

function listTopLevelFunctions(code) {
  let statements;
  try {
    statements = splitTopLevelStatementsDetailed(code);
  } catch {
    return new Map();
  }

  const out = new Map();
  for (const stmt of statements) {
    const m = stmt.text.match(/^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*:\s*\{/);
    if (m) {
      out.set(m[1], stmt);
    }
  }
  return out;
}

function extractCalledFunctionNames(sourceText) {
  const src = String(sourceText || '');
  const out = [];
  const re = /\b([A-Za-z_][A-Za-z0-9_.]*)\s*\[/g;
  let m = re.exec(src);
  while (m) {
    out.push(m[1]);
    m = re.exec(src);
  }
  return Array.from(new Set(out));
}

function formatPhaseRuntimeError(phase, detail, code) {
  const message = String(detail || 'q runtime error').trim();
  const parts = [`Runtime error in ${phase}: ${message}`];
  const fnMap = listTopLevelFunctions(code);
  const fnStmt = fnMap.get(phase) || findTopLevelFunctionSource(code, phase);
  if (fnStmt) {
    parts.push(`Active ${phase} definition:\n${formatCodeRange(code, fnStmt.startLine, fnStmt.endLine)}`);
    const genericSymbol = /^[A-Za-z][A-Za-z0-9_]*$/.test(message);
    if (genericSymbol) {
      const helperNames = extractCalledFunctionNames(fnStmt.text)
        .filter((name) => name !== phase && name !== 'setup' && name !== 'draw' && fnMap.has(name))
        .slice(0, 3);
      for (const helperName of helperNames) {
        const helperStmt = fnMap.get(helperName);
        if (helperStmt) {
          parts.push(
            `Referenced helper ${helperName} definition:\n${formatCodeRange(code, helperStmt.startLine, helperStmt.endLine)}`
          );
        }
      }
    }
  }
  return parts.join('\n\n');
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
  ['scale', '.p5scale']
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

class QWorker {
  constructor(id, getSpawnSpec = () => getQSpawnSpec()) {
    this.id = id;
    this.getSpawnSpec = getSpawnSpec;
    this.proc = null;
    this.qSpawn = null;
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.pending = new Map();
    this.nextId = 1;
    this.stdoutListeners = new Map();
    this.activeStdoutSession = null;
    this.poisoned = false;
    this.runCount = 0;
    this.taskQueue = Promise.resolve();
    this.activeSessions = new Set();
  }

  enqueue(task, sessionId = null) {
    const run = async () => {
      const prevSession = this.activeStdoutSession;
      this.activeStdoutSession = sessionId;
      try {
        return await task();
      } finally {
        this.activeStdoutSession = prevSession;
      }
    };

    const next = this.taskQueue.then(run, run);
    this.taskQueue = next.catch(() => {});
    return next;
  }

  attachSession(sessionId, onStdoutLine) {
    this.activeSessions.add(sessionId);
    this.stdoutListeners.set(sessionId, onStdoutLine);
  }

  async detachSession(sessionId) {
    this.activeSessions.delete(sessionId);
    this.stdoutListeners.delete(sessionId);
    await this.enqueue(async () => {
      if (!this.proc) {
        return;
      }
      await this.invoke(`.p5.delsession[${qSymbol(sessionId)}]`).catch(() => {});
      if (this.activeSessions.size === 0 && this.poisoned) {
        await this.close();
      }
    }, sessionId);
  }

  async start() {
    const tmpDir = getTmpDir();
    await fsp.mkdir(tmpDir, { recursive: true });
    await pruneTmpDir();
    this.qSpawn = this.getSpawnSpec();
    let proc;
    try {
      proc = spawn(this.qSpawn.command, this.qSpawn.args, {
        cwd: getRuntimeCwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });
    } catch (error) {
      throw new Error(formatQSpawnError(error, this.qSpawn));
    }
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

    proc.on('error', (error) => {
      const wrapped = new Error(formatQSpawnError(error, this.qSpawn));
      this.poisoned = true;
      for (const { reject } of this.pending.values()) {
        reject(wrapped);
      }
      this.pending.clear();
      if (this.proc === proc) {
        this.proc = null;
      }
    });

    proc.on('exit', () => {
      this.poisoned = true;
      for (const { reject } of this.pending.values()) {
        reject(new Error('q process exited'));
      }
      this.pending.clear();
      if (this.proc === proc) {
        this.proc = null;
      }
    });

    proc.stdin.write(`${RUNTIME_BOOT}\n`);
    this.poisoned = false;
    this.runCount = 0;
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

      if (!handledProtocol && trimmed) {
        const listener = this.activeStdoutSession ? this.stdoutListeners.get(this.activeStdoutSession) : null;
        if (typeof listener === 'function') {
          listener(line);
        }
      }

      idx = this.stdoutBuffer.indexOf('\n');
    }
  }

  async ensureFreshProcess() {
    const shouldRecycleForAge =
      this.runCount >= Q_MAX_RUNS_PER_SESSION && this.activeSessions.size === 0;

    if (!this.proc || this.poisoned || shouldRecycleForAge) {
      await this.close();
      this.stdoutBuffer = '';
      this.stderrBuffer = '';
      this.pending.clear();
      this.nextId = 1;
      await this.start();
    }
  }

  async resetAndLoad(sessionId, code) {
    return this.enqueue(async () => {
      await this.ensureFreshProcess();

      const sketchId = crypto.randomBytes(8).toString('hex');
      const sketchPath = path.join(getTmpDir(), `sketch-${sketchId}.q`);
      const rewritten = preprocessSketchCode(code);
      const runNamespace = `.p5run${sketchId}`;
      const sessionExpr = qSymbol(sessionId);
      await this.invoke(`.p5.preparerun[${sessionExpr}]`);
      const wrapped = [
        `.p5.ensuresession[${sessionExpr}];`,
        `\\d ${runNamespace}`,
        rewritten,
        `.[\`.p5.sessions;(${sessionExpr};\`setup);:;setup];`,
        `.[\`.p5.sessions;(${sessionExpr};\`draw);:;draw];`,
        `.[\`.p5.sessions;(${sessionExpr};\`runId);:;${qString(sketchId)}];`,
        '\\d .'
      ].join('\n');
      await fsp.writeFile(sketchPath, `${wrapped}\n`, 'utf8');
      this.stderrBuffer = '';
      this.proc.stdin.write(`\\l ${toQLoadPath(sketchPath, this.qSpawn)}\n`);
      await new Promise((resolve) => setTimeout(resolve, Q_LOAD_SETTLE_MS));
      const loadStderr = this.stderrBuffer.trim();
      const loadState = await this.invoke(
        `(${qString(sketchId)}~.p5.sget[${sessionExpr};\`runId];.p5.sget[${sessionExpr};\`setup]~.p5.emptysetup;.p5.sget[${sessionExpr};\`draw]~.p5.emptydraw)`
      );
      const loaded = Array.isArray(loadState) ? Boolean(loadState[0]) : false;
      const missingSetup = Array.isArray(loadState) ? Boolean(loadState[1]) : true;
      const missingDraw = Array.isArray(loadState) ? Boolean(loadState[2]) : true;
      this.stderrBuffer = '';
      if (!loaded || missingSetup || missingDraw) {
        const parserStderr = await captureQParserDiagnostics(code, this.qSpawn).catch(() => '');
        throw new Error(formatSketchLoadError({ code, loadStderr, parserStderr, missingSetup, missingDraw }));
      }
      this.runCount += 1;
    }, sessionId);
  }

  async runSetup(sessionId, documentExpr) {
    return this.enqueue(async () => this.invoke(`.p5.runsetup[${qSymbol(sessionId)};${documentExpr}]`), sessionId);
  }

  async runDraw(sessionId, inputExpr, documentExpr) {
    return this.enqueue(
      async () => this.invoke(`.p5.rundraw[${qSymbol(sessionId)};${inputExpr};${documentExpr}]`),
      sessionId
    );
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
        this.poisoned = true;
        reject(new Error('Timed out waiting for q response'));
      }, Q_INVOKE_TIMEOUT_MS);

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
    const proc = this.proc;
    if (!proc) {
      return;
    }

    this.proc = null;
    await new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };

      proc.once('exit', finish);
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (proc.exitCode == null) {
          proc.kill('SIGKILL');
        }
        finish();
      }, Q_CLOSE_TIMEOUT_MS);
    });
  }
}

class QWorkerPool {
  constructor(size, getSpawnSpec = () => getQSpawnSpec()) {
    this.workers = Array.from({ length: Math.max(1, size) }, (_, i) => new QWorker(i, getSpawnSpec));
  }

  pickWorker() {
    return this.workers.reduce((best, worker) => {
      if (!best) {
        return worker;
      }
      if (worker.activeSessions.size < best.activeSessions.size) {
        return worker;
      }
      return best;
    }, null);
  }

  async close() {
    await Promise.all(this.workers.map((worker) => worker.close().catch(() => {})));
  }
}

function serveStatic(req, res, getRuntimeStatus = null) {
  const requestPath = (req.url || '/').split('?')[0];
  if (requestPath === '/desktop-runtime-status') {
    const status = typeof getRuntimeStatus === 'function' ? getRuntimeStatus() : null;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(status || null));
    return;
  }
  const cleanPath = requestPath === '/' ? '/index.html' : requestPath;
  const baseDir = cleanPath.startsWith('/vendor/') ? VENDOR_DIR : PUBLIC_DIR;
  const relativePath = cleanPath.startsWith('/vendor/') ? cleanPath.replace(/^\/vendor/, '') : cleanPath;
  const filePath = path.join(baseDir, relativePath);

  if (!filePath.startsWith(baseDir)) {
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

function startServer(options = {}) {
  const port = options.port == null ? Number(process.env.PORT || PORT) : Number(options.port);
  const runtimeStatusRef = { current: options.runtimeStatus || null };
  const server = http.createServer((req, res) => serveStatic(req, res, () => runtimeStatusRef.current));
  const wss = new WebSocketServer({ server, path: '/ws' });
  const getSpawnSpec = () => getQSpawnSpec(options.qBinary);
  const workerPool = new QWorkerPool(Q_WORKER_POOL_SIZE, getSpawnSpec);

  wss.on('connection', async (ws) => {
    const sessionId = crypto.randomBytes(12).toString('hex');
    const worker = workerPool.pickWorker();
    let running = false;
    let activeCode = '';
    let messageQueue = Promise.resolve();
    worker.attachSession(sessionId, (line) => {
      sendJson(ws, { type: 'stdout', line });
    });

    ws.on('message', (raw) => {
      messageQueue = messageQueue
        .then(async () => {
          let msg;
          let phase = null;
          let phaseCode = activeCode;
          try {
            msg = JSON.parse(raw.toString('utf8'));
          } catch {
            return;
          }

          try {
            if (msg.type === 'run') {
              running = false;
              const mergedCode = combineRunCode(msg.code || '', msg.files || []);
              phaseCode = mergedCode;
              await worker.resetAndLoad(sessionId, mergedCode);
              const docTableExpr = qDocumentTableLiteral(msg.document);
              phase = 'setup';
              const setupResult = await worker.runSetup(sessionId, docTableExpr);
              const setupError = toRuntimeError(setupResult);
              if (setupError) {
                throw new Error(formatPhaseRuntimeError('setup', setupError.message, mergedCode));
              }
              const setupCommands = normalizeCommands(setupResult);
              activeCode = mergedCode;
              running = true;
              sendJson(ws, { type: 'runResult', ok: true, setup: setupCommands });
            }

            if (msg.type === 'step' && running) {
              const frame = Number(msg.frame || 0);
              const inputTableExpr = qInputTableLiteral(msg.input, frame);
              const docTableExpr = qDocumentTableLiteral(msg.document);
              phase = 'draw';
              const stepResult = await worker.runDraw(sessionId, inputTableExpr, docTableExpr);
              const stepError = toRuntimeError(stepResult);
              if (stepError) {
                throw new Error(formatPhaseRuntimeError('draw', stepError.message, activeCode));
              }
              const commands = normalizeCommands(stepResult);
              sendJson(ws, { type: 'stepResult', frame, commands });
            }

            if (msg.type === 'stop') {
              running = false;
              sendJson(ws, { type: 'stopped' });
            }
          } catch (err) {
            const message =
              phase && !String(err?.message || '').includes(`Runtime error in ${phase}:`)
                ? formatPhaseRuntimeError(phase, err?.message, phaseCode)
                : String(err?.message || 'q runtime error');
            sendJson(ws, { type: 'runtimeError', message });
          }
        })
        .catch(() => {});
    });

    ws.on('close', async () => {
      running = false;
      await worker.detachSession(sessionId);
    });
  });

  const listening = new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      const actualPort = address && typeof address === 'object' ? address.port : port;
      resolve(actualPort);
    });
  });

  return {
    server,
    wss,
    workerPool,
    listening,
    setRuntimeStatus(nextStatus) {
      runtimeStatusRef.current = nextStatus || null;
    },
    async close() {
      await new Promise((resolve) => {
        wss.close(() => resolve());
        for (const client of wss.clients) {
          client.terminate();
        }
      }).catch(() => {});

      await new Promise((resolve) => server.close(() => resolve())).catch(() => {});
      await workerPool.close();
    }
  };
}

if (require.main === module) {
  const controller = startServer();
  controller.listening.then((port) => {
    console.log(`Qanvas5 editor listening on http://localhost:${port}`);
  });
}

module.exports = {
  startServer
};
