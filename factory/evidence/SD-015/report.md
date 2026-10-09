# Guard fleet spawn clearance across aspect ratios: evidence

Base: `8024139186972632f153826cd89097990402dc52`. Date: 2026-10-09.

The world generator says corner spawns are reserved, but the prior test checked only that one seed's terrain centers were in bounds. The spawn points and spread were private constants, so a world or arena edit could invalidate that promise without failing tests.

The fleet spawn geometry is now exported from its single runtime definition. A deterministic test checks tier-10 hazards against the entire rectangular fleet spread for 2,048 seeds at eight phone, desktop and ultrawide portrait/landscape sizes. It includes black-hole pull reach rather than only the visible radius and enforces a 12px minimum buffer.

The wider audit used 100,000 seeds at ten sizes and found no existing overlap; the worst conservative margin was 17.87px at 320×720. This PR records a verified invariant rather than claiming a reproduced bug. Validation: `npm run check && npm test && npm run build` (78 tests).
