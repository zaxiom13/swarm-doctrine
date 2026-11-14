# 2026-11-07 native Freeze-fixture evidence

## Baseline and queue

- Main `886b3f4`; Node 24.22.1; npm ci, check, 80 tests and build pass.
- Performance reference `08438a4` exists; no performance or balance claim was made.
- Open improvement heads: #20 `4193ba6`, #22 `acd0c36`, #23 `ab91651`,
  #26 `79a6240`, #27 `159439b`; #24 remains the single closing PR.
- All six PRs are open and mergeable with no comments or reviews.

## Reproduced trigger

Native run [42312102445](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42312102445)
reran unchanged code after yesterday's passing code-head run. API 35 reached the
landscape native Freeze cast, delivered pointerdown at CSS `[365.71,218.29]`,
and mapped it to simulation `[723.20,431.55]`. Production emitted:

```text
freeze-miss team=dragon x=723.2027 y=431.5481 cooldown=0 field=false
```

The pointer log records `aim=true`; the screenshot retains `Tap to Freeze`, as a
miss intentionally keeps the charge. The tap therefore crossed Android/WebView
coordinates correctly, but the test's only intended victim was no longer an
eligible ship at event time. A zero initial velocity did not pin it: normal
flocking resumes on the next simulation tick.

Failure artifact [13549940510](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42312102445/artifacts/13549940510):
13,650,397 bytes; SHA-256
`0722276839fc69835207d8979ef7cdfa2b1f873fecc30d0690510a22be53af13`.

## Change

Head `79a6240` keeps the same platform touchscreen injection and coordinate
mapping. The test briefly sets the simulation dormant, creates the enemy at a
currently live player ship's safe point, records fixture membership/position at
pointer and event time, and restores both the original event emitter and dormant
state in `finally`.

Production TypeScript, Android application code, rules, permissions, WebView
security, storage and timeouts are unchanged.

## Validation and artifacts

- Local #26: diff check, check, 82 tests, production build pass.
- Exact five-head integration: conflict-free; check, 85 tests, build pass.
- Exact web run: [42424879579](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42424879579), pass; deploy skipped.
- Exact repaired native run: [42424879489](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42424879489). API 35 passes the full installed scenario. The native event records the fixture present at `[672.09,386.31]`, cast `[683.28,392.38]`, 68 eligible ships, 34 victims, cooldown 10 and a live field. The suite then passes background/foreground, renderer recovery, force-stop, replacement APK installation without clear-data, landscape restore and persisted Settings reopen.
- Installed-smoke artifact [13595311561](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42424879489/artifacts/13595311561): 15,394,187 bytes; SHA-256 `02a813a3b696d61d8b89a6161e114a25b818640e5ec90b95de61cc35373650af`.
- API 26 on the same run still fails only at the known emulator graphics-pipe smoke stage; lint, APK/test-APK builds and renderer callback checks pass first.

## Limitations

The finite API 35 emulator cannot prove all devices, providers, menus,
accessibility settings or physical input timing. API 26 remains blocked by its
independently localized emulator graphics pipe. Physical/current-vendor API 26,
audible audio, arbitrary cutout/navigation arrangements, schema/assets migration
and real Firebase/WebRTC were not tested. No deployment, merge, auto-merge,
production Firebase mutation or Play Store action occurred.
