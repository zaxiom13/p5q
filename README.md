# Qanvas5 Studio

A desktop-first p5.js-style editor where sketches are written in kdb+/q and rendered locally through p5.js commands.

## Current Features

- Electron desktop shell with no visible terminal window.
- In-app KDB-X setup assistant with platform guides and runtime auto-detection.
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

- Frame: `tick`
- Packed: `m`, `pm`
- Split aliases: `mx`, `my`, `pmx`, `pmy`
- Other fields: `mousePressed`, `mouseButton`, `keysDown`, `key`, `keyCode`, `keyPressed`, `keyReleased`, `wheelDelta`

`document` is a separate one-row table provided to both `setup` and `draw`:

- Packed: `c`, `v`, `d`, `s`
- Split aliases: `cw`, `ch`, `vw`, `vh`, `dw`, `dh`, `sx`, `sy`
- Other fields: `dpr`, `ts`

Helper tabs:

- Must contain only function definitions, e.g. `foo:{[x] ... };`
- Are loaded before the main sketch.
- Can be used by both `setup` and `draw`.
- Cannot define `setup` or `draw`.

## API (Current)

- Canvas/frame: `createCanvas`, `resizeCanvas`, `frameRate`, `background`, `clear`
- Shapes (table-only): `line`, `rect`, `circle`, `ellipse`, `triangle`, `point`
- Text (table-only): `text`, `textSize`, `textAlign`, `textFont`
- Transform/state: `push`, `pop`, `translate`, `rotate`, `scale`

## Important Rules

- Draw primitives are table-only (`line`, `rect`, `circle`, `ellipse`, `triangle`, `point`, `text`).
- Packed vector columns are the primitive contract: use `p` for `[x y]`, `v` for `[vx vy]`, `size` for `[w h]`, `p1`/`p2`/`p3` for vertices, and `fill`/`stroke` for `[r g b]` or `[r g b a]`.
- Styling belongs in primitive tables. Use `fill`, `stroke`, and `strokeWeight` columns there instead of calling standalone style functions.
- Component-wise primitive aliases like `x`, `y`, `w`, `h`, `x1`, `y1`, `diameter`, `fillR`, and `strokeR` are not supported.
- Use q built-ins directly for math and utility work instead of Qanvas5 wrapper helpers.
- Use `input[\`tick]` for frame-based animation instead of storing your own tick counter in state.
- Runtime state must always be a q table.

## Run

Desktop app:

```bash
npm install
npm start
```

Desktop runtime options:

- `npm start` now prefers **Electrobun** when `bunx` is installed.
- If Bun/Electrobun is unavailable, it automatically falls back to Electron.
- Force runtime selection with:
  - `npm run start:electrobun`
  - `npm run start:electron`
  - `QANVAS5_DESKTOP_RUNTIME=electron npm start` (or `electrobun`)

Browser-only dev server:

```bash
npm run start:web
```

The desktop app embeds the local server and exposes a Setup tab that helps users:

- open the current KDB-X product/download/docs pages,
- auto-detect a local `q` binary on macOS/Linux,
- use WSL-backed `q` on Windows,
- save the linked runtime so future launches are ready without terminal setup.

## Package Desktop Builds

```bash
npm run dist
```

## GitHub Releases

This repo now supports automated GitHub Releases for desktop downloads.

1. Push a version tag such as `v0.2.0`
2. GitHub Actions builds release assets for:
   - macOS universal (`dmg`, `zip`)
   - Windows x64 + arm64 (`nsis`, `portable`)
   - Linux x64 and arm64 (`AppImage`, `tar.gz`)
3. The workflow uploads them to the repo's Releases page

Workflow file:

- [.github/workflows/release.yml](./.github/workflows/release.yml)
- [CHANGELOG.md](./CHANGELOG.md)

Important notes:

- macOS and Windows builds are unsigned by default, so users may still see OS trust warnings until you add code signing.
- GitHub Releases is the right place for installers and binaries. GitHub Pages is for websites/docs.

### Signing And Notarization Secrets

To enable trusted installs in GitHub Actions, add these repository secrets:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `CSC_LINK`
- `CSC_KEY_PASSWORD`

The workflow passes them to Electron Builder so:

- macOS builds can be signed and notarized
- Windows builds can be code signed

### Auto-Updates

The packaged desktop app now checks GitHub Releases for updates and can install a downloaded update from the Setup tab.

### Release Notes Templating

Release notes are now rendered from:

- [`CHANGELOG.md`](./CHANGELOG.md)
- [`scripts/render-release-notes.js`](./scripts/render-release-notes.js)

The GitHub Release workflow uses the matching changelog section for the pushed tag, so `v0.2.0` maps to `## [0.2.0]`.

Runtime pool sizing:

- `QANVAS5_WORKER_POOL_SIZE=1` keeps a single shared q worker.
- Increase `QANVAS5_WORKER_POOL_SIZE` to allow more concurrent sketches at the cost of more q processes.

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
