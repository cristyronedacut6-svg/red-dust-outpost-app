/* Red Dust Outpost — Adventure Mode: fly the solar system and scan real NASA spacecraft.
   3D models: NASA 3D Resources (science.nasa.gov/3d-resources, free to use), shrunk for phones. */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/three/libs/meshopt_decoder.module.js';
import { EXTRA, VARIANTS, MOONS, PLUTO, SURF, SAMPLE_FACTS, NEWOBJ, SITES, VESTA, DEM } from './adv_data.js';
import { makeSurface, WORLD, DIVE } from './adv_surface.js';
import { RoomEnvironment } from './vendor/three/environments/RoomEnvironment.js';
import { EffectComposer } from './vendor/three/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/postprocessing/OutputPass.js';
import { ShaderPass } from './vendor/three/postprocessing/ShaderPass.js';
import { makeFX, makeRings, makeWarp, CineShader, SafeShader, rockGeo } from './adv_fx.js';
import { AUD } from './adv_audio.js';
import { planetMaterial, atmosphereMaterial, cloudMaterial, ringMaterial, updatePlanetUniforms, sunMaterial, coronaMaterial } from './adv_planet.js';
// Every model ships as .glb (GitHub Pages / app). The preview host can't serve .glb, so each also exists as embedded glTF (.json).
// Try .glb first; if it fails (404, or an HTML page instead of a model) use .json, and remember which works so later loads go straight there.
const PA = { 'international-space-station-iss-d-igoal': 'iss', 'cassiopeia-a-supernova-b-2023': 'cassiopeia-a-supernova', 'cassiopeia-a-supernova-c-2025': 'cassiopeia-a-supernova' };
let MODE = null, LODS = new Set(); const PROBE = fetch('models/nasa/lod/index.json').then(r => r.ok ? r.json() : []).then(l => { LODS = new Set(l); }).catch(() => {});
{ const _load = GLTFLoader.prototype.load;
  GLTFLoader.prototype.load = function (url, onLoad, onProg, onErr) { const m = url.match(/models\/nasa\/(?:lod\/)?([^/]+)\.glb$/); if (!m) return _load.call(this, url, onLoad, onProg, onErr);
    const js = url.replace(/[^/]+\.glb$/, (/\/lod\//.test(url) ? m[1] : (PA[m[1]] || m[1])) + '.json'), viaJson = () => _load.call(this, js, g => { MODE = 'json'; onLoad(g); }, onProg, onErr);
    if (MODE === 'json') return viaJson(); _load.call(this, url, g => { MODE = 'glb'; onLoad(g); }, onProg, () => viaJson()); }; }
THREE.Cache.enabled = false; // keeping every raw model file in memory crashed phones; the browser's HTTP cache already covers repeat loads

const G = (k, d) => { try { return window.LS ? LS.get(k, d) : (JSON.parse(localStorage.getItem('rdo2-' + k)) ?? d); } catch (e) { return d; } };
const P = (k, v) => { try { if (window.LS) LS.set(k, v); else localStorage.setItem('rdo2-' + k, JSON.stringify(v)); } catch (e) {} };
const sfx = k => { try { if (typeof snd === 'function') snd(k); } catch (e) {} };
const reward = (tp, xp) => { try { if (typeof TP !== 'undefined') { TP += tp; P('tp', TP); } if (typeof clGain === 'function' && typeof PARTY !== 'undefined') PARTY.forEach(c => clGain(c.id, xp, 1)); } catch (e) {} };

/* ---------------- the solar system (game scale, not real scale) ---------------- */
const BODIES = [
  { id: 'sun', n: 'The Sun', k: 'Star', r: 60, d: 0, a: 0, tex: 'sun', facts: ['The Sun holds about 99.8% of all the mass in the solar system.', 'Its visible surface is about 5,500 °C.', 'Sunlight takes about 8 minutes and 20 seconds to reach Earth.'] },
  { id: 'mercury', n: 'Mercury', k: 'Planet', r: 6, d: 250, a: .6, tex: 'rock', c: ['#8c8580', '#5d5752', '#b5aca4'], facts: ['Mercury is the smallest planet and the closest to the Sun.', 'A year on Mercury lasts just 88 Earth days.', 'It has no moons and almost no atmosphere.'] },
  { id: 'venus', n: 'Venus', k: 'Planet', r: 11, d: 380, a: 2.2, tex: 'gas', c: ['#e8c88a', '#d4a85e', '#f3dfae'], facts: ['Venus is the hottest planet, about 465 °C, because its thick carbon-dioxide air traps heat.', 'It spins backwards compared with most planets.', 'A day on Venus is longer than its year.'] },
  { id: 'earth', n: 'Earth', k: 'Planet', r: 12, d: 520, a: -.4, tex: 'earth', facts: ['Earth is the only world we know of with life.', 'About 71% of its surface is covered by water.', 'It is the only planet not named after a god.'] },
  { id: 'moon', n: 'The Moon', k: 'Moon of Earth', r: 3.6, at: 'earth', off: [34, 3, 10], tex: 'rock', c: ['#a9a7a2', '#6f6d69', '#cfcdc8'], facts: ['The Moon is about 384,400 km from Earth.', 'Twelve astronauts walked on it between 1969 and 1972.', 'The same side of the Moon always faces Earth.'] },
  { id: 'mars', n: 'Mars', k: 'Planet', r: 8, d: 700, a: .9, tex: 'mars', facts: ['Olympus Mons on Mars is the biggest volcano in the solar system, about 2.5 times as tall as Mount Everest.', 'Mars has two small moons, Phobos and Deimos.', 'A day on Mars is 24 hours and 37 minutes.'] },
  { id: 'ceres', n: 'Ceres', k: 'Dwarf planet', r: 3, d: 930, a: 1.8, tex: 'rock', c: ['#9a9a9e', '#5e5e64', '#d8d8dc'], facts: ['Ceres is the largest object in the asteroid belt, about 940 km across.', 'Bright salt deposits shine inside its Occator crater.', 'It was the first asteroid ever found, in 1801.'] },
  { id: 'jupiter', n: 'Jupiter', k: 'Planet', r: 40, d: 1250, a: -.9, tex: 'gas', c: ['#d9b48a', '#a8724a', '#f2e2c8', '#c98f63'], spot: 1, facts: ['Jupiter is the largest planet, more than twice as massive as all the others put together.', 'The Great Red Spot is a storm wider than Earth.', 'Jupiter has about 100 known moons.'] },
  { id: 'saturn', n: 'Saturn', k: 'Planet', r: 34, d: 1650, a: .3, tex: 'gas', c: ['#e8d3a2', '#c9ad75', '#f5e8c8'], rings: 1, facts: ['Saturn’s rings are made mostly of chunks of water ice.', 'Saturn is less dense than water.', 'It has more than 270 known moons, the most of any planet.'] },
  { id: 'uranus', n: 'Uranus', k: 'Planet', r: 20, d: 2000, a: 2.6, tex: 'gas', c: ['#a9e3ea', '#8fd0d9', '#c6eef2'], tilt: 1.7, facts: ['Uranus is tipped over by about 98 degrees, so it rolls around the Sun on its side.', 'Only one spacecraft has visited it: Voyager 2, in 1986.', 'It is an ice giant, made mostly of water, methane and ammonia ices.'] },
  { id: 'neptune', n: 'Neptune', k: 'Planet', r: 19, d: 2300, a: -1.9, tex: 'gas', c: ['#4f6fe0', '#3a52b8', '#7d97f0'], facts: ['Neptune has the fastest winds in the solar system, about 2,000 km/h.', 'Voyager 2 is the only spacecraft to have visited it, in 1989.', 'It was found in 1846 using math before anyone saw it.'] },
];
BODIES.push(PLUTO, VESTA, ...MOONS.map(m => ({ ...m, c: ['#8a8a8e', '#5e5e64', '#c8c8cc'] })));
const NASA_TEX = new Set(['earth', 'jupiter', 'mars', 'neptune', 'saturn', 'venus', 'pluto', ...MOONS.map(m => m.id).filter(id => id !== 'triton' && id !== 'moon')]);
const BI = {}; BODIES.forEach(b => BI[b.id] = b);
// spacecraft: at = the body they belong to; orb = orbit around it; surf = on its surface (lat, lon in degrees); pos = free space (relative to a body)
const OBJS = [
  { id: 'iss', n: 'International Space Station', at: 'earth', orb: [21, .35, .5], sz: 3.4, k: 'Space station', ag: 'NASA, Roscosmos, ESA, JAXA, CSA', yr: 1998, facts: ['People have lived on board without a break since 2 November 2000.', 'It circles Earth about 16 times a day, around 400 km up.', 'It is about as long as a football field.'] },
  { id: 'emu', n: 'Spacewalk Suit (EMU)', at: 'earth', orb: [21, .35, .62], sz: 1, k: 'Spacesuit', ag: 'NASA', yr: 1983, facts: ['The Extravehicular Mobility Unit is the suit astronauts wear for spacewalks.', 'It is like a tiny spacecraft, with its own air, power, cooling and radio.', 'It was first used from the Space Shuttle in 1983.'] },
  { id: 'hubble', n: 'Hubble Space Telescope', at: 'earth', orb: [24, -.25, 2.1], sz: 2.6, k: 'Space telescope', ag: 'NASA & ESA', yr: 1990, facts: ['Hubble was carried to orbit by Space Shuttle Discovery on 24 April 1990.', 'Astronauts visited it five times to repair and upgrade it.', 'Its 2.4 m mirror helped measure how fast the universe is expanding.'] },
  { id: 'shuttle', n: 'Space Shuttle', at: 'earth', orb: [27, .15, 3.4], sz: 3.4, k: 'Reusable spacecraft', ag: 'NASA', yr: 1981, facts: ['The Shuttle flew 135 missions between 1981 and 2011.', 'Five orbiters flew in space: Columbia, Challenger, Discovery, Atlantis and Endeavour.', 'It launched like a rocket and landed like a glider.'] },
  { id: 'skylab', n: 'Skylab', at: 'earth', orb: [30, .5, 4.5], sz: 2.6, k: 'Space station (historic)', ag: 'NASA', yr: 1973, facts: ['Skylab was America’s first space station, launched on 14 May 1973.', 'Three crews lived on board.', 'It fell back to Earth in 1979, over Western Australia.'] },
  { id: 'mir', n: 'Mir', at: 'earth', orb: [32, -.45, 5.6], sz: 3, k: 'Space station (historic)', ag: 'Soviet Union / Russia', yr: 1986, facts: ['Mir’s first module launched in February 1986.', 'US Space Shuttles docked with Mir nine times in the Shuttle–Mir program.', 'It was brought down safely into the Pacific Ocean in 2001.'] },
  { id: 'chandra', n: 'Chandra X-ray Observatory', at: 'earth', orb: [38, .7, 1.2], sz: 2.6, k: 'X-ray telescope', ag: 'NASA', yr: 1999, facts: ['Chandra was launched on Space Shuttle Columbia on 23 July 1999.', 'That flight was the first commanded by a woman, Eileen Collins.', 'It sees X-rays from black holes, exploded stars and hot gas.'] },
  { id: 'landsat8', n: 'Landsat 8', at: 'earth', orb: [19, 1.2, .9], sz: 1.8, k: 'Earth-watching satellite', ag: 'NASA & USGS', yr: 2013, facts: ['Landsat 8 launched on 11 February 2013.', 'The Landsat program has photographed Earth since 1972, the longest record from space.', 'Its pictures track forests, farms, cities and ice.'] },
  { id: 'fermi', n: 'Fermi Gamma-ray Space Telescope', at: 'earth', orb: [22, -1, 4], sz: 2, k: 'Gamma-ray telescope', ag: 'NASA', yr: 2008, facts: ['Fermi launched on 11 June 2008.', 'It maps the sky in gamma rays, the most energetic light.', 'It spotted the gamma-ray flash from two neutron stars colliding in 2017.'] },
  { id: 'sdo', n: 'Solar Dynamics Observatory', at: 'earth', orb: [35, .25, 2.8], sz: 2, k: 'Sun-watching satellite', ag: 'NASA', yr: 2010, facts: ['SDO launched on 11 February 2010.', 'It photographs the Sun in many colours of light every few seconds.', 'Its images help forecast solar flares.'] },
  { id: 'tess', n: 'TESS', at: 'earth', orb: [44, .9, 3.9], sz: 1.6, k: 'Planet hunter', ag: 'NASA', yr: 2018, facts: ['The Transiting Exoplanet Survey Satellite launched on 18 April 2018.', 'It looks for tiny dips in starlight when planets pass in front of nearby stars.', 'It has found hundreds of new planets.'] },
  { id: 'saturnv', n: 'Saturn V', at: 'earth', surf: [28.6, -80.6], sz: 3.6, k: 'Moon rocket', ag: 'NASA', yr: 1967, facts: ['The Saturn V stood 110.6 m tall, taller than the Statue of Liberty.', 'It launched 13 times between 1967 and 1973.', 'It sent every Apollo crew to the Moon and launched Skylab.'] },
  { id: 'dscovr', n: 'DSCOVR', at: 'earth', l: [-52, 0, 0], sz: 1.6, k: 'Space-weather satellite at L1', ag: 'NOAA & NASA', yr: 2015, facts: ['DSCOVR sits about 1.5 million km from Earth, toward the Sun.', 'Its EPIC camera takes full pictures of Earth’s sunlit side.', 'It warns us when solar storms are coming.'] },
  { id: 'soho', n: 'SOHO', at: 'earth', l: [-58, 6, 6], sz: 2, k: 'Sun observatory at L1', ag: 'ESA & NASA', yr: 1995, facts: ['SOHO launched on 2 December 1995.', 'It has found more than 5,000 comets, more than anyone in history.', 'It watches the Sun from about 1.5 million km away from Earth.'] },
  { id: 'jwst', n: 'James Webb Space Telescope', at: 'earth', l: [56, 4, -4], sz: 3.6, k: 'Infrared space telescope at L2', ag: 'NASA, ESA & CSA', yr: 2021, facts: ['Webb launched on 25 December 2021.', 'Its gold-coated mirror is 6.5 m across and made of 18 segments.', 'It orbits about 1.5 million km from Earth, away from the Sun.'] },
  { id: 'roman', n: 'Nancy Grace Roman Space Telescope', at: 'earth', l: [62, -6, 6], sz: 3, k: 'Wide-field space telescope', ag: 'NASA', yr: null, facts: ['Roman is named after Nancy Grace Roman, NASA’s first chief of astronomy, called the “mother of Hubble”.', 'Its view of the sky is about 100 times wider than Hubble’s infrared camera.', 'It is built to study dark energy and find thousands of planets.'] },
  { id: 'spitzer', n: 'Spitzer Space Telescope', at: 'earth', l: [-10, 2, -70], sz: 2, k: 'Infrared telescope (retired)', ag: 'NASA', yr: 2003, facts: ['Spitzer launched on 25 August 2003 and followed Earth around the Sun.', 'It helped show that the star TRAPPIST-1 has seven Earth-sized planets.', 'It was switched off in January 2020.'] },
  { id: 'kepler', n: 'Kepler', at: 'earth', l: [8, -3, -84], sz: 2, k: 'Planet hunter (retired)', ag: 'NASA', yr: 2009, facts: ['Kepler launched on 7 March 2009.', 'It found more than 2,600 confirmed planets around other stars.', 'It ran out of fuel and was retired in 2018.'] },
  { id: 'lm', n: 'Apollo Lunar Module', at: 'moon', surf: [.67, 23.47], sz: 1.5, k: 'Moon lander', ag: 'NASA', yr: 1969, facts: ['On 20 July 1969 the Lunar Module Eagle landed in the Sea of Tranquility.', 'Neil Armstrong and Buzz Aldrin walked on the Moon while Michael Collins orbited above.', 'Six Apollo missions landed on the Moon.'] },
  { id: 'lro', n: 'Lunar Reconnaissance Orbiter', at: 'moon', orb: [7, .4, 0], sz: 1.2, k: 'Moon orbiter', ag: 'NASA', yr: 2009, facts: ['LRO launched on 18 June 2009.', 'It has mapped the Moon in great detail.', 'It photographed the Apollo landing sites, even the astronauts’ footpaths.'] },
  { id: 'ladee', n: 'LADEE', at: 'moon', orb: [6, -.6, 2], sz: 1, k: 'Moon orbiter (ended)', ag: 'NASA', yr: 2013, facts: ['LADEE studied the Moon’s very thin atmosphere and dust.', 'It launched on 6 September 2013.', 'It was steered into the Moon on purpose in April 2014.'] },
  { id: 'clementine', n: 'Clementine', at: 'moon', orb: [8.5, 1, 4], sz: 1, k: 'Moon mapper (historic)', ag: 'US Department of Defense & NASA', yr: 1994, facts: ['Clementine mapped the Moon in 1994.', 'Its radar gave early hints of ice in dark craters at the Moon’s poles.', 'It tested new lightweight space technology.'] },
  { id: 'gateway', n: 'Gateway', at: 'moon', orb: [12, .9, 1], sz: 2.8, k: 'Planned lunar space station', ag: 'NASA & partners', yr: null, facts: ['Gateway is a planned small space station orbiting the Moon for the Artemis program.', 'Astronauts would stop there on the way to and from the Moon’s surface.', 'Its future has been under review by NASA.'] },
  { id: 'perseverance', n: 'Perseverance Rover', at: 'mars', surf: [18.4, 77.5], sz: 1.3, k: 'Mars rover', ag: 'NASA', yr: 2020, facts: ['Perseverance landed in Jezero Crater on 18 February 2021.', 'It drills rock cores and seals them in tubes for a future trip to Earth.', 'Its MOXIE experiment made oxygen out of the Martian air.'] },
  { id: 'ingenuity', n: 'Ingenuity Helicopter', at: 'mars', surf: [18.9, 77.9], hov: 1.2, sz: .8, k: 'Mars helicopter', ag: 'NASA', yr: 2020, facts: ['On 19 April 2021 Ingenuity made the first powered flight on another planet.', 'It was meant to fly 5 times but flew 72.', 'It weighs just 1.8 kg on Earth.'] },
  { id: 'opportunity', n: 'Opportunity Rover', at: 'mars', surf: [-1.95, -5.5], sz: 1.1, k: 'Mars rover (ended)', ag: 'NASA', yr: 2003, facts: ['Opportunity landed on 25 January 2004 and was built to last 90 Mars days.', 'It kept going for almost 15 years and drove more than a marathon, 45 km.', 'A huge dust storm ended its mission in 2018.'] },
  { id: 'insight', n: 'InSight Lander', at: 'mars', surf: [4.5, 135.6], sz: 1.3, k: 'Mars lander (ended)', ag: 'NASA', yr: 2018, facts: ['InSight landed on 26 November 2018.', 'Its seismometer detected more than 1,300 marsquakes.', 'Dust on its solar panels ended the mission in December 2022.'] },
  { id: 'viking', n: 'Viking 1 Lander', at: 'mars', surf: [22.3, -49.9], sz: 1.2, k: 'Mars lander (historic)', ag: 'NASA', yr: 1975, facts: ['Viking 1 landed on 20 July 1976, the first successful US landing on Mars.', 'It sent the first pictures from the surface of Mars.', 'It ran experiments that looked for signs of life in the soil.'] },
  { id: 'mro', n: 'Mars Reconnaissance Orbiter', at: 'mars', orb: [13, .5, 1], sz: 1.6, k: 'Mars orbiter', ag: 'NASA', yr: 2005, facts: ['MRO launched on 12 August 2005.', 'Its HiRISE camera can see things on Mars about as small as a kitchen table.', 'It relays messages from rovers back to Earth.'] },
  { id: 'odyssey', n: 'Mars Odyssey', at: 'mars', orb: [15, -.4, 3.2], sz: 1.6, k: 'Mars orbiter', ag: 'NASA', yr: 2001, facts: ['2001 Mars Odyssey is the longest-working spacecraft at Mars.', 'It found signs of lots of water ice under the surface.', 'It still relays data from the rovers.'] },
  { id: 'messenger', n: 'MESSENGER', at: 'mercury', orb: [12, .6, 0], sz: 1.6, k: 'Mercury orbiter (ended)', ag: 'NASA', yr: 2004, facts: ['MESSENGER became the first spacecraft to orbit Mercury, in March 2011.', 'It found water ice hiding in shadowed craters near Mercury’s poles.', 'It crashed into Mercury on purpose in April 2015.'] },
  { id: 'magellan', n: 'Magellan', at: 'venus', orb: [18, .4, 1], sz: 2, k: 'Venus radar mapper (historic)', ag: 'NASA', yr: 1989, facts: ['Magellan launched from Space Shuttle Atlantis on 4 May 1989.', 'Its radar saw through Venus’s clouds and mapped 98% of the surface.', 'It finished its mission in 1994.'] },
  { id: 'parker', n: 'Parker Solar Probe', at: 'sun', orb: [110, .2, 1], sz: 2, k: 'Sun-touching probe', ag: 'NASA', yr: 2018, facts: ['Parker launched on 12 August 2018 to fly through the Sun’s outer atmosphere.', 'On 24 December 2024 it passed about 6.1 million km from the Sun’s surface.', 'It is the fastest object ever built, about 690,000 km/h.'] },
  { id: 'bennu', n: 'Asteroid Bennu', at: 'earth', l: [40, 10, 120], sz: 2.4, k: 'Near-Earth asteroid', ag: '', yr: null, facts: ['Bennu is a pile of rubble about 490 m wide.', 'It was named by a 9-year-old student in a naming contest.', 'Rocks from Bennu were brought to Earth by OSIRIS-REx.'] },
  { id: 'osirisrex', n: 'OSIRIS-REx', at: 'earth', l: [50, 14, 128], sz: 1.6, k: 'Asteroid sample mission', ag: 'NASA', yr: 2016, facts: ['OSIRIS-REx touched Bennu on 20 October 2020 and grabbed rocks and dust.', 'Its capsule landed in Utah on 24 September 2023 with about 121 grams of sample.', 'It is now heading to the asteroid Apophis as OSIRIS-APEX.'] },
  { id: 'near', n: 'NEAR Shoemaker', at: 'mars', l: [60, -8, -50], sz: 1.6, k: 'Asteroid lander (historic)', ag: 'NASA', yr: 1996, facts: ['NEAR Shoemaker was the first spacecraft to orbit an asteroid, Eros, in 2000.', 'On 12 February 2001 it became the first to land on one.', 'It was not built to land, but it survived the touchdown.'] },
  { id: 'deepimpact', n: 'Deep Impact', at: 'earth', l: [-90, 20, 60], sz: 2, k: 'Comet mission (ended)', ag: 'NASA', yr: 2005, facts: ['On 4 July 2005 Deep Impact fired a copper impactor into Comet Tempel 1.', 'The crash threw out a cloud of material that the spacecraft studied.', 'It later flew past a second comet, Hartley 2.'] },
  { id: 'stardust', n: 'Stardust', at: 'mars', l: [-70, 12, 70], sz: 1.6, k: 'Comet sample mission (ended)', ag: 'NASA', yr: 1999, facts: ['Stardust caught dust from Comet Wild 2 in a super-light material called aerogel.', 'Its capsule landed in Utah on 15 January 2006.', 'It was the first mission to bring comet dust to Earth.'] },
  { id: 'rosetta', n: 'Rosetta', at: 'ceres', l: [-60, 20, -40], sz: 2.2, k: 'Comet orbiter (ended)', ag: 'ESA (with NASA instruments)', yr: 2004, facts: ['Rosetta orbited Comet 67P from 2014 to 2016.', 'Its lander Philae made the first landing on a comet on 12 November 2014.', 'NASA provided three instruments on board.'] },
  { id: 'dawn', n: 'Dawn', at: 'ceres', orb: [8, .5, 0], sz: 1.8, k: 'Asteroid belt explorer (ended)', ag: 'NASA', yr: 2007, facts: ['Dawn was the first spacecraft to orbit two different worlds beyond Earth: Vesta and Ceres.', 'It used gentle ion engines to change orbits.', 'It ran out of fuel in 2018 and still circles Ceres.'] },
  { id: 'juno', n: 'Juno', at: 'jupiter', orb: [58, .9, 0], sz: 2.8, k: 'Jupiter orbiter', ag: 'NASA', yr: 2011, facts: ['Juno arrived at Jupiter on 4 July 2016.', 'It runs on solar power, even that far from the Sun.', 'It flies over Jupiter’s poles to study what is inside the planet.'] },
  { id: 'galileo', n: 'Galileo', at: 'jupiter', orb: [70, -.3, 2.4], sz: 2.4, k: 'Jupiter orbiter (historic)', ag: 'NASA', yr: 1989, facts: ['Galileo was the first spacecraft to orbit Jupiter, from 1995.', 'It dropped a probe into Jupiter’s clouds.', 'It found strong signs of a salty ocean under Europa’s ice.'] },
  { id: 'cassini', n: 'Cassini–Huygens', at: 'saturn', orb: [64, .35, 1], sz: 3, k: 'Saturn orbiter (historic)', ag: 'NASA, ESA & ASI', yr: 1997, facts: ['Cassini orbited Saturn from 2004 to 2017.', 'Its passenger, the Huygens probe, landed on Titan on 14 January 2005.', 'It found jets of water shooting out of the moon Enceladus.'] },
  { id: 'pioneer10', n: 'Pioneer 10', at: 'neptune', l: [-160, 30, 220], sz: 2.2, k: 'Deep-space probe (historic)', ag: 'NASA', yr: 1972, facts: ['Pioneer 10 was the first spacecraft to cross the asteroid belt and fly past Jupiter, in 1973.', 'It carries a plaque with a message for anyone who finds it.', 'Its last signal reached Earth in 2003.'] },
  { id: 'voyager', n: 'Voyager 1', at: 'neptune', l: [240, 40, -260], sz: 3, k: 'Interstellar probe', ag: 'NASA', yr: 1977, facts: ['Voyager 1 launched on 5 September 1977.', 'In 2012 it became the first spacecraft to reach interstellar space.', 'It carries a Golden Record of sounds and pictures from Earth.'] },
];
function zone(o, i) { const h1 = hash(i, 7), h2 = hash(i, 13), h3 = hash(i, 29), T = 6.283;
  switch (o.z) {
    case 'eo': return { at: 'earth', orb: [17 + h1 * 17, (h2 - .5) * 2.4, h3 * T], sz: 1.7 };
    case 'high': return { at: 'earth', orb: [40 + h1 * 16, (h2 - .5) * 2, h3 * T], sz: 1.9 };
    case 'geo': return { at: 'earth', orb: [62 + h1 * 5, (h2 - .5) * .1, h3 * T], sz: 1.9 };
    case 'iss': case 'item': return { at: 'earth', rel: 'iss', l: [(h1 - .5) * 12, (h2 - .5) * 7, (h3 - .5) * 12], sz: o.z === 'item' ? .7 : .9 };
    case 'hubble': return { at: 'earth', rel: 'hubble', l: [(h1 - .5) * 8, 2 + h2 * 3, (h3 - .5) * 8], sz: 1 };
    case 'l1': return { at: 'earth', l: [-46 - h1 * 18, (h2 - .5) * 16, (h3 - .5) * 22], sz: 1.8 };
    case 'l2': return { at: 'earth', l: [52 + h1 * 22, (h2 - .5) * 16, (h3 - .5) * 22], sz: 2.6 };
    case 'deep': return { at: 'sun', orb: [560 + h1 * 120, (h2 - .5) * .3, h3 * T], sz: 2.2 };
    case 'moon': return { at: 'moon', orb: [9 + h1 * 5, (h2 - .5) * 2, h3 * T], sz: 1.1 };
    case 'marsorb': return { at: 'mars', orb: [17 + h1 * 7, (h2 - .5) * 2, h3 * T], sz: 1.7 };
    case 'mars': return { at: 'mars', land: 'mars', sz: 2 };
    case 'ground': case 'suit': case 'air': return { at: 'earth', land: 'earth', sz: 2 };
    case 'sky': { const a = i * 1.7, R0 = 3000 + h1 * 600; return { at: 'sun', l: [Math.cos(a) * R0, (h2 - .5) * 500, Math.sin(a) * R0], sz: 120 + h3 * 90, far: 1 }; }
    case 'outer2': return { at: 'neptune', l: [-300, -60, 300], sz: 3 };
    case 'mars-site': case 'item-mars': return { at: 'mars', land: 'mars', sz: 2 };
    case 'titan': return { at: 'titan', land: 'titan', sz: 2 };
    case 'badge': return { at: 'earth', land: 'earth', sz: 2 };
    case 'pluto': return { at: 'pluto', l: [9, 3, -7], sz: 2 };
    case 'moonorb': return { at: 'moon', orb: [11 + h1 * 4, (h2 - .5) * 1.6, h3 * T], sz: 1.4 };
    case 'europa': return { at: 'europa', l: [6, 2, 5], sz: 1.8 };
    case 'ast': return o.id === 'ast-kleopatra' ? { at: 'sun', orb: [900 + h1 * 70, (h2 - .5) * .1, h3 * T], sz: 9 } : { at: 'sun', orb: [500 + h1 * 160, (h2 - .5) * .25, h3 * T], sz: 5 + h2 * 3 };
    case 'storm': return { at: 'earth', l: [(h1 - .5) * 70, 22 + h2 * 8, (h3 - .5) * 70], sz: 5 };
  } return { at: 'earth', orb: [30, .3, h3 * T], sz: 1.6 }; }
EXTRA.forEach((e, i) => OBJS.push({ ...e, ...zone(e, i) })); NEWOBJ.forEach((e, i) => OBJS.push({ ...e, ...zone(e, i + 300) }));
// Earth-surface items that already float in space (Saturn V) also stand at Kennedy
const OI = {}; OBJS.forEach(o => OI[o.id] = o);
VARIANTS.forEach((v, i) => { const b = OI[v.base]; if (!b) return; const o = { ...b, id: v.id, n: b.n + ' ' + v.n, variant: 1 }; if (b.orb) o.orb = [b.orb[0] + 1.5, b.orb[1], b.orb[2] + .25]; else if (b.l) o.l = [b.l[0] + 4, b.l[1] + 2, b.l[2] + 4]; else if (b.surf) o.surf = [b.surf[0] + 1, b.surf[1] + 1]; OBJS.push(o); OI[o.id] = o; });
const ALL = [...BODIES.map(b => ({ ...b, body: 1 })), ...OBJS];
const MISSIONS = [
  { t: 'Leave home: scan the ISS and Hubble near Earth', need: ['iss', 'hubble'] },
  { t: 'Land on Earth at Kennedy Space Center and scan the Saturn V and the VAB', need: ['land:earth', 'saturnv', 'vehicle-assembly-building-vab'] },
  { t: 'Find 3 lost spacewalk tools floating near the ISS', need: ['hammer', 'wrench', 'pistol-grip-tool'] },
  { t: 'Land on the Moon and scan the Apollo Lunar Module', need: ['land:moon', 'lm'] },
  { t: 'Land on Mars: find Perseverance and Ingenuity in Jezero Crater', need: ['land:mars', 'perseverance', 'ingenuity'] },
  { t: 'Land in Gale Crater (real NASA terrain) and scan the Curiosity rover', need: ['site:mars:gale', 'curiosity'] },
  { t: 'Walk Apollo 15’s Hadley–Apennine site, then land on asteroid Vesta', need: ['site:moon:apollo15', 'land:vesta'] },
  { t: 'Dive into Jupiter’s clouds, then land on Europa', need: ['dive:jupiter', 'land:europa'] },
  { t: 'At Saturn, scan Cassini and land on Titan', need: ['cassini', 'land:titan'] },
  { t: 'The edge: find Voyager 1 and Voyager 2 beyond Neptune', need: ['voyager', 'voyager-probe-b'] },
  { t: 'Reach Pluto and stand on its frozen heart', need: ['land:pluto'] },
];
const done = id => id.includes(':') ? ST.flags.has(id) : ST.scanned.has(id);

/* ---------------- procedural planet textures ---------------- */
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, o = 5) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); a *= .5; f *= 2; } return s; }
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const TL = new THREE.TextureLoader();
function texFor(b, mat) { const t = texProc(b); if (NASA_TEX.has(b.id) && mat) TL.load('models/tex/' + b.id + '.webp', nt => { nt.colorSpace = THREE.SRGBColorSpace; nt.anisotropy = 4; mat.map = nt; mat.needsUpdate = true; }); return t; }
function texProc(b) { if (b.tex === 'nasa') b = { ...b, tex: 'rock' }; if (!b.c && b.tex === 'rock') b = { ...b, c: ['#8a8a8e', '#5e5e64', '#c8c8cc'] };
  const W = b.r >= 10 ? 512 : 256, H = W / 2, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), im = g.createImageData(W, H), D = im.data, seed = b.d || 7;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const lon = x / W * Math.PI * 2, lat = y / H, nx = Math.cos(lon) * 2 + seed, nz = Math.sin(lon) * 2; let r, gg, bb;
    if (b.tex === 'earth') { const n = fbm(nx * 1.4, nz * 1.4 + lat * 6, 6), land = n > .52, ice = lat < .08 || lat > .92, cl = fbm(nx * 2 + 9, nz * 2 + lat * 9, 4) > .62;
      [r, gg, bb] = ice ? [235, 242, 250] : land ? (n > .62 ? [140, 120, 80] : [70, 130, 60]) : [25, 70, 150 + n * 60]; if (cl) { r = r * .3 + 180; gg = gg * .3 + 180; bb = bb * .3 + 180; } }
    else if (b.tex === 'mars') { const n = fbm(nx * 1.6, nz * 1.6 + lat * 5, 6), cap = lat < .07 || lat > .94; [r, gg, bb] = cap ? [240, 236, 230] : [170 + n * 70, 80 + n * 40, 45 + n * 20]; if (n < .38 && !cap) { r *= .7; gg *= .7; bb *= .7; } }
    else if (b.tex === 'gas') { const C = b.c.map(hex), w = lat * 10 + fbm(nx, nz + lat * 3, 4) * 2.2, k = Math.floor(w) % C.length, f = w - Math.floor(w), c1 = C[k], c2 = C[(k + 1) % C.length];
      [r, gg, bb] = [0, 1, 2].map(i => c1[i] + (c2[i] - c1[i]) * f * f);
      if (b.spot) { const dx = (x / W - .3) * 2.4, dy = (lat - .62) * 5, dd = dx * dx + dy * dy; if (dd < 1) { const k2 = 1 - dd; r = r * (1 - k2) + 190 * k2; gg = gg * (1 - k2) + 80 * k2; bb = bb * (1 - k2) + 60 * k2; } } }
    else if (b.tex === 'sun') { const n = fbm(nx * 3, nz * 3 + lat * 8, 5); [r, gg, bb] = [255, 170 + n * 80, 60 + n * 60]; }
    else { const C = b.c.map(hex), n = fbm(nx * 2, nz * 2 + lat * 6, 6), cr = vnoise(nx * 9, nz * 9 + lat * 30) > .78 ? .7 : 1; [r, gg, bb] = [0, 1, 2].map(i => (C[1][i] + (C[2][i] - C[1][i]) * n) * cr); }
    const o = (y * W + x) * 4; D[o] = r; D[o + 1] = gg; D[o + 2] = bb; D[o + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTex(c1, c2) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, c1); gr.addColorStop(.35, c2); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); }

/* ---------------- state ---------------- */
let R = null; // everything created once
// Graphics presets, like Genshin's: each sets resolution, anti-aliasing, shadows, scenery density and how much full-detail NASA geometry/texture memory may be loaded at once.
const PRESETS = {
  low:    { n: 'Low',    dpr: 1,   msaa: 0, shadow: 1024, grass: 6000,  rocks: .25, tris: 1.5e6, tex: 260, full: .6, bloom: .3, seg: 200, fx: .6 },
  medium: { n: 'Medium', dpr: 1.25, msaa: 2, shadow: 1024, grass: 12000, rocks: .5,  tris: 3e6,   tex: 420, full: .8, bloom: .4, seg: 260, fx: .8 },
  high:   { n: 'High',   dpr: 1.5, msaa: 2, shadow: 2048, grass: 20000, rocks: .75, tris: 6e6,   tex: 700, full: 1,  bloom: .42, seg: 320, fx: 1 },
  max:    { n: 'Max',    dpr: 2,   msaa: 4, shadow: 4096, grass: 30000, rocks: 1,   tris: 14e6,  tex: 1400, full: 1.25, bloom: .45, seg: 420, fx: 1.5 } };
const PHONE = matchMedia('(pointer:coarse)').matches;
let GFX = G('adv_gfx', null); if (!PRESETS[GFX]) GFX = PHONE ? 'medium' : 'high'; const PRE = () => PRESETS[GFX];
const SET = Object.assign({ cap: 60, scale: 100, fps: 0, voice: 1 }, G('adv_set', {}));
// compatibility: older code paths read Q
let Q = GFX === 'max' ? 'ultra' : 'high'; const QL = { ultra: 'Max', high: 'High' };
const ST = { on: false, scanned: new Set(G('adv_scan', [])), flags: new Set(G('adv_flags', [])), mi: G('adv_mis2', 0), seen: G('adv_seen', 0) };
const save = () => { P('adv_scan', [...ST.scanned]); P('adv_mis2', ST.mi); P('adv_flags', [...ST.flags]); };

function css() {
  const s = document.createElement('style'); s.textContent = `
#adv{position:fixed;inset:0;z-index:200;background:#000;color:#fff;font-family:var(--disp,system-ui);touch-action:none;user-select:none;-webkit-user-select:none}
#adv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#adv .ab{position:absolute;border:1px solid rgba(255,255,255,.25);background:rgba(10,14,30,.65);color:#fff;border-radius:12px;font:700 12px var(--disp,system-ui);padding:7px 11px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#adv #aTop{position:absolute;top:calc(8px + env(safe-area-inset-top));right:calc(8px + env(safe-area-inset-right));display:flex;gap:6px}#adv #aTop .ab{position:static}
#adv #aMis{position:absolute;left:calc(10px + env(safe-area-inset-left));top:calc(8px + env(safe-area-inset-top));max-width:min(360px,52vw);background:rgba(10,14,30,.6);border:1px solid rgba(125,249,255,.35);border-radius:12px;padding:6px 10px;font-size:12px;line-height:1.3}
#adv #aMis b{display:block;font-size:9.5px;letter-spacing:.14em;color:#7df9ff}
#adv #aSpd{position:absolute;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);font:700 11px var(--disp,system-ui);color:#cfe6ff;background:rgba(10,14,30,.55);padding:4px 10px;border-radius:10px;white-space:nowrap}
#adv .lab{position:absolute;transform:translate(-50%,-130%);font:700 11px var(--disp,system-ui);color:#fff;text-shadow:0 1px 3px #000,0 0 6px #000;white-space:nowrap;pointer-events:none}
#adv .lab.u{color:#ffcf4a}#adv .lab.b{color:#9fd8ff;font-size:12.5px}#adv .lab small{opacity:.75;font-weight:600;margin-left:4px}
#adv #aJoy{position:absolute;left:0;bottom:0;width:45%;height:60%}
#adv #aJoy .k{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.06);display:none}
#adv #aJoy .k i{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;background:rgba(125,249,255,.5)}
#adv .rbtn{position:absolute;border-radius:50%;display:grid;place-items:center;text-align:center;font:800 10px var(--disp,system-ui);border:2px solid rgba(255,255,255,.35);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.5);line-height:1.1}
#adv #aThr{right:calc(16px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));width:84px;height:84px;background:radial-gradient(circle at 35% 30%,#7df9ff,#1a6fb0)}
#adv #aBst{right:calc(110px + env(safe-area-inset-right));bottom:calc(14px + env(safe-area-inset-bottom));width:60px;height:60px;background:radial-gradient(circle at 35% 30%,#ffb36b,#c8482a)}
#adv #aScn{right:calc(40px + env(safe-area-inset-right));bottom:calc(114px + env(safe-area-inset-bottom));width:64px;height:64px;background:radial-gradient(circle at 35% 30%,#ffe27a,#c79a10);opacity:.4}
#adv #aScn.on{opacity:1;animation:apul 1s ease-in-out infinite}@keyframes apul{50%{box-shadow:0 0 0 8px rgba(255,207,74,.25)}}
#adv #aScan{position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);font:800 13px var(--disp,system-ui);color:#ffcf4a;text-shadow:0 0 10px #000;display:none}
#adv .pnl{position:absolute;inset:0;background:rgba(3,6,16,.72);display:flex;align-items:center;justify-content:center;padding:14px;z-index:5}
#adv .crd{width:min(520px,94vw);max-height:88vh;overflow:auto;background:linear-gradient(180deg,#121a33,#0a0f22);border:1px solid rgba(125,249,255,.4);border-radius:18px;padding:16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.6)}
#adv .crd .ey{font:700 10px var(--disp,system-ui);letter-spacing:.16em;color:#7df9ff}#adv .crd h2{margin:2px 0 4px;font-size:22px}#adv .crd .mt{font-size:12px;color:#c9d6ea;margin-bottom:8px}
#adv .crd ul{margin:6px 0 10px;padding-left:18px;font-size:14px;line-height:1.45}#adv .crd .nw{display:inline-block;background:#ffcf4a;color:#1a1200;border-radius:8px;padding:2px 8px;font:800 11px var(--disp,system-ui);margin-bottom:6px}
#adv .crd .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}#adv .crd button{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:8px 14px;font:700 13px var(--disp,system-ui)}
#adv .crd button.pr{background:#2f8fd8;border-color:#7df9ff}#adv .crd .src{font-size:10px;opacity:.6;margin-top:6px}
#adv .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin:8px 0}#adv .grid button{padding:8px 6px;font-size:11px;text-align:left;line-height:1.2}#adv .grid button.no{opacity:.45}
#adv .grid h4{grid-column:1/-1;margin:8px 0 0;font-size:10px;letter-spacing:.14em;color:#9fb3c8}
#adv #aToast{position:absolute;left:50%;top:22%;transform:translateX(-50%);background:rgba(10,14,30,.85);border:1px solid #ffcf4a;border-radius:12px;padding:8px 14px;font:700 13px var(--disp,system-ui);display:none;text-align:center;z-index:4}
#adv #aLand{left:50%;bottom:calc(46px + env(safe-area-inset-bottom));transform:translateX(-50%);display:none;font-size:15px;padding:10px 20px;background:linear-gradient(180deg,#ffd27a,#d89a20);color:#1a1200;border-color:#fff2c8;box-shadow:0 0 20px rgba(255,200,90,.5);animation:apul 1.2s ease-in-out infinite}
#adv .vw{position:relative;inset:auto;width:100%;height:190px;border-radius:12px;background:radial-gradient(ellipse at 50% 40%,#1c2a4a,#05070f);margin:4px 0 8px;display:block}
#adv #aLoad{position:absolute;inset:0;display:grid;place-items:center;background:#02040c;font:700 14px var(--disp,system-ui);z-index:9}
#adv #aFly{left:50%;bottom:calc(98px + env(safe-area-inset-bottom));transform:translateX(-50%);display:none;font-size:13px;padding:8px 16px;background:linear-gradient(180deg,#7df9ff,#2f8fd8);color:#03101c;border-color:#e6fdff;box-shadow:0 0 18px rgba(125,249,255,.45)}
#adv .hg{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:8px 0}#adv .hg button{text-align:left;padding:8px;font-size:11px;line-height:1.25;position:relative}#adv .hg button.sel{border-color:#ffcf4a;box-shadow:0 0 0 2px rgba(255,207,74,.5) inset}#adv .hg button.lk{opacity:.5}
#adv .hg .bar{display:flex;gap:4px;align-items:center;font-size:9px;opacity:.85;margin-top:2px}#adv .hg .bar i{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}#adv .hg .bar i b{display:block;height:100%;background:#7df9ff}
#adv #aLd{position:absolute;left:50%;top:calc(52px + env(safe-area-inset-top));transform:translateX(-50%);font:700 11px var(--disp,system-ui);color:#cfe9ff;background:rgba(5,10,24,.6);border:1px solid rgba(125,249,255,.3);border-radius:20px;padding:4px 12px;display:none;pointer-events:none}
#adv #aHud{position:absolute;inset:0;pointer-events:none;display:none}#adv #aJoy,#adv .rbtn,#adv #aTop,#adv #aLand,#adv #aFly,#adv #aMis,#adv #aSpd,#adv #aToast,#adv #aScan,#adv #aLd,#adv #aFps{z-index:3}#adv #aHud .tb{position:absolute;left:0;top:0;display:none}#adv #aHud .tb i{position:absolute;width:12px;height:12px;border:2px solid #7df9ff;filter:drop-shadow(0 0 4px rgba(125,249,255,.8))}
#adv #aHud .tb i:nth-child(2){left:0;top:0;border-right:0;border-bottom:0}#adv #aHud .tb i:nth-child(3){right:0;top:0;border-left:0;border-bottom:0}#adv #aHud .tb i:nth-child(4){left:0;bottom:0;border-right:0;border-top:0}#adv #aHud .tb i:nth-child(5){right:0;bottom:0;border-left:0;border-top:0}
#adv #aHud .tb.u i{border-color:#ffcf4a;filter:drop-shadow(0 0 4px rgba(255,207,74,.8))}#adv #aHud .tb span{position:absolute;left:50%;top:100%;transform:translate(-50%,6px);font:800 10px var(--disp,system-ui);letter-spacing:.08em;color:#cfefff;white-space:nowrap;text-shadow:0 1px 3px #000}
#adv #aHud .pg{position:absolute;left:0;top:0;width:26px;height:26px;display:none;color:#9dff9d;font:700 22px/26px system-ui;text-align:center;text-shadow:0 0 6px rgba(120,255,120,.8)}
#adv #aHud .ck{position:absolute;inset:0;display:none;background:radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,10,20,.55) 100%)}#adv #aHud .cp{position:absolute;background-size:cover;background-position:center;filter:saturate(.8);box-shadow:inset 0 0 40px rgba(0,0,0,.85)}#adv #aHud .cp.top{left:0;right:0;top:0;height:9vh;background-image:url(models/tex/cockpit2.webp);clip-path:polygon(0 0,100% 0,88% 100%,12% 100%)}#adv #aHud .cp.l{left:0;top:0;bottom:0;width:13vw;background-image:url(models/tex/cockpit3.webp);clip-path:polygon(0 0,100% 9vh,55% 78%,0 100%)}#adv #aHud .cp.r{right:0;top:0;bottom:0;width:13vw;background-image:url(models/tex/cockpit3.webp);transform:scaleX(-1);clip-path:polygon(0 0,100% 9vh,55% 78%,0 100%)}#adv #aHud .cp.dash{left:0;right:0;bottom:0;height:24vh;background-image:url(models/tex/cockpit1.webp);clip-path:polygon(0 22%,8% 0,92% 0,100% 22%,100% 100%,0 100%);display:flex;justify-content:center;align-items:flex-start;gap:2vw;padding-top:2.4vh}
#adv #aHud .mfd{width:min(22vw,180px);height:13vh;min-height:64px;background:#020c08;border:3px solid #2a2f33;border-radius:6px;box-shadow:0 0 0 2px #0a0d10,inset 0 0 18px rgba(80,255,140,.18);color:#7dff9d;font:600 clamp(8px,1.4vh,11px)/1.45 ui-monospace,monospace;padding:6px 8px;overflow:hidden;text-shadow:0 0 6px rgba(80,255,140,.6)}#adv #aHud .mfd b{display:inline-block;width:6.2em;color:#3fcf6f;font-weight:700}
#adv #aHud .ck svg{position:absolute;left:50%;top:50%;width:200px;transform:translate(-50%,-50%)}
#adv #aHeat{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:6;background:radial-gradient(ellipse at 50% 60%,rgba(255,170,80,0) 25%,rgba(255,110,30,.45) 70%,rgba(255,60,10,.75) 100%)}#adv #aHeat.w{background:#fff}
#adv.cine #aTop,#adv.cine #aJoy,#adv.cine .rbtn,#adv.cine #aLand,#adv.cine #aFly,#adv.cine #aMis,#adv.cine #aSpd,#adv.cine #labs,#adv.cine #aHud,#adv.cine #aLd{display:none!important}
#adv.photo #aTop,#adv.photo #aJoy,#adv.photo .rbtn,#adv.photo #aLand,#adv.photo #aMis,#adv.photo #aSpd,#adv.photo #labs,#adv.photo #aLd,#adv.photo #aToast{display:none!important}
#adv.photo::before,#adv.photo::after{content:'';position:absolute;left:0;right:0;height:9vh;background:#000;z-index:7;pointer-events:none}#adv.photo::before{top:0}#adv.photo::after{bottom:0}
#adv #aPh{position:absolute;inset:0;z-index:8;display:none;align-items:flex-end;justify-content:center;padding-bottom:3vh;font:700 11px var(--disp,system-ui);letter-spacing:.2em;color:rgba(255,255,255,.6)}#adv.photo #aPh{display:flex}
@media (max-width:760px){#adv #aTop{flex-wrap:wrap;justify-content:flex-end;max-width:66vw;gap:4px}#adv #aTop .ab{padding:6px 8px;font-size:11px}}
#adv #aFps{position:absolute;left:calc(10px + env(safe-area-inset-left));bottom:calc(6px + env(safe-area-inset-bottom));font:700 10px ui-monospace,monospace;color:#9dff9d;background:rgba(0,0,0,.45);padding:2px 6px;border-radius:6px;display:none;pointer-events:none;z-index:4}
#adv .seg{display:flex;gap:6px;flex-wrap:wrap}#adv .seg button.sel{border-color:#ffcf4a;background:rgba(255,207,74,.18)}#adv h4.sh{margin:12px 0 6px;font-size:10px;letter-spacing:.14em;color:#9fb3c8}
#adv #aTitle{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;pointer-events:auto;transition:opacity 1.2s;opacity:0;background:linear-gradient(transparent 70%,rgba(0,0,0,.35))}#adv #aTitle.on{opacity:1}#adv #aTitle.off{opacity:0;pointer-events:none}
#adv #aTitle .k{font:700 11px var(--disp,system-ui);letter-spacing:.5em;color:#cfe9ff;opacity:.85;animation:tIn 2s ease both}#adv #aTitle h1{margin:10px 0 6px;font:900 clamp(30px,7vw,72px)/1 var(--disp,system-ui);letter-spacing:.12em;text-shadow:0 0 30px rgba(125,249,255,.45),0 4px 20px #000;animation:tIn 2.4s .4s ease both}
#adv #aTitle .s{font:700 clamp(11px,1.8vw,15px) var(--disp,system-ui);letter-spacing:.45em;color:#ffcf4a;animation:tIn 2s 1s ease both}#adv #aTitle .m{position:absolute;bottom:12vh;font:600 11px var(--disp,system-ui);letter-spacing:.12em;opacity:.6;animation:tIn 2s 2s ease both}
@keyframes tIn{from{opacity:0;transform:translateY(10px);letter-spacing:.9em}to{opacity:1}}
#adv.intro::before,#adv.intro::after{content:'';position:absolute;left:0;right:0;height:10vh;background:#000;z-index:8;pointer-events:none}#adv.intro::before{top:0}#adv.intro::after{bottom:0}
#adv.demo #aDemo{background:#ffcf4a;color:#1a1200}
@media (hover:hover) and (pointer:fine){#adv #aJoy,#adv #aThr,#adv #aBst{display:none}#adv #aScn{right:20px;bottom:20px}}`; document.head.appendChild(s);
}

/* ---------------- build the scene ---------------- */
function build() {
  css(); try { MeshoptDecoder.useWorkers(Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))); } catch (e) {} const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); // geometry decoding runs on background threads, so loading doesn't stutter
  const root = document.createElement('div'); root.id = 'adv'; root.innerHTML = `<canvas></canvas><div id="aLoad">🚀 Preparing the solar system…</div><div id="aMis"></div><div id="aTop"><button class="ab" id="aQ"></button><button class="ab" id="aMap">🗺 Map</button><button class="ab" id="aCod">📖 Codex</button><button class="ab" id="aHan">🛠 Hangar</button><button class="ab" id="aDL" title="Download resources">⬇</button><button class="ab" id="aCam" title="Camera (V)">🎥</button><button class="ab" id="aPhoto" title="Photo mode (P)">📷</button><button class="ab" id="aDemo" title="Demo tour">🎬 Demo</button><button class="ab" id="aX">✕ Exit</button></div>
  <div id="labs"></div><div id="aJoy"><div class="k"><i></i></div></div><button class="rbtn" id="aBst">BOOST</button><button class="rbtn" id="aThr">🚀<br>THRUST</button><button class="rbtn" id="aScn">📡<br>SCAN</button><button class="ab" id="aLand"></button><button class="ab" id="aFly"></button><div id="aScan">SCANNING…</div><div id="aSpd"></div><div id="aToast"></div><div id="aLd"></div><div id="aFps"></div><div id="aHud"><div class="tb"><span></span><i></i><i></i><i></i><i></i></div><div class="pg">◎</div><div class="ck"><div class="cp top"></div><div class="cp l"></div><div class="cp r"></div><div class="cp dash"><div class="mfd" id="mfd1"></div><div class="mfd" id="mfd2"></div><div class="mfd" id="mfd3"></div></div><svg viewBox="0 0 200 120"><path d="M70 60h22M108 60h22M100 52v-10M100 68v10" stroke="#7df9ff" stroke-width="2" fill="none"/><circle cx="100" cy="60" r="3" fill="#7df9ff"/></svg></div></div><div id="aPh">📷 PHOTO MODE · tap to exit</div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), mob = matchMedia('(pointer:coarse)').matches;
  const ren = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  ren.setPixelRatio(dprCap()); ren.info.autoReset = false; ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.05;
  cv.addEventListener('webglcontextlost', ev => { ev.preventDefault(); if (R) { R.lost = true; toast('⚠ Graphics memory full: recovering…', 3000); } });
  cv.addEventListener('webglcontextrestored', () => { if (!R) return; R.lost = false; DR.s = .7; R.ren.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * .7); resize(); LQ.max = 2; toast('✅ Graphics recovered', 1800); });
  const scn = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, .1, 12000);
  // realistic reflections on the NASA models: a studio environment map, plus bloom for glowing things
  const pm = new THREE.PMREMGenerator(ren), envTex = pm.fromScene(new RoomEnvironment(), .04).texture; scn.environment = envTex; scn.environmentIntensity = .45;
  const hdrOK = ren.capabilities.isWebGL2 && (ren.extensions.has('EXT_color_buffer_float') || ren.extensions.has('EXT_color_buffer_half_float')); R_HDR = hdrOK;
  const comp = new EffectComposer(ren, new THREE.WebGLRenderTarget(4, 4, { type: hdrOK ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: hdrOK ? PRE().msaa : 0 })), rp = new RenderPass(scn, cam), bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), PRE().bloom, .4, .95), cine = new ShaderPass(CineShader); comp.addPass(rp); comp.addPass(new ShaderPass(SafeShader)); comp.addPass(bloom); comp.addPass(new OutputPass()); comp.addPass(cine);
  scn.add(new THREE.AmbientLight(0x8090b0, .22)); const sunL = new THREE.PointLight(0xfff2dd, 3.2, 0, 0); scn.add(sunL);
  const hem = new THREE.HemisphereLight(0xbfd8ff, 0x201810, .12); scn.add(hem);
  // stars
  { const n = 4000, p = new Float32Array(n * 3), c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, t = Math.random() * 6.283, r = 6000 + Math.random() * 3000, s = Math.sqrt(1 - u * u); p.set([Math.cos(t) * s * r, u * r, Math.sin(t) * s * r], i * 3); const w = .6 + Math.random() * .4; c.set([w, w, w * (.85 + Math.random() * .3)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); scn.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true }))); }
  // NASA Tycho star map as the sky
  { const smat = new THREE.ShaderMaterial({ uniforms: { map: { value: null } }, side: THREE.BackSide, depthWrite: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main(){ vec3 c = texture2D(map, vUv).rgb; float l = max(c.r, max(c.g, c.b)); vec3 o = c * (.55 + 2.6 * smoothstep(.25, .9, l)) * smoothstep(.015, .06, l); gl_FragColor = vec4(o, 1.); }' }); const sm = new THREE.Mesh(new THREE.SphereGeometry(9500, 64, 32), smat); sm.renderOrder = -1; scn.add(sm); TL.load('models/tex/stars.webp', t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; smat.uniforms.map.value = t; R && (R.starTex = t); }); }
  // bodies
  const bpos = {}; BODIES.forEach(b => { if (!b.at) bpos[b.id] = new THREE.Vector3(Math.cos(b.a) * b.d, 0, Math.sin(b.a) * b.d); });
  BODIES.forEach(b => { if (b.at) bpos[b.id] = bpos[b.at].clone().add(new THREE.Vector3(...b.off)); });
  const bmesh = {}, PL = [];
  const ATM = { earth: [0x5fa8ff, .9], venus: [0xffd28a, .7], mars: [0xff9a6a, .35], titan: [0xffb05a, .8], jupiter: [0xffe2b0, .35], saturn: [0xfff0c8, .3], uranus: [0xa8f0ff, .45], neptune: [0x7aa0ff, .45], pluto: [0x9ab4ff, .15] };
  BODIES.forEach(b => { const geo = new THREE.SphereGeometry(b.r, b.r > 20 ? 64 : 40, b.r > 20 ? 48 : 28);
    const mat = b.id === 'sun' ? sunMaterial() : planetMaterial(null, { atmo: (ATM[b.id] || [0])[0], atmoK: (ATM[b.id] || [0, 0])[1], ocean: b.id === 'earth', flow: { jupiter: 1, saturn: .6, uranus: .25, neptune: .5 }[b.id] || 0 }); if (b.id !== 'sun') mat.map = texFor(b, mat); PL.push({ mat });
    const m = new THREE.Mesh(geo, mat); m.position.copy(bpos[b.id]); if (b.tilt) m.rotation.z = b.tilt; scn.add(m); bmesh[b.id] = m;
    if (b.model) loader.load('models/nasa/' + b.model + '.glb', gl => { const sm = gl.scene, bx = new THREE.Box3().setFromObject(sm), sp = bx.getBoundingSphere(new THREE.Sphere()), k = b.r * 1.15 / sp.radius; sm.position.sub(sp.center).multiplyScalar(k); sm.scale.setScalar(k); m.add(sm); mat.visible = false; });
    if (b.id === 'sun') { // screen-space lens flare made of sprites (no framebuffer reads, so no flicker with anti-aliasing)
      const ft = glowTex('rgba(255,255,255,1)', 'rgba(255,200,120,.35)'), rt = glowTex('rgba(255,255,255,.0)', 'rgba(160,200,255,.25)'); FLARE.length = 0;
      [[.16, 0, ft, 0xfff2d8], [.03, .6, rt, 0xffffff], [.05, .7, rt, 0xcfe0ff], [.08, .9, rt, 0xbfd4ff], [.03, 1, rt, 0xffe0c0]].forEach(([sz, d, t, c]) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: c, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true })); sp.renderOrder = 20; sp.userData = { sz, d }; sp.visible = false; scn.add(sp); FLARE.push(sp); });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,240,200,1)', 'rgba(255,170,60,.45)'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: .55 })); s.scale.set(320, 320, 1); m.add(s);
      const cm = coronaMaterial(); PL.push({ mat: cm }); m.add(new THREE.Mesh(new THREE.SphereGeometry(b.r * 1.35, 64, 48), cm)); }
    const AC = { earth: 0x5fa8ff, venus: 0xffd28a, mars: 0xff9a6a, titan: 0xffb05a, jupiter: 0xffe2b0, saturn: 0xfff0c8, uranus: 0xa8f0ff, neptune: 0x7aa0ff, pluto: 0x9ab4ff }[b.id];
    if (AC) { const sm = atmosphereMaterial(AC, b.id === 'earth' ? 3.2 : 4); PL.push({ mat: sm });
      m.add(new THREE.Mesh(new THREE.SphereGeometry(b.r * 1.035, 64, 48), sm)); }
    if (b.id === 'earth') { const cv3 = document.createElement('canvas'); cv3.width = 1024; cv3.height = 512; const g3 = cv3.getContext('2d'), id3 = g3.createImageData(1024, 512); for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) { const lo = x / 1024 * 6.283, la = (.5 - y / 512) * Math.PI, X = Math.cos(la) * Math.cos(lo) * 2.2, Y = Math.sin(la) * 2.2, Z = Math.cos(la) * Math.sin(lo) * 2.2, w1 = fbm(X + 9, Z + Y * .6, 3), w2 = fbm(Z + 3, Y - X * .5, 3), v = (fbm(X * 1.6 + w1 * 1.8 + 40, Y * 1.6 + w2 * 1.8, 6) + fbm(Z * 1.6 + w2 * 1.5, X * 1.6 - Y + w1, 6)) * .5, al = Math.abs(la) / 1.5708, band = .15 * Math.exp(-Math.pow(al / .08, 2)) - .1 * Math.exp(-Math.pow((al - .28) / .1, 2)) + .1 * Math.exp(-Math.pow((al - .6) / .15, 2)), a = Math.max(0, (v + band - .5) * 3.4), o = (y * 1024 + x) * 4; id3.data[o] = id3.data[o + 1] = id3.data[o + 2] = 255; id3.data[o + 3] = Math.min(255, a * 255); }
      g3.putImageData(id3, 0, 0); const ctex = new THREE.CanvasTexture(cv3); ctex.colorSpace = THREE.SRGBColorSpace; const cmat = cloudMaterial(ctex); PL.push({ mat: cmat }); const cl = new THREE.Mesh(new THREE.SphereGeometry(b.r * 1.012, 64, 48), cmat); m.add(cl); m.userData.clouds = cl; }
    if (b.rings) { const cv2 = document.createElement('canvas'); cv2.width = 256; cv2.height = 4; const g2 = cv2.getContext('2d'); for (let i = 0; i < 256; i++) { const a = (i > 30 && i < 245) ? (.25 + .6 * vnoise(i * .15, 3)) * (i > 150 && i < 165 ? .1 : 1) : 0; g2.fillStyle = `rgba(230,215,180,${a})`; g2.fillRect(i, 0, 1, 4); }
      const rg = new THREE.RingGeometry(b.r * 1.25, b.r * 2.3, 128, 1), pos = rg.attributes.position, uv = rg.attributes.uv, v = new THREE.Vector3(); for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - b.r * 1.25) / (b.r * 1.05), .5); }
      const t2 = new THREE.CanvasTexture(cv2); t2.colorSpace = THREE.SRGBColorSpace; const rmat = ringMaterial(t2, b.r); PL.push({ mat: rmat, mesh: m }); const ring = new THREE.Mesh(rg, rmat); ring.rotation.x = -Math.PI / 2 + .45; m.add(ring); } });
  // asteroid belt
  { const n = Math.round((mob ? 600 : 1500) * (GFX === 'low' ? .4 : GFX === 'max' ? 1.4 : 1) / 3), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .96, metalness: .02 }), q = new THREE.Object3D(), c = new THREE.Color();
    for (let k = 0; k < 3; k++) { const im = new THREE.InstancedMesh(rockGeo(k * 2.3 + .7), mat, n);
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, d = 870 + Math.random() * 130 + Math.sin(a * 7) * 8; q.position.set(Math.cos(a) * d, (Math.random() - .5) * (18 + Math.random() * 16), Math.sin(a) * d); q.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        const s = Math.random() < .04 ? 4 + Math.random() * 6 : .4 + Math.pow(Math.random(), 2.4) * 3; q.scale.set(s * (.7 + Math.random() * .6), s * (.5 + Math.random() * .4), s); q.updateMatrix(); im.setMatrixAt(i, q.matrix);
        c.setHSL(.07 + Math.random() * .05, .12 + Math.random() * .14, .22 + Math.random() * .22); im.setColorAt(i, c); }
      scn.add(im); } }
  // spacecraft anchors (a glowing marker + the NASA model, loaded when you come near)

  const mk = new THREE.SpriteMaterial({ map: glowTex('rgba(255,255,255,1)', 'rgba(255,207,74,.5)'), blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false });
  const mkS = new THREE.SpriteMaterial({ map: glowTex('rgba(255,255,255,1)', 'rgba(125,249,255,.5)'), blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false });
  const objs = OBJS.filter(o => !o.land).map(o => { const g = new THREE.Group(); scn.add(g); const sp = new THREE.Sprite(ST.scanned.has(o.id) ? mkS : mk); sp.scale.set(.016, .016, 1); g.add(sp); return { o, g, sp, model: null, loading: false }; });
  function placeObj(e, t) { const o = e.o, c = o.rel ? (R.byId[o.rel] ? R.byId[o.rel].g.position : bpos[o.at]) : bpos[o.at], B = BI[o.at];
    if (o.surf) { const la = o.surf[0] * Math.PI / 180, lo = o.surf[1] * Math.PI / 180 + t * .02, n = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)); e.g.position.copy(c).addScaledVector(n, B.r + o.sz * .45 + (o.hov ? o.hov + Math.sin(t * 2) * .3 : 0)); e.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); e.n = n; }
    else if (o.orb) { const [r, inc, ph] = o.orb, a = ph + t * (3 / Math.max(6, r)) * .6; e.g.position.set(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * Math.sin(inc), c.z + Math.sin(a) * r * Math.cos(inc)); e.g.rotation.y = -a; }
    else if (o.l) { e.g.position.set(c.x + o.l[0], c.y + o.l[1] + Math.sin(t * .4 + o.l[2]) * (o.rel ? .25 : .6), c.z + o.l[2]); e.g.rotation.y = t * (o.rel ? .3 : .05); if (o.rel) e.g.rotation.x = t * .2; } }
  // two detail levels per object: a light preview (lod/, ~5% of the triangles, small textures) that streams in fast for everything nearby,
  // then the full-detail NASA model when you fly close. Far full models are unloaded; previews stay.
  function loadModel(e, full) { const key = full ? 'model' : 'lod'; if (e.loading || e[key]) return; e.loading = true; LQ.busy++;
    const fin = () => { LQ.busy = Math.max(0, LQ.busy - 1); e.loading = false; };
    loader.load('models/nasa/' + (full ? '' : 'lod/') + (e.o.model || e.o.id) + '.glb', gl => { fin(); const m = gl.scene;
      if (!full && e.fit) { m.position.copy(e.fit.p); m.scale.setScalar(e.fit.k); } else { const box = new THREE.Box3().setFromObject(m), sph = box.getBoundingSphere(new THREE.Sphere()), k = e.o.sz / Math.max(.001, sph.radius); m.position.copy(sph.center).multiplyScalar(-k); m.scale.setScalar(k); if (!e.fit) e.fit = { p: m.position.clone(), k }; }
      m.traverse(n => { if (n.isMesh && n.material) { n.material.side = THREE.FrontSide; if (n.material.metalness > .6) n.material.metalness = .6; } }); fixMat(m); e.g.add(m); e[key] = m; if (full) { e.cost = costOf(m); MEM.tris += e.cost.tris; MEM.tex += e.cost.tex; } },
      undefined, () => { fin(); if (full) { e.failed = (e.failed || 0) + 1; e.retryT = R.t + 8; } else { e.noLod = 1; } }); }
  // the ship (NASA's ESAS crew module concept, the design that became Orion)
  const ship = new THREE.Group(); scn.add(ship); { const tmp = new THREE.Mesh(new THREE.ConeGeometry(.9, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xdfe4ee, metalness: .3, roughness: .5 })); tmp.rotation.x = Math.PI / 2; ship.add(tmp); ship.userData.tmp = tmp;
    ship.userData.loader = loader; }
  const engL = new THREE.PointLight(0x9fd8ff, 0, 40, 2); scn.add(engL);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,255,255,1)', 'rgba(110,190,255,.6)'), blending: THREE.AdditiveBlending, depthWrite: false })); flame.position.set(0, 0, 1.4); ship.add(flame);
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: .9 })); beam.visible = false; scn.add(beam);
  R = { engL, PL, comp, rp, bloom, cine, fx: makeFX(scn, 2600), rings: makeRings(scn), warp: makeWarp(scn), yi: 0, pi: 0, envTex, byId: Object.fromEntries(objs.map(e => [e.o.id, e])), mkS, root, ren, scn, cam, bpos, bmesh, objs, ship, flame, beam, placeObj, loadModel, mob, vel: new THREE.Vector3(), yaw: 0, pitch: 0, t: 0, labs: root.querySelector('#labs'), lab: [], keys: {}, joy: { x: 0, y: 0 }, thr: 0, bst: 0, ap: null, scanning: null, last: 0 };
  setShip(G('adv_ship', 'orion'), true);
  // start near Earth, looking at it
  const e = bpos.earth; ship.position.set(e.x - 40, e.y + 6, e.z + 30); lookAtYP(e);
  controls(); root.querySelector('#aLoad').remove();
  R.surf = makeSurface({ ren, cam, loader, mob, q: () => Q, pre: () => PRE(), env: () => R.envTex, toast: (t, ms) => toast(t, ms), reward, sfx, get: G, set: P, scanned: ST.scanned,
    stars: () => R.starTex, texOf: id => { const m = R.bmesh[id]; return m && m.material.map; },
    objs: (id, site) => { if (!site || !site.items) return (SURF[id] || []).filter(x => OI[x.id]).map(x => ({ ...x, o: OI[x.id] }));
      const SZ = { curiosity: 3, spirit: 1.6, opportunity: 1.6, lm: 7, insight: 6, viking: 3, 'm2020-wheel': .9, 'm2020-tube': .8 };
      return site.items.filter(i => OI[i]).map((i, k) => { const base = (SURF[id] || []).find(x => x.id === i); const a = k * 1.3 + .4, d = 16 + k * 7; const it = base && site.proc ? { ...base } : { id: i, at: [Math.cos(a) * d, Math.sin(a) * d - 14], s: SZ[i] || 3, rot: k }; if (i === 'm2020-wheel') it.at = [10, -12]; if (i === 'm2020-tube') it.at = [8, -16];
        const o = OI[i]; return { ...it, o: site.lm && i === 'lm' ? { ...o, n: 'Lunar Module ' + site.lm + ' (' + site.n.split(' ·')[0] + ')' } : o }; }); },
    sampleFacts: (id, site) => [...(site && site.facts ? site.facts : []), ...(SAMPLE_FACTS[id] || []), ...(BI[id] ? BI[id].facts : [])],
    ui: (b, W, mode) => surfUI(b, W, mode), ship: () => R.shipStat || SHIPS[0], fixMat, craftUI: (on, cr) => { const b = R.root.querySelector('#aFly'); b.innerHTML = on ? '🧑‍🚀 LAND & WALK' : (cr.heli ? '🚁 ' : '✈ ') + 'FLY ' + cr.n.toUpperCase(); R.root.querySelector('#aThr').innerHTML = on ? (cr.heli ? '⬆<br>CLIMB' : '⬆<br>PULL UP') : '⤒<br>JUMP'; R.root.querySelector('#aBst').innerHTML = on ? (cr.heli ? 'FAST' : 'THROTTLE') : 'RUN'; } });
  root.querySelector('#aLand').onclick = () => landOrLaunch(); root.querySelector('#aQ').textContent = '⚙ ' + PRE().n; root.querySelector('#aQ').onclick = () => settings();
}
let R_HDR = true; const dprCap = () => Math.min(devicePixelRatio || 1, PRE().dpr) * SET.scale / 100; const LQ = { busy: 0, max: (navigator.hardwareConcurrency || 4) >= 8 ? 6 : 4 }, FLARE = [];
function flare() { if (!FLARE.length) return; const sp = R.bpos.sun, v = tmpV.copy(sp).project(R.cam), on = v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3;
  // hidden when a planet blocks the Sun
  let occ = 0; if (on) { const o = R.cam.position, dir = new THREE.Vector3().subVectors(sp, o), L = dir.length(); dir.divideScalar(L); for (const b of BODIES) { if (b.id === 'sun') continue; const c = R.bpos[b.id], t = new THREE.Vector3().subVectors(c, o).dot(dir); if (t < 0 || t > L) continue; const dd = new THREE.Vector3().subVectors(c, o).addScaledVector(dir, -t).length(); if (dd < b.r) { occ = 1; break; } } }
  const a = on && !occ ? Math.max(0, 1 - Math.hypot(v.x, v.y) * .55) : 0;
  for (const s of FLARE) { const k = 1 - 2 * s.userData.d, p = new THREE.Vector3(v.x * k, v.y * k, .2).unproject(R.cam), dist = p.distanceTo(R.cam.position); s.position.copy(p); s.scale.setScalar(s.userData.sz * dist * (s.userData.d ? 1 : 1.4)); s.material.opacity = a * (s.userData.d ? .55 : .9); s.visible = a > .01; } }
function dropFull(e) { if (!e.model) return; e.g.remove(e.model); disposeTree(e.model); e.model = null; if (e.cost) { MEM.tris = Math.max(0, MEM.tris - e.cost.tris); MEM.tex = Math.max(0, MEM.tex - e.cost.tex); } }
// memory budget: keep the nearest full-detail models within the preset's triangle/texture budget; farther ones fall back to their light version
function budget(CF) { const B = PRE(); let tris = 0, tex = 0; const L = R.objs.filter(e => e.model && e.cost).sort((a, b) => a.dist - b.dist);
  L.forEach((e, i) => { tris += e.cost.tris; tex += e.cost.tex; if (i > 0 && (tris > B.tris || tex > B.tex) && e.lod) { dropFull(e); e.evictD = e.dist; } }); // the nearest model always keeps full detail
  const over = MEM.tris > B.tris * .92 || MEM.tex > B.tex * .92; for (let i = CF.length - 1; i >= 0; i--) { const e = CF[i]; if ((over && !e.noLod) || (e.evictD && e.dist > e.evictD * .7)) CF.splice(i, 1); } }
function disposeTree(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); }); }); }
// dynamic resolution: keeps the frame rate smooth by trimming render resolution (never the effects) when the device struggles
const DR = { t: 0, n: 0, s: 1, cool: 4, low: 0, high: 0, changes: 0 };
// Each resolution change reallocates the render buffers (one blank frame), so it changes rarely and only after a sustained slowdown.
function dynRes(dt) { DR.t += dt; DR.n++; DR.cool = Math.max(0, DR.cool - dt); if (DR.t < 2) return; const fps = DR.n / DR.t; DR.t = 0; DR.n = 0;
  DR.low = fps < 32 ? DR.low + 1 : 0; DR.high = fps > 58 ? DR.high + 1 : 0; if (DR.cool > 0 || DR.changes >= 6) return;
  const max = dprCap(); let s = DR.s;
  if (DR.low >= 3 && s > .55) s = Math.max(.55, s - .15); else if (DR.high >= 8 && s < 1) s = Math.min(1, s + .15);
  if (s !== DR.s) { DR.s = s; DR.cool = 12; DR.low = DR.high = 0; DR.changes++; R.ren.setPixelRatio(max * s); resize(); } }
function fpsUI(dt) { const el = R.root.querySelector('#aFps'); if (!SET.fps) { if (el.style.display !== 'none') el.style.display = 'none'; return; } FP.n++; FP.t += dt; if (FP.t < .5) return; const f = FP.n / FP.t; FP.n = 0; FP.t = 0; el.style.display = 'block';
  const info = R.ren.info; el.textContent = `${Math.round(f)} FPS · ${(MEM.tris / 1e6).toFixed(2)} M tris · ${Math.round(MEM.tex)} MB tex · ${info.render.calls} draws · ${Math.round(dprCap() * DR.s * 100) / 100}x`; }
const FP = { n: 0, t: 0 }, MEM = { tris: 0, tex: 0 };
function costOf(m) { let tris = 0, tex = 0; const seen = new Set(); m.traverse(n => { if (!n.isMesh) return; const g = n.geometry; tris += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
    (Array.isArray(n.material) ? n.material : [n.material]).forEach(mt => { for (const k in mt) { const v = mt[k]; if (v && v.isTexture && !seen.has(v) && v.image) { seen.add(v); tex += (v.image.width || 0) * (v.image.height || 0) * 4 * 1.33 / 1048576; } } }); }); return { tris, tex }; }
function ldUI(k, n) { const el = R.root.querySelector('#aLd'), on = n > 0 && k < n; el.style.display = on ? 'block' : 'none'; if (on) el.textContent = '⏳ Loading NASA 3D models ' + k + ' / ' + n; }
function lookAtYP(p) { const d = p.clone().sub(R.ship.position).normalize(); R.yaw = Math.atan2(-d.x, -d.z); R.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)); }

/* ---------------- controls ---------------- */
function controls() {
  const $ = s => R.root.querySelector(s), joy = $('#aJoy'), knob = joy.querySelector('.k'), ki = knob.querySelector('i');
  let jid = null, jx = 0, jy = 0;
  joy.addEventListener('pointerdown', e => { if (DEMO.on) demoStop(); jid = e.pointerId; jx = e.clientX; jy = e.clientY; knob.style.display = 'block'; knob.style.left = jx + 'px'; knob.style.top = (jy - joy.getBoundingClientRect().top) + 'px'; joy.setPointerCapture(e.pointerId); R.ap = null; });
  joy.addEventListener('pointermove', e => { if (e.pointerId !== jid) return; let dx = e.clientX - jx, dy = e.clientY - jy; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; } R.joy.x = dx / m; R.joy.y = dy / m; ki.style.transform = `translate(${dx}px,${dy}px)`; });
  const jend = e => { if (e.pointerId !== jid) return; jid = null; R.joy.x = R.joy.y = 0; knob.style.display = 'none'; ki.style.transform = ''; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  const hold = (id, k) => { const b = $(id); b.addEventListener('pointerdown', e => { e.preventDefault(); R[k] = 1; if (k === 'thr') R.ap = null; }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(v => b.addEventListener(v, () => R[k] = 0)); };
  hold('#aThr', 'thr'); hold('#aBst', 'bst');
  $('#aScn').addEventListener('pointerdown', e => { e.preventDefault(); scan(); });
  $('#aX').onclick = () => close(); $('#aMap').onclick = () => mapPanel(); $('#aCod').onclick = () => codex(); $('#aHan').onclick = () => hangar(); $('#aCam').onclick = () => camToggle(); $('#aDemo').onclick = () => demoTour(); $('#aPhoto').onclick = () => photoToggle(); $('#aPh').onclick = () => photoToggle(); $('#aDL').onclick = () => { if (isApp) { toast('All resources are built into the app ✓'); return; } ST.on = false; resPanel(() => { ST.on = true; R.last = 0; requestAnimationFrame(loop); }, true); }; $('#aFly').onclick = () => flyToggle();
  // mouse look on desktop
  let drag = null; R.ren.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  addEventListener('pointermove', e => { if (!drag || !ST.on || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (R.surf && R.surf.S.on) { R.surf.S.camYaw -= dx * .006; R.surf.S.camPitch = THREE.MathUtils.clamp(R.surf.S.camPitch + dy * .004, .05, 1.2); return; }
    R.yaw -= dx * .004; R.pitch = THREE.MathUtils.clamp(R.pitch - dy * .004, -1.4, 1.4); R.ap = null; });
  addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) drag = null; });
  addEventListener('keydown', e => { if (!ST.on) return; if (DEMO.on && e.key !== 'Escape') demoStop(); const k = e.key.toLowerCase(); R.keys[k] = 1; if (k === 'e' || (k === ' ' && !(R.surf && R.surf.S.on))) { scan(); e.preventDefault(); } if (k === ' ' && R.surf && R.surf.S.on) e.preventDefault(); if (k === 'l') landOrLaunch(); if (k === 'm') mapPanel(); if (k === 'c') codex(); if (k === 'v' && !(R.surf && R.surf.S.on)) camToggle(); if (k === 'p' && !(R.surf && R.surf.S.on)) photoToggle(); if (k === 'h' && !(R.surf && R.surf.S.on)) hangar(); if (k === 'f' && R.surf && R.surf.S.on) flyToggle(); if (k === 'escape') { const p = R.root.querySelector('.pnl'); if (p) p.remove(); else close(); } if ('wasdqe'.includes(k) || k.startsWith('arrow')) R.ap = null; e.stopPropagation(); }, true);
  addEventListener('keyup', e => { if (R) R.keys[e.key.toLowerCase()] = 0; }, true);
  addEventListener('resize', resize);
}
function resize() { if (!R) return; const w = innerWidth, h = innerHeight; R.ren.setSize(w, h, false); R.comp.setPixelRatio(R.ren.getPixelRatio()); R.comp.setSize(w, h); R.cam.aspect = w / h; R.cam.updateProjectionMatrix(); }

/* ---------------- flight, scanning, labels ---------------- */
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), fwd = new THREE.Vector3();
function nearest() { let best = null, bd = 1e9; for (const e of R.objs) { const d = e.g.position.distanceTo(R.ship.position) - e.o.sz; if (d < bd) { bd = d; best = e; } }
  for (const b of BODIES) { const d = R.bpos[b.id].distanceTo(R.ship.position) - b.r; if (d < bd) { bd = d; best = { o: b, body: 1, g: { position: R.bpos[b.id] } }; } } return { e: best, d: bd }; }
function scanRange(o) { return o.r ? o.r * 1.2 + 25 : o.sz * 4 + 14; }
function scan() { if (R.scanning || R.root.querySelector('.pnl')) return; if (R.surf && R.surf.S.on) { const n = R.surf.S.near; if (!n) { toast('Walk up to a NASA site (glowing marker) to scan it'); sfx('no'); return; } R.scanning = { e: n, t: 0, surf: 1 }; sfx('beep'); return; } const { e, d } = nearest(); if (!e || d > scanRange(e.o)) { toast('Fly closer to something to scan it'); sfx('no'); return; } R.scanning = { e, t: 0 }; sfx('beep'); }
function toast(t, ms = 2200) { const el = R.root.querySelector('#aToast'); el.innerHTML = t; el.style.display = 'block'; clearTimeout(el._t); el._t = setTimeout(() => el.style.display = 'none', ms); }
function step(dt) {
  const k = R.keys, ship = R.ship; R.t += dt;
  const yRaw = (k.a || k.arrowleft ? 1 : 0) - (k.d || k.arrowright ? 1 : 0) - R.joy.x, pRaw = (k.arrowup ? 1 : 0) - (k.arrowdown ? 1 : 0) - R.joy.y; R.yi += (yRaw - R.yi) * Math.min(1, dt * 7); R.pi += (pRaw - R.pi) * Math.min(1, dt * 7); let yawIn = R.yi, pitIn = R.pi;
  const thrust = R.thr || k.w ? 1 : 0, boost = R.bst || k.shift ? 1 : 0, brake = k.s ? 1 : 0;
  if (R.ap) { const tp = R.ap.e.g.position, d = tp.distanceTo(ship.position), stop = (R.ap.e.o.r ? R.ap.e.o.r * 1.6 + 12 : R.ap.e.o.sz * 3 + 8);
    const dir = tp.clone().sub(ship.position).normalize(), ty = Math.atan2(-dir.x, -dir.z), tpch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    let dy = ty - R.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; R.yaw += dy * Math.min(1, dt * 2.5); R.pitch += (tpch - R.pitch) * Math.min(1, dt * 2.5);
    const sp = Math.min(R.ap.max, Math.max(8, (d - stop) * 1.4)); fwd.set(0, 0, -1).applyEuler(new THREE.Euler(R.pitch, R.yaw, 0, 'YXZ')); R.vel.lerp(fwd.multiplyScalar(d > stop ? sp : 0), Math.min(1, dt * 2));
    if (d <= stop + 1) { R.ap = null; R.vel.multiplyScalar(.2); toast(`Arrived: <b>${R.apName}</b> · tap 📡 SCAN`); say('Arriving at ' + R.apName.replace(/\(.*?\)/g, '') + '.'); } }
  else { const SS = R.shipStat || SHIPS[0]; R.yaw += yawIn * dt * 1.4 * SS.turn; R.pitch = THREE.MathUtils.clamp(R.pitch + pitIn * dt * 1.1 * SS.turn, -1.35, 1.35);
    fwd.set(0, 0, -1).applyEuler(new THREE.Euler(R.pitch, R.yaw, 0, 'YXZ')); const ts = (thrust ? (boost ? 180 * SS.bst : 45 * SS.spd) : boost ? 180 * SS.bst : 0); R.vel.lerp(fwd.clone().multiplyScalar(ts), Math.min(1, dt * (ts ? 1.4 : brake ? 3 : .6))); }
  ship.position.addScaledVector(R.vel, dt);
  // never fly into a planet
  for (const b of BODIES) { const c = R.bpos[b.id], d = ship.position.distanceTo(c), m = b.r + (b.id === 'sun' ? 25 : 1.6); if (d < m) { ship.position.copy(c).add(tmpV.copy(ship.position).sub(c).normalize().multiplyScalar(m)); R.vel.multiplyScalar(.3); if (b.id === 'sun' && !R.hotT) { R.hotT = 3; toast('☀️ Too hot! The Sun pushes you back'); } } }
  R.hotT = Math.max(0, (R.hotT || 0) - dt);
  ship.quaternion.setFromEuler(new THREE.Euler(R.pitch, R.yaw, -(yawIn || 0) * .35, 'YXZ'));
  const spd = R.vel.length(); R.flame.scale.setScalar(.5 + Math.min(3, spd / 40)); R.flame.material.opacity = Math.min(1, .25 + spd / 60);
  // engine exhaust, warp streaks and a speed FOV kick
  { const burn = (thrust || boost || R.ap) ? 1 : 0, sz = (R.shipStat || SHIPS[0]).sz; R.burn = (R.burn || 0) + (burn - (R.burn || 0)) * Math.min(1, dt * 5);
    R.engL.intensity = R.burn * (boost ? 60 : 30) * (CAM.photo ? 0 : 1); R.engL.color.setHex(boost ? 0xffb070 : 0x9fd8ff); R.flame.getWorldPosition(R.engL.position);
    if (R.burn > .05) { const ep = R.flame.getWorldPosition(tmpV), back = fwd.set(0, 0, 1).applyQuaternion(ship.quaternion), n = Math.ceil((boost ? 7 : 4) * R.burn * PRE().fx);
      const v = back.clone().multiplyScalar(10 + spd * .08).addScaledVector(R.vel, .85);
      R.fx.emit(ep, v, boost ? 0xffc27a : 0x9fd8ff, sz * (boost ? .55 : .4), boost ? .7 : .5, n, 1.4 * sz, { grow: 2.6, drag: .5, jit: sz * .2 });
      R.fx.emit(ep, v, 0xffffff, sz * .22, .18, 2, .4, { grow: 1.5 }); } }
  AUD.set({ eng: Math.min(1, (R.burn || 0)), boost, wind: 0, cockpit: CAM.mode === 'cockpit' && !CAM.photo, dt });
  R.cam.fov += ((60 + Math.min(14, Math.max(0, spd - 50) / 12)) - R.cam.fov) * Math.min(1, dt * 3); R.cam.updateProjectionMatrix();
  // chase camera
  camUpdate(dt, spd);
  // objects: move, load nearby models, rotate planets
  // stream models in, nearest first, a few at a time; unload far ones so memory stays steady
  const CF = [], CL = [];
  for (const e of R.objs) { R.placeObj(e, R.t); const d = e.g.position.distanceTo(ship.position); e.dist = d;
    const lodR = e.o.far ? 1500 : 520, fullR = (e.o.far ? 1400 : Math.max(30, e.o.sz * 16)) * PRE().full, canFull = !e.failed || (e.failed < 3 && R.t > e.retryT);
    if (!e.loading) { if (!e.model && canFull && (d < fullR || (e.noLod && d < lodR))) CF.push(e); else if (!e.lod && !e.noLod && d < lodR) { if (!LODS.has(e.o.model || e.o.id)) e.noLod = 1; else CL.push(e); } }
    const showFull = !!e.model && (d < fullR * 1.8 || !e.lod), vis = d < (e.o.far ? 3000 : Math.max(260, e.o.sz * 150));
    if (e.model) { e.model.visible = vis && showFull; if (d > fullR * 3 && !e.o.far && e.lod) dropFull(e); }
    if (e.lod) { e.lod.visible = vis && !showFull; if (d > lodR * 2.2) { e.g.remove(e.lod); disposeTree(e.lod); e.lod = null; } }
    e.sp.visible = !(e.model || e.lod) || d > e.o.sz * 40; if (e.sp.visible) { const k = d < 60 ? .02 : d < 200 ? .016 : .011; if (e.sp.scale.x !== k) e.sp.scale.set(k, k, 1); } }
  CF.sort((a, b) => a.dist - b.dist); CL.sort((a, b) => a.dist - b.dist); budget(CF); let fi = 0, li = 0; while (LQ.busy < LQ.max && (fi < CF.length || li < CL.length)) { if (li < CL.length && (fi >= CF.length || LQ.busy % 2)) R.loadModel(CL[li++], false); else R.loadModel(CF[fi++], true); }
  { let n = 0, k = 0; for (const e of R.objs) if (e.dist < (e.o.far ? 1500 : 520)) { n++; if (e.model || e.lod || e.failed >= 3) k++; } ldUI(k, n); }
  for (const b of BODIES) R.bmesh[b.id].rotation.y += dt * (b.id === 'sun' ? .02 : .05); if (R.bmesh.earth.userData.clouds) R.bmesh.earth.userData.clouds.rotation.y += dt * .012;
  // scanning
  const sb = R.root.querySelector('#aScn'), nr = nearest(); sb.classList.toggle('on', !!nr.e && nr.d < scanRange(nr.e.o) && !ST.scanned.has(nr.e.o.id));
  if (R.scanning) { const S2 = R.scanning; S2.t += dt; R.beam.visible = true; R.beam.geometry.setFromPoints([ship.position, S2.e.g.position]); R.root.querySelector('#aScan').style.display = 'block'; R.root.querySelector('#aScan').textContent = 'SCANNING ' + Math.min(100, Math.round(S2.t / 1.1 * 100)) + '%';
    if (Math.random() < .5) R.fx.emit(S2.e.g.position, tmpV.set(0, 0, 0), 0xffcf4a, 1.2, .6, 2, 3, { grow: 2 });
    if (S2.t > 1.1) { R.beam.visible = false; R.root.querySelector('#aScan').style.display = 'none'; R.scanning = null; R.rings.add(S2.e.g.position, 0x7df9ff, (S2.e.o.sz || 2) * 5, .9, R.cam.position); R.fx.emit(S2.e.g.position, tmpV.set(0, 0, 0), 0x7df9ff, 1.4, 1, 40, 18, { grow: 1.5, drag: .8 }); setTimeout(() => card(S2.e.o, true), 350); } }
  // speed + destination
  { const cb = BODIES.reduce((a, b) => { const d = R.bpos[b.id].distanceTo(ship.position); return d - b.r < a[1] ? [b, d - b.r, d] : a; }, [null, 1e9, 0]); R.altTxt = cb[0] && cb[1] < cb[0].r * 4 ? ' · ' + fmtKm(realAlt(cb[0], cb[2])) + ' above ' + cb[0].n : ''; }
  R.root.querySelector('#aSpd').textContent = `${Math.round(spd * 1000).toLocaleString()} km/h${R.altTxt}${R.ap ? ' · autopilot → ' + R.apName : ''} · ${ST.scanned.size}/${ALL.length} scanned`;
  updatePlanetUniforms(R.PL, R.bpos.sun, R.t); flare(); R.fx.update(dt, R.cam); R.rings.update(dt); R.warp.update(dt, R.cam, CAM.photo ? 0 : spd); R.dtH = dt; hud(spd);
  labels();
}
function labels() {
  const W = innerWidth, H = innerHeight, list = [];
  for (const e of R.objs) list.push([e.g.position, e.o, 0]); for (const b of BODIES) list.push([R.bpos[b.id], b, 1]);
  for (const it of list) it[3] = it[0].distanceTo(R.ship.position); list.sort((a, b) => a[3] - b[3]); let nObj = 0;
  let i = 0; for (const [p, o, isB, d] of list) { if (!isB) { if (d > 160 || nObj >= 6) continue; nObj++; } else if (d - o.r > 650 && !(R.ap && R.ap.e.o === o)) continue; tmpV.copy(p); if (isB) tmpV.y += o.r * 1.15; tmpV.project(R.cam); if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.1 || Math.abs(tmpV.y) > 1.1) continue;
    let el = R.lab[i]; if (!el) { el = R.lab[i] = document.createElement('div'); el.className = 'lab'; R.labs.appendChild(el); } i++;
    const known = ST.scanned.has(o.id), dist = d > 99 ? Math.round(d) + ' u' : Math.round(d) + ' u';
    if (el._m !== 's') { el._m = 's'; el.style.left = el.style.top = '0px'; el._c = el._h = el._d = null; } const cls = 'lab' + (isB ? ' b' : known ? '' : ' u'), html = (isB ? o.n : known ? o.n : '📡 Unknown signal') + `<small>${dist}</small>`; if (el._c !== cls) { el.className = cls; el._c = cls; } if (el._h !== html) { el.innerHTML = html; el._h = html; } el.style.transform = `translate(${((tmpV.x + 1) / 2 * W).toFixed(1)}px,${((1 - tmpV.y) / 2 * H).toFixed(1)}px) translate(-50%,-100%)`; if (el._d !== 1) { el.style.display = 'block'; el._d = 1; } }
  for (; i < R.lab.length; i++) if (R.lab[i]._d !== 0) { R.lab[i].style.display = 'none'; R.lab[i]._d = 0; }
}

/* ---------------- cards, codex, map, missions ---------------- */
function card(o, fresh) { const isNew = fresh && !ST.scanned.has(o.id);
  if (isNew) { say('New object identified. ' + o.n.replace(/\(.*?\)/g, '') + '.'); const was = new Set(SHIPS.filter(unlocked).map(x => x.id)); ST.scanned.add(o.id); save(); reward(5, 60); sfx('chime'); const nw = SHIPS.filter(x => unlocked(x) && !was.has(x.id)); if (nw.length) setTimeout(() => toast('🛠 New ship unlocked in the Hangar: <b>' + nw.map(x => x.n).join(', ') + '</b><br><small>Tap 🛠 Hangar to fly it</small>', 4500), 1200); const e = R.objs.find(x => x.o.id === o.id); if (e) e.sp.material = R.mkS; checkMissions(); milestone(); }
  const realTxt = o.r && RKM[o.id] ? `Real size: ${(RKM[o.id] * 2).toLocaleString()} km across${ORBIT[o.id] ? ` · ${ORBIT[o.id]} AU (${fmtKm(ORBIT[o.id] * AUKM)}) from the Sun · sunlight takes ${Math.round(ORBIT[o.id] * 499 / 60)} min to arrive` : ''}` : '';
  const loc = o.r ? (o.at ? 'Orbits ' + BI[o.at].n : 'Solar system') : o.land ? (o.land === 'earth' ? 'Kennedy Space Center, Earth' : 'On the surface of ' + BI[o.land].n) : o.far ? 'Deep sky, far beyond the solar system' : (o.surf ? 'On ' + BI[o.at].n : 'Near ' + BI[o.at].n);
  const p = document.createElement('div'); p.className = 'pnl'; p.innerHTML = `<div class="crd"><div class="ey">${o.r ? '🪐 ' : '🛰 '}${o.k.toUpperCase()}</div>${isNew ? '<div class="nw">NEW SCAN · +5 🔧 · +60 XP</div>' : ''}<h2>${o.n}</h2><canvas class="vw"></canvas>
   <div class="mt">${[o.ag, o.yr ? 'Launched ' + o.yr : '', loc].filter(Boolean).join(' · ')}</div>${realTxt ? `<div class="mt" style="color:#7df9ff">📏 ${realTxt}</div>` : ''}<ul>${o.facts.map(f => `<li>${f}</li>`).join('')}</ul>
   ${o.r ? '' : '<div class="src">3D model: NASA 3D Resources (science.nasa.gov/3d-resources)</div>'}<div class="row"><button class="pr" id="cOk">Continue</button></div></div>`;
  R.root.appendChild(p); viewer(o, p.querySelector('.vw'), p); p.querySelector('#cOk').onclick = () => p.remove(); }
function milestone() { const n = ST.scanned.size, got = G('adv_ms', 0), M = [[10, 30], [25, 60], [ALL.length, 150]]; M.forEach(([at, tp], i) => { if (n >= at && got <= i) { P('adv_ms', i + 1); reward(tp, 200); setTimeout(() => toast(`🏅 Codex ${at === ALL.length ? 'complete' : at + ' scans'}! +${tp} 🔧`, 3500), 600); } }); }
function checkMissions() { while (ST.mi < MISSIONS.length && MISSIONS[ST.mi].need.every(done)) { ST.mi++; save(); reward(20, 150); sfx('fanfare'); setTimeout(() => toast('✅ Mission complete! +20 🔧' + (ST.mi < MISSIONS.length ? '<br><small>Next: ' + MISSIONS[ST.mi].t + '</small>' : '<br><small>You finished the Grand Tour!</small>'), 4000), 300); } misUI(); }
function misUI() { const m = R.root.querySelector('#aMis'); if (ST.mi >= MISSIONS.length) { m.innerHTML = '<b>GRAND TOUR COMPLETE</b>Keep scanning to fill your codex'; return; } const M = MISSIONS[ST.mi]; m.innerHTML = `<b>MISSION ${ST.mi + 1}/${MISSIONS.length}</b>${M.t} <span style="opacity:.75">(${M.need.filter(done).length}/${M.need.length})</span>`; }
function goto(id) { if (OI[id] && OI[id].land) id = OI[id].land; const e = R.objs.find(x => x.o.id === id) || (BI[id] ? { o: BI[id], g: { position: R.bpos[id] } } : null); if (!e) return; const d = e.g.position.distanceTo(R.ship.position); R.ap = { e, max: Math.max(60, Math.min(900, d * .8)) }; R.apName = e.o.n; toast('🧭 Autopilot engaged → <b>' + e.o.n + '</b>'); }
function mapPanel() { const p = document.createElement('div'); p.className = 'pnl'; const grp = {}; OBJS.forEach(o => (grp[o.at] = grp[o.at] || []).push(o));
  OBJS.filter(o => o.land).forEach(o => { (grp[o.land] = grp[o.land] || []); });
  p.innerHTML = `<div class="crd"><div class="ey">🗺 SOLAR SYSTEM MAP</div><h2>Where to?</h2><div class="mt">Pick a destination and autopilot flies you there. Joystick or keys take back control.</div><div class="grid">${BODIES.map(b => `<h4>${b.n.toUpperCase()}</h4><button data-g="${b.id}">🪐 ${b.n}${WORLD[b.id] ? ' · 🛬' : DIVE[b.id] ? ' · 🌀' : ''}</button>` + (grp[b.id] || []).filter(o => !o.land).map(o => `<button data-g="${o.id}" class="${ST.scanned.has(o.id) ? '' : 'no'}">${ST.scanned.has(o.id) ? '🛰 ' + o.n : '📡 Unknown signal'}</button>`).join('')).join('')}</div><div class="row"><button id="mX">Close</button></div></div>`;
  R.root.appendChild(p); p.querySelector('#mX').onclick = () => p.remove(); p.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { p.remove(); goto(b.dataset.g); }); }
function grpOf(o) { if (o.r) return '🪐 Planets, moons and the Sun'; if (o.far) return '🌌 Deep sky (exploded stars and young stars)'; if (o.z === 'suit' || o.z === 'item') return '🧑‍🚀 Spacesuits and tools'; if (o.land === 'earth') return '🚀 Kennedy Space Center (land on Earth)';
  if (o.land === 'mars' || o.at === 'mars') return '🔴 Mars'; if (o.at === 'moon') return '🌙 The Moon'; if (o.at === 'earth') return '🌍 Around Earth'; return '☄️ Deep space and the outer planets'; }
function codex() { const p = document.createElement('div'); p.className = 'pnl'; const G2 = {}; ALL.forEach(o => (G2[grpOf(o)] = G2[grpOf(o)] || []).push(o));
  p.innerHTML = `<div class="crd"><div class="ey">📖 NASA CODEX</div><h2>${ST.scanned.size} / ${ALL.length} scanned</h2><div class="mt">Rewards: 10 scans +30 🔧 · 25 scans +60 🔧 · everything +150 🔧. Scanned entries open their fact card and spinning 3D model.</div><div class="grid">${Object.entries(G2).map(([g, L]) => `<h4>${g} · ${L.filter(o => ST.scanned.has(o.id)).length}/${L.length}</h4>` + L.map(o => `<button data-c="${o.id}" class="${ST.scanned.has(o.id) ? '' : 'no'}">${ST.scanned.has(o.id) ? o.n : '❔ ???'}</button>`).join('')).join('')}</div><div class="row"><button id="cX">Close</button></div></div>`;
  R.root.appendChild(p); p.querySelector('#cX').onclick = () => p.remove(); p.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const o = ALL.find(x => x.id === b.dataset.c); if (ST.scanned.has(o.id)) { p.remove(); card(o, false); } else sfx('no'); }); }
function intro() { const p = document.createElement('div'); p.className = 'pnl'; p.innerHTML = `<div class="crd"><div class="ey">🚀 ADVENTURE MODE</div><h2>The Grand Tour</h2><div class="mt">Fly across the solar system with NASA’s real planet maps and every model from NASA’s 3D Resources library: over 200 spacecraft, rockets, rovers, suits, tools and even exploded stars. Scan anything to read about it and spin its 3D model.</div>
  <ul><li><b>Steer:</b> left joystick (or A/D and the arrow keys, or drag with the mouse)</li><li><b>Fly:</b> hold 🚀 THRUST (W), and BOOST (Shift) for long trips</li><li><b>Scan:</b> get close to a 📡 signal and tap SCAN (E)</li><li><b>Map:</b> 🗺 picks a destination and autopilot flies you there</li><li><b>Land:</b> fly close to a planet or moon and tap 🛬 LAND to walk on it as an astronaut. Gas giants: 🌀 DIVE into the clouds!</li><li><b>Hangar:</b> 🛠 swap your ship. Scan NASA spacecraft (Gemini, Apollo–Soyuz, the Shuttle, SLS…) to unlock them and fly them yourself</li><li><b>Aircraft:</b> after landing on Earth tap ✈ FLY for the X-57, Global Hawk or a Shuttle glide; on Mars fly the Ingenuity helicopter</li><li><b>On the ground:</b> joystick to walk, JUMP (hold to jetpack-glide), RUN, drag to look around, collect 🧪 samples and ⭐ star fragments</li></ul><div class="mt">Each new scan gives +5 🔧 tech points and XP to your squad. Missions and codex milestones give more.</div><div class="row"><button class="pr" id="iGo">Launch</button></div></div>`;
  R.root.appendChild(p); p.querySelector('#iGo').onclick = () => { p.remove(); P('adv_seen', 1); }; }

/* ---------------- Hangar: every flyable NASA spacecraft and aircraft ---------------- */
// r = [x,y,z] rotation so the nose points forward (-Z) and the top points up (+Y). Checked against renders of each model.
export const SHIPS = [
  { id: 'orion', m: 'orion', n: 'ESAS Crew Module', k: 'Orion concept · 2005', spd: 1, bst: 1, turn: 1, sz: 1.3, free: 1, facts: ['NASA’s 2005 Exploration Systems Architecture Study drew this crew module.', 'It grew into the Orion spacecraft that flew around the Moon on Artemis I in 2022.'] },
  { id: 'orion-capsule', m: 'orion-capsule', n: 'Orion (Artemis)', k: 'Crew capsule · 2022', spd: 1.15, bst: 1.15, turn: 1, sz: 1.35, need: 'orion-capsule', facts: ['Orion carries up to four astronauts to the Moon.', 'Its heat shield is 5 m wide, the largest ever built.'] },
  { id: 'gemini', m: 'gemini', n: 'Gemini', k: 'Two-person spacecraft · 1965', r: [-Math.PI / 2, 0, 0], spd: 1.05, bst: .95, turn: 1.35, sz: 1.2, need: 'gemini', facts: ['Gemini was the first US spacecraft that could change its orbit.', 'Gemini flights practised spacewalks and docking for Apollo.'] },
  { id: 'apollo-soyuz', m: 'apollo-soyuz', n: 'Apollo–Soyuz', k: 'Docked US–Soviet ships · 1975', r: [0, Math.PI / 2, 0], spd: 1.1, bst: 1.1, turn: .9, sz: 1.8, need: 'apollo-soyuz', facts: ['In July 1975 an Apollo and a Soyuz docked in orbit.', 'The crews shook hands through the hatch, a famous moment of the Cold War.'] },
  { id: 'agena', m: 'agena-target-vehicle', n: 'Agena', k: 'Rocket stage · 1966', spd: 1.25, bst: 1.2, turn: .95, sz: 1.6, need: 'agena-target-vehicle', facts: ['Gemini crews docked with Agena and used its engine to fly higher.', 'Gemini 11 reached 1,369 km, a record for a crewed Earth orbit at the time.'] },
  { id: 'lm', m: 'lm', n: 'Apollo Lunar Module', k: 'Moon lander · 1969', spd: .85, bst: .9, turn: 1.4, sz: 1.5, need: 'lm', facts: ['The Lunar Module could only fly in space: it was too fragile for Earth’s air.', 'Six of them landed on the Moon between 1969 and 1972.'] },
  { id: 'shuttle-orbiter', m: 'space-shuttle-d', n: 'Space Shuttle orbiter', k: 'Reusable spaceplane · 1981', r: [-Math.PI / 2, Math.PI / 2, 0], spd: 1.3, bst: 1.3, turn: .9, sz: 2.3, need: 'shuttle', facts: ['The orbiter landed like a glider, with no engine power.', 'Five orbiters flew 135 missions from 1981 to 2011.'] },
  { id: 'shuttle-stack', m: 'shuttle', n: 'Shuttle launch stack', k: 'Orbiter + tank + boosters', spd: 1.2, bst: 1.5, turn: .7, sz: 2, need: 'shuttle', scans: 15, facts: ['At lift-off the two solid boosters gave most of the push.', 'The big orange tank held over 2 million litres of fuel.'] },
  { id: 'sls', m: 'sls-block-1', n: 'SLS Block 1', k: 'Moon rocket · 2022', r: [-Math.PI / 2, 0, 0], spd: 1.25, bst: 1.7, turn: .6, sz: 2.4, need: 'sls-block-1', scans: 25, facts: ['SLS launched Artemis I on 16 November 2022.', 'Its engines make about 39 meganewtons of thrust at lift-off.'] }
];
// aircraft that fly in a planet's air (Earth) or thin air (Mars)
const CRAFT = {
  earth: [
    { id: 'x-57', m: 'x-57', n: 'X-57 Maxwell', r: [0, -Math.PI / 2, 0], s: 9, v: 34, vmax: 70 },
    { id: 'global-hawk', m: 'global-hawk', n: 'Global Hawk', r: [0, Math.PI, 0], s: 18, v: 40, vmax: 85 },
    { id: 'shuttle-glide', m: 'space-shuttle-d', n: 'Shuttle glide', r: [-Math.PI / 2, Math.PI / 2, 0], s: 20, v: 60, vmax: 110, glide: 1 }],
  mars: [{ id: 'ingenuity', m: 'ingenuity', n: 'Ingenuity', s: 2.4, heli: 1, v: 10, vmax: 20 }]
};
function craftFor(body) { const L = CRAFT[body]; if (!L) return null; return L.find(c => c.id === G('adv_air', '')) || L[0]; }
function fixMat(root) { root.traverse(n => { if (!n.isMesh || !n.material) return; (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => { if (m.metalness > .6 && !m.metalnessMap) m.metalness = .6; if (m.metalness > .5 && !m.map && m.color && m.color.getHSL({}).l > .9) { m.metalness = .25; m.roughness = Math.min(m.roughness, .55); } }); }); }
function unlocked(sh) { return sh.free || ST.scanned.has(sh.need) || (sh.scans && ST.scanned.size >= sh.scans); }
function setShip(id, quiet) { const sh = SHIPS.find(x => x.id === id && unlocked(x)) || SHIPS[0], ship = R.ship; R.shipStat = sh; P('adv_ship', sh.id);
  ship.userData.loader.load('models/nasa/' + sh.m + '.glb', gl => { if (R.shipStat !== sh) return; const m = gl.scene; fixMat(m); if (sh.r) m.rotation.set(sh.r[0], sh.r[1], sh.r[2], 'YXZ'); const w = new THREE.Group(); w.add(m); m.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(w), sph = box.getBoundingSphere(new THREE.Sphere()), k = sh.sz / sph.radius;
    w.scale.setScalar(k); w.position.copy(sph.center).multiplyScalar(-k); w.traverse(n => { if (n.isMesh) n.castShadow = true; });
    if (ship.userData.mdl) ship.remove(ship.userData.mdl); if (ship.userData.tmp) { ship.remove(ship.userData.tmp); ship.userData.tmp = null; } ship.add(w); ship.userData.mdl = w; R.flame.position.set(0, 0, sh.sz * 1.05); if (!quiet) toast('🚀 Now flying: <b>' + sh.n + '</b>'); }); }
function hangar() { const p = document.createElement('div'); p.className = 'pnl'; const cur = (R.shipStat || SHIPS[0]).id;
  const bar = (l, v) => `<div class="bar">${l}<i><b style="width:${Math.min(100, v / 1.7 * 100)}%"></b></i></div>`;
  const nm = id => (OI[id] || {}).n || id;
  p.innerHTML = `<div class="crd"><div class="ey">🛠 HANGAR · NASA SPACECRAFT</div><h2>Choose your ship</h2><canvas class="vw"></canvas><div class="mt" id="hInf"></div><div class="hg">${SHIPS.map(s => { const u = unlocked(s); return `<button data-h="${s.id}" class="${s.id === cur ? 'sel' : ''} ${u ? '' : 'lk'}"><b style="font-size:12px">${u ? '' : '🔒 '}${s.n}</b><br><span style="opacity:.7">${u ? s.k : 'Scan the ' + nm(s.need) + (s.scans ? ' or reach ' + s.scans + ' scans' : '') + ' to unlock'}</span>${bar('SPD', s.spd)}${bar('BST', s.bst)}${bar('TRN', s.turn)}</button>`; }).join('')}</div>
  <div class="ey">✈ AIRCRAFT · fly them after landing</div><div class="mt">Land on <b>Earth</b> (Kennedy Space Center) to fly NASA aircraft, or on <b>Mars</b> to fly the Ingenuity helicopter. Pick your Earth aircraft:</div><div class="hg">${CRAFT.earth.map(c => `<button data-a="${c.id}" class="${craftFor('earth').id === c.id ? 'sel' : ''}"><b style="font-size:12px">✈ ${c.n}</b><br><span style="opacity:.7">top speed ${Math.round(c.vmax * 3.6)} km/h</span></button>`).join('')}<button disabled><b style="font-size:12px">🚁 Ingenuity</b><br><span style="opacity:.7">Mars only · lands anywhere</span></button></div>
  <div class="src">3D models: NASA 3D Resources (science.nasa.gov/3d-resources)</div><div class="row"><button id="hX">Close</button><button class="pr" id="hGo">Fly this ship</button></div></div>`;
  R.root.appendChild(p); let sel = cur; const cv = p.querySelector('.vw');
  const show = id => { const s = SHIPS.find(x => x.id === id); sel = id; p.querySelectorAll('[data-h]').forEach(b => b.classList.toggle('sel', b.dataset.h === id)); p.querySelector('#hInf').innerHTML = `<b>${s.n}</b> · ${s.k}<br>${s.facts.join(' ')}`; viewer({ id: s.m, model: s.m }, cv, p); p.querySelector('#hGo').disabled = !unlocked(s); p.querySelector('#hGo').textContent = unlocked(s) ? (id === cur ? 'Keep flying this' : 'Fly this ship') : '🔒 Locked'; };
  show(cur); p.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { show(b.dataset.h); sfx('beep'); });
  p.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { P('adv_air', b.dataset.a); p.querySelectorAll('[data-a]').forEach(x => x.classList.toggle('sel', x === b)); sfx('beep'); });
  p.querySelector('#hX').onclick = () => p.remove(); p.querySelector('#hGo').onclick = () => { const s = SHIPS.find(x => x.id === sel); if (!unlocked(s)) { sfx('no'); return; } p.remove(); if (sel !== cur) { setShip(sel); sfx('liftoff'); } }; }
function flyToggle() { const S = R.surf.S; if (!S.on || S.mode !== 'land') return; const cr = craftFor(S.body.id); if (!cr) return; R.surf.fly(S.fly ? null : cr); sfx(S.fly ? 'liftoff' : 'lnd'); }
/* ---------------- 3D viewer on every card ---------------- */
let VW = null;
function viewer(o, cv, panel) {
  if (!VW) { VW = { ren: new THREE.WebGLRenderer({ antialias: true, alpha: true }), scn: new THREE.Scene(), cam: new THREE.PerspectiveCamera(35, 1, .01, 100) };
    VW.ren.outputColorSpace = THREE.SRGBColorSpace; VW.ren.toneMapping = THREE.ACESFilmicToneMapping; VW.ren.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    VW.scn.add(new THREE.HemisphereLight(0xdfe8ff, 0x303040, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 2.4); dl.position.set(3, 4, 5); VW.scn.add(dl); const bl = new THREE.DirectionalLight(0x88aaff, .8); bl.position.set(-4, -1, -3); VW.scn.add(bl); }
  const w = cv.clientWidth || 300, h = cv.clientHeight || 190; VW.ren.setSize(w, h, false); VW.cam.aspect = w / h; VW.cam.updateProjectionMatrix();
  const ctx2 = cv.getContext('2d'); if (VW.obj) VW.scn.remove(VW.obj); VW.obj = null; let alive = true; const tok = VW.tok = (VW.tok || 0) + 1;
  const fit = m => { const b = new THREE.Box3().setFromObject(m), sp = b.getBoundingSphere(new THREE.Sphere()), g = new THREE.Group(); m.position.sub(sp.center); g.add(m); g.scale.setScalar(1 / Math.max(sp.radius, 1e-4)); VW.scn.add(g); VW.obj = g; };
  if (o.r && !o.model) { const src = R.bmesh[o.id]; fit(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), src ? (src.material.isShaderMaterial ? new THREE.MeshBasicMaterial({ map: src.material.map }) : src.material) : new THREE.MeshStandardMaterial({ color: 0x888888 }))); }
  else new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('models/nasa/' + (o.model || o.id) + '.glb', gl => { if (alive && VW.tok === tok) { fixMat(gl.scene); fit(gl.scene); } }, undefined, () => {});
  let a = 0; VW.cam.position.set(0, .5, 3.1); VW.cam.lookAt(0, 0, 0);
  (function spin() { if (!alive || !panel.isConnected || VW.tok !== tok) { alive = false; return; } a += .012; if (VW.obj) { VW.obj.rotation.y = a; VW.obj.rotation.x = Math.sin(a * .5) * .15; } VW.ren.render(VW.scn, VW.cam); ctx2.clearRect(0, 0, cv.width, cv.height); if (cv.width !== VW.ren.domElement.width) { cv.width = VW.ren.domElement.width; cv.height = VW.ren.domElement.height; } ctx2.drawImage(VW.ren.domElement, 0, 0); requestAnimationFrame(spin); })();
}
/* ---------------- landing, diving, launching ---------------- */
function nearBody() { let best = null, bd = 1e9; for (const b of BODIES) { if (b.id === 'sun') continue; const d = R.bpos[b.id].distanceTo(R.ship.position) - b.r, sc = d / (b.r + 6); if (d < b.r * 2 + 24 && sc < bd) { bd = sc; best = b; } } return best; }
function landOrLaunch() { const S = R.surf.S; if (R.entry) return; if (S.on) { if (S.launch) return; if (S.mode === 'land') { R.root.classList.add('cine'); sfx('liftoff'); say('Main engine start. And lift-off!', 1); R.surf.launch(() => { R.root.classList.remove('cine'); landOrLaunch.done(); }); return; } return landOrLaunch.done(); }
  landOrLaunch.go(); }
landOrLaunch.done = function () { const S = R.surf.S; { const b = S.body; R.surf.exit(); surfUI(null); const c = R.bpos[b.id]; R.ship.position.copy(c).add(new THREE.Vector3(0, b.r + 10, b.r + 14)); lookAtYP(c); R.vel.set(0, 0, 0); toast('🚀 Back in orbit around <b>' + b.n + '</b>'); say('Orbit achieved around ' + b.n + '.'); R.rings.add(R.ship.position, 0xffd27a, 8, .8, R.cam.position); } };
landOrLaunch.go = function () {
  const b = nearBody(); if (!b) return; const kind = DIVE[b.id] ? 'dive' : WORLD[b.id] ? 'land' : null; if (!kind) return; R.ap = null; R.vel.set(0, 0, 0);
  if (kind === 'land' && SITES[b.id] && !R.site) { sitePicker(b); return; }
  const fl = (kind === 'dive' ? 'dive:' : 'land:') + b.id; if (R.site) { const sf = 'site:' + b.id + ':' + R.site.id; if (!ST.flags.has(sf)) { ST.flags.add(sf); save(); reward(3, 30); } } if (!ST.flags.has(fl)) { ST.flags.add(fl); save(); reward(5, 50); setTimeout(checkMissions, 4800); }
  const st = R.site || null; R.site = null; startEntry(b, kind, st); };
/* ---------------- cinematic atmospheric entry: plasma, shake and heat glow, then touchdown ---------------- */
function startEntry(b, kind, st) { const W = WORLD[b.id], air = kind === 'dive' || !!(W && W.air && W.air !== 'None'), c = R.bpos[b.id].clone(), dir = R.ship.position.clone().sub(c).normalize();
  R.entry = { t: 0, T: air ? 3.4 : 2.6, b, kind, st, air, c, dir, r0: Math.max(R.ship.position.distanceTo(c), b.r + 6) }; R.ap = null; R.vel.set(0, 0, 0); R.root.classList.add('cine');
  let ov = R.root.querySelector('#aHeat'); if (!ov) { ov = document.createElement('div'); ov.id = 'aHeat'; R.root.appendChild(ov); } ov.style.opacity = 0;
  toast(air ? `🔥 Entering the atmosphere of <b>${b.n}</b>` : `🛬 Powered descent to <b>${b.n}</b>`, 2200); say(kind === 'dive' ? 'Entering the clouds of ' + b.n + '. Hold on.' : air ? 'Entry interface. Heat shield is taking the load.' : 'Beginning powered descent to ' + b.n + '.', 1); sfx(kind === 'dive' ? 'whoosh' : air ? 'burst' : 'land'); }
function stepEntry(dt) { const C = R.entry, ship = R.ship, sz = (R.shipStat || SHIPS[0]).sz; C.t += dt; R.t += dt; const k = Math.min(1, C.t / C.T), e = k * k * (3 - 2 * k);
  const alt = C.b.r * 1.012 + (C.r0 - C.b.r * 1.012) * (1 - e); ship.position.copy(C.c).addScaledVector(C.dir, alt); ship.visible = true; ship.lookAt(tmpV.copy(ship.position).addScaledVector(C.dir, 10)); ship.rotateZ(Math.sin(C.t * 2.3) * .08);
  const heat = C.air ? Math.sin(Math.min(1, k * 1.15) * Math.PI) : 0, nose = new THREE.Vector3().copy(ship.position).addScaledVector(C.dir, -sz * 1.1);
  if (C.air) { const back = C.dir.clone().multiplyScalar(18 + heat * 30); R.fx.emit(nose, back, 0xd8742c, sz * (.22 + .3 * heat), .4, Math.ceil(4 * heat) + 1, 4 * sz, { grow: 2.2, drag: .2, jit: sz * .45, a: .7 }); R.fx.emit(nose, back, 0xffe0b0, sz * .18, .2, Math.ceil(3 * heat), 2 * sz, { grow: 1.4, jit: sz * .3, a: .8 }); if (heat > .4) R.fx.emit(nose, back.multiplyScalar(1.6), 0xff5a20, sz * .12, .35, 2, 6 * sz, { grow: 1, jit: sz * .8 }); }
  else R.fx.emit(nose, C.dir.clone().multiplyScalar(-14), 0x9fd8ff, sz * .5, .5, 4, 1.5 * sz, { grow: 2.4 });
  // camera: high and behind, looking down past the ship toward the planet, shaking with the heat
  const side = new THREE.Vector3(0, 1, 0).cross(C.dir); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize(); const sh = (C.air ? heat * .35 : .05) * sz;
  R.cam.position.copy(ship.position).addScaledVector(C.dir, sz * 7).addScaledVector(side, sz * 3.2).add(tmpV.set((Math.random() - .5) * sh, (Math.random() - .5) * sh, (Math.random() - .5) * sh));
  R.cam.lookAt(tmpV.copy(ship.position).lerp(C.c, .02)); R.cam.fov += ((56 - heat * 6) - R.cam.fov) * Math.min(1, dt * 3); R.cam.updateProjectionMatrix();
  AUD.set({ eng: C.air ? .2 : .7, boost: 0, wind: C.air ? Math.min(1, heat * 1.2) : 0, dt }); const ov = R.root.querySelector('#aHeat'); ov.style.opacity = Math.min(1, (C.air ? heat * .85 : 0) + (k > .86 ? (k - .86) / .14 : 0)); ov.classList.toggle('w', k > .86);
  for (const e2 of R.objs) R.placeObj(e2, R.t); updatePlanetUniforms(R.PL, R.bpos.sun, R.t); R.fx.update(dt, R.cam); R.rings.update(dt); flare();
  if (C.air && heat > .92 && !C.pk) { C.pk = 1; say('Peak heating.'); }
  if (k >= 1) { const { b, kind, st } = C; say(kind === 'dive' ? 'We are inside ' + b.n + '.' : 'Touchdown. Welcome to ' + (st ? st.n.split(' (')[0].split(' ·')[0] : b.n) + '.', 1); R.entry = null; R.surf.enter(b, kind, st); setTimeout(() => { R.root.classList.remove('cine'); ov.style.opacity = 0; ov.classList.remove('w'); }, 120); } }
/* ---------------- mission-control voice callouts (speech synthesis behind a radio chirp) ---------------- */
let VQ = 0; function say(text, prio) { if (!SET.voice || !window.speechSynthesis) return; const now = Date.now(); if (!prio && now < VQ) return; VQ = now + 2500;
  try { const a = typeof ac === 'function' ? ac() : null; if (a && typeof BUS !== 'undefined' && BUS) { const t = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.setValueAtTime(1850, t); o.frequency.setValueAtTime(1400, t + .05); g.gain.setValueAtTime(.025, t); g.gain.exponentialRampToValueAtTime(.0001, t + .11); o.connect(g); g.connect(BUS.sfx || a.destination); o.start(t); o.stop(t + .12); } } catch (e) {}
  try { const u = new SpeechSynthesisUtterance(text), vs = speechSynthesis.getVoices(), v = vs.find(x => /en-US/i.test(x.lang) && /male|david|guy|daniel|alex/i.test(x.name)) || vs.find(x => /^en/i.test(x.lang)); if (v) u.voice = v; u.lang = 'en-US'; u.rate = 1.04; u.pitch = .85; u.volume = .9; if (prio) speechSynthesis.cancel(); setTimeout(() => speechSynthesis.speak(u), 140); } catch (e) {} }
/* ---------------- real-world scale: show true sizes and altitudes ---------------- */
// real radii (km); game distances are compressed, so altitude is shown in true km using the body's real radius
const RKM = { sun: 696340, mercury: 2440, venus: 6052, earth: 6371, moon: 1737, mars: 3390, jupiter: 69911, saturn: 58232, uranus: 25362, neptune: 24622, pluto: 1188, ceres: 470, vesta: 263, phobos: 11, deimos: 6, io: 1822, europa: 1561, ganymede: 2634, callisto: 2410, titan: 2575, enceladus: 252, mimas: 198, tethys: 531, dione: 561, rhea: 764, iapetus: 735, miranda: 236, ariel: 579, umbriel: 585, titania: 789, oberon: 761, triton: 1353, charon: 606 };
const AUKM = 149597870.7, ORBIT = { mercury: .387, venus: .723, earth: 1, mars: 1.524, jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07, pluto: 39.48, ceres: 2.77, vesta: 2.36 };
function fmtKm(km) { return km >= 1e6 ? (km / 1e6).toFixed(2) + ' million km' : km >= 1e4 ? Math.round(km).toLocaleString() + ' km' : km >= 10 ? km.toFixed(0) + ' km' : km.toFixed(1) + ' km'; }
function realAlt(b, d) { const r = RKM[b.id]; return r ? Math.max(0, (d - b.r) / b.r * r) : null; }
/* ---------------- opening cinematic: a sweeping flyby that ends behind your ship ---------------- */
function openingShot() { if (!R || R.intro) return; const e = R.bpos.earth, er = R.bmesh.earth.geometry.parameters.radius, s = R.bpos.sun.clone().sub(e).normalize(), side = new THREE.Vector3(-s.z, 0, s.x).normalize();
  R.intro = { t: 0, T: 10, p0: e.clone().addScaledVector(s, er * 1.2).addScaledVector(side, -er * 5.5).add(new THREE.Vector3(0, er * 1.6, 0)), p1: e.clone().addScaledVector(side, er * 2.2).add(new THREE.Vector3(0, er * .35, 0)) };
  R.root.classList.add('cine', 'intro'); let t = R.root.querySelector('#aTitle'); if (!t) { t = document.createElement('div'); t.id = 'aTitle'; R.root.appendChild(t); }
  t.innerHTML = '<div class="k">MOON PRODUCTIONS PRESENTS</div><h1>RED DUST OUTPOST</h1><div class="s">ADVENTURE · THE GRAND TOUR</div><div class="m">Every spacecraft is a real NASA 3D model · tap to skip</div>'; t.className = 'on';
  t.onclick = () => { if (R.intro) R.intro.t = R.intro.T; }; sfx('whoosh'); }
function stepIntro(dt) { const I = R.intro; I.t += dt; R.t += dt; const k = Math.min(1, I.t / I.T), e = k * k * (3 - 2 * k), ship = R.ship;
  for (const o of R.objs) R.placeObj(o, R.t); for (const b of BODIES) R.bmesh[b.id].rotation.y += dt * (b.id === 'sun' ? .02 : .05);
  const chase = new THREE.Vector3(0, 2.4, 9).applyQuaternion(ship.quaternion).add(ship.position);
  // first 70%: glide past Earth's terminator; last 30%: settle in behind the ship
  const mid = I.p0.clone().lerp(I.p1, Math.min(1, e / .7)); R.cam.position.copy(k < .7 ? mid : I.p1.clone().lerp(chase, (k - .7) / .3 * ((k - .7) / .3) * (3 - 2 * (k - .7) / .3)));
  const look = R.bpos.earth.clone().lerp(ship.position, Math.max(0, (k - .55) / .45)); R.cam.lookAt(look); R.cam.fov = 48 + 12 * e; R.cam.updateProjectionMatrix();
  updatePlanetUniforms(R.PL, R.bpos.sun, R.t); flare(); R.fx.update(dt, R.cam);
  const t = R.root.querySelector('#aTitle'); if (k > .78) t.className = 'off';
  if (k >= 1) { R.intro = null; R.root.classList.remove('cine', 'intro'); t.className = 'off'; setTimeout(() => t.remove(), 900); if (!G('adv_seen', 0)) intro(); else toast('🗺 Map → pick a destination · 📡 scan signals · 🎬 Demo for a guided tour', 3500); } }
/* ---------------- demo tour: flies itself through the best moments (any input takes control back) ---------------- */
const DEMO = { on: false };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function demoTour() { if (DEMO.on) { demoStop(); return; } DEMO.on = true; R.root.classList.add('demo'); say('Demo tour starting. Sit back and enjoy the ride.', 1); toast('🎬 Demo tour · touch the joystick or any key to take control', 3000);
  const arrive = async (max = 40000) => { const t0 = Date.now(); while (DEMO.on && R.ap && Date.now() - t0 < max) await wait(250); };
  const showcase = async id => { if (!DEMO.on) return; goto(id); await arrive(); if (!DEMO.on) return; const e = R.objs.find(x => x.o.id === id); if (e) { R.scanning = { e, t: 0 }; sfx('beep'); await wait(1600); const p = R.root.querySelector('.pnl'); await wait(3800); if (p && p.isConnected) p.remove(); } };
  try {
    await showcase('iss'); if (!DEMO.on) return; await showcase('hubble'); if (!DEMO.on) return;
    CAM.mode = 'cockpit'; toast('🎥 Inside the Space Shuttle cockpit', 1800); await wait(4000); CAM.mode = 'chase'; if (!DEMO.on) return;
    goto('mars'); await arrive(60000); if (!DEMO.on) return; R.site = (SITES.mars || []).find(s => s.id === 'gale') || null; if (R.site) await loadDEM(R.site); landOrLaunch.go(); await wait(5200); if (!DEMO.on) return;
    toast('🔴 Gale Crater, Mars · real NASA terrain', 2500); await wait(6000); if (!DEMO.on) return; landOrLaunch(); await wait(5000); if (!DEMO.on) return;
    CAM.photo = 1; R.root.classList.add('photo'); await wait(7000); CAM.photo = 0; R.root.classList.remove('photo');
    toast('🏁 Demo complete · the solar system is yours', 3000);
  } finally { demoStop(); } }
function demoStop() { if (!DEMO.on) return; DEMO.on = false; R.root.classList.remove('demo'); R.ap = null; if (CAM.photo) { CAM.photo = 0; R.root.classList.remove('photo'); } }
/* ---------------- camera modes, flight HUD and photo mode ---------------- */
const CAM = { mode: 'chase', photo: 0, pa: 0 };
function camUpdate(dt, spd) { const ship = R.ship, sz = (R.shipStat || SHIPS[0]).sz;
  if (CAM.photo) { CAM.pa += dt * .18; const r = sz * 7.5; R.cam.position.lerp(tmpV.set(Math.cos(CAM.pa) * r, sz * 1.6 + Math.sin(CAM.pa * .5) * sz, Math.sin(CAM.pa) * r).add(ship.position), Math.min(1, dt * 2)); R.cam.lookAt(ship.position); ship.visible = true; return; }
  if (CAM.mode === 'cockpit') { ship.visible = false; R.cam.position.copy(ship.position).add(tmpV.set(0, sz * .25, -sz * .9).applyQuaternion(ship.quaternion)); R.cam.quaternion.copy(ship.quaternion); return; }
  ship.visible = true; const k = sz / 1.3, back = tmpV.set(0, 2.4 * k, (9 + Math.min(6, spd / 30)) * k).applyQuaternion(ship.quaternion); R.cam.position.lerp(back.add(ship.position), Math.min(1, dt * 6));
  R.cam.lookAt(tmpV.set(0, .6, -6).applyQuaternion(ship.quaternion).add(ship.position)); }
function hud(spd) { const el = R.root.querySelector('#aHud'); if (!el) return; const W = innerWidth, H = innerHeight;
  if (CAM.photo) { el.style.display = 'none'; return; } el.style.display = 'block';
  // target bracket on the nearest object, with distance and closing speed
  const nr = nearest(), tb = el.querySelector('.tb'); let shown = false;
  if (nr.e && !nr.e.body && nr.d < 140) { const p = tmpV.copy(nr.e.g.position).project(R.cam);
    if (p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1) { shown = true; const d = nr.e.g.position.distanceTo(R.ship.position), px = Math.max(26, Math.min(160, nr.e.o.sz / Math.max(.5, d) * H * 1.1)), cl = R.lastTD != null && R.lastTE === nr.e ? (R.lastTD - d) / Math.max(1e-3, R.dtH || .016) : 0; R.lastTD = d; R.lastTE = nr.e;
      tb.style.display = 'block'; tb.style.transform = `translate(${((p.x + 1) / 2 * W - px / 2).toFixed(1)}px,${((1 - p.y) / 2 * H - px / 2).toFixed(1)}px)`; tb.style.width = tb.style.height = px.toFixed(0) + 'px';
      const u = !ST.scanned.has(nr.e.o.id); tb.classList.toggle('u', u); const t = `${u ? 'UNKNOWN SIGNAL' : nr.e.o.n.toUpperCase()} · ${d.toFixed(1)} u · ${cl >= 0 ? '▼' : '▲'} ${Math.abs(cl * 1000).toFixed(0)} km/h`; const lb = tb.firstChild; if (lb._t !== t) { lb.textContent = t; lb._t = t; } } }
  if (!shown) { tb.style.display = 'none'; R.lastTD = null; }
  // prograde marker: where the ship is actually drifting
  const pg = el.querySelector('.pg'); let pv = false; if (spd > 2) { const p = tmpV.copy(R.ship.position).addScaledVector(R.vel, 40 / spd).project(R.cam); if (p.z < 1 && Math.abs(p.x) < .95 && Math.abs(p.y) < .95) { pv = true; pg.style.transform = `translate(${((p.x + 1) / 2 * W - 13).toFixed(1)}px,${((1 - p.y) / 2 * H - 13).toFixed(1)}px)`; } }
  pg.style.display = pv ? 'block' : 'none'; const ck = CAM.mode === 'cockpit'; el.querySelector('.ck').style.display = ck ? 'block' : 'none';
  if (ck && (R.mfdT = (R.mfdT || 0) + (R.dtH || .016)) > .2) { R.mfdT = 0; const nb = nearBody(), cb = BODIES.reduce((a, b) => { const d = R.bpos[b.id].distanceTo(R.ship.position) - b.r; return d < a[1] ? [b, d] : a; }, [null, 1e9]);
    const set = (id, h) => { const m = el.querySelector(id); if (m._h !== h) { m.innerHTML = h; m._h = h; } };
    set('#mfd1', `<b>VEL</b>${Math.round(spd * 1000).toLocaleString()} km/h<br><b>THR</b>${Math.round((R.burn || 0) * 100)}%<br><b>SHIP</b>${(R.shipStat || SHIPS[0]).n}`);
    set('#mfd2', `<b>NEAREST</b>${cb[0] ? cb[0].n : '-'}<br><b>ALT</b>${cb[0] ? Math.max(0, cb[1]).toFixed(1) + ' u' : '-'}<br>${nb ? '<b>READY</b>' + (DIVE[nb.id] ? 'DIVE' : 'LAND') : '<b>ORBIT</b>FREE'}`);
    set('#mfd3', `<b>TARGET</b>${nr.e && !nr.e.body && nr.d < 140 ? (ST.scanned.has(nr.e.o.id) ? nr.e.o.n : 'UNKNOWN') : '-'}<br><b>SCANS</b>${ST.scanned.size}/${ALL.length}<br><b>MISSION</b>${Math.min(ST.mi + 1, MISSIONS.length)}/${MISSIONS.length}`); } }
function camToggle() { CAM.mode = CAM.mode === 'chase' ? 'cockpit' : 'chase'; toast(CAM.mode === 'cockpit' ? '🎥 Cockpit view' : '🎥 Chase view', 1200); }
function photoToggle() { CAM.photo = !CAM.photo; R.root.classList.toggle('photo', !!CAM.photo); if (CAM.photo) { CAM.pa = Math.atan2(R.cam.position.z - R.ship.position.z, R.cam.position.x - R.ship.position.x); toast('📷 Photo mode · tap anywhere to exit', 1800); } }

function loadDEM(site) { return new Promise(res => { if (!site || !site.dem || site.hm) return res(); const im = new Image(); im.onload = () => { const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, N, N); const d = g.getImageData(0, 0, N, N).data, hm = new Float32Array(N * N); for (let i = 0; i < N * N; i++) hm[i] = d[i * 4] / 255; site.hm = hm; site.N = N; site.relief = (DEM[site.dem] || {}).relief || .06; res(); }; im.onerror = () => res(); im.src = 'models/dem/' + site.dem + '.png'; }); }
function sitePicker(b) { const p = document.createElement('div'); p.className = 'pnl'; const L = SITES[b.id];
  p.innerHTML = `<div class="crd"><div class="ey">🛬 CHOOSE A LANDING SITE · ${b.n.toUpperCase()}</div><h2>Where do you want to land?</h2><div class="mt">Sites marked 🗺 use real NASA terrain models of that exact place.</div><div class="grid">${L.map((x, i) => `<button data-s="${i}"><b style="font-size:13px">${x.dem ? '🗺 ' : ''}${x.n}</b><br><span style="opacity:.75">${x.facts[0]}</span></button>`).join('')}</div><div class="row"><button id="sX">Cancel</button></div></div>`;
  R.root.appendChild(p); p.querySelector('#sX').onclick = () => p.remove(); p.querySelectorAll('[data-s]').forEach(x => x.onclick = async () => { const site = L[+x.dataset.s]; x.textContent = 'Loading terrain…'; await loadDEM(site); p.remove(); R.site = site; landOrLaunch(); }); }
function surfUI(b, W, mode) { const $ = q => R.root.querySelector(q), on = !!b; $('#aMap').style.display = on ? 'none' : ''; $('#aHan').style.display = on ? 'none' : ''; const cr = on && mode === 'land' ? craftFor(b.id) : null; $('#aFly').style.display = cr ? 'block' : 'none'; if (cr) $('#aFly').innerHTML = (cr.heli ? '🚁 ' : '✈ ') + 'FLY ' + cr.n.toUpperCase(); $('#aThr').innerHTML = on ? (mode === 'dive' ? '⬆<br>CLIMB' : '⤒<br>JUMP') : '🚀<br>THRUST'; $('#aBst').innerHTML = on ? (mode === 'dive' ? 'DIVE' : 'RUN') : 'BOOST';
  $('#aLand').style.display = on ? 'block' : 'none'; $('#aLand').textContent = '🚀 LAUNCH'; R.mode = on ? mode : null; R.lab.forEach(l => l.style.display = 'none');
  R.surfInfo = on ? (mode === 'dive' ? `${b.n} · inside the clouds` : `${b.n} · gravity ${W.g} m/s² (${Math.round(W.g / 9.81 * 100)}% of Earth) · ${W.t} · air: ${W.air}`) : ''; }
let jumpWas = 0;
function surfStep(dt) { const k = R.keys, S = R.surf.S, jump = !!(R.thr || k[' ']), inp = { x: R.joy.x + ((k.d || k.arrowright) ? 1 : 0) - ((k.a || k.arrowleft) ? 1 : 0), y: R.joy.y + ((k.s || k.arrowdown) ? 1 : 0) - ((k.w || k.arrowup) ? 1 : 0), run: !!(R.bst || k.shift), jump, jumpPress: jump && !jumpWas, look: (k.q ? 1 : 0) - (k.r ? 1 : 0), lookY: 0 }; jumpWas = jump;
  const r = R.surf.step(dt, inp) || {}; { const F = S.fly; AUD.set({ eng: F ? (F.heli ? .55 : Math.min(1, (r.spd || 0) / (F.vmax * 3.6))) : (inp.jump && !S.onGround ? .35 : 0), boost: F && inp.run ? 1 : 0, wind: F && !F.heli && WORLD[S.body.id] && WORLD[S.body.id].air !== 'None' ? Math.min(1, (r.spd || 0) / 300) : (S.mode === 'dive' ? .5 : 0), dt }); }
  if (R.scanning && R.scanning.surf) { R.scanning.t += dt; const el = R.root.querySelector('#aScan'); el.style.display = 'block'; el.textContent = 'SCANNING ' + Math.min(100, Math.round(R.scanning.t / 1.1 * 100)) + '%'; if (R.scanning.t > 1.1) { el.style.display = 'none'; const o = R.scanning.e.o; R.scanning = null; card(o, true); } }
  R.root.querySelector('#aScn').classList.toggle('on', !!(S.near && !ST.scanned.has(S.near.o.id))); if (S.mode !== 'dive') ldUI(S.ldK || 0, S.ldN || 0); else ldUI(0, 0);
  R.root.querySelector('#aSpd').textContent = S.mode === 'dive' ? `Depth ${Math.round(r.depth || 0)} km / ${r.max} km · ${Math.round(1 + (r.depth || 0) * .9)} bar · ${R.surfInfo}` : (S.fly ? `${S.fly.heli ? '🚁' : '✈'} ${S.fly.n} · ${r.spd} km/h · altitude ${r.alt} m · ` : '') + `${R.surfInfo} · ${S.cols.filter(c => !c.got).length} finds left`;
  // labels for NASA sites and nearby finds
  const W_ = innerWidth, H_ = innerHeight, v = new THREE.Vector3(); let i = 0; const P_ = S.player ? S.player.position : v;
  const L = S.mode === 'dive' ? [] : [...S.items.filter(x => !x.geyser).map(x => [x.g.position, (ST.scanned.has(x.o.id) ? x.o.n : '📡 ' + x.o.n), x.s * 1.15 + 1.5, !ST.scanned.has(x.o.id)]), ...S.cols.filter(c => !c.got && c.m.position.distanceTo(P_) < 90).map(c => [c.m.position, c.sample ? '🧪 Sample' : '⭐', 1.2, 1])];
  L.forEach(x => x[4] = x[0].distanceTo(P_)); L.sort((a, b) => a[4] - b[4]); L.length = Math.min(L.length, 8);
  for (const [p, t, up, u] of L) { const d = p.distanceTo(P_); if (d > 400) continue; v.copy(p); v.y += up; v.project(R.cam); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue; let el = R.lab[i]; if (!el) { el = R.lab[i] = document.createElement('div'); R.labs.appendChild(el); } i++; if (el._m !== 'g') { el._m = 'g'; el.style.transform = ''; } el._c = el._h = el._d = null; el.className = 'lab' + (u ? ' u' : ''); el.innerHTML = t + `<small>${Math.round(d)} m</small>`; el.style.left = ((v.x + 1) / 2 * W_) + 'px'; el.style.top = ((1 - v.y) / 2 * H_) + 'px'; el.style.display = 'block'; }
  for (; i < R.lab.length; i++) R.lab[i].style.display = 'none'; }
/* ---------------- open / close ---------------- */
function draw(sc) { R.rp.scene = sc; R.cine.uniforms.time.value = performance.now() / 1000 % 100; R.comp.render(); }
function setGfx(g) { GFX = g; P('adv_gfx', g); Q = g === 'max' ? 'ultra' : 'high'; DR.s = 1; DR.cool = 6; DR.changes = 0; R.ren.setPixelRatio(dprCap()); [R.comp.renderTarget1, R.comp.renderTarget2].forEach(t => { t.samples = R_HDR ? PRE().msaa : 0; t.dispose(); }); R.bloom.strength = PRE().bloom; resize(); R.root.querySelector('#aQ').textContent = '⚙ ' + PRE().n; R.scn.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
function settings() { const p = document.createElement('div'); p.className = 'pnl'; const opt = (k, v, l) => `<button data-${k}="${v}" class="${String((k === 'g' ? GFX : SET[k])) === String(v) ? 'sel' : ''}">${l}</button>`;
  p.innerHTML = `<div class="crd"><div class="ey">⚙ GRAPHICS</div><h2>Settings</h2><div class="mt">Like Genshin: lower settings run smoother and cooler on phones. Max is for strong phones and PCs.</div>
  <h4 class="sh">QUALITY PRESET</h4><div class="seg">${Object.entries(PRESETS).map(([k, v]) => opt('g', k, v.n)).join('')}</div>
  <h4 class="sh">FRAME RATE</h4><div class="seg">${[30, 45, 60].map(v => opt('cap', v, v + ' FPS')).join('')}</div>
  <h4 class="sh">RENDER RESOLUTION · <span id="rsV">${SET.scale}%</span></h4><input type="range" id="rs" min="50" max="100" step="5" value="${SET.scale}" style="width:100%">
  <h4 class="sh">SHOW FPS COUNTER</h4><div class="seg">${opt('fps', 0, 'Off')}${opt('fps', 1, 'On')}</div>
  <h4 class="sh">MISSION CONTROL VOICE</h4><div class="seg">${opt('voice', 0, 'Off')}${opt('voice', 1, 'On')}</div>
  <div class="mt" style="margin-top:10px">${PRE().n}: up to ${(PRE().tris / 1e6).toFixed(1)} M full-detail triangles and ${PRE().tex} MB of model textures at once. Everything farther away uses light versions.</div>
  <div class="row"><button class="pr" id="stX">Done</button></div></div>`;
  R.root.appendChild(p); const save2 = () => P('adv_set', SET);
  p.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { setGfx(b.dataset.g); p.remove(); settings(); });
  p.querySelectorAll('[data-cap]').forEach(b => b.onclick = () => { SET.cap = +b.dataset.cap; save2(); p.remove(); settings(); });
  p.querySelectorAll('[data-fps]').forEach(b => b.onclick = () => { SET.fps = +b.dataset.fps; save2(); p.remove(); settings(); }); p.querySelectorAll('[data-voice]').forEach(b => b.onclick = () => { SET.voice = +b.dataset.voice; save2(); p.remove(); settings(); if (SET.voice) say('Voice callouts on.', 1); });
  p.querySelector('#rs').oninput = e => { SET.scale = +e.target.value; p.querySelector('#rsV').textContent = SET.scale + '%'; }; p.querySelector('#rs').onchange = () => { save2(); DR.s = 1; R.ren.setPixelRatio(dprCap()); resize(); };
  p.querySelector('#stX').onclick = () => p.remove(); }
function loop(t) { if (!ST.on) return; if (SET.cap < 60 && R.last && t - R.last < 1000 / SET.cap - 3) { requestAnimationFrame(loop); return; } const dt = Math.min(.05, Math.max(0, (t - (R.last || t)) / 1000)); fpsUI(dt); R.ren.info.reset(); R.last = t; if (R.lost) { requestAnimationFrame(loop); return; } dynRes(dt); const pnl = R.root.querySelector('.pnl'), sf = R.surf && R.surf.S.on;
  if (sf) { if (!pnl) { if (R.surf.S.launch) { R.surf.step(dt, {}); } else surfStep(dt); draw(R.surf.S.scn); } }
  else if (R.intro) { stepIntro(dt); draw(R.scn); }
  else if (R.entry) { stepEntry(dt); draw(R.scn); }
  else { if (!pnl) { step(dt); const b = nearBody(), lb = R.root.querySelector('#aLand'), k = b ? (DIVE[b.id] ? 'dive' : WORLD[b.id] ? 'land' : null) : null; lb.style.display = k && !R.ap ? 'block' : 'none'; if (k) lb.textContent = k === 'dive' ? '🌀 DIVE INTO ' + b.n.toUpperCase() : '🛬 LAND ON ' + b.n.toUpperCase(); draw(R.scn); } }
  requestAnimationFrame(loop); }
/* ---------------- resource download (like a game launcher): store every NASA model on the device before playing ---------------- */
const MC = 'rdo-models-2', isApp = !!(window.Capacitor && (!window.Capacitor.isNativePlatform || window.Capacitor.isNativePlatform()));
function needDL() { if (isApp || !('caches' in window) || open.skipDL) return false; const d = G('adv_dl', null); return !d || d.v !== 59; }
function resPanel(done, fromGame) {
  const o = document.createElement('div'); o.id = 'advDL'; o.innerHTML = `<style>#advDL{position:fixed;inset:0;z-index:99999;background:radial-gradient(ellipse at 50% 30%,#14204a,#02040c 70%);color:#eaf2ff;font:14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:16px}
  #advDL .c{width:min(520px,94vw);background:rgba(10,16,36,.85);border:1px solid rgba(125,249,255,.35);border-radius:18px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.6)}#advDL h2{margin:2px 0 6px;font-size:22px}#advDL .ey{font:700 10px system-ui;letter-spacing:.16em;color:#7df9ff}
  #advDL .mt{font-size:12px;color:#b9c8de;line-height:1.45}#advDL .opt{display:grid;gap:8px;margin:12px 0}#advDL button{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:12px;padding:11px 14px;font:700 14px system-ui;text-align:left;cursor:pointer}
  #advDL button.pr{background:linear-gradient(180deg,#3aa0e8,#1f6fb8);border-color:#7df9ff}#advDL button small{display:block;font-weight:500;opacity:.8;font-size:11px;margin-top:2px}#advDL .bar{height:12px;border-radius:8px;background:rgba(255,255,255,.1);overflow:hidden;margin:12px 0 6px}#advDL .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7df9ff,#ffcf4a);transition:width .25s}
  #advDL .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}</style><div class="c"><div class="ey">🚀 ADVENTURE MODE · RESOURCES</div><h2>Download NASA resources</h2><div class="mt" id="dlT">Loading the file list…</div><div id="dlB"></div></div>`;
  document.body.appendChild(o); const $ = q => o.querySelector(q), mb = b => (b / 1048576).toFixed(b > 1e8 ? 0 : 1) + ' MB';
  fetch('models/manifest.json', { cache: 'no-store' }).then(r => r.json()).then(async M => {
    const cache = await caches.open(MC), uniq = L => { const seen = new Set(); return L.filter(x => !seen.has(x[0]) && seen.add(x[0])); };
    const light = uniq([...M.base, ...M.lod, ...M.core]), full = uniq([...M.base, ...M.lod, ...M.full]), sum = L => L.reduce((a, x) => a + x[1], 0);
    let have = 0; for (const [p] of full) if (await cache.match(p)) have++;
    $('#dlT').innerHTML = `Store every NASA 3D model on this device once, so Adventure Mode loads instantly and plays smoothly, even offline.${have ? `<br><b>${have} of ${full.length} files are already on this device.</b>` : ''}<br><span style="opacity:.75">Use Wi-Fi for the full pack. You can always download more later from ⬇ in Adventure Mode.</span>`;
    $('#dlB').innerHTML = `<div class="opt"><button class="pr" id="dF">⬇ Full pack · best quality<small>Every model in full detail · ${mb(sum(full))} · ${full.length} files</small></button><button id="dL">⬇ Light pack · fast start<small>Light versions of every model, plus the ships and aircraft · ${mb(sum(light))}. Full detail streams in when you fly close.</small></button><button id="dS">▶ Skip, stream while playing<small>Uses the least storage. Models load as you fly near them.</small></button></div>`;
    const finish = (pack) => { if (pack) P('adv_dl', { v: 59, pack }); o.remove(); done && done(); };
    $('#dS').onclick = () => { open.skipDL = 1; finish(null); };
    const run = async (L, pack) => { let doneB = 0, doneN = 0, fail = 0, stop = false; const tot = sum(L), t0 = performance.now();
      $('#dlB').innerHTML = `<div class="bar"><i></i></div><div class="mt" id="dlP">Starting…</div><div class="row" style="margin-top:12px"><button id="dX">Play now (keeps downloading in this session)</button></div>`;
      $('#dX').onclick = () => { stop = 'play'; finish(null); };
      const upd = () => { const el = performance.now() - t0, sp = doneB / Math.max(.5, el / 1000), left = (tot - doneB) / Math.max(1, sp); $('.bar i').style.width = (doneB / tot * 100).toFixed(1) + '%'; $('#dlP').textContent = `${(doneB / tot * 100).toFixed(0)}% · ${mb(doneB)} of ${mb(tot)} · ${doneN}/${L.length} files · ${mb(sp)}/s · about ${left > 90 ? Math.ceil(left / 60) + ' min' : Math.ceil(left) + ' s'} left${fail ? ' · ' + fail + ' to retry' : ''}`; };
      let i = 0; const worker = async () => { while (i < L.length && stop !== 'abort') { const [p, sz] = L[i++];
          try { if (!(await cache.match(p))) { let r = await fetch(p); if (!r.ok || /text\/html/.test(r.headers.get('content-type') || '')) { const pj = p.replace(/\.glb$/, '.json'); if (pj !== p) { r = await fetch(pj); if (r.ok) await cache.put(pj, r); else fail++; } else fail++; } else await cache.put(p, r); } } catch (e) { fail++; }
          doneB += sz; doneN++; if (o.isConnected) upd(); } };
      await Promise.all(Array.from({ length: 6 }, worker)); if (stop === 'play') { P('adv_dl', { v: 59, pack }); return; }
      $('.bar i').style.width = '100%'; $('#dlP').innerHTML = `<b>✅ Download complete.</b> ${mb(tot)} stored on this device${fail ? ` (${fail} files could not be downloaded and will stream instead)` : ''}.`;
      $('.row').innerHTML = '<button class="pr" id="dGo">🚀 Launch Adventure</button>'; $('#dGo').onclick = () => finish(pack); };
    $('#dF').onclick = () => run(full, 'full'); $('#dL').onclick = () => run(light, 'light');
  }).catch(() => { $('#dlT').textContent = 'Resources are built into this version, so no download is needed.'; $('#dlB').innerHTML = '<div class="row" style="margin-top:12px"><button class="pr" id="dGo">🚀 Launch</button></div>'; $('#dGo').onclick = () => { open.skipDL = 1; o.remove(); done && done(); }; });
}
function open() { if (ST.on) return; try { AUD.start(); } catch (e) {} if (needDL()) { resPanel(() => open()); return; } if (!open.ok) { PROBE.then(() => { open.ok = 1; open(); }); return; } window.ADV_ON = true; if (!R) build(); R.root.style.display = 'block'; ST.on = true; resize(); misUI(); R.last = 0; requestAnimationFrame(loop); if (!open.shown) { open.shown = 1; openingShot(); } else if (!G('adv_seen', 0)) intro(); }
function close() { try { AUD.stop(); } catch (e) {} ST.on = false; window.ADV_ON = false; if (R) { R.root.style.display = 'none'; R.keys = {}; R.thr = R.bst = 0; } try { if (typeof title === 'function') title(); } catch (e) {} }
window.ADV = { open, close, goto: id => goto(id), count: () => ST.scanned.size, total: ALL.length, _R: () => R };
export { open, close };
