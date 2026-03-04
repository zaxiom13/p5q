# p5q editor

A lightweight p5.js-style sketch editor where sketch code is written in kdb+/q.

## What it does

- Browser editor + canvas preview + console, inspired by the p5.js editor flow.
- Very small Node backend: static file serving + websocket bridge.
- Per-client `q` session for evaluating `setup[]` and `draw[state;input]`.
- Frontend drives frames over websocket, sends input snapshots, and renders commands using p5.js.
- Multi-tab workspace: one main tab (`Sketch.q`) plus helper tabs.

## Sketch format (q)

Your main sketch defines two functions:

- `setup[]`: executes setup calls and returns initial state table
- `draw[state;input]`: executes per-frame calls and returns updated state

Helper tabs:

- Must contain only function definitions (`name:{...};`)
- Are loaded before the main tab
- Can be called from both `setup` and `draw`
- Cannot redefine `setup` or `draw`

Example:

```q
setup:{
  createCanvas[640;360];
  frameRate[30];
  textSize[14];
  circles:([] x:120 220 320f; y:180 180 180f; d:24 30 36f; fillR:235 235 235i; fillG:94 140 200i; fillB:40 80 120i);
  ([] count:enlist 0i; circles:enlist circles)
};

draw:{[state;input]
  mx:first input[`mx];
  circles:first state[`circles];
  i:first state[`count] mod count circles;
  background[16;18;24];
  circle[circles enlist i];
  text[([] txt:("mx:"; string mx); x:20 70f; y:28 28f; fillR:245 235i; fillG:245 120i; fillB:245 40i)];
  rect[([] x:18 18f; y:42 42f; w:120 120f; h:4 4f)];
  triangle[([] x1:enlist 150f; y1:enlist 44f; x2:enlist 166f; y2:enlist 36f; x3:enlist 166f; y3:enlist 52f)];
  update count:count+1i from state
};
```

Table vectorization is supported for shapes and text:

```q
t:([] x:80 140 200f; y:180 180 180f; d:24 30 36f);
circle[t]

labels:([] txt:("a";"b"); x:20 60f; y:20 20f; fillR:255 40i; fillG:255 200i; fillB:255 80i);
text[labels]
```

All draw primitives are table-only: `line`, `rect`, `circle`, `ellipse`, `triangle`, `point`, and `text`.

Animation pattern (manual tick + modular index):

```q
setup:{
  t:([] x:80 140 200f; y:180 180 180f; d:24 30 36f);
  ([] tick:enlist 0i; circles:enlist t)
};

draw:{[state;input]
  circles:first state[`circles];
  i:first state[`tick] mod count circles;
  circle[circles enlist i];
  update tick:tick+1i from state
};
```

## API glossary

- Canvas/frame: `createCanvas`, `resizeCanvas`, `frameRate`, `background`, `clear`
- Style: `fill`, `noFill`, `stroke`, `noStroke`, `strokeWeight`
- Shapes (table-only): `line`, `rect`, `circle`, `ellipse`, `triangle`, `point`
- Text (table-only): `text`, `textSize`, `textAlign`, `textFont`
- Transform/state: `push`, `pop`, `translate`, `rotate`, `scale`
- Utilities: `random`, `map`, `constrain`, `sin`, `cos`

## Run

Prereqs: `node`, `npm`, and local `q` binary available on PATH.

```bash
npm install
npm start
```

Then open `http://localhost:5173`.

## Notes

- This keeps backend logic intentionally minimal.
- Websocket flow is intentionally simple and close to the KX/websocket interaction style (frontend sends expressions/events, backend replies with evaluated results).
