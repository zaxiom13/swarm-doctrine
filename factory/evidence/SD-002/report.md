# Release held controls on rotation and background: evidence

Base: `2e10c82981c8c77e2f51c77205aca0e7ad3947e5`. Date: 2026-10-09.

Fixed online arenas do not change simulation dimensions on rotation, so resizeWorld previously returned before resetting input. The regression test failed before the fix. Reset input after viewport resize regardless of world size, and route guest release to the host; blur/visibility reset controls even when an online match cannot pause.

Chromium touch and two-tab BroadcastChannel tests verify behavior. Actual Android WebView and real Firebase/WebRTC devices were not tested.

Reproduce unit checks: `npm ci && npm run check && npm test && npm run build`.

Browser: Chromium 153.0.8010.0. Rotate a paused fixed 1280×720 arena from 844×390 to 390×844 with Freeze aim armed; targeting and pointer ID clear. Actual CDP touchStart/touchCancel ends Rally, tap Freeze then arena disarms aim, Pause/Resume returns to playing. Two pages in one context with `?net=local`: guest Rally reaches host; guest rotation clears holding on both sides; leave, rematch with reversed roles and disconnect work.

Logs: [type checks](check.log), [tests](test.log), [build](build.log).
