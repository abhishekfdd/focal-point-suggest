# Architecture

This document explains the load-bearing decisions in Focal Point
Suggest: where inference runs, how the pieces talk to each other, and
why the scope is what it is.

## The pipeline

Clicking **Suggest focal point** runs this chain:

```
suggestion-panel.js (UI state)
    │
    ▼
get-suggestion.js
    │  fetch(url) without cross-origin credentials → ImageBitmap
    ▼
detect-subjects.js ── postMessage(bitmap, transfer) ──▶ worker.js
    │                                                     │ MediaPipe FaceDetector
    │ ◀───────────── [ { box, confidence } ] ─────────────┘ (WASM, OffscreenCanvas)
    ▼
heuristic/focal-point.js  →  { x, y } normalized, or null
    │
    ▼
UI preview → user accepts → block attribute + attachment meta
```

Each arrow is a narrow, typed contract, which is what makes the parts
independently replaceable and testable.

## Why local WASM instead of a cloud API

- **Privacy is structural, not a policy.** Draft media never leaves the
  browser. There is no consent banner to write because there is nothing
  to consent to.
- **No keys, no costs, no rate limits.** The plugin works on any host
  with zero configuration, including offline/air-gapped installs — the
  model and WASM runtime ship with the plugin and are served
  same-origin.
- **Fast enough.** BlazeFace short-range is a ~230 KB model built for
  real-time use; a single editor-sized image is comfortably interactive
  on CPU. The Cache API keeps the one-time ~10 MB WASM runtime download
  from ever repeating.

## Why a Web Worker (and OffscreenCanvas)

WASM inference is CPU-bound. Run on the main thread it would freeze the
block editor — typing, dragging, autosave — for the duration of every
detection. So the detector lives in a worker:

- The decoded `ImageBitmap` is **transferred** (zero-copy), not cloned.
- MediaPipe renders into an `OffscreenCanvas` inside the worker, so no
  DOM access is needed.
- The editor bundle stays small: MediaPipe is bundled only into the
  worker chunk, which the browser fetches lazily on first use.

A worker also can't touch `@wordpress/*` globals, which enforces a clean
boundary: the worker speaks a tiny message protocol (`init`, `detect` /
`result`, `error`) and returns plain data. Error codes are translated
into human-readable, localized messages on the main thread.

## Why faces only in v1

Face detection is the honest subset of "find the subject":

- Faces are the case where a bad crop is *offensive* rather than merely
  ugly — the "never crop out a face again" promise is concrete and
  verifiable.
- BlazeFace is small, fast, permissively licensed, and battle-tested.
  General saliency models are an order of magnitude larger and their
  failure modes are vaguer.
- Scope discipline: a suggestion feature must be right most of the time
  it speaks. A face detector that says "no clear subject found" for a
  landscape is more trustworthy than a saliency model guessing.

The upgrade path is already built in. Everything downstream of detection
consumes `detectSubjects( imageBitmap ) → [ { box, confidence } ]`; a
saliency model that emits boxes with scores slots in behind the same
contract without touching the UI, the heuristic, or persistence.

## The heuristic is a pure module

Turning boxes into a single point is plain math, so it lives in
[`src/heuristic/focal-point.js`](../src/heuristic/focal-point.js) with
no DOM, WASM, or WordPress imports, and a Jest suite pins every rule
(thresholding, eye-line anchor, weighted centroid, union clamping,
rounding). See [heuristic.md](heuristic.md) for the plain-English spec.

## Consent and persistence

Two rules the UI never breaks:

1. **Detection never runs on its own.** No auto-analysis on block
   insertion or image selection — inference costs CPU and the result is
   a *suggestion*, so it only happens on an explicit click.
2. **Accepted state is the only state that writes.** The suggestion
   lives in React component state; only Accept writes the block's
   `focalPoint` attribute, and replacing a previously set focal point
   requires a second, explicit confirmation.

On accept, the point is also written to the attachment's
`_fps_focal_point` meta (registered with a strict REST schema; values
are clamped and rounded server-side). Storing per *attachment* rather
than per block means the work transfers: use the same image in another
post and the accepted point is offered instantly, with re-analysis one
click away.

## Failure modes are part of the UI

- **Cross-origin images**: the image is fetched without cross-origin
  credentials (the `crossorigin="anonymous"` equivalent). If the host
  doesn't send CORS headers, the panel explains exactly that, in words.
- **No faces / low confidence**: "No clear subject found" and the picker
  is left untouched — a wrong suggestion is worse than none.
- **Model or WASM load failure**: a readable notice with the likely fix
  (build the plugin), never a console-only error.
