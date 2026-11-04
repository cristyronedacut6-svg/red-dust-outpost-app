/*
  Red Dust Outpost · clean icons
  Replaces emoji in the interface with a small set of consistent line icons (or removes them), so the game reads
  like a designed product rather than a chat window. Works on everything: HTML built from strings, live HUD text
  and text drawn on canvases. Runs before the rest of the game.
*/
(() => {
  'use strict';
  const EMO = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*️?|[⬆⬇⬅➡⤴⤵⭐⭕✅❌❓❗➕➖]️?|️/u;
  const EMO_G = new RegExp(EMO.source, 'gu');
  const P = {   // 24×24 stroke icons
    trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
    users: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6.3 6.5-6.3s6.5 2.7 6.5 6.3M17 11a2.6 2.6 0 1 0 0-5.2M17.5 14c2.4.4 4 2.6 4 5.6',
    star: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z',
    spark: 'M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3',
    down: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    up: 'M12 20V9M7 14l5-5 5 5M5 4h14',
    video: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h10A1.5 1.5 0 0 1 16 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 16.5zM16 10.5l5-3v9l-5-3',
    camera: 'M4 8.5h3.2L9 6h6l1.8 2.5H20V19H4zM12 16.5a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z',
    helmet: 'M4 16a8 8 0 0 1 16 0v3H4zM7.5 16a4.5 4 0 0 1 9 0',
    gear: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7',
    map: 'M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20',
    book: 'M3 5h6.5A2.5 2.5 0 0 1 12 7.5V20a2 2 0 0 0-2-2H3zM21 5h-6.5A2.5 2.5 0 0 0 12 7.5V20a2 2 0 0 1 2-2h7z',
    wrench: 'M15.5 3.5a4.5 4.5 0 0 0-5.3 5.9L3.6 16a1.9 1.9 0 0 0 2.7 2.7l6.6-6.6a4.5 4.5 0 0 0 5.9-5.3l-2.6 2.6-2.4-.6-.6-2.4z',
    rocket: 'M12 2.5c3 2 4.7 5.6 4.7 9.5l-1.7 4H9l-1.7-4c0-3.9 1.7-7.5 4.7-9.5zM9 16l-2.5 3.5M15 16l2.5 3.5M12 16v4.5M12 10.3a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z',
    dish: 'M4 20a16 16 0 0 1 16-16M4 14a10 10 0 0 1 10-10M5.5 20.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z',
    sat: 'M9 9l6 6M7 3l4 4-4 4-4-4zM17 13l4 4-4 4-4-4zM13 7l4 4M14.5 5.5l2-2M20 9.5l-1.5 1.5',
    coin: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM14.5 9.3H11a1.6 1.6 0 0 0 0 3.2h2a1.6 1.6 0 0 1 0 3.2H9.5M12 7.5v1.8M12 15.7v1.8',
    ore: 'M4 15l3-7 6-3 6 4 1 7-6 4-7-1zM7 8l4 4 2-7M11 12l1 7M11 12l9 4',
    bolt: 'M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z',
    heart: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
    shield: 'M12 3l7.5 3v6c0 4.6-3.2 7.7-7.5 9-4.3-1.3-7.5-4.4-7.5-9V6z',
    lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    play: 'M8 5.5v13l10-6.5z',
    pause: 'M8.5 5v14M15.5 5v14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    warn: 'M12 3.5l9.5 17h-19zM12 10v5M12 17.8v.4',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z',
    planet: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM6.2 14.7C3.4 16.8 2.2 18.7 2.9 19.6c1.2 1.6 7.4-1 13.8-5.8S22.3 5.9 21.1 4.4c-.7-.9-3 0-5.8 1.9',
    fire: 'M12 21a6 6 0 0 0 6-6c0-4.5-4-6.5-4.5-11-2 2-3 4-3 6.5-1-1-1.6-2-1.8-3.2C6.5 9.2 6 11.5 6 15a6 6 0 0 0 6 6z',
    flask: 'M9.5 3h5M10.5 3v6.2L5.2 18.6A1.6 1.6 0 0 0 6.6 21h10.8a1.6 1.6 0 0 0 1.4-2.4L13.5 9.2V3M7.8 14h8.4',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
    radio: 'M4 9h16v11H4zM8 9l9-5M15.5 16.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 13h4M7 16h4',
    wind: 'M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7',
    compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z',
    person: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
    gamepad: 'M7 8h10a4 4 0 0 1 4 4.5l-.8 4.5a2.3 2.3 0 0 1-4 1L14.5 16h-5l-1.7 2a2.3 2.3 0 0 1-4-1L3 12.5A4 4 0 0 1 7 8zM7.5 11v3M6 12.5h3M16 12h.01M18 13.5h.01',
    car: 'M5 16V12l2-5h10l2 5v4zM3.5 16h17M7.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM16.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 12h14',
    plane: 'M21 15.5l-8-4.5V5a1.5 1.5 0 0 0-3 0v6l-8 4.5v2l8-2.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-4l8 2.5z',
    heli: 'M3 5h18M12 5v3M6.5 13a5.5 4.5 0 0 0 11 0 5.5 4.5 0 0 0-11 0zM12 17.5V20M8 21h8',
    land: 'M3 21h18M6 17.5l13-3M12 3l-1.5 8.5M7.5 6.5l3 4.5',
    swirl: 'M12 12a2 2 0 1 1 2-2 4.5 4.5 0 0 1-4.5 4.5A6.5 6.5 0 0 1 3 8M12 12a2 2 0 1 0-2 2 4.5 4.5 0 0 0 4.5-4.5A6.5 6.5 0 0 0 21 16',
    film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    dot: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  };
  const MAP = {
    '🏆': 'trophy', '🥇': 'trophy', '🥈': 'trophy', '🥉': 'trophy', '🏅': 'trophy', '👥': 'users', '🤝': 'users', '👤': 'person', '🧑‍🚀': 'person', '👩‍🚀': 'person', '👨‍🚀': 'person',
    '✨': 'spark', '⭐': 'star', '🌟': 'star', '★': null, '⬇': 'down', '⬆': 'up', '⤒': 'up', '🎥': 'video', '🎬': 'film', '📼': 'film', '📷': 'camera', '📸': 'camera', '🪖': 'helmet', '⚙': 'gear',
    '🗺': 'map', '📖': 'book', '📚': 'book', '📋': 'book', '🔧': 'wrench', '🛠': 'wrench', '🚀': 'rocket', '📡': 'dish', '🛰': 'sat', '💰': 'coin', '🪙': 'coin', '🪨': 'ore', '💎': 'ore',
    '⚡': 'bolt', '🔋': 'bolt', '🔌': 'bolt', '❤': 'heart', '💜': 'heart', '💙': 'heart', '🛡': 'shield', '🔒': 'lock', '▶': 'play', '⏸': 'pause', '✅': 'check', '✔': 'check', '⚠': 'warn',
    '🌍': 'globe', '🌎': 'globe', '🌏': 'globe', '🪐': 'planet', '🔥': 'fire', '🔬': 'flask', '🧪': 'flask', '⏳': 'clock', '🕒': 'clock', '⏱': 'clock', '📻': 'radio', '💨': 'wind', '🌪': 'wind',
    '🧭': 'compass', '☀': 'sun', '🌙': 'moon', '🌕': 'moon', '🌑': 'moon', '🚩': 'flag', '🎯': 'target', '🎮': 'gamepad', '🚙': 'car', '🤖': 'car', '✈': 'plane', '🚁': 'heli', '🛬': 'land', '🌀': 'swirl', '👁': 'eye', '🔴': 'dot', '🟣': 'dot',
  };
  const norm = e => e.replace(/️/g, '');
  const svg = name => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico' + (name === 'play' ? ' fill' : '')); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', P[name]); s.appendChild(p); return s; };
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'svg', 'path']);
  function fixText(t) {
    const v = t.nodeValue; if (!v || !EMO.test(v)) return; const par = t.parentNode; if (!par || SKIP.has(par.nodeName)) return;
    // inside an option/select or title: plain removal
    if (par.nodeName === 'OPTION' || par.nodeName === 'TITLE') { t.nodeValue = v.replace(EMO_G, '').replace(/\s{2,}/g, ' ').trim(); return; }
    const frag = document.createDocumentFragment(); let last = 0, m; EMO_G.lastIndex = 0;
    while ((m = EMO_G.exec(v))) { let before = v.slice(last, m.index); const name = MAP[norm(m[0])] || MAP[m[0]];
      if (name) { frag.appendChild(document.createTextNode(before)); frag.appendChild(svg(name)); }
      else frag.appendChild(document.createTextNode(before));
      last = m.index + m[0].length; if (!name && v[last] === ' ' && (m.index === 0 || /\s/.test(v[m.index - 1]))) last++; }   // drop the space that followed a removed emoji
    frag.appendChild(document.createTextNode(v.slice(last)));
    par.replaceChild(frag, t);
    // an icon-only button that lost its only emoji: give it a neutral dot so it stays tappable
    if (!par.textContent.trim()) { if (!par.querySelector('svg') && /^(BUTTON|A|SPAN|I|B|DIV)$/.test(par.nodeName)) par.appendChild(svg('dot')); par.querySelectorAll('svg.ico').forEach(x => x.classList.add('solo')); }
  }
  function walk(root) { if (root.nodeType === 3) return fixText(root); if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = []; let n; while ((n = tw.nextNode())) if (EMO.test(n.nodeValue)) list.push(n); list.forEach(fixText);
    if (root.getAttribute && root.getAttribute('title') && EMO.test(root.getAttribute('title'))) root.setAttribute('title', root.getAttribute('title').replace(EMO_G, '').trim()); }
  const mo = new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') fixText(m.target); else m.addedNodes.forEach(walk); } });
  const start = () => { walk(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  // canvas text: icons can't be drawn there, so emoji are simply left out
  const C2 = CanvasRenderingContext2D.prototype, clean = s => typeof s === 'string' && EMO.test(s) ? s.replace(EMO_G, '').replace(/^\s+/, '').replace(/\s{2,}/g, ' ') : s;
  for (const k of ['fillText', 'strokeText', 'measureText']) { const f = C2[k]; C2[k] = function (t, ...a) { return f.call(this, clean(t), ...a); }; }
  if (window.OffscreenCanvasRenderingContext2D) { const O = OffscreenCanvasRenderingContext2D.prototype; for (const k of ['fillText', 'strokeText', 'measureText']) { const f = O[k]; O[k] = function (t, ...a) { return f.call(this, clean(t), ...a); }; } }
  // speech and document title stay emoji-free too
  window.NOEMOJI = { clean: s => String(s).replace(EMO_G, '').replace(/\s{2,}/g, ' ').trim(), icon: svg };
  const css = document.createElement('style'); css.textContent = 'svg.ico{width:1.05em;height:1.05em;vertical-align:-.17em;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-right:.32em;flex:none}svg.ico.fill{fill:currentColor;stroke:none}svg.ico.solo{margin-right:0;width:1.25em;height:1.25em}';
  (document.head || document.documentElement).appendChild(css);
})();
