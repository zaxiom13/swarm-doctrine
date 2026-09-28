// The illustrated field guide, one step at a time. Each device gets its own
// pictures (guide/<device>/*.webp, rendered from the real simulation by
// scripts/make-guide.mjs) and its own wording, so a phone player only ever
// reads about taps and a desktop player about the mouse and keyboard.
// Text that states a number reads the rules.
const secs = seconds => `${Math.round(seconds * 100) / 100} seconds`;
const half = r => r.freezeFraction === 0.5 ? 'half' : `${Math.round(r.freezeFraction * 100)}%`;

export const GUIDE_DEVICES = {
    phone: { label: 'Phone', icon: '📱' },
    desktop: { label: 'Computer', icon: '🖥️' },
};

/**
 * A step: `text` is a string, a function of (rules, device), or
 * { phone, desktop } with either form inside. `only` limits it to one device.
 */
const step = (image, title, text, alt, only = null) => ({ image, title, text, alt, only });

export const GUIDE = [
    { id: 'basics', title: 'Basics', icon: '👀', steps: [
        step('fleets', 'Who is who', 'Your fleet is the one marked YOU. Every other colour is a rival. Gray diamonds belong to nobody. You win when every ship flies your colour.',
            'Your cyan fleet labelled YOU, a red and an orange rival fleet, and a group of gray diamond ships.'),
        step('hud', 'Your screen', {
            phone: 'Pause is top left, time and score in the middle, and your share of the arena top right. Rally and Freeze are the two big buttons at the bottom.',
            desktop: 'Pause is top left (or Esc). Time and score sit in the middle; Details, top right, shows your share of the arena. You will mostly use the mouse and Space instead of the buttons at the bottom.',
        }, 'A live match with its controls outlined and labelled.'),
    ] },
    { id: 'move', title: 'Move', icon: '◎', steps: [
        step('rally-hold', 'Hold and drag to move', {
            phone: r => `Put a finger on the arena and keep it down. Your ships within ${r.rallyRadius}px of it rally to it and follow as you drag.`,
            desktop: r => `Hold the left mouse button in the arena and drag. Your ships within ${r.rallyRadius}px of the pointer rally to it and follow.`,
        }, 'Cyan ships streaming along a dragged path toward an orange Rally ring.'),
        step('tap-rally', 'Or tap to steer', 'Tired thumbs? Tap the Rally button once and it stays on. Now tap anywhere to send your fleet there, and tap again to change course. Tap Rally again to let go.',
            'The Rally button highlighted, with numbered taps on the button and on the arena.', 'phone'),
        step('rally-disarmed', 'Moving means not attacking', 'While Rally is held your ships cannot recruit, and rivals nearby are pushed away. Use it to get into position.',
            'The fleet packed inside the orange Rally ring while a red group drifts away.'),
        step('release', 'Let go beside a group', {
            phone: r => `Lift your finger next to a smaller group. Your fleet spreads out around it and, after a ${secs(r.rallyCoolOff)} pause, starts recruiting.`,
            desktop: r => `Release the mouse button next to a smaller group. Your fleet spreads out around it and, after a ${secs(r.rallyCoolOff)} pause, starts recruiting.`,
        }, 'The fleet spreading out under a red cool-off ring beside a red group.'),
    ] },
    { id: 'recruit', title: 'Recruit', icon: '🤝', steps: [
        step('recruit', 'Surround to recruit', r => `A rival turns when ${r.conversionThreshold} or more of your ships are within ${r.conversionRadius}px of it and outnumber its nearby friends. Lines and a white halo show it happening.`,
            'A ring of cyan ships around eight red ships, with lines and white halos.'),
        step('recruited', 'They join you', 'Recruited ships switch colour on the spot and fight for you, so every win makes the next one easier.',
            'The red group has turned cyan; the counter shows You 38, Coral 0.'),
        step('outnumbered', 'It works both ways', 'Rivals recruit by the same rule. A small group next to a bigger one gets taken, so keep your fleet together.',
            'Six cyan ships beside twenty-six red ones, being recruited.'),
    ] },
    { id: 'freeze', title: 'Freeze', icon: '❄', steps: [
        step('freeze-aim', 'Aim Freeze', {
            phone: r => `Tap the Freeze button, then tap a rival group. The dashed circle shows its ${r.freezeRadius}px reach. Tapping empty space keeps the charge.`,
            desktop: r => `Point at a rival group and press Space or right-click (Q, E, 1 and 2 work too). The dashed circle shows its ${r.freezeRadius}px reach. Missing keeps the charge.`,
        }, 'A dashed circle centred on a red group, with the controls to cast it.'),
        step('freeze-hit', 'Frozen ships stop', r => `Freeze stops ${half(r)} of the rivals in the circle for ${secs(r.freezeDuration)}. They turn gray with a crosshair and cannot move, recruit or defend.`,
            'Red ships with gray hulls and crosshair rings.'),
        step('freeze-recruit', 'Freeze, then recruit', 'Freeze lets go of Rally for you. Freeze a group, move onto it, and let go: frozen ships are the easiest recruits there are.',
            'Numbered steps beside the fleet closing around frozen orange ships.'),
        { timeline: true, title: 'Freeze timing', text: r => `Freeze is locked for the first ${secs(r.freezeLockout)} of a match. Each cast freezes for ${secs(r.freezeDuration)} and recharges in ${secs(r.freezeCooldown)}. The Freeze button counts down while it recharges.` },
    ] },
    { id: 'terrain', title: 'Terrain', icon: '🌌', steps: [
        step('asteroids', 'Asteroids scatter', 'Asteroids knock ships off course but never destroy them. Go around to keep your fleet together.',
            'The fleet ploughing into an asteroid field.'),
        step('nebula', 'Nebulae slow', {
            phone: 'Blue clouds slow every ship inside. Keep your finger down until the stragglers catch up.',
            desktop: 'Blue clouds slow every ship inside. Keep holding until the stragglers catch up.',
        }, 'The fleet strung out inside a blue cloud.'),
        step('black-hole', 'Black holes destroy', 'The glow pulls ships in and the dark core destroys them. Freeze cannot stop terrain, so steer well clear.',
            'The fleet flying into a black hole, with its pull zone outlined.'),
    ] },
    { id: 'modes', title: 'Modes', icon: '🎮', steps: [
        step('neutrals', 'Gray ships', 'Gray ships never fight back. Whoever surrounds them first gets them; if two fleets tie over one, nobody does.',
            'Cyan ships curving around gray diamonds.'),
        step('duel', 'Duel', r => `One rival with exactly your Rally and Freeze. Its Rally point is drawn on the map, so you can read its plan. ${r.duelNeutralWave} gray ships arrive every ${secs(r.duelNeutralInterval)}.`,
            'Blue and orange fleets facing off, with gray ships between them.'),
        step('survival', 'Survival', 'Rivals arrive in waves from the edges, and you pick an upgrade every two waves.',
            'Red and orange groups flying in from the edges toward the cyan fleet.'),
        step('victory', 'Winning', 'Levels and duels end when one colour holds every ship. Zen never ends and reshapes the map as you play. You are ready!',
            'The whole arena filled with cyan ships.'),
    ] },
];

/** The device a player is probably on. Touch-first screens get the phone guide, like the game's own touch controls. */
export function detectGuideDevice() {
    return globalThis.matchMedia?.('(pointer: coarse)').matches ? 'phone' : 'desktop';
}

/** The flat list of steps for one device, each with its chapter and resolved text. */
export function guideSteps(device, rules) {
    const resolve = value => {
        if (value && typeof value === 'object') value = value[device];
        return typeof value === 'function' ? value(rules, device) : value;
    };
    return GUIDE.flatMap(chapter => chapter.steps.filter(s => !s.only || s.only === device).map(s => ({
        ...s, chapter, text: resolve(s.text), image: s.image && `guide/${device}/${s.image}.webp`,
    })));
}
