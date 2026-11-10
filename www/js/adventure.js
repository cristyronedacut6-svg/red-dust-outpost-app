/* Red Dust Outpost — Adventure Mode: fly the solar system and scan real NASA spacecraft.
   3D models: NASA 3D Resources (science.nasa.gov/3d-resources, free to use), shrunk for phones. */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/three/libs/meshopt_decoder.module.js';
import { EXTRA, VARIANTS, MOONS, PLUTO, SURF, SAMPLE_FACTS, NEWOBJ, SITES, VESTA, DEM } from './adv_data.js';
import { makeSurface, WORLD, DIVE, DAYH } from './adv_surface.js';
import { RoomEnvironment } from './vendor/three/environments/RoomEnvironment.js';
import { EffectComposer } from './vendor/three/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/three/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/three/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/three/postprocessing/OutputPass.js';
import { ShaderPass } from './vendor/three/postprocessing/ShaderPass.js';
import { makeFX, makeRings, makeWarp, CineShader, SafeShader, VisorShader, RayShader, rockGeo } from './adv_fx.js';
import { AUD } from './adv_audio.js';
import { makeLaunch } from './adv_launch.js';
import { makeMedia } from './adv_media.js';
import { makeProminences, makeAurora, makeComet, makeRingField } from './adv_space.js';
import { OCCS, planetMaterial, atmosphereMaterial, cloudMaterial, ringMaterial, updatePlanetUniforms, sunMaterial, coronaMaterial } from './adv_planet.js';
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
function texFor(b, mat) { const t = texProc(b); if (NASA_TEX.has(b.id) && mat) TL.load('models/tex/' + b.id + '.webp', nt => { if (mat.userData.hd) return; nt.colorSpace = THREE.SRGBColorSpace; nt.anisotropy = 4; mat.map = nt; mat.needsUpdate = true; }); return t; }
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
let GFX = G('adv_gfx', null); if (!PRESETS[GFX]) GFX = PHONE ? 'high' : 'max'; const PRE = () => PRESETS[GFX];
const SET = Object.assign({ cap: 60, scale: 100, fps: 0, voice: 1, newton: 0, orb: 1, launch: 1, rec: 1 }, G('adv_set', {}));
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
#adv .cop{position:absolute;left:0;top:0;display:none;margin:-34px 0 0 -60px;width:120px;text-align:center;font:800 11px var(--disp,system-ui);color:#9dff9d;text-shadow:0 1px 3px #000;white-space:nowrap;pointer-events:none}#adv .cop::after{content:'';display:block;margin:4px auto 0;width:14px;height:14px;border:2px solid #66ff88;border-radius:50%;box-shadow:0 0 8px #66ff88}
#adv #aDrv{left:50%;bottom:calc(146px + env(safe-area-inset-bottom));transform:translateX(-50%);display:none;font-size:13px;padding:8px 16px;background:linear-gradient(180deg,#ffe28a,#d89a2a);color:#1c1003;border-color:#fff3c8}
#adv #aHelm{right:calc(12px + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));display:none;font-size:18px;padding:6px 10px}
#adv #aSuit{position:absolute;left:calc(10px + env(safe-area-inset-left));bottom:calc(64px + env(safe-area-inset-bottom));display:none;z-index:3;pointer-events:none;font:700 10.5px/1.45 ui-monospace,Menlo,monospace;color:#bff6ff;background:rgba(6,16,26,.55);border:1px solid rgba(125,249,255,.3);border-radius:10px;padding:6px 9px;letter-spacing:.03em;text-shadow:0 0 6px rgba(125,249,255,.5);max-width:240px}
#adv #aSuit b{color:#7df9ff;font-weight:800}#adv #aSuit .w{color:#ffcf4a}#adv #aSuit .d{color:#ff6a5a;animation:blk 1s steps(2) infinite}@keyframes blk{50%{opacity:.35}}
#adv.helm #aSuit{left:50%;transform:translateX(-50%);bottom:auto;top:calc(86px + env(safe-area-inset-top));background:none;border:0;text-align:center;max-width:none;font-size:11.5px;color:#9ff8ff}
#adv.cine #aDrv,#adv.cine #aHelm,#adv.cine #aSuit{display:none!important}
#adv .crd.md .rl{display:grid;gap:10px;margin:10px 0;max-height:46vh;overflow:auto}#adv .crd.md .rc{display:grid;grid-template-columns:minmax(120px,46%) 1fr;gap:10px;align-items:center;background:rgba(255,255,255,.05);border-radius:12px;padding:8px}#adv .crd.md video{width:100%;border-radius:8px;background:#000}#adv .crd.md .rm{display:grid;gap:4px;font-size:12px}#adv .crd.md .rm span{opacity:.7}#adv .crd.md .rm div{display:flex;gap:6px}
#adv #aMis{cursor:pointer;pointer-events:auto}#adv #aMis .dly{display:block;font-style:normal;margin-top:4px;padding-top:4px;border-top:1px solid rgba(125,249,255,.25);color:#ffcf4a;font-size:11px}
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
#adv #aHud{position:absolute;inset:0;pointer-events:none;display:none}#adv #aJoy,#adv .rbtn,#adv #aTop,#adv #aLand,#adv #aFly,#adv #aMis,#adv #aSpd,#adv #aToast,#adv #aScan,#adv #aLd,#adv #aFps{z-index:3}#adv #aHud .atb{position:absolute;left:0;top:0;display:none}#adv #aHud .atb i{position:absolute;width:12px;height:12px;border:2px solid #7df9ff;filter:drop-shadow(0 0 4px rgba(125,249,255,.8))}
#adv #aHud .atb i:nth-child(2){left:0;top:0;border-right:0;border-bottom:0}#adv #aHud .atb i:nth-child(3){right:0;top:0;border-left:0;border-bottom:0}#adv #aHud .atb i:nth-child(4){left:0;bottom:0;border-right:0;border-top:0}#adv #aHud .atb i:nth-child(5){right:0;bottom:0;border-left:0;border-top:0}
#adv #aHud .atb.u i{border-color:#ffcf4a;filter:drop-shadow(0 0 4px rgba(255,207,74,.8))}#adv #aHud .atb span{position:absolute;left:50%;top:100%;transform:translate(-50%,6px);font:800 10px var(--disp,system-ui);letter-spacing:.08em;color:#cfefff;white-space:nowrap;text-shadow:0 1px 3px #000}
#adv #aHud .apg{position:absolute;left:0;top:0;width:26px;height:26px;display:none;color:#9dff9d;font:700 22px/26px system-ui;text-align:center;text-shadow:0 0 6px rgba(120,255,120,.8)}
#adv #aHud .ack{position:absolute;inset:0;display:none;background:radial-gradient(ellipse at 50% 50%,transparent 55%,rgba(0,10,20,.55) 100%)}#adv #aHud .cp{position:absolute;background-size:cover;background-position:center;filter:saturate(.8);box-shadow:inset 0 0 40px rgba(0,0,0,.85)}#adv #aHud .cp.top{left:0;right:0;top:0;height:9vh;background-image:url(models/tex/cockpit2.webp);clip-path:polygon(0 0,100% 0,88% 100%,12% 100%)}#adv #aHud .cp.l{left:0;top:0;bottom:0;width:13vw;background-image:url(models/tex/cockpit3.webp);clip-path:polygon(0 0,100% 9vh,55% 78%,0 100%)}#adv #aHud .cp.r{right:0;top:0;bottom:0;width:13vw;background-image:url(models/tex/cockpit3.webp);transform:scaleX(-1);clip-path:polygon(0 0,100% 9vh,55% 78%,0 100%)}#adv #aHud .cp.dash{left:0;right:0;bottom:0;height:24vh;background-image:url(models/tex/cockpit1.webp);clip-path:polygon(0 22%,8% 0,92% 0,100% 22%,100% 100%,0 100%);display:flex;justify-content:center;align-items:flex-start;gap:2vw;padding-top:2.4vh}
#adv #aHud .mfd{width:min(22vw,180px);height:13vh;min-height:64px;background:#020c08;border:3px solid #2a2f33;border-radius:6px;box-shadow:0 0 0 2px #0a0d10,inset 0 0 18px rgba(80,255,140,.18);color:#7dff9d;font:600 clamp(8px,1.4vh,11px)/1.45 ui-monospace,monospace;padding:6px 8px;overflow:hidden;text-shadow:0 0 6px rgba(80,255,140,.6)}#adv #aHud .mfd b{display:inline-block;width:6.2em;color:#3fcf6f;font-weight:700}
#adv #aHud .ack svg{position:absolute;left:50%;top:50%;width:200px;transform:translate(-50%,-50%)}
#adv #aHeat{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:6;background:radial-gradient(ellipse at 50% 60%,rgba(255,170,80,0) 25%,rgba(255,110,30,.45) 70%,rgba(255,60,10,.75) 100%)}#adv #aHeat.w{background:#fff}
#adv.cine #aTop,#adv.cine #aJoy,#adv.cine .rbtn,#adv.cine #aLand,#adv.cine #aFly,#adv.cine #aMis,#adv.cine #aSpd,#adv.cine #labs,#adv.cine #aHud,#adv.cine #aLd{display:none!important}
#adv.photo #aTop,#adv.photo #aJoy,#adv.photo .rbtn,#adv.photo #aLand,#adv.photo #aMis,#adv.photo #aSpd,#adv.photo #labs,#adv.photo #aLd,#adv.photo #aToast{display:none!important}
#adv.photo::before,#adv.photo::after{content:'';position:absolute;left:0;right:0;height:9vh;background:#000;z-index:7;pointer-events:none}#adv.photo::before{top:0}#adv.photo::after{bottom:0}
#adv #aPh{position:absolute;inset:0;z-index:8;display:none;align-items:flex-end;justify-content:center;padding-bottom:3vh;font:700 11px var(--disp,system-ui);letter-spacing:.2em;color:rgba(255,255,255,.6)}#adv.photo #aPh{display:flex}
#adv #aTop #aMore{display:none}
/* phones and small screens: compact icon buttons pinned to the edges, so the middle of the screen stays clear for the view */
@media (pointer:coarse),(max-width:760px){
#adv #aTop{gap:4px;flex-wrap:nowrap;max-width:calc(100vw - 16px)}#adv #aTop .ab{padding:0;width:34px;height:34px;display:inline-grid;place-items:center;font-size:14px;border-radius:10px}#adv #aTop .lb{display:none}
#adv #aMis{max-width:min(44vw,260px);font-size:10.5px;padding:5px 8px;border-radius:10px;max-height:34vh;overflow:hidden}#adv #aMis b{font-size:8.5px}#adv #aMis .dly{font-size:9.5px;margin-top:3px;padding-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#adv #aLd{top:auto;bottom:calc(52px + env(safe-area-inset-bottom));left:calc(10px + env(safe-area-inset-left));transform:none;font-size:9.5px;padding:3px 9px}
#adv #aSpd{left:calc(10px + env(safe-area-inset-left));transform:none;max-width:calc(100vw - 130px);white-space:normal;font-size:9.5px;line-height:1.3;padding:3px 8px;pointer-events:none}
#adv #aToast{max-width:86vw;font-size:12px;top:16%}
#adv #aThr{width:68px;height:68px;right:calc(12px + env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));font-size:9px}
#adv #aBst{width:50px;height:50px;right:calc(88px + env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));font-size:9px}
#adv #aScn{width:50px;height:50px;right:calc(22px + env(safe-area-inset-right));bottom:calc(90px + env(safe-area-inset-bottom));font-size:9px}
#adv #aLand,#adv #aFly,#adv #aDrv{left:auto;right:calc(10px + env(safe-area-inset-right));transform:none;font-size:11px;padding:7px 11px;border-radius:10px;max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#adv #aLand{bottom:calc(152px + env(safe-area-inset-bottom));animation:none}#adv #aFly{bottom:calc(192px + env(safe-area-inset-bottom))}#adv #aDrv{bottom:calc(232px + env(safe-area-inset-bottom))}
#adv #aHelm{top:calc(50px + env(safe-area-inset-top));font-size:15px;padding:4px 8px}
#adv #aSuit{font-size:8.5px;padding:4px 7px;bottom:auto;top:calc(var(--misH,64px) + 14px + env(safe-area-inset-top));max-width:48vw}
}
/* narrow (portrait) phones: the extra tools fold into a menu */
@media (max-width:600px){#adv #aTop #aMore{display:inline-grid}#adv #aTop .sec{display:none}#adv #aTop.open{flex-wrap:wrap;justify-content:flex-end;max-width:min(260px,calc(100vw - 16px));background:rgba(6,10,22,.85);border:1px solid rgba(125,249,255,.3);border-radius:14px;padding:6px;z-index:6}#adv #aTop.open .sec{display:inline-grid}#adv #aTop.open #aMore{background:rgba(125,249,255,.25)}}
#adv #aFps{position:absolute;left:calc(10px + env(safe-area-inset-left));bottom:calc(6px + env(safe-area-inset-bottom));font:700 10px ui-monospace,monospace;color:#9dff9d;background:rgba(0,0,0,.45);padding:2px 6px;border-radius:6px;display:none;pointer-events:none;z-index:4}
#adv .seg{display:flex;gap:6px;flex-wrap:wrap}#adv .seg button.sel{border-color:#ffcf4a;background:rgba(255,207,74,.18)}#adv h4.sh{margin:12px 0 6px;font-size:10px;letter-spacing:.14em;color:#9fb3c8}
#adv #aTitle{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;pointer-events:auto;transition:opacity 1.2s;opacity:0;background:linear-gradient(transparent 70%,rgba(0,0,0,.35))}#adv #aTitle.on{opacity:1}#adv #aTitle.off{opacity:0;pointer-events:none}
#adv #aTitle .k{font:700 11px var(--disp,system-ui);letter-spacing:.5em;color:#cfe9ff;opacity:.85;animation:tIn 2s ease both}#adv #aTitle h1{margin:10px 0 6px;font:900 clamp(30px,7vw,72px)/1 var(--disp,system-ui);letter-spacing:.12em;text-shadow:0 0 30px rgba(125,249,255,.45),0 4px 20px #000;animation:tIn 2.4s .4s ease both}
#adv #aTitle .s{font:700 clamp(11px,1.8vw,15px) var(--disp,system-ui);letter-spacing:.45em;color:#ffcf4a;animation:tIn 2s 1s ease both}#adv #aTitle .m{position:absolute;bottom:12vh;font:600 11px var(--disp,system-ui);letter-spacing:.12em;opacity:.6;animation:tIn 2s 2s ease both}
@keyframes tIn{from{opacity:0;transform:translateY(10px);letter-spacing:.9em}to{opacity:1}}
#adv.intro::before,#adv.intro::after{content:'';position:absolute;left:0;right:0;height:10vh;background:#000;z-index:8;pointer-events:none}#adv.intro::before{top:0}#adv.intro::after{bottom:0}
#adv.demo #aDemo{background:#ffcf4a;color:#1a1200}
#adv.glitch canvas{filter:hue-rotate(80deg) saturate(2) contrast(1.3);animation:gl .12s steps(2) 6}@keyframes gl{50%{transform:translate(4px,-2px) skewX(3deg)}}
#adv .trophy{position:absolute;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translate(-50%,-20px);opacity:0;transition:all .45s cubic-bezier(.2,1.4,.4,1);z-index:9;display:flex;gap:10px;align-items:center;background:linear-gradient(180deg,#2a2208,#130f04);border:1.5px solid #ffcf4a;border-radius:14px;padding:8px 16px 8px 10px;box-shadow:0 0 30px rgba(255,207,74,.35);pointer-events:none}
#adv .trophy.on{opacity:1;transform:translate(-50%,0)}#adv .trophy span{font-size:30px}#adv .trophy small{display:block;font:800 9px var(--disp,system-ui);letter-spacing:.18em;color:#ffcf4a}#adv .trophy b{display:block;font-size:15px}#adv .trophy i{display:block;font-style:normal;font-size:11px;opacity:.8}
#adv .tg{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}#adv .tc{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px;font-size:11px;opacity:.5;display:grid;grid-template-columns:auto 1fr;gap:2px 8px;align-items:center}#adv .tc span{font-size:22px;grid-row:span 2}#adv .tc small{opacity:.8}#adv .tc.g{opacity:1;border-color:#ffcf4a;background:rgba(255,207,74,.08)}
#adv .bar1{height:8px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden;margin:4px 0 8px}#adv .bar1 i{display:block;height:100%;background:linear-gradient(90deg,#ffcf4a,#ff9a3a)}
#adv #aEnd{position:absolute;inset:0;z-index:10;background:radial-gradient(ellipse at 50% 45%,#1b0b33,#04020a 70%);display:flex;align-items:center;justify-content:center;text-align:center;color:#f2e8ff;padding:24px}
#adv #aEnd .eL{max-width:720px;opacity:0;transform:translateY(12px);transition:all 1.4s}#adv #aEnd .eL.in{opacity:1;transform:none}#adv #aEnd .eL p{font:600 clamp(17px,2.6vw,26px)/1.5 var(--disp,system-ui);margin:0 0 12px}#adv #aEnd .eL p.b{color:#c9a0ff}
#adv #aEnd .roll{animation:roll 2.4s ease both}#adv #aEnd .roll h1{font:900 clamp(30px,6vw,64px) var(--disp,system-ui);letter-spacing:.12em;margin:0;text-shadow:0 0 30px rgba(176,112,255,.6)}#adv #aEnd .roll h2{font:800 clamp(20px,3.6vw,34px) var(--disp,system-ui);color:#ffcf4a;letter-spacing:.2em;margin:4px 0}#adv #aEnd .roll p{margin:4px 0;opacity:.85;letter-spacing:.08em}
#adv #aEnd button{margin-top:18px;border:1px solid #c9a0ff;background:#7a3fd0;color:#fff;border-radius:12px;padding:12px 22px;font:800 15px var(--disp,system-ui)}@keyframes roll{from{opacity:0;transform:translateY(30px)}to{opacity:1}}
@media (hover:hover) and (pointer:fine){#adv #aJoy,#adv #aThr,#adv #aBst{display:none}#adv #aScn{right:20px;bottom:20px}}`; document.head.appendChild(s);
}

/* ---------------- build the scene ---------------- */
function build() {
  css(); try { MeshoptDecoder.useWorkers(Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))); } catch (e) {} const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); // geometry decoding runs on background threads, so loading doesn't stutter
  const root = document.createElement('div'); root.id = 'adv'; root.innerHTML = `<canvas></canvas><div id="aLoad">🚀 Preparing the solar system…</div><div id="aMis"></div><div id="aTop"><button class="ab sec" id="aQ" title="Graphics"></button><button class="ab" id="aMap" title="Map">🗺<span class="lb"> Map</span></button><button class="ab" id="aCod" title="Codex">📖<span class="lb"> Codex</span></button><button class="ab sec" id="aHan" title="Hangar">🛠<span class="lb"> Hangar</span></button><button class="ab sec" id="aTro" title="Trophies">🏆</button><button class="ab sec" id="aCo" title="Co-op: fly with a friend">👥</button><button class="ab sec" id="aSky" title="Star chart (K)">✨</button><button class="ab sec" id="aMed" title="Postcards and replays">🎬</button><button class="ab sec" id="aDL" title="Download resources">⬇</button><button class="ab sec" id="aCam" title="Camera (V)">🎥</button><button class="ab" id="aPhoto" title="Photo mode (P)">📷</button><button class="ab sec" id="aDemo" title="Demo tour">🎬<span class="lb"> Demo</span></button><button class="ab" id="aMore" title="More">☰</button><button class="ab" id="aX" title="Exit">✕<span class="lb"> Exit</span></button></div>
  <div id="labs"></div><div id="aJoy"><div class="k"><i></i></div></div><button class="rbtn" id="aBst">BOOST</button><button class="rbtn" id="aThr">🚀<br>THRUST</button><button class="rbtn" id="aScn">📡<br>SCAN</button><button class="ab" id="aLand"></button><button class="ab" id="aFly"></button><button class="ab" id="aDrv"></button><button class="ab" id="aHelm" title="Helmet view (V)">🪖</button><div id="aSuit"></div><div id="aScan">SCANNING…</div><div id="aSpd"></div><div id="aToast"></div><div id="aLd"></div><div id="aFps"></div><div id="aHud"><div class="atb"><span></span><i></i><i></i><i></i><i></i></div><div class="apg">◎</div><div class="ack"><div class="cp top"></div><div class="cp l"></div><div class="cp r"></div><div class="cp dash"><div class="mfd" id="mfd1"></div><div class="mfd" id="mfd2"></div><div class="mfd" id="mfd3"></div></div><svg viewBox="0 0 200 120"><path d="M70 60h22M108 60h22M100 52v-10M100 68v10" stroke="#7df9ff" stroke-width="2" fill="none"/><circle cx="100" cy="60" r="3" fill="#7df9ff"/></svg></div></div><div id="aPh">📷 PHOTO MODE · tap to exit</div>`;
  document.body.appendChild(root);
  const cv = root.querySelector('canvas'), mob = matchMedia('(pointer:coarse)').matches;
  const ren = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
  ren.setPixelRatio(dprCap()); ren.info.autoReset = false; ren.shadowMap.enabled = true; ren.shadowMap.autoUpdate = false; ren.shadowMap.needsUpdate = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.05;
  cv.addEventListener('webglcontextlost', ev => { ev.preventDefault(); if (R) { R.lost = true; toast('⚠ Graphics memory full: recovering…', 3000); } });
  cv.addEventListener('webglcontextrestored', () => { if (!R) return; R.lost = false; DR.s = .7; R.ren.setPixelRatio(Math.min(devicePixelRatio || 1, 2) * .7); resize(); LQ.max = 2; toast('✅ Graphics recovered', 1800); });
  const scn = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, .1, 12000);
  // realistic reflections on the NASA models: a studio environment map, plus bloom for glowing things
  const pm = new THREE.PMREMGenerator(ren), envTex = pm.fromScene(new RoomEnvironment(), .04).texture; scn.environment = envTex; scn.environmentIntensity = .45;
  const hdrOK = ren.capabilities.isWebGL2 && (ren.extensions.has('EXT_color_buffer_float') || ren.extensions.has('EXT_color_buffer_half_float')); R_HDR = hdrOK;
  const comp = new EffectComposer(ren, new THREE.WebGLRenderTarget(4, 4, { type: hdrOK ? THREE.HalfFloatType : THREE.UnsignedByteType, samples: hdrOK ? PRE().msaa : 0 })), rp = new RenderPass(scn, cam), bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), PRE().bloom, .4, .95), bloomSz = bloom.setSize.bind(bloom), cine = new ShaderPass(CineShader); /* bloom is a soft glow anyway: run its blur chain at half the usual size (except on Max) */ bloom.setSize = (w, h) => GFX === 'max' ? bloomSz(w, h) : bloomSz(Math.max(2, w * .5), Math.max(2, h * .5)); comp.addPass(rp); comp.addPass(new ShaderPass(SafeShader)); comp.addPass(bloom); const rays = new ShaderPass(RayShader); rays.enabled = false; comp.addPass(rays); comp.addPass(new OutputPass()); const visor = new ShaderPass(VisorShader); visor.enabled = false; comp.addPass(visor); comp.addPass(cine);
  scn.add(new THREE.AmbientLight(0x8090b0, .22)); const sunL = new THREE.PointLight(0xfff2dd, 3.2, 0, 0); scn.add(sunL);
  const hem = new THREE.HemisphereLight(0xbfd8ff, 0x201810, .12); scn.add(hem);
  // stars
  { const n = 4000, p = new Float32Array(n * 3), c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, t = Math.random() * 6.283, r = 6000 + Math.random() * 3000, s = Math.sqrt(1 - u * u); p.set([Math.cos(t) * s * r, u * r, Math.sin(t) * s * r], i * 3); const w = .6 + Math.random() * .4; c.set([w, w, w * (.85 + Math.random() * .3)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); scn.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true }))); }
  // NASA Tycho star map as the sky
  { const smat = new THREE.ShaderMaterial({ uniforms: { map: { value: null }, neb: { value: GFX === 'low' ? .5 : 1 } }, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vD; void main(){ vUv = uv; vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform sampler2D map; uniform float neb; varying vec2 vUv; varying vec3 vD;
      vec3 h3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p) * 43758.5453) * 2. - 1.; }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f); return mix(mix(mix(dot(h3(i), f), dot(h3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x), mix(dot(h3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(h3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y), mix(mix(dot(h3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(h3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x), mix(dot(h3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(h3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z); }
      float fb(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.03; a *= .5; } return s; }
      void main(){ vec3 c = texture2D(map, vUv).rgb; float l = max(c.r, max(c.g, c.b)); vec3 o = c * (.55 + 2.6 * smoothstep(.25, .9, l)) * smoothstep(.015, .06, l);
        vec3 d = normalize(vD); float g = dot(d, normalize(vec3(.32, .88, .35))), band = exp(-g * g / .045);
        float dust = smoothstep(.05, .35, fb(d * 6. + 3.)) * exp(-g * g / .006);                         // dark lanes through the galactic core
        float core = pow(max(dot(d, normalize(vec3(-.6, .3, .74))), 0.), 6.);                           // bright galactic centre
        vec3 mw = vec3(.95, .82, .7) * band * (.035 + core * .11) * (.6 + .8 * fb(d * 9.)) * (1. - dust * .85);
        float n1 = fb(d * 2.2 + 11.), n2 = fb(d * 3.1 - 7.), n4 = fb(d * 5. + 2.);
        vec3 nb = vec3(.55, .2, .75) * smoothstep(.12, .5, n1) * .05 + vec3(.15, .45, .7) * smoothstep(.18, .55, n2) * .04 + vec3(.8, .35, .2) * smoothstep(.25, .6, n4) * .025;
        gl_FragColor = vec4(o + (mw + nb * (.4 + band)) * neb, 1.); }` });
    const sm = new THREE.Mesh(new THREE.SphereGeometry(9500, 64, 32), smat); STARSPHERE = sm; sm.renderOrder = -1; scn.add(sm); TL.load('models/tex/stars.webp', t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; smat.uniforms.map.value = t; R && (R.starTex = t); bakeSky(ren, sm, smat, hdrOK); }); }
  // bodies
  const bpos = {}; BODIES.forEach(b => { if (!b.at) bpos[b.id] = new THREE.Vector3(Math.cos(b.a) * b.d, 0, Math.sin(b.a) * b.d); });
  BODIES.forEach(b => { if (b.at) bpos[b.id] = bpos[b.at].clone().add(new THREE.Vector3(...b.off)); }); orbitPos(bpos, orbT());   // start where the clock says the worlds are
  const bmesh = {}, PL = [];
  const ATM = { earth: [0x5fa8ff, .9], venus: [0xffd28a, .7], mars: [0xff9a6a, .35], titan: [0xffb05a, .8], jupiter: [0xffe2b0, .35], saturn: [0xfff0c8, .3], uranus: [0xa8f0ff, .45], neptune: [0x7aa0ff, .45], pluto: [0x9ab4ff, .15] };
  BODIES.forEach(b => { const geo = new THREE.SphereGeometry(b.r, b.r > 20 ? 64 : 40, b.r > 20 ? 48 : 28);
    const mat = b.id === 'sun' ? sunMaterial() : planetMaterial(null, { atmo: (ATM[b.id] || [0])[0], atmoK: (ATM[b.id] || [0, 0])[1], ocean: b.id === 'earth', flow: { jupiter: 1, saturn: .6, uranus: .25, neptune: .5 }[b.id] || 0 }); if (b.id !== 'sun') mat.map = texFor(b, mat); PL.push({ mat }); if (b.id === 'earth') TL.load('models/tex/earth_night.webp', nt => { nt.colorSpace = THREE.SRGBColorSpace; nt.anisotropy = 4; mat.uniforms.night.value = nt; mat.uniforms.hasNight.value = 1; }); // NASA Black Marble 2016: real city lights
    const m = new THREE.Mesh(geo, mat); m.position.copy(bpos[b.id]); m.rotation.order = 'ZYX';   // spin around the tilted axis, not wobble
    { const tl = b.tilt ?? { earth: .41, mars: .44, saturn: .47, neptune: .49, jupiter: .05 }[b.id]; if (tl) m.rotation.z = tl; } scn.add(m); bmesh[b.id] = m;
    if (b.id === 'io') ioPlumes(m, b.r); if (b.id === 'jupiter' && mat.uniforms.grs) { mat.uniforms.grs.value.set(.62, .378, .06, 1); mat.uniforms.storm.value = 1; } if (b.id === 'saturn' && mat.uniforms.storm) mat.uniforms.storm.value = .5;
    if (b.id === 'earth') SPACEFX.push(makeAurora(m, b.r, 0x3dff8a, 0xff4d6d)); if (b.id === 'jupiter') SPACEFX.push(makeAurora(m, b.r, 0x9a7bff, 0xff7be0)); if (b.id === 'saturn') SPACEFX.push(makeAurora(m, b.r, 0x8a7bff, 0xff6fd0));
    if (b.model) loader.load('models/nasa/' + b.model + '.glb', gl => { const sm = gl.scene, bx = new THREE.Box3().setFromObject(sm), sp = bx.getBoundingSphere(new THREE.Sphere()), k = b.r * 1.15 / sp.radius; sm.position.sub(sp.center).multiplyScalar(k); sm.scale.setScalar(k); m.add(sm); mat.visible = false; });
    if (b.id === 'sun') { // screen-space lens flare made of sprites (no framebuffer reads, so no flicker with anti-aliasing)
      const ft = glowTex('rgba(255,255,255,1)', 'rgba(255,200,120,.35)'), rt = glowTex('rgba(255,255,255,.0)', 'rgba(160,200,255,.25)'); FLARE.length = 0;
      [[.16, 0, ft, 0xfff2d8], [.18, 0, ft, 0xbfd8ff, 1], [.03, .6, rt, 0xffffff], [.05, .7, rt, 0xcfe0ff], [.08, .9, rt, 0xbfd4ff], [.03, 1, rt, 0xffe0c0]].forEach(([sz, d, t, c, ana]) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: c, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true })); sp.renderOrder = 20; sp.userData = { sz, d, ana }; sp.visible = false; scn.add(sp); FLARE.push(sp); });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,240,200,1)', 'rgba(255,170,60,.45)'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: .55 })); s.scale.set(320, 320, 1); m.add(s);
      const cm = coronaMaterial(); PL.push({ mat: cm }); m.add(new THREE.Mesh(new THREE.SphereGeometry(b.r * 1.35, 64, 48), cm)); SPACEFX.push(makeProminences(m, b.r)); }
    const AC = { earth: 0x5fa8ff, venus: 0xffd28a, mars: 0xff9a6a, titan: 0xffb05a, jupiter: 0xffe2b0, saturn: 0xfff0c8, uranus: 0xa8f0ff, neptune: 0x7aa0ff, pluto: 0x9ab4ff }[b.id];
    if (AC) { const sm = atmosphereMaterial(AC, b.id === 'earth' ? 3.2 : 4); PL.push({ mat: sm });
      m.add(new THREE.Mesh(new THREE.SphereGeometry(b.r * 1.035, 64, 48), sm)); }
    if (b.id === 'earth') { const cv3 = document.createElement('canvas'); cv3.width = 1024; cv3.height = 512; const g3 = cv3.getContext('2d'), id3 = g3.createImageData(1024, 512); for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) { const lo = x / 1024 * 6.283, la = (.5 - y / 512) * Math.PI, X = Math.cos(la) * Math.cos(lo) * 2.2, Y = Math.sin(la) * 2.2, Z = Math.cos(la) * Math.sin(lo) * 2.2, w1 = fbm(X + 9, Z + Y * .6, 3), w2 = fbm(Z + 3, Y - X * .5, 3), v = (fbm(X * 1.6 + w1 * 1.8 + 40, Y * 1.6 + w2 * 1.8, 6) + fbm(Z * 1.6 + w2 * 1.5, X * 1.6 - Y + w1, 6)) * .5, al = Math.abs(la) / 1.5708, band = .15 * Math.exp(-Math.pow(al / .08, 2)) - .1 * Math.exp(-Math.pow((al - .28) / .1, 2)) + .1 * Math.exp(-Math.pow((al - .6) / .15, 2)), a = Math.max(0, (v + band - .5) * 3.4), o = (y * 1024 + x) * 4; id3.data[o] = id3.data[o + 1] = id3.data[o + 2] = 255; id3.data[o + 3] = Math.min(255, a * 255); }
      g3.putImageData(id3, 0, 0); const ctex = new THREE.CanvasTexture(cv3); ctex.colorSpace = THREE.SRGBColorSpace; const cmat = cloudMaterial(ctex); PL.push({ mat: cmat }); const cl = new THREE.Mesh(new THREE.SphereGeometry(b.r * 1.012, 64, 48), cmat); m.add(cl); m.userData.clouds = cl;
      // HD pack: NASA's real cloud cover, ocean mask and relief replace the generated ones when they're on the device
      const cl2k = () => TL.load('models/tex/hd/earth_clouds.webp', t => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; cmat.uniforms.map.value = t; cmat.uniforms.useR.value = 1; }, undefined, () => {});
      TL.load('models/tex/hd/earth_clouds4k.webp', t => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; cmat.uniforms.map.value = t; cmat.uniforms.useR.value = 1; }, undefined, cl2k);   /* 4K NASA Blue Marble clouds and surface */
      TL.load('models/tex/hd/earth_day4k.webp', t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; mat.userData.hd = 1; mat.map = t; mat.needsUpdate = true; }, undefined, () => {});
      TL.load('models/tex/hd/earth_spec.webp', t => { t.colorSpace = THREE.NoColorSpace; mat.uniforms.specMap.value = t; mat.uniforms.hasSpec.value = 1; }, undefined, () => {});
      TL.load('models/tex/hd/earth_normal.webp', t => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; mat.uniforms.nrmMap.value = t; mat.uniforms.hasNrm.value = 1; }, undefined, () => {}); }
    if (b.rings) { const cv2 = document.createElement('canvas'); cv2.width = 256; cv2.height = 4; const g2 = cv2.getContext('2d'); for (let i = 0; i < 256; i++) { const a = (i > 30 && i < 245) ? (.25 + .6 * vnoise(i * .15, 3)) * (i > 150 && i < 165 ? .1 : 1) : 0; g2.fillStyle = `rgba(230,215,180,${a})`; g2.fillRect(i, 0, 1, 4); }
      const rg = new THREE.RingGeometry(b.r * 1.25, b.r * 2.3, 128, 1), pos = rg.attributes.position, uv = rg.attributes.uv, v = new THREE.Vector3(); for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - b.r * 1.25) / (b.r * 1.05), .5); }
      const t2 = new THREE.CanvasTexture(cv2); t2.colorSpace = THREE.SRGBColorSpace; const rmat = ringMaterial(t2, b.r); PL.push({ mat: rmat, mesh: m }); const ring = new THREE.Mesh(rg, rmat); ring.rotation.x = -Math.PI / 2; m.add(ring);   // rings lie in the equator; the planet itself carries the 27° tilt
      SPACEFX.push(makeRingField(ring, b.r * 1.25, b.r * 2.3, u => { const i = Math.floor(u * 255); return (i > 30 && i < 245) ? (.25 + .6 * vnoise(i * .15, 3)) * (i > 150 && i < 165 ? .1 : 1) : 0; }));
      if (m.material && m.material.uniforms && m.material.uniforms.hasRing) { const u = m.material.uniforms; u.ringMap.value = t2; u.hasRing.value = 1; u.ringR.value.set(b.r * 1.25, b.r * 2.3); PL.push({ mat: m.material, ring }); } } });
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
  function placeObj(e, t) { if (e.o.story) return; const o = e.o, c = o.rel ? (R.byId[o.rel] ? R.byId[o.rel].g.position : bpos[o.at]) : bpos[o.at], B = BI[o.at];
    if (o.surf) { const la = o.surf[0] * Math.PI / 180, lo = o.surf[1] * Math.PI / 180 + t * .02, n = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)); e.g.position.copy(c).addScaledVector(n, B.r + o.sz * .45 + (o.hov ? o.hov + Math.sin(t * 2) * .3 : 0)); e.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); e.n = n; }
    else if (o.orb) { const [r, inc, ph] = o.orb, a = ph + t * (3 / Math.max(6, r)) * .6 * (o.id === 'iss' ? 2.4 : 1); e.g.position.set(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * Math.sin(inc), c.z + Math.sin(a) * r * Math.cos(inc)); e.g.rotation.y = -a; }
    else if (o.l) { e.g.position.set(c.x + o.l[0], c.y + o.l[1] + Math.sin(t * .4 + o.l[2]) * (o.rel ? .25 : .6), c.z + o.l[2]); e.g.rotation.y = t * (o.rel ? .3 : .05); if (o.rel) e.g.rotation.x = t * .2; } }
  // two detail levels per object: a light preview (lod/, ~5% of the triangles, small textures) that streams in fast for everything nearby,
  // then the full-detail NASA model when you fly close. Far full models are unloaded; previews stay.
  function loadModel(e, full) { const key = full ? 'model' : 'lod'; if (e.loading || e[key]) return; e.loading = true; LQ.busy++;
    const fin = () => { LQ.busy = Math.max(0, LQ.busy - 1); e.loading = false; };
    loader.load('models/nasa/' + (full ? '' : 'lod/') + (e.o.model || e.o.id) + '.glb', gl => { fin(); const m = gl.scene;
      if (!full && e.fit) { m.position.copy(e.fit.p); m.scale.setScalar(e.fit.k); } else { const box = new THREE.Box3().setFromObject(m), sph = box.getBoundingSphere(new THREE.Sphere()), k = e.o.sz / Math.max(.001, sph.radius); m.position.copy(sph.center).multiplyScalar(-k); m.scale.setScalar(k); if (!e.fit) e.fit = { p: m.position.clone(), k }; }
      m.traverse(n => { if (n.isMesh) { n.receiveShadow = true; n.castShadow = true; } if (n.isMesh && n.material) { n.material.side = THREE.FrontSide; if (n.material.metalness > .6) n.material.metalness = .6; } }); fixMat(m); e.g.add(m); e[key] = m; pre(m, R.scn); navLights(e, m); if (full) { e.cost = costOf(m); MEM.tris += e.cost.tris; MEM.tex += e.cost.tex; } },
      undefined, () => { fin(); if (full) { e.failed = (e.failed || 0) + 1; e.retryT = R.t + 8; } else { e.noLod = 1; } }); }
  // the ship (NASA's ESAS crew module concept, the design that became Orion)
  const ship = new THREE.Group(); scn.add(ship); { const tmp = new THREE.Mesh(new THREE.ConeGeometry(.9, 1.8, 16), new THREE.MeshStandardMaterial({ color: 0xdfe4ee, metalness: .3, roughness: .5 })); tmp.rotation.x = Math.PI / 2; ship.add(tmp); ship.userData.tmp = tmp;
    ship.userData.loader = loader; }
  const engL = new THREE.PointLight(0x9fd8ff, 0, 40, 2); scn.add(engL);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,255,255,1)', 'rgba(110,190,255,.6)'), blending: THREE.AdditiveBlending, depthWrite: false })); flame.position.set(0, 0, 1.4); ship.add(flame);
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: .9 })); beam.visible = false; scn.add(beam);
  BODIES.forEach(b => { const m = bmesh[b.id]; if (!m || !m.material.uniforms || !m.material.uniforms.occ) return; const u = m.material.uniforms;
    if (b.at && BI[b.at] && b.at !== 'sun') u.occ.value.set(bpos[b.at].x, bpos[b.at].y, bpos[b.at].z, BI[b.at].r);
    const kids = BODIES.filter(x => x.at === b.id).sort((a, c) => c.r / bpos[c.id].distanceTo(bpos[b.id]) - a.r / bpos[a.id].distanceTo(bpos[b.id])); if (kids[0]) u.occ2.value.set(bpos[kids[0].id].x, bpos[kids[0].id].y, bpos[kids[0].id].z, kids[0].r); });
  const DUSTN = mob ? 500 : 900, dpos = new Float32Array(DUSTN * 3); for (let i = 0; i < DUSTN * 3; i++) dpos[i] = (Math.random() - .5) * 80;
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3)); const dmat = new THREE.PointsMaterial({ color: 0xbfd0ff, size: .14, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)') });
  const spaceDust = new THREE.Points(dgeo, dmat); spaceDust.frustumCulled = false; scn.add(spaceDust);
  // ---- story bridge: the purple signal the six outposts sent toward the asteroid belt (Story Mode's mystery) ----
  let anomaly = null; { const clues = (G('clues', []) || []).length; if (clues > 0) { const g = new THREE.Group(), a = 2.05, d = 935; g.position.set(Math.cos(a) * d, 6, Math.sin(a) * d); scn.add(g);
      const cm = new THREE.MeshStandardMaterial({ color: 0x8a40ff, emissive: 0x9a50ff, emissiveIntensity: 2.4, roughness: .15, metalness: .4, transparent: true, opacity: .92 }); const cr = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), cm); cr.scale.set(1, 1.8, 1); g.add(cr);
      [[1.1, .8], [-1.2, 1.4], [.4, -1.6]].forEach(([x, z], i) => { const sh = new THREE.Mesh(new THREE.OctahedronGeometry(.7 + i * .15, 0), cm); sh.position.set(x * 2.4, (i - 1) * 1.2, z * 2.4); sh.scale.y = 1.7; g.add(sh); });
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,255,255,1)', 'rgba(170,90,255,.5)'), blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(22); g.add(halo);
      const pl = new THREE.PointLight(0xa060ff, 40, 80, 2); g.add(pl);
      const sp = new THREE.Sprite(mk); sp.scale.set(.02, .02, 1); g.add(sp);
      const o = { id: 'anomaly', n: 'The Purple Signal', k: 'Origin unknown', sz: 3, story: 1, ag: '???', facts: [] };
      anomaly = { o, g, sp, model: cr, lod: null, loading: false, cr, halo, clues }; objs.push(anomaly); } }
  R = { rays, visor, anomaly, spaceDust, engL, PL, comp, rp, bloom, cine, fx: makeFX(scn, 2600), rings: makeRings(scn), warp: makeWarp(scn), yi: 0, pi: 0, envTex, byId: Object.fromEntries(objs.map(e => [e.o.id, e])), mkS, root, ren, scn, cam, bpos, bmesh, objs, ship, flame, beam, placeObj, loadModel, mob, vel: new THREE.Vector3(), yaw: 0, pitch: 0, t: 0, labs: root.querySelector('#labs'), lab: [], keys: {}, joy: { x: 0, y: 0 }, thr: 0, bst: 0, ap: null, scanning: null, last: 0 };
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
    ui: (b, W, mode) => surfUI(b, W, mode), trophy, ship: () => R.shipStat || SHIPS[0], fixMat, craftUI: (on, cr) => { if (!cr || !cr.n) cr = (R.surf && R.surf.S.body && craftFor(R.surf.S.body.id)) || { n: 'craft' }; const b = R.root.querySelector('#aFly'); b.innerHTML = on ? '🧑‍🚀 LAND & WALK' : (cr.heli ? '🚁 ' : '✈ ') + 'FLY ' + cr.n.toUpperCase(); R.root.querySelector('#aThr').innerHTML = on ? (cr.heli ? '⬆<br>CLIMB' : '⬆<br>PULL UP') : '⤒<br>JUMP'; R.root.querySelector('#aBst').innerHTML = on ? (cr.heli ? 'FAST' : 'THROTTLE') : 'RUN'; } });
  root.querySelector('#aLand').onclick = () => landOrLaunch(); root.querySelector('#aQ').innerHTML = '⚙<span class="lb"> ' + PRE().n + '</span>'; root.querySelector('#aQ').onclick = () => settings();
}
let R_HDR = true; const dprCap = () => Math.min(devicePixelRatio || 1, PRE().dpr) * SET.scale / 100; // blinking navigation lights (red port, green starboard, white strobe) on spacecraft, like real ones
const NAV = { r: null, g: null, w: null };
function navLights(e, m) { if (e.nav || e.o.far || /^ast-|^storm-|^neb-|^snr-|supernova|nebula/.test(e.o.id) || e.o.r) return; e.nav = 1;
  if (!NAV.r) { const t = glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,.35)'); NAV.r = new THREE.SpriteMaterial({ map: t, color: 0xff3030, blending: THREE.AdditiveBlending, depthWrite: false }); NAV.g = new THREE.SpriteMaterial({ map: t, color: 0x30ff60, blending: THREE.AdditiveBlending, depthWrite: false }); NAV.w = new THREE.SpriteMaterial({ map: t, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false }); }
  e.g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m), inv = e.g.matrixWorld.clone().invert(), lo = b.min.clone().applyMatrix4(inv), hi = b.max.clone().applyMatrix4(inv), cy = (lo.y + hi.y) / 2, cz = (lo.z + hi.z) / 2, s = e.o.sz * .22;
  [[NAV.r, Math.min(lo.x, hi.x), cy, cz], [NAV.g, Math.max(lo.x, hi.x), cy, cz], [NAV.w, (lo.x + hi.x) / 2, Math.max(lo.y, hi.y), cz]].forEach(([mt, x, y, z]) => { const sp = new THREE.Sprite(mt); sp.position.set(x, y, z); sp.scale.setScalar(s); e.g.add(sp); }); }
function navBlink(t) { if (!NAV.r) return; const ph = t % 1.6; NAV.w.opacity = ph < .07 || (ph > .2 && ph < .27) ? 1 : 0; const p2 = .55 + .45 * (Math.sin(t * 3) > 0 ? 1 : .35); NAV.r.opacity = NAV.g.opacity = p2; }
const LQ = { busy: 0, max: (navigator.hardwareConcurrency || 4) >= 8 ? 6 : 4 }, FLARE = [];
function flare() { if (!FLARE.length) return; const sp = R.bpos.sun, v = tmpV.copy(sp).project(R.cam), on = v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3;
  // hidden when a planet blocks the Sun
  let occ = 0; if (on) { const o = R.cam.position, dir = new THREE.Vector3().subVectors(sp, o), L = dir.length(); dir.divideScalar(L); for (const b of BODIES) { if (b.id === 'sun') continue; const c = R.bpos[b.id], t = new THREE.Vector3().subVectors(c, o).dot(dir); if (t < 0 || t > L) continue; const dd = new THREE.Vector3().subVectors(c, o).addScaledVector(dir, -t).length(); if (dd < b.r) { occ = 1; break; } } }
  const a = on && !occ ? Math.max(0, 1 - Math.hypot(v.x, v.y) * .55) : 0;
  for (const s of FLARE) { const k = 1 - 2 * s.userData.d, p = new THREE.Vector3(v.x * k, v.y * k, .2).unproject(R.cam), dist = p.distanceTo(R.cam.position); s.position.copy(p); if (s.userData.ana) s.scale.set(s.userData.sz * dist * 9, s.userData.sz * dist * .09, 1); else s.scale.setScalar(s.userData.sz * dist * (s.userData.d ? 1 : 1.4)); s.material.opacity = a * (s.userData.d ? .55 : .9); s.visible = a > .01; } }
function dropFull(e) { if (!e.model) return; e.g.remove(e.model); disposeTree(e.model); e.model = null; if (e.cost) { MEM.tris = Math.max(0, MEM.tris - e.cost.tris); MEM.tex = Math.max(0, MEM.tex - e.cost.tex); } }
// memory budget: keep the nearest full-detail models within the preset's triangle/texture budget; farther ones fall back to their light version
function budget(CF) { const B = PRE(); let tris = 0, tex = 0; const L = R.objs.filter(e => e.model && e.cost).sort((a, b) => a.dist - b.dist);
  L.forEach((e, i) => { tris += e.cost.tris; tex += e.cost.tex; if (i > 0 && (tris > B.tris || tex > B.tex) && e.lod) { dropFull(e); e.evictD = e.dist; } }); // the nearest model always keeps full detail
  const over = MEM.tris > B.tris * .92 || MEM.tex > B.tex * .92; for (let i = CF.length - 1; i >= 0; i--) { const e = CF[i]; if ((over && !e.noLod) || (e.evictD && e.dist > e.evictD * .7)) CF.splice(i, 1); } }
function disposeTree(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); }); }); }
// dynamic resolution: keeps the frame rate smooth by trimming render resolution (never the effects) when the device struggles
const DR = { t: 0, n: 0, s: 1, cool: 4, low: 0, high: 0, changes: 0 };
// Max graphics that stay smooth: every 1.5 s compare the frame rate with the target (60, or the frame cap). If it falls short, trim the render
// resolution a step (never the effects: shadows, bloom, materials and models stay at the chosen preset); when there is headroom, step back up.
// Sharpening in the final pass grows as the resolution drops, so the picture stays crisp. Resizes are rare (each one reallocates the buffers).
function dynRes(dt) { DR.t += dt; DR.n++; DR.cool = Math.max(0, DR.cool - dt); if (DR.t < 1.5) return; const fps = DR.n / DR.t, tg = Math.min(60, SET.cap || 60); DR.t = 0; DR.n = 0; DR.fps = fps;
  DR.low = fps < tg * .86 ? DR.low + 1 : 0; DR.high = fps > tg * .97 ? DR.high + 1 : 0; if (DR.cool > 0 || document.hidden) return;
  const max = dprCap(); let s = DR.s;
  if (DR.low >= 2 && s > .5) s = Math.max(.5, s - (fps < tg * .6 ? .2 : .1)); else if (DR.high >= 6 && s < 1) s = Math.min(1, s + .1);
  if (DR.low >= 2 && DR.s <= .5) R.shEvery = 3;   /* still slow at the lowest resolution: shadows refresh a little less often */ else if (DR.high >= 6) R.shEvery = 0;
  if (s !== DR.s) { DR.s = Math.round(s * 100) / 100; DR.cool = DR.s < s ? 4 : 9; DR.low = DR.high = 0; DR.changes++; R.ren.setPixelRatio(max * DR.s); resize(); }
  R.cine.uniforms.sharp.value = GFX === 'low' ? 0 : .15 + (1 - DR.s) * 1.1; }
// controller in Adventure Mode (window.PAD comes from js/gamepad.js; menus are handled there)
let padStick = false; const padW = {}; function padSet(k, on) { if (on || padW[k]) R[k] = on ? 1 : 0; padW[k] = on; }  // only touch R.thr/R.bst while the controller is using them
function padAdv(dt) { const P = window.PAD; if (!P || !P.on || R.root.querySelector('.pnl') || document.querySelector('#advDL')) return; const dz = v => Math.abs(v) < .18 ? 0 : (v - Math.sign(v) * .18) / .82, S = R.surf && R.surf.S;
  const lx = dz(P.lx), ly = dz(P.ly), rx = dz(P.rx), ry = dz(P.ry); if (lx || ly) { R.joy.x = lx; R.joy.y = ly; padStick = true; if (DEMO.on) demoStop(); R.ap = R.ap && !(lx || ly) ? R.ap : null; } else if (padStick) { R.joy.x = R.joy.y = 0; padStick = false; }
  if (S && S.on) { S.camYaw -= rx * dt * 2.4; S.camPitch = THREE.MathUtils.clamp(S.camPitch + ry * dt * 1.6, .05, 1.2);
    padSet('thr', P.held(0)); padSet('bst', P.rt > .3 || P.held(5));
    if (P.hit(2)) scan(); if (P.hit(3)) flyToggle(); if (P.hit(1)) driveToggle(); if (P.hit(4)) helmToggle(); if (P.hit(8)) landOrLaunch(); if (P.hit(9)) settings(); return; }
  if (rx || ry) { R.yaw -= rx * dt * 1.6; R.pitch = THREE.MathUtils.clamp(R.pitch - ry * dt * 1.2, -1.35, 1.35); R.ap = null; }
  padSet('thr', P.rt > .2 || P.held(5)); padSet('bst', P.lt > .3);
  if (P.hit(0)) scan(); if (P.hit(2)) { const lb = R.root.querySelector('#aLand'); if (lb && lb.style.display !== 'none') landOrLaunch(); }
  if (P.hit(3)) mapPanel(); if (P.hit(4)) camToggle(); if (P.hit(1)) codex(); if (P.hit(8)) hangar(); if (P.hit(9)) settings(); if (P.hit(11)) photoToggle(); if (P.hit(10)) demoTour(); }
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
  $('#aX').onclick = () => close(); try { const mi = $('#aMis'), rt = mi.closest('#adv') || mi.parentNode; new ResizeObserver(() => rt.style.setProperty('--misH', mi.offsetHeight + 'px')).observe(mi); } catch (e) {} $('#aMore').onclick = e => { e.stopPropagation(); $('#aTop').classList.toggle('open'); }; $('#aTop').addEventListener('click', e => { if (e.target.closest('.sec')) $('#aTop').classList.remove('open'); }); $('#aMap').onclick = () => mapPanel(); $('#aCod').onclick = () => codex(); $('#aHan').onclick = () => hangar(); $('#aTro').onclick = () => trophyRoom(); $('#aCo').onclick = () => coPanel(); $('#aDrv').onclick = () => driveToggle(); $('#aHelm').onclick = () => helmToggle(); $('#aSky').onclick = () => skyToggle(); $('#aMed').onclick = () => media().panel(); $('#aMis').onclick = () => dailyCard(); apodFetch().then(() => { try { if (R) misUI(); } catch (e) {} }); $('#aCam').onclick = () => camToggle(); $('#aDemo').onclick = () => demoTour(); $('#aPhoto').onclick = () => photoToggle(); $('#aPh').onclick = () => photoToggle(); $('#aDL').onclick = () => { if (isApp) { toast('All resources are built into the app ✓'); return; } ST.on = false; resPanel(() => { ST.on = true; R.last = 0; requestAnimationFrame(loop); }, true); }; $('#aFly').onclick = () => flyToggle();
  // mouse look on desktop
  let drag = null; R.ren.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
  addEventListener('pointermove', e => { if (!drag || !ST.on || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (R.surf && R.surf.S.on) { R.surf.S.camYaw -= dx * .006; R.surf.S.camPitch = THREE.MathUtils.clamp(R.surf.S.camPitch + dy * .004, .05, 1.2); return; }
    R.yaw -= dx * .004; R.pitch = THREE.MathUtils.clamp(R.pitch - dy * .004, -1.4, 1.4); R.ap = null; });
  addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) drag = null; });
  addEventListener('keydown', e => { if (!ST.on) return; if (DEMO.on && e.key !== 'Escape') demoStop(); const k = e.key.toLowerCase(); R.keys[k] = 1; if (k === 'e' || (k === ' ' && !(R.surf && R.surf.S.on))) { scan(); e.preventDefault(); } if (k === ' ' && R.surf && R.surf.S.on) e.preventDefault(); if (k === 'l') landOrLaunch(); if (k === 'm') mapPanel(); if (k === 'g' && R.surf && R.surf.S.on) driveToggle(); if (k === 'v' && R.surf && R.surf.S.on) helmToggle(); if (k === 'k' && !(R.surf && R.surf.S.on)) skyToggle(); if (k === 'n' && !(R.surf && R.surf.S.on)) { SET.newton = SET.newton ? 0 : 1; P('adv_set', SET); toast(SET.newton ? '🛰 Newtonian flight: you keep drifting; S fires retro jets' : '🛰 Assisted flight', 2600); } if (k === 'c') codex(); if (k === 'v' && !(R.surf && R.surf.S.on)) camToggle(); if (k === 'p' && !(R.surf && R.surf.S.on)) photoToggle(); if (k === 'h' && !(R.surf && R.surf.S.on)) hangar(); if (k === 'f' && R.surf && R.surf.S.on) flyToggle(); if (k === 'escape') { const p = R.root.querySelector('.pnl'); if (p) p.remove(); else close(); } if ('wasdqe'.includes(k) || k.startsWith('arrow')) R.ap = null; e.stopPropagation(); }, true);
  addEventListener('keyup', e => { if (R) R.keys[e.key.toLowerCase()] = 0; }, true);
  addEventListener('resize', resize);
}
function resize() { if (!R) return; const w = innerWidth, h = innerHeight; R.ren.setSize(w, h, false); R.comp.setPixelRatio(R.ren.getPixelRatio()); R.comp.setSize(w, h); { const pr = R.ren.getPixelRatio(); R.cine.uniforms.res.value.set(w * pr, h * pr); } R.cam.aspect = w / h; R.cam.updateProjectionMatrix(); }

/* ---------------- flight, scanning, labels ---------------- */
const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), fwd = new THREE.Vector3();
function nearest() { let best = null, bd = 1e9; for (const e of R.objs) { const d = e.g.position.distanceTo(R.ship.position) - e.o.sz; if (d < bd) { bd = d; best = e; } }
  for (const b of BODIES) { const d = R.bpos[b.id].distanceTo(R.ship.position) - b.r; if (d < bd) { bd = d; best = { o: b, body: 1, g: { position: R.bpos[b.id] } }; } } return { e: best, d: bd }; }
function scanRange(o) { return o.r ? o.r * 1.2 + 25 : o.sz * 4 + 14; }
function scan() { if (R.scanning || R.root.querySelector('.pnl')) return; if (R.surf && R.surf.S.on) { const n = R.surf.S.near; if (!n) { toast('Walk up to a NASA site (glowing marker) to scan it'); sfx('no'); return; } R.scanning = { e: n, t: 0, surf: 1 }; sfx('beep'); return; } const { e, d } = nearest(); if (!e || d > scanRange(e.o)) { toast('Fly closer to something to scan it'); sfx('no'); return; } R.scanning = { e, t: 0 }; sfx('beep'); }
function toast(t, ms = 2200) { const el = R.root.querySelector('#aToast'); el.innerHTML = t; el.style.display = 'block'; clearTimeout(el._t); el._t = setTimeout(() => el.style.display = 'none', ms); }
function step(dt) {
  const k = R.keys, ship = R.ship; R.t += dt; orbitStep();
  const yRaw = (k.a || k.arrowleft ? 1 : 0) - (k.d || k.arrowright ? 1 : 0) - R.joy.x, pRaw = (k.arrowup ? 1 : 0) - (k.arrowdown ? 1 : 0) - R.joy.y; R.yi += (yRaw - R.yi) * Math.min(1, dt * 7); R.pi += (pRaw - R.pi) * Math.min(1, dt * 7); let yawIn = R.yi, pitIn = R.pi;
  const thrust = R.thr || k.w ? 1 : 0, boost = R.bst || k.shift ? 1 : 0, brake = k.s ? 1 : 0;
  if (R.ap) { const tp0 = R.ap.e.g.position, d = tp0.distanceTo(ship.position), stop = (R.ap.e.o.r ? R.ap.e.o.r * 1.6 + 12 : R.ap.e.o.sz * 3 + 8);
    let tp = tp0; { const ab = tmpV.copy(tp0).sub(ship.position), L = ab.length(); ab.divideScalar(L || 1);   // a body in the way? aim for a point beside it instead
      for (const b of BODIES) { if (b.id === R.ap.e.o.id) continue; const c = R.bpos[b.id], t = c.clone().sub(ship.position).dot(ab), cl = b.r + (b.id === 'sun' ? 60 : 8); if (t <= 0 || t >= L) continue;
        const pc = ship.position.clone().addScaledVector(ab, t), off = pc.clone().sub(c); if (off.length() < cl) { if (off.lengthSq() < 1e-6) off.set(0, 1, 0); tp = c.clone().add(off.normalize().multiplyScalar(cl * 1.4)); break; } } }
    const dir = tp.clone().sub(ship.position).normalize();
    for (const b of BODIES) { if (b.id === R.ap.e.o.id) continue; const away = ship.position.clone().sub(R.bpos[b.id]), dd = away.length(), cl = b.r + (b.id === 'sun' ? 60 : 8); if (dd < cl * 1.25) dir.addScaledVector(away.divideScalar(dd), 2.5 * (1 - dd / (cl * 1.25)) + .4).normalize(); }   // too close: lean away
    const ty = Math.atan2(-dir.x, -dir.z), tpch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    let dy = ty - R.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; R.yaw += dy * Math.min(1, dt * 2.5); R.pitch += (tpch - R.pitch) * Math.min(1, dt * 2.5);
    fwd.set(0, 0, -1).applyEuler(new THREE.Euler(R.pitch, R.yaw, 0, 'YXZ')); const sp = Math.min(R.ap.max, Math.max(8, (d - stop) * 1.4)) * Math.max(.12, fwd.dot(dir)); /* turn first, then go */ R.vel.lerp(fwd.multiplyScalar(d > stop ? sp : 0), Math.min(1, dt * 2));
    if (d <= stop + 1) { R.ap = null; R.vel.multiplyScalar(.2); toast(`Arrived: <b>${R.apName}</b> · tap 📡 SCAN`); say('Arriving at ' + R.apName.replace(/\(.*?\)/g, '') + '.'); } }
  else { const SS = R.shipStat || SHIPS[0], toward = (v, t, a) => v + THREE.MathUtils.clamp(t - v, -a, a);
    // attitude: reaction-control jets spin the ship up and down smoothly (real angular momentum); flight assist stops the rotation when you let go
    const angA = 3.4 * SS.turn * dt; R.yawV = toward(R.yawV || 0, yawIn * 1.4 * SS.turn, angA); R.pitchV = toward(R.pitchV || 0, pitIn * 1.1 * SS.turn, angA);
    R.yaw += R.yawV * dt; const np = R.pitch + R.pitchV * dt; R.pitch = THREE.MathUtils.clamp(np, -1.35, 1.35); if (R.pitch !== np) R.pitchV = 0;
    fwd.set(0, 0, -1).applyEuler(new THREE.Euler(R.pitch, R.yaw, 0, 'YXZ')); const ts = (thrust ? (boost ? 180 * SS.bst : 45 * SS.spd) : boost ? 180 * SS.bst : 0); let lat = 0;
    if (SET.newton) { if (ts) R.vel.addScaledVector(fwd, ts * .55 * dt); if (brake) { const v = R.vel.length(); if (v > 0) R.vel.multiplyScalar(Math.max(0, v - 30 * dt) / v); } if (R.vel.length() > 700) R.vel.setLength(700); }   // true space: you coast until you burn the other way
    else { // flight assist: the main engine pushes only along the nose; the much weaker side thrusters null out drift, so the ship slides through turns
      const want = tmpV.copy(fwd).multiplyScalar(ts), dv = want.sub(R.vel), along = dv.dot(fwd), side = dv.addScaledVector(fwd, -along), mainA = boost ? 150 * SS.bst : 42 * SS.spd;
      const a1 = along > 0 ? Math.min(along, mainA * dt) : Math.max(along, -(brake ? mainA * .9 : 13) * dt), sl = side.length(), sa = 26 * SS.turn * dt; lat = sl;
      R.vel.addScaledVector(fwd, a1); if (sl > 0) R.vel.addScaledVector(side, Math.min(1, sa / sl)); }
    rcs(dt, yawIn + (lat > .4 ? .3 : 0), pitIn, brake); }
  if (SET.newton) gravity(dt);
  ship.position.addScaledVector(R.vel, dt);
  // never fly into a planet
  for (const b of BODIES) { const c = R.bpos[b.id], d = ship.position.distanceTo(c), m = b.r + (b.id === 'sun' ? 25 : 1.6); if (d < m) { const n = tmpV.copy(ship.position).sub(c); if (n.lengthSq() < 1e-6) n.set(0, 1, 0); n.normalize(); ship.position.copy(c).addScaledVector(n, m);
      // slide along instead of sticking: remove the inward part of the velocity
      const vn = R.vel.dot(n); if (vn < 0) R.vel.addScaledVector(n, -vn * (b.id === 'sun' ? 1.6 : 1));
      if (b.id === 'sun') { R.vel.addScaledVector(n, 40); if (!R.ap) R.evade = { n: n.clone(), t: 1.4 }; if (!R.hotT) { R.hotT = 3; toast('☀️ Heat shield at its limit! Auto-turn away from the Sun', 2600); say('Heat shield critical. Turning away.'); trophy('a_sun'); try { sfx('alarm'); } catch (e) {} } } } }
  // emergency turn: swing the nose away from the Sun so the player isn't left facing into it
  if (R.evade) { R.evade.t -= dt; const n = R.evade.n, ty = Math.atan2(-n.x, -n.z), tp = Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)); let dy = ty - R.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; R.yaw += dy * Math.min(1, dt * 3); R.pitch += (tp - R.pitch) * Math.min(1, dt * 3); if (R.evade.t <= 0) R.evade = null; }
  R.hotT = Math.max(0, (R.hotT || 0) - dt);
  ship.quaternion.setFromEuler(new THREE.Euler(R.pitch, R.yaw, -(R.yawV || 0) * .16, 'YXZ'));
  const spd = R.vel.length(); R.flame.scale.setScalar(.5 + Math.min(3, spd / 40)); R.flame.material.opacity = Math.min(1, .25 + spd / 60); plume(dt, thrust || !!R.ap, boost); orbitLine(dt);
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
  if (R.scanning) { const S2 = R.scanning; S2.t += dt; R.beam.visible = true; R.beam.geometry.setFromPoints([ship.position, S2.e.g.position]); R.root.querySelector('#aScan').style.display = 'block'; setT(R.root.querySelector('#aScan'), 'SCANNING ' + Math.min(100, Math.round(S2.t / 1.1 * 100)) + '%');
    if (Math.random() < .5) R.fx.emit(S2.e.g.position, tmpV.set(0, 0, 0), 0xffcf4a, 1.2, .6, 2, 3, { grow: 2 });
    if (S2.t > 1.1) { R.beam.visible = false; R.root.querySelector('#aScan').style.display = 'none'; R.scanning = null; R.rings.add(S2.e.g.position, 0x7df9ff, (S2.e.o.sz || 2) * 5, .9, R.cam.position); R.fx.emit(S2.e.g.position, tmpV.set(0, 0, 0), 0x7df9ff, 1.4, 1, 40, 18, { grow: 1.5, drag: .8 }); setTimeout(() => card(S2.e.o, true), 350); } }
  // speed + destination
  { const cb = BODIES.reduce((a, b) => { const d = R.bpos[b.id].distanceTo(ship.position); return d - b.r < a[1] ? [b, d - b.r, d] : a; }, [null, 1e9, 0]); R.altTxt = cb[0] && cb[1] < cb[0].r * 4 ? ' · ' + fmtKm(realAlt(cb[0], cb[2])) + ' above ' + cb[0].n : ''; }
  setT(R.root.querySelector('#aSpd'), `${Math.round(spd * 1000).toLocaleString()} km/h${R.altTxt}${OL.txt || ''}${R.ap ? ' · autopilot → ' + R.apName : ''} · ${ST.scanned.size}/${ALL.length} scanned`);
  { const D = R.spaceDust, a = D.geometry.attributes.position, c = R.cam.position; for (let i = 0; i < a.count; i++) { let x = a.getX(i), y = a.getY(i), z = a.getZ(i);
      const w = (v, o) => o + ((((v - o + 40) % 80) + 80) % 80) - 40; a.setXYZ(i, w(x, c.x), w(y, c.y), w(z, c.z)); } a.needsUpdate = true; D.material.opacity = CAM.photo ? .3 : .55; }
  if (R.anomaly) { const A = R.anomaly, d = A.g.position.distanceTo(ship.position); A.g.rotation.y += dt * .4; A.cr.rotation.x = Math.sin(R.t * .7) * .2; const pu = 1 + Math.sin(R.t * 2.2) * .12; A.halo.scale.setScalar(22 * pu); A.cr.material.emissiveIntensity = 2 + Math.sin(R.t * 3.1) * .8;
    if (Math.random() < dt * 8) R.fx.emit(A.g.position, new THREE.Vector3((Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2), 0xb070ff, .8, 2.4, 1, 3, { grow: 2, drag: .1, jit: 4 });
    if (d < 70 && !A.met) { A.met = 1; R.root.classList.add('glitch'); setTimeout(() => R.root.classList.remove('glitch'), 900); sfx('whoosh'); say('Commander… that signal is not on any NASA chart.', 1); try { if (typeof speakCreepy === 'function') setTimeout(() => speakCreepy('six doors', 0, .3), 3200); } catch (e) {} toast('📻 <b>Unknown signal</b><br><small>The same purple glow as the crystal on the Moon… Fly closer and scan it.</small>', 5000); } }
  updatePlanetUniforms(R.PL, R.bpos.sun, R.t); spaceFX(dt); lightsStep(); navBlink(R.t); flare(); R.fx.update(dt, R.cam); R.rings.update(dt); R.warp.update(dt, R.cam, CAM.photo ? 0 : spd); R.dtH = dt; hud(spd);
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
function card(o, fresh) { if (o.story) return storyCard(o, fresh); if (fresh) dailyHit(o.id); const isNew = fresh && !ST.scanned.has(o.id);
  if (isNew) { say('New object identified. ' + o.n.replace(/\(.*?\)/g, '') + '.'); const was = new Set(SHIPS.filter(unlocked).map(x => x.id)); ST.scanned.add(o.id); { const n = ST.scanned.size; trophy('a_scan1'); if (n >= 25) trophy('a_scan25'); if (n >= 100) trophy('a_scan100'); if (ALL.every(x => ST.scanned.has(x.id))) trophy('a_codex'); } save(); reward(5, 60); sfx('chime'); const nw = SHIPS.filter(x => unlocked(x) && !was.has(x.id)); if (nw.length) setTimeout(() => toast('🛠 New ship unlocked in the Hangar: <b>' + nw.map(x => x.n).join(', ') + '</b><br><small>Tap 🛠 Hangar to fly it</small>', 4500), 1200); const e = R.objs.find(x => x.o.id === o.id); if (e) e.sp.material = R.mkS; checkMissions(); milestone(); }
  const realTxt = o.r && RKM[o.id] ? `Real size: ${(RKM[o.id] * 2).toLocaleString()} km across${ORBIT[o.id] ? ` · ${ORBIT[o.id]} AU (${fmtKm(ORBIT[o.id] * AUKM)}) from the Sun · sunlight takes ${Math.round(ORBIT[o.id] * 499 / 60)} min to arrive` : ''}` : '';
  const loc = o.r ? (o.at ? 'Orbits ' + BI[o.at].n : 'Solar system') : o.land ? (o.land === 'earth' ? 'Kennedy Space Center, Earth' : 'On the surface of ' + BI[o.land].n) : o.far ? 'Deep sky, far beyond the solar system' : (o.surf ? 'On ' + BI[o.at].n : 'Near ' + BI[o.at].n);
  const p = document.createElement('div'); p.className = 'pnl'; p.innerHTML = `<div class="crd"><div class="ey">${o.r ? '🪐 ' : '🛰 '}${o.k.toUpperCase()}</div>${isNew ? '<div class="nw">NEW SCAN · +5 🔧 · +60 XP</div>' : ''}<h2>${o.n}</h2><canvas class="vw"></canvas>
   <div class="mt">${[o.ag, o.yr ? 'Launched ' + o.yr : '', loc].filter(Boolean).join(' · ')}</div>${realTxt ? `<div class="mt" style="color:#7df9ff">📏 ${realTxt}</div>` : ''}<ul>${o.facts.map(f => `<li>${f}</li>`).join('')}</ul>
   ${o.r ? '' : '<div class="src">3D model: NASA 3D Resources (science.nasa.gov/3d-resources)</div>'}<div class="row"><button class="pr" id="cOk">Continue</button></div></div>`;
  R.root.appendChild(p); viewer(o, p.querySelector('.vw'), p); p.querySelector('#cOk').onclick = () => p.remove(); }
function storyCard(o, fresh) { const A = R.anomaly, n = A ? A.clues : 0, first = fresh && !ST.flags.has('anomaly');
  if (first) { ST.flags.add('anomaly'); save(); reward(15, 150); sfx('chime'); trophy('a_signal'); }
  const lines = ['It hums at the same frequency as the purple crystal on the Moon.', `Your outposts have found ${n} of 6 clues. Each clue makes the signal stronger.`,
    doorReady() ? 'The signal finally answers. A seventh door is waiting, right here. It will open for you.' : n >= 6 ? 'With all six clues, the signal finally answers: a seventh door is waiting, out here in the belt. Finish the campaign to open it.' : 'Find more clues in Story Mode: the signal still has something to say.', 'Mission Control says it is just space noise. Mission Control has said that before.'];
  const p = document.createElement('div'); p.className = 'pnl'; p.innerHTML = `<div class="crd" style="border-color:rgba(176,112,255,.6)"><div class="ey" style="color:#c9a0ff">🟣 STORY · ORIGIN UNKNOWN</div>${first ? '<div class="nw" style="background:#b070ff;color:#fff">FIRST CONTACT · +15 🔧 · +150 XP</div>' : ''}<h2>The Purple Signal</h2>
    <div class="mt">Detected where all six outposts sent their message, the night every outpost flickered.</div><ul>${lines.map(f => `<li>${f}</li>`).join('')}</ul><div class="row">${doorReady() ? '<button class="pr" id="cDoor" style="background:#b070ff;border-color:#fff">🚪 Open the seventh door</button>' : ''}<button class="pr" id="cOk" style="background:#7a3fd0;border-color:#c9a0ff">Continue</button></div></div>`;
  R.root.appendChild(p); p.querySelector('#cOk').onclick = () => p.remove(); const db = p.querySelector('#cDoor'); if (db) db.onclick = () => openDoor(); if (first) { say(n >= 6 ? 'The signal is answering. Commander, it is calling you.' : 'Signal recorded. Mission Control… is not answering.', 1); } }
/* ---------------- trophies: shared with Story Mode's badge system (ach/ACH/ACHS in index.html) ---------------- */
function trophy(id) { try { if (typeof ach === 'function') ach(id); } catch (e) {} }
const hasT = id => { try { return typeof ACHS !== 'undefined' && ACHS.has(id); } catch (e) { return false; } };
function trophyToast(a) { if (!R) return; const el = document.createElement('div'); el.className = 'trophy'; el.innerHTML = `<span>${a.ic}</span><div><small>🏆 TROPHY UNLOCKED</small><b>${a.n}</b><i>${a.d.replace(/^Adventure: /, '')}</i></div>`; R.root.appendChild(el); requestAnimationFrame(() => el.classList.add('on')); setTimeout(() => { el.classList.remove('on'); setTimeout(() => el.remove(), 600); }, 4200); say('Trophy unlocked. ' + a.n + '.'); }
function trophyRoom() { const L = (typeof ACH !== 'undefined' ? ACH : []); const got = a => hasT(a.id), adv = L.filter(a => a.adv), sm = L.filter(a => !a.adv), n = L.filter(got).length;
  const cell = a => `<div class="tc ${got(a) ? 'g' : ''}"><span>${got(a) ? a.ic : '🔒'}</span><b>${a.n}</b><small>${a.d.replace(/^Adventure: /, '')}</small></div>`;
  const p = document.createElement('div'); p.className = 'pnl'; p.innerHTML = `<div class="crd"><div class="ey">🏆 TROPHY ROOM · BOTH MODES</div><h2>${n} / ${L.length} unlocked</h2><div class="bar1"><i style="width:${(n / Math.max(1, L.length) * 100).toFixed(0)}%"></i></div>
    <h4 class="sh">🚀 ADVENTURE MODE · ${adv.filter(got).length}/${adv.length}</h4><div class="tg">${adv.map(cell).join('')}</div><h4 class="sh">🪐 STORY MODE · ${sm.filter(got).length}/${sm.length}</h4><div class="tg">${sm.map(cell).join('')}</div><div class="row"><button class="pr" id="tX">Close</button></div></div>`;
  R.root.appendChild(p); p.querySelector('#tX').onclick = () => p.remove(); }
/* ---------------- the true ending: the seventh door (Story Mode × Adventure Mode) ---------------- */
// open when the campaign is finished (all six worlds secured, or the secret world won) or all six clues are found
function doorReady() { try { return (typeof ACHS !== 'undefined' && ACHS.has('all')) || G('trueEnd', 0) || G('echoWon', 0) || (G('clues', []) || []).length >= 6; } catch (e) { return false; } }
function openDoor() { const A = R.anomaly; if (!A || R.ending) return; const p = R.root.querySelector('.pnl'); if (p) p.remove(); demoStop();
  // the door: a great ring of crystal with a swirling purple membrane, grown out of the signal
  const g = new THREE.Group(); g.position.copy(A.g.position); g.lookAt(R.ship.position); R.scn.add(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 1.1, 24, 96), new THREE.MeshStandardMaterial({ color: 0x5a2aa0, emissive: 0xa060ff, emissiveIntensity: 2.2, roughness: .25, metalness: .6 })); g.add(ring);
  const memU = { time: { value: 0 }, open: { value: 0 } }, mem = new THREE.Mesh(new THREE.CircleGeometry(13.2, 96), new THREE.ShaderMaterial({ uniforms: memU, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform float time, open; varying vec2 vUv; void main(){ vec2 p = vUv - .5; float r = length(p) * 2., a = atan(p.y, p.x);
      float sw = sin(a * 6. + r * 14. - time * 3.) * .5 + .5, core = smoothstep(.9, 0., r), rim = smoothstep(.55, 1., r);
      vec3 c = mix(vec3(.45, .15, .9), vec3(1., .85, 1.), core * open) * (.35 + sw * .8) + vec3(1.) * core * core * open * 2.5;
      gl_FragColor = vec4(c, (rim * .6 + core * .9) * min(1., open * 2.) * smoothstep(1., .96, r)); }` })); g.add(mem);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, s = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), ring.material); s.position.set(Math.cos(a) * 17.5, Math.sin(a) * 17.5, 0); s.scale.y = 1.8; g.add(s); }   // the six doors, in a circle
  g.scale.setScalar(.01); R.ending = { t: 0, g, ring, memU, start: R.ship.position.clone() }; R.root.classList.add('cine', 'intro'); CAM.mode = 'chase';
  say('Commander. The door is opening.', 1); sfx('whoosh'); }
function stepEnding(dt) { const E = R.ending, ship = R.ship, A = R.anomaly; E.t += dt; R.t += dt; const t = E.t, c = A.g.position;
  for (const o of R.objs) R.placeObj(o, R.t); updatePlanetUniforms(R.PL, R.bpos.sun, R.t); flare(); R.fx.update(dt, R.cam); R.rings.update(dt);
  E.memU.time.value = t; E.g.rotation.z += dt * .15; A.g.rotation.y += dt * (1 + t);
  const grow = THREE.MathUtils.smoothstep(t, 2, 6); E.g.scale.setScalar(.01 + grow); E.memU.open.value = THREE.MathUtils.smoothstep(t, 5, 8);
  if (t < 6) { A.cr.scale.set(1 + t * .15, 1.8 + t * .2, 1 + t * .15); if (Math.random() < .5) R.fx.emit(c, new THREE.Vector3((Math.random() - .5) * 30, (Math.random() - .5) * 30, (Math.random() - .5) * 30), 0xc080ff, 1.5, 1.5, 3, 4, { grow: 2, drag: .3 }); }
  else A.g.visible = false;
  if (t > 5.8 && !E.ring1) { E.ring1 = 1; R.rings.add(c, 0xc080ff, 60, 1.6, R.cam.position); sfx('burst'); }
  // camera: orbit the door, then follow the ship through it
  if (t < 8.5) { const a = t * .25, r = 46 - t * 2; R.cam.position.set(c.x + Math.cos(a) * r, c.y + 8, c.z + Math.sin(a) * r); R.cam.lookAt(c); ship.position.lerp(E.start, .02); }
  else { const k = THREE.MathUtils.smoothstep(t, 8.5, 12), dir = c.clone().sub(E.start).normalize(); ship.position.copy(E.start).lerp(c.clone().addScaledVector(dir, 6), k); ship.lookAt(ship.position.clone().sub(dir)); ship.visible = true;
    R.cam.position.copy(ship.position).addScaledVector(dir, -10).add(new THREE.Vector3(0, 2.5, 0)); R.cam.lookAt(c); R.engL.intensity = 40; R.flame.getWorldPosition(R.engL.position);
    R.fx.emit(R.flame.getWorldPosition(tmpV), dir.clone().multiplyScalar(-14), 0xffc27a, .8, .5, 4, 2, { grow: 2.4 }); }
  const ov = R.root.querySelector('#aHeat') || (() => { const d = document.createElement('div'); d.id = 'aHeat'; R.root.appendChild(d); return d; })(); ov.classList.toggle('w', t > 11.2); ov.style.opacity = t > 11.2 ? Math.min(1, (t - 11.2) / .8) : 0;
  if (t > 12.4 && !E.done) { E.done = 1; endingScreen(); } }
function endingScreen() { const L = [
    ['The seventh door opens. Behind it there is no monster.', 'There is a memory.'],
    ['Long ago, travellers built six doors across the solar system, to keep something asleep.', 'Every outpost you built woke one of them.'],
    ['The bosses you fought were guardians.', `${(() => { try { return SPN(); } catch (e) { return 0; } })() ? 'The ones you spared told the others you were kind.' : 'They were only protecting their doors.'}`],
    ['The Echo was never Mission Control.', 'It was them, learning our language, asking to be heard.'],
    ['“Thank you for listening, Commander.”', '“Now the doors stay open, for both of us.”']];
  const o = document.createElement('div'); o.id = 'aEnd'; o.innerHTML = '<div class="eL"></div><div class="eC"></div>'; R.root.appendChild(o); let i = 0;
  const line = () => { if (i >= L.length) return credits(); const [a, b] = L[i++]; o.querySelector('.eL').innerHTML = `<p>${a}</p><p class="b">${b}</p>`; o.querySelector('.eL').classList.remove('in'); void o.offsetWidth; o.querySelector('.eL').classList.add('in'); say(a + ' ' + b.replace(/[“”]/g, ''), 1); setTimeout(line, 6200); };
  const credits = () => { o.querySelector('.eL').innerHTML = ''; o.querySelector('.eC').innerHTML = `<div class="roll"><h1>RED DUST OUTPOST</h1><p>THE TRUE ENDING</p><br><p>A game by</p><h2>MOON PRODUCTIONS</h2><br><p>Built with real NASA 3D models, maps, terrain and science</p><p>NASA 3D Resources · NASA Earth Observatory Black Marble · three.js</p><br><p>Six worlds. Six doors.</p><p>Thank you for playing.</p><br><button id="eGo">🚀 Back to the stars</button></div>`;
    say('Thank you for playing Red Dust Outpost.', 1); o.querySelector('#eGo').onclick = () => { o.remove(); const E = R.ending; R.ending = null; R.root.classList.remove('cine', 'intro'); const ov = R.root.querySelector('#aHeat'); if (ov) { ov.style.opacity = 0; ov.classList.remove('w'); }
      R.ship.position.copy(E.start); R.vel.set(0, 0, 0); E.g.scale.setScalar(1); E.memU.open.value = 1; R.anomaly.g.visible = true; R.anomaly.cr.scale.set(1, 1.8, 1); ST.flags.add('door'); save(); toast('🚪 The seventh door stays open in the asteroid belt.', 4000); }; };
  trophy('a_door'); reward(30, 400); setTimeout(line, 600); }
function milestone() { const n = ST.scanned.size, got = G('adv_ms', 0), M = [[10, 30], [25, 60], [ALL.length, 150]]; M.forEach(([at, tp], i) => { if (n >= at && got <= i) { P('adv_ms', i + 1); reward(tp, 200); setTimeout(() => toast(`🏅 Codex ${at === ALL.length ? 'complete' : at + ' scans'}! +${tp} 🔧`, 3500), 600); } }); }
/* ---------------- today's NASA mission: one new mission a day, shaped by live NASA data (DONKI space weather + Astronomy Picture of the Day) ---------------- */
const DPOOL = [
  { ic: '☀', t: 'Space weather watch', d: 'Scan SOHO and SDO, the two spacecraft that watch the Sun for NASA every second of every day.', need: ['soho', 'sdo'] },
  { ic: '🛰', t: 'Crew check', d: 'Scan the ISS and the Orion capsule: today we check on the people who live and travel in space.', need: ['iss', 'orion'] },
  { ic: '🌕', t: 'Artemis scouting', d: 'Scan the Lunar Reconnaissance Orbiter, then land on the Moon where Artemis astronauts will return.', need: ['lro', 'land:moon'] },
  { ic: '🔴', t: 'Rover check-in', d: 'Land on Mars and scan Perseverance, still exploring Jezero Crater today.', need: ['land:mars', 'perseverance'] },
  { ic: '🔭', t: 'Great observatories', d: 'Scan Hubble, Webb and Chandra, three telescopes that see the universe in different light.', need: ['hubble', 'jwst', 'chandra'] },
  { ic: '🌀', t: 'Juno at Jupiter', d: 'Scan Juno, then dive into Jupiter’s clouds the way Galileo’s probe did in 1995.', need: ['juno', 'dive:jupiter'] },
  { ic: '🪐', t: 'Planet hunters', d: 'Scan TESS and Kepler, the telescopes that found thousands of planets around other stars.', need: ['tess', 'kepler'] },
  { ic: '📡', t: 'Deep Space Network', d: 'Find Voyager 1, the farthest human-made object, still talking to Earth after almost 50 years.', need: ['voyager'] },
  { ic: '🔥', t: 'Touch the Sun', d: 'Scan the Parker Solar Probe, the fastest object people have ever built.', need: ['parker'] },
  { ic: '❄', t: 'Ocean worlds', d: 'Land on Europa and on Titan, two moons that may hide oceans.', need: ['land:europa', 'land:titan'] },
];
const DBODY = { sun: /\bsun\b|solar/i, moon: /\bmoon\b|lunar/i, mars: /\bmars\b|martian/i, jupiter: /jupiter|jovian/i, saturn: /saturn/i, venus: /venus/i, mercury: /mercury/i, earth: /\bearth\b/i, neptune: /neptune/i, uranus: /uranus/i, pluto: /pluto/i, titan: /\btitan\b/i, europa: /europa/i, io: /\bio\b/i, ceres: /ceres/i, vesta: /vesta/i };
const today = () => { const d = new Date(); return d.getFullYear() * 1e4 + (d.getMonth() + 1) * 100 + d.getDate(); };
const ndata = () => { try { return typeof NASA !== 'undefined' ? NASA.data : null; } catch (e) { return null; } };
const nkey = () => (window.RDO_CONFIG && RDO_CONFIG.nasaKey) || 'DEMO_KEY';
async function apodFetch() { const a = G('apod', null); if (a && a.day === today()) return a; try { if (typeof NASA !== 'undefined' && !NASA.on) return a; } catch (e) {}
  try { const r = await fetch('https://api.nasa.gov/planetary/apod?thumbs=true&api_key=' + nkey()); if (!r.ok) return a; const j = await r.json(); const v = { day: today(), title: j.title || '', date: j.date || '', img: j.media_type === 'image' ? j.url : (j.thumbnail_url || ''), link: 'https://apod.nasa.gov/apod/ap' + String(j.date || '').slice(2).replace(/-/g, '') + '.html' }; P('apod', v); return v; } catch (e) { return a; } }
function dailyPick() { const day = today(), have = id => id.includes(':') || (R && R.byId[id]), pool = DPOOL.filter(m => m.need.every(have)), n = ndata(), a = G('apod', null);
  // live NASA data first: a real solar flare or geomagnetic storm this week, then today's Astronomy Picture of the Day
  if (n && Date.now() - n.at < 3 * 864e5) { const cls = n.top && n.top.cls || ''; if (/^[MX]/.test(cls)) return { ...pool[0], live: `NASA’s DONKI database recorded a real <b>${cls}</b> solar flare on ${n.top.date}.`, t: 'Solar flare alert', ic: '☀' };
    if (n.kp >= 5) return { ...DPOOL[1], live: `A real geomagnetic storm reached <b>Kp ${n.kp}</b> at Earth this week (NASA DONKI).`, t: 'Storm check on the crew' }; }
  if (a && a.day === day) for (const id in DBODY) if (DBODY[id].test(a.title) && BI[id]) return { ic: '🖼', t: 'Picture of the Day', d: `Fly to ${BI[id].n} and scan it.`, need: [id], live: `Today’s NASA Astronomy Picture of the Day is <b>“${a.title}”</b>.`, apod: a };
  const m = pool[(day * 7 + Math.floor(day / 100)) % pool.length]; return a && a.day === day ? { ...m, apod: a } : m; }
const DS = () => { const s = G('adv_day', null); return s && s.day === today() ? s : { day: today(), got: [], done: 0 }; };
function dailyHit(id) { const D = dailyPick(), s = DS(); if (s.done || !D.need.includes(id) || s.got.includes(id)) return; s.got.push(id);
  if (D.need.every(x => s.got.includes(x))) { s.done = 1; P('adv_day', s); trophy('a_daily'); reward(25, 300); sfx('fanfare'); P('adv_dstreak', (G('adv_dlast', 0) === today() - 1 ? G('adv_dstreak', 0) : 0) + 1); P('adv_dlast', today());
    setTimeout(() => { toast(`🛰 <b>Today’s NASA mission complete!</b> +25 🔧 · +300 XP · streak ${G('adv_dstreak', 1)} 🔥`, 4500); say('Daily mission complete. Nice flying, Commander.'); }, 1200); }
  else { P('adv_day', s); toast(`🛰 Today’s mission: ${s.got.length}/${D.need.length}`, 1800); } misUI(); }
function dailyCard() { const D = dailyPick(), s = DS(), lab = id => id.includes(':') ? { land: '🛬 Land on ', dive: '🌀 Dive into ' }[id.split(':')[0]] + BI[id.split(':')[1]].n : '📡 Scan ' + (R.byId[id] ? R.byId[id].o.n : BI[id] ? BI[id].n : id);
  const p = document.createElement('div'); p.className = 'pnl'; p.innerHTML = `<div class="crd"><div class="ey">🛰 TODAY’S NASA MISSION · ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div><h2>${D.ic} ${D.t}</h2>
    ${D.live ? `<div class="mt" style="color:#ffcf4a">🔴 LIVE · ${D.live}</div>` : ''}${D.apod && D.apod.img ? `<a href="${D.apod.link}" target="_blank" rel="noopener"><img src="${D.apod.img}" alt="" style="width:100%;max-height:180px;object-fit:cover;border-radius:10px;margin:6px 0"></a><div class="mt">NASA Astronomy Picture of the Day: “${D.apod.title}”</div>` : ''}
    <div class="mt">${D.d}</div><ul>${D.need.map(id => `<li>${s.got.includes(id) ? '✅' : '⬜'} ${lab(id)}</li>`).join('')}</ul><div class="mt">${s.done ? '✅ Done for today. A new mission arrives tomorrow.' : 'Reward: +25 🔧 · +300 XP'} · Streak: ${G('adv_dstreak', 0)} 🔥</div>
    <div class="row">${D.need.find(id => !id.includes(':') && !s.got.includes(id)) ? '<button class="pr" id="dGo">🚀 Autopilot to target</button>' : ''}<button id="dX">Close</button></div></div>`;
  R.root.appendChild(p); p.querySelector('#dX').onclick = () => p.remove(); const g = p.querySelector('#dGo'); if (g) g.onclick = () => { p.remove(); const id = D.need.find(x => !x.includes(':') && !s.got.includes(x)); goto(id); }; }
/* ---------------- co-op: fly the solar system together (Supabase Realtime room, same system as Story Mode co-op) ---------------- */
const CO = { ch: null, code: '', on: false, peer: null, tx: 0, near: 0, name: '' };
const myName = () => { try { return (window.NET && NET.name) || 'Commander'; } catch (e) { return 'Commander'; } };
function coPanel() { const p = document.createElement('div'); p.className = 'pnl'; const online = !!(window.NET && NET.on);
  p.innerHTML = `<div class="crd"><div class="ey">👥 CO-OP · FLY TOGETHER</div><h2>${CO.on ? 'Room ' + CO.code : 'Explore with a friend'}</h2>
    ${!online ? '<div class="mt">Co-op needs the game’s online features (Supabase in config.js). Story Mode co-op uses the same setup.</div><div class="row"><button id="kX">Close</button></div>' :
    CO.on ? `<div class="mt">${CO.peer ? `🟢 <b>${esc1(CO.peer.n)}</b> is flying the ${esc1((SHIPS.find(s => s.id === CO.peer.s) || SHIPS[0]).n)}${CO.peer.surf ? ' · on ' + BI[CO.peer.surf].n : ''}` : '⏳ Waiting for your friend to join with code <b style="letter-spacing:.2em">' + CO.code + '</b>…'}</div>
      <div class="row">${CO.peer && !CO.peer.surf ? '<button class="pr" id="kGo">🚀 Fly to friend</button>' : ''}<button id="kL">Leave room</button><button id="kX">Close</button></div>` :
    `<div class="mt">Both players open Adventure Mode. One makes a room, the other types its code. You see each other’s ship live, anywhere in the solar system.</div>
      <div class="row"><button class="pr" id="kH">🛰 Make a room</button></div><div class="row"><input id="kC" maxlength="4" placeholder="CODE" autocomplete="off" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800;width:110px;padding:10px;border-radius:10px;border:1px solid #7df9ff;background:#0a0f20;color:#fff;text-align:center"><button id="kJ">Join</button><button id="kX">Close</button></div>`}</div>`;
  R.root.appendChild(p); const q = s => p.querySelector(s), x = q('#kX'); x.onclick = () => p.remove();
  if (q('#kH')) q('#kH').onclick = () => { const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; coJoin(Array.from({ length: 4 }, () => L[Math.random() * L.length | 0]).join('')); p.remove(); coPanel(); };
  if (q('#kJ')) q('#kJ').onclick = () => { const c = q('#kC').value.toUpperCase().replace(/[^A-Z]/g, ''); if (c.length === 4) { coJoin(c); p.remove(); coPanel(); } };
  if (q('#kL')) q('#kL').onclick = () => { coLeave(); p.remove(); };
  if (q('#kGo')) q('#kGo').onclick = () => { p.remove(); const P2 = CO.peer.g.position; R.ship.position.copy(P2).add(new THREE.Vector3(8, 2, 8)); R.vel.set(0, 0, 0); R.ap = null; const d = P2.clone().sub(R.ship.position).normalize(); R.yaw = Math.atan2(-d.x, -d.z); R.pitch = Math.asin(d.y); R.warp && R.warp.kick && R.warp.kick(); toast('🚀 Warped next to <b>' + esc1(CO.peer.n) + '</b>'); }; }
const esc1 = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function coJoin(code) { coLeave(true); if (!window.NET || !NET.on) return; CO.code = code; CO.on = true; CO.name = myName();
  const go = () => { CO.ch = NET.channel('rdo-adv-' + code, { open: () => { toast('👥 In room <b>' + code + '</b>. Share the code with your friend!', 3500); coSend(true); }, msg: coMsg, error: m => { toast('⚠ Co-op: ' + m, 3500); coLeave(true); }, close: () => { if (CO.on) toast('⚠ Co-op room closed', 2500); coLeave(true); } }); };
  try { NET.boot().catch(() => {}).finally(go); } catch (e) { go(); } }
function coLeave(silent) { if (CO.ch) { try { CO.ch.send('bye', {}); CO.ch.close(); } catch (e) {} } CO.ch = null; CO.on = false; coDrop(); if (!silent) toast('👥 Left the co-op room', 1500); }
function coDrop() { if (CO.peer) { R.scn.remove(CO.peer.g); if (CO.peer.lab) CO.peer.lab.remove(); } CO.peer = null; }
function coSend(hi) { if (!CO.ch) return; const s = R.ship, r = v => Math.round(v * 100) / 100, sf = R.surf && R.surf.S && R.surf.S.on && R.surf.S.body;
  CO.ch.send(hi ? 'hi' : 'st', { p: [r(s.position.x), r(s.position.y), r(s.position.z)], q: [r(s.quaternion.x), r(s.quaternion.y), r(s.quaternion.z), r(s.quaternion.w)], v: [r(R.vel.x), r(R.vel.y), r(R.vel.z)], s: (R.shipStat || SHIPS[0]).id, n: CO.name, b: R.burn > .3 ? 1 : 0, surf: sf ? sf.id : null }); }
function coMsg(ev, d) { if (ev === 'bye') { if (CO.peer) toast('👋 <b>' + esc1(CO.peer.n) + '</b> left the room', 2500); coDrop(); return; }
  if ((ev !== 'st' && ev !== 'hi') || !d || !Array.isArray(d.p) || d.p.length !== 3 || !d.p.every(Number.isFinite)) return;
  let P2 = CO.peer; const fresh = !P2; if (!P2) { P2 = CO.peer = coShip(d); toast(`👥 <b>${esc1(P2.n)}</b> joined! Look for the green marker.`, 3500); sfx('chime'); say(String(d.n || 'Your friend').slice(0, 16) + ' has joined your flight.'); coSend(true); }
  if (d.s !== P2.s && SHIPS.some(x => x.id === d.s)) { P2.s = d.s; coModel(P2); }
  P2.n = String(d.n || 'Friend').slice(0, 16); P2.tp.fromArray(d.p); P2.tv.fromArray(Array.isArray(d.v) && d.v.every(Number.isFinite) ? d.v : [0, 0, 0]); if (Array.isArray(d.q) && d.q.length === 4 && d.q.every(Number.isFinite)) P2.tq.fromArray(d.q).normalize(); P2.rx = performance.now(); P2.b = d.b ? 1 : 0;
  const sf = d.surf && BI[d.surf] ? d.surf : null; if (sf !== P2.surf) { P2.surf = sf; if (sf) toast(`👥 <b>${esc1(P2.n)}</b> landed on ${BI[sf].n}`, 2500); } if (fresh) P2.g.position.copy(P2.tp); }
function coShip(d) { const g = new THREE.Group(), fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: R.flame.material && R.flame.material.map || null, color: 0x9dff9d, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); fl.scale.setScalar(1.2); g.add(fl);
  const nv = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x66ff88 })); nv.position.y = .9; g.add(nv); R.scn.add(g);
  const lab = document.createElement('div'); lab.className = 'cop'; R.root.querySelector('#aHud') ? R.root.querySelector('#aHud').appendChild(lab) : R.root.appendChild(lab);
  const P2 = { g, fl, nv, lab, s: d.s, n: String(d.n || 'Friend'), tp: new THREE.Vector3(), tv: new THREE.Vector3(), tq: new THREE.Quaternion(), rx: performance.now(), surf: null, b: 0, mdl: null }; coModel(P2); return P2; }
function coModel(P2) { const sh = SHIPS.find(x => x.id === P2.s) || SHIPS[0]; R.ship.userData.loader.load('models/nasa/' + sh.m + '.glb', gl => { if (!CO.peer || CO.peer !== P2 || P2.s !== sh.id) return; const m = gl.scene; fixMat(m); if (sh.r) m.rotation.set(sh.r[0], sh.r[1], sh.r[2], 'YXZ'); const w = new THREE.Group(); w.add(m); m.updateMatrixWorld(true); const sph = new THREE.Box3().setFromObject(w).getBoundingSphere(new THREE.Sphere()), k = sh.sz / sph.radius;
    w.scale.setScalar(k); w.position.copy(sph.center).multiplyScalar(-k); if (P2.mdl) P2.g.remove(P2.mdl); P2.g.add(w); P2.mdl = w; P2.fl.position.set(0, 0, sh.sz * 1.05); P2.nv.position.y = sh.sz * .7; }); }
function coStep(dt) { if (!CO.on) return; CO.tx -= dt; if (CO.tx <= 0) { CO.tx = .1; coSend(); } const P2 = CO.peer; if (!P2) return;
  if (performance.now() - P2.rx > 15000) { toast('⚠ Lost contact with <b>' + esc1(P2.n) + '</b>', 2500); coDrop(); return; }
  // smooth: extrapolate along the last velocity, then ease toward it (no rubber-banding at 10 updates a second)
  const age = Math.min(.5, (performance.now() - P2.rx) / 1000); tmpV.copy(P2.tp).addScaledVector(P2.tv, age); if (P2.g.position.distanceToSquared(tmpV) > 400) P2.g.position.copy(tmpV); else P2.g.position.lerp(tmpV, Math.min(1, dt * 10));
  P2.g.quaternion.slerp(P2.tq, Math.min(1, dt * 8)); P2.g.visible = !P2.surf && !(R.surf && R.surf.S && R.surf.S.on); P2.fl.material.opacity = P2.b ? .9 : .25 + Math.sin(R.t * 9) * .05; P2.nv.material.color.setHex(Math.sin(R.t * 4) > .6 ? 0xffffff : 0x33cc55);
  const d = P2.g.position.distanceTo(R.ship.position); if (d < 40 && !P2.surf) { CO.near += dt; if (CO.near > 10) trophy('a_coop'); } else CO.near = 0;
  const L = P2.lab; if (!P2.g.visible || CAM.photo) { L.style.display = 'none'; return; } const p = tmpV.copy(P2.g.position).project(R.cam), W = innerWidth, H = innerHeight, on = p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
  const sx = p.z < 1 ? p.x : -p.x, sy = p.z < 1 ? p.y : -p.y, x = on ? (p.x + 1) / 2 * W : (sx > 0 ? W - 90 : 90), y = on ? (1 - p.y) / 2 * H : Math.max(70, Math.min(H - 70, (1 - Math.max(-1, Math.min(1, sy))) / 2 * H));
  L.style.display = 'block'; L.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`; const t = `👥 ${P2.n} · ${d < 1000 ? d.toFixed(0) : (d / 1000).toFixed(1) + 'k'} u${on ? '' : ' ◀▶'}`; if (L._t !== t) { L.textContent = t; L._t = t; } }
function checkMissions() { while (ST.mi < MISSIONS.length && MISSIONS[ST.mi].need.every(done)) { ST.mi++; save(); reward(20, 150); sfx('fanfare'); setTimeout(() => toast('✅ Mission complete! +20 🔧' + (ST.mi < MISSIONS.length ? '<br><small>Next: ' + MISSIONS[ST.mi].t + '</small>' : '<br><small>You finished the Grand Tour!</small>'), 4000), 300); } misUI(); }
function misUI() { const m = R.root.querySelector('#aMis'), D = dailyPick(), ds = DS(), dl = `<i class="dly">🛰 TODAY: ${D.ic} ${D.t} ${ds.done ? '✅' : `(${ds.got.length}/${D.need.length})`}${D.live ? ' 🔴' : ''}</i>`; if (ST.mi >= MISSIONS.length) { m.innerHTML = '<b>GRAND TOUR COMPLETE</b>Keep scanning to fill your codex' + dl; return; } const M = MISSIONS[ST.mi]; m.innerHTML = `<b>MISSION ${ST.mi + 1}/${MISSIONS.length}</b>${M.t} <span style="opacity:.75">(${M.need.filter(done).length}/${M.need.length})</span>${dl}`; }
function goto(id) { if (OI[id] && OI[id].land) id = OI[id].land; const e = R.objs.find(x => x.o.id === id) || (BI[id] ? { o: BI[id], g: { position: R.bpos[id] } } : null); if (!e) return; const d = e.g.position.distanceTo(R.ship.position); R.ap = { e, max: Math.max(60, Math.min(900, d * .8)) }; R.apName = e.o.n; toast('🧭 Autopilot engaged → <b>' + e.o.n + '</b>'); }
// v85: real distances. The game squeezes the solar system so trips take minutes; the map shows the real numbers for today,
// from NASA JPL's approximate planet orbits (Standish, J2000 elements: size, shape, mean longitude and its rate, perihelion).
const KEPL = { mercury: [.38709927, .20563593, 252.2503235, 149472.67411175, 77.45779628], venus: [.72333566, .00677672, 181.9790995, 58517.81538729, 131.60246718], earth: [1.00000261, .01671123, 100.46457166, 35999.37244981, 102.93768193],
  mars: [1.52371034, .0933941, -4.55343205, 19140.30268499, -23.94362959], jupiter: [5.202887, .04838624, 34.39644051, 3034.74612775, 14.72847983], saturn: [9.53667594, .05386179, 49.95424423, 1222.49362201, 92.59887831],
  uranus: [19.18916464, .04725744, 313.23810451, 428.48202785, 170.9542763], neptune: [30.06992276, .00859048, -55.12002969, 218.45945325, 44.96476227] };
function helio(id, d) { const K = KEPL[id]; if (!K) return null; const T = (d - Date.UTC(2000, 0, 1, 12)) / 864e5 / 36525, r = Math.PI / 180, [a, e, L0, Ld, w] = K, M = ((L0 + Ld * T - w) % 360) * r; let E = M; for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E), c = Math.cos(w * r), s = Math.sin(w * r); return [x * c - y * s, x * s + y * c]; }
function realFromEarth(id) { if (id === 'earth') return 0; if (id === 'moon') return 384400; const b = BODIES.find(o => o.id === id), pid = b && b.at ? b.at : id; if (pid === 'earth') return null; if (id === 'sun') { const E = helio('earth', Date.now()); return Math.hypot(E[0], E[1]) * AUKM; }
  const P = helio(pid, Date.now()), E = helio('earth', Date.now()); return P && E ? Math.hypot(P[0] - E[0], P[1] - E[1]) * AUKM : null; }
function lightTime(km) { const s = km / 299792.458; return s < 90 ? s.toFixed(1) + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : (s / 3600).toFixed(1) + ' h'; }
function distTag(id) { if (id === 'earth') return 'home'; if (id === 'ceres') return '2.77 AU from the Sun'; const km = realFromEarth(id); return km == null ? '' : `${km >= 1e9 ? (km / 1e9).toFixed(2) + ' billion km' : fmtKm(km)} · light ${lightTime(km)}`; }
function mapPanel() { const p = document.createElement('div'); p.className = 'pnl'; const grp = {}; OBJS.forEach(o => (grp[o.at] = grp[o.at] || []).push(o));
  OBJS.filter(o => o.land).forEach(o => { (grp[o.land] = grp[o.land] || []); });
  p.innerHTML = `<div class="crd"><div class="ey">🗺 SOLAR SYSTEM MAP</div><h2>Where to?</h2><div class="mt">Pick a destination and autopilot flies you there. Joystick or keys take back control.</div><div class="mt" style="opacity:.8;font-size:12px">📏 In the game, sizes and distances are squeezed so a trip takes minutes. The numbers under each world are the real distance from Earth today and how long a radio signal takes.</div><div class="grid">${BODIES.map(b => `<h4>${b.n.toUpperCase()}</h4><button data-g="${b.id}">🪐 ${b.n}${WORLD[b.id] ? ' · 🛬' : DIVE[b.id] ? ' · 🌀' : ''}${distTag(b.id) ? `<small style="display:block;opacity:.7;font-size:11px;margin-top:2px">${distTag(b.id)}</small>` : ''}</button>` + (grp[b.id] || []).filter(o => !o.land).map(o => `<button data-g="${o.id}" class="${ST.scanned.has(o.id) ? '' : 'no'}">${ST.scanned.has(o.id) ? '🛰 ' + o.n : '📡 Unknown signal'}</button>`).join('')).join('')}</div>${R.anomaly ? '<h4 style="color:#c9a0ff">🟣 STORY</h4><button data-g="anomaly" style="border-color:#b070ff">🟣 Purple Signal (asteroid belt)</button>' : ''}<div class="row"><button id="mX">Close</button></div></div>`;
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
    w.scale.setScalar(k); w.position.copy(sph.center).multiplyScalar(-k); w.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
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
  p.querySelector('#hX').onclick = () => p.remove(); p.querySelector('#hGo').onclick = () => { const s = SHIPS.find(x => x.id === sel); if (!unlocked(s)) { sfx('no'); return; } p.remove(); if (sel !== cur) { setShip(sel); sfx('liftoff'); if (sel !== 'orion') trophy('a_ship'); } }; }
function flyToggle() { const S = R.surf.S; if (!S.on || S.mode !== 'land') return; const cr = craftFor(S.body.id); if (!cr) return; if (!S.fly) trophy(cr.heli ? 'a_heli' : 'a_fly'); R.surf.fly(S.fly ? null : cr); sfx(S.fly ? 'liftoff' : 'lnd'); }
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
function nearBody() { let best = null, bd = 1e9; for (const b of BODIES) { if (b.id === 'sun') continue; const d = R.bpos[b.id].distanceTo(R.ship.position) - b.r, sc = d; if (d < b.r * 2 + 24 && sc < bd) { bd = sc; best = b; } } return best; }   // whichever surface is actually closest (a moon right next to you beats its giant planet)
function landOrLaunch() { const S = R.surf.S; if (R.entry) return; if (S.on) { if (S.launch) return; if (S.mode === 'land') { try { media().start('Lift-off from ' + S.body.n, { title: S.body.n, sub: 'Lift-off', stamp: S.body.n }); } catch (e) {} R.root.classList.add('cine'); sfx('liftoff'); say('Main engine start. And lift-off!', 1); R.surf.launch(() => { R.root.classList.remove('cine'); landOrLaunch.done(); }); return; } return landOrLaunch.done(); }
  landOrLaunch.go(); }
landOrLaunch.done = function () { const S = R.surf.S; try { media().stop(2200); } catch (e) {} { const b = S.body; R.surf.exit(); surfUI(null); const c = R.bpos[b.id]; R.ship.position.copy(c).add(new THREE.Vector3(0, b.r + 10, b.r + 14)); lookAtYP(c); R.vel.set(0, 0, 0); toast('🚀 Back in orbit around <b>' + b.n + '</b>'); say('Orbit achieved around ' + b.n + '.'); R.rings.add(R.ship.position, 0xffd27a, 8, .8, R.cam.position); } };
landOrLaunch.go = function () {
  const b = nearBody(); if (!b) return; const kind = DIVE[b.id] ? 'dive' : WORLD[b.id] ? 'land' : null; if (!kind) return; R.ap = null; R.vel.set(0, 0, 0);
  if (kind === 'land' && SITES[b.id] && !R.site) { sitePicker(b); return; }
  const fl = (kind === 'dive' ? 'dive:' : 'land:') + b.id; dailyHit(fl); if (R.site) { const sf = 'site:' + b.id + ':' + R.site.id; if (!ST.flags.has(sf)) { ST.flags.add(sf); save(); reward(3, 30); } } if (!ST.flags.has(fl)) { ST.flags.add(fl); save(); reward(5, 50); setTimeout(checkMissions, 4800); }
  const st = R.site || null; R.site = null; startEntry(b, kind, st); };
/* ---------------- cinematic atmospheric entry: plasma, shake and heat glow, then touchdown ---------------- */
function startEntry(b, kind, st) { try { media().start((kind === 'dive' ? 'Dive into ' : 'Landing on ') + b.n, { title: b.n, sub: kind === 'dive' ? 'Into the clouds' : 'Atmospheric entry and landing', stamp: b.n }); } catch (e) {} if (kind === 'dive') trophy('a_dive'); else { trophy('a_land'); if ([...ST.flags].filter(f => f.startsWith('land:')).length >= 5) trophy('a_land5'); } const W = WORLD[b.id], air = kind === 'dive' || !!(W && W.air && W.air !== 'None'), c = R.bpos[b.id].clone(), dir = R.ship.position.clone().sub(c).normalize();
  R.entry = { t: 0, T: air ? 3.4 : 2.6, b, kind, st, air, c, dir, r0: Math.max(R.ship.position.distanceTo(c), b.r + 6) }; R.ap = null; R.vel.set(0, 0, 0); R.root.classList.add('cine');
  let ov = R.root.querySelector('#aHeat'); if (!ov) { ov = document.createElement('div'); ov.id = 'aHeat'; R.root.appendChild(ov); } ov.style.opacity = 0;
  toast(air ? `🔥 Entering the atmosphere of <b>${b.n}</b>` : `🛬 Powered descent to <b>${b.n}</b>`, 2200); say(kind === 'dive' ? 'Entering the clouds of ' + b.n + '. Hold on.' : air ? 'Entry interface. Heat shield is taking the load.' : 'Beginning powered descent to ' + b.n + '.', 1); sfx(kind === 'dive' ? 'whoosh' : air ? 'burst' : 'land'); }
function stepEntry(dt) { const C = R.entry, ship = R.ship, sz = (R.shipStat || SHIPS[0]).sz; C.t += dt; R.t += dt; const k = Math.min(1, C.t / C.T), e = k * k * (3 - 2 * k);
  const alt = C.b.r * 1.012 + (C.r0 - C.b.r * 1.012) * (1 - e); ship.position.copy(C.c).addScaledVector(C.dir, alt); ship.visible = true; entryAttitude(C, ship);
  const heat = C.air ? Math.sin(Math.min(1, k * 1.15) * Math.PI) : 0, nose = new THREE.Vector3().copy(ship.position).addScaledVector(C.dir, -sz * 1.1);
  if (C.air) { const back = C.dir.clone().multiplyScalar(18 + heat * 30); R.fx.emit(nose, back, 0xd8742c, sz * (.22 + .3 * heat), .4, Math.ceil(4 * heat) + 1, 4 * sz, { grow: 2.2, drag: .2, jit: sz * .45, a: .7 }); R.fx.emit(nose, back, 0xffe0b0, sz * .18, .2, Math.ceil(3 * heat), 2 * sz, { grow: 1.4, jit: sz * .3, a: .8 }); if (heat > .4) R.fx.emit(nose, back.multiplyScalar(1.6), 0xff5a20, sz * .12, .35, 2, 6 * sz, { grow: 1, jit: sz * .8 }); }
  else R.fx.emit(nose, C.dir.clone().multiplyScalar(-14), 0x9fd8ff, sz * .5, .5, 4, 1.5 * sz, { grow: 2.4 });
  // camera: high and behind, looking down past the ship toward the planet, shaking with the heat
  const side = new THREE.Vector3(0, 1, 0).cross(C.dir); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize(); const sh = (C.air ? heat * .35 : .05) * sz;
  const cw = C.chute ? Math.min(1, (C.t / C.T - .7) / .15) : 0; R.cam.position.copy(ship.position).addScaledVector(C.dir, sz * (7 + cw * 4)).addScaledVector(side, sz * (3.2 + cw * 13)).add(tmpV.set((Math.random() - .5) * sh, (Math.random() - .5) * sh, (Math.random() - .5) * sh));
  R.cam.lookAt(tmpV.copy(ship.position).lerp(C.c, .02)); R.cam.fov += ((56 - heat * 6) - R.cam.fov) * Math.min(1, dt * 3); R.cam.updateProjectionMatrix();
  AUD.set({ eng: C.air ? .2 : .7, boost: 0, wind: C.air ? Math.min(1, heat * 1.2) : 0, dt }); const ov = R.root.querySelector('#aHeat'); ov.style.opacity = Math.min(1, (C.air ? heat * .85 : 0) + (k > .86 ? (k - .86) / .14 : 0)); ov.classList.toggle('w', k > .86);
  for (const e2 of R.objs) R.placeObj(e2, R.t); updatePlanetUniforms(R.PL, R.bpos.sun, R.t); R.fx.update(dt, R.cam); R.rings.update(dt); flare();
  entryFX(C, heat, k, dt, sz);
  if (C.air && heat > .92 && !C.pk) { C.pk = 1; say('Peak heating.'); }
  if (k >= 1) { entryFX(C, 0, 1, 0, sz, true); try { media().stop(2600); } catch (e) {} const { b, kind, st } = C; say(kind === 'dive' ? 'We are inside ' + b.n + '.' : 'Touchdown. Welcome to ' + (st ? st.n.split(' (')[0].split(' ·')[0] : b.n) + '.', 1); R.entry = null; R.surf.enter(b, kind, st); pre(R.surf.S.scn); setTimeout(() => { R.root.classList.remove('cine'); ov.style.opacity = 0; ov.classList.remove('w'); }, 120); } }
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
  R.intro = { t: 0, T: 11, p0: e.clone().addScaledVector(s, -er * 2.7).addScaledVector(side, er * .9).add(new THREE.Vector3(0, er * .45, 0)), p1: e.clone().addScaledVector(side, er * 2.2).add(new THREE.Vector3(0, er * .35, 0)) };
  R.root.classList.add('cine', 'intro'); let t = R.root.querySelector('#aTitle'); if (!t) { t = document.createElement('div'); t.id = 'aTitle'; R.root.appendChild(t); }
  t.innerHTML = '<div class="k">MOON PRODUCTIONS PRESENTS</div><h1>RED DUST OUTPOST</h1><div class="s">ADVENTURE · THE GRAND TOUR</div><div class="m">Every spacecraft is a real NASA 3D model · tap to skip</div>'; t.className = 'on';
  t.onclick = () => { if (R.intro) R.intro.t = R.intro.T; }; sfx('whoosh'); }
function stepIntro(dt) { const I = R.intro; I.t += dt; R.t += dt; const k = Math.min(1, I.t / I.T), e = k * k * (3 - 2 * k), ship = R.ship;
  for (const o of R.objs) R.placeObj(o, R.t); for (const b of BODIES) R.bmesh[b.id].rotation.y += dt * (b.id === 'sun' ? .02 : .05);
  const chase = new THREE.Vector3(0, 2.4, 9).applyQuaternion(ship.quaternion).add(ship.position);
  // first 70%: glide past Earth's terminator; last 30%: settle in behind the ship
  const mid = I.p0.clone().lerp(I.p1, Math.min(1, e / .7)); R.cam.position.copy(k < .7 ? mid : I.p1.clone().lerp(chase, (k - .7) / .3 * ((k - .7) / .3) * (3 - 2 * (k - .7) / .3)));
  const look = R.bpos.earth.clone().lerp(ship.position, Math.max(0, (k - .55) / .45)); R.cam.lookAt(look); R.cam.fov = 48 + 12 * e; R.cam.updateProjectionMatrix();
  updatePlanetUniforms(R.PL, R.bpos.sun, R.t); spaceFX(dt); flare(); R.fx.update(dt, R.cam);
  const t = R.root.querySelector('#aTitle'); if (k > .78) t.className = 'off';
  if (k >= 1) { R.intro = null; R.root.classList.remove('cine', 'intro'); t.className = 'off'; setTimeout(() => t.remove(), 900); if (!G('adv_seen', 0)) intro(); else toast(R.anomaly && !ST.flags.has('anomaly') ? '📻 Mission Control: a strange <b>purple signal</b> is coming from the asteroid belt…' : '🗺 Map → pick a destination · 📡 scan signals · 🎬 Demo for a guided tour', 4500); } }
/* ---------------- demo tour: flies itself through the best moments (any input takes control back) ---------------- */
const DEMO = { on: false };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function demoTour() { if (DEMO.on) { demoStop(); return; } DEMO.on = true; R.root.classList.add('demo'); say('Demo tour starting. Sit back and enjoy the ride.', 1); toast('🎬 Demo tour · touch the joystick or any key to take control', 3000);
  const arrive = async (max = 40000) => { const t0 = Date.now(); while (DEMO.on && R.ap && Date.now() - t0 < max) await wait(250); };
  const showcase = async id => { if (!DEMO.on) return; const lp = R.root.querySelector('.pnl'); if (lp) lp.remove(); if (!R.objs.find(x => x.o.id === id)) return; goto(id); await arrive(); if (!DEMO.on) return; const e = R.objs.find(x => x.o.id === id); if (e) { R.scanning = { e, t: 0 }; sfx('beep'); await wait(1600); const p = R.root.querySelector('.pnl'); await wait(3800); if (p && p.isConnected) p.remove(); } };
  try {
    await showcase('iss'); if (!DEMO.on) return; await showcase('hubble'); if (!DEMO.on) return;
    CAM.mode = 'cockpit'; toast('🎥 Inside the Space Shuttle cockpit', 1800); await wait(4000); CAM.mode = 'chase'; if (!DEMO.on) return;
    goto('mars'); await arrive(60000); if (!DEMO.on) return; R.site = (SITES.mars || []).find(s => s.id === 'gale') || (SITES.mars || [])[0] || null; if (R.site) await loadDEM(R.site); if (!nearBody() || nearBody().id !== 'mars') { const c = R.bpos.mars, B = BI.mars.r; R.ship.position.copy(c).add(new THREE.Vector3(B + 8, 4, B + 8)); R.vel.set(0, 0, 0); } landOrLaunch.go(); await wait(400); { const pk = R.root.querySelector('.pnl [data-s]'); if (pk) pk.click(); } await wait(5200); if (!DEMO.on) return;
    toast('🔴 Gale Crater, Mars · real NASA terrain', 2500); await wait(6000); if (!DEMO.on) return; landOrLaunch(); await wait(5000); if (!DEMO.on) return;
    CAM.photo = 1; R.root.classList.add('photo'); await wait(7000); CAM.photo = 0; R.root.classList.remove('photo');
    trophy('a_demo'); toast('🏁 Demo complete · the solar system is yours', 3000);
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
  const nr = nearest(), tb = el.querySelector('.atb'); let shown = false;
  if (nr.e && !nr.e.body && nr.d < 140) { const p = tmpV.copy(nr.e.g.position).project(R.cam);
    if (p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1) { shown = true; const d = nr.e.g.position.distanceTo(R.ship.position), px = Math.max(26, Math.min(160, nr.e.o.sz / Math.max(.5, d) * H * 1.1)), cl = R.lastTD != null && R.lastTE === nr.e ? (R.lastTD - d) / Math.max(1e-3, R.dtH || .016) : 0; R.lastTD = d; R.lastTE = nr.e;
      tb.style.display = 'block'; tb.style.transform = `translate(${((p.x + 1) / 2 * W - px / 2).toFixed(1)}px,${((1 - p.y) / 2 * H - px / 2).toFixed(1)}px)`; tb.style.width = tb.style.height = px.toFixed(0) + 'px';
      const u = !ST.scanned.has(nr.e.o.id); tb.classList.toggle('u', u); const t = `${u ? 'UNKNOWN SIGNAL' : nr.e.o.n.toUpperCase()} · ${d.toFixed(1)} u · ${cl >= 0 ? '▼' : '▲'} ${Math.abs(cl * 1000).toFixed(0)} km/h`; const lb = tb.firstChild; if (lb._t !== t) { lb.textContent = t; lb._t = t; } } }
  if (!shown) { tb.style.display = 'none'; R.lastTD = null; }
  // prograde marker: where the ship is actually drifting
  const pg = el.querySelector('.apg'); let pv = false; if (spd > 2) { const p = tmpV.copy(R.ship.position).addScaledVector(R.vel, 40 / spd).project(R.cam); if (p.z < 1 && Math.abs(p.x) < .95 && Math.abs(p.y) < .95) { pv = true; pg.style.transform = `translate(${((p.x + 1) / 2 * W - 13).toFixed(1)}px,${((1 - p.y) / 2 * H - 13).toFixed(1)}px)`; } }
  pg.style.display = pv ? 'block' : 'none'; const ck = CAM.mode === 'cockpit'; el.querySelector('.ack').style.display = ck ? 'block' : 'none';
  if (ck && (R.mfdT = (R.mfdT || 0) + (R.dtH || .016)) > .2) { R.mfdT = 0; const nb = nearBody(), cb = BODIES.reduce((a, b) => { const d = R.bpos[b.id].distanceTo(R.ship.position) - b.r; return d < a[1] ? [b, d] : a; }, [null, 1e9]);
    const set = (id, h) => { const m = el.querySelector(id); if (m._h !== h) { m.innerHTML = h; m._h = h; } };
    set('#mfd1', `<b>VEL</b>${Math.round(spd * 1000).toLocaleString()} km/h<br><b>THR</b>${Math.round((R.burn || 0) * 100)}%<br><b>SHIP</b>${(R.shipStat || SHIPS[0]).n}`);
    set('#mfd2', `<b>NEAREST</b>${cb[0] ? cb[0].n : '-'}<br><b>ALT</b>${cb[0] ? Math.max(0, cb[1]).toFixed(1) + ' u' : '-'}<br>${nb ? '<b>READY</b>' + (DIVE[nb.id] ? 'DIVE' : 'LAND') : '<b>ORBIT</b>FREE'}`);
    set('#mfd3', `<b>TARGET</b>${nr.e && !nr.e.body && nr.d < 140 ? (ST.scanned.has(nr.e.o.id) ? nr.e.o.n : 'UNKNOWN') : '-'}<br><b>SCANS</b>${ST.scanned.size}/${ALL.length}<br><b>MISSION</b>${Math.min(ST.mi + 1, MISSIONS.length)}/${MISSIONS.length}`); } }
function camToggle() { CAM.mode = CAM.mode === 'chase' ? 'cockpit' : 'chase'; if (CAM.mode === 'cockpit' && (R.shipStat || SHIPS[0]).id.startsWith('shuttle')) trophy('a_cockpit'); toast(CAM.mode === 'cockpit' ? '🎥 Cockpit view' : '🎥 Chase view', 1200); }
function photoToggle() { CAM.photo = !CAM.photo; if (CAM.photo) trophy('a_photo'); R.root.classList.toggle('photo', !!CAM.photo); if (CAM.photo) { CAM.pa = Math.atan2(R.cam.position.z - R.ship.position.z, R.cam.position.x - R.ship.position.x); toast('📷 Photo mode · tap anywhere to exit', 1800); } }

function loadDEM(site) { return new Promise(res => { if (!site || !site.dem || site.hm) return res(); const im = new Image(); im.onload = () => { const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'); g.drawImage(im, 0, 0, N, N); const d = g.getImageData(0, 0, N, N).data, hm = new Float32Array(N * N); for (let i = 0; i < N * N; i++) hm[i] = d[i * 4] / 255; site.hm = hm; site.N = N; site.relief = (DEM[site.dem] || {}).relief || .06; res(); }; im.onerror = () => res(); im.src = 'models/dem/' + site.dem + '.png'; }); }
function sitePicker(b) { const p = document.createElement('div'); p.className = 'pnl'; const L = SITES[b.id];
  p.innerHTML = `<div class="crd"><div class="ey">🛬 CHOOSE A LANDING SITE · ${b.n.toUpperCase()}</div><h2>Where do you want to land?</h2><div class="mt">Sites marked 🗺 use real NASA terrain models of that exact place.</div><div class="grid">${L.map((x, i) => `<button data-s="${i}"><b style="font-size:13px">${x.dem ? '🗺 ' : ''}${x.n}</b><br><span style="opacity:.75">${x.facts[0]}</span></button>`).join('')}</div><div class="row"><button id="sX">Cancel</button></div></div>`;
  R.root.appendChild(p); p.querySelector('#sX').onclick = () => p.remove(); p.querySelectorAll('[data-s]').forEach(x => x.onclick = async () => { const site = L[+x.dataset.s]; x.textContent = 'Loading terrain…'; await loadDEM(site); p.remove(); R.site = site; landOrLaunch(); }); }
/* rovers, helmet view and the suit readout */
const RAD = { earth: .1, moon: 57, mars: 28, phobos: 30, deimos: 30, mercury: 300, venus: .1, io: 1.5e6, europa: 2.25e5, ganymede: 3300, callisto: 4, titan: .3, enceladus: 40, mimas: 40, rhea: 40, tethys: 40, dione: 40, iapetus: 20, ceres: 20, vesta: 20, pluto: 10, charon: 10, triton: 15, miranda: 12, ariel: 12, titania: 12, oberon: 12, umbriel: 12 };
const SUIT = { o2: 100, beat: 82, day: 1, lastTod: 0, t: 0 };
function driveToggle() { const S = R.surf.S; if (!S.on || S.mode !== 'land' || S.fly) return; const ok = R.surf.drive(!S.drive); if (ok) { sfx(S.drive ? 'liftoff' : 'lnd'); if (S.drive) trophy('a_rover'); } drvUI(); }
function drvUI() { const S = R.surf.S, b = R.root.querySelector('#aDrv'), can = S.on && S.mode === 'land' && (S.body.id === 'moon' || S.body.id === 'mars') && !S.fly; b.style.display = can ? 'block' : 'none'; if (can) b.innerHTML = S.drive ? '🧑‍🚀 GET OUT' : S.body.id === 'moon' ? '🚙 DRIVE THE MOON BUGGY' : '🤖 DRIVE THE ROVER'; R.root.querySelector('#aThr').innerHTML = S.drive ? '🛑<br>BRAKE' : S.fly ? R.root.querySelector('#aThr').innerHTML : '⤒<br>JUMP'; }
function helmToggle() { const S = R.surf.S; if (!S.on || S.mode !== 'land' || S.drive || S.fly) return; const on = R.surf.helmet(); R.visor.enabled = !!on; R.root.classList.toggle('helm', !!on); toast(on ? '🪖 Helmet view: what the astronaut sees through the visor (V to switch back)' : '🎥 Third-person view', 2200); }
function suitHUD(dt) { const S = R.surf.S, el = R.root.querySelector('#aSuit'); if (!S.on || S.mode !== 'land') { el.style.display = 'none'; return; } el.style.display = 'block'; const id = S.body.id, W = WORLD[id] || {}, P = S.player.position;
  SUIT.t += dt; if (S.tod < SUIT.lastTod - .5) SUIT.day++; SUIT.lastTod = S.tod; const nearCap = Math.hypot(P.x + 12, P.z + 8) < 16 || !!S.drive;
  SUIT.o2 = THREE.MathUtils.clamp(SUIT.o2 + (nearCap ? 6 : -.18) * dt, 0, 100); if (SUIT.o2 < 15 && !SUIT.warn) { SUIT.warn = 1; toast('⚠ Oxygen low! Head back to your lander (or a rover) to refill.', 3500); say('Warning. Oxygen low.'); } if (SUIT.o2 > 30) SUIT.warn = 0;
  const run = R.keys.shift || R.bst, tgt = 78 + (run ? 34 : 0) + (Math.hypot(S.vel.x, S.vel.z) > .5 ? 12 : 0); SUIT.beat += (tgt - SUIT.beat) * Math.min(1, dt * .5);
  const ts = String(W.t || '').replace(/−/g, '-'), rg = ts.match(/(-?\d[\d,]*)\s*(?:to|–)\s*(-?\d[\d,]*)/), one = ts.match(/-?\d[\d,]*/), lo = parseFloat(((rg ? rg[1] : one ? one[0] : '0')).replace(',', '')), hi = rg ? parseFloat(rg[2].replace(',', '')) : lo, day = S.skyU ? THREE.MathUtils.smoothstep(S.skyU.e.value, -.06, .3) : Math.max(0, Math.sin(S.tod * Math.PI * 2)), temp = Math.round(lo + (Math.max(hi, lo) - lo) * day);
  const h = (S.tod * 24 + 6) % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 60), dl = DAYH[id] || 24, dlTxt = dl < 48 ? `${Math.floor(dl)} h ${Math.round((dl % 1) * 60)} m` : `${(dl / 24).toFixed(1)} Earth days`;
  const rad = RAD[id] ?? 25, radTxt = rad >= 1000 ? (rad / 1000).toFixed(rad >= 1e5 ? 0 : 1) + ' mSv/h' : rad.toFixed(rad < 1 ? 1 : 0) + ' µSv/h', rc = rad > 1e4 ? 'd' : rad > 50 ? 'w' : '';
  const t = `<b>🕒 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b> local · ${id === 'mars' ? 'Sol' : 'Day'} ${SUIT.day} · day = ${dlTxt}<br><b>O₂</b> <span class="${SUIT.o2 < 15 ? 'd' : SUIT.o2 < 35 ? 'w' : ''}">${SUIT.o2.toFixed(0)}%</span> · <b>SUIT</b> 29.6 kPa · <b>♥</b> ${Math.round(SUIT.beat)}<br><b>OUTSIDE</b> ${temp} °C · <b>RAD</b> <span class="${rc}">${radTxt}${rad > 1e4 ? ' · LETHAL' : ''}</span>`;
  if (el._t !== t) { el.innerHTML = t; el._t = t; } R.visor.uniforms.cold.value = temp < -120 ? 1 : temp < -40 ? .5 : 0; R.visor.uniforms.aspect.value = innerWidth / innerHeight; R.visor.uniforms.time.value = SUIT.t; }
function surfUI(b, W, mode) { const $ = q => R.root.querySelector(q), on = !!b; $('#aHelm').style.display = on && mode === 'land' ? 'block' : 'none'; if (!on) { R.visor.enabled = false; R.root.classList.remove('helm'); SUIT.o2 = 100; SUIT.day = 1; } setTimeout(() => { try { drvUI(); } catch (e) {} }, 0); $('#aHud').style.display = on ? 'none' : ''; $('#aMap').style.display = on ? 'none' : ''; $('#aHan').style.display = on ? 'none' : ''; const cr = on && mode === 'land' ? craftFor(b.id) : null; $('#aFly').style.display = cr ? 'block' : 'none'; if (cr) $('#aFly').innerHTML = (cr.heli ? '🚁 ' : '✈ ') + 'FLY ' + cr.n.toUpperCase(); $('#aThr').innerHTML = on ? (mode === 'dive' ? '⬆<br>CLIMB' : '⤒<br>JUMP') : '🚀<br>THRUST'; $('#aBst').innerHTML = on ? (mode === 'dive' ? 'DIVE' : 'RUN') : 'BOOST';
  $('#aLand').style.display = on ? 'block' : 'none'; $('#aLand').textContent = '🚀 LAUNCH'; $('#aLand')._t = null; R.mode = on ? mode : null; R.lab.forEach(l => l.style.display = 'none');
  R.surfInfo = on ? (mode === 'dive' ? `${b.n} · inside the clouds` : `${b.n} · gravity ${W.g} m/s² (${Math.round(W.g / 9.81 * 100)}% of Earth) · ${W.t} · air: ${W.air}`) : ''; }
let jumpWas = 0;
function surfStep(dt) { try { suitHUD(dt); } catch (e) {} const k = R.keys, S = R.surf.S, jump = !!(R.thr || k[' ']), inp = { x: R.joy.x + ((k.d || k.arrowright) ? 1 : 0) - ((k.a || k.arrowleft) ? 1 : 0), y: R.joy.y + ((k.s || k.arrowdown) ? 1 : 0) - ((k.w || k.arrowup) ? 1 : 0), run: !!(R.bst || k.shift), jump, jumpPress: jump && !jumpWas, look: (k.q ? 1 : 0) - (k.r ? 1 : 0), lookY: 0 }; jumpWas = jump;
  const r = R.surf.step(dt, inp) || {}; { const F = S.fly; AUD.set({ eng: F ? (F.heli ? .55 : Math.min(1, (r.spd || 0) / (F.vmax * 3.6))) : (inp.jump && !S.onGround ? .35 : 0), boost: F && inp.run ? 1 : 0, wind: F && !F.heli && WORLD[S.body.id] && WORLD[S.body.id].air !== 'None' ? Math.min(1, (r.spd || 0) / 300) : (S.mode === 'dive' ? .5 : 0), dt, air: !S.body ? 'ship' : WORLD[S.body.id] && WORLD[S.body.id].air === 'None' ? 'vac' : S.body.id }); }
  if (R.scanning && R.scanning.surf) { R.scanning.t += dt; const el = R.root.querySelector('#aScan'); el.style.display = 'block'; setT(el, 'SCANNING ' + Math.min(100, Math.round(R.scanning.t / 1.1 * 100)) + '%'); if (R.scanning.t > 1.1) { el.style.display = 'none'; const o = R.scanning.e.o; R.scanning = null; card(o, true); } }
  R.root.querySelector('#aScn').classList.toggle('on', !!(S.near && !ST.scanned.has(S.near.o.id))); if (S.mode !== 'dive') ldUI(S.ldK || 0, S.ldN || 0); else ldUI(0, 0);
  setT(R.root.querySelector('#aSpd'), S.mode === 'dive' ? `Depth ${Math.round(r.depth || 0)} km / ${r.max} km · ${Math.round(1 + (r.depth || 0) * .9)} bar · ${R.surfInfo}` : (S.fly ? `${S.fly.heli ? '🚁' : '✈'} ${S.fly.n} · ${r.spd} km/h · altitude ${r.alt} m · ` : '') + `${R.surfInfo} · ${S.cols.filter(c => !c.got).length} finds left`);
  // labels for NASA sites and nearby finds
  const W_ = innerWidth, H_ = innerHeight, v = new THREE.Vector3(); let i = 0; const P_ = S.player ? S.player.position : v;
  const L = S.mode === 'dive' ? [] : [...S.items.filter(x => !x.geyser).map(x => [x.g.position, (ST.scanned.has(x.o.id) ? x.o.n : '📡 ' + x.o.n), x.s * 1.15 + 1.5, !ST.scanned.has(x.o.id)]), ...S.cols.filter(c => !c.got && c.m.position.distanceTo(P_) < 90).map(c => [c.m.position, c.sample ? '🧪 Sample' : '⭐', 1.2, 1])];
  L.forEach(x => x[4] = x[0].distanceTo(P_)); L.sort((a, b) => a[4] - b[4]); L.length = Math.min(L.length, 8);
  for (const [p, t, up, u] of L) { const d = p.distanceTo(P_); if (d > 400) continue; v.copy(p); v.y += up; v.project(R.cam); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue; let el = R.lab[i]; if (!el) { el = R.lab[i] = document.createElement('div'); R.labs.appendChild(el); } i++; if (el._m !== 'g') { el._m = 'g'; el.style.transform = ''; } el._c = el._h = el._d = null; el.className = 'lab' + (u ? ' u' : ''); el.innerHTML = t + `<small>${Math.round(d)} m</small>`; el.style.left = ((v.x + 1) / 2 * W_) + 'px'; el.style.top = ((1 - v.y) / 2 * H_) + 'px'; el.style.display = 'block'; }
  for (; i < R.lab.length; i++) R.lab[i].style.display = 'none'; }
/* ---------------- open / close ---------------- */
/* ---------------- realism pass 13: a living solar system ---------------- */
// 1) Orbits. Planets follow Kepler's third law (period ∝ distance^1.5; an Earth year is 25 minutes here), moons visibly circle their planets.
//    Positions come from the real clock, so co-op friends see the same sky. Your ship rides along with whatever world it is near, like a real orbit.
const ORB_EPOCH = 1.79e9, MOONP = { moon: 240, phobos: 40, deimos: 90, io: 45, europa: 90, ganymede: 180, callisto: 420, mimas: 50, enceladus: 70, tethys: 95, dione: 130, rhea: 190, titan: 330, iapetus: 900, miranda: 70, ariel: 100, umbriel: 140, titania: 220, oberon: 300, triton: 150, charon: 120 };
const ORB = { base: null, prev: {}, n: new THREE.Vector3() };
const orbT = () => SET.orb === 0 ? 0 : Date.now() / 1000 - ORB_EPOCH;
function orbitPos(bp, T) { if (!ORB.base) { ORB.base = {}; for (const b of BODIES) ORB.base[b.id] = b.at ? new THREE.Vector3(...b.off) : null; }
  for (const b of BODIES) if (!b.at && b.id !== 'sun') { const w = Math.PI * 2 / 1500 * Math.pow(520 / b.d, 1.5), a = b.a + w * T; bp[b.id].set(Math.cos(a) * b.d, 0, Math.sin(a) * b.d); }
  for (const b of BODIES) if (b.at) { const o = ORB.base[b.id], rad = Math.hypot(o.x, o.z), a0 = Math.atan2(o.z, o.x), P = MOONP[b.id] || 60 * Math.pow(rad / 12, 1.5), a = a0 + Math.PI * 2 * T / P;
    bp[b.id].set(bp[b.at].x + Math.cos(a) * rad, bp[b.at].y + o.y, bp[b.at].z + Math.sin(a) * rad); } }
function orbitStep() { const bp = R.bpos;
  for (const b of BODIES) ORB.prev[b.id] = (ORB.prev[b.id] || new THREE.Vector3()).copy(bp[b.id]);
  orbitPos(bp, orbT()); for (const b of BODIES) R.bmesh[b.id].position.copy(bp[b.id]);
  // the ship shares the motion of the world whose gravity it is in
  let dom = null, sc = 1e9; for (const b of BODIES) { if (b.id === 'sun') continue; const d = ORB.prev[b.id].distanceTo(R.ship.position) - b.r, k = d; if (d < b.r * 6 + 40 && k < sc) { sc = k; dom = b; } }
  ORB.dom = dom; if (dom && !R.ending) { const dv = ORB.n.copy(bp[dom.id]).sub(ORB.prev[dom.id]); if (dv.lengthSq() < 400) { R.ship.position.add(dv); R.cam.position.add(dv); } }
  // eclipse occluders follow the moons
  for (const b of BODIES) { const m = R.bmesh[b.id]; if (!m.material.uniforms || !m.material.uniforms.occ) continue; const u = m.material.uniforms; if (b.at && BI[b.at] && b.at !== 'sun') u.occ.value.set(bp[b.at].x, bp[b.at].y, bp[b.at].z, BI[b.at].r);
    const kid = ORB.kids && ORB.kids[b.id]; if (kid) u.occ2.value.set(bp[kid.id].x, bp[kid.id].y, bp[kid.id].z, kid.r); }
  if (!ORB.kids) { ORB.kids = {}; for (const b of BODIES) { const ks = BODIES.filter(x => x.at === b.id).sort((a, c) => c.r / bp[c.id].distanceTo(bp[b.id]) - a.r / bp[a.id].distanceTo(bp[b.id])); if (ks[0]) ORB.kids[b.id] = ks[0]; } } }

// 3) Light: the Sun as a directional light that follows the ship (so the ship casts real shadows on nearby craft, ring ice and itself),
//    dimmed when a planet blocks it; plus planetshine, the coloured light reflected off the nearest world.
const ALB = { mercury: [0x9a9590, .14], venus: [0xf2dcae, .76], earth: [0x7aa8e8, .3], moon: [0xa8a6a2, .12], mars: [0xd47a4a, .25], jupiter: [0xd8bc90, .5], saturn: [0xe6d6a8, .5], uranus: [0xa6e2ea, .5], neptune: [0x6a8ae0, .44], io: [0xe0c860, .6], europa: [0xd6ccbc, .67], ganymede: [0xa8a098, .43], callisto: [0x7a7268, .2], titan: [0xd8a050, .22], enceladus: [0xf4f8ff, .99], pluto: [0xd8c0a0, .5], ceres: [0x8a8a8e, .09], vesta: [0xa8a49a, .42] };
const LIT = { sun: null, ps: null, v: new THREE.Vector3(), w: new THREE.Vector3() };
function lightsInit() { const sd = new THREE.DirectionalLight(0xfff2dd, 3.2); sd.castShadow = true; const sc = sd.shadow.camera; sc.left = sc.bottom = -9; sc.right = sc.top = 9; sc.near = .5; sc.far = 90; sd.shadow.mapSize.set(1024, 1024); sd.shadow.bias = -.0004; sd.shadow.normalBias = .03;
  R.scn.add(sd); R.scn.add(sd.target); LIT.sun = sd; const ps = new THREE.DirectionalLight(0xffffff, 0); R.scn.add(ps); R.scn.add(ps.target); LIT.ps = ps; R.scn.traverse(o => { if (o.isPointLight && o.intensity === 3.2 && o.decay === 0) o.intensity = 0; }); }
function lightsStep() { if (!LIT.sun) lightsInit(); const ship = R.ship.position, sz = (R.shipStat || SHIPS[0]).sz, sd = LIT.sun, toSun = LIT.v.copy(R.bpos.sun).sub(ship), ds = toSun.length(); toSun.divideScalar(ds);
  let vis = 1; for (const b of BODIES) { if (b.id === 'sun') continue; const oc = LIT.w.copy(R.bpos[b.id]).sub(ship), t = oc.dot(toSun); if (t > 0 && t < ds) { const d2 = oc.lengthSq() - t * t, r = b.r; if (d2 < r * r * 1.1) { vis = Math.min(vis, THREE.MathUtils.smoothstep(Math.sqrt(d2), r * .92, r * 1.05)); } } }
  sd.position.copy(ship).addScaledVector(toSun, 40); sd.target.position.copy(ship); sd.intensity = 3.2 * vis; const k = Math.max(4, sz * 4); const c = sd.shadow.camera; if (c.right !== k) { c.left = c.bottom = -k; c.right = c.top = k; c.updateProjectionMatrix(); }
  OCCS.value.set(ship.x, ship.y, ship.z, sz * .5);
  let best = null, bs = 1e9; for (const b of BODIES) { if (b.id === 'sun' || !ALB[b.id]) continue; const d = R.bpos[b.id].distanceTo(ship); const f = (b.r / Math.max(d, b.r)) ** 2; if (-f < bs) { bs = -f; best = [b, d, f]; } }
  const ps = LIT.ps; if (best && -bs > .002) { const [b, d, f] = best, pp = R.bpos[b.id], n = LIT.w.copy(ship).sub(pp).normalize(), ph = .5 + .5 * n.dot(LIT.v.copy(R.bpos.sun).sub(pp).normalize());
    ps.color.setHex(ALB[b.id][0]); ps.intensity = Math.min(2.4, 3.2 * ALB[b.id][1] * f * ph * 1.6); ps.position.copy(pp); ps.target.position.copy(ship); } else ps.intensity = 0; }

// 4) Newtonian flight and RCS puffs: small cold-gas jets fire at the nose whenever the ship turns or brakes
function rcs(dt, yawIn, pitIn, brake) { const sz = (R.shipStat || SHIPS[0]).sz, a = Math.abs(yawIn) + Math.abs(pitIn) + (brake ? 1 : 0); if (a < .12 || Math.random() > dt * 26 * Math.min(1, a)) return;
  const side = yawIn > .1 ? -1 : yawIn < -.1 ? 1 : (Math.random() < .5 ? -1 : 1), up = pitIn > .1 ? -1 : pitIn < -.1 ? 1 : 0;
  const p = R.ship.localToWorld(LIT.w.set(side * sz * .55, up * sz * .4, -sz * .45)), v = LIT.v.set(side * 7, up * 7, brake ? -9 : 0).applyQuaternion(R.ship.quaternion).add(R.vel);
  R.fx.emit(p, v, 0xeaf4ff, sz * .22, .28, 2, 1.2, { grow: 2.6, drag: .4, a: .7 }); }

// 2) Io's volcanoes from orbit: sulfur plumes in clean ballistic umbrellas (no air on Io), hundreds of km high
function ioPlumes(m, r) { const N = 900, seed = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) seed[i] = Math.random();
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const vents = [[.33, -1.2], [-.4, 2.1], [.05, .4], [.6, -2.6]], U = { time: { value: 0 }, r: { value: r } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 seed; uniform float time, r; varying float vA;
      void main(){ int k = int(seed.z * 3.999); vec2 v = k == 0 ? vec2(.33, -1.2) : k == 1 ? vec2(-.4, 2.1) : k == 2 ? vec2(.05, .4) : vec2(.6, -2.6);
        vec3 n = vec3(cos(v.x) * cos(v.y), sin(v.x), cos(v.x) * sin(v.y)), t1 = normalize(cross(n, vec3(0., 1., .01))), t2 = cross(n, t1);
        float T = 1., ph = fract(time / 9. + seed.x), a = seed.y * 6.2832, sp = .35 + .55 * fract(seed.x * 7.3);
        vec3 v0 = n * 1. + (t1 * cos(a) + t2 * sin(a)) * sp * .55; float tt = ph * 2.2; vec3 p = n * r * 1.002 + (v0 * tt - n * .5 * .9 * tt * tt) * r * .17;
        vA = (1. - ph) * smoothstep(0., .08, ph) * step(0., dot(p, n) - r); vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = clamp(r * 7. / -mv.z * 60., 1., 6.); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'varying float vA; void main(){ vec2 c = gl_PointCoord - .5; float a = smoothstep(.5, .1, length(c)) * vA; gl_FragColor = vec4(vec3(.72, .82, 1.) * 1.4, a * .55); }' });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; m.add(pts);
  for (const [la, lo] of vents) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,170,60,1)', 'rgba(255,60,0,.4)'), blending: THREE.AdditiveBlending, depthWrite: false })); s.position.set(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)).multiplyScalar(r * 1.01); s.scale.setScalar(r * .09); m.add(s); }   // glowing lava at each vent
  SPACEFX.push({ update(dt, t) { U.time.value = t; } }); }

// 5) Real constellations: 88 IAU constellations, their stick figures and the brightest named stars (data: d3-celestial, BSD licence),
//    drawn on the same sphere as NASA's Tycho star map, so the lines sit exactly on the real stars.
/* the Milky Way and nebula glow are many layers of 3D noise per pixel; render them once into a cube map and just sample it after */
function bakeSky(ren, sm, smat, hdr) { try { const sz = GFX === 'low' ? 512 : GFX === 'max' ? 2048 : 1024, rt = new THREE.WebGLCubeRenderTarget(sz, { type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cs = new THREE.Scene(), tmp = new THREE.Mesh(new THREE.SphereGeometry(50, 96, 48), smat); cs.add(tmp); const cc = new THREE.CubeCamera(.1, 200, rt); cc.update(ren, cs); tmp.geometry.dispose();
    sm.material = new THREE.ShaderMaterial({ uniforms: { cube: { value: rt.texture }, map: smat.uniforms.map }, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform samplerCube cube; varying vec3 vD; void main(){ gl_FragColor = vec4(textureCube(cube, normalize(vD)).rgb, 1.); }' });
  } catch (e) { console.warn('sky bake', e); } }
/* only touch the DOM when the text really changed (each write also wakes the icon observer) */
/* compile a new model's shaders in the background (parallel compile where the GPU driver supports it) so it doesn't hitch the frame it first appears in */
function pre(o, sc) { try { if (o && R && R.ren.compileAsync) R.ren.compileAsync(o, R.cam, sc || o).catch(() => {}); } catch (e) {} }
function setT(el, t) { if (el && el._t !== t) { el._t = t; el.textContent = t; } }
let STARSPHERE = null; const SKY = { g: null, on: false, busy: false };
const skyDir = (ra, de, r) => { const u = (.5 + ra / 360) % 1, v = .5 - de / 180, ph = u * Math.PI * 2, th = v * Math.PI; return new THREE.Vector3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).multiplyScalar(r); };
function skyLabel(txt, col, h) { const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = `700 ${h}px system-ui, sans-serif`; const w = Math.ceil(g.measureText(txt).width) + 12; c.width = w; c.height = h + 10; g.font = `700 ${h}px system-ui, sans-serif`; g.fillStyle = col; g.shadowColor = '#000'; g.shadowBlur = 4; g.fillText(txt, 6, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, fog: false })); s.scale.set(w / (h + 10) * 150, 150, 1); s.renderOrder = 2; return s; }
async function skyToggle() { if (!STARSPHERE) return; SKY.on = !SKY.on; if (SKY.g) { SKY.g.visible = SKY.on; } else if (SKY.on && !SKY.busy) { SKY.busy = true; try { const D = await (await fetch('models/sky/constellations.json')).json(); const g = new THREE.Group(), R0 = 9200, pts = [];
      for (const fig of D.lines) for (const line of fig) for (let i = 0; i < line.length - 1; i++) pts.push(skyDir(line[i][0], line[i][1], R0), skyDir(line[i + 1][0], line[i + 1][1], R0));
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: .45, depthWrite: false, fog: false })));
      for (const [n, ra, de] of D.cons) { const s = skyLabel(n.toUpperCase(), 'rgba(150,200,255,.85)', 34); s.position.copy(skyDir(ra, de, R0)); g.add(s); }
      for (const [n, ra, de] of D.stars) { const s = skyLabel(n, 'rgba(255,236,190,.95)', 28); s.scale.multiplyScalar(.75); s.position.copy(skyDir(ra, de, R0)).add(new THREE.Vector3(0, -95, 0)); g.add(s); }
      STARSPHERE.add(g); SKY.g = g; g.visible = SKY.on; } catch (e) { toast('⚠ Could not load the star chart'); SKY.on = false; } SKY.busy = false; }
  toast(SKY.on ? '✨ Star chart on: real constellations and star names (K to hide)' : '✨ Star chart off', 2200); }
/* realism pass 11: prominences, auroras, the comet, Saturn's ring chunks, and the Sun's heat as you get close */
const SPACEFX = [];
function spaceFX(dt) { if (!R.comet) { R.comet = makeComet(R.scn, R.bpos.sun); R.cometSeen = 0; }
  for (const f of SPACEFX) f.update(dt, R.t, f.ring ? R.ship.position : R.bpos.sun);
  R.comet.update(dt, R.cam); const cd = R.comet.pos.distanceTo(R.ship.position); if (cd < 260 && !R.cometSeen) { R.cometSeen = 1; toast('☄️ A comet! Its blue ion tail points straight away from the Sun; the dusty tail curves behind it.', 4500); say('Comet in sight.'); }
  // close to the Sun: heat glow at the screen edges, a shaking hull and a warning, before the shield limit
  const ds = R.ship.position.distanceTo(R.bpos.sun) - 60, heat = THREE.MathUtils.clamp(1 - (ds - 25) / 160, 0, 1), ov = R.root.querySelector('#aHeat') || (() => { const d = document.createElement('div'); d.id = 'aHeat'; R.root.appendChild(d); return d; })();
  if (!R.entry && !R.ending) { ov.classList.remove('w'); ov.style.opacity = (heat * heat * .8).toFixed(3); if (heat > .35) R.cam.position.add(tmpV.set((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)).multiplyScalar(heat * .12));
    if (heat > .5 && !R.heatW) { R.heatW = 1; toast('🌡️ Hull temperature rising: 1,370 °C. Parker Solar Probe survives this with a carbon heat shield.', 3500); } if (heat < .2) R.heatW = 0; } }
/* ---------------- launch from Earth, replays and postcards ---------------- */
let MEDIA = null;
function curScene() { return R.launch ? R.launch.scn : R.surf && R.surf.S.on ? R.surf.S.scn : R.scn; }
function placeInfo() { if (R.launch) return { title: 'Kennedy Space Center', sub: 'Launch Complex 39B · Florida', stamp: 'KSC' };
  const S = R.surf && R.surf.S; if (S && S.on && S.body) { const W = WORLD[S.body.id] || {}; return { title: S.body.n.replace(/^The /, ''), sub: S.mode === 'dive' ? 'Inside the clouds' : (S.site ? S.site.n : (W.site || 'Surface')), stamp: S.body.n.replace(/^The /, '') }; }
  let best = null, bd = 1e9; for (const b of BODIES) { if (b.id === 'sun') continue; const d = R.bpos[b.id].distanceTo(R.ship.position) - b.r; if (d < bd) { bd = d; best = b; } }
  if (best && bd < best.r * 5) { const km = realAlt(best, bd + best.r); return { title: best.n.replace(/^The /, ''), sub: 'In orbit' + (km ? ' · ' + fmtKm(km) + ' up' : ''), stamp: best.n.replace(/^The /, '') }; }
  const au = R.ship.position.distanceTo(R.bpos.sun) / 520; return { title: 'The Solar System', sub: au.toFixed(1) + ' AU from the Sun', stamp: 'Deep space' }; }
function media() { if (!MEDIA) MEDIA = makeMedia({ canvas: R.ren.domElement, render: () => draw(curScene()), place: placeInfo, toast, sfx, root: R.root, enabled: () => SET.rec !== 0, setEnabled: v => { SET.rec = v ? 1 : 0; P('adv_set', SET); } }); return MEDIA; }
function launchSeq(done) { if (R.launch) return; R.root.classList.add('cine'); const em = R.bmesh.earth, cl = em.userData.clouds;
  R.launch = makeLaunch({ cam: R.cam, root: R.root, loader: R.ship.userData.loader, fixMat, say, sfx, env: 1, starTex: () => R.starTex || (STARSPHERE && STARSPHERE.material.uniforms && STARSPHERE.material.uniforms.map.value), earthMap: em.material.uniforms ? em.material.uniforms.map.value : em.material.map,
    cloudMap: cl && cl.material.uniforms && cl.material.uniforms.useR.value ? cl.material.uniforms.map.value : null, audio: o => { try { AUD.set(o); } catch (e) {} },
    onDone: () => { R.launch = null; R.root.classList.remove('cine'); R.cam.fov = 60; R.cam.updateProjectionMatrix(); try { media().stop(400); AUD.set({ eng: 0, boost: 0, wind: 0, dt: .1 }); } catch (e) {} trophy('a_launch'); done && done(); } });
  try { media().start('Launch from Earth', { title: 'Kennedy Space Center', sub: 'Launch Complex 39B · Florida', stamp: 'KSC' }); } catch (e) {} }
/* ---------------- realism pass 15: how real spacecraft fly, orbit and come home ---------------- */
const UPRIGHT = { 'shuttle-orbiter': 0, lm: 0 };   // everything else stands on its engines / heat shield when landed
const CAPSULE = new Set(['orion', 'orion-capsule', 'gemini', 'apollo-soyuz']);
// entry attitude: capsules fly heat shield first, rockets tail first (engines toward the ground), the Shuttle belly first at 40° angle of attack
function entryAttitude(C, ship) { const id = (R.shipStat || SHIPS[0]).id;
  if (id === 'shuttle-orbiter') { const up = C.dir, t = tmpV.set(0, 1, 0).cross(up); if (t.lengthSq() < 1e-4) t.set(1, 0, 0); t.normalize(); const nose = t.clone().multiplyScalar(Math.cos(.7)).addScaledVector(up, Math.sin(.7)).normalize(), z = nose.clone().negate(), y = up.clone().addScaledVector(z, -up.dot(z)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
    ship.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); }
  else { ship.lookAt(C.c); ship.rotateZ(Math.sin(C.t * 1.7) * .05); } }   // +Z (heat shield / engine bell) faces the planet
function entryFX(C, heat, k, dt, sz, end) { const ship = R.ship;
  if (!C.glow) { C.glow = new THREE.PointLight(0xff6a20, 0, sz * 12, 2); R.scn.add(C.glow); }
  if (end) { R.scn.remove(C.glow); if (C.chute) { ship.remove(C.chute); C.chute = null; } if (C.bo) toast('📻 Signal reacquired. Mission Control hears you.', 1800); return; }
  // the plasma sheath glows on the hull from the side facing the planet
  C.glow.position.copy(ship.position).addScaledVector(C.dir, -sz * 1.4); C.glow.intensity = heat * 60;
  // radio blackout: the ionised gas around the ship blocks radio for a while
  if (C.air && heat > .55 && !C.bo) { C.bo = 1; toast('📻 Radio blackout: the plasma around the ship blocks every signal…', 2200); }
  // parachutes for capsules on worlds with air (drogues first, then the mains)
  const id = (R.shipStat || SHIPS[0]).id; if (C.air && C.kind !== 'dive' && CAPSULE.has(id) && k > .7) { if (!C.chute) { C.chute = chutes(sz); ship.add(C.chute); toast('🪂 Parachutes deployed', 1500); sfx('whoosh'); } const g = Math.min(1, (k - .7) / .12); C.chute.scale.setScalar(.2 + g * .8); C.chute.children.forEach((c, i) => { c.rotation.z = Math.sin(C.t * 2 + i) * .06; }); } }
function chutes(sz) { const g = new THREE.Group(), cv = document.createElement('canvas'); cv.width = 128; cv.height = 32; const x = cv.getContext('2d'); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f4f4f2' : '#e0542a'; x.fillRect(i * 16, 0, 16, 32); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: .9 }), lm = new THREE.LineBasicMaterial({ color: 0xd8d8d0, transparent: true, opacity: .7 });
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, c = new THREE.Group(), can = new THREE.Mesh(new THREE.SphereGeometry(sz * 1.5, 24, 8, 0, Math.PI * 2, 0, 1.1), m); can.position.y = 0; c.add(can);
    const pts = []; for (let j = 0; j < 8; j++) { const b = j / 8 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(b) * sz * 1.33, -sz * .45, Math.sin(b) * sz * 1.33), new THREE.Vector3(0, -sz * 5.2, 0)); } c.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lm));
    c.position.set(Math.cos(a) * sz * 1.3, sz * 5.6, Math.sin(a) * sz * 1.3); c.rotation.set(Math.sin(a) * .25, 0, -Math.cos(a) * .25); g.add(c); }
  g.rotation.x = -Math.PI / 2; return g; }   // chutes trail out of the top (−Z, the nose), away from the planet
// engine plume: in vacuum the exhaust spreads into a wide, faint, glowing bell; brighter and longer with boost
const PL2 = { m: null, u: null };
function plume(dt, thrust, boost) { const ship = R.ship, sz = (R.shipStat || SHIPS[0]).sz;
  if (!PL2.m) { PL2.u = { time: { value: 0 }, k: { value: 0 }, hot: { value: new THREE.Color(0xbfe0ff) } }; const geo = new THREE.CylinderGeometry(.18, 1, 1, 24, 8, true); geo.translate(0, -.5, 0); geo.rotateX(-Math.PI / 2);
    PL2.m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: PL2.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float time, k; uniform vec3 hot; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float along = 1. - vUv.y, edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.4), fl = .8 + .2 * sin(time * 40. + along * 30.);
          float a = k * (1. - along) * (1. - along) * edge * fl * .55; vec3 c = mix(hot, vec3(1.), (1. - along) * .6) * (1.2 + k);
          gl_FragColor = vec4(c, a); }` })); PL2.m.frustumCulled = false; }
  if (PL2.m.parent !== ship) ship.add(PL2.m); const t = thrust || boost ? (boost ? 1 : .55) : 0; PL2.u.k.value += (t - PL2.u.k.value) * Math.min(1, dt * 6); PL2.u.time.value = R.t; PL2.u.hot.value.setHex(boost ? 0xffd2a0 : 0xbfe0ff);
  const L = sz * (1.6 + 5 * PL2.u.k.value), W = sz * (.55 + .5 * PL2.u.k.value); PL2.m.scale.set(W, W, L); PL2.m.position.set(0, 0, sz * .95); PL2.m.visible = PL2.u.k.value > .02 && CAM.mode !== 'cockpit'; }
// gravity (Newtonian mode): near a world you are pulled toward it, so you can really orbit. A predicted path shows where you'll go.
const gS = b => 2.3 * Math.sqrt(b.r), soi = b => b.r * 8 + 40;
function gravity(dt) { const b = ORB.dom; if (!b || b.id === 'sun') return; const c = R.bpos[b.id], d = R.ship.position.distanceTo(c); if (d > soi(b)) return; R.vel.addScaledVector(tmpV.copy(c).sub(R.ship.position).normalize(), gS(b) * (b.r / d) ** 2 * dt); }
const OL = { line: null, t: 0, txt: '' };
function orbitLine(dt) { const b = ORB.dom, on = SET.newton && b && b.id !== 'sun' && !R.ap && R.bpos[b.id].distanceTo(R.ship.position) < soi(b);
  if (!OL.line) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3), 3)); OL.line = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0x7df9ff, dashSize: 1.2, gapSize: .8, transparent: true, opacity: .75, depthWrite: false })); OL.line.frustumCulled = false; R.scn.add(OL.line); }
  OL.line.visible = !!on; if (!on) { OL.txt = ''; return; } OL.t -= dt; if (OL.t > 0) return; OL.t = .25;
  const c = R.bpos[b.id], p = R.ship.position.clone().sub(c), v = R.vel.clone(), arr = OL.line.geometry.attributes.position.array, h = .12; let mn = 1e9, mx = 0, n = 0, hit = false;
  for (let i = 0; i < 400; i++) { const d = p.length(); mn = Math.min(mn, d); mx = Math.max(mx, d); arr[i * 3] = c.x + p.x; arr[i * 3 + 1] = c.y + p.y; arr[i * 3 + 2] = c.z + p.z; n = i + 1; if (d < b.r) { hit = true; break; } if (d > soi(b) * 1.3) break;
    for (let s2 = 0; s2 < 3; s2++) { const dd = p.length(); v.addScaledVector(p, -gS(b) * (b.r / dd) ** 2 / dd * h); p.addScaledVector(v, h); } }
  OL.line.geometry.setDrawRange(0, n); OL.line.geometry.attributes.position.needsUpdate = true; OL.line.computeLineDistances(); OL.line.material.color.setHex(hit ? 0xff6a5a : 0x7df9ff);
  const km = d => fmtKm(realAlt(b, d) || 0); OL.txt = hit ? ' · ⚠ IMPACT TRAJECTORY' : ` · Pe ${km(mn)} · Ap ${mx > soi(b) ? 'escape' : km(mx)}`; }
/* eye adaptation: like a real camera or a real eye, exposure drops when the Sun fills the view and opens up in a planet's shadow,
   where the stars and the Milky Way come out. Cheap: one ray test against each body per frame. */
const EXP = { v: 1.05, f: new THREE.Vector3(), s: new THREE.Vector3(), oc: new THREE.Vector3() };
function adapt(dt, sf) { let tg = sf && R.surfTg ? R.surfTg : 1.05; if (!sf && R.bpos && R.bpos.sun) { const cam = R.cam, f = EXP.f.set(0, 0, -1).applyQuaternion(cam.quaternion), s = EXP.s.copy(R.bpos.sun).sub(cam.position), ds = s.length(); s.divideScalar(ds); let vis = 1;
    for (const b of BODIES) { if (b.id === 'sun') continue; const oc = EXP.oc.copy(R.bpos[b.id]).sub(cam.position), t = oc.dot(s); if (t > 0 && t < ds && oc.lengthSq() - t * t < b.r * b.r * .96) { vis = 0; break; } }
    const glare = THREE.MathUtils.smoothstep(f.dot(s), .86, .995) * vis * Math.min(1, 900 / ds); tg = 1.05 * (1 - .4 * glare) * (vis ? 1 : 1.3); }
  EXP.v += (tg - EXP.v) * (1 - Math.exp(-dt * (tg < EXP.v ? 2.4 : .8))); R.ren.toneMappingExposure = EXP.v; }
/* ---------------- realism pass 17: light shafts, heat shimmer, eyes that adjust ---------------- */
const EFX = { v: new THREE.Vector3(), f: new THREE.Vector3(), d: new THREE.Vector3() };
function envFX(dt, sf) { const cu = R.cine.uniforms, ry = R.rays; let heat = 0, rk = 0; R.surfTg = 0;
  if (sf) { const S = R.surf.S, id = S.body && S.body.id, U = S.skyU, dl = S.dl;
    if (id && dl && S.mode !== 'dive') { const sd = U ? EFX.d.copy(U.sd.value) : EFX.d.copy(dl.position).sub(dl.target.position).normalize(), e = sd.y, day = U ? THREE.MathUtils.smoothstep(e, -.04, .12) : Math.min(1, dl.intensity / 2.6);
      const f = EFX.f.set(0, 0, -1).applyQuaternion(R.cam.quaternion), look = THREE.MathUtils.smoothstep(f.dot(sd), .78, .99) * day;
      // eyes and cameras adjust: squint toward the Sun, open up in the dark (but night stays night)
      R.surfTg = 1.05 * (1 - .32 * look) * (1 + (U ? .38 : .15) * (1 - day));
      heat = id === 'venus' ? .9 : id === 'earth' ? .16 * THREE.MathUtils.smoothstep(e, .3, .85) : id === 'titan' ? .05 : 0;
      const air = U ? ({ earth: .95, mars: .8 }[id] || 0) : 0;
      if (air > 0 && day > 0 && GFX !== 'low') { const sp = EFX.v.copy(sd).multiplyScalar(3000).add(R.cam.position).project(R.cam);
        if (sp.z < 1) { const on = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(sp.x), Math.abs(sp.y)), 1.05, 1.9), low = 1 - .6 * THREE.MathUtils.smoothstep(e, .1, .6);
          rk = air * day * on * low * (1 + ((S.storm && S.storm.k) || 0) * 1.5); ry.uniforms.sun.value.set(sp.x * .5 + .5, sp.y * .5 + .5);
          if (id === 'mars') ry.uniforms.col.value.setRGB(.62, .78, 1).lerp(new THREE.Color(1, .72, .45), THREE.MathUtils.smoothstep(e, .15, .6));   /* Mars: the sky around a low Sun glows blue */
          else ry.uniforms.col.value.setRGB(1, .82, .6).lerp(new THREE.Color(1, .97, .9), THREE.MathUtils.smoothstep(e, .1, .6)); } } } }
  if (R.launch && R.launch.heat) { const h = R.launch.heat; cu.heatL.value.set(h.x, h.y, h.k); } else cu.heatL.value.z = 0;
  cu.heat.value += (heat - cu.heat.value) * Math.min(1, dt * 2); ry.uniforms.k.value += (rk - ry.uniforms.k.value) * Math.min(1, dt * 3); ry.enabled = ry.uniforms.k.value > .01; }
function draw(sc) { R.rp.scene = sc; /* shadows: refresh every 2nd frame (every 3rd on Low); the sun barely moves between frames */ R.fr = (R.fr || 0) + 1; R.ren.shadowMap.needsUpdate = R.fr % (R.shEvery || (GFX === 'max' ? 1 : GFX === 'low' ? 3 : 2)) === 0; R.cine.uniforms.time.value = performance.now() / 1000 % 100; R.comp.render(); }
function setGfx(g) { GFX = g; P('adv_gfx', g); Q = g === 'max' ? 'ultra' : 'high'; DR.s = 1; DR.cool = 6; DR.changes = 0; R.ren.setPixelRatio(dprCap()); [R.comp.renderTarget1, R.comp.renderTarget2].forEach(t => { t.samples = R_HDR ? PRE().msaa : 0; t.dispose(); }); R.bloom.strength = PRE().bloom; resize(); R.root.querySelector('#aQ').innerHTML = '⚙<span class="lb"> ' + PRE().n + '</span>'; R.scn.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
function settings() { const p = document.createElement('div'); p.className = 'pnl'; const opt = (k, v, l) => `<button data-${k}="${v}" class="${String((k === 'g' ? GFX : SET[k])) === String(v) ? 'sel' : ''}">${l}</button>`;
  p.innerHTML = `<div class="crd"><div class="ey">⚙ GRAPHICS</div><h2>Settings</h2><div class="mt">Like Genshin: lower settings run smoother and cooler on phones. Max is for strong phones and PCs.</div>
  <h4 class="sh">QUALITY PRESET</h4><div class="seg">${Object.entries(PRESETS).map(([k, v]) => opt('g', k, v.n)).join('')}</div>
  <h4 class="sh">FRAME RATE</h4><div class="seg">${[30, 45, 60].map(v => opt('cap', v, v + ' FPS')).join('')}</div>
  <h4 class="sh">RENDER RESOLUTION · <span id="rsV">${SET.scale}%</span></h4><input type="range" id="rs" min="50" max="100" step="5" value="${SET.scale}" style="width:100%">
  <h4 class="sh">LAUNCH FROM EARTH</h4><div class="seg">${opt('launch', 1, 'Every journey')}${opt('launch', 0, 'Off')}</div>
  <h4 class="sh">AUTO-RECORD HIGHLIGHTS</h4><div class="seg">${opt('rec', 1, 'On')}${opt('rec', 0, 'Off')}</div>
  <h4 class="sh">FLIGHT PHYSICS</h4><div class="seg">${opt('newton', 0, 'Assisted')}${opt('newton', 1, 'Newtonian (real)')}</div>
  <h4 class="sh">MOVING PLANETS</h4><div class="seg">${opt('orb', 1, 'Orbiting')}${opt('orb', 0, 'Frozen')}</div>
  <h4 class="sh">SHOW FPS COUNTER</h4><div class="seg">${opt('fps', 0, 'Off')}${opt('fps', 1, 'On')}</div>
  <h4 class="sh">MISSION CONTROL VOICE</h4><div class="seg">${opt('voice', 0, 'Off')}${opt('voice', 1, 'On')}</div>
  <div class="mt" style="margin-top:10px">${PRE().n}: up to ${(PRE().tris / 1e6).toFixed(1)} M full-detail triangles and ${PRE().tex} MB of model textures at once. Everything farther away uses light versions.</div>
  <div class="row"><button class="pr" id="stX">Done</button></div></div>`;
  R.root.appendChild(p); const save2 = () => P('adv_set', SET);
  p.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { setGfx(b.dataset.g); p.remove(); settings(); });
  p.querySelectorAll('[data-cap]').forEach(b => b.onclick = () => { SET.cap = +b.dataset.cap; save2(); p.remove(); settings(); });
  p.querySelectorAll('[data-fps]').forEach(b => b.onclick = () => { SET.fps = +b.dataset.fps; save2(); p.remove(); settings(); }); p.querySelectorAll('[data-launch]').forEach(b => b.onclick = () => { SET.launch = +b.dataset.launch; save2(); p.remove(); settings(); }); p.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => { SET.rec = +b.dataset.rec; save2(); p.remove(); settings(); }); p.querySelectorAll('[data-newton]').forEach(b => b.onclick = () => { SET.newton = +b.dataset.newton; save2(); p.remove(); settings(); }); p.querySelectorAll('[data-orb]').forEach(b => b.onclick = () => { SET.orb = +b.dataset.orb; save2(); p.remove(); settings(); }); p.querySelectorAll('[data-voice]').forEach(b => b.onclick = () => { SET.voice = +b.dataset.voice; save2(); p.remove(); settings(); if (SET.voice) say('Voice callouts on.', 1); });
  p.querySelector('#rs').oninput = e => { SET.scale = +e.target.value; p.querySelector('#rsV').textContent = SET.scale + '%'; }; p.querySelector('#rs').onchange = () => { save2(); DR.s = 1; R.ren.setPixelRatio(dprCap()); resize(); };
  p.querySelector('#stX').onclick = () => p.remove(); }
function loop(t) { if (!ST.on) return; if (SET.cap < 60 && R.last && t - R.last < 1000 / SET.cap - 3) { requestAnimationFrame(loop); return; } const dt = Math.min(.05, Math.max(0, (t - (R.last || t)) / 1000)); fpsUI(dt); R.ren.info.reset(); padAdv(dt); try { coStep(dt); } catch (e) {} R.last = t; if (R.lost) { requestAnimationFrame(loop); return; } dynRes(dt); const pnl = R.root.querySelector('.pnl'), sf = R.surf && R.surf.S.on;
  try {   // one bad frame must never freeze the game: report it and keep the loop alive
  if (sf) { if (!pnl) { if (R.surf.S.launch) { R.surf.step(dt, {}); } else surfStep(dt); if (R.surf.S.scn) draw(R.surf.S.scn); } }
  else if (R.launch) { R.launch.step(dt); if (R.launch) draw(R.launch.scn); }
  else if (R.ending) { stepEnding(dt); draw(R.scn); }
  else if (R.intro) { stepIntro(dt); draw(R.scn); }
  else if (R.entry) { stepEntry(dt); draw(R.scn); }
  else { if (!pnl) { step(dt); const b = nearBody(), lb = R.root.querySelector('#aLand'), k = b ? (DIVE[b.id] ? 'dive' : WORLD[b.id] ? 'land' : null) : null; lb.style.display = k && !R.ap ? 'block' : 'none'; if (k) setT(lb, k === 'dive' ? '🌀 DIVE INTO ' + b.n.toUpperCase() : '🛬 LAND ON ' + b.n.toUpperCase()); draw(R.scn); } }
  } catch (e) { if (!loop.errN || loop.errN < 5) { loop.errN = (loop.errN || 0) + 1; console.error('Adventure frame error:', e); } }
  try { envFX(dt, sf); adapt(dt, sf); if (TOURA) tourStep(dt, sf); } catch (e) {} requestAnimationFrame(loop); }
/* ---------------- resource download (like a game launcher): store every NASA model on the device before playing ---------------- */
const MC = 'rdo-models-2', isApp = !!(window.Capacitor && (!window.Capacitor.isNativePlatform || window.Capacitor.isNativePlatform()));
const DLV = 78;
function needDL() { if (isApp || !('caches' in window) || open.skipDL) return false; const d = G('adv_dl', null); return !d || d.v !== DLV; }
function resPanel(done, fromGame) {
  const o = document.createElement('div'); o.id = 'advDL'; o.innerHTML = `<style>#advDL{position:fixed;inset:0;z-index:99999;background:radial-gradient(ellipse at 50% 30%,#14204a,#02040c 70%);color:#eaf2ff;font:14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:16px}
  #advDL .c{width:min(520px,94vw);background:rgba(10,16,36,.85);border:1px solid rgba(125,249,255,.35);border-radius:18px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.6)}#advDL h2{margin:2px 0 6px;font-size:22px}#advDL .ey{font:700 10px system-ui;letter-spacing:.16em;color:#7df9ff}
  #advDL .mt{font-size:12px;color:#b9c8de;line-height:1.45}#advDL .opt{display:grid;gap:8px;margin:12px 0}#advDL button{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:12px;padding:11px 14px;font:700 14px system-ui;text-align:left;cursor:pointer}
  #advDL button.pr{background:linear-gradient(180deg,#3aa0e8,#1f6fb8);border-color:#7df9ff}#advDL button small{display:block;font-weight:500;opacity:.8;font-size:11px;margin-top:2px}#advDL .bar{height:12px;border-radius:8px;background:rgba(255,255,255,.1);overflow:hidden;margin:12px 0 6px}#advDL .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#7df9ff,#ffcf4a);transition:width .25s}
  #advDL .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}</style><div class="c"><div class="ey">🚀 ADVENTURE MODE · RESOURCES</div><h2>Download NASA resources</h2><div class="mt" id="dlT">Loading the file list…</div><div id="dlB"></div></div>`;
  document.body.appendChild(o); const $ = q => o.querySelector(q), mb = b => (b / 1048576).toFixed(b > 1e8 ? 0 : 1) + ' MB';
  fetch('models/manifest.json', { cache: 'no-store' }).then(r => r.json()).then(async M => {
    const cache = await caches.open(MC), uniq = L => { const seen = new Set(); return L.filter(x => !seen.has(x[0]) && seen.add(x[0])); };
    const light = uniq([...M.base, ...(M.hd || []), ...M.lod, ...M.core]), full = uniq([...M.base, ...(M.hd || []), ...M.lod, ...M.full]), sum = L => L.reduce((a, x) => a + x[1], 0);
    let have = 0; for (const [p] of full) if (await cache.match(p)) have++;
    $('#dlT').innerHTML = `${G('adv_dl', null) ? '<b style="color:#ffcf4a">🆕 New: the HD Realism Pack</b> (NASA\'s real Earth clouds, ocean and relief maps, real sky reflections, water, lava and the NASA Perseverance rover). Download it before your journey.<br>' : ''}Store every NASA 3D model on this device once, so Adventure Mode loads instantly and plays smoothly, even offline.${have ? `<br><b>${have} of ${full.length} files are already on this device.</b>` : ''}<br><span style="opacity:.75">Use Wi-Fi for the full pack. You can always download more later from ⬇ in Adventure Mode.</span>`;
    $('#dlB').innerHTML = `<div class="opt"><button class="pr" id="dF">⬇ Full pack · best quality<small>Every model in full detail · ${mb(sum(full))} · ${full.length} files</small></button><button id="dL">⬇ Light pack · fast start<small>Light versions of every model, plus the ships and aircraft · ${mb(sum(light))}. Full detail streams in when you fly close.</small></button><button id="dS">▶ Skip, stream while playing<small>Uses the least storage. Models load as you fly near them.</small></button></div>`;
    const finish = (pack) => { if (pack) P('adv_dl', { v: DLV, pack }); o.remove(); done && done(); };
    $('#dS').onclick = () => { open.skipDL = 1; finish(null); };
    const run = async (L, pack) => { let doneB = 0, doneN = 0, fail = 0, stop = false; const tot = sum(L), t0 = performance.now();
      $('#dlB').innerHTML = `<div class="bar"><i></i></div><div class="mt" id="dlP">Starting…</div><div class="row" style="margin-top:12px"><button id="dX">Play now (keeps downloading in this session)</button></div>`;
      $('#dX').onclick = () => { stop = 'play'; finish(null); };
      const upd = () => { const el = performance.now() - t0, sp = doneB / Math.max(.5, el / 1000), left = (tot - doneB) / Math.max(1, sp); $('.bar i').style.width = (doneB / tot * 100).toFixed(1) + '%'; $('#dlP').textContent = `${(doneB / tot * 100).toFixed(0)}% · ${mb(doneB)} of ${mb(tot)} · ${doneN}/${L.length} files · ${mb(sp)}/s · about ${left > 90 ? Math.ceil(left / 60) + ' min' : Math.ceil(left) + ' s'} left${fail ? ' · ' + fail + ' to retry' : ''}`; };
      let i = 0; const worker = async () => { while (i < L.length && stop !== 'abort') { const [p, sz] = L[i++];
          try { if (!(await cache.match(p))) { let r = await fetch(p); if (!r.ok || /text\/html/.test(r.headers.get('content-type') || '')) { const pj = p.replace(/\.glb$/, '.json'); if (pj !== p) { r = await fetch(pj); if (r.ok) await cache.put(pj, r); else fail++; } else fail++; } else await cache.put(p, r); } } catch (e) { fail++; }
          doneB += sz; doneN++; if (o.isConnected) upd(); } };
      await Promise.all(Array.from({ length: 6 }, worker)); if (stop === 'play') { P('adv_dl', { v: DLV, pack }); return; }
      $('.bar i').style.width = '100%'; $('#dlP').innerHTML = `<b>✅ Download complete.</b> ${mb(tot)} stored on this device${fail ? ` (${fail} files could not be downloaded and will stream instead)` : ''}.`;
      $('.row').innerHTML = '<button class="pr" id="dGo">🚀 Launch Adventure</button>'; $('#dGo').onclick = () => finish(pack); };
    $('#dF').onclick = () => run(full, 'full'); $('#dL').onclick = () => run(light, 'light');
  }).catch(() => { $('#dlT').textContent = 'Resources are built into this version, so no download is needed.'; $('#dlB').innerHTML = '<div class="row" style="margin-top:12px"><button class="pr" id="dGo">🚀 Launch</button></div>'; $('#dGo').onclick = () => { open.skipDL = 1; o.remove(); done && done(); }; });
}
function open() { if (ST.on) return; try { AUD.start(); } catch (e) {} if (needDL()) { resPanel(() => open()); return; } if (!open.ok) { PROBE.then(() => { open.ok = 1; open(); }); return; } window.ADV_ON = true; if (!R) build(); R.root.style.display = 'block'; ST.on = true; resize(); misUI(); R.last = 0; requestAnimationFrame(loop); const after = () => { if (TOURA) return tourMars(); if (!open.shown) { open.shown = 1; openingShot(); } else if (!G('adv_seen', 0)) intro(); }; if (SET.launch !== 0 || TOURA) launchSeq(after); else after(); }
function close() { try { AUD.stop(); } catch (e) {} try { coLeave(true); } catch (e) {} ST.on = false; window.ADV_ON = false; if (R) { R.root.style.display = 'none'; R.keys = {}; R.thr = R.bst = 0; } try { if (typeof title === 'function') title(); } catch (e) {} }
/* ---------------- judge's tour: the SLS launch, then a landing on Mars and a short walk, then a thank-you card ---------------- */
let TOURA = null;
function tour(cb) { TOURA = { cb, t: 0, st: 0 }; open.skipDL = 1; open.shown = 1; try { P('adv_seen', 1); } catch (e) {} open(); tourChip('4 of 5 · Launch from Earth on NASA’s SLS'); }
function tourChip(t) { if (!R) return; let c = R.root.querySelector('#aTour'); if (!c) { c = document.createElement('div'); c.id = 'aTour'; c.style.cssText = 'position:absolute;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translateX(-50%);z-index:12;display:flex;gap:8px;align-items:center;background:rgba(6,10,24,.78);border:1px solid rgba(125,249,255,.35);border-radius:999px;padding:5px 6px 5px 14px;font:600 12px var(--disp,system-ui);color:#e8f4ff;white-space:nowrap;max-width:94vw';
    c.innerHTML = '<span></span><button style="border:0;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font:700 11px var(--disp,system-ui);padding:5px 10px">Exit tour</button>'; c.querySelector('button').onclick = () => tourEnd(true); R.root.appendChild(c); } c.querySelector('span').textContent = 'Judge’s tour · ' + t; }
async function tourMars() { const b = BI.mars; if (!b || !TOURA) return tourEnd(); TOURA.st = 1; TOURA.t = 0; tourChip('5 of 5 · Entry, descent and landing on Mars');
  const site = (SITES.mars || []).find(s => s.id === 'jezero') || (SITES.mars || [])[0] || null; try { if (site) await loadDEM(site); } catch (e) {} if (!TOURA) return;
  try { orbitStep(); orbitStep(); } catch (e) {}   /* the planets kept moving during the launch: catch up first */
  const c = R.bpos.mars, B = b.r, away = R.bpos.phobos ? c.clone().sub(R.bpos.phobos).setY(0).normalize() : new THREE.Vector3(1, 0, 1).normalize(); R.ship.position.copy(c).addScaledVector(away, B + 6).add(new THREE.Vector3(0, 3, 0));   /* on the far side from Phobos, so its gravity doesn't carry the ship off */ R.vel.set(0, 0, 0); R.ap = null; lookAtYP(c); R.site = site;   /* same approach the Adventure demo uses */
  setTimeout(() => { try { if (TOURA) landOrLaunch.go(); } catch (e) { tourEnd(); } }, 300); }
function tourStep(dt, sf) { const T = TOURA; T.t += dt; if (T.st === 1 && sf && R.surf.S.on && !R.entry) { T.st = 2; T.t = 0; tourChip('5 of 5 · Walking on Mars, real NASA terrain'); }
  if (T.st === 2) { R.joy.y = T.t > 1.5 && T.t < 9 ? -.7 : 0; R.joy.x = T.t > 4 && T.t < 6 ? .35 : 0; if (T.t > 12) { T.st = 3; R.joy.x = R.joy.y = 0; tourCard(); } } }
function tourCard() { const o = document.createElement('div'); o.className = 'pnl'; o.innerHTML = `<div class="crd"><div class="ey">RED DUST OUTPOST · MOON PRODUCTIONS</div><h2>Thank you for playing</h2><div class="mt">Every world in the game uses real NASA data: gravity, temperatures, day lengths, radiation, sunlight, terrain and spacecraft models (NASA 3D Resources). Story mode and Adventure mode are both waiting for you.</div><div class="row"><button class="pr" id="tcX">Back to the title</button></div></div>`;
  R.root.appendChild(o); o.querySelector('#tcX').onclick = () => tourEnd(); setTimeout(() => { if (TOURA) tourEnd(); }, 12000); }
function tourEnd(skip) { const T = TOURA; if (!T) return; TOURA = null; try { const c = R.root.querySelector('#aTour'); if (c) c.remove(); R.root.querySelectorAll('.pnl').forEach(p => p.remove()); if (R.launch) R.launch.finish(true); } catch (e) {} R.joy.x = R.joy.y = 0; close(); open.skipDL = 0; if (T.cb) setTimeout(() => T.cb(skip), 50); }
window.ADV = { tour, open, close, goto: id => goto(id), count: () => ST.scanned.size, total: ALL.length, _R: () => R, _CO: () => CO, toast: (m) => R && toast(m), trophyToast };
export { open, close };
