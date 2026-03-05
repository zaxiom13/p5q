# p5q

A lightweight p5.js-style editor where sketches are written in kdb+/q and rendered in the browser via p5.js commands.

## Current Features

- Browser editor + preview canvas + output console.
- Pooled q workers over websocket with per-session runtime isolation.
- `setup[document]` / `draw[state;input;document]` sketch contract.
- Multi-tab workspace:
  - 1 main tab (`Sketch.q`)
  - N helper tabs (function definitions only)
- Built-in examples:
  - `Bouncing Dots` (default)
  - `Default Orbit`
  - `Particle Fountain`
- q syntax highlighting in Monaco (Scott Logic boothroyd syntax base).
- Demo videos embedded in this README.

## Sketch Contract

Main tab must define:

- `setup[document]` -> returns a **table** state.
- `draw[state;input;document]` -> returns next **table** state.

`input` is a one-row table snapshot each frame with mouse/keyboard fields:

- `mx`, `my`, `pmx`, `pmy`, `mousePressed`, `mouseButton`, `keysDown`, `key`, `keyCode`, `keyPressed`, `keyReleased`, `wheelDelta`

`document` is a separate one-row table provided to both `setup` and `draw`:

- `cw`, `ch`, `vw`, `vh`, `dw`, `dh`, `sx`, `sy`, `dpr`, `ts`

Helper tabs:

- Must contain only function definitions, e.g. `foo:{[x] ... };`
- Are loaded before the main sketch.
- Can be used by both `setup` and `draw`.
- Cannot define `setup` or `draw`.

## API (Current)

- Canvas/frame: `createCanvas`, `resizeCanvas`, `frameRate`, `background`, `clear`
- Style: `fill`, `noFill`, `stroke`, `noStroke`, `strokeWeight`
- Shapes (table-only): `line`, `rect`, `circle`, `ellipse`, `triangle`, `point`
- Text (table-only): `text`, `textSize`, `textAlign`, `textFont`
- Transform/state: `push`, `pop`, `translate`, `rotate`, `scale`
- Utilities: `random`, `map`, `constrain`, `sin`, `cos`

## Important Rules

- Draw primitives are table-only (`line`, `rect`, `circle`, `ellipse`, `triangle`, `point`, `text`).
- Animation is manual (state + modular indexing), no built-in animate API.
- Runtime state must always be a q table.

## Run

Prereqs: `node`, `npm`, and local `q` binary on PATH.

```bash
npm install
npm start
```

Open: [http://localhost:5173](http://localhost:5173)

Runtime pool sizing:

- `P5Q_WORKER_POOL_SIZE=1` keeps a single shared q worker.
- Increase `P5Q_WORKER_POOL_SIZE` to allow more concurrent sketches at the cost of more q processes.

## Test

```bash
npm test
```

Tests live in `test/`.

## Demo Recording

Playwright recording setup is included.

```bash
npx playwright install chromium
npm run demo:record
```

Headed mode:

```bash
npm run demo:record:headed
```

## Demo Videos

<video src="./docs/demos/bouncing-dots.mp4" controls muted playsinline width="900"></video>

<video src="./docs/demos/particle-fountain.mp4" controls muted playsinline width="900"></video>

## Project Notes

- Backend is intentionally thin: static file server + websocket bridge + pooled q workers.
- Each websocket session gets its own sketch state inside q and is routed to one worker for its lifetime.
- Sessions sharing a worker are serialized inside that worker, so state stays isolated but CPU-heavy sketches can still block each other.
- Frontend applies returned command IR directly against p5.
- See [docs/runtime-architecture.md](./docs/runtime-architecture.md) for the current runtime sketch.
