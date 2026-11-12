/* Red Dust Outpost · v86 interface (Moon Productions mission-control design system).
   This layer never rebuilds game logic. It re-arranges the game's own buttons (same ids, same handlers, same
   translations) into calmer layouts and adds read-only panels that display numbers the simulation already has:
   - main menu: one clear primary action (Continue when a save exists), Story and Adventure as two modes,
     a planet card per world, secondary navigation and a version line
   - Story HUD: compact life-support panel, a current-objective line, and a status panel that opens on demand
   - build bar: categories (Energy, Life support, Defense, Infrastructure, Medical) and a detail card on selection
   - settings: six categories, each setting with a one-line explanation
   Everything degrades to the original UI if anything here fails. */
(function () {
  'use strict';
  if (typeof show !== 'function') return;
  const $q = s => document.querySelector(s), esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const VER = 'v90';
  /* ---------- one icon system: simple 24px outline icons, 1.8px strokes ---------- */
  const IP = {
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7z', wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8', leaf: 'M5 21c0-9 5-15 15-16-1 10-7 15-15 16zM5 21l7-8',
    shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', plus: 'M12 5v14M5 12h14', cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z', wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5',
    gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5', play: 'M7 4v16l13-8z', rocket: 'M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2M9 12a22 22 0 0 1 9-9c2 0 3 1 3 3a22 22 0 0 1-9 9l-3 1-1-1zM14 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8', flask: 'M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3',
    globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z', x: 'M6 6l12 12M18 6 6 18', thermo: 'M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z', rad: 'M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM12 3a9 9 0 0 1 7.8 4.5L14 11M4.2 7.5A9 9 0 0 1 12 3M12 21a9 9 0 0 1-7.8-4.5L10 13.5M19.8 16.5A9 9 0 0 1 12 21',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z', home: 'M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', flag: 'M5 21V4M5 4h11l-2 4 2 4H5' };
  const ic = (n, s) => `<svg class="u-i" viewBox="0 0 24 24" width="${s || 16}" height="${s || 16}" aria-hidden="true"><path d="${IP[n] || IP.info}"/></svg>`;
  window.UI86 = { ic, VER };

  /* ---------- verified world data for planet cards (same values and sources as SCIENCE.md) ---------- */
  const WSCI = [
    { g: '1.62 m/s²', gk: '17% of Earth', t: '−173 to 121 °C', d: '29.5 Earth days', a: 'None (a very thin exosphere)', type: 'Moon of Earth' },
    { g: '3.71 m/s²', gk: '38% of Earth', t: '−153 to 20 °C', d: '24 h 40 min', a: 'Thin carbon dioxide, 0.6% of Earth’s pressure', type: 'The fourth planet' },
    { g: '3.70 m/s²', gk: '38% of Earth', t: '−180 to 430 °C', d: '176 Earth days', a: 'None (a very thin exosphere)', type: 'The planet closest to the Sun' },
    { g: '1.31 m/s²', gk: '13% of Earth', t: 'about −160 °C', d: '3.6 Earth days', a: 'Almost none (a trace of oxygen)', type: 'Moon of Jupiter' },
    { g: '1.35 m/s²', gk: '14% of Earth', t: 'about −179 °C', d: '15.9 Earth days', a: 'Thick nitrogen with methane, 1.5× Earth’s pressure', type: 'Moon of Saturn' },
    { g: '0.28 m/s²', gk: '3% of Earth', t: 'about −105 °C', d: '9.1 hours', a: 'None', type: 'Dwarf planet in the asteroid belt' }];
  UI86.WSCI = WSCI;

  /* ---------- main menu ---------- */
  function pcard(i) {
    const L = LV[i], w = WSCI[i]; if (!L) return ''; const st = (typeof STARS !== 'undefined' && STARS[i]) || 0;
    if (!w) return '';
    const mis = (typeof MISS !== 'undefined' && MISS[i]) ? MISS[i].map(m => `<li>${esc(m.t)}</li>`).join('') : '';
    const stat = st >= 3 ? 'Mastered · 3 of 3 stars' : st ? `Outpost built · ${st} of 3 stars` : 'Not explored yet';
    return `<div class="u-pc"><div class="u-pcv"><span class="u-sph" style="${plCss(i)}"></span></div><div class="u-pcb">
      <div class="u-pch"><b>${esc(L.n)}</b><span>${esc(w.type)}</span><span class="u-st" aria-label="${st} of 3 stars">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span></div>
      <div class="u-grid"><div><small>Gravity</small><b>${w.g}</b><span>${w.gk}</span></div><div><small>Temperature</small><b>${w.t}</b></div><div><small>Day length</small><b>${w.d}</b></div><div class="u-wide"><small>Atmosphere</small><b>${w.a}</b></div></div>
      <details class="u-mis"><summary>${ic('flag', 14)}<span>Missions on ${esc(L.n)}</span> · <span>${esc(stat)}</span></summary><ul>${mis}</ul></details></div></div>`;
  }
  function credits(back) {
    show(`<div class="eyebrow">Credits</div><h2>Red Dust Outpost</h2><p class="sub">A game by <b>Moon Productions</b>.</p>
      <div class="box"><h3>Made with</h3><p>3D models of spacecraft, rovers, landers and spacesuits from <b>NASA 3D Resources</b>.</p><p>Planet maps and terrain from <b>NASA</b>, including the <b>Black Marble</b> image of Earth’s city lights.</p><p>Adventure mode is drawn with <b>three.js</b>. Online play uses <b>Supabase</b>. Fonts: <b>Inter</b> and <b>Chakra Petch</b> (Google Fonts).</p></div>
      ${typeof SRC !== 'undefined' && SRC.length ? `<div class="box"><h3>Other 3D models and sources</h3>${SRC.map(r => `<p style="font-size:13px;margin:4px 0"><a href="${esc(r[1])}" target="_blank" rel="noopener" style="color:var(--u-cy)">${esc(r[0])}</a></p>`).join('')}</div>` : ''}
      <div class="box"><h3>Science</h3><p>Every number in the game comes from NASA missions and data. The full list of values and sources is in SCIENCE.md, in the project files.</p></div>
      <div class="acts"><button class="big" id="u-crX">Back</button></div>`);
    $q('#u-crX').onclick = back;
  }
  function titleUI() {
    const sh = $q('#ov .sheet'), play = $q('#play'); if (!sh || !play || sh.dataset.u86) return; sh.dataset.u86 = 1; sh.classList.add('u-title');
    const h1 = sh.querySelector('h1'), eb = sh.querySelector(':scope > .eyebrow'), tsub = sh.querySelector('.tsub'), wds = sh.querySelector('.worlds2'), tsel = sh.querySelector('.tsel'), tplay = sh.querySelector('.tplay'), tq = sh.querySelector('.tq'), more = $q('#tmore');
    const adv = $q('#advB'), segs = tplay ? [...tplay.querySelectorAll('.seg')] : [];
    const brand = document.createElement('div'); brand.className = 'u-brand';
    brand.innerHTML = `<div class="u-studio">MOON PRODUCTIONS</div>`; if (h1) brand.appendChild(h1); const tag = document.createElement('div'); tag.className = 'u-tag'; tag.textContent = 'EXPLORE · BUILD · SURVIVE · DISCOVER'; brand.appendChild(tag);
    if (eb) eb.classList.add('u-hide'); if (tsub) tsub.classList.add('u-hide');
    const has = typeof CP !== 'undefined' && CP && CP.lv === TW;
    const prim = document.createElement('div'); prim.className = 'u-prim';
    play.classList.add('u-play'); play.insertAdjacentHTML('afterbegin', `<small class="u-k">${has ? 'Continue mission' : 'Story mode'}</small>`); prim.appendChild(play);
    if (adv) { adv.classList.add('u-adv'); adv.insertAdjacentHTML('afterbegin', `<small class="u-k">Adventure mode</small>`); prim.appendChild(adv); }
    { const sv = $q('#survB'); if (sv) { sv.classList.add('u-adv', 'u-sv'); sv.insertAdjacentHTML('afterbegin', `<small class="u-k">Survival mode · new</small>`); prim.appendChild(sv); } }
    const story = document.createElement('section'); story.className = 'u-story'; story.setAttribute('aria-label', 'Story mode setup');
    story.innerHTML = `<div class="u-sh">${ic('globe', 14)} Choose a world</div>`; if (wds) story.appendChild(wds);
    story.insertAdjacentHTML('beforeend', pcard(TW));
    if (tsel) { const p = tsel.querySelector('p'); if (p) { p.className = 'u-brief'; story.querySelector('.u-pcb') && story.querySelector('.u-pcb').insertBefore(p, story.querySelector('.u-mis')); } tsel.remove(); }
    sh.querySelectorAll(':scope > p.sub').forEach(p => { if (!p.classList.contains('tsub')) story.appendChild(p); });
    const setup = document.createElement('div'); setup.className = 'u-setup'; segs.forEach((s, i) => { const w = document.createElement('div'); w.className = 'u-seg'; w.innerHTML = `<small>${i ? 'View' : 'Difficulty'}</small>`; w.appendChild(s); setup.appendChild(w); }); story.appendChild(setup);
    const nav = document.createElement('nav'); nav.className = 'u-nav'; nav.setAttribute('aria-label', 'More');
    const navB = (id, icon) => { const b = $q('#' + id); if (!b) return; b.classList.add('u-nb'); [...b.childNodes].slice(0, 2).forEach(n => { if (n.nodeType === 1 && /^(svg|img|i)$/i.test(n.tagName)) n.remove(); else if (n.nodeType === 3) n.textContent = n.textContent.replace(/^[\s\p{Extended_Pictographic}\u2600-\u27BF\uFE0F]+/u, ''); }); b.insertAdjacentHTML('afterbegin', ic(icon, 15)); nav.appendChild(b); };
    navB('fgT', 'book'); navB('stB2', 'gear'); navB('howB', 'info');
    const cr = document.createElement('button'); cr.className = 'btn u-nb'; cr.id = 'u-cred'; cr.innerHTML = ic('star', 15) + 'Credits'; cr.onclick = () => { if (typeof snd === 'function') snd('ui'); credits(() => title()); }; nav.appendChild(cr);
    const mb = $q('#moreB'); if (mb) { mb.classList.add('u-nb'); nav.appendChild(mb); }
    if (tq) tq.classList.add('u-extra');
    const ver = document.createElement('div'); ver.className = 'u-ver'; ver.textContent = `${VER} · Moon Productions`;
    const frag = document.createDocumentFragment(); [brand, prim, story, nav].forEach(e => frag.appendChild(e));
    const tw6 = [...sh.querySelectorAll(':scope > .acts')].find(a => a.querySelector('#fbB')); if (tw6) frag.appendChild(tw6);
    if (tq) frag.appendChild(tq); sh.insertBefore(frag, sh.firstChild); if (more) sh.appendChild(more); sh.appendChild(ver); if (tplay && !tplay.children.length) tplay.remove();
  }
  if (typeof title === 'function') { const t0 = title; window.title = title = function () { const r = t0.apply(this, arguments); try { titleUI(); } catch (e) { console.warn('ui86 title', e); } return r; }; }

  /* ---------- settings: six categories with plain explanations ---------- */
  let STAB = 'gfx';
  const SETG = [
    ['gfx', 'Graphics', [['v3B', 'Switch between the flat pixel view and the 3D views.'], ['gxB', 'How much detail the 3D views draw. Automatic picks what runs smoothly on this device.'], ['camB', 'Where the 3D camera sits: above the base, behind you, free, or first person.'], ['c3B', 'Show the story scenes in 3D or in the classic pixel style.'], ['emB', 'Use clean symbols or fun emoji for icons.']]],
    ['aud', 'Audio', [['@vol', 'Master changes everything. Effects covers weapons, buildings and ambience. Music is the soundtrack.']]],
    ['ctl', 'Controls', [['dvB', 'Button layout for phone, tablet or computer. Automatic detects your device.'], ['afB', 'Your astronaut fires by itself when an alien is in range, so you can play with one thumb.'], ['vbB', 'Short phone vibrations for hits, explosions and alarms.'], ['@ctl', 'See every keyboard, touch and gamepad control.']]],
    ['a11y', 'Accessibility', [['btB', 'Bigger text in menus and the HUD.'], ['bbB', 'Bigger touch buttons that are easier to hit.'], ['cbcB', 'Colours that stay easy to tell apart with colour blindness.'], ['cbB', 'Mark danger zones with stripes as well as colour.'], ['nflB', 'Fewer bright flashes from explosions and lightning.'], ['hcB', 'Solid panels and bright outlines for easier reading.'], ['skB', 'Shake the screen on big hits and explosions.']]],
    ['lang', 'Language', [['lnB', 'Play in one of 17 languages. Science facts are translated too.']]],
    ['play', 'Gameplay', [['rfB', 'Short, true science facts that appear while you play.'], ['naB', 'Use today’s real data from NASA when you are online.'], ['ctB', 'Story scenes between waves.']]]];
  function settingsUI(back) {
    const sh = $q('#ov .sheet'), bk = $q('#bkS'); if (!sh || !bk || sh.dataset.u86) return; sh.dataset.u86 = 1; sh.classList.add('u-set');
    const h2 = sh.querySelector('h2'); if (h2) h2.textContent = 'Settings'; const eb = sh.querySelector('.eyebrow'); if (eb) eb.textContent = 'Mission control';
    const vol = sh.querySelector('.box'), oldActs = [...sh.querySelectorAll('.acts')];
    const tabs = document.createElement('div'); tabs.className = 'u-tabs'; tabs.setAttribute('role', 'tablist');
    const body = document.createElement('div'); body.className = 'u-sbody';
    SETG.forEach(([k, name, rows]) => {
      const t = document.createElement('button'); t.className = 'u-tab' + (k === STAB ? ' on' : ''); t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', k === STAB); t.textContent = name; t.onclick = () => { STAB = k; tabs.querySelectorAll('.u-tab').forEach(x => { x.classList.toggle('on', x === t); x.setAttribute('aria-selected', x === t); }); body.querySelectorAll('.u-grp').forEach(g => g.hidden = g.dataset.k !== STAB); if (typeof snd === 'function') snd('ui'); }; tabs.appendChild(t);
      const g = document.createElement('div'); g.className = 'u-grp'; g.dataset.k = k; g.hidden = k !== STAB; g.setAttribute('role', 'tabpanel');
      rows.forEach(([id, desc]) => { const r = document.createElement('div'); r.className = 'u-srow';
        if (id === '@vol') { if (vol) { r.appendChild(vol); r.insertAdjacentHTML('beforeend', `<p class="u-sd">${desc}</p>`); g.appendChild(r); } return; }
        if (id === '@ctl') { const b = document.createElement('button'); b.className = 'btn'; b.textContent = '🎮 Show all controls'; b.onclick = () => controls(() => settings(back)); r.appendChild(b); r.insertAdjacentHTML('beforeend', `<p class="u-sd">${desc}</p>`); g.appendChild(r); return; }
        const b = $q('#' + id); if (!b) return; r.appendChild(b); r.insertAdjacentHTML('beforeend', `<p class="u-sd">${desc}</p>`); g.appendChild(r); });
      body.appendChild(g); });
    // anything not placed above stays reachable under Gameplay
    oldActs.forEach(a => a.querySelectorAll('button').forEach(b => { if (b.id !== 'bkS' && !body.contains(b)) { const r = document.createElement('div'); r.className = 'u-srow'; r.appendChild(b); body.querySelector('[data-k="play"]').appendChild(r); } }));
    const foot = document.createElement('div'); foot.className = 'acts'; foot.appendChild(bk);
    oldActs.forEach(a => { if (!a.children.length) a.remove(); });
    if (h2) h2.after(tabs, body, foot); else sh.append(tabs, body, foot);
  }
  if (typeof settings === 'function') { const s0 = settings; window.settings = settings = function (back) { const r = s0.apply(this, arguments); try { settingsUI(back); } catch (e) { console.warn('ui86 settings', e); } return r; }; }

  /* ---------- Story HUD: current objective + status panel (secondary information on demand) ---------- */
  const strip = h => String(h || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  function objText() {
    if (!S || !S.run || S.tu != null || S.land > 0) return '';
    const q = S.al && S.al.find(a => a.boss && !a.hid); if (q && typeof BOSS !== 'undefined' && BOSS[q.ty]) return `Defeat the ${BOSS[q.ty].n}`;
    const m = (S.mis || []).find(x => !x.done); if (m) { try { return strip(misTxt(m)).replace(/^[○◯•✓☐\s]+/, ''); } catch (e) { return m.t; } }
    return `Survive to wave ${SPL} and secure the outpost`;
  }
  function statRow(k, label, val, net, desc) {
    const n = net == null ? '' : `<span class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(1)}/s</span>`;
    return `<div class="u-sr"><div class="u-sl">${ic(k, 15)}<b>${label}</b><span class="u-sv">${val}</span>${n}</div><p>${desc}</p></div>`;
  }
  function statHTML() {
    const r = S.res, rt = S.rate || {}, CT = typeof CHIPT !== 'undefined' ? CHIPT : {}, w = WSCI[S.lv];
    const cnt = {}; S.b.forEach(b => { if (!(b.pop != null && b.pop < 0)) cnt[b.t] = (cnt[b.t] || 0) + 1; });
    const cats = UCATS.map(([ck, nm, , list]) => { const n = list.reduce((s, k) => s + (cnt[k] || 0), 0); return n ? `<span>${nm} <b>${n}</b></span>` : ''; }).join('');
    let tmp = ''; try { if (window.SR && SR.temp) { const t = SR.temp(); tmp = Math.round(typeof t === 'number' ? t : t.c != null ? t.c : t) + ' °C'; } } catch (e) { tmp = ''; }
    const dose = S.dose != null ? `${S.dose.toFixed(1)} mSv` : '';
    return `<div class="u-ph"><b>${ic('home', 15)}<span>${esc(S.L.n)} outpost</span></b><span><span>Wave ${Math.min(S.sol, SPL)} of ${SPL}</span> · <span>${night() ? 'Night' : 'Day'}</span></span><button class="u-x" id="u-stX" aria-label="Close status">${ic('x', 16)}</button></div>
      <div class="u-sec">Life support</div>
      ${statRow('bolt', 'Power', `${Math.round(r.pw)} / ${S.cap || 0}`, rt.pw, CT.pw || '')}
      ${statRow('wind', 'Air', `${Math.round(r.o2)}%`, rt.o2, CT.o2 || '')}
      ${statRow('leaf', 'Food', `${Math.round(r.fd)}%`, rt.fd, CT.fd || '')}
      ${statRow('rad', 'Radiation', `${Math.round(r.rad)}`, null, esc(CT.rad || '') + (dose ? ` <span>Crew dose so far</span>: <b>${dose}</b>` : ''))}
      ${statRow('heart', 'Crew health', `${Math.round(S.hp)}`, null, CT.hp || '')}
      ${window.WHY88 ? WHY88() : ''}
      <div class="u-sec">Base</div><div class="u-tags">${cats || '<span>No modules yet</span>'}<span>Crew <b>${S.crew}</b> / ${typeof crewCap === 'function' ? crewCap() : '?'} beds</span><span>Ore <b>${S.mats}</b></span><span>Coins <b>${S.cr}</b></span>${S.solGen != null ? `<span>Solar now <b>${S.solGen.toFixed(1)}/s</b></span>` : ''}</div>
      ${w ? `<div class="u-sec">Environment</div><div class="u-tags">${tmp ? `<span>${ic('thermo', 13)} <b>${tmp}</b></span>` : ''}<span>Gravity <b>${w.gk}</b></span><span>Day <b>${w.d}</b></span><span>Air <b>${esc(w.a)}</b></span></div>` : ''}
      <div class="u-pa"><button class="btn" id="u-go">${ic('flag', 14)} Goals</button>${researchOpen() ? `<button class="btn" id="u-rs">${ic('flask', 14)} Research</button>` : ''}<button class="btn" id="u-sq">${ic('users', 14)} Squad</button><button class="btn" id="u-fg">${ic('book', 14)} Field guide</button></div>`;
  }
  let STO = false, stT = 0;
  function statOpen(on) {
    STO = on; let p = $q('#u-stat'); if (!on) { if (p) p.hidden = true; return; }
    if (!p) { p = document.createElement('div'); p.id = 'u-stat'; p.className = 'ui'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Outpost status'); $q('#stage').appendChild(p); }
    p.hidden = false; statFill();
  }
  function statFill() {
    const p = $q('#u-stat'); if (!p || p.hidden || !S) return; p.innerHTML = statHTML();
    p.querySelector('#u-stX').onclick = () => statOpen(false);
    p.querySelector('#u-go').onclick = () => { statOpen(false); const m = $q('#misb'); if (m) m.click(); };
    const rs = p.querySelector('#u-rs'); if (rs) rs.onclick = () => { statOpen(false); openShop('r'); };
    p.querySelector('#u-sq').onclick = () => { statOpen(false); loadout(() => hide()); };
    p.querySelector('#u-fg').onclick = () => { statOpen(false); guide(() => hide()); };
  }
  function hudUI() {
    if (!S) return; const top = $q('#top'); if (!top) return;
    let ob = $q('#u-obj'); if (!ob) { ob = document.createElement('button'); ob.id = 'u-obj'; ob.className = 'u-obj'; ob.setAttribute('aria-label', 'Current objective. Tap to open the goals list.'); ob.onclick = () => { const m = $q('#misb'); if (m) m.click(); }; const res = $q('#res'); if (res) res.after(ob); else top.appendChild(ob); }
    const t = objText(); if (ob.dataset.t !== t) { ob.dataset.t = t; ob.innerHTML = t ? `<span class="u-k">${ic('target', 13)} Objective</span><span class="u-ot">${esc(t)}</span>` : ''; } ob.hidden = !t;
    const res = $q('#res'); if (res && !res.dataset.u86) { res.dataset.u86 = 1; res.title = 'Tap for the outpost status';
      res.addEventListener('click', e => { if (!S || !S.run) return; e.stopPropagation(); e.preventDefault(); if (typeof snd === 'function') snd('ui'); statOpen(!STO); }, true); }
    if (STO && (stT = (stT + 1) % 6) === 0) statFill(); if (STO && (!S.run || S.pz)) statOpen(false);
  }
  if (typeof hudUp === 'function') { const h0 = hudUp; window.hudUp = hudUp = function () { const r = h0.apply(this, arguments); try { hudUI(); } catch (e) { console.warn('ui86 hud', e); } return r; }; }

  /* ---------- build bar: categories + details on selection ---------- */
  const UCATS = [['en', 'Energy', 'bolt', ['solar', 'battery', 'rtg', 'reactor']], ['ls', 'Life support', 'wind', ['o2', 'farm', 'habitat']], ['df', 'Defense', 'shield', ['turret', 'tesla', 'wall', 'shield']], ['in', 'Infrastructure', 'wrench', ['drill', 'pylon']], ['md', 'Medical', 'cross', ['medbay']]];
  UI86.UCATS = UCATS;
  const catOf = k => (UCATS.find(c => c[3].includes(k)) || ['all'])[0];
  let UCAT = 'auto', lastSel = null;
  function catApply() {
    const cards = $q('#cards'); if (!cards || typeof S === 'undefined' || !S) return;
    const tut = S.tu != null; let c = UCAT === 'auto' ? catOf(sel) : UCAT;
    if (tut) c = 'all';
    cards.querySelectorAll('.card').forEach(e => e.classList.toggle('ucx', c !== 'all' && catOf(e.dataset.k) !== c));
    cards.querySelectorAll('.u-ct').forEach(b => { const on = b.dataset.c === c; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    // a category with nothing unlocked yet says so instead of looking empty
    const any = [...cards.querySelectorAll('.card')].some(e => !e.hidden && !e.classList.contains('ucx')); let em = cards.querySelector('.u-cem'); if (!any) { if (!em) { em = document.createElement('div'); em.className = 'u-cem'; cards.appendChild(em); } em.textContent = 'Nothing here is unlocked yet. Survive more waves or research it.'; } else if (em) em.remove();
  }
  function catBar() {
    const cards = $q('#cards'); if (!cards || cards.querySelector('.u-cat')) return;
    const bar = document.createElement('div'); bar.className = 'u-cat'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Building categories');
    bar.innerHTML = `<button class="u-ct" data-c="all" title="All buildings">${ic('grid', 15)}<span>All</span></button>` + UCATS.map(([k, n, i]) => `<button class="u-ct" data-c="${k}" title="${n}">${ic(i, 15)}<span>${n}</span></button>`).join('');
    bar.querySelectorAll('.u-ct').forEach(b => b.onclick = e => { e.stopPropagation(); UCAT = b.dataset.c; if (typeof snd === 'function') snd('ui'); catApply(); });
    cards.insertBefore(bar, cards.firstChild);
    cards.querySelectorAll('.card').forEach(c => { c.addEventListener('click', () => { UCAT = UCAT === 'all' ? 'all' : catOf(c.dataset.k); setTimeout(() => detail(c.dataset.k, true), 0); });
      c.addEventListener('mouseenter', () => { if (LAYpc()) detail(c.dataset.k, false); }); c.addEventListener('mouseleave', () => { if (LAYpc()) detailHide(1200); }); });
  }
  const LAYpc = () => typeof LAY !== 'undefined' && LAY === 'pc';
  let dT = 0;
  function detail(k, sticky) {
    if (!S || !S.run || !BT[k]) return; const b = BT[k], f = (typeof BINFO !== 'undefined' && BINFO[k]) || {}, cat = UCATS.find(c => c[3].includes(k));
    let av = '', avc = 'ok'; if (S.sol < b.ul) { av = `Unlocks on wave ${b.ul}`; avc = 'no'; } else if (typeof techOk === 'function' && !techOk(k)) { av = 'Needs research first'; avc = 'no'; } else if (typeof canBuy === 'function' && !canBuy(k)) { av = 'Not enough ore or coins yet'; avc = 'warn'; } else av = 'Ready to build';
    let up = ''; try { up = `Level 2: ${b.eff(LM[1])} · Level 3: ${b.eff(LM[2])}`; } catch (e) {}
    let p = $q('#u-bdet'); if (!p) { p = document.createElement('div'); p.id = 'u-bdet'; p.className = 'ui'; p.setAttribute('aria-live', 'polite'); $q('#stage').appendChild(p); }
    const tx = typeof tx_ === 'function' ? tx_ : (x => x);
    p.innerHTML = `<div class="u-bh"><img src="${ICON[k]}" alt=""><div><small>${cat ? cat[1] : 'Building'}</small><b>${esc(b.n)}</b></div><span class="u-av ${avc}">${av}</span></div>
      <p>${esc(tx(b.info))}</p><div class="u-bs"><span><small>Cost</small><b>${costOf(k)} <span>ore</span>${b.cr ? ' + ' + b.cr + ' <span>coins</span>' : ''}</b></span><span><small>Level 1</small><b>${esc(tx(b.eff(LM[0])))}</b></span>${f.use ? `<span><small>Uses</small><b>${esc(strip(tx(f.use)))}</b></span>` : ''}</div>${up ? `<p class="u-up">${ic('star', 12)} Upgrade a built one: ${esc(tx(up))}</p>` : ''}`;
    p.classList.add('on'); clearTimeout(dT); if (sticky) detailHide(6500);
  }
  function detailHide(ms) { clearTimeout(dT); dT = setTimeout(() => { const p = $q('#u-bdet'); if (p) p.classList.remove('on'); }, ms || 0); }
  if (typeof buildDock === 'function') { const b0 = buildDock; window.buildDock = buildDock = function () { const r = b0.apply(this, arguments); try { catBar(); catApply(); } catch (e) { console.warn('ui86 dock', e); } return r; }; }
  if (typeof dockUp === 'function') { const d0 = dockUp; window.dockUp = dockUp = function () { const r = d0.apply(this, arguments); try { catBar(); if (sel !== lastSel) { lastSel = sel; if (UCAT !== 'all') UCAT = catOf(sel); } catApply(); } catch (e) { console.warn('ui86 dockUp', e); } return r; }; }
  try { if ($q('#cards') && $q('#cards').children.length) { catBar(); } } catch (e) {}

  /* ---------- design system stylesheet (added last so it wins; high-contrast mode keeps its own look) ---------- */
  const css = document.createElement('style'); css.id = 'ui86css'; css.textContent = String.raw`
:root{--u-bg:#101820;--u-bg2:#192630;--u-cy:#55D6E8;--u-or:#F4A259;--u-ok:#65C98A;--u-wa:#F2C14E;--u-cr:#E76F6F;--u-tx:#F2F5F7;--u-tx2:#A7B4BF;--u-ln:rgba(167,180,191,.16);--u-ln2:rgba(167,180,191,.3);--u-r:10px;--u-f:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--u-d:"Chakra Petch","Inter",system-ui,sans-serif;
 --void:#101820;--panel:rgba(16,24,32,.9);--panel2:#192630;--line:rgba(167,180,191,.16);--ink:#F2F5F7;--dim:#A7B4BF;--cool:#55D6E8;--signal:#F4A259;--ok:#65C98A;--warn:#F2C14E;--bad:#E76F6F;--ui:var(--u-f);--glass:none;--sh:0 8px 24px rgba(0,0,0,.35)}
.u-i{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:-3px}
body:not(.hc){font-family:var(--u-f)}
body:not(.hc) #ov,body:not(.hc) #shop{background:rgba(10,16,22,.9);-webkit-backdrop-filter:none;backdrop-filter:none}
body:not(.hc) #ov.clear{background:linear-gradient(90deg,rgba(16,24,32,.96) 0%,rgba(16,24,32,.86) 38%,rgba(16,24,32,.15) 66%,rgba(16,24,32,0) 80%)!important}
body:not(.hc) .sheet h2{font:700 24px/1.2 var(--u-f);letter-spacing:-.01em;color:var(--u-tx)}
body:not(.hc) .eyebrow{font:700 11px var(--u-f)!important;letter-spacing:.16em!important;color:var(--u-cy)!important}
body:not(.hc) .sheet p{color:var(--u-tx)}body:not(.hc) .sheet .sub{color:var(--u-tx2)}
body:not(.hc) .box{background:var(--u-bg2);border:1px solid var(--u-ln);border-radius:12px;box-shadow:none}
body:not(.hc) .box h3{font:700 11px var(--u-f);letter-spacing:.14em;text-transform:uppercase;color:var(--u-or)}
body:not(.hc) .btn{background:var(--u-bg2);border:1px solid var(--u-ln2);border-radius:var(--u-r);box-shadow:none;color:var(--u-tx);font:600 13.5px var(--u-f);transition:border-color .15s,background .15s,transform .08s}
body:not(.hc) .btn:hover{border-color:var(--u-cy);background:#1d2e3a}body:not(.hc) .btn:active{transform:scale(.97)}
body:not(.hc) .btn.okb{border-color:rgba(101,201,138,.6)}
body:not(.hc) .big{background:var(--u-cy);color:#06222a;border:0;border-radius:12px;box-shadow:0 6px 18px rgba(85,214,232,.22);font:700 18px var(--u-f);letter-spacing:.01em;transition:transform .08s,filter .15s}
body:not(.hc) .big:hover{filter:brightness(1.08)}body:not(.hc) .big:active{transform:scale(.98)}
body:not(.hc) .seg{border:1px solid var(--u-ln2);border-radius:10px;background:var(--u-bg2)}body:not(.hc) .seg button{font:600 13px var(--u-f);color:var(--u-tx2)}body:not(.hc) .seg button.on{background:var(--u-cy);color:#06222a}
body:not(.hc) .choice{background:var(--u-bg2)!important;border:1px solid var(--u-ln2)!important;border-radius:12px!important;box-shadow:none!important}body:not(.hc) .choice:hover{border-color:var(--u-cy)!important}
body:not(.hc) .tabs button.on,body:not(.hc) .u-tab.on{background:var(--u-cy)!important;color:#06222a!important;border-color:var(--u-cy)!important}
/* ---- main menu ---- */
.u-hide{display:none!important}
body:not(.hc) .sheet.u-title{max-width:min(540px,100%);display:flex;flex-direction:column;gap:12px}
.u-brand{padding-top:4px}.u-studio{font:700 11px var(--u-f);letter-spacing:.32em;color:var(--u-tx2)}
body:not(.hc) .u-title h1{font:700 clamp(34px,5.6vw,54px)/.95 var(--u-d)!important;letter-spacing:.06em!important;color:var(--u-tx)!important;text-shadow:0 2px 24px rgba(0,0,0,.6)!important;margin:6px 0 6px!important;max-width:9ch;cursor:default}
.u-tag{font:600 11.5px var(--u-f);letter-spacing:.22em;color:var(--u-or)}
.u-prim{display:grid;grid-template-columns:1.25fr 1fr;gap:10px}
body:not(.hc) .u-prim .big{display:block;text-align:left;padding:12px 16px;min-height:64px;outline:0;animation:none;margin:0;width:100%}
body:not(.hc) .u-prim .big.u-adv{background:var(--u-bg2);color:var(--u-tx);border:1px solid rgba(244,162,89,.55);box-shadow:none}
body:not(.hc) .u-prim .big.u-adv:hover{border-color:var(--u-or);background:#21313d}
.u-prim .big small{font:600 12px var(--u-f);opacity:.75;margin-top:2px;display:block}
.u-prim .big small.u-k,.u-obj .u-k{font:700 10.5px var(--u-f)!important;letter-spacing:.16em;text-transform:uppercase;opacity:.8;margin:0 0 3px!important}
.u-prim .u-adv small.u-k{color:var(--u-or);opacity:1}
.u-prim .u-sv{grid-column:1/-1}.u-prim .u-sv small.u-k{color:var(--u-cy)}body:not(.hc) .u-prim .big.u-sv{border-color:rgba(85,214,232,.55)}body:not(.hc) .u-prim .big.u-sv:hover{border-color:var(--u-cy)}
.u-story{background:rgba(25,38,48,.78);border:1px solid var(--u-ln);border-radius:14px;padding:12px}
.u-sh{font:700 11px var(--u-f);letter-spacing:.16em;text-transform:uppercase;color:var(--u-tx2);display:flex;gap:6px;align-items:center}
body:not(.hc) .u-story .worlds2{margin:8px 0 10px;gap:8px}
body:not(.hc) .u-story .wd{background:transparent;border:1px solid var(--u-ln);border-radius:12px;padding:6px 6px 5px;min-width:58px;transition:border-color .15s,transform .15s}
body:not(.hc) .u-story .wd.on{border-color:var(--u-or);background:rgba(244,162,89,.08)}body:not(.hc) .u-story .wd:not(:disabled):hover{border-color:var(--u-cy);transform:translateY(-1px)}
.u-pc{display:flex;gap:12px;align-items:flex-start;animation:u-in .35s ease}
.u-pcv{flex:none;padding-top:2px}.u-sph{display:block;width:64px;height:64px;border-radius:50%;box-shadow:inset -10px -8px 18px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.06),0 0 30px rgba(244,162,89,.12)}
.u-pcb{flex:1;min-width:0}.u-pch{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.u-pch b{font:700 20px var(--u-f);color:var(--u-or)}.u-pch>span{font-size:12.5px;color:var(--u-tx2)}
.u-st{margin-left:auto;color:var(--u-wa);letter-spacing:.08em;font-size:13px}.u-st i{font-style:normal;color:rgba(167,180,191,.35)}
.u-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0 6px}.u-grid>div{background:rgba(16,24,32,.7);border:1px solid var(--u-ln);border-radius:9px;padding:6px 8px;min-width:0}
.u-grid small{display:block;font:600 10px var(--u-f);letter-spacing:.12em;text-transform:uppercase;color:var(--u-tx2)}.u-grid b{display:block;font:600 13px/1.25 var(--u-f);color:var(--u-tx);margin-top:2px}.u-grid span{display:block;font-size:11px;color:var(--u-tx2)}.u-grid .u-wide{grid-column:1/-1}
.u-brief{font-size:13.5px!important;color:var(--u-tx)!important;margin:4px 0!important;line-height:1.45!important}
.u-mis{font-size:13px;color:var(--u-tx2);margin-top:4px}.u-mis summary{cursor:pointer;list-style:none;display:flex;gap:6px;align-items:center;color:var(--u-tx2)}.u-mis summary::-webkit-details-marker{display:none}.u-mis summary span{color:var(--u-tx)}.u-mis ul{margin:6px 0 0 18px;padding:0;color:var(--u-tx)}.u-mis li{margin:2px 0}
.u-setup{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.u-seg small{display:block;font:700 10px var(--u-f);letter-spacing:.14em;text-transform:uppercase;color:var(--u-tx2);margin-bottom:4px}
.u-nav{display:flex;flex-wrap:wrap;gap:6px}body:not(.hc) .u-nav .btn{background:transparent;border-color:transparent;display:inline-flex;gap:6px;align-items:center;color:var(--u-tx2);padding:7px 10px}body:not(.hc) .u-nav .btn:hover{color:var(--u-tx);border-color:var(--u-ln2);background:var(--u-bg2)}
body:not(.hc) .acts.u-extra{gap:6px;margin:0}body:not(.hc) .acts.u-extra .btn{font-size:12.5px;padding:6px 10px}
body:not(.hc) .acts.u-extra #tourB{border-color:rgba(242,193,78,.6);color:var(--u-wa)}
.u-ver{font:500 11px var(--u-f);color:rgba(167,180,191,.6);letter-spacing:.08em;margin-top:4px}
@media (min-width:900px){.u-ver{position:fixed;right:calc(16px + var(--sr));bottom:calc(12px + var(--sb))}}
@media (max-width:560px){.u-prim{grid-template-columns:1fr}.u-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.u-grid b{font-size:12px}.u-sph{width:44px!important;height:44px!important}body:not(.hc) .u-story .worlds2{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}body:not(.hc) .u-story .wd{flex:none}.u-obj{width:auto;max-width:calc(100vw - 24px);flex-direction:column;align-items:flex-start;gap:1px}.u-obj .u-ot{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}}
@media (max-height:520px){body:not(.hc) .sheet.u-title{gap:8px}.u-tag{display:none}body:not(.hc) .u-title h1{font-size:30px!important;max-width:none}body:not(.hc) .u-prim .big{min-height:52px;padding:8px 14px}.u-sph{width:48px;height:48px}}
.tfact{background:rgba(16,24,32,.9)!important;border:1px solid var(--u-ln2)!important;border-radius:12px!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;font-family:var(--u-f)}
#wid{background:rgba(16,24,32,.96)!important;border-top-color:var(--u-ln2)!important;border-right-color:var(--u-ln2)!important;border-bottom-color:var(--u-ln2)!important;font-family:var(--u-f)}#wid b{font-family:var(--u-d)!important}
/* ---- Adventure mode: same design system, panels stay small and out of the way ---- */
#adv{font-family:var(--u-f)!important}
#adv .ab{background:rgba(16,24,32,.78)!important;border:1px solid var(--u-ln2)!important;border-radius:10px!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;font:600 12px var(--u-f)!important;color:var(--u-tx)!important}
#adv .ab:hover{border-color:var(--u-cy)!important}
#adv #aMis{background:rgba(16,24,32,.78)!important;border:1px solid var(--u-ln)!important;border-left:3px solid var(--u-or)!important;border-radius:10px!important;font-family:var(--u-f)!important}
#adv #aMis b{color:var(--u-or)!important;font-family:var(--u-f)!important}
#adv #aSpd,#adv #aLd{background:rgba(16,24,32,.78)!important;border:1px solid var(--u-ln)!important;border-radius:9px!important;font:600 11.5px var(--u-f)!important;color:var(--u-tx)!important;font-variant-numeric:tabular-nums}
#adv #aToast{background:rgba(16,24,32,.95)!important;border:1px solid var(--u-ln2)!important;border-left:3px solid var(--u-cy)!important;font:600 13px var(--u-f)!important}
#adv .pnl{background:rgba(10,16,22,.78)!important}
#adv .crd{background:#101820!important;border:1px solid var(--u-ln2)!important;border-radius:16px!important;box-shadow:0 20px 60px rgba(0,0,0,.6)!important;font-family:var(--u-f)}
#adv .crd .ey{font:700 10.5px var(--u-f)!important;letter-spacing:.16em!important;color:var(--u-cy)!important}#adv .crd h2{font:700 22px var(--u-f)!important}#adv .crd .mt{color:var(--u-tx2)!important}
#adv .crd button{background:var(--u-bg2)!important;border:1px solid var(--u-ln2)!important;border-radius:10px!important;font:600 13px var(--u-f)!important;color:var(--u-tx)!important}#adv .crd button:hover{border-color:var(--u-cy)!important}
#adv .crd button.pr{background:var(--u-cy)!important;border-color:var(--u-cy)!important;color:#06222a!important}
#adv .grid h4{color:var(--u-or)!important;font:700 10.5px var(--u-f)!important;letter-spacing:.14em!important}#adv .grid button{font-size:11.5px!important}
#adv .lab{font-family:var(--u-f)!important;font-weight:600!important;letter-spacing:.02em}
#adv #aThr{background:radial-gradient(circle at 40% 35%,#9cecf7,#2a8ea0)!important}#adv #aBst{background:radial-gradient(circle at 40% 35%,#ffcf9a,#e98a3c)!important}#adv #aScn{background:radial-gradient(circle at 40% 35%,#ffe6a0,#d8a63a)!important}
#adv .rbtn{border:2px solid rgba(242,245,247,.45)!important;font-family:var(--u-f)!important;font-weight:700!important}
#adv #aLand,#adv #aDrv{background:var(--u-or)!important;color:#2a1405!important;border-color:#ffd9b3!important;font-family:var(--u-f)!important}#adv #aFly{background:var(--u-cy)!important;color:#06222a!important;font-family:var(--u-f)!important}
#adv #aTitle h1{font-family:var(--u-d)!important}
/* ---- notifications and small cards: compact, one style ---- */
body:not(.hc) #toast{background:rgba(16,24,32,.95)!important;border:1px solid var(--u-ln2)!important;border-left:3px solid var(--u-wa)!important;border-radius:10px!important;box-shadow:0 6px 18px rgba(0,0,0,.4)!important;font-family:var(--u-f)}
body:not(.hc) #bcard{background:rgba(16,24,32,.97)!important;border:1px solid var(--u-ln2)!important;border-top:2px solid var(--u-cy)!important;border-radius:14px!important;font-family:var(--u-f)}
body:not(.hc) #rankup{font-family:var(--u-f)}
body:not(.hc) #load{background:#101820!important;font-family:var(--u-f)}
/* ---- settings ---- */
.u-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}.u-tab{background:var(--u-bg2);border:1px solid var(--u-ln2);border-radius:999px;padding:7px 14px;font:600 13px var(--u-f);color:var(--u-tx2)}
.u-grp{display:flex;flex-direction:column;gap:8px;animation:u-in .25s ease}.u-srow{background:var(--u-bg2);border:1px solid var(--u-ln);border-radius:12px;padding:10px 12px}
.u-srow>.btn{width:100%;text-align:left;justify-content:flex-start}.u-srow .box{margin:0;border:0;padding:0;background:none}.u-sd{margin:6px 2px 0!important;font-size:12.5px!important;color:var(--u-tx2)!important;line-height:1.4!important}
/* ---- in-game HUD ---- */
body:not(.hc) .chip,body:not(.hc) .tb{background:rgba(16,24,32,.86);border:1px solid var(--u-ln);border-radius:9px;box-shadow:0 2px 10px rgba(0,0,0,.3);font-family:var(--u-f);color:var(--u-tx)}
body:not(.hc) #res{background:rgba(16,24,32,.86);border:1px solid var(--u-ln);border-radius:11px;box-shadow:0 2px 10px rgba(0,0,0,.3);cursor:pointer}
body:not(.hc) #res .chip{background:none;border:0;box-shadow:none}
body:not(.hc) .chip.w{background:rgba(231,111,111,.18);border-color:var(--u-cr)}
body:not(.hc) .ban{background:rgba(16,24,32,.92);border:1px solid var(--u-ln2);border-left:3px solid var(--u-cy);border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.35)}
body:not(.hc) .ban.tut{border-left-color:var(--u-wa);background:rgba(40,34,16,.94)}body:not(.hc) .ban.mc{border-left-color:var(--u-ok)}body:not(.hc) .ban .lab{font:700 10.5px var(--u-f);letter-spacing:.14em;color:var(--u-cy)}
body:not(.hc) .msg{background:rgba(16,24,32,.88);border-left:3px solid var(--u-or);border-radius:8px}
body:not(.hc) .misp{background:rgba(16,24,32,.95);border:1px solid var(--u-ln2);border-radius:12px}
.u-obj{pointer-events:auto;display:flex;gap:8px;align-items:center;max-width:min(520px,100%);background:rgba(16,24,32,.82);border:1px solid var(--u-ln);border-left:3px solid var(--u-or);border-radius:9px;padding:4px 10px;color:var(--u-tx);font:500 12.5px/1.3 var(--u-f);text-align:left;cursor:pointer;width:max-content}
.u-obj .u-k{color:var(--u-or);display:inline-flex;gap:4px;align-items:center;white-space:nowrap;margin:0!important}.u-obj .u-ot{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#u-stat{position:absolute;left:calc(8px + var(--sl));top:calc(92px + var(--st));z-index:7;width:min(380px,calc(100% - 24px));max-height:calc(100% - 120px);overflow:auto;background:rgba(16,24,32,.97);border:1px solid var(--u-ln2);border-radius:14px;padding:12px 14px;box-shadow:0 12px 32px rgba(0,0,0,.5);font:13px/1.4 var(--u-f);color:var(--u-tx);animation:u-in .2s ease}
.u-ph{display:flex;align-items:center;gap:8px}.u-ph b{font:700 15px var(--u-f);display:flex;gap:6px;align-items:center}.u-ph span{color:var(--u-tx2);font-size:12px}.u-x{margin-left:auto;background:none;border:1px solid var(--u-ln2);border-radius:8px;color:var(--u-tx);width:30px;height:30px;display:grid;place-items:center}
.u-sec{font:700 10.5px var(--u-f);letter-spacing:.16em;text-transform:uppercase;color:var(--u-or);margin:12px 0 4px}
.u-sr{padding:6px 0;border-top:1px solid var(--u-ln)}.u-sl{display:flex;gap:7px;align-items:center}.u-sl b{font-weight:600}.u-sv{margin-left:auto;font-variant-numeric:tabular-nums}.u-sl .pos{color:var(--u-ok);font-size:12px;min-width:58px;text-align:right}.u-sl .neg{color:var(--u-cr);font-size:12px;min-width:58px;text-align:right}.u-sr p{margin:2px 0 0 22px;color:var(--u-tx2);font-size:12px}
.u-tags{display:flex;flex-wrap:wrap;gap:6px}.u-tags span{background:var(--u-bg2);border:1px solid var(--u-ln);border-radius:8px;padding:3px 8px;font-size:12px;color:var(--u-tx2);display:inline-flex;gap:4px;align-items:center}.u-tags b{color:var(--u-tx);font-weight:600}
.u-pa{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.u-pa .btn{display:inline-flex;gap:6px;align-items:center}
/* ---- build bar ---- */
body:not(.hc) #cards{background:rgba(16,24,32,.88);border:1px solid var(--u-ln);border-radius:14px}
body:not(.hc) .card{background:var(--u-bg2);border:1px solid var(--u-ln);border-radius:10px;font-family:var(--u-f);transition:border-color .15s,transform .12s}
body:not(.hc) .card:hover{border-color:var(--u-ln2);transform:translateY(-1px)}
body:not(.hc) .card.sel{border-color:var(--u-cy);background:#1b3340;box-shadow:0 0 0 1px var(--u-cy)}
body:not(.hc) .card .cost{color:var(--u-wa)}
.card.ucx{display:none!important}
.u-cat{flex:none;display:grid;grid-template-columns:repeat(3,26px);grid-auto-rows:26px;gap:3px;align-self:center;margin-right:3px}
.u-ct{width:26px;height:26px;display:grid;place-items:center;border-radius:7px;background:transparent;border:1px solid var(--u-ln);color:var(--u-tx2);padding:0}.u-ct span{display:none}.u-ct.on{background:var(--u-cy);border-color:var(--u-cy);color:#06222a}.u-ct:hover{border-color:var(--u-cy)}
body.lay-ph .u-cat{grid-template-columns:repeat(3,1fr);width:100%;grid-auto-rows:30px;margin:0 0 4px}body.lay-ph .u-ct{width:auto;height:30px;display:flex;gap:4px;justify-content:center;font:600 11px var(--u-f)}body.lay-ph .u-ct span{display:inline}
.u-cem{font:12px/1.35 var(--u-f);color:var(--u-tx2);padding:6px 8px;max-width:180px;white-space:normal}
#u-bdet{position:absolute;left:50%;bottom:calc(96px + var(--sb));transform:translate(-50%,8px);z-index:5;width:min(400px,calc(100% - 24px));background:rgba(16,24,32,.96);border:1px solid var(--u-ln2);border-top:2px solid var(--u-cy);border-radius:12px;padding:10px 12px;font:13px/1.4 var(--u-f);color:var(--u-tx);pointer-events:none;opacity:0;transition:opacity .2s,transform .2s;box-shadow:0 10px 28px rgba(0,0,0,.45)}
#u-bdet.on{opacity:1;transform:translate(-50%,0)}
.u-bh{display:flex;gap:10px;align-items:center}.u-bh img{width:32px;height:32px;image-rendering:pixelated}.u-bh small{display:block;font:700 10px var(--u-f);letter-spacing:.14em;text-transform:uppercase;color:var(--u-tx2)}.u-bh b{font:700 16px var(--u-f)}
.u-av{margin-left:auto;font:600 11.5px var(--u-f);padding:3px 8px;border-radius:999px;border:1px solid}.u-av.ok{color:var(--u-ok);border-color:rgba(101,201,138,.5)}.u-av.warn{color:var(--u-wa);border-color:rgba(242,193,78,.5)}.u-av.no{color:var(--u-tx2);border-color:var(--u-ln2)}
#u-bdet p{margin:6px 0;color:var(--u-tx2)}.u-bs{display:flex;gap:6px;flex-wrap:wrap}.u-bs span{background:var(--u-bg2);border:1px solid var(--u-ln);border-radius:8px;padding:4px 8px}.u-bs small{display:block;font:700 9.5px var(--u-f);letter-spacing:.12em;text-transform:uppercase;color:var(--u-tx2)}.u-bs b{font-weight:600;font-size:12.5px}
#u-bdet .u-up{font-size:12px;color:var(--u-tx2);margin:6px 0 0}
body.lay-ph #dock.open~#u-bdet,body.lay-ph:has(#dock.open) #u-bdet{opacity:0}
/* ---- action buttons: one calm family, the main action (FIRE) in orange, building in cyan ---- */
body:not(.hc) #act .rb,body:not(.hc) .rb{border:2px solid rgba(85,214,232,.5)}
body:not(.hc) #fire{background:radial-gradient(circle at 40% 35%,#ffbd85,#e98a3c)!important;border-color:#ffd9b3!important;color:#2a1405!important}
body:not(.hc) #earth{background:radial-gradient(circle at 40% 35%,#2c4d63,#173040)!important;border-color:var(--u-cy)!important}
body:not(.hc) #emp{background:#173040!important;border-color:rgba(85,214,232,.6)!important}
body:not(.hc) #bh{background:var(--u-cy)!important;color:#06222a!important;border-color:#bff3fa!important}
body:not(.hc) #insp{background:rgba(16,24,32,.97);border:1px solid var(--u-ln2);border-radius:14px;font-family:var(--u-f)}
/* overlays above everything that is not the game itself */
#ov:not([hidden])~#toast,body:has(#ov:not([hidden])) #toast,body:has(#ov:not([hidden])) #wid,body:has(#ov:not([hidden])) #party,body:has(#ov:not([hidden])) #u-bdet,body:has(#ov:not([hidden])) #u-stat{visibility:hidden}
@keyframes u-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.u-pc,.u-grp,#u-stat{animation:none!important}#u-bdet{transition:none}body:not(.hc) .btn,body:not(.hc) .card{transition:none}}
`;
  document.body.appendChild(css);
  // the Inter font (cached for offline play by the service worker after the first visit)
  if (!document.querySelector('link[href*="family=Inter"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'; document.head.appendChild(l); }
  // if the title is already on screen when this loads, rebuild it with the new layout
  try { if ($q('#play') && $q('#ov .sheet') && !$q('#ov .sheet').dataset.u86) titleUI(); } catch (e) {}
})();
