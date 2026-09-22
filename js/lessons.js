// Lesson definitions. Text that states a number is a function of the rules, so
// a balance change updates every lesson automatically.
const enemy = (count = 12, team = 'salamander', x = 0.68, y = 0.44) => ({ team, count, x, y });
const goal = (label, check) => ({ label, check });
const base = { playerCount: 32, abilities: ['freeze'], duration: '45–90 sec', enemies: [enemy()], terrain: [] };
const lesson = data => ({ ...base, ...data });
const s = seconds => `${Math.round(seconds * 10) / 10} seconds`;

export const LESSONS = [
    lesson({ id: 'gather', title: 'Move as one', duration: '30 sec', enemies: [], abilities: [], target: { x: 0.68, y: 0.44 },
        description: 'One gesture moves your fleet.', instruction: 'Hold and drag to the circle. Release when 12 ships arrive.',
        hint: 'Hold near the circle until your ships catch up.', success: 'Hold to move. Release to recruit.',
        goals: [goal('Gather 12 ships in the circle', p => p.arrived >= 12), goal('Release your swarm', p => p.arrived >= 12 && p.released)] }),
    lesson({ id: 'tap-rally', title: 'Tap to steer', duration: '30 sec', enemies: [], abilities: [], target: { x: 0.68, y: 0.44 },
        description: 'Move your fleet without holding a finger down.', instruction: 'Tap Rally, then tap the circle. Tap Release when 12 ships arrive.',
        hint: 'You can tap a new destination while Rally stays on.', success: 'Use taps or hold-and-drag. Both work on desktop and touch.',
        goals: [goal('Steer with tap Rally', p => p.tapSteered), goal('Gather twelve, then release', p => p.arrived >= 12 && p.released)] }),
    lesson({ id: 'surround', title: 'Surround rivals', enemies: [enemy(8)], abilities: [],
        description: 'Outnumber rivals to recruit them.', instruction: 'Rally beside the coral ships. Release to recruit all eight.',
        hint: 'Your ships cannot recruit while Rally is held.', success: 'Gather, approach, release.',
        goals: [goal('Rally and release', p => p.held && p.released), goal('Recruit eight ships', p => p.recruited >= 8)] }),
    lesson({ id: 'wide-freeze', title: 'Freeze a group', freezeFirst: true,
        description: r => `Freeze stops ${r.freezeFraction === 0.5 ? 'half' : `${Math.round(r.freezeFraction * 100)}% of`} the nearby rivals for ${s(r.freezeDuration)}.`,
        instruction: 'Aim and press Space or right-click. On touch: tap Freeze, then the arena.',
        hint: 'The circle shows range. Empty casts keep your charge.', success: 'Frozen ships cannot recruit or defend. Use the opening.',
        goals: [goal('Freeze at least five rivals together', p => p.freezeHits >= 5)] }),
    lesson({ id: 'freeze', title: 'Freeze and recruit', freezeFirst: true, enemies: [enemy(12, 'phoenix')],
        description: 'Recruit rivals while they are frozen.', instruction: 'Rally close, then Freeze. It releases Rally for you.',
        hint: 'Freeze affects ships, never terrain.', success: 'Close the gap before you Freeze.',
        goals: [goal('Freeze at least three rivals', p => p.freezeHits >= 3), goal('Convert three frozen rivals', p => p.frozenRecruits >= 3)] }),
    lesson({ id: 'freeze-rhythm', title: 'Freeze recharge', freezeFirst: true,
        description: r => `Freeze recharges in ${s(r.freezeCooldown)}.`, instruction: 'Freeze twice. Rally while it recharges.',
        hint: 'The Freeze button shows time remaining.', success: 'Regroup between Freezes.',
        goals: [goal('Land two separate Freezes', p => p.freezeCasts >= 2), goal('Rally between attacks', p => p.held)] }),
    lesson({ id: 'asteroids', title: 'Asteroids', enemies: [], abilities: [], route: [{ x: 0.48, y: 0.5 }, { x: 0.76, y: 0.44 }],
        terrain: [{ type: 'asteroid', x: 0.5, y: 0.28, radius: 0.11 }],
        description: 'Asteroids scatter ships without destroying them.', instruction: 'Guide eight ships through both circles, below the rocks.',
        hint: 'Rally after a field to regroup.', success: 'Open routes keep your fleet together.',
        goals: [goal('Reach both navigation circles', p => p.waypoints >= 2)] }),
    lesson({ id: 'nebula', title: 'Nebulae', enemies: [], abilities: [], target: { x: 0.7, y: 0.44 },
        terrain: [{ type: 'slowZone', x: 0.47, y: 0.44, radius: 0.13 }],
        description: 'Blue clouds slow ships without damage.', instruction: 'Cross the cloud. Bring 12 ships to the far circle.',
        hint: 'Keep holding until your fleet catches up.', success: 'Ships regain speed outside the cloud.',
        goals: [goal('Guide ships through a nebula', p => p.nebulaSeen), goal('Gather twelve beyond the cloud', p => p.arrived >= 12)] }),
    lesson({ id: 'black-hole', title: 'Black holes', enemies: [], abilities: [], route: [{ x: 0.5, y: 0.66 }, { x: 0.77, y: 0.5 }],
        terrain: [{ type: 'blackHole', x: 0.5, y: 0.34, radius: 0.045 }],
        description: 'The glow pulls ships inward. The dark core destroys them.', instruction: 'Bring eight ships through both circles, below the black hole.',
        hint: 'Steer around the glow. Freeze cannot stop terrain.', success: 'Keep clear of the core.',
        goals: [goal('Navigate around the black hole', p => p.waypoints >= 2)] }),
    lesson({ id: 'recruits', title: 'Gray ships', enemies: [], abilities: [], neutrals: 12, target: { x: 0.55, y: 0.44 },
        description: 'Gray ships belong to nobody. Either side can recruit them.', instruction: 'Rally beside the gray ships. Release to recruit six.',
        hint: 'Bring at least three allies. Gray ships cannot convert your fleet.', success: 'In duels, more gray ships arrive throughout the match.',
        goals: [goal('Recruit six gray ships', p => p.recruited >= 6)] }),
    lesson({ id: 'competition', title: 'Conquest', generated: 3, freezeFirst: true, enemies: [enemy(10)],
        description: 'Conquest keeps the same map all match.', instruction: 'Freeze and recruit eight rivals. Use the open lane.',
        hint: 'Restart keeps this map.', success: 'Learn safe routes and reuse them.',
        goals: [goal('Recruit at least eight ships', p => p.recruited >= 8), goal('Use Freeze to make an opening', p => p.freezeHits > 0)] }),
    lesson({ id: 'zen', title: 'Zen', generated: 3, evolving: true, enemies: [enemy(10)],
        description: 'Zen changes terrain and has no game over.', instruction: 'Recruit five ships. Watch the map change after 15 seconds.',
        hint: 'In a full game, terrain changes every 40 seconds.', success: 'Zen replenishes fleets so play can continue.',
        goals: [goal('Experience a terrain shift', p => p.shifts >= 1), goal('Recruit five ships', p => p.recruited >= 5)] }),
    lesson({ id: 'levels', title: 'Levels', generated: 1, enemies: [enemy(8)], sectorExercise: true,
        description: 'Win to reach a new map. Progress saves each level.', instruction: 'Unite two small sectors. The second adds terrain.',
        hint: 'Difficulty increases up to tier 10.', success: 'Retry keeps your map. Victory opens a new one.',
        goals: [goal('Unite the first training sector', p => p.sectors >= 1), goal('Unite the second training sector', p => p.sectors >= 2)] }),
    lesson({ id: 'survival', title: 'Survival', enemies: [enemy(8)], waveExercise: true,
        description: 'Rivals arrive in waves.', instruction: 'Recruit both waves. Keep your fleet together.',
        hint: 'Freeze to regroup when a new wave arrives.', success: 'Full Survival also offers upgrades.',
        goals: [goal('Trigger the second wave', p => p.waves >= 2), goal('Recruit sixteen rivals across both waves', p => p.recruited >= 16)] }),
    lesson({ id: 'duel-basics', title: 'Duel basics', live: true, generated: 3, playerCount: 40, neutrals: 12, enemies: [enemy(24)],
        description: 'Two fleets compete. Gray diamonds are unclaimed ships.', instruction: 'Recruit six gray ships, Freeze the rival, and win the duel.',
        hint: 'Gray ships cannot attack. Recruit them to replace black-hole losses.',
        success: r => `In a duel, the rival uses the same Rally and Freeze. More gray ships arrive every ${s(r.duelNeutralInterval)}.`,
        goals: [goal('Recruit six gray ships', p => p.neutralRecruits >= 6), goal('Freeze the rival fleet', p => p.freezeHits > 0), goal('Win the duel', p => p.enemiesLeft === 0)] }),
    lesson({ id: 'finale', title: 'Final challenge', live: true, freezeFirst: true, generated: 4, playerCount: 40,
        enemies: [enemy(10, 'salamander', 0.72, 0.28), enemy(8, 'phoenix', 0.72, 0.68)],
        description: 'Two rivals, terrain, Rally and Freeze.', instruction: 'Unite the arena. Rivals can now recruit your ships.',
        hint: 'Freeze, approach, then release beside a rival group.', success: 'Ready to play. Try Conquest or a duel.',
        goals: [goal('Use Freeze successfully', p => p.freezeHits > 0), goal('Unite every ship', p => p.enemiesLeft === 0)] }),
];

/** Resolves lesson text that may depend on the current rules. */
export function lessonText(value, rules) { return typeof value === 'function' ? value(rules) : value; }

export function freshLessonProgress() {
    return { held: false, released: false, tapSteered: false, neutralRecruits: 0, arrived: 0, recruited: 0, freezeHits: 0, freezeCasts: 0, frozenRecruits: 0,
        enemiesLeft: Infinity, waypoints: 0, nebulaSeen: false, shifts: 0, sectors: 0, waves: 1 };
}

export function lessonComplete(lesson, progress) { return lesson.goals.every(g => g.check(progress)); }

/** Freeze lessons hold recruitment until the first successful Freeze. */
export function lessonReadyToConvert(lesson, progress) { return !lesson.freezeFirst || progress.freezeHits > 0; }
