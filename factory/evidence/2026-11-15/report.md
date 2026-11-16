# Evidence report — 2026-11-15

## Scope and outcome

The reliability/security draw maintained multiplayer PR #23. A finished guest
previously accepted a late authoritative snapshot and effect after its silence
watchdog had already shown victory. Both paths now reject data once
`online.ended` is true, preserving the result state without changing active
online play or the protocol.

## Reproducible validation

| Target | Result |
| --- | --- |
| Main `886b3f4` | Node 24.22.1; `npm ci`; check; 80 tests; build pass |
| #23 `77bf62d` | Focused 26 tests; full check; 82 tests; build pass |
| Web workflow 43775273226 | Pass; deployment skipped |
| Android workflow 43775273243 | Lint/debug APK pass; no installed multiplayer claim |
| Exact five-head integration `9423d30` | Heads `4193ba6`, `acd0c36`, `77bf62d`, `2b7765c`, `159439b`; check; 86 tests; build pass |

The regression keeps the original finished fleet-array identity, delivers a
well-formed snapshot from the expected host and a valid effect, and requires
both to be ignored. This proves the local handler boundary, not transport
delivery on a device.

## Limitations

The visible browser cannot reach this workspace's loopback server. The installed
workspace Chromium was also unable to start because its required local IPC socket
is forbidden by the managed sandbox, and escalation is unavailable. Therefore
the requested two-context `?net=local` flow, real Firebase/WebRTC and installed
Android multiplayer remain unverified in this run. The Android appassets
navigation candidate was inspected and rejected as intentional: Jev's
localhost-only configuration surface is hidden and blocked in the APK.

No screenshots or uploads are claimed. No deployment, merge, auto-merge,
production Firebase change, credential, signing key, billing or paid service was
used.
