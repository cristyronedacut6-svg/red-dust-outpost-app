// Red Dust Outpost · MOON SURVIVAL · game data
// ------------------------------------------------------------------------------------------------
// THIS FILE IS MADE TO BE EDITED BY THE DESIGN TEAM. Change numbers and words here; the game reads them.
// Rules: keep the commas and quote marks. Times are in REAL seconds of play unless the name says "Min".
// After you change something, reload the game. If the game stops starting, undo your last change.
// ------------------------------------------------------------------------------------------------

// ---- The story --------------------------------------------------------------------------------
export const STORY = {
  callsign: 'ARTEMIS-7',                       // TODO (design team): pick the astronaut's call sign
  // TODO (design team): write the message the astronaut hears after the crash (3–5 short sentences).
  intro: [
    'Mission Control to ARTEMIS-7. Your cargo lander came down hard on the rim of Shackleton Crater.',
    'Your suit has a few hours of oxygen and the lander has a small reserve. Supply caches from earlier robotic missions are scattered around you.',
    'Salvage them, build a base, and keep yourself alive. The Sun never rises high here — stay out of the shadows when you can.',
  ],
  win: 'Mission Control: we read your base report loud and clear, ARTEMIS-7. You did it — the first base at the lunar south pole.',
};

// ---- The landing site --------------------------------------------------------------------------
// Shackleton Crater is 21 km wide and 4 km deep; its floor has not seen sunlight for billions of years.
// The game squeezes it to fit the play area (see SCIENCE.md).
export const SITE = { id: 'southpole', n: 'Shackleton Rim · Lunar South Pole', polar: true, items: [],
  facts: ['At the lunar south pole the Sun never rises more than about 1.5° above the horizon. It circles the sky once a month.',
    'The floor of Shackleton Crater is in permanent shadow, at about −230 °C. It is one of the coldest places measured in the Solar System.',
    'NASA chose the south pole for Artemis because of the ice in these dark craters and the long sunlight on the ridges.'] };
export const CRATER = { x: 0, z: -330, r: 230, depth: 62 };   // where the dark crater is (metres) — the ice is on its floor

// ---- Earth in the sky ------------------------------------------------------------------------------
// From the south pole Earth hangs almost still, just above the horizon (it wobbles a few degrees, "libration").
// Your laser comms antenna only works where it can SEE Earth.
export const EARTH = { azDeg: 20, elDeg: 4.5, dist: 3000 };

// ---- The Sun and temperatures ----------------------------------------------------------------
export const SUN = {
  elevationDeg: 4,            // how high the Sun stands (real: about −1.5° to +1.5° at the pole; higher here so you can see to play)
  circleMin: 48,              // minutes of play for the Sun to go once around the sky (real: 29.5 days)
};
export const TEMP = { sun: -30, shadow: -170, crater: -230 };   // ground temperatures in °C (LRO Diviner measurements, rounded)

// ---- Your suit ---------------------------------------------------------------------------------
export const SUIT = {
  o2Min: 14,             // minutes of oxygen in a full suit while walking (real suits: about 8 hours)
  powerMin: 20,          // minutes of suit battery in sunlight
  heaterX: 3,            // the battery drains this many times faster in shadow (the heater works hard)
  craterX: 5,            // ...and this much faster on the dark crater floor
  runO2X: 1.7,           // running uses this much more oxygen
  lampDrain: .3,         // extra battery drain while the helmet lamp is on
  leakPerSec: .7,        // oxygen lost per second through a micrometeorite hole (% of a full suit)
  fallSafe: 5,           // landing speed (m/s) you can take without getting hurt
  fallDamage: 12,        // health lost for each m/s above that
};
// Jetpack (manoeuvring thrusters, like the MMU flown in 1984 — not part of Artemis suits, added for play).
// In the air there is no friction: you keep drifting until you thrust the other way (Newton's first law).
export const JET = { fuelSec: 22, up: 2.6, side: 1.6, refillAtLander: true };   // seconds of full thrust; accelerations in m/s² (Moon gravity is 1.62)
export const MOVE = { traction: 3.2 };   // grip on loose regolith (the original walk uses 8): lower = more sliding and momentum
export const HEALTH = { regen: .5, regenInside: 4, suffocate: 9, cold: 2.5, flare: .8 };   // per second

// ---- Things to collect ------------------------------------------------------------------------
export const RES = {
  scrap: { n: 'Scrap metal', icon: '🔩' },
  elec: { n: 'Electronics', icon: '💾' },
  regolith: { n: 'Regolith', icon: '🪨' },
  ice: { n: 'Ice', icon: '🧊' },
};
export const GATHER = { cacheSec: 1.1, digSec: 1.0, iceSec: 2.2 };   // seconds of holding USE per item
export const CACHES = 9;                                            // supply caches around the site
export const CACHE_LOOT = [{ scrap: 4, elec: 2 }, { scrap: 3, elec: 3 }, { scrap: 6, elec: 1 }];

// ---- Things to build ------------------------------------------------------------------------
// area = which of the six NASA Moon Base Challenge areas it counts for
export const BUILD = [
  { id: 'solar', n: 'Solar tower', icon: '☀️', cost: { scrap: 4, elec: 2 }, area: 'power', power: 3,
    desc: 'A tall vertical solar array. It turns to follow the low Sun.', fact: 'At the poles the Sun skims the horizon, so NASA plans tall, vertical solar arrays that catch light above the shadows.' },
  { id: 'battery', n: 'Battery', icon: '🔋', cost: { scrap: 3, elec: 3 }, area: 'power', store: 120,
    desc: 'Stores power for when your towers are in shadow.', fact: 'Batteries and fuel cells carry a lunar base through the dark. The longest polar shadow periods last days.' },
  { id: 'hab', n: 'Habitat', icon: '🏠', cost: { scrap: 12, elec: 4 }, area: 'habitat', use: 1.2, o2: 300,
    desc: 'NASA’s Habitat Demonstration Unit. Warm, pressurised and shielded. Refill your suit inside.', fact: 'This is NASA’s real Habitat Demonstration Unit, a prototype tested in the Arizona desert for Moon and Mars missions.' },
  { id: 'ice', n: 'Ice processor', icon: '💧', cost: { scrap: 6, elec: 4 }, area: 'life', use: 2, perIce: 30,
    desc: 'Melts ice and splits the water into oxygen and hydrogen (electrolysis).', fact: 'Water ice in the dark polar craters can become drinking water, breathing oxygen and rocket fuel.' },
  { id: 'berm', n: 'Regolith shield', icon: '⛰️', cost: { regolith: 12 }, area: 'safety', shelter: 6,
    desc: 'A wall of packed moon soil. Shelter beside it during a solar flare.', fact: 'About 1–2 m of regolith cuts solar-flare radiation sharply. Future habitats may be buried under it.' },
  { id: 'antenna', n: 'Laser comms terminal', icon: '📡', cost: { scrap: 5, elec: 6 }, area: 'comms', use: .5,
    desc: 'Talks to Earth by laser. Gives early warning of solar flares and sends your base report.', fact: 'NASA’s Lunar Laser Communication Demonstration sent data from the Moon to Earth at 622 megabits per second in 2013.' },
];
export const ROVER = { cost: { scrap: 8, elec: 3 }, area: 'mobility', fact: 'Apollo 15, 16 and 17 used Lunar Roving Vehicles. Artemis astronauts will drive a new Lunar Terrain Vehicle.' };
export const LANDER = { o2: 220, power: 80 };   // what is left in your crashed lander (% of a full suit)

// ---- Dangers --------------------------------------------------------------------------------
export const DANGER = {
  flareFirstMin: 9, flareEveryMin: [8, 13], flareWarnSec: 45, flareWarnWithAntennaSec: 120, flareSec: 70,
  meteorEveryMin: [4, 8], meteorChance: .45,
  backgroundDose: 1.37,        // mSv per Earth day on the lunar surface (Chang'e 4, 2020) — shown as a fact
};

// ---- The six areas of the NASA Moon Base Student Challenge ------------------------------------------
export const AREAS = [
  { id: 'power', n: 'Power', icon: '⚡' }, { id: 'habitat', n: 'Habitat', icon: '🏠' }, { id: 'life', n: 'Life support', icon: '💧' },
  { id: 'mobility', n: 'Mobility', icon: '🚙' }, { id: 'comms', n: 'Communications', icon: '📡' }, { id: 'safety', n: 'Astronaut safety', icon: '🛡️' },
];
// The objective chain shown on screen, in order
export const GOALS = [
  { id: 'salvage', t: 'Salvage supply caches: 6 scrap and 3 electronics', area: null },
  { id: 'solar', t: 'Build a solar tower where the Sun reaches', area: 'power' },
  { id: 'hab', t: 'Build the habitat', area: 'habitat' },
  { id: 'ice', t: 'Cut 4 ice in the dark crater and build an ice processor', area: 'life' },
  { id: 'berm', t: 'Build a regolith shield and survive a solar flare', area: 'safety' },
  { id: 'rover', t: 'Repair the lunar rover', area: 'mobility' },
  { id: 'antenna', t: 'Build the laser comms terminal and send your base report', area: 'comms' },
];

// ---- Science samples (collect with E, analyse in the habitat's geology glovebox) --------------------------
// where: 'crater' = on the dark crater floor, 'rim' = near the crater rim, 'far' = out on the plains
export const SAMPLES = [
  { id: 'icecore', n: 'Ice core', where: 'crater', rp: 3, fact: 'In 2009 NASA crashed the LCROSS impactor into Cabeus crater near the south pole. The plume held about 5.6% water by mass.' },
  { id: 'psr', n: 'Frozen regolith', where: 'crater', rp: 2, fact: 'Permanently shadowed soil traps volatiles such as water, carbon monoxide, ammonia and mercury: a frozen record of comets and the solar wind.' },
  { id: 'anorthosite', n: 'Highland anorthosite', where: 'rim', rp: 2, fact: 'The bright lunar highlands are anorthosite, rock that floated to the top of an ancient magma ocean. Apollo 15’s “Genesis Rock” is about 4.46 billion years old.' },
  { id: 'glass', n: 'Impact glass beads', where: 'far', rp: 2, fact: 'Tiny glass beads made by impacts can hold water from the solar wind. Samples from China’s Chang’e 5 (2020) showed this in 2023.' },
  { id: 'breccia', n: 'Impact breccia', where: 'rim', rp: 1, fact: 'Breccia is rock smashed apart by impacts and welded back together by the heat and pressure. It is the most common rock Apollo brought home.' },
  { id: 'orange', n: 'Volcanic orange glass', where: 'far', rp: 2, fact: 'Apollo 17 found orange glass from “fire fountain” eruptions about 3.6 billion years ago. The Moon was volcanically active then.' },
  { id: 'zap', n: 'Micrometeorite “zap pit” rock', where: 'far', rp: 1, fact: 'Without air, even dust-sized meteorites hit at kilometres per second, leaving tiny glass-lined “zap pits” on lunar rocks.' },
  { id: 'he3', n: 'Solar-wind regolith', where: 'far', rp: 1, fact: 'Lunar soil holds helium-3 and hydrogen implanted by the solar wind over billions of years. Helium-3 is studied as a possible fusion fuel.' },
];
// What research points buy (at the glovebox). mult changes a number in SUIT/JET/GATHER/DUST.
export const UPGRADES = [
  { id: 'tank', n: 'Bigger oxygen tank', cost: 3, desc: 'Suit oxygen lasts 30% longer.' },
  { id: 'cell', n: 'Better suit battery', cost: 3, desc: 'Suit power lasts 30% longer.' },
  { id: 'thrust', n: 'Efficient thrusters', cost: 2, desc: 'Jetpack fuel lasts 50% longer.' },
  { id: 'tools', n: 'Better tools', cost: 2, desc: 'Gather and salvage 30% faster.' },
  { id: 'lotus', n: 'Lotus dust coating', cost: 3, desc: 'Dust sticks to solar panels 60% slower. (NASA tested a “Lotus” coating on the HDU.)' },
];

// ---- Food and water ----------------------------------------------------------------------------------
// The atrium's plants need water and power. Water comes from melting the ice you bring back.
export const FOOD = { foodMin: 30, waterMin: 20, starve: .6,   // minutes until empty; health lost per second when one is empty
  meal: 35, drink: 40,                                           // how much one meal / one drink refills (%)
  growSec: 50, growWater: 3, mealsMax: 12,                       // one meal grows every 50 s if the base has power and 3 water
  waterPerIce: 25,                                               // water from each ice (besides the oxygen)
  start: { meals: 4, water: 40 } };                              // what your lander carries

// ---- Lunar dust on solar panels ----------------------------------------------------------------------
// Lunar dust is sharp, clingy and electrically charged. It cuts the power of dusty panels.
export const DUST = { perMin: 4, nearThrust: 25, loss: .85, cleanSec: 2 };   // % dust per minute; extra % per second when you thrust or drive within 15 m; power lost at 100% dust

// ---- Score, daily challenge and rescue --------------------------------------------------------------
export const SCORE = { perSec: 1, perGoal: 300, perSample: 150 };
// one twist per day, the same for everyone (picked from the date)
export const DAILY = [
  { id: 'flares', n: 'Flare storm', d: 'Solar flares come every 3–5 minutes.' },
  { id: 'leak', n: 'Damaged suit', d: 'You start with a leaking suit and 20% less oxygen.' },
  { id: 'shadow', n: 'Long shadows', d: 'The Sun is even lower: 2.5° above the horizon.' },
  { id: 'scarce', n: 'Scarce supplies', d: 'Supply caches hold half as much.' },
  { id: 'dusty', n: 'Dust day', d: 'Dust coats your solar panels three times faster.' },
];
export const RESCUE = { etaSec: 150 };   // seconds after you send your report until the supply ship lands
