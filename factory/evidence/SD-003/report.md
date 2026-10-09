# Keep landscape home actions visible: evidence

Base: `2e10c82981c8c77e2f51c77205aca0e7ad3947e5`. Date: 2026-10-09.

At 844x390 the home hero was 492.8px tall and Settings ended at y=468.8, outside the screen. Added a height-aware landscape home layout with a two-column layout at >=640px and a compact stacked fallback. All visible home buttons fit at five tested sizes.

This PR fixes the home screen. It does not claim that every in-game overlay/HUD is excellent on every device. No gameplay or field-guide imagery changes.

Reproduce unit checks: `npm ci && npm run check && npm test && npm run build`.

## Screenshots

Before 844×390:

![Before](home-before.jpg)

After 844×390:

![After](home-844x390.jpg)

Portrait 390×844:

![Portrait](home-390x844.jpg)

Compact landscape 568×320:

![Small landscape](home-568x320.jpg)

Measurements for 390×844, 844×390, 640×360, 568×320 and 1280×720 are in [measurements.json](measurements.json). Reproduce by opening the production preview at those sizes and checking bounding boxes of the four home actions; all edges must remain inside the viewport.

Logs: [type checks](check.log), [tests](test.log), [build](build.log).
