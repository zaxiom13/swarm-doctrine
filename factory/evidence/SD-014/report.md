# Clear stale guest conversion flashes: evidence

Base: `8024139186972632f153826cd89097990402dc52`. Date: 2026-10-09.

Snapshot application reused ship objects so trails stay smooth, but only assigned `justConverted` when the incoming bit was set. A following host frame with the bit cleared left the guest object's previous `true` value in place until another update happened; a frozen reused ship could retain it longer because its update returns early.

The guest now assigns the flag from every authoritative snapshot. A focused two-frame regression proves the same object changes from true to false when the host clears the bit.

Validation: `npm run check && npm test && npm run build` (78 tests), including normal snapshot round-trips, typed-array delivery, malformed-frame rejection and the new reused-object transition. This is protocol/unit evidence; no real Firebase/WebRTC session was exercised.

## 2026-10-11 strengthening

The two-frame regression now keeps the reused ship frozen across both snapshots.
That exercises the exact trigger called out above: a ship whose normal update
returns early must still clear the previous frame's conversion flag. The object
identity, frozen state and authoritative true → false transition are asserted.

## 2026-10-12 main synchronization

Merged main `aefd7fe` (including merged #25) into this working branch without
conflicts. Independent `npm run check`, `npm test` (79 tests) and
`npm run build` pass. This preserves the original PR outcome while refreshing
its merge base and evidence; no new gameplay change was made.

## 2026-11-15 finished-match isolation

Reproduction used the guest silence/disconnect path: `onlinePeerGone` marks the
match ended and opens the victory result, but a host that resumes later can
continue sending snapshots and effects. Before this change, `onlineState` and
`onlineFx` did not inspect `online.ended`, so the finished guest still replaced
its fleet objects and rendered late effects behind the result screen.

Both handlers now reject messages after the match is ended. The regression
keeps the exact finished fleet array, delivers a valid authoritative snapshot
and effect from the expected host, and proves neither is applied. Focused tests
pass (26 tests); the complete branch passes `npm run check`, `npm test` (82
tests) and `npm run build`. GitHub runs
[43775273226](https://github.com/zaxiom13/swarm-doctrine/actions/runs/43775273226)
(web checks/build; deploy skipped) and
[43775273243](https://github.com/zaxiom13/swarm-doctrine/actions/runs/43775273243)
(Android lint/debug APK) are green.

The exact five-head integration (`886b3f4`, `4193ba6`, `acd0c36`, `bac038a`,
`2b7765c`, `159439b`) passes check, 86 tests and build at `c9b1077`.

Limit: the requested two-context `?net=local` browser exercise could not run in
this workspace. The visible browser has an isolated loopback namespace, while
workspace Chromium aborts because the sandbox forbids its process-singleton
socket; unsandboxed execution is unavailable. This is automated protocol/game
evidence, not a real Firebase/WebRTC or installed-WebView multiplayer claim.
