# Focal Point Suggest

Never crop out a face again.

A WordPress plugin that suggests a focal point for **Cover block**
images by detecting faces **locally in the browser** — WASM inference in
a Web Worker, no cloud API, no image ever leaving the site. The
suggestion appears in the block inspector, where you can accept, reject,
or fine-tune it with the standard focal point picker.

<video src="https://github.com/user-attachments/assets/24a064a8-9485-4235-a328-b3f09e2829db" width="720" controls muted loop></video>

## Why

Cover blocks crop aggressively at different viewport sizes, and the
default focal point is the dead center of the image. If the subject is a
person standing off-center, responsive crops routinely cut their face
out of frame. Setting the focal point by hand fixes it — this plugin
just finds the right point for you and asks for your approval.

This is deliberately **not** generic "AI magic": it detects faces, aims
for the eye line, and always leaves the final call to the editor.

## Features

- **One-click suggestion** — a "Suggest focal point" button in the Cover
  block's inspector, only for image backgrounds.
- **Local inference** — MediaPipe BlazeFace running on WASM inside a Web
  Worker. The editor UI never blocks, and no pixel data leaves the
  browser.
- **Editor stays in control** — the suggestion is previewed on the core
  focal point picker where you can drag to adjust; nothing touches the
  block until you accept, and an existing focal point is never replaced
  without an explicit confirmation.
- **Sensible group handling** — one face anchors on the eye line;
  multiple faces use an area-weighted centroid clamped to the union of
  the faces, so the point never lands in empty space (see
  [docs/heuristic.md](docs/heuristic.md)).
- **Remembers per image** — an accepted point is stored in attachment
  meta (`_fps_focal_point`) and offered instantly the next time that
  image is used, with re-analysis one click away.
- **Honest failure modes** — "No clear subject found" when detection
  comes up empty, and a readable notice when an image can't be analyzed
  (e.g. cross-origin images without CORS headers). Never a silent
  console-only error.
- **Offline-friendly assets** — the model and WASM runtime are served
  from the plugin itself and cached with the Cache API, so repeat runs
  skip the download.

## Installation

The plugin is built with `@wordpress/scripts`, so a build step is
required after cloning:

```bash
cd wp-content/plugins
git clone https://github.com/abhishekfdd/focal-point-suggest.git
cd focal-point-suggest
npm install
npm run build
```

Then activate **Focal Point Suggest** in wp-admin.

Requirements: WordPress 7.0+, PHP 8.3+, Node.js 20+ (build only).

## Usage

1. Add a Cover block with an image background.
2. Open the block inspector and find the **Focal point suggestion**
   panel.
3. Click **Suggest focal point**. The first run downloads the WASM
   runtime (~10 MB, cached afterwards) and takes a moment; subsequent
   runs are fast.
4. Review the suggested point on the image preview — drag it if you want
   to adjust — then **Accept** or **Reject**.

If the image was analyzed before, the previously accepted point is
offered first with a **Re-analyze** button.

## Development

```bash
npm run start      # watch mode
npm run test:unit  # Jest suite for the heuristic
npm run lint:js
```

Develop against any local WordPress install (this repo assumes the
plugin lives inside a running site's `wp-content/plugins/`; no wp-env or
Docker setup is included).

## Architecture at a glance

```
suggestion-panel.js        UI state machine (idle/loading/ready/empty/error)
  └─ get-suggestion.js     fetch image → detect → heuristic
       ├─ detect-subjects.js   worker RPC; detectSubjects(imageBitmap)
       │    └─ worker.js       MediaPipe FaceDetector (WASM), Cache API
       ├─ heuristic/focal-point.js   pure math, fully unit-tested
       └─ meta/attachment-focal-point.js   REST-backed persistence
```

Face detection is wrapped behind a single internal contract —
`detectSubjects( imageBitmap ) → [ { box, confidence } ]` — so the
detector can be swapped without touching the UI or the heuristic. The
full rationale (why WASM, why a worker, why faces-only in v1) is in
[docs/architecture.md](docs/architecture.md).

## Roadmap

- **Saliency model fallback** — suggest focal points for subjects that
  aren't faces (buildings, products, pets) by dropping a saliency model
  behind the existing `detectSubjects` contract.
- **Media & Text block support** — the same suggestion flow for the
  other core block with a focal point control.

Deliberate non-goals for now: settings pages, bulk processing, and
anything that auto-applies a focal point without the editor's consent.

## License

GPL-2.0-or-later. The bundled BlazeFace short-range model is published
by Google under Apache-2.0.
