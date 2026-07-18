# The focal point heuristic

This document explains, in plain English, how the plugin turns a list of
detected faces into a single suggested focal point. The implementation
lives in [`src/heuristic/focal-point.js`](../src/heuristic/focal-point.js)
and is a pure function — no DOM, no WASM — so every rule below is covered
by unit tests.

## Input and output

The heuristic receives the face detector's output: a list of bounding
boxes in image pixels, each with a confidence score, plus the image's
dimensions. It returns a focal point normalized to the 0–1 range (the
format the Cover block's focal point picker uses), rounded to two
decimals — or `null` when there is nothing trustworthy to point at.

## Rule 1: when in doubt, do nothing

Detections with confidence below **0.5** are discarded. If nothing
remains, the heuristic returns `null`, the UI says "No clear subject
found", and the focal point picker is left untouched. A wrong suggestion
is worse than no suggestion.

## Rule 2: one face — aim for the eyes

With a single face, the focal point is:

- **x** — the horizontal center of the face box.
- **y** — one third down from the top of the box.

Why a third down and not the center? Detectors box the whole head, and
the eyes sit roughly a third of the way down that box. When a Cover
block crops aggressively (say, a wide banner from a portrait photo),
anchoring on the eye line keeps the part of the face people actually
look at in frame, instead of centering on the nose or chin.

## Rule 3: several faces — weighted middle, never empty space

With multiple faces, each face contributes its own eye-line anchor
(Rule 2), weighted by the **area of its box**. A large foreground face
therefore pulls the focal point strongly toward itself, while a small
face in the background only nudges it.

A plain centroid has a failure mode: two people standing at opposite
edges of the frame would average out to a focal point in the empty space
between them. To prevent that, the weighted centroid is **clamped to the
bounding union of all face boxes** — the smallest rectangle containing
every detected face. The suggested point is guaranteed to land somewhere
a face actually is, or at least on the rectangle that contains them all.

## Worked example

Image 1000 × 500 px. Two faces:

- Face A: box at (100, 100), 200 × 200 px → anchor (200, 166.7), weight 40 000.
- Face B: box at (700, 150), 100 × 100 px → anchor (750, 183.3), weight 10 000.

Weighted centroid: x = (200 × 40 000 + 750 × 10 000) / 50 000 = **310**,
y = (166.7 × 40 000 + 183.3 × 10 000) / 50 000 ≈ **170**. The point
(310, 170) already lies inside the union of both boxes, so no clamping
is needed. Normalized: **{ x: 0.31, y: 0.34 }** — close to the dominant
face, slightly pulled toward the smaller one.

## Known limitations (v1)

- Faces only. A photo of a lighthouse returns "no clear subject" even
  though the subject is obvious to a human. A saliency model can replace
  the detector later — the heuristic only sees boxes and does not care
  what produced them.
- No pose or gaze awareness: a face looking out of frame is treated the
  same as one looking at the camera.
