/* Red Dust Outpost · Story mode realism pack.
   Real numbers from NASA missions drive the base simulation:
   1) the Sun's height sets how much power solar panels make (dawn and dusk are weak),
   2) the real temperature range of each world, and heaters that use power in the cold (radiators on Mercury's hot days),
   3) dust slowly settling on solar panels (brush it off, or let a dust devil do it),
   4) help from Earth waits for the light-speed signal delay,
   5) crew radiation dose in millisieverts, compared with NASA's career limit,
   6) moonquakes, marsquakes and ice quakes,
   7) footprints and rover tracks that stay forever on airless worlds and blow away on Mars and Titan,
   8) sound shaped by the air (thin on Mars, none on the Moon, thick on Titan).
   It hooks into the game's own functions, so the 2D, 3D, HD and Real views all share it. */
(function () {
  'use strict';
  if (typeof S === 'undefined' && typeof update !== 'function') return;
  const cl = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = (e0, e1, x) => { const t = cl((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  // index = S.lv: Moon, Mars, Mercury, Europa, Titan, Ceres, (hive world)
  const TEMP = [[-173, 121], [-95, 0], [-180, 427], [-190, -148], [-180, -177], [-143, -73], [-60, -10]];    // °C, NASA figures (Mars: a mid-latitude site like Curiosity's Gale crater)
  const DUST = [.0018, .0034, .0011, 0, 0, .0014, 0];                                                 // dust settling on panels per second
  const LIGHT = [1.28 / 60, 12.5, 8.6, 43, 76, 22, 20];                                                // average one-way light time from Earth, minutes
  const AIR = [[1500, .9], [1150, .62], [1500, .9], [1500, .9], [20000, 1.15], [1500, .9], [20000, 1]];   // [low-pass Hz, gain]: Mars ~20 dB quieter and muffled (Perseverance's microphones), airless worlds carry sound only through your suit
  const FADE = [0, 45, 0, 0, 30, 0, 60];                                                               // seconds until wind or rain erases a footprint (0 = never: Apollo boot prints will last millions of years)
  const QK = [
    { n: 'Moonquake', f: 'Apollo seismometers recorded thousands of moonquakes. Shallow ones reached about magnitude 5, and the dry, cold rock made the Moon ring like a bell for over 10 minutes.', m: [2.5, 4.8], ring: 2.4 },
    { n: 'Marsquake', f: 'NASA’s InSight lander recorded 1,319 marsquakes between 2018 and 2022. The biggest, on May 4, 2022, was about magnitude 4.7 and made the planet ring for over 6 hours.', m: [2.4, 4.7], ring: 1.4 },
    { n: 'Mercury quake', f: 'Mercury is slowly shrinking as its iron core cools. The crust cracks and pushes up cliffs called lobate scarps, some over 3 km tall, so quakes are likely still happening today.', m: [2.5, 4.5], ring: 1.6 },
    { n: 'Ice quake', f: 'Jupiter’s gravity stretches and squeezes Europa every 3.5 days. The flexing cracks the ice shell, which is why Europa is covered in long dark ridges and fractures.', m: [2, 4], ring: 1.2 },
    { n: 'Titan quake', f: 'Saturn’s tides flex Titan too. NASA’s Dragonfly rotorcraft will carry a seismometer to listen for Titanquakes and learn what lies under the crust.', m: [1.8, 3.6], ring: 1 },
    null, null];
  const SR = window.SR = {};
  const lv = () => (S && S.lv != null ? S.lv : 0);
  /* 1) the Sun's height */
  SR.elev = () => { if (!S || !S.L) return 1; const ph = phase(), nt = S.L.nt; return ph < nt ? Math.sin(Math.PI * ph / nt) : -.3; };
  SR.sunK = () => { const e = SR.elev(); return e <= 0 ? 0 : (.12 + .88 * sstep(0, .38, e)) * 1.12; };   // sun-tracking panels: full power once the Sun is ~20° up; weak at dawn and dusk
  /* 2) temperature and heaters */
  SR.temp = () => { const T = TEMP[lv()] || TEMP[0], f = S.tempF == null ? .5 : S.tempF; let t = T[0] + (T[1] - T[0]) * f; if (S.storm > 0 && lv() === 1) t = t * .6 + (T[0] + T[1]) * .2; return t; };   // dust storms warm Martian nights and cool its days
  const HEATED = { core: 1, habitat: 1, medbay: 1, farm: 1, o2: 1 };
  SR.heat = () => { if (!S || !S.b) return 0; const t = SR.temp(); let k = 0; if (t < -10) k = Math.min(.19, (-10 - t) * .0012); else if (t > 70) k = Math.min(.24, (t - 70) * .0008);   /* well-insulated modules: up to ~0.2 power each */
    let n = 0, off = 0; S.b.forEach(b => { if (b.nc || b.dis) return; if (HEATED[b.t]) n++; if (b.t === 'rtg') off += .4; if (b.t === 'reactor') off += .9; });
    const load = Math.max(0, n * k - (t < 0 ? off : 0)) * (S.tu != null ? 0 : 1) * (typeof DF === 'number' ? DF : 1) * (S.sol <= 1 ? .6 : 1); S.heatUse = load; return load; };
  /* per-second simulation */
  SR.tick = r => { const e = SR.elev(), tg = e > 0 ? Math.pow(e, .55) : 0; S.tempF = S.tempF == null ? tg : S.tempF + (tg - S.tempF) * (tg > S.tempF ? .12 : .06);
    S.dose = (S.dose || 0) + (r ? r.rad : 30) / 1500;                                                   // about rad/30 millisieverts per sol: the Moon's 1.4 mSv a day
    const dr = DUST[lv()] * (S.storm > 0 && lv() === 1 ? 5 : 1) * (typeof hasT === 'function' && hasT('eds') ? .3 : 1);
    if (dr > 0 && S.tu == null) S.b.forEach(b => { if (b.t === 'solar') b.dust = Math.min(.85, (b.dust || 0) + dr); });
    const t = SR.temp();
    if (S.tu == null && !S.scen) {
      if (S.heatUse > .25 && t < -60) tipOnce('heat', `It is ${Math.round(t)}°C outside. Heaters keep the habitat, farm and life support warm, and they use power. RTGs give off heat too: Curiosity’s RTG keeps the rover’s insides warm.`);
      if (t > 250) tipOnce('hot', `Mercury’s noon is ${Math.round(t)}°C, hot enough to melt lead. Radiators and cooling pumps use power to keep the base from cooking.`);
      const dmax = S.b.reduce((m, b) => b.t === 'solar' ? Math.max(m, b.dust || 0) : m, 0); if (dmax > .3) tipOnce('dust', 'Dust is settling on your solar panels and cutting their power. Walk up to a panel to brush it clean. Dust nearly ended NASA’s Spirit and Opportunity rovers, and a lucky gust of wind often saved them.');
      if (S.dose > 6 && !S.doseTip) { S.doseTip = 1; tipOnce('dose', `Your crew has absorbed ${S.dose.toFixed(1)} mSv of radiation here, more than a year of natural radiation on Earth. NASA limits an astronaut’s whole career to 600 mSv. Shields lower the dose.`); } } };
  function tipOnce(k, m) { if (S.tips && S.tips['sr_' + k]) return; if (typeof tip === 'function') tip('sr_' + k, m); }
  /* 4) light-speed delay for help from Earth */
  SR.queueCall = (id, who, c) => { const L = LIGHT[lv()]; if (!L) return false; const rt = 2 * L, d = lv() === 0 ? 2.6 : cl(rt * .15, 1.2, 22); S.comq = S.comq || []; S.comq.push({ id, who, c, t: d });
    const tl = lv() === 0 ? '1.3 seconds' : Math.round(L) + ' minutes', w = (S.L && S.L.n) || 'here';
    S.ban = { k: 'earth', lab: '📡 Signal on its way', txt: `Request sent. Radio travels at the speed of light, which takes ${tl} to cross from ${w} to Earth, so Mission Control’s reply arrives in about ${Math.round(d)} s.`, t: Math.max(4, d) };
    if (typeof snd === 'function') snd('comms'); return true; };
  /* every frame */
  const PR = { d: 0, side: 1, rd: 0 };
  SR.frame = dt => { if (!S || !S.run || S.over || S.pz) return;
    if (S.comq && S.comq.length) for (let i = S.comq.length - 1; i >= 0; i--) { const q = S.comq[i]; q.t -= dt; if (q.t <= 0) { S.comq.splice(i, 1); try { callFx(q.id, q.who || S.p, q.c); } catch (e) { console.warn('call', e); } } }
    // brushing dust off solar panels
    if (!S.drive && S.b && S.net !== 'guest') S.b.forEach(b => { if (b.t !== 'solar' || !(b.dust > .02)) return; if (Math.hypot(S.p.x - (b.x + 8), S.p.y - (b.y + 8)) < 20) { b.dust = Math.max(0, b.dust - dt * .55); if (!b.brT || S.t - b.brT > 3) { b.brT = S.t; if (typeof ftxt === 'function') ftxt(b.x + 8, b.y - 4, 'Brushing off dust', '#d8c9a8'); }
        if (Math.random() < dt * 14) S.pt.push({ x: b.x + 2 + Math.random() * 12, y: b.y + 2 + Math.random() * 12, vx: (Math.random() - .5) * 18, vy: -8 - Math.random() * 10, l: .5, ml: .5, c: '#b8a98c', s: 1 }); } });
    footprints(dt); quakes(dt); air(); };
  /* 7) footprints and tracks */
  function footprints(dt) { S.prints = S.prints || []; const P = S.prints, fade = FADE[lv()] || 0;
    if (S.land <= 0 && !S.cin) {
      if (S.drive && S.rv) { const v = Math.hypot(S.rv.vx || 0, S.rv.vy || 0) || (PR.lrx != null ? Math.hypot(S.rv.x - PR.lrx, S.rv.y - PR.lry) / Math.max(dt, .001) : 0); PR.rd += (PR.lrx != null ? Math.hypot(S.rv.x - PR.lrx, S.rv.y - PR.lry) : 0);
        if (PR.rd > 5 && v > 2) { PR.rd = 0; const a = Math.atan2(S.rv.y - PR.lry, S.rv.x - PR.lrx); P.push({ x: S.rv.x, y: S.rv.y + 4, a, k: 1, t: S.t }); } PR.lrx = S.rv.x; PR.lry = S.rv.y; }
      else { PR.lrx = null; const dx = PR.lx == null ? 0 : S.p.x - PR.lx, dy = PR.ly == null ? 0 : S.p.y - PR.ly, d = Math.hypot(dx, dy); if (d < 30 && !(S.jz > .5)) { PR.d += d;
          if (PR.d > 6.5) { PR.d = 0; PR.side = -PR.side; const a = Math.atan2(dy, dx); P.push({ x: S.p.x + Math.cos(a + 1.57) * 1.6 * PR.side, y: S.p.y + 6 + Math.sin(a + 1.57) * 1.6 * PR.side, a, k: 0, t: S.t }); } }
        PR.lx = S.p.x; PR.ly = S.p.y; } }
    if (fade) { while (P.length && S.t - P[0].t > fade) P.shift(); } if (P.length > 700) P.splice(0, P.length - 700); }
  window.drawPrints = function () { if (!S || !S.prints || !S.prints.length || typeof G === 'undefined' || !G) return; const fade = FADE[lv()] || 0, dk = lv() === 3 ? '120,150,175' : lv() === 1 ? '70,25,10' : lv() === 4 ? '70,45,15' : '30,30,36';
    G.save(); for (const p of S.prints) { const age = S.t - p.t, a = fade ? cl(1 - age / fade, 0, 1) : 1; if (a <= .02) continue; G.fillStyle = `rgba(${dk},${(p.k ? .3 : .38) * a})`;
      if (p.k) { const nx = -Math.sin(p.a) * 6, ny = Math.cos(p.a) * 6; G.fillRect(p.x + nx - 1.5, p.y + ny - 1, 3, 2); G.fillRect(p.x - nx - 1.5, p.y - ny - 1, 3, 2); }   // the rover's twin tracks
      else G.fillRect(p.x - 1, p.y - 1, 2, 3); } G.restore(); };
  /* 6) quakes */
  function quakes(dt) { const Q = QK[lv()]; if (!Q || S.net === 'guest' || S.tu != null || S.scen || S.land > 0 || S.cin || (S.al && S.al.some(a => a.boss))) return;
    if (S.qT == null) S.qT = 60 + Math.random() * 70; if (!S.qk) { S.qT -= dt; if (S.qT <= 0) startQuake(Q); return; }
    const q = S.qk; q.t += dt; const env = q.t < .6 ? q.t / .6 : Math.exp(-(q.t - .6) / q.ring); S.shk = Math.max(S.shk || 0, q.amp * env * (.75 + .25 * Math.sin(q.t * 23)));
    if (q.t > .4 && !q.hit) { q.hit = 1; const B = S.b.filter(b => b.t !== 'core' && b.t !== 'wall' && b.t !== 'shield'); for (let i = 0; i < Math.min(B.length, q.n); i++) { const b = B[Math.floor(Math.random() * B.length)]; dmgB(b, q.dmg); if (typeof boom === 'function') boom(b.x + 8, b.y + 12, 6, '#9a948c'); } }
    if (Math.random() < dt * 10 * env) S.pt.push({ x: S.p.x + (Math.random() - .5) * 260, y: S.p.y + (Math.random() - .5) * 180, vx: 0, vy: -12, l: .6, ml: .6, c: '#a49d93', s: 2 });
    if (q.t > q.ring * 4 + 1) { S.qk = null; S.qT = 75 + Math.random() * 90; } }
  function startQuake(Q) { const m = Q.m[0] + Math.random() * (Q.m[1] - Q.m[0]); S.qk = { t: 0, m, amp: 2 + (m - 2) * 2.2, ring: Q.ring * (.8 + m / 6), n: m > 3.8 ? 3 : m > 3 ? 2 : 1, dmg: Math.round(3 + (m - 2) * 4) };
    if (typeof snd === 'function') snd('rumble'); try { navigator.vibrate && navigator.vibrate([80, 40, 120, 40, 60]); } catch (e) {}
    S.ban = { k: 'earth', lab: `📈 Seismometer · ${Q.n} · magnitude ${m.toFixed(1)}`, txt: Q.f + (S.qN ? '' : ' Buildings near the shaking can take a little damage.'), t: 11 }; S.qN = (S.qN || 0) + 1; }
  /* 8) sound through the air */
  let airW = -1; function air() { if (typeof BUS === 'undefined' || !BUS || !BUS.m || !AC) return; if (!SR.af) { try { const f = AC.createBiquadFilter(), g = AC.createGain(); f.type = 'lowpass'; f.frequency.value = 20000; f.connect(g); g.connect(BUS.m); BUS.sfx.disconnect(); BUS.sfx.connect(f); SR.af = f; SR.ag = g; } catch (e) { SR.af = false; return; } }
    if (!SR.af) return; const w = S && S.run ? lv() : -1; if (w === airW) return; airW = w; const A = w < 0 ? [20000, 1] : (AIR[w] || [20000, 1]);
    try { SR.af.frequency.setTargetAtTime(A[0], AC.currentTime, .4); SR.ag.gain.setTargetAtTime(A[1], AC.currentTime, .4); } catch (e) {} }
  SR.air = air;
  /* HUD: temperature chip, dose on the radiation chip, Sun height on the day bar */
  function hud() { if (!S || !S.L) return; let el = document.getElementById('tmp'); const w = document.getElementById('wave'); if (!el && w) { el = document.createElement('div'); el.className = 'chip'; el.id = 'tmp'; el.setAttribute('role', 'button'); w.after(el);
      el.onclick = () => { if (!S || !S.run) return; const t = SR.temp(), T = TEMP[lv()] || TEMP[0]; say(`Outside: ${Math.round(t)}°C (this world ranges from ${T[0]} to ${T[1]}°C). Heaters are using ${(S.heatUse || 0).toFixed(1)} power a second. RTGs and reactors give off heat that cuts this.`); } }
    if (el) { const t = Math.round(SR.temp()), hot = t > 70, cold = t < -10; el.innerHTML = `🌡 <b>${t > 0 ? '+' : ''}${t}°C</b>${(S.heatUse || 0) > .05 ? `<small class="neg">${hot ? 'cool' : 'heat'} −${S.heatUse.toFixed(1)}⚡</small>` : ''}`; el.classList.toggle('w', (S.heatUse || 0) > .6); el.title = cold ? 'Heaters are on' : hot ? 'Radiators are working' : ''; }
    const rc = document.getElementById('r-rad'); if (rc && rc.children[2]) { rc.children[2].textContent = (S.dose || 0).toFixed(1) + ' mSv'; rc.children[2].className = ''; } }
  SR.hud = hud;
  /* dusty panels in the 2D view: the blue cells fade to the colour of the ground */
  if (typeof SP === 'object' && SP.solar) { const s0 = SP.solar; SP.solar = function (x, y, b) { s0.apply(this, arguments); const d = b && b.dust; if (d > .05 && typeof G !== 'undefined' && G) { const c = lv() === 1 ? '150,82,48' : lv() === 2 ? '120,112,104' : '138,138,146'; G.fillStyle = `rgba(${c},${Math.min(.75, d * .85)})`; G.fillRect(x + 1, y + 1, 14, 14); if (d > .3) { G.fillStyle = `rgba(${c},.9)`; G.fillRect(x + 3, y + 12, 3, 2); G.fillRect(x + 10, y + 4, 2, 2); } } }; }
  /* hooks */
  if (typeof update === 'function') { const u0 = update; window.update = update = function (dt) { u0.apply(this, arguments); try { SR.frame(dt || 0); } catch (e) { console.warn('realism', e); } }; }
  if (typeof hudUp === 'function') { const h0 = hudUp; window.hudUp = hudUp = function () { h0.apply(this, arguments); try { hud(); } catch (e) {} }; }
  if (typeof showDone === 'function') { const d0 = showDone; window.showDone = showDone = function () { const r = d0.apply(this, arguments); try { const ov = document.getElementById('ov'), d = S && S.dose; if (ov && d) { const p = document.createElement('p'); p.className = 'sub'; p.style.cssText = 'margin:6px 0 0;font-size:13px';
          p.textContent = `☢ Crew radiation dose on this world: ${d.toFixed(1)} mSv, about ${Math.max(1, Math.round(d / 3 * 12))} months of natural radiation on Earth (NASA’s career limit is 600 mSv).`; const box = ov.querySelector('.box,.card,.done,div'); (box || ov).appendChild(p); } } catch (e) {} return r; }; }
  if (typeof CHIPT === 'object') CHIPT.rad = 'Radiation from space. Lower is better. Shields block it. The number under it is your crew’s total dose in millisieverts (mSv); NASA limits an astronaut’s whole career to 600 mSv.';
  if (typeof CHIPT === 'object') CHIPT.pw = 'Power. Solar panels make the most when the Sun is high and almost nothing at dawn, dusk or night. Dust on panels cuts power too, and heaters need power when it is cold. Batteries store it.';
})();
