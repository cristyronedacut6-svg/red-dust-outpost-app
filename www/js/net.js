/*
  Red Dust Outpost · online client
  Talks to Supabase directly: Auth (guest + email accounts), the database
  functions in supabase/schema.sql (cloud save, scores, leaderboards,
  daily challenge) and Realtime (co-op rooms). No libraries needed.
*/
(() => {
  'use strict';
  const CFG = window.RDO_CONFIG || {};
  const BASE = String(CFG.supabaseUrl || '').trim().replace(/\/+$/, '');
  const KEY = String(CFG.supabaseKey || '').trim();
  const ON = /^https?:\/\/[^\s]+$/.test(BASE) && KEY.length > 20;
  const H = window.RDO_HOOKS = window.RDO_HOOKS || {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rdo-net-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rdo-net-' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const q = s => document.querySelector(s);

  /* ---------------- HTTP + auth ---------------- */
  let sess = store.get('session', null);
  let profile = store.get('profile', null);
  let ready = null;

  function friendly(m) {
    const s = String(m || '');
    if (/invalid login credentials/i.test(s)) return 'That email or password is not right. Check them and try again.';
    if (/already (been )?registered|already exists/i.test(s)) return 'That email already has an account. Use Sign in instead.';
    if (/password should be at least|weak password/i.test(s)) return 'Your password needs at least 6 characters.';
    if (/anonymous sign-ins are disabled/i.test(s)) return 'Guest play is switched off on the server. (Setup: turn on anonymous sign-ins in Supabase.)';
    if (/rate limit|too many/i.test(s)) return 'Too many tries in a row. Wait a minute, then try again.';
    if (/could not find the function|does not exist|schema cache/i.test(s)) return 'The online database needs an update. (Setup: run schema.sql again in Supabase.)';
    if (/jwt|token (is )?expired|invalid token/i.test(s)) return 'Your sign-in expired. Tap Sync or sign in again.';
    if (/email.*invalid|invalid.*email/i.test(s)) return 'That email address does not look right.';
    return s;
  }
  async function http(path, { method = 'POST', body, auth = true, timeout = 12000 } = {}) {
    const headers = { apikey: KEY, 'Content-Type': 'application/json' };
    // Newer Supabase 'publishable' keys are not tokens, so only send a token as Authorization.
    if (auth && sess) headers.Authorization = 'Bearer ' + sess.access_token;
    else if (KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + KEY;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
      const txt = await r.text();
      let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
      if (!r.ok) {
        const m = (j && (j.message || j.msg || j.error_description || j.error)) || ('Server error ' + r.status);
        throw Object.assign(new Error(friendly(m)), { status: r.status, body: j });
      }
      return j;
    } catch (e) {
      if (e.name === 'AbortError') throw Object.assign(new Error('The server took too long to answer.'), { status: 0 });
      if (e instanceof TypeError) throw Object.assign(new Error('Could not reach the server. Check your internet connection.'), { status: 0 });
      throw e;
    } finally { clearTimeout(t); }
  }
  function setSession(j) {
    if (!j || !j.access_token) throw new Error('Sign-in failed. Please try again.');
    sess = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: j.user || (sess && sess.user) || {} };
    store.set('session', sess);
  }
  async function refresh() {
    const j = await http('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: sess.refresh_token }, auth: false });
    setSession(j);
  }
  async function ensure() {
    if (!ON) throw new Error('Online features are off.');
    if (sess && sess.expires_at - 60 < Date.now() / 1000) {
      try { await refresh(); } catch (e) { if (e.status >= 400 && e.status < 500) { sess = null; store.set('session', null); } else throw e; }
    }
    if (!sess) setSession(await http('/auth/v1/signup', { body: { data: {} }, auth: false }));
    return sess;
  }
  async function rpc(fn, args = {}) {
    await ensure();
    try { return await http('/rest/v1/rpc/' + fn, { body: args }); }
    catch (e) { if (e.status === 401) { await refresh(); return await http('/rest/v1/rpc/' + fn, { body: args }); } throw e; }
  }
  const isGuest = () => !sess || !sess.user || sess.user.is_anonymous || !sess.user.email;
  function boot() {
    if (!ON) return Promise.resolve(false);
    if (!ready) ready = (async () => {
      await ensure();
      const name = await rpc('ensure_profile');
      profile = { name }; store.set('profile', profile);
      await syncDown();
      return true;
    })().catch(e => { ready = null; throw e; });
    return ready;
  }

  /* ---------------- cloud save ---------------- */
  const KEYS = ['mx', 'stars', 'jr', 'ach', 'stat', 'cp', 'tw', 'suit', 'rskin', 'cosu', 'df', 'tut', 'intro', 'tech', 'rp', 'xp', 'dq', 'streak'];
  let muted = false, pushT = 0, lastSync = store.get('lastSync', 0), syncing = false;
  const localData = () => { const d = {}; KEYS.forEach(k => { const v = LS.get(k, undefined); if (v !== undefined) d[k] = v; }); d._t = LS.get('savedAt', 0); return d; };
  function merge(a, b) {
    const newer = (b._t || 0) > (a._t || 0) ? b : a, out = { ...a, ...b, ...newer };
    out.mx = Math.max(a.mx || 0, b.mx || 0);
    out.stars = LV.map((_, i) => i).map(i => Math.max((a.stars || [])[i] || 0, (b.stars || [])[i] || 0));
    ['jr', 'ach', 'cosu', 'tech'].forEach(k => { out[k] = [...new Set([...(a[k] || []), ...(b[k] || [])])]; });
    out.stat = {}; new Set([...Object.keys(a.stat || {}), ...Object.keys(b.stat || {})]).forEach(k => { out.stat[k] = Math.max((a.stat || {})[k] || 0, (b.stat || {})[k] || 0); });
    out.xp = Math.max(a.xp || 0, b.xp || 0);
    out.tut = a.tut || b.tut || 0; out.intro = a.intro || b.intro || 0;
    if (out.tw > out.mx) out.tw = out.mx;
    out._t = Date.now();
    return out;
  }
  async function syncDown() {
    const cloud = await rpc('load_progress');
    const local = localData(), merged = cloud && cloud.data ? merge(local, cloud.data) : local;
    muted = true;
    try { KEYS.forEach(k => { if (merged[k] !== undefined) LS.set(k, merged[k]); }); LS.set('savedAt', merged._t || Date.now()); }
    finally { muted = false; }
    if (typeof reloadSave === 'function') reloadSave();
    await push();
  }
  async function push() {
    if (!ON || !sess || syncing) return;
    syncing = true;
    try { await rpc('save_progress', { p_data: localData() }); lastSync = Date.now(); store.set('lastSync', lastSync); }
    catch (e) { console.warn('Cloud save failed', e.message); }
    finally { syncing = false; }
  }
  H.saved = k => {
    if (muted || !KEYS.includes(k)) return;
    try { localStorage.setItem('rdo2-savedAt', JSON.stringify(Date.now())); } catch (e) {}
    if (!ON || !sess) return;
    clearTimeout(pushT); pushT = setTimeout(push, 4000);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && pushT) { clearTimeout(pushT); pushT = 0; push(); } });

  /* ---------------- daily challenge ---------------- */
  const MODS = {
    swarm:   { ic: '👾', n: 'Swarm', d: '60% more aliens', m: { sw: 1.6 } },
    dim:     { ic: '🌑', n: 'Dim sun', d: 'Solar panels make 40% less power', m: { dim: 0.6 } },
    meteors: { ic: '☄', n: 'Meteor storm', d: 'Meteor showers come about three times as often', m: { mt: 0.35 } },
    rich:    { ic: '💎', n: 'Rich ground', d: 'Rocks give double ore', m: { ore: 2 } },
    glass:   { ic: '🗡', n: 'Glass cannon', d: '+2 weapon damage, but the crew takes 60% more damage', m: { dmg: 2, hurt: 1.6 } },
    thin:    { ic: '💨', n: 'Leaky air', d: 'Oxygen drains 40% faster', m: { o2: 1.4 } },
    storms:  { ic: '🌪', n: 'Storm season', d: 'Storms come twice as often', m: { st: 0.5 } },
    fast:    { ic: '⚡', n: 'Hyper aliens', d: 'Aliens move 30% faster', m: { asp: 1.3 } }
  };
  function localDaily() {
    const now = new Date(), day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const n = Math.round((day - Date.UTC(2026, 0, 1)) / 864e5), ids = Object.keys(MODS);
    const a = ((n * 7) % 8 + 8) % 8; let b = ((n * 3 + 5) % 8 + 8) % 8; if (b === a) b = (a + 3) % 8;
    return { day: day.toISOString().slice(0, 10), world: ((n % 5) + 5) % 5, mods: [ids[a], ids[b]], seconds_left: Math.round((day.getTime() + 864e5 - now.getTime()) / 1000), offline: true };
  }
  let dailyRun = null;
  H.mods = () => dailyRun;
  H.afterInit = () => {
    if (window.COOP && COOP.on) { S.tu = null; return; }
    if (!dailyRun) return;
    S.mod = { daily: 1, day: dailyRun.day };
    dailyRun.mods.forEach(id => Object.assign(S.mod, (MODS[id] || {}).m));
    if (S.mod.dim) S.solMod *= S.mod.dim;
    if (S.mod.st) S.stormNext = 35;
    if (S.mod.mt) S.metT = 30;
    S.tu = null;
  };
  H.title = () => { if (!(window.COOP && COOP.on)) dailyRun = null; };

  /* ---------------- scores ---------------- */
  const fmtRank = r => r ? `#${r.rank} of ${r.players}` : '';
  async function submit(info, mode) {
    return rpc('submit_score', {
      p_mode: mode, p_world: info.world, p_score: info.score, p_stars: info.stars, p_kills: Math.min(info.kills, 3000),
      p_discoveries: info.disc, p_difficulty: info.dif, p_won: info.win, p_seconds: Math.min(info.secs, 36000)
    });
  }
  function scoreBox(info, mode) {
    return `<div class="box scorebox"><h3>MISSION SCORE</h3><div class="bigscore">${info.score.toLocaleString()}</div>
      <p class="sub" id="nRank" style="margin:4px 0 0;font-size:13.5px">${ON ? '📡 Sending your score to the leaderboard…' : '📴 Offline. Add your Supabase project in config.js to rank this score worldwide.'}</p></div>${mode === 'daily' ? '<div class="box" id="ghostBox"></div>' : ''}`;
  }
  async function sendScore(info, mode) {
    if (!ON) { if (mode === 'daily' && window.ghostBox) setTimeout(() => ghostBox(q('#ghostBox'), encBase(), null), 60); return; }
    const el = () => q('#nRank');
    try {
      await boot();
      const r = await submit(info, mode);
      const where = mode === 'daily' ? 'today’s daily board' : mode === 'coop' ? 'the co-op board' : LV[info.world].n;
      if (el()) el().innerHTML = `🏆 You are <b>${fmtRank(r)}</b> on ${esc(where)}.${r.new_best ? ' <span class="nb">New personal best!</span>' : ` Your best is ${Number(r.best).toLocaleString()}.`}`;
      if (r.new_best) snd('ach');
      if (mode === 'daily') { const mine = typeof encBase === 'function' ? encBase() : ''; try { if (mine) await rpc('save_daily_base', { p_base: mine }); } catch (e) {} let top = null; try { const t = await rpc('get_daily_top_base'); top = Array.isArray(t) ? t[0] : t; } catch (e) {} if (window.ghostBox) ghostBox(q('#ghostBox'), mine, top); }
    } catch (e) { if (el()) el().textContent = '⚠ Score not sent: ' + e.message; }
  }
  H.doneHtml = info => scoreBox(info, 'campaign');
  H.doneBind = info => sendScore(info, 'campaign');

  // Daily runs get their own results screen, so they never change campaign progress.
  function dailyResult(info) {
    const d = dailyRun;
    show(`<div class="eyebrow">📅 Daily challenge · ${esc(d.day)}</div><h2>${info.win ? LV[info.world].n + ' cleared!' : 'Mission failed'}</h2>
      ${info.win ? `<div class="starsbig">${[0, 1, 2].map(i => `<span class="${i < info.stars ? '' : 'off'}">★</span>`).join('')}</div>` : `<div class="box"><h3>WHAT HAPPENED</h3><p style="margin:0">${esc(S.why || 'The outpost was lost.')}</p></div>`}
      <p class="sub">Today’s twists: ${d.mods.map(id => MODS[id].ic + ' ' + MODS[id].n).join(' · ')}</p>
      ${scoreBox(info, 'daily')}${report()}
      <div class="acts"><button class="big" id="dAgain">↻ Try again</button><button class="btn" id="dBoard">🏆 Today’s leaderboard</button><button class="btn" id="dHome">🗺 World map</button></div>`);
    q('#dAgain').onclick = () => startDaily(d);
    q('#dBoard').onclick = () => board('daily', null, () => dailyResult(info));
    q('#dHome').onclick = () => { dailyRun = null; reloadSave(); init(); title(); };
    sendScore(info, 'daily');
    return true;
  }
  H.doneOverride = info => (info.daily ? dailyResult(info) : (window.COOP && COOP.on ? COOP.done(info) : false));
  H.failOverride = info => (info.daily ? dailyResult(info) : (window.COOP && COOP.on ? COOP.fail(info) : false));

  function startDaily(d) {
    dailyRun = d;
    P = newP(d.world);
    if (typeof fadeTo === 'function') fadeTo(start); else start();
  }
  async function dailyScreen() {
    let d = localDaily();
    const draw = (top, err) => {
      const hrs = Math.floor(d.seconds_left / 3600), mins = Math.floor(d.seconds_left % 3600 / 60);
      show(`<div class="eyebrow">📅 Daily challenge · ${esc(d.day)}</div><h2>Today: ${LV[d.world].n}</h2>
        <p class="sub">Everyone in the world gets the same planet and the same two twists today. Play as often as you like; your best score counts. A new challenge starts in ${hrs}h ${mins}m.</p>
        <div class="dmods">${d.mods.map(id => `<div class="dmod"><span>${MODS[id].ic}</span><div><b>${MODS[id].n}</b><small>${MODS[id].d}</small></div></div>`).join('')}</div>
        <div class="box"><h3>TODAY’S TOP COMMANDERS</h3>${top || `<p class="sub" style="margin:0">${err || (ON ? 'Loading…' : 'Turn on online features in config.js to see the daily leaderboard. You can still play the challenge offline.')}</p>`}</div>
        <div class="acts"><button class="big" id="dGo">▶ Play today’s challenge</button><button class="btn" id="dBack">Back</button></div>`);
      q('#dGo').onclick = () => startDaily(d);
      q('#dBack').onclick = title;
    };
    draw();
    if (!ON) return;
    try {
      await boot();
      d = await rpc('get_daily');
      const rows = await rpc('get_leaderboard', { p_mode: 'daily', p_world: null, p_limit: 5 });
      if (q('#dGo')) draw(rows.length ? table(rows) : '<p class="sub" style="margin:0">No scores yet today. Be the first!</p>');
    } catch (e) { if (q('#dGo')) draw(null, '⚠ ' + esc(e.message)); }
  }

  /* ---------------- leaderboard ---------------- */
  function table(rows) {
    return `<div class="lbt">${rows.map(r => `<div class="lbr${r.is_me ? ' me' : ''}"><span class="rk">${r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : '#' + r.rank}</span><span class="nm">${esc(r.name)}${r.is_me ? ' (you)' : ''}</span><span class="st">${'★'.repeat(Math.min(3, r.stars))}${r.stars > 3 ? ' ×' + r.stars : ''}</span><span class="sc">${Number(r.score).toLocaleString()}</span></div>`).join('')}</div>`;
  }
  async function board(mode = 'campaign', world = null, back = title) {
    const tabs = [['campaign', null, '🌍 Overall'], ...LV.slice(0, 6).map((l, i) => ['campaign', i, l.n]), ['daily', null, '📅 Today'], ['coop', null, '🤝 Co-op']];
    const draw = body => {
      show(`<div class="eyebrow">Worldwide</div><h2>🏆 Leaderboard</h2>
        <div class="tabs lbtabs">${tabs.map(([m, w, n], i) => `<button data-i="${i}" class="${m === mode && w === world ? 'on' : ''}">${n}</button>`).join('')}</div>
        <p class="sub" style="font-size:13px">${mode === 'campaign' && world == null ? 'Each commander’s best score on every world, added together.' : mode === 'daily' ? 'Best scores in today’s daily challenge.' : mode === 'coop' ? 'Best scores from two-player missions.' : 'Best scores on ' + LV[world].n + '.'}</p>
        ${body}<div class="acts"><button class="big" id="lbBack">Back</button></div>`);
      ov.querySelectorAll('.lbtabs button').forEach(b => b.onclick = () => { const t = tabs[+b.dataset.i]; board(t[0], t[1], back); });
      q('#lbBack').onclick = back;
    };
    if (!ON) return draw('<div class="box"><p style="margin:0">Leaderboards need online features. Add your Supabase project to <b>config.js</b> to turn them on.</p></div>');
    draw('<p class="sub">Loading…</p>');
    try {
      await boot();
      const rows = await rpc('get_leaderboard', { p_mode: mode, p_world: world, p_limit: 50 });
      if (q('#lbBack')) draw(rows.length ? table(rows) : '<div class="box"><p style="margin:0">No scores here yet. Finish a mission to claim the top spot!</p></div>');
    } catch (e) {
      if (q('#lbBack')) { draw(`<div class="box"><p style="margin:0">⚠ ${esc(e.message)}</p></div><div class="acts"><button class="btn" id="lbRetry">↻ Try again</button></div>`); q('#lbRetry').onclick = () => board(mode, world, back); }
    }
  }

  /* ---------------- account ---------------- */
  async function account(msg) {
    const em = sess && sess.user && sess.user.email;
    show(`<div class="eyebrow">Your account</div><h2>👤 ${esc(profile ? profile.name : 'Commander')}</h2>
      ${msg ? `<p class="flash">${msg}</p>` : ''}
      <div class="box"><h3>CALL SIGN</h3><p class="sub" style="margin:0 0 6px">This is the name other players see on the leaderboard.</p>
        <div class="frow"><input id="aName" maxlength="16" value="${esc(profile ? profile.name : '')}" autocomplete="nickname" aria-label="Call sign"><button class="btn pri" id="aNameB">Save</button></div><p class="ferr" id="aNameE"></p></div>
      ${isGuest() ? `<div class="box"><h3>KEEP YOUR PROGRESS</h3><p class="sub" style="margin:0 0 6px">You are playing as a guest. Your progress is saved to the cloud on this phone. Add an email and password to sign in on another phone or after reinstalling.</p>
        <div class="fcol"><input id="aEm" type="email" placeholder="Email" autocomplete="email" aria-label="Email"><input id="aPw" type="password" placeholder="Password (6 or more characters)" autocomplete="new-password" aria-label="Password"><button class="btn pri" id="aUp">Save my account</button></div><p class="ferr" id="aUpE"></p></div>
        <div class="box"><h3>ALREADY HAVE AN ACCOUNT?</h3><div class="fcol"><input id="aEm2" type="email" placeholder="Email" autocomplete="email" aria-label="Email"><input id="aPw2" type="password" placeholder="Password" autocomplete="current-password" aria-label="Password"><button class="btn" id="aIn">Sign in</button></div><p class="sub" style="font-size:12.5px;margin:6px 0 0">Your guest progress on this phone is combined with your account.</p><p class="ferr" id="aInE"></p></div>`
      : `<div class="box"><h3>SIGNED IN</h3><p style="margin:0">${esc(em)}</p><div class="acts"><button class="btn" id="aOut">Sign out</button></div></div>`}
      <div class="box"><h3>CLOUD SAVE</h3><p class="sub" style="margin:0" id="aSync">${lastSync ? 'Last saved ' + ago(lastSync) + '.' : 'Not saved yet.'}</p><div class="acts"><button class="btn" id="aSyncB">☁ Sync now</button></div></div>
      <div class="acts"><button class="big" id="aBack">Back</button></div>`);
    q('#aBack').onclick = title;
    q('#aNameB').onclick = async () => {
      const e = q('#aNameE'); e.textContent = 'Saving…';
      try { const n = await rpc('set_name', { p_name: q('#aName').value }); profile = { name: n }; store.set('profile', profile); account('✓ Call sign saved.'); }
      catch (x) { e.textContent = x.message; }
    };
    q('#aSyncB').onclick = async () => { const e = q('#aSync'); e.textContent = 'Syncing…'; try { await boot(); await syncDown(); e.textContent = '✓ Synced just now.'; } catch (x) { e.textContent = '⚠ ' + x.message; } };
    if (isGuest()) {
      q('#aUp').onclick = async () => {
        const e = q('#aUpE'), em = q('#aEm').value.trim(), pw = q('#aPw').value;
        if (!/^\S+@\S+\.\S+$/.test(em)) return void (e.textContent = 'Enter a valid email address.');
        if (pw.length < 6) return void (e.textContent = 'Use a password with at least 6 characters.');
        e.textContent = 'Saving…';
        try {
          await ensure();
          const u = await http('/auth/v1/user', { method: 'PUT', body: { email: em, password: pw } });
          sess.user = u; store.set('session', sess);
          account(u.email ? '✓ Account saved. You can now sign in on any phone.' : '✓ Check your email to confirm your address, then you can sign in on any phone.');
        } catch (x) { e.textContent = x.message; }
      };
      q('#aIn').onclick = async () => {
        const e = q('#aInE'), em = q('#aEm2').value.trim(), pw = q('#aPw2').value;
        if (!em || !pw) return void (e.textContent = 'Enter your email and password.');
        e.textContent = 'Signing in…';
        try {
          setSession(await http('/auth/v1/token?grant_type=password', { body: { email: em, password: pw }, auth: false }));
          ready = null; await boot();
          account('✓ Signed in. Your progress is combined and saved.');
        } catch (x) { e.textContent = x.message; }
      };
    } else {
      q('#aOut').onclick = async () => {
        await push();
        try { await http('/auth/v1/logout?scope=local', { body: {} }); } catch (x) {}
        sess = null; profile = null; ready = null; store.set('session', null); store.set('profile', null);
        title();
      };
    }
  }
  const ago = t => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago'; };

  /* ---------------- title screen panel ---------------- */
  H.titleHtml = () => `<div class="box online"><h3>ONLINE</h3>
    <div class="acts" style="margin-top:0">${ON ? `<button class="btn" id="nAcc">👤 <span id="nName">${esc(profile ? profile.name : 'Connecting…')}</span></button>` : ''}
      <button class="btn pri" id="nDaily">📅 Daily challenge</button><button class="btn" id="nLb">🏆 Leaderboard</button><button class="btn" id="nCoop">🤝 Co-op</button></div>
    <p class="sub" id="nSt" style="margin:6px 0 0;font-size:12.5px">${ON ? (lastSync ? '☁ Cloud save on · last saved ' + ago(lastSync) : '☁ Connecting…') : '📴 Offline mode. Add your Supabase project in config.js to turn on accounts, cloud save, leaderboards and co-op.'}</p></div>`;
  H.titleBind = () => {
    q('#nDaily').onclick = dailyScreen;
    q('#nLb').onclick = () => board();
    q('#nCoop').onclick = () => (window.COOP ? COOP.menu() : null);
    if (!ON) return;
    q('#nAcc').onclick = () => account();
    boot().then(() => {
      if (q('#nName')) q('#nName').textContent = profile.name;
      if (q('#nSt')) q('#nSt').textContent = `☁ Cloud save on · ${isGuest() ? 'guest account' : 'signed in'} · last saved ${ago(lastSync || Date.now())}`;
    }).catch(e => { if (q('#nSt')) q('#nSt').textContent = '⚠ Online features unavailable: ' + e.message; });
  };

  /* ---------------- Realtime (co-op rooms) ----------------
     Supabase Realtime speaks the Phoenix channel protocol over a WebSocket.
     We only need "broadcast": every message is relayed to the other player. */
  function channel(topic, h) {
    const url = BASE.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(KEY) + '&vsn=1.0.0';
    const T = 'realtime:' + topic;
    let ws, ref = 0, joinRef = null, hb = null, joined = false, closed = false;
    try { ws = new WebSocket(url); } catch (e) { setTimeout(() => h.error && h.error('Could not open a connection.'), 0); return { send() {}, close() {}, get ready() { return false; } }; }
    const raw = o => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
    ws.onopen = () => {
      joinRef = String(++ref);
      raw({ topic: T, event: 'phx_join', ref: joinRef, join_ref: joinRef, payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false }, ...(sess ? { access_token: sess.access_token } : KEY.startsWith('eyJ') ? { access_token: KEY } : {}) } });
      hb = setInterval(() => raw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }), 25000);
    };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.topic !== T) return;
      if (m.event === 'phx_reply' && m.ref === joinRef) {
        if (m.payload && m.payload.status === 'ok') { joined = true; h.open && h.open(); }
        else h.error && h.error((m.payload && m.payload.response && (m.payload.response.reason || m.payload.response.message)) || 'The game server refused the room.');
      } else if (m.event === 'broadcast' && m.payload) h.msg && h.msg(m.payload.event, m.payload.payload);
      else if (m.event === 'phx_error' || m.event === 'phx_close') { if (!closed) h.close && h.close(); }
    };
    ws.onerror = () => { if (!joined) h.error && h.error('Could not connect to the game server.'); };
    ws.onclose = () => { clearInterval(hb); joined = false; if (!closed) h.close && h.close(); };
    return {
      send(event, payload) { if (joined) raw({ topic: T, event: 'broadcast', ref: null, join_ref: joinRef, payload: { type: 'broadcast', event, payload } }); },
      close() { closed = true; clearInterval(hb); try { raw({ topic: T, event: 'phx_leave', payload: {}, ref: String(++ref), join_ref: joinRef }); ws.close(); } catch (e) {} },
      get ready() { return joined; }
    };
  }

  window.NET = {
    on: ON, boot, rpc, channel, board, account, dailyScreen, sendScore, scoreBox, esc,
    get name() { return profile ? profile.name : 'Commander'; },
    get guest() { return isGuest(); },
    _merge: merge, _localDaily: localDaily, MODS
  };
})();
