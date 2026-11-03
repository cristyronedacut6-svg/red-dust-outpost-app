/*
  Red Dust Outpost · controller support (Xbox / PlayStation / generic, standard mapping)
  - Menus: D-pad or left stick moves a gold focus ring between buttons, A selects, B goes back.
  - Main game: left stick moves, A or RT fires, X dodges, B = EMP, Y = build, LB = swap weapon,
    RB = call Earth, Back/Select = shop, Start = pause, right stick looks around in 3D.
  - Adventure Mode reads window.PAD directly (see adventure.js).
*/
(() => {
  'use strict';
  const PAD = window.PAD = { on: false, lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, b: [], prev: [], id: '' };
  const DZ = .18, dz = v => Math.abs(v) < DZ ? 0 : (v - Math.sign(v) * DZ) / (1 - DZ);
  PAD.hit = i => !!PAD.b[i] && !PAD.prev[i];          // pressed this frame
  PAD.held = i => !!PAD.b[i];
  const key = (k, up) => dispatchEvent(new KeyboardEvent(up ? 'keyup' : 'keydown', { key: k, bubbles: true }));
  const vis = el => !!el && el.offsetParent !== null && !el.disabled && getComputedStyle(el).visibility !== 'hidden';

  // ---------- which menu (if any) is open ----------
  function menuRoot() {
    const dl = document.querySelector('#advDL'); if (dl) return dl;
    if (window.ADV_ON) { const ps = document.querySelectorAll('#adv .pnl'); return ps.length ? ps[ps.length - 1] : null; }
    const sh = document.querySelector('#shop'); if (sh && !sh.hidden) return sh;
    const ov = document.querySelector('#ov'); if (ov && !ov.hidden && ov.innerHTML.trim()) return ov;
    return null;
  }
  let focus = null, navT = 0;
  function items(root) { return [...root.querySelectorAll('button, [role=button], a[href], input, select, .card')].filter(vis); }
  function setFocus(el) { if (focus) focus.classList.remove('padf'); focus = el; if (el) { el.classList.add('padf'); try { el.focus({ preventScroll: true }); } catch (e) {} el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } }
  function move(root, dx, dy) { const L = items(root); if (!L.length) return; if (!focus || !L.includes(focus)) return setFocus(L[0]);
    const r0 = focus.getBoundingClientRect(), c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 }; let best = null, bs = 1e9;
    for (const el of L) { if (el === focus) continue; const r = el.getBoundingClientRect(), c = { x: r.left + r.width / 2, y: r.top + r.height / 2 }, vx = c.x - c0.x, vy = c.y - c0.y, along = vx * dx + vy * dy; if (along <= 2) continue;
      const side = Math.abs(vx * dy - vy * dx), sc = along + side * 2.2; if (sc < bs) { bs = sc; best = el; } }
    if (best) setFocus(best); }
  function back(root) { const b = [...root.querySelectorAll('button')].filter(vis).find(x => /^(✕|close|back|cancel|done|continue|resume|▶ resume)/i.test(x.textContent.trim()) || /X$|Back$|back$/.test(x.id)); if (b) b.click(); else key('Escape'); }

  // ---------- main game (classic globals: S, keys, fireHeld, dodge) ----------
  let usedStick = false, usedFire = false;
  function mainGame() {
    if (typeof S === 'undefined' || !S || !S.run || S.pz) return;
    const mx = dz(PAD.lx), my = dz(PAD.ly);
    if (mx || my) { S.jx = mx; S.jy = my; usedStick = true; } else if (usedStick) { S.jx = S.jy = 0; usedStick = false; }
    const fire = PAD.held(0) || PAD.rt > .35; if (fire) { try { fireHeld = true; } catch (e) {} usedFire = true; } else if (usedFire) { try { fireHeld = false; } catch (e) {} usedFire = false; }
    if (PAD.hit(2)) { try { if (typeof dodge === 'function') dodge(); } catch (e) {} }
    if (PAD.hit(1)) key('e'); if (PAD.hit(3)) key('b'); if (PAD.hit(4)) key('q'); if (PAD.hit(5)) key('f');
    if (PAD.hit(8)) key('m'); if (PAD.hit(9)) key('p');
    const lx = dz(PAD.rx), ly = dz(PAD.ry); if ((lx || ly) && window.R3 && R3.on && R3.on() && R3.look) R3.look(lx * 14, ly * 10);
  }

  function poll(t) {
    const gps = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [], g = gps[0];
    PAD.prev = PAD.b.slice();
    if (g) { if (!PAD.on) { PAD.on = true; PAD.id = g.id; toast('🎮 Controller connected'); }
      PAD.lx = g.axes[0] || 0; PAD.ly = g.axes[1] || 0; PAD.rx = g.axes[2] || 0; PAD.ry = g.axes[3] || 0;
      PAD.b = g.buttons.map(b => b.pressed || b.value > .5); PAD.lt = g.buttons[6] ? g.buttons[6].value : 0; PAD.rt = g.buttons[7] ? g.buttons[7].value : 0;
      const root = menuRoot();
      if (root) { // menu navigation
        navT -= 1 / 60; let dx = 0, dy = 0; if (PAD.b[12]) dy = -1; else if (PAD.b[13]) dy = 1; else if (PAD.b[14]) dx = -1; else if (PAD.b[15]) dx = 1;
        else { const sx = dz(PAD.lx), sy = dz(PAD.ly); if (Math.abs(sx) > .6) dx = Math.sign(sx); else if (Math.abs(sy) > .6) dy = Math.sign(sy); }
        if ((dx || dy) && navT <= 0) { move(root, dx, dy); navT = .2; } if (!dx && !dy) navT = 0;
        if (!focus || !root.contains(focus)) { const L = items(root); if (L.length) setFocus(L[0]); }
        if (PAD.hit(0) && focus) focus.click(); if (PAD.hit(1)) back(root);
      } else { if (focus) setFocus(null); if (!window.ADV_ON) mainGame(); }
    } else if (PAD.on) { PAD.on = false; PAD.b = []; toast('🎮 Controller disconnected'); }
    requestAnimationFrame(poll);
  }
  function toast(m) { try { if (window.ADV_ON && window.ADV && ADV.toast) return ADV.toast(m); if (typeof say === 'function' && typeof S !== 'undefined' && S && S.run) return say(m); } catch (e) {} }
  const css = document.createElement('style'); css.textContent = '.padf{outline:3px solid #ffcf4a!important;outline-offset:2px;box-shadow:0 0 0 6px rgba(255,207,74,.25)!important}'; document.head.appendChild(css);
  addEventListener('gamepadconnected', () => {}); requestAnimationFrame(poll);
})();
