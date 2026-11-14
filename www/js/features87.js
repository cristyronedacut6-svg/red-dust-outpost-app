/* Red Dust Outpost · v87: Mission Control hub, interactive science scanning, and walking inside the outpost.
   Uses only what the game already tracks (missions, crew, stars, research, achievements) plus one new saved list:
   the science discoveries you scanned ('rdo2-scodex'). No existing save data is changed. */
(function () {
  'use strict';
  if (typeof show !== 'function' || typeof update !== 'function') return;
  const $q = s => document.querySelector(s), esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ic = (n, s) => (window.UI86 && UI86.ic) ? UI86.ic(n, s) : '';
  const nowT = () => (typeof TT === 'number' ? TT : performance.now() / 1000);

  /* ================= 1) SCIENCE SCANNING ================= */
  // Six real discoveries per world. Each fact matches published mission results (see SCIENCE.md).
  const SCI = [
    [['anorth', 'Anorthosite', 'Bright highland rock made mostly of one mineral, plagioclase feldspar. It formed when the young Moon was covered by an ocean of magma. Apollo 15 brought home a famous piece, the “Genesis Rock”.'],
     ['basalt', 'Mare basalt', 'Dark volcanic rock. Lava flooded the Moon’s giant impact basins more than 3 billion years ago, making the dark patches you can see from Earth.'],
     ['ilmen', 'Ilmenite', 'An iron and titanium mineral. Heating it with hydrogen releases oxygen, so it could one day give a Moon base air to breathe.'],
     ['glass', 'Orange volcanic glass', 'Tiny orange glass beads sprayed out by ancient fire-fountain eruptions. Apollo 17 astronaut Harrison Schmitt found them at Shorty crater.'],
     ['ice', 'Water ice in shadow', 'Ice hiding in craters that never see sunlight. In 2009 NASA’s LCROSS mission crashed into Cabeus crater and detected water in the plume.'],
     ['breccia', 'Impact breccia', 'Broken rock pieces welded together by the heat and pressure of meteorite impacts. Most rocks from the lunar highlands are breccias.']],
    [['hema', 'Hematite “blueberries”', 'Small round iron-oxide spheres. NASA’s Opportunity rover found them everywhere at Meridiani Planum. They formed in water soaking through the ground.'],
     ['jaro', 'Jarosite', 'A yellowish mineral that only forms in acidic water. Opportunity’s find was one of the first strong signs that liquid water once existed on Mars.'],
     ['perch', 'Perchlorate salts', 'Salts found in Martian soil by the Phoenix lander in 2008. They are toxic to people, so future crews will have to wash them out of soil before growing food.'],
     ['mbas', 'Basalt', 'Dark volcanic rock. Most of the Martian surface is basalt, and its dust gives Mars its red colour once the iron in it rusts.'],
     ['clay', 'Clay minerals', 'Clays form when rock sits in water for a long time. Curiosity drilled into clay-rich mudstone in Gale crater, from an ancient lake that could have supported life.'],
     ['gyps', 'Gypsum veins', 'Bright white veins of calcium sulfate that filled cracks as water flowed through the rock. Curiosity photographed many of them in Gale crater.']],
    [['hollow', 'Hollows', 'Bright, shallow pits found only on Mercury. MESSENGER discovered them. They may form when material inside the rock turns to gas in the fierce sunlight and escapes.'],
     ['lrm', 'Low-reflectance material', 'Dark ground that MESSENGER showed is rich in carbon, probably graphite left over from Mercury’s first crust.'],
     ['sulf', 'Sulfur-rich ground', 'MESSENGER measured surprisingly high amounts of sulfur on Mercury’s surface, a clue that the planet formed with little oxygen.'],
     ['plains', 'Volcanic plains', 'Smooth plains made by floods of lava billions of years ago. They cover about a quarter of the planet.'],
     ['pice', 'Polar ice', 'Water ice in craters near the poles that never see sunlight, confirmed by MESSENGER, even though Mercury is the planet closest to the Sun.'],
     ['melt', 'Impact melt', 'Rock that melted in giant impacts and then froze again into glassy sheets inside craters.']],
    [['wice', 'Water ice', 'Europa’s shell is made of water ice, probably several kilometres to tens of kilometres thick, floating on a salty ocean.'],
     ['nacl', 'Sea salt', 'Telescopes found sodium chloride, ordinary table salt, on Europa’s surface in 2019. Jupiter’s radiation stains it yellow. It may come from the ocean below.'],
     ['msulf', 'Hydrated salts', 'The reddish-brown lines on Europa contain salts mixed with water ice, seen by NASA’s Galileo spacecraft. They may have risen from the ocean through cracks.'],
     ['sacid', 'Sulfuric acid hydrate', 'Sulfur blasted out of Io’s volcanoes travels along Jupiter’s magnetic field and hits Europa, turning into sulfuric acid frozen in the ice.'],
     ['h2o2', 'Hydrogen peroxide', 'Radiation splits water ice into oxygen-rich chemicals like hydrogen peroxide. If they reach the ocean, they could be food for life.'],
     ['chaos', 'Chaos block', 'A raft of ice that broke off, tilted and froze again. Areas like Conamara Chaos suggest warm ice or water close to the surface.']],
    [['cob', 'Water-ice cobbles', 'Rounded pebbles of water ice, hard as rock at −179 °C. The Huygens probe photographed them when it landed in 2005. Their round shape means liquid once rolled them.'],
     ['thol', 'Tholins', 'Orange-brown organic particles made high in the air when sunlight breaks up methane and nitrogen. They drift down and coat the ground.'],
     ['dune', 'Organic dune sand', 'Titan’s huge dunes are made of dark grains of hydrocarbons, not rock. Cassini’s radar mapped dune fields hundreds of kilometres long.'],
     ['damp', 'Methane-damp ground', 'Huygens landed on damp ground: when the warm probe heated the soil, methane gas came out of it, like steam from wet sand.'],
     ['evap', 'Lake-shore deposits', 'Bright crusts left around lakes when liquid methane and ethane evaporate, like salt flats on Earth. Cassini found them near Titan’s lakes.'],
     ['river', 'River channel', 'Huygens photographed branching channels carved by flowing methane. Titan is the only other world we know with rivers and rain today.']],
    [['natc', 'Sodium carbonate', 'The bright spots in Occator crater are sodium carbonate, a salt left when salty water reached the surface and evaporated. NASA’s Dawn found it.'],
     ['amclay', 'Ammonia-rich clay', 'Dawn found clays containing ammonia across Ceres. Ammonia is common far from the Sun, so Ceres may have formed farther out and moved inward.'],
     ['cice', 'Exposed water ice', 'Dawn spotted fresh water ice on the walls of the small crater Oxo. Ceres may be about a quarter water by mass.'],
     ['org', 'Organic compounds', 'Dawn detected carbon-rich organic material near Ernutet crater, a building block that matters for the chemistry of life.'],
     ['hydro', 'Hydrohalite', 'A salty ice that breaks down quickly in sunlight. Finding it in Occator crater means brine reached the surface very recently.'],
     ['carb', 'Carbonaceous rock', 'Dark rock rich in carbon, like the carbonaceous chondrite meteorites that fall to Earth.']]];
  window.SCI87 = SCI;
  const codex = () => { try { return LS.get('scodex', {}) || {}; } catch (e) { return {}; } };
  function sites() {
    if (!S || S.lv > 5 || !SCI[S.lv]) return null; if (S.ssite && S.ssite.lv === S.lv) return S.ssite.L;
    const c = S.b.find(b => b.t === 'core'); if (!c) return null; let sd = 101 + S.lv * 977; const r = () => (sd = sd * 16807 % 2147483647) / 2147483647, L = [], cx = c.x + 16, cy = c.y + 16;
    for (let i = 0, g = 0; i < 6 && g < 400; g++) { const a = r() * Math.PI * 2, d = 150 + r() * 360, x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * .8);
      if (x < 40 || y < 60 || x > WW - 40 || y > WH - 40) continue; if (L.some(q => Math.hypot(q.x - x, q.y - y) < 120)) continue; if (S.b.some(b => Math.hypot(b.x + 8 - x, b.y + 8 - y) < 40)) continue; L.push({ x, y, i: i++ }); }
    S.ssite = { lv: S.lv, L }; return L;
  }
  const near = () => { const L = sites(); if (!L || !S.p || S.drive || S.land > 0) return null; const cd = codex(); let best = null, bd = 34; for (const q of L) { const id = SCI[S.lv][q.i][0]; if (cd[S.lv + ':' + id]) continue; const d = Math.hypot(q.x - S.p.x, q.y - S.p.y); if (d < bd) { bd = d; best = q; } } return best; };
  // drawn into the ground in every view (the 2D canvas and the 3D ground decals both call drawPOIs)
  function drawScans() {
    const L = S && sites(); if (!L || typeof G === 'undefined' || !G) return; const cd = codex(), t = nowT();
    for (const q of L) { const done = cd[S.lv + ':' + SCI[S.lv][q.i][0]], x = q.x, y = q.y;
      G.save(); G.lineWidth = 1.5;
      if (done) { G.strokeStyle = 'rgba(101,201,138,.7)'; G.beginPath(); G.ellipse(x, y, 9, 6, 0, 0, 7); G.stroke(); G.fillStyle = '#65c98a'; G.fillRect(x - 1, y - 12, 2, 12); G.fillRect(x + 1, y - 12, 5, 3); }
      else { const p = (t * .8 + q.i * .17) % 1; G.strokeStyle = `rgba(85,214,232,${.85 - p * .7})`; G.beginPath(); G.ellipse(x, y, 6 + p * 14, (6 + p * 14) * .62, 0, 0, 7); G.stroke();
        G.fillStyle = 'rgba(0,0,0,.35)'; G.beginPath(); G.ellipse(x, y + 2, 7, 3, 0, 0, 7); G.fill(); G.fillStyle = '#b9c4cf'; G.fillRect(x - 4, y - 2, 4, 3); G.fillRect(x + 1, y - 3, 3, 4); G.fillStyle = '#55d6e8'; G.fillRect(x - 1, y - 4 - (Math.floor(t * 3) % 2), 2, 2);
        const sc = S.scan && S.scan.q === q ? S.scan.k : 0; if (sc > 0) { G.strokeStyle = '#55d6e8'; G.lineWidth = 2.5; G.beginPath(); G.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + sc * Math.PI * 2); G.stroke(); } }
      G.restore(); }
  }
  if (typeof drawPOIs === 'function') { const p0 = drawPOIs; window.drawPOIs = drawPOIs = function () { p0.apply(this, arguments); try { drawScans(); } catch (e) {} }; }
  let SB = null;
  function scanBtn() { if (SB) return SB; SB = document.createElement('button'); SB.id = 'u-scanB'; SB.className = 'ui'; SB.hidden = true; SB.innerHTML = `${ic('target', 18)}<span>SCAN</span><i></i><small>H</small>`; SB.setAttribute('aria-label', 'Scan the science site');
    const go = e => { e.preventDefault(); startScan(); }; SB.addEventListener('pointerdown', go); $q('#stage').appendChild(SB); return SB; }
  function startScan() { const q = near(); if (!q || !S.run || S.pz) return; if (S.scan && S.scan.q === q) return; S.scan = { q, k: 0 }; if (typeof snd === 'function') snd('ui'); }
  function finishScan(q) {
    const e = SCI[S.lv][q.i], cd = codex(); cd[S.lv + ':' + e[0]] = 1; try { LS.set('scodex', cd); } catch (er) {}
    try { addRP(2); } catch (er) {} try { addXP(15, q.x, q.y); } catch (er) {} if (typeof snd === 'function') snd('star', 2);
    let c = $q('#u-disc'); if (!c) { c = document.createElement('div'); c.id = 'u-disc'; c.className = 'ui'; c.setAttribute('aria-live', 'polite'); $q('#stage').appendChild(c); }
    const n = SCI[S.lv].filter(x => cd[S.lv + ':' + x[0]]).length;
    c.innerHTML = `<div class="u-dk">${ic('flask', 14)}<span>New discovery</span> · <span>${n} of 6 on ${esc(S.L.n)}</span></div><b>${esc(e[1])}</b><p>${esc(e[2])}</p><small><span>+2 research</span> · +15 XP · <span>Saved in Mission Control</span></small>`;
    c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); clearTimeout(c._t); c._t = setTimeout(() => c.classList.remove('on'), 9000);
    try { ach('scan1'); } catch (er) {} if (n === 6) { try { say(`Every science site on ${S.L.n} is scanned. Full survey complete!`); addRP(3); ach('survey'); } catch (er) {} }
    try { const all = SCI.reduce((a, L, i) => a + L.filter(x => cd[i + ':' + x[0]]).length, 0); if (all >= 36) ach('sci36'); } catch (er) {}
  }
  function scanStep(dt) {
    if (!S || !S.run) return; const b = scanBtn(), q = near(), ok = q && !S.pz && S.land <= 0 && !S.drive; b.hidden = !ok && !(S.scan && S.scan.k > 0);
    const sc = S.scan; if (sc) { if (!S.p || Math.hypot(sc.q.x - S.p.x, sc.q.y - S.p.y) > 40 || S.drive) { S.scan = null; S.scanT = 0; }
      else if (!S.pz) { sc.k += dt / 2.2; S.scanT = .2; if (sc.k >= 1) { S.scan = null; S.scanT = 0; finishScan(sc.q); } } }
    else if (S.scanT > 0) S.scanT = Math.max(0, S.scanT - dt);
    const bar = b.querySelector('i'); if (bar) bar.style.width = (S.scan ? S.scan.k * 100 : 0) + '%';
  }

  /* ================= 2) INSIDE THE OUTPOST ================= */
  const ROOMS = {
    cmd: { n: 'Command module', c: '#55d6e8', why: 'Radio to Earth and the base computers.' },
    lab: { n: 'Science lab', c: '#b48cff', why: 'Samples from your scans are studied here.' },
    hab: { n: 'Crew quarters', c: '#f2c14e', why: 'Bunks for the crew. Rest keeps morale up.' },
    farm: { n: 'Greenhouse', c: '#65c98a', why: 'Plants grow under lamps and make food.' },
    o2: { n: 'Life support', c: '#6fd8e8', why: 'Electrolysis splits water into oxygen to breathe.' },
    med: { n: 'Medbay', c: '#e76f6f', why: 'Treats injuries and radiation sickness.' },
    pwr: { n: 'Power room', c: '#f4a259', why: 'Batteries and generators keep everything running.' } };
  const SKY = [['#05060c', '#141822'], ['#c08a5a', '#e8b07a'], ['#03040a', '#1a1612'], ['#04060e', '#0c1426'], ['#b8742e', '#e0a050'], ['#04050a', '#14141a']];
  let IN = null;
  function roomsNow() { const has = t => S.b.some(b => b.t === t && !(b.pop != null && b.pop < 0)); const L = ['cmd', 'lab'];
    if (has('habitat')) L.push('hab'); if (has('farm')) L.push('farm'); if (has('o2')) L.push('o2'); if (has('medbay')) L.push('med'); if (has('battery') || has('rtg') || has('reactor')) L.push('pwr'); return L; }
  function roomInfo(k) { const r = S.res, rt = S.rate || {}, f = v => (v >= 0 ? '+' : '−') + Math.abs(v || 0).toFixed(1) + '/s', n = t => S.b.filter(b => b.t === t).length;
    switch (k) {
      case 'cmd': { let dl = ''; try { const D = [1.3, 750, 330, 2600, 4800, 1500][S.lv]; dl = D < 60 ? D.toFixed(1) + ' seconds' : Math.round(D / 60) + ' minutes'; } catch (e) {} return [`Wave ${Math.min(S.sol, SPL)} of ${SPL}`, dl ? `A radio message to Earth takes about ${dl} each way.` : '', `Base health ${Math.round((S.b.find(b => b.t === 'core') || { hp: 0 }).hp)}`]; }
      case 'lab': { const cd = codex(), m = (SCI[S.lv] || []).filter(x => cd[S.lv + ':' + x[0]]).length; return [`${m} of 6 discoveries scanned on ${S.L.n}`, `Research points: ${typeof RP !== 'undefined' ? RP : 0}`]; }
      case 'hab': return [`${S.crew} crew · ${typeof crewCap === 'function' ? crewCap() : '?'} beds`, S.morale != null ? `Morale ${Math.round(S.morale)}` : '', `${n('habitat')} habitat module${n('habitat') > 1 ? 's' : ''}`];
      case 'farm': return [`Food ${Math.round(r.fd)}% (${f(rt.fd)})`, `${n('farm')} greenhouse${n('farm') > 1 ? 's' : ''}`];
      case 'o2': return [`Air ${Math.round(r.o2)}% (${f(rt.o2)})`, `${n('o2')} oxygen generator${n('o2') > 1 ? 's' : ''}`];
      case 'med': return [`Crew health ${Math.round(S.hp)}`, `Radiation ${Math.round(r.rad)}`];
      case 'pwr': return [`Power ${Math.round(r.pw)} of ${S.cap || 0} stored (${f(rt.pw)})`, `${n('battery')} batteries · ${n('rtg')} RTG · ${n('reactor')} reactor`];
    } return []; }
  const canEnter = () => { if (!S || !S.run || S.pz || S.land > 0 || S.drive || S.tu != null) return false; const c = S.b.find(b => b.t === 'core'); return !!c && Math.hypot(c.x + 16 - S.p.x, c.y + 16 - S.p.y) < 52; };
  let EB = null;
  function enterBtn() { if (EB) return EB; EB = document.createElement('button'); EB.id = 'u-entB'; EB.className = 'ui'; EB.hidden = true; EB.innerHTML = `${ic('home', 16)}<span>Go inside</span><small>I</small>`; EB.onclick = enter; $q('#stage').appendChild(EB); return EB; }
  function enter() {
    if (!canEnter()) return; const wrap = document.createElement('div'); wrap.id = 'u-int'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Inside the outpost');
    wrap.innerHTML = `<canvas width="480" height="200"></canvas><div class="u-ih"><b>${ic('home', 15)}<span>Inside the ${esc(S.L.n)} outpost</span></b><span>Walk with the arrow keys or A and D, or tap where you want to go. The game is paused while you are inside.</span><button class="btn" id="u-intX">${ic('x', 14)} Go outside</button></div><div class="u-ip" id="u-ip"></div>`;
    $q('#stage').appendChild(wrap); if (window.R3) R3.hold = true; S.pz = true; fireHeld = false; keys = {}; IK.l = IK.r = 0;
    const rooms = roomsNow(), RW = 120, crew = (S.crewL && S.crewL.length ? S.crewL : (P && P.crew) || []).slice(0, 8);
    IN = { el: wrap, cv: wrap.querySelector('canvas'), rooms, RW, W: rooms.length * RW, x: 30, vx: 0, tx: null, face: 1, t: 0, crew: crew.map((c, i) => { const want = { eng: 'pwr', med: 'med', sci: 'lab', bot: 'farm', pil: 'cmd', min: 'cmd' }[c.job]; let r = rooms.indexOf(want); if (r < 0) r = rooms.indexOf(i % 2 ? 'hab' : 'cmd'); if (r < 0) r = i % rooms.length; return { c, room: r, x: r * RW + 26 + ((i * 37) % 68), dir: i % 2 ? 1 : -1, wait: i }; }), last: performance.now(), cur: -1 };
    IN.icons = crew.map(c => { try { const u = crewIcon(c), im = new Image(); im.src = u; return im; } catch (e) { return null; } });
    wrap.querySelector('#u-intX').onclick = leave; IN.cv.addEventListener('pointerdown', e => { const r = IN.cv.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * IN.cv.width; IN.tx = Math.max(10, Math.min(IN.W - 10, sx + IN.cam)); });
    if (typeof snd === 'function') snd('hiss'); try { ach('inside'); } catch (e) {} requestAnimationFrame(intLoop);
  }
  function leave() { if (!IN) return; IN.el.remove(); IN = null; if (window.R3) R3.hold = false; if (S) { S.pz = false; last = performance.now(); } keys = {}; if (typeof snd === 'function') snd('hiss'); }
  function intLoop(now) { if (!IN) return; try { intFrame(now); } catch (e) { console.warn('interior', e); } if (IN) requestAnimationFrame(intLoop); }
  function intFrame(now) {
    if (!IN) return; const dt = Math.min(.05, (now - IN.last) / 1000); IN.last = now; IN.t += dt; const I_ = IN, cv = I_.cv, g = cv.getContext('2d'), W = cv.width, H = cv.height;
    // move: keys, on-screen joystick or tap-to-walk
    let mv = IK.r - IK.l; if (Math.abs(mv) > .1) I_.tx = null;
    if (I_.tx != null) { const d = I_.tx - I_.x; mv = Math.abs(d) < 3 ? 0 : Math.sign(d); if (!mv) I_.tx = null; }
    I_.vx = Math.max(-1, Math.min(1, mv)) * 70; I_.x = Math.max(8, Math.min(I_.W - 8, I_.x + I_.vx * dt)); if (mv) I_.face = Math.sign(mv);
    I_.cam = Math.max(0, Math.min(I_.W - W, I_.x - W / 2)); if (I_.W < W) I_.cam = -(W - I_.W) / 2;
    const ri = Math.max(0, Math.min(I_.rooms.length - 1, Math.floor(I_.x / I_.RW)));
    const dk = (S.res.pw || 0) <= .5; if (dk !== I_.dk) { I_.dk = dk; I_.cur = -1; }
    if (ri !== I_.cur) { I_.cur = ri; const k = I_.rooms[ri], R = ROOMS[k]; $q('#u-ip').innerHTML = `<b style="color:${R.c}">${R.n}</b><span>${R.why}</span>${roomInfo(k).filter(Boolean).map(s => `<i>${esc(s)}</i>`).join('')}${I_.dk ? '<i style="border-color:#e76f6f;color:#ffb3b3">⚠ <span>Lights are on emergency power</span></i>' : ''}${k === 'lab' && typeof researchOpen === 'function' && researchOpen() ? '<button class="btn" id="u-ires">Open research</button>' : ''}${k === 'hab' ? '<button class="btn" id="u-icrew">Meet the crew</button>' : ''}`;
      const b1 = $q('#u-ires'); if (b1) b1.onclick = () => { leave(); openShop('r'); }; const b2 = $q('#u-icrew'); if (b2) b2.onclick = () => { leave(); hub(() => hide(), 'crew'); }; }
    // draw: a cut-away side view of the modules
    const fl = 160, sky = SKY[S.lv] || SKY[0]; g.imageSmoothingEnabled = false; g.fillStyle = '#0b1117'; g.fillRect(0, 0, W, H); g.save(); g.translate(-Math.round(I_.cam), 0);
    I_.rooms.forEach((k, i) => { const x0 = i * I_.RW, R = ROOMS[k];
      const dark = (S.res.pw || 0) <= .5; g.fillStyle = dark ? '#121a20' : '#1a2630'; g.fillRect(x0, 30, I_.RW, fl - 30); g.fillStyle = dark ? '#161f26' : '#22323e'; g.fillRect(x0 + 4, 34, I_.RW - 8, fl - 38);
      g.fillStyle = '#2c3f4c'; for (let j = 0; j < 4; j++) g.fillRect(x0 + 6 + j * 28, 36, 2, fl - 42);   // wall ribs
      g.fillStyle = R.c; g.globalAlpha = .9; g.fillRect(x0 + 4, 34, I_.RW - 8, 3); g.globalAlpha = 1;  // colour stripe
      const wx = x0 + I_.RW / 2 - 18, gr = g.createLinearGradient(0, 46, 0, 72); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); g.fillStyle = '#0d151c'; g.fillRect(wx - 2, 44, 40, 30); g.fillStyle = gr; g.fillRect(wx, 46, 36, 26);  // window with the real sky
      if (S.lv === 0) { g.fillStyle = '#3b78c8'; g.fillRect(wx + 24, 50, 6, 6); g.fillStyle = '#5fe08a'; g.fillRect(wx + 25, 51, 2, 2); }
      if (S.lv === 3) { g.fillStyle = '#d9a77a'; g.beginPath(); g.arc(wx + 30, 60, 12, 0, 7); g.fill(); g.fillStyle = '#b06a3a'; g.fillRect(wx + 18, 58, 24, 2); }
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(wx, 46, 36, 2);
      g.fillStyle = '#3a4a56'; g.fillRect(x0, fl, I_.RW, 6); g.fillStyle = '#2a3640'; g.fillRect(x0, fl + 6, I_.RW, 34);  // floor
      // room furniture
      const t = I_.t, fx = x0 + 12;
      if (k === 'cmd') { g.fillStyle = '#0f1a22'; g.fillRect(fx, 110, 60, 50); for (let s = 0; s < 3; s++) { g.fillStyle = (Math.floor(t * 2 + s) % 3) ? '#55d6e8' : '#1d6a78'; g.fillRect(fx + 4 + s * 19, 116, 16, 12); } g.fillStyle = '#f4a259'; g.fillRect(fx + 4, 134, 52, 3); g.fillStyle = '#9fb3c8'; g.fillRect(fx + 70, 92, 3, 68); g.fillStyle = Math.floor(t * 1.5) % 2 ? '#e76f6f' : '#5a2a2a'; g.fillRect(fx + 69, 90, 5, 4); }
      if (k === 'lab') { g.fillStyle = '#d7dde3'; g.fillRect(fx, 132, 70, 6); g.fillStyle = '#9aa6b0'; g.fillRect(fx + 4, 138, 4, 22); g.fillRect(fx + 62, 138, 4, 22); for (let s = 0; s < 4; s++) { g.fillStyle = ['#b48cff', '#55d6e8', '#f2c14e', '#65c98a'][s]; g.fillRect(fx + 6 + s * 15, 122 - (s % 2) * 4, 6, 10 + (s % 2) * 4); } g.fillStyle = '#0f1a22'; g.fillRect(fx + 74, 100, 22, 32); g.fillStyle = '#b48cff'; g.fillRect(fx + 77, 104 + Math.floor(t * 4) % 20, 16, 2); }
      if (k === 'hab') { for (let s = 0; s < 2; s++) { g.fillStyle = '#3c4f5d'; g.fillRect(fx, 112 + s * 26, 56, 4); g.fillStyle = '#f2c14e'; g.fillRect(fx + 2, 106 + s * 26, 50, 6); g.fillStyle = '#e8eef3'; g.fillRect(fx + 2, 106 + s * 26, 10, 6); } g.fillStyle = '#4a3a2a'; g.fillRect(fx + 70, 120, 18, 40); g.fillStyle = '#f2c14e'; g.fillRect(fx + 84, 138, 2, 3); }
      if (k === 'farm') { g.fillStyle = 'rgba(255,107,214,.18)'; g.fillRect(x0 + 6, 80, I_.RW - 12, 80); for (let s = 0; s < 3; s++) { g.fillStyle = '#5a4030'; g.fillRect(fx + s * 32, 140, 26, 20); for (let p = 0; p < 4; p++) { const grow = Math.max(.35, Math.min(1, (S.res.fd || 0) / 70)), wilt = (S.rate && S.rate.fd < -.05) || (S.res.pw || 0) <= .5, h = (10 + ((s * 7 + p * 5) % 9)) * grow + Math.sin(t * 2 + p + s) * 1.5; g.fillStyle = wilt ? (p % 2 ? '#a89a4a' : '#8a7a3a') : p % 2 ? '#65c98a' : '#3fa86a'; g.fillRect(fx + 3 + s * 32 + p * 6, 140 - h, 3, h); } } g.fillStyle = '#ff6bd6'; g.fillRect(x0 + 10, 80, I_.RW - 20, 3); }
      if (k === 'o2') { for (let s = 0; s < 2; s++) { g.fillStyle = '#c9d2dc'; g.fillRect(fx + s * 34, 100, 24, 60); g.fillStyle = '#6fd8e8'; const lv = 20 + Math.sin(t + s) * 6; g.fillRect(fx + 3 + s * 34, 157 - lv * 2, 18, lv * 2); for (let b = 0; b < 3; b++) { g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(fx + 6 + s * 34 + b * 5, 150 - ((t * 30 + b * 13 + s * 7) % 50), 2, 2); } } g.fillStyle = '#9aa6b0'; g.fillRect(fx + 70, 96, 4, 64); g.fillRect(fx + 24, 96, 50, 4); }
      if (k === 'med') { g.fillStyle = '#e8eef3'; g.fillRect(fx, 130, 60, 8); g.fillStyle = '#9aa6b0'; g.fillRect(fx + 4, 138, 4, 22); g.fillRect(fx + 52, 138, 4, 22); g.fillStyle = '#e76f6f'; g.fillRect(fx + 76, 100, 14, 4); g.fillRect(fx + 81, 95, 4, 14); g.fillStyle = '#0f1a22'; g.fillRect(fx + 66, 112, 28, 18); g.strokeStyle = '#65c98a'; g.lineWidth = 1; g.beginPath(); for (let p = 0; p < 26; p++) { const yy = 121 + ((p + Math.floor(t * 12)) % 13 === 0 ? -6 : 0); p ? g.lineTo(fx + 67 + p, yy) : g.moveTo(fx + 67, yy); } g.stroke(); }
      if (k === 'med' && S.hp < 70) { g.fillStyle = '#c9d2dc'; g.fillRect(fx + 8, 124, 40, 6); g.fillStyle = '#e0ac69'; g.fillRect(fx + 44, 120, 7, 7); }
      if (k === 'pwr') { for (let s = 0; s < 4; s++) { g.fillStyle = '#2f3b46'; g.fillRect(fx + s * 22, 108, 18, 52); const ch = Math.max(0, Math.min(1, (S.res.pw || 0) / Math.max(1, S.cap || 1))); g.fillStyle = ch > .3 ? '#f2c14e' : '#e76f6f'; g.fillRect(fx + 3 + s * 22, 156 - ch * 44, 12, ch * 44); } }
      if (dark) { g.fillStyle = `rgba(231,111,111,${.25 + .2 * Math.sin(t * 4)})`; g.fillRect(x0 + 4, 34, I_.RW - 8, fl - 38); g.fillStyle = '#e76f6f'; g.fillRect(x0 + I_.RW / 2 - 3, 36, 6, 4); }
      // doorway to the next module
      if (i < I_.rooms.length - 1) { g.fillStyle = '#0b1117'; g.fillRect(x0 + I_.RW - 6, 100, 12, 60); g.fillStyle = '#55d6e8'; g.fillRect(x0 + I_.RW - 1, 96, 2, 3); }
      g.fillStyle = 'rgba(242,245,247,.85)'; g.font = '600 9px Inter, system-ui, sans-serif'; g.fillText(R.n.toUpperCase(), x0 + 8, 26);
    });
    // crew members wander, stop and work
    I_.crew.forEach((m, i) => { m.wait -= dt; if (m.wait <= 0) { m.x += m.dir * 16 * dt; const x0 = m.room * I_.RW; if (m.x < x0 + 14 || m.x > x0 + I_.RW - 14) { m.dir *= -1; m.wait = 1 + (i % 3); } if (Math.random() < dt * .25) m.wait = 1.5 + Math.random() * 2; }
      person(g, m.x, fl, m.dir, m.wait > 0 ? 0 : I_.t * 8 + i, I_.icons[i], JOBS[m.c.job] ? JOBS[m.c.job].col : '#9fb3c8', false); });
    person(g, I_.x, fl, I_.face, Math.abs(I_.vx) > 1 ? I_.t * 10 : 0, null, '#f4a259', true);
    g.restore();
  }
  function person(g, x, fl, dir, ph, icon, col, me) { // 2.5 px pixel person, jumpsuit inside (no helmet: the air is breathable)
    x = Math.round(x); const st = ph ? Math.sin(ph) : 0, y = fl - 22;
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 6, fl - 1, 12, 2);
    g.fillStyle = '#2a3440'; g.fillRect(x - 4 + Math.round(st * 2), fl - 8, 3, 8); g.fillRect(x + 1 - Math.round(st * 2), fl - 8, 3, 8);  // legs
    g.fillStyle = me ? '#e8eef3' : '#c9d2dc'; g.fillRect(x - 5, y + 6, 10, 9); g.fillStyle = col; g.fillRect(x - 5, y + 12, 10, 3);     // body + job stripe
    g.fillStyle = me ? '#e8eef3' : '#c9d2dc'; g.fillRect(x - 7, y + 7 + Math.round(-st), 2, 7); g.fillRect(x + 5, y + 7 + Math.round(st), 2, 7); // arms
    if (icon && icon.complete && icon.naturalWidth) g.drawImage(icon, 4, 4, 8, 8, x - 4, y - 2, 8, 8); else { g.fillStyle = '#e0ac69'; g.fillRect(x - 3, y - 1, 7, 7); g.fillStyle = '#2a1a10'; g.fillRect(x - 3, y - 2, 7, 2); g.fillStyle = '#111'; g.fillRect(x + (dir > 0 ? 2 : -2), y + 2, 1, 1); }
    if (me) { g.fillStyle = '#f4a259'; g.fillRect(x - 1, y - 6, 2, 3); }
  }


  /* ---- v88: what each crew member is doing, from the live game state ---- */
  function task(c) { const dmg = S.b.find(b => b.m && b.hp < b.m * .7 && b.t !== 'wall'), n = t => S.b.filter(b => b.t === t).length, nm = b => (BT[b.t] && BT[b.t].n) || b.t;
    switch (c.job) {
      case 'eng': return dmg ? `Repairing the ${nm(dmg)}` : (S.res.pw || 0) <= .5 ? 'Restarting the power grid' : 'Checking the power lines';
      case 'med': return S.hp < 95 ? 'Treating the crew' : (S.res.rad || 0) > 40 ? 'Watching radiation doses' : 'Restocking the medbay';
      case 'sci': return S.scan ? 'Helping with your scan' : 'Studying samples in the lab';
      case 'bot': return n('farm') ? ((S.rate && S.rate.fd < 0) ? 'Saving the struggling crops' : 'Tending the greenhouse') : 'Waiting for a farm to be built';
      case 'pil': return S.drive ? 'Navigating the rover' : 'Preparing the next Earth call';
      case 'min': return n('drill') ? 'Running the drill' : 'Collecting loose ore';
    } return 'On duty'; }
  // cross-mode link: scanning a world in Adventure mode gives a one-time research insight for that world's Story outpost
  const LINK = [['moon', 'luna', 'apollo', 'tycho', 'copernicus', 'aristarchus', 'linne', 'hadley', 'gassendi', 'lro', 'ladee', 'clementine', 'lunar'], ['mars', 'gale', 'curiosity', 'perseverance', 'ingenuity', 'opportunity', 'spirit', 'valles', 'tharsis', 'victoria', 'viking', 'insight', 'mro', 'maven', 'odyssey', 'phobos', 'deimos', 'jezero', 'pahrump', 'snowman'], ['mercury', 'messenger'], ['europa', 'jupiter', 'juno', 'galileo', 'ganymede', 'callisto'], ['titan', 'saturn', 'cassini', 'huygens', 'enceladus'], ['ceres', 'dawn', 'vesta', 'rheasilvia', 'numisia', 'occator']];
  const advScans = () => { try { return LS.get('adv_scan', []) || []; } catch (e) { return []; } };
  const linked = i => advScans().filter(id => LINK[i].some(w => String(id).toLowerCase().includes(w)));
  const claimed = () => { try { return LS.get('xlink', {}) || {}; } catch (e) { return {}; } };
  function claim(i) { const c = claimed(); if (c[i] || !linked(i).length) return false; c[i] = 1; LS.set('xlink', c); try { addRP(3); } catch (e) {} try { ach('link'); } catch (e) {} if (typeof snd === 'function') snd('star', 2); return true; }
  // new achievements that reward varied play
  try { if (typeof ACH !== 'undefined' && !ACH.some(a => a.id === 'scan1')) ACH.push({ id: 'scan1', ic: '🔬', n: 'First sample', d: 'Scan your first science site' }, { id: 'survey', ic: '🗺', n: 'Full survey', d: 'Scan all 6 science sites on one world' }, { id: 'sci36', ic: '🎓', n: 'Planetary scientist', d: 'Scan all 36 science discoveries' }, { id: 'link', ic: '🔗', n: 'Two worlds, one mission', d: 'Turn an Adventure discovery into Story research' }, { id: 'inside', ic: '🏠', n: 'Home sweet dome', d: 'Walk inside your outpost' }); } catch (e) {}
  /* ================= 3) MISSION CONTROL HUB ================= */
  let HT = 'obj';
  function hub(back, tab) {
    if (tab) HT = tab; const inGame = !!(S && S.run), cd = codex(), w = inGame ? S.lv : TW;
    const tabs = [['obj', 'Objectives', 'flag'], ['disc', 'Discoveries', 'flask'], ['crew', 'Crew', 'users'], ['jour', 'Journal', 'globe'], ['hist', 'Mission log', 'book'], ['rew', 'Rewards', 'star']];
    let body = '';
    if (HT === 'obj') {
      if (inGame && S.mis) body = `<div class="u-hc"><h3>Goals on ${esc(S.L.n)}</h3>${S.mis.map(m => `<div class="u-hl ${m.done ? 'ok' : ''}">${m.done ? '✓' : '○'} ${esc(String(misTxt(m)).replace(/<[^>]*>/g, '').replace(/^[○✓\s]+/, ''))}</div>`).join('')}${S.pois ? S.pois.map(q => `<div class="u-hl ${q.found ? 'ok' : ''}">${q.found ? '✓ ' + esc(q.n) : '○ <span>Unknown discovery site: explore to find it</span>'}</div>`).join('') : ''}${(S.exp || []).map(e => `<div class="u-hl ${e.st === 2 ? 'ok' : ''}">${e.st === 2 ? '✓' : '○'} <span>Expedition</span>: ${esc(e.n)}</div>`).join('')}</div>`;
      else body = `<div class="u-hc"><h3>Missions on ${esc(LV[w].n)}</h3>${(MISS[w] || []).map(m => `<div class="u-hl">○ ${esc(m.t)}</div>`).join('')}<p class="u-hs">Start the world to track your progress live.</p></div>`;
      try { if (typeof dqGet === 'function') { const d = dqGet(); body += `<div class="u-hc"><h3>Today’s quests</h3>${d.q.map(q => `<div class="u-hl ${q.done ? 'ok' : ''}">${q.done ? '✓' : '○'} ${esc(q.t)} (${q.c}/${q.n})</div>`).join('')}</div>`; } } catch (e) {}
    } else if (HT === 'disc') {
      const tot = SCI.reduce((s, L, i) => s + L.filter(x => cd[i + ':' + x[0]]).length, 0);
      body = `<p class="u-hs"><b>${tot} / 36</b> · <span>Walk up to a pulsing cyan survey marker on any world and press SCAN (key H).</span></p>` + SCI.map((L, i) => { const n = L.filter(x => cd[i + ':' + x[0]]).length; return `<details class="u-hc" ${i === w ? 'open' : ''}><summary><b>${esc(LV[i].n)}</b> <span>${n} / 6</span></summary>${L.map(x => cd[i + ':' + x[0]] ? `<div class="u-hd"><b>${esc(x[1])}</b><p>${esc(x[2])}</p></div>` : `<div class="u-hd no"><b>Unscanned sample</b></div>`).join('')}</details>`; }).join('');
    } else if (HT === 'jour') {
      const a = advScans(), cl = claimed();
      body = `<div class="u-hc"><h3>Adventure journal</h3><div class="u-hl"><span>Discoveries from Adventure: ${a.length}</span></div><p class="u-hs">Scan a world, its rovers or its spacecraft in Adventure mode, then come back here: each world gives a one-time insight worth +3 research for its Story outpost.</p></div>
        <div class="u-hc"><h3>Research insights from Adventure mode</h3>${LV.slice(0, 6).map((l, i) => { const n = linked(i).length; return `<div class="u-hl ${cl[i] ? 'ok' : ''}" style="display:flex;gap:8px;align-items:center"><b style="min-width:70px">${esc(l.n)}</b><span style="flex:1;color:#A7B4BF">${n ? n + ' ✓' : '—'}</span>${cl[i] ? '<span>✓ +3 🔬</span>' : n ? `<button class="btn u-clm" data-i="${i}">+3 🔬</button>` : '<span style="color:#5f6e7a">Explore it in Adventure mode</span>'}</div>`; }).join('')}</div>`;
    } else if (HT === 'crew') {
      const crew = inGame && S.crewL ? S.crewL : (P && P.crew) || [];
      body = `<div class="u-hg">${crew.map(c => { let im = ''; try { im = crewIcon(c); } catch (e) {} const J = JOBS[c.job] || {}; return `<div class="u-hcm"><img src="${im}" alt=""><div><b>${esc(c.nm)}</b><span style="color:${J.col || '#fff'}">${esc(J.n || c.job)}</span><p>${esc(J.d || '')}</p>${inGame ? `<p class="u-now"><span>Now</span>: ${esc(task(c))}</p>` : ''}</div></div>`; }).join('') || '<p class="u-hs">No crew yet.</p>'}</div>${inGame ? `<p class="u-hs">Crew health ${Math.round(S.hp)} · ${S.morale != null ? 'morale ' + Math.round(S.morale) + ' · ' : ''}${S.crew} on base · ${typeof crewCap === 'function' ? crewCap() : '?'} beds</p>` : ''}`;
    } else if (HT === 'hist') {
      body = `<div class="u-hc"><h3>Outposts</h3>${LV.slice(0, 6).map((l, i) => { const st = (typeof STARS !== 'undefined' && STARS[i]) || 0, lk = typeof mx !== 'undefined' && i > mx; return `<div class="u-hl ${st ? 'ok' : ''}">${lk ? '🔒' : st ? '★'.repeat(st) + '☆'.repeat(3 - st) : '☆☆☆'} ${esc(l.n)} · <span>${lk ? 'Locked' : st ? 'Secured' : 'Not secured yet'}</span></div>`; }).join('')}</div>
        <div class="u-hc"><h3>Records</h3><div class="u-hl"><span>Calls to Earth</span>: <b>${(STAT && STAT.calls) || 0}</b></div><div class="u-hl"><span>Quiz answers right</span>: <b>${(STAT && STAT.quiz) || 0}</b></div><div class="u-hl"><span>Rover trips</span>: <b>${(STAT && STAT.drive) || 0}</b></div><div class="u-hl"><span>Space journal entries</span>: <b>${typeof JR !== 'undefined' ? JR.size : 0}</b></div>${inGame ? `<div class="u-hl"><span>Decisions on this mission</span>: <b>${S.dec || 0}</b></div>` : ''}</div>`;
    } else if (HT === 'rew') {
      body = `<div class="u-hc">${typeof rankHtml === 'function' ? rankHtml() : ''}</div><div class="u-hc"><h3>Totals</h3><div class="u-hl"><span>Achievements</span>: <b>${typeof ACHS !== 'undefined' ? ACHS.size : 0} / ${typeof ACH !== 'undefined' ? ACH.length : '?'}</b></div><div class="u-hl"><span>Research points</span>: <b>${typeof RP !== 'undefined' ? RP : 0}</b></div><div class="u-hl"><span>Technologies researched</span>: <b>${typeof TECHS !== 'undefined' ? TECHS.size : 0}</b></div><div class="u-hl"><span>Total stars</span>: <b>${typeof STARS !== 'undefined' ? STARS.reduce((a, b) => a + (b || 0), 0) : 0} / 18</b></div></div><div class="acts"><button class="btn" id="u-hach">${ic('star', 14)} Open achievements</button></div>`;
    }
    show(`<div class="eyebrow">Mission Control</div><h2>${inGame ? `<span>${esc(S.L.n)} outpost</span>` : 'Commander’s overview'}</h2><div class="u-tabs" role="tablist">${tabs.map(t => `<button class="u-tab ${t[0] === HT ? 'on' : ''}" data-t="${t[0]}" role="tab" aria-selected="${t[0] === HT}">${ic(t[2], 14)} ${t[1]}</button>`).join('')}</div><div class="u-hub">${body}</div><div class="acts"><button class="big" id="u-hX">Back</button></div>`);
    $q('#ov .sheet').classList.add('u-hubs'); document.querySelectorAll('#ov .u-tab').forEach(b => b.onclick = () => { if (typeof snd === 'function') snd('ui'); hub(back, b.dataset.t); });
    $q('#u-hX').onclick = back; document.querySelectorAll('#ov .u-clm').forEach(b => b.onclick = () => { if (claim(+b.dataset.i)) hub(back, 'jour'); }); const ac = $q('#u-hach'); if (ac) ac.onclick = () => openShop('a', () => hub(back, 'rew'));
  }
  window.HUB87 = hub; window.__IN87 = () => IN && { x: IN.x, cur: IN.cur, l: IK.l, r: IK.r, t: IN.t };
  // entry points: title menu, pause menu, outpost status panel, key N
  if (typeof title === 'function') { const t0 = title; window.title = title = function () { const r = t0.apply(this, arguments); try { const nav = $q('.u-nav'); if (nav && !$q('#u-hubT')) { const b = document.createElement('button'); b.className = 'btn u-nb'; b.id = 'u-hubT'; b.innerHTML = ic('target', 15) + 'Mission Control'; b.onclick = () => { if (typeof snd === 'function') snd('ui'); hub(() => title()); }; nav.insertBefore(b, nav.firstChild); } } catch (e) {} return r; }; }
  if (typeof pause === 'function') { const p0 = pause; window.pause = pause = function () { const r = p0.apply(this, arguments); try { const a = $q('#ov .acts .btn') && $q('#ov .acts .btn').parentElement; if (a && $q('#resB') && !$q('#u-hubP')) { const b = document.createElement('button'); b.className = 'btn'; b.id = 'u-hubP'; b.innerHTML = ic('target', 14) + ' Mission Control'; b.onclick = () => hub(() => pause()); a.insertBefore(b, a.firstChild); } } catch (e) {} return r; }; }
  const IK = { l: 0, r: 0 }; addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 'a' || k === 'arrowleft') IK.l = 0; if (k === 'd' || k === 'arrowright') IK.r = 0; }, true); addEventListener('blur', () => { IK.l = IK.r = 0; });
  addEventListener('keydown', e => { if (/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return; const k = e.key.toLowerCase();
    if (IN) { e.preventDefault(); e.stopImmediatePropagation(); if (k === 'a' || k === 'arrowleft') IK.l = 1; else if (k === 'd' || k === 'arrowright') IK.r = 1; else if (k === 'escape' || k === 'i') leave(); return; }
    if (!S || !S.run || S.pz || typeof ov === 'undefined' || !ov.hidden) return;
    if (k === 'h' && !e.repeat) startScan(); if (k === 'i' && canEnter()) { e.preventDefault(); enter(); } if (k === 'n') { e.preventDefault(); hub(() => hide()); } }, true);
  const statBtn = () => { const pa = $q('#u-stat .u-pa'); if (pa && !$q('#u-hubS')) { const b = document.createElement('button'); b.className = 'btn'; b.id = 'u-hubS'; b.innerHTML = ic('target', 14) + ' Mission Control'; b.onclick = () => { $q('#u-stat').hidden = true; hub(() => hide()); }; pa.insertBefore(b, pa.firstChild); } };

  /* ================= per-frame hooks ================= */
  const u0 = update; window.update = update = function (dt) { u0.apply(this, arguments); try { scanStep(dt || 0); const eb = enterBtn(); eb.hidden = !canEnter(); statBtn(); if (S && S.run && !S.pz) { const lo = !!(S.L && S.L.lowg); S.gaitLow = lo; } } catch (e) { console.warn('v87', e); } };
  // remember when you build so the astronaut kneels and works for a moment
  if (typeof place === 'function') { const pl0 = place; window.place = place = function (t, x, y, who) { const n = S ? S.b.length : 0, r = pl0.apply(this, arguments); try { if (S && S.b.length > n && !who) S.bldT = nowT(); } catch (e) {} return r; }; }

  const css = document.createElement('style'); css.textContent = String.raw`
#u-scanB{position:absolute;left:50%;bottom:calc(150px + var(--sb));transform:translateX(-50%);z-index:5;display:flex;gap:8px;align-items:center;padding:10px 18px;border-radius:999px;background:rgba(16,24,32,.92);border:2px solid #55D6E8;color:#F2F5F7;font:700 14px var(--u-f,Inter,system-ui);letter-spacing:.12em;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.45);animation:u87p 1.6s ease-in-out infinite}
#u-scanB i{position:absolute;left:0;bottom:0;height:3px;background:#55D6E8;width:0}#u-scanB small{font:600 10px var(--u-f,Inter);opacity:.6;border:1px solid rgba(242,245,247,.3);border-radius:4px;padding:0 4px}
#u-entB{position:absolute;left:50%;bottom:calc(150px + var(--sb));transform:translate(-50%,-56px);z-index:5;display:flex;gap:8px;align-items:center;padding:8px 14px;border-radius:999px;background:rgba(16,24,32,.92);border:1px solid rgba(242,193,78,.7);color:#F2F5F7;font:600 13px var(--u-f,Inter,system-ui)}#u-entB small{font:600 10px var(--u-f,Inter);opacity:.6;border:1px solid rgba(242,245,247,.3);border-radius:4px;padding:0 4px}
#u-scanB[hidden],#u-entB[hidden]{display:none}
@keyframes u87p{50%{box-shadow:0 0 0 6px rgba(85,214,232,.18),0 6px 18px rgba(0,0,0,.45)}}
#u-disc{position:absolute;left:50%;top:calc(96px + var(--st));transform:translate(-50%,-8px);z-index:6;width:min(440px,calc(100% - 24px));background:rgba(16,24,32,.97);border:1px solid rgba(167,180,191,.3);border-top:3px solid #b48cff;border-radius:12px;padding:10px 14px;color:#F2F5F7;font:13px/1.45 var(--u-f,Inter,system-ui);opacity:0;pointer-events:none;transition:opacity .3s,transform .3s}
#u-disc.on{opacity:1;transform:translate(-50%,0)}#u-disc .u-dk{font:700 10.5px var(--u-f,Inter);letter-spacing:.14em;text-transform:uppercase;color:#b48cff;display:flex;gap:6px;align-items:center}#u-disc b{display:block;font-size:17px;margin:3px 0}#u-disc p{margin:0 0 4px;color:#cfd8e0}#u-disc small{color:#A7B4BF}
#u-int{position:absolute;inset:0;z-index:20;background:#0b1117;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:calc(10px + var(--st)) calc(10px + var(--sr)) calc(10px + var(--sb)) calc(10px + var(--sl))}
#u-int canvas{width:min(100%,calc((100vh - 170px) * 2.4));aspect-ratio:12/5;image-rendering:pixelated;border:1px solid rgba(167,180,191,.3);border-radius:12px;background:#0b1117;touch-action:none;cursor:pointer}
.u-ih{display:flex;gap:12px;align-items:center;flex-wrap:wrap;width:min(100%,960px);color:#F2F5F7;font:13px var(--u-f,Inter,system-ui)}.u-ih b{display:flex;gap:6px;align-items:center;font-size:15px}.u-ih span{color:#A7B4BF;flex:1;min-width:200px}
.u-ip{width:min(100%,960px);background:#192630;border:1px solid rgba(167,180,191,.2);border-radius:12px;padding:10px 12px;color:#F2F5F7;font:13px/1.45 var(--u-f,Inter,system-ui);display:flex;gap:6px 14px;flex-wrap:wrap;align-items:center}.u-ip b{font-size:15px}.u-ip span{color:#A7B4BF;flex-basis:100%}.u-ip i{font-style:normal;background:#101820;border:1px solid rgba(167,180,191,.2);border-radius:8px;padding:3px 8px}
@media (max-height:440px){.u-ih span{display:none}#u-int{gap:6px}}
.u-hubs .u-tabs .u-tab{display:inline-flex;gap:6px;align-items:center}.u-hub{display:flex;flex-direction:column;gap:10px}
.u-hc{background:#192630;border:1px solid rgba(167,180,191,.16);border-radius:12px;padding:10px 12px}.u-hc h3{margin:0 0 6px;font:700 11px var(--u-f,Inter);letter-spacing:.14em;text-transform:uppercase;color:#F4A259}
.u-hc summary{cursor:pointer;display:flex;gap:8px;align-items:center}.u-hc summary span{color:#A7B4BF;font-size:12.5px}
.u-hl{padding:4px 0;border-top:1px solid rgba(167,180,191,.1);font-size:13.5px;color:#F2F5F7}.u-hl:first-of-type{border-top:0}.u-hl.ok{color:#65C98A}
.u-hd{padding:6px 0;border-top:1px solid rgba(167,180,191,.1)}.u-hd b{font-size:14px}.u-hd p{margin:2px 0 0!important;font-size:12.5px!important;color:#A7B4BF!important;line-height:1.45!important}.u-hd.no b{color:#5f6e7a;font-weight:500}
.u-hs{color:#A7B4BF!important;font-size:13px!important}.u-now{color:#55D6E8!important;font-size:12px!important}.u-now span{font-weight:700}
.u-hg{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}.u-hcm{display:flex;gap:10px;background:#192630;border:1px solid rgba(167,180,191,.16);border-radius:12px;padding:10px}.u-hcm img{width:40px;height:40px;image-rendering:pixelated;border-radius:8px;flex:none}.u-hcm b{display:block}.u-hcm span{font-size:12px;font-weight:600}.u-hcm p{margin:2px 0 0!important;font-size:12px!important;color:#A7B4BF!important;line-height:1.35!important}
@media (prefers-reduced-motion:reduce){#u-scanB{animation:none}#u-disc{transition:none}}
`;
  document.body.appendChild(css);
})();
