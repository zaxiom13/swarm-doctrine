# Validate complete network snapshots before mutation: evidence

Base: `2e10c82981c8c77e2f51c77205aca0e7ad3947e5`. Date: 2026-10-09.

Seven regression cases failed against the base: non-finite/negative time, invalid last team, duplicate last ID, negative coordinate and trailing data. Preflight the whole frame, bound count by rules.duelShipCap, enforce known flags/teams and wire coordinate range, then mutate the world. Preserve existing objects and Uint8Array views for valid frames.

Tested normal round-trips plus two-tab local transport, disconnect and rematch. This validates incoming snapshot structure, not host honesty or a full security audit. Real Firebase/WebRTC was not exercised.

Reproduce unit checks: `npm ci && npm run check && npm test && npm run build`.

Reproduce invalid frames using `npm test -- tests/snapshot-validation.test.ts`. Before: 7/7 newly introduced cases failed (accepted frame). After: all 8 validation tests and existing network round-trips pass. Two pages with `?net=local` successfully start a duel, send Rally, leave, rematch with reversed roles and disconnect.

Logs: [type checks](check.log), [tests](test.log), [build](build.log).
