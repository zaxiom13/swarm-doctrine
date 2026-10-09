# Precache built chunks and return honest offline asset errors: evidence

Base: `2e10c82981c8c77e2f51c77205aca0e7ad3947e5`. Date: 2026-10-09.

The old shell list omitted lazy chunks/models and unknown offline assets returned index.html with 200. A Vite build hook now precaches all built chunks/public assets with a content-derived cache version. Only navigation falls back to the current scoped index. Missing assets return 503 text/plain; cache deletion is scoped to Swarm Doctrine.

Chromium production-build service-worker checks include cold reload, Local and Tactician rivals and a missing JS request. No native Android service-worker claim: packaged Android assets intentionally bypass it.

Reproduce unit checks: `npm ci && npm run check && npm test && npm run build`.

Chromium 153.0.8010.0 production build. Visit only Home, wait for service-worker activation, reload until controlled, disable network, reload again: Home boots. Cold Local and Tactician duel starts work offline. Cache contains 58 resources including the search worker, lazy chunks and policy JSON. `fetch("/assets/missing.js")`: before 200 text/html; after 503 text/plain. Unit fallback test also covers CSS/model requests and a scoped /game/ navigation without reading older caches.

Logs: [type checks](check.log), [tests](test.log), [build](build.log).
