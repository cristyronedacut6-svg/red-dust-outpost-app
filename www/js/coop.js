/*
  Red Dust Outpost · live co-op for two players
  The host runs the real game. The guest sends its position, shots and
  build/EMP/Earth/shop requests; the host sends the world back ~10 times a
  second over a Supabase Realtime room, and the guest smooths it out.
*/
(() => {
  'use strict';
  const H = window.RDO_HOOKS = window.RDO_HOOKS || {};
  const q = s => document.querySelector(s);
  const r1 = v => Math.round(v * 10) / 10;
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const QUIET = new Set(['ui', 'open', 'close', 'sel', 'type', 'next', 'no', 'step']);
  const CO = window.COOP = {
    on: false, role: null, code: '', ch: null, peer: null, me: null,
    rxT: 0, inT: 0, txT: 0, n: 0, aid: 1, sq: [], ft: [], bSig: '', rSig: '', lost: false, world: 0, dif: 1
  };
  const esc = s => (window.NET ? NET.esc(s) : String(s));
  const meInfo = () => ({ name: window.NET ? NET.name : 'Commander', suit: typeof SUIT !== 'undefined' ? SUIT : 'classic' });

  /* ---------------- rooms ---------------- */
  function connect(code, role, onOpen) {
    leave(true);
    Object.assign(CO, { on: true, role, code, peer: null, lost: false, rxT: performance.now(), inT: performance.now(), aid: 1, sq: [], ft: [], bSig: '', rSig: '' });
    const token = CO.token = {};
    NET.boot().catch(() => {}).finally(() => {
      if (CO.token !== token || !CO.on) return;
      CO.ch = NET.channel('rdo-coop-' + code, {
        open: onOpen,
        msg: onMsg,
        error: m => lobbyError(m),
        close: () => { if (CO.on) lobbyError('The connection to the game room closed.'); }
      });
    });
  }
  function leave(silent) {
    if (CO.ch) { try { CO.ch.send('bye', {}); } catch (e) {} CO.ch.close(); }
    Object.assign(CO, { on: false, role: null, ch: null, peer: null });
    if (typeof S !== 'undefined' && S) { S.p2 = null; S.net = null; }
    if (!silent && typeof title === 'function') { reloadSave(); init(); title(); }
  }
  const send = (ev, p) => CO.ch && CO.ch.send(ev, p);

  function menu() {
    if (!window.NET || !NET.on) {
      show(`<div class="eyebrow">🤝 Co-op</div><h2>Play with a friend</h2><div class="box"><p style="margin:0">Co-op needs online features. Add your Supabase project to <b>config.js</b>, then two phones can play the same outpost together.</p></div><div class="acts"><button class="big" id="cBack">Back</button></div>`);
      q('#cBack').onclick = title; return;
    }
    show(`<div class="eyebrow">🤝 Co-op</div><h2>Play with a friend</h2>
      <p class="sub">Two astronauts, one outpost. You share the base, the crew, credits and ore. One player hosts and picks the world; the other joins with a room code.</p>
      <div class="acts"><button class="big" id="cHost">🛰 Host a game</button></div>
      <div class="box"><h3>JOIN A GAME</h3><div class="frow"><input id="cCode" maxlength="4" placeholder="Room code" autocapitalize="characters" autocomplete="off" aria-label="Room code" style="text-transform:uppercase;letter-spacing:.2em;font-weight:700"><button class="btn pri" id="cJoin">Join</button></div><p class="ferr" id="cErr"></p></div>
      <div class="acts"><button class="btn" id="cBack">Back</button></div>`);
    q('#cBack').onclick = title;
    q('#cHost').onclick = host;
    q('#cJoin').onclick = () => {
      const c = q('#cCode').value.toUpperCase().replace(/[^A-Z]/g, '');
      if (c.length !== 4) return void (q('#cErr').textContent = 'Room codes have 4 letters.');
      join(c);
    };
    q('#cCode').onkeydown = e => { if (e.key === 'Enter') q('#cJoin').click(); };
    NET.boot().catch(() => {});
  }
  function host() {
    let code = ''; for (let i = 0; i < 4; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    CO.world = Math.min(typeof TW !== 'undefined' ? TW : 0, mx); CO.dif = DF;
    connect(code, 'host', () => hostLobby());
    hostLobby('Opening the room…');
  }
  function hostLobby(status) {
    const p = CO.peer;
    show(`<div class="eyebrow">🤝 Co-op · You are hosting</div><h2>Room code</h2>
      <div class="roomcode">${CO.code.split('').map(c => `<span>${c}</span>`).join('')}</div>
      <p class="sub" style="text-align:center">Tell your friend to tap 🤝 Co-op, then Join, and type this code.</p>
      <div class="box"><h3>CREW</h3><p style="margin:0">👩‍🚀 ${esc(NET.name)} (you)<br>${p ? '🧑‍🚀 ' + esc(p.name) + ' <span class="nb">joined!</span>' : '<span class="sub">' + (status || '⏳ Waiting for your partner to join…') + '</span>'}</p></div>
      <div class="box"><h3>WORLD</h3><div class="worlds">${LV.map((l, i) => `<button class="wd${i === CO.world ? ' on' : ''}" data-w="${i}" ${i > mx ? 'disabled' : ''}><span class="pl" style="${plCss(i)}"></span>${i > mx ? '🔒 ' : ''}${l.n}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Difficulty">${[['Easy', .75], ['Normal', 1], ['Hard', 1.3]].map(d => `<button data-d="${d[1]}" class="${CO.dif == d[1] ? 'on' : ''}">${d[0]}</button>`).join('')}</div></div>
      <div class="acts"><button class="big" id="cStart" ${p ? '' : 'disabled'}>▶ Start mission</button><button class="btn" id="cLeave">Leave</button></div>`);
    ov.querySelectorAll('.wd').forEach(b => b.onclick = () => { CO.world = +b.dataset.w; hostLobby(status); });
    ov.querySelectorAll('.seg button').forEach(b => b.onclick = () => { CO.dif = +b.dataset.d; hostLobby(status); });
    q('#cLeave').onclick = () => leave();
    q('#cStart').onclick = () => { if (!CO.peer) return; P = newP(CO.world); DF = CO.dif; start(); };
  }
  function join(code) {
    connect(code, 'guest', () => {
      send('hello', meInfo());
      let tries = 0;
      clearInterval(CO.hiT);
      CO.hiT = setInterval(() => {
        if (CO.peer || !CO.on) return clearInterval(CO.hiT);
        if (++tries > 8) { clearInterval(CO.hiT); lobbyError(`No game found with code ${code}. Check the code with the host.`); return; }
        send('hello', meInfo());
      }, 1200);
    });
    guestLobby('⏳ Looking for room ' + code + '…');
  }
  function guestLobby(status) {
    show(`<div class="eyebrow">🤝 Co-op · Room ${esc(CO.code)}</div><h2>${CO.peer ? 'Joined ' + esc(CO.peer.name) + '’s outpost' : 'Joining…'}</h2>
      <div class="box"><p style="margin:0">${status || '⏳ Waiting for the host to start the mission…'}</p></div>
      <div class="acts"><button class="btn" id="cLeave">Leave</button></div>`);
    q('#cLeave').onclick = () => leave();
  }
  function lobbyError(m) {
    if (!CO.on) return;
    const wasGame = MODE === 'game' && S && S.run;
    leave(true);
    show(`<div class="eyebrow">🤝 Co-op</div><h2>Connection problem</h2><div class="box"><p style="margin:0">${esc(m)}</p></div>
      <div class="acts"><button class="big" id="cRetry">Back to co-op</button><button class="btn" id="cHome">World map</button></div>`);
    q('#cRetry').onclick = () => { reloadSave(); init(); menu(); };
    q('#cHome').onclick = () => { reloadSave(); init(); title(); };
    if (wasGame) snd('lose');
  }

  /* ---------------- messages ---------------- */
  function onMsg(ev, d) {
    const now = performance.now();
    if (CO.role === 'host') {
      CO.inT = now;
      if (ev === 'hello') {
        CO.peer = { name: String(d.name || 'Commander').slice(0, 16), suit: d.suit };
        send('welcome', meInfo());
        if (MODE === 'game' && S && S.run) { send('start', { P: P0, DF }); send('s', snapshot(true)); }
        else if (q('#cStart')) hostLobby();
        snd('boot');
      } else if (ev === 'in' && S && S.run) {
        const p = S.p2 || (S.p2 = { x: d.x, y: d.y, cd: 0, walk: 0 });
        p.tx = d.x; p.ty = d.y; p.fx = d.fx; p.fire = d.f; p.wp = d.wp; p.name = CO.peer ? CO.peer.name : 'Partner'; p.suit = CO.peer && CO.peer.suit; p.moving = d.m;
      } else if (ev === 'act' && S && S.run) act(d);
      else if (ev === 'bye') {
        CO.peer = null; if (S) S.p2 = null;
        if (MODE === 'game' && S && S.run) { say('🤝 Your partner left the mission. Keep going solo!'); snd('no'); }
        else if (q('#cStart')) hostLobby();
      }
    } else {
      CO.rxT = now;
      if (ev === 'welcome') { CO.peer = { name: String(d.name || 'Host').slice(0, 16), suit: d.suit }; clearInterval(CO.hiT); snd('boot'); guestLobby(); }
      else if (ev === 'start') { P = d.P; DF = d.DF; CO.lost = false; start(); }
      else if (ev === 's' && S && S.net === 'guest') apply(d);
      else if (ev === 'wb' && S && S.net === 'guest') wb(d.t, d.sub, d.low);
      else if (ev === 'end') guestEnd(d);
      else if (ev === 'lobby') { if (S) S.run = false; MODE = 'space'; guestLobby('The host went back to the room. Waiting for the next mission…'); }
      else if (ev === 'bye') lobbyError('The host left the game.');
    }
  }

  /* ---------------- host side ---------------- */
  function act(d) {
    const p = S.p2; if (!p) return;
    if (d.k === 'build' && BT[d.t]) place(d.t, d.x | 0, d.y | 0, p);
    else if (d.k === 'emp') doEMP(p);
    else if (d.k === 'call' && CI.some(c => c.id === d.id)) callIn(d.id, p);
    else if (d.k === 'shop') { const it = SHOP[d.i | 0]; if (it) { const pr = it.p(); if (!(it.max && it.max()) && S.cr >= pr && !(it.ok && !it.ok())) { S.cr -= pr; it.f(); snd('cr'); } } }
  }
  H.hostUpdate = dt => {
    const p = S.p2; if (!p) return;
    if (p.tx != null) { const k = Math.min(1, dt * 12); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
    if (p.moving) p.walk = (p.walk || 0) + dt;
    S.revT2 = (S.revT2 || 0) - dt; if (S.revT2 <= 0) { S.revT2 = .2; reveal(p.x, p.y, 125); }
    p.cd = (p.cd || 0) - dt;
    if (p.fire && p.cd <= 0) {
      const wi = S.wo[p.wp] ? p.wp : 0, w = WP[wi]; p.cd = w.cd * Math.pow(.85, S.fr);
      let tg = null, d = 170; S.al.forEach(a => { if (a.hid) return; const qd = dist(a, p); if (qd < d) { d = qd; tg = a; } });
      const an = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : (p.fx < 0 ? Math.PI : 0);
      for (let i = 0; i < w.s; i++) { const a2 = an + (i - (w.s - 1) / 2) * .28; S.bul.push({ x: p.x, y: p.y - 2, vx: Math.cos(a2) * 240, vy: Math.sin(a2) * 240, l: .7, d: (1 + S.lvl + pk('gun') + (S.mod.dmg || 0)) * w.m, pi: w.pi, col: w.col, h: [] }); }
    }
    S.rocks = S.rocks.filter(r => {
      if (Math.hypot(r.x - p.x, r.y - p.y) >= 12) return true;
      if (r.sup) { S.mats += 25; S.res.o2 = clamp(S.res.o2 + 20, 0, 100); S.res.fd = clamp(S.res.fd + 15, 0, 100); ftxt(r.x, r.y - 6, '+25🪨 +20💨 +15🌽', '#9fd6ff'); snd('sup'); }
      else if (r.c) { S.cr += r.a; ftxt(r.x, r.y, '+' + r.a + '💰'); snd('cr'); }
      else { const n = Math.round(r.a * (1 + .3 * jc('min')) * (S.mod.ore || 1)); S.mats += n; ftxt(r.x, r.y, '+' + n + '🪨', '#d8e2ea'); snd('col'); }
      return false;
    });
    S.pois.forEach(po => { if (!po.found && Math.hypot(po.x - p.x, po.y - p.y) < 34) discover(po); });
    S.secs.forEach(sc => { if (!sc.done && sc.k === 'ruins' && Math.hypot(sc.x - p.x, sc.y - p.y) < 26) lootRuins(sc); });
  };
  function snapshot(full) {
    const r = S.res, o = {
      t: r1(S.t), sol: S.sol, pz: S.pz ? 1 : 0, hp: r1(S.hp), cr: S.cr, mats: S.mats, up: r1(S.up), crew: S.crew, storm: r1(S.storm), emp: 0,
      res: [r.pw, r.o2, r.fd, r.rad].map(r1), cap: S.cap, rate: [S.rate.pw || 0, S.rate.o2 || 0, S.rate.fd || 0].map(v => Math.round(v * 100) / 100),
      disc: S.disc, dome: r1(S.dome), shel: r1(S.shel), arm: r1(S.arm), lvl: S.lvl, fr: S.fr, wo: S.wo, kills: S.kills, k0w: S.k0w,
      winT: r1(S.winT), bint: r1(S.bint), land: r1(S.land), solMod: S.solMod,
      p: [r1(S.p.x), r1(S.p.y), S.face.x < 0 ? -1 : 1, S.drive ? 1 : 0, r1(S.walk || 0), S.wp],
      al: S.al.map(a => [a.id || (a.id = CO.aid++), a.ty, r1(a.x), r1(a.y), Math.ceil(a.hp), a.mh,
        (a.stun > 0 ? 1 : 0) | (a.hid ? 2 : 0) | (a.rg ? 4 : 0) | (a.ty === 'golem' && a.cd < .8 ? 8 : 0) | (a.fl > 0 ? 16 : 0),
        a.st || '', r1(a.rise || 0), a.ty === 'egg' ? r1(a.hatch) : a.ty === 'tent' ? r1(a.sl || 0) : r1(a.tm || 0)]),
      bul: S.bul.slice(-70).map(b => [r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), b.col, b.pi ? 1 : 0, r1(b.l)]),
      eb: S.eb.slice(-70).map(e => [r1(e.x), r1(e.y), Math.round(e.vx), Math.round(e.vy), e.c || '', e.c2 || '']),
      hz: S.hz.map(h => ({ k: h.k, x: r1(h.x), y: r1(h.y), r: h.r, t: h.t, t0: h.t0, x2: h.x2, y2: h.y2, fx: h.fx, life: h.life, max: h.max, v: h.v })),
      pods: S.pods.map(p => [p.k, r1(p.x), r1(p.y), Math.round(p.h)]),
      strikes: S.strikes.map(p => [r1(p.x), r1(p.y), Math.round(p.t * 100) / 100]),
      allies: S.allies.map(b => [r1(b.x), r1(b.y), b.face, r1(b.walk), r1(b.life)]),
      portals: S.portals.map(p => [r1(p.x), r1(p.y), r1(p.t)]),
      npc: S.npc.map(n => [r1(n.x), r1(n.y), n.f, r1(n.walk), n.scared ? 1 : 0]),
      rv: S.rv ? [r1(S.rv.x), r1(S.rv.y), S.rv.f] : null,
      flag: S.flag ? [S.flag.x, S.flag.y, r1(S.flag.h)] : null,
      pf: S.pois.map(p => p.found ? 1 : 0),
      sd: S.secs.map(p => [p.done ? 1 : 0, p.st || 0, p.seen ? 1 : 0]),
      ban: S.ban && S.ban.k !== 'tut' ? { k: S.ban.k, txt: S.ban.txt, t: r1(S.ban.t), lab: S.ban.lab } : null,
      log: S.msgT > 0 ? S.logs[0] : '', sq: CO.sq.splice(0, 10), ft: CO.ft.splice(0, 12), cbo: S.cbo
    };
    const bSig = S.b.length + ':' + S.b.reduce((a, b) => a + b.lv * 7 + Math.round(b.hp) + (b.off ? 1 : 0), 0);
    if (full || bSig !== CO.bSig || CO.n % 10 === 0) { CO.bSig = bSig; o.b = S.b.map(b => [b.t, b.x, b.y, b.lv, Math.round(b.hp), b.m, b.off ? 1 : 0, Math.round((b.a || 0) * 100) / 100]); }
    const rSig = S.rocks.length + ':' + S.rocks.reduce((a, r) => a + r.x + r.a, 0);
    if (full || rSig !== CO.rSig || CO.n % 20 === 0) { CO.rSig = rSig; o.rk = S.rocks.map(r => [r1(r.x), r1(r.y), r.a, r.c ? 1 : 0, r.sup ? 1 : 0, r.met ? 1 : 0]); }
    if (full) {
      o.full = 1; o.lv = S.lv; o.lp = S.lp; o.crewL = S.crewL; o.devils = S.devils;
      o.pois = S.pois.map(p => ({ i: p.i, x: p.x, y: p.y, found: p.found }));
      o.secs = S.secs.map(p => ({ k: p.k, x: p.x, y: p.y }));
    }
    return o;
  }
  H.snd = k => { if (CO.on && CO.role === 'host' && !QUIET.has(k) && !CO.sq.includes(k)) CO.sq.push(k); };
  H.ft = (x, y, t, c) => { if (CO.on && CO.role === 'host' && CO.ft.length < 24) CO.ft.push([r1(x), r1(y), t, c]); };
  H.wb = (t, sub, low) => { if (CO.on && CO.role === 'host') send('wb', { t, sub, low }); };

  /* ---------------- guest side ---------------- */
  function apply(o) {
    if (o.full) {
      S.lv = o.lv; S.lp = o.lp; mkbg();
      S.pois = o.pois.map(p => ({ ...LV[o.lv].poi[p.i], ...p }));
      S.secs = o.secs.map(p => ({ ...p, done: 0, st: 0 }));
      S.crewL = o.crewL; S.crew = o.crewL.length; S.npc = []; S.crewL.forEach(c => addNpc(c));
      S.devils = o.devils || [];
      S.land = 0; S.landed = 1; S.out = 1;
      S.p.x = clamp(o.lp.x + 26, 6, WW - 6); S.p.y = clamp(o.lp.y + 14, 8, WH - 6);
      reveal(S.p.x, S.p.y, 200); CO.got = true;
    }
    if (!CO.got) return;
    ['sol', 'hp', 'cr', 'mats', 'up', 'crew', 'storm', 'cap', 'disc', 'dome', 'shel', 'arm', 'lvl', 'fr', 'wo', 'kills', 'k0w', 'winT', 'bint', 'solMod'].forEach(k => { if (o[k] !== undefined) S[k] = o[k]; });
    if (Math.abs(S.t - o.t) > .5) S.t = o.t;
    S.res = { pw: o.res[0], o2: o.res[1], fd: o.res[2], rad: o.res[3] };
    S.rate = { pw: o.rate[0], o2: o.rate[1], fd: o.rate[2] };
    $('#stage').classList.toggle('cine', o.bint > 0);
    const hp = S.p2 || (S.p2 = { x: o.p[0], y: o.p[1], walk: 0 });
    hp.tx = o.p[0]; hp.ty = o.p[1]; hp.fx = o.p[2]; hp.drive = o.p[3]; hp.walkT = o.p[4]; hp.name = CO.peer ? CO.peer.name : 'Host'; hp.suit = CO.peer && CO.peer.suit;
    const old = new Map(S.al.map(a => [a.id, a]));
    S.al = o.al.map(d => {
      let a = old.get(d[0]);
      if (a) old.delete(d[0]);
      else { const A = AT[d[1]] || { r: 6 }; a = { id: d[0], ty: d[1], x: d[2], y: d[3], r: A.r, an: Math.random() * 6, boss: !!BOSS[d[1]], sc: 1 }; }
      a.gx = d[2]; a.gy = d[3]; a.hp = d[4]; a.mh = d[5];
      a.stun = d[6] & 1 ? 1 : 0; a.hid = d[6] & 2 ? 1 : 0; a.rg = d[6] & 4 ? 1 : 0; a.cd = d[6] & 8 ? .5 : 2; a.fl = d[6] & 16 ? .08 : 0;
      a.arm = a.ty === 'golem' ? 1 : 0; a.st = d[7]; a.rise = d[8];
      if (a.ty === 'egg') a.hatch = d[9]; else if (a.ty === 'tent') a.sl = d[9]; else a.tm = d[9];
      return a;
    });
    old.forEach(a => { boom(a.x, a.y, a.boss ? 50 : 12); boom(a.x, a.y, a.boss ? 18 : 4, '#7cff6b'); splat(a.x, a.y, a.r || 5); S.shk = Math.max(S.shk, a.boss ? 12 : 2); });
    S.bul = o.bul.map(b => ({ x: b[0], y: b[1], vx: b[2], vy: b[3], col: b[4], pi: b[5], l: b[6], h: [] }));
    S.eb = o.eb.map(e => ({ x: e[0], y: e[1], vx: e[2], vy: e[3], c: e[4] || undefined, c2: e[5] || undefined, l: 2 }));
    S.hz = o.hz;
    S.pods = o.pods.map(p => ({ k: p[0], x: p[1], y: p[2], h: p[3] }));
    S.strikes = o.strikes.map(p => ({ x: p[0], y: p[1], t: p[2], hit: p[2] >= 1.4 }));
    S.allies = o.allies.map(b => ({ x: b[0], y: b[1], face: b[2], walk: b[3], life: b[4] }));
    S.portals = o.portals.map(p => ({ x: p[0], y: p[1], t: p[2] }));
    o.npc.forEach((d, i) => { const n = S.npc[i]; if (!n) return; n.gx = d[0]; n.gy = d[1]; n.f = d[2]; n.walk = d[3]; n.scared = d[4]; });
    if (o.rv) S.rv = { x: o.rv[0], y: o.rv[1], f: o.rv[2] };
    S.flag = o.flag ? { x: o.flag[0], y: o.flag[1], h: o.flag[2] } : null;
    o.pf.forEach((f, i) => { if (S.pois[i]) { if (f && !S.pois[i].found) { reveal(S.pois[i].x, S.pois[i].y, 170); sparkle(S.pois[i].x, S.pois[i].y); } S.pois[i].found = f; } });
    o.sd.forEach((d, i) => { if (S.secs[i]) { S.secs[i].done = d[0]; S.secs[i].st = d[1]; S.secs[i].seen = S.secs[i].seen || d[2]; } });
    if (o.ban && (!S.ban || S.ban.txt !== o.ban.txt)) S.ban = o.ban;
    if (o.log && o.log !== S.logs[0]) say(o.log);
    o.sq.forEach(k => snd(k));
    o.ft.forEach(f => S.ft.push({ x: f[0], y: f[1], t: f[2], c: f[3] || '#ffe066', l: 1 }));
    S.cbo = o.cbo;
    if (o.b) { S.b = o.b.map(d => ({ t: d[0], x: d[1], y: d[2], w: d[0] === 'core' ? 32 : 16, lv: d[3], hp: d[4], m: d[5], off: !!d[6], a: d[7], pop: null, cd: 0 })); if (S.insp) closeInsp(); }
    if (o.rk) S.rocks = o.rk.map(d => ({ x: d[0], y: d[1], a: d[2], c: !!d[3], sup: !!d[4], met: !!d[5] }));
    if (o.pz && !CO.pzS) { CO.pzS = 1; say('⏸ ' + (CO.peer ? CO.peer.name : 'The host') + ' is in a menu. The mission continues in a moment.'); }
    if (!o.pz) CO.pzS = 0;
  }
  H.guestUpdate = dt => {
    if (!CO.got) { fx(dt); return; }
    const p = S.p, k = keys;
    let dx = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0) + S.jx, dy = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0) + S.jy;
    const l = Math.hypot(dx, dy); S.moving = l > .12;
    if (S.moving && S.winT <= 0 && S.bint <= 0) {
      const sp = 78 * (1 + .15 * S.spd) * Math.min(1, l) * dt;
      p.x = clamp(p.x + dx / l * sp, 6, WW - 6); p.y = clamp(p.y + dy / l * sp, 8, WH - 6); S.face = { x: dx / l, y: dy / l }; S.walk = (S.walk || 0) + dt;
      S.dustT -= dt; if (S.dustT <= 0) { S.dustT = .13; if ((S.stp = !S.stp)) snd('step'); S.pt.push({ x: p.x + rnd(-2, 2), y: p.y + 6, vx: rnd(-10, 10), vy: rnd(-8, -2), l: .35, ml: .35, c: S.L.bg[4], s: 2 }); }
    }
    S.revT = (S.revT || 0) - dt; if (S.revT <= 0) { S.revT = .15; reveal(p.x, p.y, 125); }
    p.cd = (p.cd || 0) - dt;
    if ((k[' '] || fireHeld) && p.cd <= 0) {
      const w = WP[S.wp]; p.cd = w.cd * Math.pow(.85, S.fr);
      let tg = null, d = 170; S.al.forEach(a => { if (a.hid) return; const qd = dist(a, p); if (qd < d) { d = qd; tg = a; } });
      const an = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : Math.atan2(S.face.y, S.face.x);
      if (tg) S.face = { x: Math.sign(tg.x - p.x) || 1, y: 0 };
      S.pt.push({ x: p.x + Math.cos(an) * 7, y: p.y - 2 + Math.sin(an) * 7, vx: 0, vy: 0, l: .07, ml: .07, c: '#fff6c0', s: 5 });
      snd(['sh', 'sc', 'pl'][S.wp]);
    }
    const kk = Math.min(1, dt * 12);
    S.al.forEach(a => { a.an += dt * 6; if (a.gx != null) { a.x += (a.gx - a.x) * kk; a.y += (a.gy - a.y) * kk; } });
    const h2 = S.p2; if (h2 && h2.tx != null) { const mv = Math.hypot(h2.tx - h2.x, h2.ty - h2.y) > .4; h2.x += (h2.tx - h2.x) * kk; h2.y += (h2.ty - h2.y) * kk; if (mv) h2.walk = (h2.walk || 0) + dt; }
    S.npc.forEach(n => { if (n.gx != null) { n.x += (n.gx - n.x) * kk; n.y += (n.gy - n.y) * kk; } });
    S.bul.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt; }); S.bul = S.bul.filter(b => b.l > 0);
    S.eb.forEach(e => { e.x += e.vx * dt; e.y += e.vy * dt; });
    S.hz.forEach(h => { if (h.t != null) h.t -= dt; if (h.k === 'shock' && h.v) h.r += h.v * dt; });
    S.strikes.forEach(s => { s.t += dt; });
    S.t += dt; S.emp = Math.max(0, S.emp - dt); S.slow = 0;
    if (S.winT > 0 && Math.random() < dt * 5) firework();
    fx(dt);
  };
  function guestEnd(d) {
    if (!S) return;
    S.run = false; S.over = true; $('#stage').classList.remove('cine');
    const info = { ...d.info, kills: d.info.kills, win: d.win };
    show(`<div class="eyebrow">🤝 Co-op · ${LV[d.info.world].n}</div><h2>${d.win ? 'Outpost secured together!' : 'Mission failed'}</h2>
      ${d.win ? `<div class="starsbig">${[0, 1, 2].map(i => `<span class="${i < d.info.stars ? '' : 'off'}">★</span>`).join('')}</div>` : `<div class="box"><h3>WHAT HAPPENED</h3><p style="margin:0">${esc(d.why || 'The outpost was lost.')}</p></div>`}
      ${d.win ? NET.scoreBox(info, 'coop') : ''}
      <div class="box"><p style="margin:0">⏳ Waiting for ${esc(CO.peer ? CO.peer.name : 'the host')} to ${d.win ? (d.last ? 'finish' : 'start the next world') : 'try again'}…</p></div>
      <div class="acts"><button class="btn" id="cLeave">Leave co-op</button></div>`);
    q('#cLeave').onclick = () => leave();
    snd(d.win ? 'win' : 'lose');
    if (d.win) { for (let i = 0; i < d.info.stars; i++) setTimeout(() => snd('star', i), 500 + i * 380); NET.sendScore(info, 'coop'); }
  }

  /* ---------------- host results ---------------- */
  CO.done = info => {
    const last = P.lv >= LV.length - 1;
    send('end', { win: true, info, last });
    Object.assign(P, { cr: S.cr + 25, lvl: S.lvl, fr: S.fr, spd: S.spd, wo: S.wo, wp: S.wp, drone: S.drone, kills: S.kills, crew: S.crewL });
    const nx = last ? null : LV[P.lv + 1];
    show(`<div class="eyebrow">🤝 Co-op · ${LV[info.world].n}</div><h2>Outpost secured together!</h2>
      <div class="starsbig">${[0, 1, 2].map(i => `<span class="${i < info.stars ? '' : 'off'}">★</span>`).join('')}</div>
      ${NET.scoreBox(info, 'coop')}${report()}
      <div class="acts">${last ? '<button class="big" id="cAgain">🔁 Back to the room</button>' : `<button class="big" id="cNext">🚀 Travel to ${nx.n}</button>`}<button class="btn" id="cLeave">Leave co-op</button></div>`);
    if (!last) q('#cNext').onclick = () => { P.lv++; start(); };
    else q('#cAgain').onclick = () => { send('lobby', {}); MODE = 'space'; hostLobby(); };
    q('#cLeave').onclick = () => leave();
    NET.sendScore(info, 'coop');
    return true;
  };
  CO.fail = info => {
    send('end', { win: false, info, why: S.why });
    show(`<div class="eyebrow">🤝 Co-op · ${LV[info.world].n}</div><h2>Mission failed</h2>
      <div class="box"><h3>WHAT HAPPENED</h3><p style="margin:0">${esc(S.why || 'The outpost was lost.')}</p></div>
      <div class="box"><h3>ENGINEERING LESSON</h3><p style="margin:0">${esc(S.tip || 'Balance power, air, food and shielding, and defend the core.')}</p></div>${report()}
      <div class="acts"><button class="big" id="cRetry">↻ Try again together</button><button class="btn" id="cLeave">Leave co-op</button></div>`);
    q('#cRetry').onclick = () => { P = JSON.parse(JSON.stringify(P0)); start(); };
    q('#cLeave').onclick = () => leave();
    return true;
  };

  /* ---------------- shared hooks ---------------- */
  H.role = () => (CO.on ? CO.role : null);
  H.start = () => {
    if (!CO.on) return;
    if (CO.role === 'host') { CO.n = 0; send('start', { P: P0, DF }); send('s', snapshot(true)); if (CO.peer) S.p2 = { x: S.p.x + 20, y: S.p.y + 6, cd: 0, walk: 0, tx: S.p.x + 20, ty: S.p.y + 6, name: CO.peer.name, suit: CO.peer.suit }; }
    else { CO.got = false; S.land = 0; S.p2 = null; CO.rxT = performance.now(); }
  };
  H.frame = () => {
    if (!CO.on || !S) return;
    const now = performance.now();
    if (CO.role === 'host') {
      if (now - CO.txT >= 100) { CO.txT = now; CO.n++; send('s', snapshot(false)); }
      if (S.p2 && now - CO.inT > 8000) { S.p2 = null; say('🤝 Lost contact with your partner. They can rejoin with the same room code.'); }
    } else {
      if (now - CO.txT >= 100 && S.run) { CO.txT = now; send('in', { x: r1(S.p.x), y: r1(S.p.y), fx: S.face.x < 0 ? -1 : 1, f: !!(keys[' '] || fireHeld), wp: S.wp, m: S.moving ? 1 : 0 }); }
      if (S.run && now - CO.rxT > 6000 && !CO.lost) { CO.lost = true; lobbyError('Lost contact with the host. Check your internet connection.'); }
    }
  };
  H.act = d => send('act', d);
  H.quit = () => { if (!CO.on) return; if (CO.role === 'host' && CO.peer) send('lobby', {}); leave(true); };
  H.drawBuddy = () => {
    const b = S.p2; if (!b || b.x == null) return;
    const SU = (typeof SUITS !== 'undefined' && SUITS.find(s => s.id === b.suit)) || SUITS[0];
    if (b.drive) return;
    const w = Math.floor((b.walk || 0) * 10) % 2, fx = b.fx < 0 ? -1 : 1;
    G.fillStyle = 'rgba(0,0,0,.3)'; G.fillRect(b.x - 5, b.y + 6, 10, 3);
    drawSuit(SU, b.x, b.y, fx, w);
    G.strokeStyle = 'rgba(125,249,255,.8)'; G.lineWidth = 1; G.beginPath(); G.ellipse(b.x, b.y + 7, 7, 2.5, 0, 0, 7); G.stroke();
    G.font = 'bold 7px "Chakra Petch",sans-serif'; G.textAlign = 'center'; G.fillStyle = '#000'; G.fillText(b.name || 'Partner', b.x + 1, b.y - 12); G.fillStyle = '#7df9ff'; G.fillText(b.name || 'Partner', b.x, b.y - 13);
  };
  CO.menu = menu;
  CO.leave = leave;
})();
