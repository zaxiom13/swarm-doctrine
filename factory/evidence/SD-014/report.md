# Clear stale guest conversion flashes: evidence

Base: `8024139186972632f153826cd89097990402dc52`. Date: 2026-10-09.

Snapshot application reused ship objects so trails stay smooth, but only assigned `justConverted` when the incoming bit was set. A following host frame with the bit cleared left the guest object's previous `true` value in place until another update happened; a frozen reused ship could retain it longer because its update returns early.

The guest now assigns the flag from every authoritative snapshot. A focused two-frame regression proves the same object changes from true to false when the host clears the bit.

Validation: `npm run check && npm test && npm run build` (78 tests), including normal snapshot round-trips, typed-array delivery, malformed-frame rejection and the new reused-object transition. This is protocol/unit evidence; no real Firebase/WebRTC session was exercised.
