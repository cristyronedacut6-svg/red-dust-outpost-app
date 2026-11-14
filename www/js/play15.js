/* Red Dust Outpost · v15b (Nov 2026) · story mode changes from the team's playtest notes
   1) Pacing: at least 22 s of calm between big events (storms, Mission Control decisions, meteor showers).
   2) Advisor: when a bar runs low, a tip names the building that fixes it (tap it to select that building).
   3) "What hurt me": every damage shows its cause and the building that stops it.
   4) Placement in two steps: tap (or right-click) to put the outline down, tap it again (or ✓) to build.
   5) Construction: buildings take a few seconds to build, rising out of a scaffold, and work once finished.
   6) Purpose icons: picking a building shows what it makes and what it needs as icons. */
(function () {
  'use strict';
  const $ = q => document.querySelector(q);
  const ok = () => typeof S !== 'undefined' && S && S.run && !S.over && MODE === 'game';
  const GAP = 22;

  /* ---------------- what each building does, as icons ---------------- */
  const ic = n => (typeof I === 'function' ? I(n) : '');
  const PURPOSE = {
    solar: [['sun', 'sunlight'], ['➜'], ['bolt', '+ power']], battery: [['bolt', 'stores power'], ['➜'], ['moon', 'for the night']],
    o2: [['bolt', 'uses power'], ['➜'], ['air', '+ oxygen']], farm: [['bolt', 'uses power'], ['➜'], ['leaf', '+ food']],
    shield: [['rad', 'blocks radiation'], ['➜'], ['heart', 'storm shelter']], turret: [['bolt', 'uses power'], ['➜'], ['target', 'shoots aliens']],
    tesla: [['bolt', 'uses power'], ['➜'], ['zap', 'zaps aliens']], wall: [['wall', 'blocks'], ['➜'], ['target', 'stops aliens']],
    drill: [['bolt', 'uses power'], ['➜'], ['ore', '+ ore']], habitat: [['bed', '+2 beds'], ['➜'], ['smile', 'happier crew']],
    medbay: [['bolt', 'uses power'], ['➜'], ['heart', 'heals crew']], rtg: [['rad', 'nuclear'], ['➜'], ['bolt', 'power day + night']],
    reactor: [['rad', 'reactor'], ['➜'], ['bolt', 'lots of power']], pylon: [['pylon', 'carries power'], ['➜'], ['bolt', 'further away']] };
  const purposeHTML = k => (PURPOSE[k] || []).map(([i, t]) => t ? `<span class="pp"><b>${ic(i)}</b><small>${t}</small></span>` : `<span class="pa">${i}</span>`).join('');

  /* ---------------- styles ---------------- */
  const st = document.createElement('style'); st.id = 'play15css'; st.textContent = `
#u-adv{position:relative;z-index:7;order:12;grid-column:1/-1;display:none;align-items:center;gap:8px;padding:6px 8px 6px 10px;border-radius:10px;box-sizing:border-box;
  background:rgba(16,24,40,.92);border:2px solid #f2c14e;color:#fff;font:600 13px/1.25 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.4);pointer-events:auto}
#u-adv.hurt{border-color:#ff5466;background:rgba(48,12,20,.93)}
#u-adv .ai{flex:none;display:flex}#u-adv .ai .ic{width:22px;height:22px}#u-adv.hurt .ai .ic{color:#ff8a96}
#u-adv .at{flex:1;min-width:0}
#u-adv .at small{display:block;font-weight:500;opacity:.85;font-size:11.5px}
#u-adv button{flex:none;display:flex;align-items:center;gap:5px;border:0;border-radius:8px;padding:5px 9px;background:#f2c14e;color:#1a1306;font:800 12px system-ui;cursor:pointer}
#u-adv.hurt button{background:#ff8a96}
#u-adv button img{width:22px;height:22px;image-rendering:pixelated}
#u-pur{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--sb,0px) + 104px);z-index:6;display:none;align-items:center;gap:6px;padding:6px 10px;border-radius:12px;
  background:rgba(14,12,30,.92);border:1px solid rgba(255,255,255,.22);color:#fff;font:600 12px system-ui;pointer-events:none;white-space:nowrap}
#u-pur img{width:30px;height:30px;image-rendering:pixelated;margin-right:2px}
#u-pur .pn{font-weight:800;font-size:13px;margin-right:4px}
#u-pur .pp{display:flex;flex-direction:column;align-items:center;line-height:1.05}
#u-pur .pp b{display:flex}#u-pur .pp b .ic{width:24px;height:24px}#u-pur .pt .ic{width:13px;height:13px;vertical-align:-2px} #u-pur .pp small{font-size:10px;opacity:.8}
#u-pur .pa{font-size:18px;opacity:.7}
#u-pur .pt{font-size:11px;opacity:.85;border-left:1px solid rgba(255,255,255,.25);padding-left:8px;margin-left:2px}
#u-place{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--sb,0px) + 104px);z-index:6;display:none;padding:6px 12px;border-radius:999px;background:rgba(18,60,30,.94);
  border:2px solid #5fe08a;color:#fff;font:700 13px system-ui;pointer-events:none;white-space:nowrap}
html body #stage #dock #bh.u-conf{background:#5fe08a!important;color:#062010!important;border-color:#fff!important;box-shadow:0 0 0 3px rgba(95,224,138,.45),0 0 18px rgba(95,224,138,.6)!important}
@media (max-height:540px){#u-adv{font-size:11px;padding:3px 6px 3px 8px}#u-adv .at small{font-size:10.5px}#u-adv .ai{font-size:16px}#u-adv button{padding:4px 7px;font-size:11px}#u-adv button img{width:16px;height:16px}
  #u-pur,#u-place{bottom:calc(var(--sb,0px) + 118px);font-size:11px;padding:4px 8px}#u-pur .pp b .ic{width:18px;height:18px}#u-pur img{width:22px;height:22px}#u-pur .pt{display:none}}
`;
  document.head.appendChild(st); addEventListener('load', () => document.body.appendChild(st));
  const stage = () => $('#stage');
  function el(id) { let e = $('#' + id); if (!e && stage()) { e = document.createElement('div'); e.id = id; e.className = 'ui'; (id === 'u-adv' && $('#top') ? $('#top') : stage()).appendChild(e); } return e; }

  /* ---------------- 1) pacing ---------------- */
  const P = { last: -999, storm: 0, evT: 0, metT: 0, cin: null };
  function paceBefore() { if (!ok() || S.tu != null || S.scen) return; const rem = GAP - (S.t - P.last); if (rem <= 0) return;
    if (!(S.storm > 0) && S.stormNext < S.t + rem) S.stormNext = S.t + rem;
    if (S.evT > 0 && S.evT < rem) S.evT = rem;
    if (S.metT != null && S.metT < rem) S.metT = rem; }
  function paceAfter() { if (!ok()) return;
    const stormStart = S.storm > 0 && !(P.storm > 0), evFired = P.evT > 0 && !(S.evT > 0), met = S.metT != null && S.metT > P.metT + 20;
    if (stormStart) { P.last = S.t; if (S.stormNext < S.t + 95) S.stormNext = S.t + 80 + Math.random() * 30; }   // storms come less often
    if (evFired || met) P.last = S.t;
    P.storm = S.storm; P.evT = S.evT; P.metT = S.metT; }

  /* ---------------- 2+3) advisor and damage causes ---------------- */
  const FIX = [ // keyword in the damage reason -> building that stops it
    [/oxygen|air/i, 'o2', 'Build an O₂ Generator'], [/food|hungry|starv/i, 'farm', 'Build a Farm'], [/radiation|flare|storm/i, 'shield', 'Stand next to a Shield'],
    [/power|cold|froze|freez/i, 'solar', 'Build Solar panels and a Battery'], [/alien|kraken|charger|queen|tentacle|rammed|bit|attack/i, 'turret', 'Build a Turret'],
    [/fire|smoke|scorcher/i, 'medbay', 'Step away and heal at a Medbay'], [/sick|pushed/i, 'medbay', 'Build a Medbay'] ];
  const usable = k => BT[k] && S.sol >= BT[k].ul && techOk(k) && (typeof bfeat !== 'function' || bfeat(k));
  const nameOf = k => (BT[k] && BT[k].n) || k;
  let ADV = { key: '', t: 0, hurt: 0, seen: {} };
  function advShow(key, icon, title, sub, k, hurt) {
    const e = el('u-adv'); if (!e) return; ADV.key = key; ADV.t = hurt ? 4.5 : 9; ADV.hurt = hurt ? 1 : 0;
    const b = k && usable(k) ? `<button data-k="${k}">${ICON[k] ? `<img src="${ICON[k]}" alt="">` : ''}${nameOf(k)}</button>` : '';
    e.className = 'ui' + (hurt ? ' hurt' : ''); e.innerHTML = `<span class="ai">${ic(icon)}</span><span class="at">${title}<small>${sub}</small></span>${b}`; e.style.display = 'flex';
    const bt = e.querySelector('button'); if (bt) bt.onclick = ev => { ev.stopPropagation(); pick(k); };
  }
  function pick(k) { if (!usable(k)) return; sel = k; try { snd('sel', 2); } catch (e) {} dockUp(); clearPend(); purposeShow(k, true); }
  function advise() { if (!ok() || S.tu != null || S.pz || S.cin || S.land > 0) return;
    const r = S.res, nt = typeof night === 'function' ? night() : false, low = [];
    if (r.o2 < 35) low.push(['o2', 'air', 'Oxygen is low', 'O₂ Generators make air (they need power).']);
    if (r.fd < 35) low.push(['farm', 'leaf', 'Food is low', 'Farms grow food (they need power).']);
    if (r.pw < 25 || (S.rate && S.rate.pw < -.05 && r.pw < 45)) low.push(nt ? ['battery', 'bolt', 'Power is running out', 'It is night: Batteries store daytime solar power.'] : ['solar', 'bolt', 'Power is low', 'Solar panels make power in sunlight.']);
    if (r.rad > 60 && !(S.storm > 0)) low.push(['shield', 'rad', 'Radiation is high', 'Shields (regolith walls) block it.']);
    if (S.hp < 45) low.push(['medbay', 'heart', 'Health is low', 'A Medbay heals the crew. Keep air and food up.']);
    if (typeof crewCap === 'function' && S.crew > crewCap()) low.push(['habitat', 'bed', 'Not enough beds', 'A Habitat gives the crew 2 more beds.']);
    const c = typeof core === 'function' && core(); if (c && S.al.some(a => !a.hid && Math.hypot(a.x - c.x - 16, a.y - c.y - 16) < 140) && !S.b.some(b => b.t === 'turret')) low.push(['turret', 'target', 'Aliens near your base', 'Turrets shoot them for you.']);
    const L = low.find(x => usable(x[0])); if (!L) return; const key = 'low-' + L[0]; if (ADV.key === key && ADV.t > 0) return; if (ADV.seen[key] && S.t - ADV.seen[key] < 25) return;
    ADV.seen[key] = S.t; advShow(key, L[1], L[2], L[3] + ' Tap to pick it:', L[0], false); }
  function advStep(dt) { const e = $('#u-adv'); if (!e) return; if (!ok() || S.cin) { e.style.display = 'none'; return; } if (ADV.t > 0) { ADV.t -= dt; if (ADV.t <= 0) { e.style.display = 'none'; ADV.key = ''; } } }
  if (typeof hurt === 'function') { const _h = hurt; hurt = function (n, why, tip) { const r = _h.apply(this, arguments);
    try { if (ok() && n > 0 && why) { const f = FIX.find(x => x[0].test(why)), key = 'hurt-' + why; if (!(ADV.key === key && ADV.t > 0) && !(ADV.seen[key] && S.t - ADV.seen[key] < 6)) { ADV.seen[key] = S.t;
      advShow(key, 'warn', `−${Math.max(1, Math.round(n))} health · ${String(why).replace(/<[^>]*>/g, '')}`, f ? f[2] + ' to stop it.' : (tip ? String(tip).replace(/<[^>]*>/g, '').slice(0, 110) : ''), f && f[1], true); } } } catch (e) {}
    return r; }; }

  /* ---------------- 6) purpose strip ---------------- */
  let PUR = 0;
  function purposeShow(k, force) { const e = el('u-pur'); if (!e || !BT[k]) return; e.innerHTML = `${ICON[k] ? `<img src="${ICON[k]}" alt="">` : ''}<span class="pn">${nameOf(k)}</span>${purposeHTML(k)}<span class="pt">${costOf(k)} ${ic('ore')} · tap the ground, then tap again to build</span>`;
    e.style.display = 'flex'; PUR = force ? 6 : 4; }
  // hook the build cards: picking one shows its purpose
  function hookCards() { document.querySelectorAll('#cards .card').forEach(c => { if (c._p15) return; c._p15 = 1; c.addEventListener('click', () => { if (ok()) { clearPend(); purposeShow(c.dataset.k, true); } }); }); }
  setInterval(hookCards, 1000);

  /* ---------------- 4) two-step placement ---------------- */
  let PEND = null;
  function clearPend() { PEND = null; const b = $('#bh'); if (b) b.classList.remove('u-conf'); bhLabel('Build'); const p = $('#u-place'); if (p) p.style.display = 'none'; }
  function bhLabel(t) { const b = $('#bh'); if (!b) return; for (const n of b.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { if (n.textContent.trim() !== t) n.textContent = t; return; } }
  function setPend(x, y) { if (!free(x, y)) { say('That spot is taken. Tap an empty spot.'); try { snd('no'); } catch (e) {} return; }
    if (Math.hypot(x + 8 - S.p.x, y + 8 - S.p.y) > 125) { say('Too far away. Walk closer, then tap the spot.'); try { snd('no'); } catch (e) {} return; }
    PEND = { x, y, t: sel }; const b = $('#bh'); if (b) b.classList.add('u-conf'); bhLabel('✓ Build');
    const p = el('u-place'); if (p) { p.textContent = innerHeight < 540 ? 'Tap again to build' : `Tap the outline again or ✓ Build to build the ${nameOf(sel)}`; p.style.display = 'block'; }
    const pu = $('#u-pur'); if (pu) pu.style.display = 'none'; try { snd('sel', 4); } catch (e) {} }
  function confirmPend() { const g = PEND; clearPend(); if (g) place(sel, g.x, g.y); }
  if (typeof ghost === 'function') { const _g = ghost; ghost = function () { if (PEND && ok() && sel === PEND.t && !S.cin && !S.photo) return { x: PEND.x, y: PEND.y }; return _g(); }; }
  if (typeof buildNow === 'function') { buildNow = function () { if (!ok() || S.pz || S.land > 0 || S.winT > 0) return; if (PEND && PEND.t === sel) return confirmPend();
      const g = ghost(); if (!g) { say('No free space here. Move a little and try again.'); try { snd('no'); } catch (e) {} return; } setPend(g.x, g.y); };
    const bh = $('#bh'); if (bh) bh.onclick = () => buildNow(); }
  if (typeof tap === 'function') { const _t = tap; tap = function (cx, cy) {
    if (!ok() || S.pz || S.land > 0 || S.winT > 0 || !sel) return _t(cx, cy);
    const r = cv.getBoundingClientRect(); let x = (cx - r.left) * W / r.width + CAM.x, y = (cy - r.top) * H / r.height + CAM.y; const v3 = window.R3 && R3.on();
    if (v3) { const q = R3.pick(cx, cy); if (!q) return; x = q.x; y = q.y; }
    if (S.rv && Math.hypot(x - S.rv.x, y - S.rv.y) < 14) return _t(cx, cy);
    const b = (v3 && R3.pickB(cx, cy)) || S.b.find(b => x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.y + b.w + 3); if (b) { clearPend(); return _t(cx, cy); }
    closeInsp(); const gx = Math.floor(x / 16) * 16, gy = Math.floor(y / 16) * 16;
    if (PEND && PEND.t === sel && Math.abs(gx - PEND.x) <= 16 && Math.abs(gy - PEND.y) <= 16) return confirmPend();
    setPend(gx, gy); }; }

  /* ---------------- 5) construction ---------------- */
  const BUILD_T = t => Math.max(2.2, Math.min(6, 1.6 + costOf(t) * .13));
  if (typeof place === 'function') { const _pl = place; place = function (t, x, y, who) { const n0 = S.b.length; const r = _pl.apply(this, arguments);
    try { if (S.b.length > n0) { const b = S.b[S.b.length - 1]; if (b && b.t === t && !b.cst) { b.cst = BUILD_T(t); b.cstT = 0; b.dis = true; b.pop = -1;
      ftxt(b.x + 8, b.y - 4, 'Building…', '#ffe066'); } } } catch (e) {} return r; }; }
  function conStep(dt) { if (!ok()) return; for (const b of S.b) { if (!b.cst) continue; b.cstT += dt; b.pop = -1; b.dis = true;
      if (Math.random() < dt * 7) S.pt.push({ x: b.x + 2 + Math.random() * 12, y: b.y + 14 - Math.random() * 14 * (b.cstT / b.cst), vx: (Math.random() - .5) * 30, vy: -20 - Math.random() * 30, l: .35, ml: .35, c: Math.random() < .5 ? '#ffe066' : '#ffffff', s: 1.5 });
      if (b.cstT >= b.cst) { b.cst = 0; b.dis = false; b.pop = 0; try { sparkle(b.x + 8, b.y + 8); ftxt(b.x + 8, b.y - 4, nameOf(b.t) + ' ready!', '#9fffb0'); snd('bld'); vib(15); } catch (e) {} } } }
  // 2D: draw the building rising out of a scaffold, with a progress bar
  if (typeof draw === 'function') { const _d = draw; draw = function () { _d(); try { if (!ok() || (window.R3 && R3.on())) return; const sites = S.b.filter(b => b.cst); if (!sites.length) return;
      const o = G; G = X; X.save(); X.translate(-Math.round(CAM.x), -Math.round(CAM.y));
      for (const b of sites) { const k = Math.min(1, b.cstT / b.cst), w = b.w || 16, hh = Math.max(1, Math.round(w * k));
        X.fillStyle = 'rgba(0,0,0,.3)'; X.fillRect(b.x + 1, b.y + w - 1, w, 3);
        X.save(); X.beginPath(); X.rect(b.x - 4, b.y + w - hh, w + 8, hh + 2); X.clip(); X.globalAlpha = .55 + .45 * k; try { SP[b.t](b.x, b.y, { a: -1.57, lv: 1 }); } catch (e) {} X.restore();
        X.strokeStyle = '#d9a441'; X.lineWidth = 1; X.globalAlpha = .9;   // scaffold poles and cross braces
        for (const sx of [b.x, b.x + w]) { X.beginPath(); X.moveTo(sx + .5, b.y + w); X.lineTo(sx + .5, b.y - 3); X.stroke(); }
        X.beginPath(); X.moveTo(b.x, b.y + w); X.lineTo(b.x + w, b.y - 3); X.moveTo(b.x + w, b.y + w); X.lineTo(b.x, b.y - 3); X.stroke(); X.globalAlpha = 1;
        X.fillStyle = 'rgba(0,0,0,.6)'; X.fillRect(b.x - 2, b.y - 8, w + 4, 4); X.fillStyle = '#ffe066'; X.fillRect(b.x - 1, b.y - 7, (w + 2) * k, 2); }
      X.restore(); G = o; } catch (e) {} }; }

  /* ---------------- per-frame ---------------- */
  if (typeof update === 'function') { const _u = update; update = function (dt) { try { paceBefore(); } catch (e) {} _u(dt);
      try { paceAfter(); conStep(dt); advStep(dt); if (Math.random() < dt * 2) advise();
        if (PUR > 0) { PUR -= dt; if (PUR <= 0) { const e = $('#u-pur'); if (e) e.style.display = 'none'; } }
        if (PEND && (PEND.t !== sel || !free(PEND.x, PEND.y))) clearPend(); } catch (e) { console.warn('play15', e); } }; }
  setInterval(() => { if (!ok()) { ['u-adv', 'u-pur', 'u-place'].forEach(i => { const e = $('#' + i); if (e) e.style.display = 'none'; }); if (PEND) clearPend(); } }, 500);
  window.P15 = { clearPend, get pend() { return PEND; } };
})();
