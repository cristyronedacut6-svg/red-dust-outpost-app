/* Red Dust Outpost · v15 (Nov 2026)
   1) Story mode HUD laid out like the team's mockup: status top-left, objective under the bars, big map top-right,
      Choose/Build bottom-centre, action buttons in a cluster bottom-right. Only positions and sizes change.
   2) Radiation storms: during a solar storm radiation slowly drains your health unless you stand next to a
      Shield (regolith wall), are under Earth's shield dome, or shelter. It stops when the storm ends.
   3) Kai and Mika portraits in cutscenes, mouth moving while they speak. */
(function () {
  'use strict';
  const $ = q => document.querySelector(q);
  const L = 'html body #stage';   // high specificity so this layout wins over the older layered rules

  /* ---------------- 1) HUD layout ---------------- */
  const css = `
@media (min-aspect-ratio: 1/1) {
${L} #top{left:calc(12px + var(--sl,0px))!important;top:calc(10px + var(--st,0px))!important;right:auto!important;width:min(470px,40vw)!important;max-width:none!important;
  display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:6px!important;align-items:start!important}
${L} #top > .row:first-child{display:flex!important;flex-wrap:nowrap!important;gap:0!important;order:0;align-items:stretch!important;max-width:none!important;overflow:visible!important}
${L} #top > .row:first-child > .chip{border-radius:0!important;margin:0!important;height:30px!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;gap:4px!important;
  background:rgba(22,20,44,.9)!important;border:2px solid rgba(255,255,255,.22)!important;border-left-width:0!important;padding:0 8px!important;font-size:14px!important}
${L} #top #wave > .wn:first-child,${L} #top #wave .daybar{display:none!important}
${L} #top #wave{order:0;border-left-width:2px!important;border-radius:8px 0 0 8px!important;font-weight:800!important}
${L} #top #misb{order:1;border-radius:0 8px 8px 0!important;margin-right:10px!important}
${L} #top #tmp{order:2;border-left-width:2px!important;border-radius:8px 0 0 8px!important}
${L} #top #cr{order:3} ${L} #top #ore{order:4}
${L} #top #crew{order:5;border-radius:0 8px 8px 0!important}
${L} #top #disc{display:none!important}
${L} #tr #rkb{width:40px!important;height:40px!important;padding:0!important;border-radius:8px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:14px!important;position:static!important}
${L} #top #res{display:contents!important}
${L} #top .chip.res{background:none!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important;display:grid!important;
  grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:6px!important;width:auto!important;height:auto!important}
${L} #top .chip.res .mb{width:auto!important;height:12px!important;border-radius:4px!important;background:rgba(10,8,24,.78)!important;border:2px solid rgba(255,255,255,.22)!important;overflow:hidden!important;position:relative!important;grid-column:2!important;grid-row:1!important}
${L} #top .chip.res .mb i{height:100%!important;border-radius:0!important}
${L} #top .chip.res .ri{grid-column:1!important;grid-row:1!important;font-size:15px!important;width:20px!important;text-align:center!important}
${L} #top .chip.res b{grid-column:3!important;grid-row:1!important;font-size:12px!important;min-width:26px!important;text-align:right!important}
${L} #top .chip.res small{display:none!important}
${L} #top #r-hp{order:1}
${L} #top #r-hp .mb{height:24px!important;border-radius:6px!important}
${L} #top #r-hp .ri{font-size:30px!important;width:34px!important;margin-right:-14px!important;position:relative!important;z-index:1!important;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))}
${L} #top #r-hp b{font-size:15px!important}
${L} #top #r-fd{order:2;margin-left:22px!important}
${L} #top #r-fd .mb{height:14px!important}
${L} #top #r-fd .mb::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(to right,transparent 0 calc(20% - 3px),rgba(10,8,24,.95) calc(20% - 3px) 20%);pointer-events:none}
${L} #top #u-obj{order:3;display:flex!important;align-items:center!important;min-height:44px!important;box-sizing:border-box!important;width:auto!important;max-width:none!important;
  border-radius:8px!important;padding:6px 12px!important;font-size:15px!important;line-height:1.25!important;white-space:normal!important}
${L} #top #r-pw{order:4;width:62%!important} ${L} #top #r-o2{order:5;width:62%!important}
${L} #top #r-pw .mb,${L} #top #r-o2 .mb{height:18px!important}
${L} #top #r-rad{order:6;width:62%!important} ${L} #top #r-mo{order:7;width:62%!important}
${L} #top #r-rad:not(.hot){display:none!important}
${L} #top #r-mo:not(.low){display:none!important}
${L} #top #misp{order:8}
${L} #top #feed{order:9;position:fixed!important;left:calc(30px + var(--sl,0px) + min(470px,40vw))!important;top:calc(10px + var(--st,0px))!important;transform:none!important;width:min(440px,calc(100vw - min(470px,40vw) - min(300px,26vw) - 70px - var(--sl,0px) - var(--sr,0px)))!important;max-width:none!important;z-index:6!important}
${L} #top #feed .ban,${L} #top #feed .msg{max-width:none!important;width:auto!important}
${L} #party{top:calc(var(--st,0px) + 46%)!important;left:calc(14px + var(--sl,0px))!important;gap:10px!important}
${L} #tr{top:calc(10px + var(--st,0px))!important;right:calc(12px + var(--sr,0px))!important;position:absolute!important;display:block!important;width:min(300px,26vw)!important}
${L} #tr #mm{display:block!important;width:100%!important;height:auto!important;aspect-ratio:14/9!important;border-radius:10px!important;border:2px solid rgba(255,255,255,.25)!important;opacity:.96!important}
${L} #tr > .r:first-child{position:absolute!important;top:8px!important;right:8px!important;z-index:2!important;display:flex!important;gap:6px!important;flex-direction:row!important}
${L} #tr #bShop{font-size:0!important;width:40px!important;height:40px!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:8px!important}
${L} #tr #bShop > *{font-size:18px!important}
${L} #tr #bShop svg,${L} #tr #bShop img{width:22px!important;height:22px!important}
${L} #tr #u-more{width:40px!important;height:40px!important;padding:0!important;font:900 20px/1 system-ui!important;border-radius:8px!important;letter-spacing:1px!important}
${L} #tr:not(.more) #b3d,${L} #tr:not(.more) #bPause{display:none!important}
${L} #tr.more > .r:first-child{flex-wrap:wrap!important;justify-content:flex-end!important;width:100px!important}
${L} #tr.more #b3d,${L} #tr.more #bPause{width:46px!important;height:40px!important}
${L} #tr #nextw{margin-top:6px!important;width:100%!important}
${L} #tr .v3o{margin-top:6px!important;justify-content:flex-end!important}
${L} #dock{left:50%!important;right:auto!important;transform:translateX(-50%)!important;bottom:calc(10px + var(--sb,0px))!important;max-width:none!important;display:flex!important;gap:10px!important;align-items:flex-end!important}
${L} #dock #bsel{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;width:84px!important;height:84px!important;border-radius:12px!important}
${L} #dock #bsel .g4{display:grid!important;grid-template-columns:repeat(2,15px)!important;gap:3px!important;margin-bottom:5px!important}
${L} #dock #bsel .g4 i{display:block!important;width:15px!important;height:15px!important;border-radius:3px!important;border:2px solid currentColor!important;opacity:.75}
${L} #dock #bh{width:84px!important;height:84px!important;border-radius:12px!important}
${L} #dock:not(.open) #cards{display:none!important}
${L} #dock.open #cards{position:absolute!important;bottom:calc(100% + 10px)!important;left:50%!important;transform:translateX(-50%)!important;display:flex!important;flex-wrap:wrap!important;justify-content:center!important;
  width:max-content!important;max-width:min(640px,calc(100vw - 40px))!important;background:rgba(14,12,30,.92)!important;border:1px solid rgba(255,255,255,.2)!important;border-radius:12px!important;padding:8px!important;gap:6px!important}
${L} #act{right:calc(12px + var(--sr,0px))!important;bottom:calc(12px + var(--sb,0px))!important;left:auto!important;top:auto!important;width:320px!important;height:330px!important;display:block!important;pointer-events:none!important}
${L} #act > *,${L} #act #bdcol > *,${L} #act .col > *{pointer-events:auto}
${L} #act .col,${L} #act #bdcol{display:contents!important}
${L} #act .rb{position:absolute!important;margin:0!important;border-radius:50%!important;transform:none!important}
${L} #act #fire{right:0!important;bottom:0!important;width:118px!important;height:118px!important}
${L} #act #burst{right:22px!important;bottom:130px!important;width:88px!important;height:88px!important}
${L} #act #earth{right:10px!important;bottom:228px!important;width:72px!important;height:72px!important}
${L} #act #emp{right:132px!important;bottom:70px!important;width:88px!important;height:88px!important}
${L} #act #dodge{right:136px!important;bottom:-2px!important;width:68px!important;height:68px!important}
${L} #act #wsw{right:216px!important;bottom:-2px!important;width:62px!important;height:62px!important}
}
@media (min-aspect-ratio: 1/1) and (max-height: 540px) {
${L} #top{width:min(356px,42vw)!important;gap:4px!important}
${L} #top #wave .wn{display:none!important}
${L} #top > .row:first-child > .chip{height:24px!important;font-size:12px!important;padding:0 6px!important}
${L} #top #r-hp .mb{height:16px!important} ${L} #top #r-hp .ri{font-size:22px!important;width:26px!important;margin-right:-10px!important}
${L} #top #r-fd .mb{height:10px!important} ${L} #top #r-pw .mb,${L} #top #r-o2 .mb{height:11px!important}
${L} #top .chip.res .ri{font-size:12px!important;width:16px!important} ${L} #top .chip.res b{font-size:11px!important}
${L} #top #u-obj{min-height:30px!important;font-size:12px!important;padding:4px 8px!important}
${L} #top #feed{left:calc(22px + var(--sl,0px) + min(356px,42vw))!important;width:calc(100vw - min(356px,42vw) - min(190px,24vw) - 50px - var(--sl,0px) - var(--sr,0px))!important;font-size:11.5px!important;line-height:1.3!important}
${L} #top #feed .ban{padding:4px 8px!important;font-size:11.5px!important}
${L} #party{top:calc(var(--st,0px) + 52%)!important;gap:6px!important}
${L} #tr{width:min(190px,24vw)!important}
${L} #tr #bShop,${L} #tr #u-more,${L} #tr #rkb{width:32px!important;height:32px!important}
${L} #dock #bsel,${L} #dock #bh{width:62px!important;height:62px!important;font-size:12px!important}
${L} #dock #bsel .g4{grid-template-columns:repeat(2,11px)!important;margin-bottom:3px!important}${L} #dock #bsel .g4 i{width:11px!important;height:11px!important}
${L} #act{transform:scale(.66)!important;transform-origin:100% 100%!important}
}
#radw{position:absolute;left:50%;top:calc(var(--st,0px) + 33%);transform:translateX(-50%);z-index:8;pointer-events:none;display:none;text-align:center;
  font:800 16px/1.3 system-ui,sans-serif;color:#fff;padding:8px 16px;border-radius:12px;background:rgba(60,70,10,.86);border:2px solid #d7ff3a;box-shadow:0 0 24px rgba(215,255,58,.45);letter-spacing:.02em}
#radw.safe{background:rgba(10,60,50,.86);border-color:#4dffc3;box-shadow:0 0 18px rgba(77,255,195,.35)}
#radw small{display:block;font-weight:600;font-size:12.5px;opacity:.9}
#radv{position:absolute;inset:0;pointer-events:none;z-index:4;opacity:0;transition:opacity .4s;background:radial-gradient(ellipse at center,transparent 45%,rgba(190,255,40,.33) 100%)}
#radv.on{opacity:1;animation:radp 1.1s ease-in-out infinite}
@keyframes radp{50%{opacity:.55}}
@media (max-height:540px){#radw{font-size:13px;padding:5px 10px;top:calc(var(--st,0px) + 30%)}#radw small{font-size:11px}}
#cutimg{width:84px;height:84px;border-radius:10px;flex:none;border:1px solid var(--line,rgba(255,255,255,.2));object-fit:cover;display:none;background:#222}
@media (max-height:540px){#cutimg{width:54px;height:54px}}
#ban .banpor{float:left;width:44px;height:44px;border-radius:8px;margin:0 9px 2px 0;object-fit:cover;border:1px solid rgba(255,255,255,.22)}
@media (max-height:540px){#ban .banpor{width:32px;height:32px}}
`;
  const st = document.createElement('style'); st.id = 'hud15css'; st.textContent = css; document.head.appendChild(st);
  // move the stylesheet to the very end of <body> once the page is built, so it comes after every older rule
  addEventListener('load', () => document.body.appendChild(st));

  function setupHud() {
    const tr = $('#tr'), row = tr && tr.querySelector('.r');
    if (row && !$('#u-more')) {
      const b = document.createElement('button'); b.className = 'tb'; b.id = 'u-more'; b.setAttribute('aria-label', 'More: 3D view and pause'); b.textContent = '⋯';
      b.onclick = e => { e.stopPropagation(); tr.classList.toggle('more'); try { snd('ui'); } catch (er) {} };
      row.appendChild(b);
      const rk = $('#rkb'); if (rk) row.insertBefore(rk, row.firstChild);   // commander rank sits with the shop over the map
      // tapping 3D or pause closes the little menu again
      ['#b3d', '#bPause'].forEach(q => { const x = $(q); if (x) x.addEventListener('click', () => tr.classList.remove('more')); });
    }
    const mm = $('#mm'); if (mm && mm.width < 280) { mm.width = 280; mm.height = 180; }
  }
  setupHud(); addEventListener('load', setupHud);

  /* ---------------- 2) radiation storms ---------------- */
  const RAD = { r: 44, safe: false, on: false, pulse: 0, warned: 0, built: 0 };
  function radEl() { let w = $('#radw'); if (!w) { const s = $('#stage'); if (!s) return null; w = document.createElement('div'); w.id = 'radw'; s.appendChild(w); const v = document.createElement('div'); v.id = 'radv'; s.appendChild(v); } return w; }
  function shields() { return S.b.filter(b => b.t === 'shield' && !b.nc && !b.dis && !(b.hp <= 0)); }
  function nearShield(sh) { const p = S.p; let best = 1e9, bs = null; for (const b of sh) { const d = Math.hypot(b.x + (b.w || 16) / 2 - p.x, b.y + (b.w || 16) / 2 - p.y); if (d < best) { best = d; bs = b; } } return { d: best, b: bs }; }
  function radStep(dt) {
    const w = radEl(); if (!w) return; const v = $('#radv');
    const live = typeof S !== 'undefined' && S && S.run && !S.over && !S.pz && MODE === 'game' && !S.cin && !(S.land > 0) && !(S.winT > 0) && S.tu == null && !S.scen;
    const storm = live && S.storm > 0 && S.storm < 1e8;
    if (!storm) { if (RAD.on) { RAD.on = false; w.style.display = 'none'; v && v.classList.remove('on'); if (live) try { say('☢ The radiation is gone. You are safe to move around again.'); } catch (e) {} } return; }
    const sh = shields(), n = nearShield(sh), byWall = n.b && n.d < RAD.r, dome = (S.dome || 0) > 0 || (S.shel || 0) > .21;
    // the storm's radiation is handled here (per player, by position), so switch off the old base-wide storm damage meanwhile
    S.shel = Math.max(S.shel || 0, .2);
    const safe = byWall || dome;
    if (!RAD.on) { RAD.on = true; RAD.warned = 0;
      try { S.ban = { k: 'earth', txt: sh.length ? `☢ ${S.L.sn}! Radiation is draining your health. Stand right next to a Shield until the storm ends.` : `☢ ${S.L.sn}! Radiation is draining your health. Build a Shield (regolith wall) and stand next to it until the storm ends.`, t: 9, lab: '🌍 Earth Mission Control' }; } catch (e) {} }
    // drain: about 1.5 health a second (a bit more on Europa, less on easy), never while protected
    if (!safe) { const k = (S.L.sr || 35) / 38 * (S.mod && S.mod.hurt || 1); S.hp -= 1.6 * k * dt; S.hf = Math.max(S.hf || 0, .06);
      S.why = 'Radiation from the ' + S.L.sn.toLowerCase() + ' was too strong.'; S.tip = 'During a storm, stand next to a Shield (regolith wall) or call Earth for a shield dome. Radiation stops when the storm ends.';
      if (S.hp <= 0 && !S.over) { try { fail(); } catch (e) {} } }
    // pulsing safe zones around every shield, so the player sees where to stand
    RAD.pulse -= dt; if (RAD.pulse <= 0) { RAD.pulse = .9; for (const b of sh) S.ring.push({ x: b.x + (b.w || 16) / 2, y: b.y + (b.w || 16) / 2, r: RAD.r - 10, l: .35 }); }
    const left = Math.ceil(S.storm);
    w.className = safe ? 'safe' : ''; w.style.display = 'block';
    w.innerHTML = safe ? `🛡 Shielded from radiation<small>${byWall ? 'Stay next to the wall' : 'Earth’s dome is protecting you'} · storm ends in ${left} s</small>`
      : `☢ RADIATION · losing health<small>${sh.length ? 'Get right next to a Shield' : 'Build a Shield (regolith wall) and stand next to it'} · ${left} s left</small>`;
    v && v.classList.toggle('on', !safe);
    const rc = $('#r-rad'); if (rc) rc.classList.add('hot');
  }
  // keep the radiation chip visible only when it matters, mood only when low
  // Mika's face on Mission Control messages during play; her mouth moves while the message is read aloud
  function banFace() { const bn = $('#ban'); if (!bn || bn.hidden) return; const lab = bn.querySelector('.lab'); if (!lab || !/Mission Control/i.test(lab.textContent)) return;
    let im = bn.querySelector('.banpor'); if (!im) { im = document.createElement('img'); im.className = 'banpor'; im.alt = ''; const d = bn.firstElementChild; if (d) d.insertBefore(im, d.firstChild); }
    const sp = window.speechSynthesis && speechSynthesis.speaking; const src = `img/crew/mika_${sp && (Date.now() / 130 | 0) % 2 === 0 ? 'open' : 'closed'}.webp`; if (im.getAttribute('src') !== src) im.setAttribute('src', src); }
  setInterval(() => { try { banFace(); } catch (e) {} }, 90);
  function chipFlags() { if (typeof S === 'undefined' || !S || !S.res) return; const rc = $('#r-rad'), mc = $('#r-mo');
    if (rc) rc.classList.toggle('hot', S.storm > 0 || S.res.rad > 55); if (mc) mc.classList.toggle('low', S.morale != null && S.morale < 40); }
  if (typeof update === 'function') { const _u = update; update = function (dt) { _u(dt); try { radStep(dt); chipFlags(); } catch (e) { console.warn('rad', e); } }; }

  /* ---------------- 3) Kai and Mika portraits ---------------- */
  const CREW = { kai: /KAI/i, mika: /MIKA/i };
  function cutImg() { let im = $('#cutimg'); if (!im) { const c = $('#cutp'); if (!c) return null; im = document.createElement('img'); im.id = 'cutimg'; im.alt = ''; c.parentNode.insertBefore(im, c); } return im; }
  if (typeof portrait === 'function') { const _p = portrait; portrait = function (talk) {
    try { const sc = CUT && CUT.list[CUT.i], who = String(sc && sc.who || ''); const k = CREW.kai.test(who) ? 'kai' : CREW.mika.test(who) ? 'mika' : null; const im = cutImg(), c = $('#cutp');
      if (k && im) { const sp = (typeof CUTA !== 'undefined' && CUTA && !CUTA.paused && !CUTA.ended) || talk; const open = sp && (Date.now() / 130 | 0) % 2 === 0;
        const src = `img/crew/${k}_${open ? 'open' : 'closed'}.webp`; if (im.getAttribute('src') !== src) im.setAttribute('src', src); im.style.display = 'block'; if (c) c.style.display = 'none'; return; }
      if (im) im.style.display = 'none'; if (c) c.style.display = ''; } catch (e) {}
    return _p(talk); }; }
  // keep the mouth moving while the recording plays, even after the subtitle has finished typing
  setInterval(() => { try { const cut = $('#cut'); if (!cut || cut.hidden || !CUT || typeof portrait !== 'function') return; const sc = CUT.list[CUT.i]; if (!sc) return;
    const who = String(sc.who || ''); if (!(CREW.kai.test(who) || CREW.mika.test(who))) return; portrait(CUT.ch < String(sc.t || '').length); } catch (e) {} }, 70);
  // preload so the first mouth flap does not blink
  ['kai_closed', 'kai_open', 'mika_closed', 'mika_open'].forEach(n => { const i = new Image(); i.src = `img/crew/${n}.webp`; });
})();
