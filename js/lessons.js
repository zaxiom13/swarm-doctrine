const enemy = (count = 12, team = 'salamander', x = .68, y = .44) => ({ team, count, x, y });
const goal = (label, check) => ({ label, check });
const base = { playerCount: 32, abilities: ['emp'], duration: '45–90 sec', enemies: [enemy()], terrain: [] };
const lesson = data => ({ ...base, ...data });
export const LESSONS = [
    lesson({ id:'gather', title:'Move as one', symbol:'◎', duration:'30 sec', enemies:[], abilities:[], target:{x:.68,y:.44},
        description:'One gesture moves a whole fleet.', instruction:'Hold and drag into the marked circle. Release after at least 12 ships arrive.',
        hint:'Keep holding near the circle. Let your ships catch up before releasing.', success:'Rally is your steering wheel. Release is how you give the swarm room to work.',
        goals:[goal('Gather 12 ships in the circle',s=>s.arrived>=12),goal('Release your swarm',s=>s.arrived>=12&&s.released)] }),
    lesson({ id:'surround',title:'Numbers become strength',symbol:'◈',enemies:[enemy(8)],abilities:[],
        description:'Surround a small group and turn it into allies.', instruction:'Rally beside the coral ships, then release. Convert all eight.',
        hint:'Holding Rally disables conversion. Let go close to the rival group.',success:'Travel together, spread around a rival, and let your numbers do the rest.',
        goals:[goal('Rally and release',s=>s.held&&s.released),goal('Recruit eight ships',s=>s.recruited>=8)] }),
    lesson({ id:'wide-freeze',title:'A whole moment of stillness',symbol:'❄',
        description:'Freeze catches a wide circle of rivals for ten seconds.', instruction:'Aim at the rival group and press Space or right-click. On touch, tap Freeze, then tap the arena.',
        hint:'The faint circle shows your reach. Empty casts keep their charge.',success:'Freeze is generous: every rival inside the circle stops. Allies are unaffected.',
        goals:[goal('Freeze at least eight rivals together',s=>s.freezeHits>=8)] }),
    lesson({ id:'freeze',title:'Turn stillness into momentum',symbol:'❄',enemies:[enemy(12,'phoenix')],
        description:'A frozen group gives you a clear conversion window.',instruction:'Rally close, Freeze, then surround the stopped ships. Freeze automatically releases Rally.',
        hint:'Freeze cannot stop black holes. Position your swarm safely before committing.',success:'The best moment to Freeze is when your swarm is ready to make use of it.',
        goals:[goal('Freeze at least three rivals',s=>s.freezeHits>=3),goal('Convert three frozen rivals',s=>s.frozenRecruits>=3)] }),
    lesson({ id:'freeze-rhythm',title:'Spend the pause wisely',symbol:'◷',
        description:'Freeze has a ten-second recharge. Learn its rhythm without danger.',instruction:'Freeze a group, regroup during recharge, then land a second Freeze.',
        hint:'The button shows the seconds remaining. Another group arrives if you convert every target.',success:'One thoughtful Freeze creates room for the next move. You do not need to keep tapping.',
        goals:[goal('Land two separate Freezes',s=>s.freezeCasts>=2),goal('Rally between attacks',s=>s.held)] }),
    lesson({ id:'asteroids',title:'Thread the rocks',symbol:'◇',enemies:[],abilities:[],route:[{x:.48,y:.5},{x:.76,y:.44}],
        terrain:[{type:'asteroid',x:.5,y:.28,radius:.11}],
        description:'Asteroid fields push ships apart; they do not destroy them.',instruction:'Guide at least eight ships through each circle. Use the open lane below the rocks.',
        hint:'A scattered swarm is vulnerable. Rally again after passing a field.',success:'Read the route before moving. Open lanes keep your swarm together.',
        goals:[goal('Reach both navigation circles',s=>s.waypoints>=2)] }),
    lesson({ id:'nebula',title:'Through the blue',symbol:'⌁',enemies:[],abilities:[],target:{x:.7,y:.44},
        terrain:[{type:'slowZone',x:.47,y:.44,radius:.13}],
        description:'Nebulae slow ships. They never freeze or damage them.',instruction:'Rally through the blue cloud, then gather twelve ships in the far circle.',
        hint:'Keep holding. Ships recover their normal speed when they leave the cloud.',success:'A nebula can delay rivals, but it slows your escape too. Plan around that tradeoff.',
        goals:[goal('Guide ships through a nebula',s=>s.nebulaSeen),goal('Gather twelve beyond the cloud',s=>s.arrived>=12)] }),
    lesson({ id:'black-hole',title:'Respect the dark',symbol:'◉',enemies:[],abilities:[],route:[{x:.5,y:.66},{x:.77,y:.5}],
        terrain:[{type:'blackHole',x:.5,y:.34,radius:.045}],
        description:'The outer glow pulls ships inward. The small dark core destroys them.',instruction:'Take the marked route below the black hole. Bring at least eight ships through both circles.',
        hint:'Do not aim at the core. Freeze affects rival ships, never terrain. Restart freely if you lose the fleet.',success:'Black holes punish shortcuts. A careful detour is often your strongest move.',
        goals:[goal('Navigate around the black hole',s=>s.waypoints>=2)] }),
    lesson({ id:'rescue',title:'Nobody left behind',symbol:'✧',enemies:[],abilities:[],rescue:true,
        description:'Some ships have no swarm. Give them a home.',instruction:'Rally at least five ships near the stranded cluster. Stay nearby for two seconds.',
        hint:'The ring fills while enough allies are nearby. Six new allies join once it fills.',success:'A rescue is an optional advantage, and a reason to explore beyond the nearest fight.',
        goals:[goal('Bring the stranded cluster home',s=>s.rescues>=1)] }),
    lesson({ id:'competition',title:'Learn the arena',symbol:'◈',generated:3,enemies:[enemy(10)],
        description:'Competition rewards knowing a map that will not change underneath you.',instruction:'Inspect the terrain, choose a safe approach, and convert the rival swarm. This map stays fixed.',
        hint:'Look for the open middle lane. Reusing a safe route beats charging through a hazard.',success:'Competition keeps positions, sizes and lifetimes fixed for the entire match. Retries preserve its seed.',
        goals:[goal('Recruit at least eight ships',s=>s.recruited>=8),goal('Use Freeze to make an opening',s=>s.freezeHits>0)] }),
    lesson({ id:'zen',title:'A changing garden',symbol:'⌁',generated:3,evolving:true,enemies:[enemy(10)],
        description:'Zen trades a fixed arena for a landscape that evolves. Full Zen has no game over.',instruction:'Rally safely, watch the terrain-change countdown, and recruit five ships. This exercise changes terrain after 15 seconds.',
        hint:'The last five seconds warn you to prepare. Full Zen changes every forty seconds.',success:'Zen keeps the flow going: the world changes, rivals return, and your swarm gets a fresh start if lost.',
        goals:[goal('Experience a terrain shift',s=>s.shifts>=1),goal('Recruit five ships',s=>s.recruited>=5)] }),
    lesson({ id:'levels',title:'Beyond this horizon',symbol:'↗',generated:1,enemies:[enemy(8)],sectorExercise:true,
        description:'Levels connects fresh maps into a saved expedition.',instruction:'Unite two small sectors. The second brings more terrain and another rival group.',
        hint:'Every full-game sector starts fresh. Terrain and rival strength stop increasing at difficulty ten; new maps continue.',success:'The expedition saves at each sector. A retry keeps that map; a win opens the next random one.',
        goals:[goal('Unite the first training sector',s=>s.sectors>=1),goal('Unite the second training sector',s=>s.sectors>=2)] }),
    lesson({ id:'survival',title:'Ready for the next wave',symbol:'◎',enemies:[enemy(8)],waveExercise:true,
        description:'Survival brings reinforcements before you can get comfortable.',instruction:'Recruit the first group, then handle the incoming second group. Keep your fleet together.',
        hint:'Do not chase one stray while a fresh group surrounds you. Freeze buys you time to regroup.',success:'Waves reward a strong starting position. Full Survival also offers passive upgrades between waves.',
        goals:[goal('Trigger the second wave',s=>s.waves>=2),goal('Recruit sixteen rivals across both waves',s=>s.recruited>=16)] }),
    lesson({ id:'finale',title:'Your own kind of orbit',symbol:'✧',live:true,generated:4,playerCount:40,
        enemies:[enemy(10,'salamander',.72,.28),enemy(8,'phoenix',.72,.68)],
        description:'Two rival swarms, terrain, a rescue, Rally and Freeze. Bring it all together.',instruction:'Unite the arena. Rival ships can convert you now. Use safe routes and concentrate your numbers.',
        hint:'Freeze a rival group, take the open lane, and release beside them. Rescue ships if you need reinforcements.',success:'You are ready for Competition, a changing Zen garden, a level expedition, or Survival waves.',
        goals:[goal('Use Freeze successfully',s=>s.freezeHits>0),goal('Unite every ship',s=>s.enemiesLeft===0)] })
];
export function freshLessonProgress() {
    return { held:false,released:false,arrived:0,recruited:0,freezeHits:0,freezeCasts:0,frozenRecruits:0,enemiesLeft:Infinity,
        waypoints:0,nebulaSeen:false,rescues:0,shifts:0,sectors:0,waves:1 };
}
export function lessonComplete(lesson, progress) { return lesson.goals.every(goal=>goal.check(progress)); }
export function lessonReadyToConvert(lesson, progress) {
    return !['wide-freeze','freeze','freeze-rhythm','competition','finale'].includes(lesson.id) || progress.freezeHits>0;
}
