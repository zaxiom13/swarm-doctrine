// The illustrated field guide. Pictures in guide/ are rendered from the real
// simulation by scripts/make-guide.mjs; text that states a number reads the rules.
const s = seconds => `${Math.round(seconds * 100) / 100} seconds`;
const half = r => r.freezeFraction === 0.5 ? 'half' : `${Math.round(r.freezeFraction * 100)}%`;
const shot = (image, title, text, alt) => ({ image: `guide/${image}.webp`, title, text, alt });

export const GUIDE = [
    { id: 'basics', title: 'The basics', icon: '👀', pages: [
        shot('fleets', 'Who is who', () => 'Your fleet is the one marked YOU. Every other colour is a rival fleet. Gray diamonds belong to nobody. You win when every ship on the map flies your colour.',
            'Your cyan fleet labelled YOU, a red and an orange rival fleet, and a group of gray diamond ships.'),
        shot('hud', 'The screen', () => 'Pause is top left. The centre shows time and score. Details opens your share of the arena and every fleet’s size. Rally and Freeze sit at the bottom for touch play.',
            'A live match with the Pause button, timer, Guide and Details chips, and the Rally and Freeze buttons outlined.'),
    ] },
    { id: 'rally', title: 'Rally', icon: '◎', pages: [
        shot('rally-hold', 'Hold and drag to move', r => `Press and hold anywhere in the arena. Ships within ${r.rallyRadius}px of your pointer stream toward it while you drag. On touch you can also tap Rally, then tap destinations.`,
            'Cyan ships streaming along a dragged path toward an orange Rally ring under the pointer.'),
        shot('rally-disarmed', 'Holding disarms you', () => 'While Rally is held your fleet cannot recruit, and nearby rivals are pushed away. Rally is for getting into position, not for attacking.',
            'The fleet packed inside an orange Gathering ring while a red group drifts away to the side.'),
        shot('release', 'Let go to spread out', r => `Releasing blooms the knot outward into a ring around whatever is nearby. After a ${s(r.rallyCoolOff)} cool-off (the red ring) your ships can recruit again.`,
            'The fleet spreading out in all directions under a red dotted cool-off ring.'),
    ] },
    { id: 'recruit', title: 'Recruit', icon: '🤝', pages: [
        shot('recruit', 'Surround to recruit', r => `A ship is recruited when ${r.conversionThreshold} or more of your ships are within ${r.conversionRadius}px of it and they outnumber its own nearby defenders. Lines and a white halo show pressure building, about ${s(r.conversionTicks / 60)} per ship.`,
            'A ring of cyan ships around eight red ships, with lines and white halos showing recruit pressure.'),
        shot('recruited', 'Recruits join you', () => 'Recruited ships switch colour on the spot and fight for you straight away, so every win makes the next one easier.',
            'The red group has turned cyan; the counter shows You 38, Coral 0.'),
        shot('outnumbered', 'It works both ways', () => 'Rivals recruit by the same rule. A small group parked beside a bigger one gets taken, so keep your fleet together and pick fights you outnumber.',
            'Six cyan ships beside twenty-six red ones, with halos showing the cyan ships being recruited.'),
    ] },
    { id: 'freeze', title: 'Freeze', icon: '❄', timeline: true, pages: [
        shot('freeze-aim', 'Aim Freeze', r => `Point at a rival group and press Space or right-click (Q, E, 1 and 2 also work). On touch, tap Freeze, then the arena. The dashed circle shows its ${r.freezeRadius}px reach. A cast that hits nothing keeps its charge.`,
            'A large dashed circle centred on a red group, with a ruler marking its radius.'),
        shot('freeze-hit', 'Frozen ships stop', r => `Freeze stops ${half(r)} of the rivals inside the circle for ${s(r.freezeDuration)}. Frozen ships turn gray with a crosshair. They cannot move, recruit or help defend their neighbours.`,
            'Red ships with gray hulls and crosshair rings, frozen in place.'),
        shot('freeze-recruit', 'Freeze, then recruit', () => 'Freeze lets go of Rally for you. Freeze a group, rally onto it, and release: frozen ships are the easiest recruits on the map.',
            'Numbered steps beside the cyan fleet closing around a cluster of frozen orange ships.'),
    ] },
    { id: 'terrain', title: 'Terrain', icon: '🌌', pages: [
        shot('asteroids', 'Asteroids scatter', () => 'Asteroid fields knock ships off course but never destroy them. Routing around them keeps your fleet in one piece.',
            'The fleet ploughing into an asteroid field, with a dotted green route curving below it.'),
        shot('nebula', 'Nebulae slow', () => 'Blue nebulae slow every ship inside. Your fleet stretches out as it crosses, so keep holding Rally until the stragglers catch up.',
            'The fleet strung out in a line inside a blue cloud.'),
        shot('black-hole', 'Black holes destroy', () => 'The purple glow pulls ships inward and the dark core destroys them. Freeze cannot stop terrain, so steer well clear.',
            'The fleet flying into a black hole, with its pull zone outlined and a count of ships lost.'),
    ] },
    { id: 'modes', title: 'Modes', icon: '🎮', pages: [
        shot('neutrals', 'Gray ships', () => 'Gray ships never attack. Whoever surrounds them first gets them; if two fleets tie over one, nobody does.',
            'Cyan ships curving around a cluster of gray diamonds.'),
        shot('duel', 'Duel', r => `One rival fleet uses exactly your Rally and Freeze. Its Rally point is drawn on the map, so you can read its plan. ${r.duelNeutralWave} gray ships arrive every ${s(r.duelNeutralInterval)}.`,
            'Blue and orange fleets facing off, with the rival’s Rally circle labelled and gray ships between them.'),
        shot('survival', 'Survival', () => 'Rivals arrive in waves from the edges, and you pick an upgrade every two waves. Meet each wave with your whole fleet.',
            'Red and orange groups flying in from the left and right edges toward the cyan fleet.'),
        shot('victory', 'Winning', () => 'Levels and duels end when one colour holds every ship. Zen never ends and reshapes the map as you play.',
            'The whole arena filled with cyan ships.'),
    ] },
];

/** Resolves page text that may depend on the current rules. */
export function guideText(value, rules) { return typeof value === 'function' ? value(rules) : value; }
