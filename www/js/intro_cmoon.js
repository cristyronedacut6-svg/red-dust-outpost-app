/* C-MOON studio intro (about 10.5 s), shown first on every launch, before the game's own title.
   Everything is drawn on one full-screen 2D canvas and every sound is synthesized with the Web Audio API (no files to load).
   0-2.5 s   silence breaks into a sub-bass drone and a slow heartbeat, faint stars, slow push-in
   2.5-5.5 s a huge dark moon drifts in, a sunlight rim crawls round its edge into a crescent "C", riser builds
   5.6 s     impact: braaam + boom, white flash, shockwave ring, camera shake, "C-MOON" slams in (the crescent is the C)
   6-10.5 s  "STUDIOS", embers, metallic sheen, reverb tail, fade to black, then the game
   Tap / click / any key after the first second skips (0.4 s fade). prefers-reduced-motion: no shake, no flash, no slam.
   window.CMOON_INTRO.play() replays it (for recording). ?nointro skips it. The hook in index.html (window.__cmoonDone /
   window.__cmoonHold) lets the game's title wait for it, with a timeout so the game always starts even if this file fails. */
(function () {
  'use strict';
  var TAU = Math.PI * 2, PI = Math.PI;
  var T_IMPACT = 5.6, T_FADE0 = 8.9, T_FADE1 = 10.2, T_END = 10.45;
  var FONT = '"Chakra Petch","Arial Black","Segoe UI",sans-serif';
  var Q = location.search || '';

  function signalDone() { window.CMOON_DONE = true; try { if (window.__cmoonDone) window.__cmoonDone(); } catch (e) {} }
  function hold(ms) { try { if (window.__cmoonHold) window.__cmoonHold(ms); } catch (e) {} }
  function tr(k) { try { if (window.I18N && I18N.t) return I18N.t(k); } catch (e) {} return k; }

  var cl = function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; };
  var sm = function (a, b, x) { x = cl((x - a) / (b - a)); return x * x * (3 - 2 * x); };
  var eo3 = function (x) { x = cl(x); return 1 - Math.pow(1 - x, 3); };
  var eio = function (x) { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------- audio ---------------- */
  function noiseBuf(ac, sec, brown) {
    var n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0), last = 0, r = rng(99);
    for (var i = 0; i < n; i++) { var w = r() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return b;
  }
  function impulse(ac, sec, decay) {
    var n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate), r = rng(5);
    for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch); for (var i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function shaper(k) { var n = 2048, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }

  function buildAudio(ac) {
    // the buffers take a few ms to fill, so they are made before the start time is taken (keeps sound and picture in sync)
    var IR = impulse(ac, 4.5, 2.4), WN = noiseBuf(ac, 2, false), BN = noiseBuf(ac, 4, true);
    var t0 = ac.currentTime + 0.06, E = 0.0001;
    var out = ac.createGain(); out.gain.setValueAtTime(0.85, t0);
    var comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.3;
    out.connect(comp); comp.connect(ac.destination);
    var rev = ac.createConvolver(); rev.buffer = IR;
    var revG = ac.createGain(); revG.gain.value = 0.6; rev.connect(revG); revG.connect(out);
    var dl = ac.createDelay(1.5); dl.delayTime.value = 0.37;
    var fb = ac.createGain(); fb.gain.value = 0.4;
    var dlf = ac.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2400;
    dl.connect(dlf); dlf.connect(fb); fb.connect(dl);
    var dlOut = ac.createGain(); dlOut.gain.value = 0.35; dlf.connect(dlOut); dlOut.connect(out); dlOut.connect(rev);
    function send(node, dry, wet, echo) {
      if (dry) { var g1 = ac.createGain(); g1.gain.value = dry; node.connect(g1); g1.connect(out); }
      if (wet) { var g2 = ac.createGain(); g2.gain.value = wet; node.connect(g2); g2.connect(rev); }
      if (echo) { var g3 = ac.createGain(); g3.gain.value = echo; node.connect(g3); g3.connect(dl); }
    }
    function osc(type, f, a, b) { var o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, a); o.start(a); o.stop(b); return o; }
    function noise(buf, a, b) { var s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(a); s.stop(b); return s; }
    var TI = t0 + T_IMPACT;

    // drone: detuned saws through a slowly opening resonant low-pass, plus a pure sub
    var dF = ac.createBiquadFilter(); dF.type = 'lowpass'; dF.Q.value = 5;
    dF.frequency.setValueAtTime(80, t0); dF.frequency.exponentialRampToValueAtTime(560, t0 + 5.4);
    var lfo = osc('sine', 0.23, t0, TI); var lfoG = ac.createGain(); lfoG.gain.value = 30; lfo.connect(lfoG); lfoG.connect(dF.frequency);
    var dG = ac.createGain();
    dG.gain.setValueAtTime(E, t0); dG.gain.exponentialRampToValueAtTime(0.3, t0 + 2.6); dG.gain.linearRampToValueAtTime(0.42, t0 + 5.38); dG.gain.exponentialRampToValueAtTime(E, t0 + 5.5);
    [[36.71, 'sawtooth'], [36.93, 'sawtooth'], [55.0, 'sawtooth'], [73.42, 'triangle']].forEach(function (p) { osc(p[1], p[0], t0, TI).connect(dF); });
    dF.connect(dG); send(dG, 1, 0.25, 0);
    var sub = osc('sine', 36.71, t0, TI), subG = ac.createGain();
    subG.gain.setValueAtTime(E, t0); subG.gain.exponentialRampToValueAtTime(0.45, t0 + 3); subG.gain.linearRampToValueAtTime(0.5, t0 + 5.38); subG.gain.exponentialRampToValueAtTime(E, t0 + 5.5);
    sub.connect(subG); subG.connect(out);
    // rumble: brown noise band
    var rb = noise(BN, t0, TI), rbF = ac.createBiquadFilter(), rbG = ac.createGain();
    rbF.type = 'bandpass'; rbF.frequency.value = 150; rbF.Q.value = 0.8;
    rbG.gain.setValueAtTime(E, t0); rbG.gain.exponentialRampToValueAtTime(0.35, t0 + 4.5); rbG.gain.linearRampToValueAtTime(0.5, t0 + 5.38); rbG.gain.exponentialRampToValueAtTime(E, t0 + 5.5);
    rb.connect(rbF); rbF.connect(rbG); send(rbG, 1, 0.3, 0);

    // heartbeat (lub-dub, speeding up); the octave partial keeps it audible on phone speakers
    function beat(t, v) {
      [[68, 38, 'sine', 1], [136, 76, 'triangle', 0.35]].forEach(function (p) {
        var o = osc(p[2], p[0], t, t + 0.4), g = ac.createGain();
        o.frequency.exponentialRampToValueAtTime(p[1], t + 0.18);
        g.gain.setValueAtTime(E, t); g.gain.exponentialRampToValueAtTime(v * p[3], t + 0.008); g.gain.exponentialRampToValueAtTime(E, t + 0.32);
        o.connect(g); send(g, 1, 0.15, 0);
      });
    }
    [[0.55, 0.85], [1.8, 2.08], [2.9, 3.16], [3.9, 4.13], [4.65, 4.85], [5.12, 5.3]].forEach(function (p, i) { var v = 0.55 + i * 0.07; beat(t0 + p[0], v); beat(t0 + p[1], v * 0.62); });

    // riser: sweeping noise + gliding saws, cut to silence 0.1 s before the hit
    var rn = noise(WN, t0 + 2.5, t0 + 5.55), rnF = ac.createBiquadFilter(), rnG = ac.createGain();
    rnF.type = 'bandpass'; rnF.Q.value = 3; rnF.frequency.setValueAtTime(380, t0 + 2.5); rnF.frequency.exponentialRampToValueAtTime(7500, t0 + 5.45);
    rnG.gain.setValueAtTime(E, t0 + 2.5); rnG.gain.exponentialRampToValueAtTime(0.26, t0 + 5.44); rnG.gain.exponentialRampToValueAtTime(E, t0 + 5.5);
    rn.connect(rnF); rnF.connect(rnG); send(rnG, 1, 0.5, 0.15);
    var tF = ac.createBiquadFilter(), tG = ac.createGain(); tF.type = 'lowpass'; tF.frequency.value = 3200;
    tG.gain.setValueAtTime(E, t0 + 2.5); tG.gain.exponentialRampToValueAtTime(0.07, t0 + 5.44); tG.gain.exponentialRampToValueAtTime(E, t0 + 5.5);
    [110, 164.8, 111.2].forEach(function (f) { var o = osc('sawtooth', f, t0 + 2.5, t0 + 5.55); o.frequency.exponentialRampToValueAtTime(f * 8, t0 + 5.45); o.connect(tF); });
    tF.connect(tG); send(tG, 1, 0.6, 0.2);

    // impact: distorted braaam, sub boom, noise crack
    var ws = ac.createWaveShaper(); ws.curve = shaper(30); ws.oversample = '2x';
    var bF = ac.createBiquadFilter(), bG = ac.createGain(); bF.type = 'lowpass'; bF.Q.value = 2;
    bF.frequency.setValueAtTime(3400, TI); bF.frequency.exponentialRampToValueAtTime(230, TI + 3.6);
    bG.gain.setValueAtTime(E, TI); bG.gain.exponentialRampToValueAtTime(0.32, TI + 0.02); bG.gain.exponentialRampToValueAtTime(0.18, TI + 0.8); bG.gain.exponentialRampToValueAtTime(E, TI + 4.4);
    [36.71, 73.42, 73.7, 110, 146.83, 147.4, 220].forEach(function (f) { var o = osc('sawtooth', f * 1.03, TI, TI + 4.5); o.frequency.exponentialRampToValueAtTime(f, TI + 0.3); o.connect(ws); });
    ws.connect(bF); bF.connect(bG); send(bG, 1, 0.75, 0.25);
    var bm = osc('sine', 95, TI, TI + 2.6), bmG = ac.createGain();
    bm.frequency.exponentialRampToValueAtTime(27, TI + 1.3);
    bmG.gain.setValueAtTime(E, TI); bmG.gain.exponentialRampToValueAtTime(1, TI + 0.006); bmG.gain.exponentialRampToValueAtTime(E, TI + 2.5);
    bm.connect(bmG); bmG.connect(out);
    var th = osc('triangle', 170, TI, TI + 0.5), thG = ac.createGain();
    th.frequency.exponentialRampToValueAtTime(55, TI + 0.16);
    thG.gain.setValueAtTime(E, TI); thG.gain.exponentialRampToValueAtTime(0.6, TI + 0.004); thG.gain.exponentialRampToValueAtTime(E, TI + 0.45);
    th.connect(thG); send(thG, 1, 0.4, 0);
    var cr = noise(WN, TI, TI + 0.8), crF = ac.createBiquadFilter(), crG = ac.createGain();
    crF.type = 'highpass'; crF.frequency.value = 650;
    crG.gain.setValueAtTime(E, TI); crG.gain.exponentialRampToValueAtTime(0.8, TI + 0.004); crG.gain.exponentialRampToValueAtTime(E, TI + 0.5);
    cr.connect(crF); crF.connect(crG); send(crG, 0.8, 1, 0);

    // metallic shimmer: inharmonic bell partials into reverb and echo
    var pan = function (node, p) { if (!ac.createStereoPanner) return node; var s = ac.createStereoPanner(); s.pan.value = p; node.connect(s); return s; };
    function bell(t, f, v, p) {
      [[1, 0.5, 4.5], [2.0, 0.2, 3], [2.76, 0.25, 2.4], [5.4, 0.12, 1.6], [8.93, 0.06, 1]].forEach(function (q) {
        var o = osc('sine', f * q[0], t, t + q[2] + 0.1), g = ac.createGain();
        g.gain.setValueAtTime(E, t); g.gain.exponentialRampToValueAtTime(v * q[1], t + 0.01); g.gain.exponentialRampToValueAtTime(E, t + q[2]);
        o.connect(g); send(pan(g, p), 0.3, 0.8, 0.5);
      });
    }
    bell(TI + 0.05, 587.33, 0.22, -0.3); bell(TI + 0.5, 880, 0.14, 0.35); bell(t0 + 7.3, 1174.7, 0.07, 0);
    // sheen "shing" synced with the light sweep over the title
    var sh = noise(WN, t0 + 6.0, t0 + 7.4), shF = ac.createBiquadFilter(), shG = ac.createGain();
    shF.type = 'bandpass'; shF.Q.value = 9; shF.frequency.setValueAtTime(4500, t0 + 6.0); shF.frequency.exponentialRampToValueAtTime(9500, t0 + 7.1);
    shG.gain.setValueAtTime(E, t0 + 6.0); shG.gain.exponentialRampToValueAtTime(0.16, t0 + 6.45); shG.gain.exponentialRampToValueAtTime(E, t0 + 7.3);
    sh.connect(shF); shF.connect(shG); send(shG, 0.5, 0.8, 0.3);
    // low pad under the tagline
    var pG = ac.createGain(), pF = ac.createBiquadFilter(); pF.type = 'lowpass'; pF.frequency.value = 900;
    pG.gain.setValueAtTime(E, TI + 0.3); pG.gain.exponentialRampToValueAtTime(0.09, t0 + 7.2); pG.gain.exponentialRampToValueAtTime(E, t0 + 10.3);
    [73.42, 110, 146.83, 220.5].forEach(function (f) { osc('triangle', f, TI + 0.3, t0 + 10.4).connect(pF); });
    pF.connect(pG); send(pG, 1, 0.5, 0);
    // master fade with the picture
    out.gain.setValueAtTime(0.85, t0 + T_FADE0); out.gain.linearRampToValueAtTime(E, t0 + T_FADE1 + 0.1);
    return {
      fade: function (sec) { try { var n = ac.currentTime; out.gain.cancelScheduledValues(n); out.gain.setValueAtTime(out.gain.value, n); out.gain.linearRampToValueAtTime(0, n + sec); } catch (e) {} }
    };
  }

  /* ---------------- picture ---------------- */
  function makeMoonTex(S) {
    var c = mk(S, S), g = c.getContext('2d'), r = S / 2, R = rng(7), i;
    g.save(); g.beginPath(); g.arc(r, r, r, 0, TAU); g.clip();
    var bg = g.createRadialGradient(r * 0.8, r * 0.8, r * 0.1, r, r, r); bg.addColorStop(0, '#9c9ca2'); bg.addColorStop(1, '#6a6a72');
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    for (i = 0; i < 10; i++) {
      var mx = r + (R() - 0.5) * r * 1.4, my = r + (R() - 0.5) * r * 1.4, mr = r * (0.15 + R() * 0.32), mg = g.createRadialGradient(mx, my, 0, mx, my, mr);
      mg.addColorStop(0, 'rgba(38,38,46,0.42)'); mg.addColorStop(0.7, 'rgba(38,38,46,0.25)'); mg.addColorStop(1, 'rgba(38,38,46,0)');
      g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
    }
    for (i = 0; i < 170; i++) {
      var cr = Math.min(r * 0.13, r * 0.008 * Math.pow(1 / (R() + 0.03), 0.85)), a = R() * TAU, d = Math.sqrt(R()) * (r - cr * 1.2), cx = r + Math.cos(a) * d, cy = r + Math.sin(a) * d;
      var fl = g.createRadialGradient(cx - cr * 0.25, cy, 0, cx, cy, cr);
      fl.addColorStop(0, 'rgba(28,28,34,0.5)'); fl.addColorStop(0.75, 'rgba(28,28,34,0.3)'); fl.addColorStop(1, 'rgba(28,28,34,0)');
      g.fillStyle = fl; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(215,215,222,0.28)'; g.lineWidth = Math.max(0.6, cr * 0.18);
      g.beginPath(); g.arc(cx, cy, cr * 0.92, -PI / 2, PI / 2); g.stroke();
    }
    try {
      var id = g.getImageData(0, 0, S, S), px = id.data;
      for (i = 0; i < px.length; i += 4) { if (px[i + 3]) { var n = (R() - 0.5) * 26; px[i] += n; px[i + 1] += n; px[i + 2] += n; } }
      g.putImageData(id, 0, 0);
    } catch (e) {}
    var lg = g.createRadialGradient(r, r, r * 0.55, r, r, r); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = lg; g.fillRect(0, 0, S, S);
    g.restore();
    return c;
  }
  function makeSprite(n, stops) { var c = mk(n, n), g = c.getContext('2d'), h = n / 2, gr = g.createRadialGradient(h, h, 0, h, h, h); stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); g.fillStyle = gr; g.fillRect(0, 0, n, n); return c; }
  function makeGrain(n, seed) {
    var c = mk(n, n), g = c.getContext('2d'), id = g.createImageData(n, n), d = id.data, R = rng(seed);
    for (var i = 0; i < d.length; i += 4) { var v = R() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(id, 0, 0); return c;
  }

  var running = null;
  function play(first) {
    if (running) return running;
    var resolve, p = new Promise(function (r) { resolve = r; });
    running = p;
    var fin = function () { running = null; if (first) signalDone(); resolve(); };
    try { run(fin); } catch (e) { try { console.warn('C-MOON intro failed', e); } catch (_) {} var el = document.getElementById('cmoonI'); if (el) el.remove(); fin(); }
    return p;
  }

  function run(fin) {
    var reduce = false; try { reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    var old = document.getElementById('cmoonI'); if (old) old.remove();
    var root = document.createElement('div'); root.id = 'cmoonI';
    root.setAttribute('aria-label', 'C-MOON Studios');
    root.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;background:#000;margin:0;padding:0;overflow:hidden;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none';
    var cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block';
    root.appendChild(cv);
    (document.body || document.documentElement).appendChild(root);
    var ctx = cv.getContext('2d');

    var state = 'wait', ended = false, raf = 0, startMs = 0, skipAt = -1, ac = null, snd = null, promptEl = null;
    var W = 0, H = 0, dpr = 1, R = 0, phone = false, T = null, titleDirty = false;
    var tex = null, litTex = null, L = 0, sU = 0, litC = null, b1 = null, b2 = null, cR = null, cB = null, litKey = '';
    var dot = makeSprite(64, [[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    var ember = makeSprite(64, [[0, 'rgba(255,248,225,1)'], [0.25, 'rgba(255,180,90,0.55)'], [1, 'rgba(255,120,40,0)']]);
    var grains = [makeGrain(128, 11), makeGrain(128, 23), makeGrain(128, 37)], grainPat = [];
    var stars = [], motes = [], embers = [], vign = null, sR = rng(42);

    function layout() {
      W = Math.max(1, root.clientWidth || innerWidth); H = Math.max(1, root.clientHeight || innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2); dpr = Math.min(dpr, Math.sqrt(4.2e6 / (W * H))); dpr = Math.max(dpr, 0.5);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      phone = Math.min(W, H) < 600;
      R = Math.min(W, H) * (W < H ? 0.4 : 0.36);
      if (!tex) { var S = Math.min(1024, Math.ceil(2 * R * dpr)); tex = makeMoonTex(Math.max(256, S)); litTex = mk(tex.width, tex.height); var lg = litTex.getContext('2d'); lg.drawImage(tex, 0, 0); lg.globalCompositeOperation = 'source-atop'; lg.fillStyle = 'rgba(255,238,214,0.6)'; lg.fillRect(0, 0, tex.width, tex.height); }
      L = Math.min(1024, Math.ceil(2 * R * 1.3 * dpr)); sU = L / 2.6;
      litC = mk(L, L); b1 = mk(L / 4, L / 4); b2 = mk(L / 12, L / 12); cR = mk(L / 2, L / 2); cB = mk(L / 2, L / 2); litKey = '';
      vign = mk(Math.ceil(W / 4), Math.ceil(H / 4));
      var vg = vign.getContext('2d'), vw = vign.width, vh = vign.height, gr = vg.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.25, vw / 2, vh / 2, Math.hypot(vw, vh) / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.78)'); vg.fillStyle = gr; vg.fillRect(0, 0, vw, vh);
      grainPat = grains.map(function (g) { return ctx.createPattern(g, 'repeat'); });
      buildTitle();
    }

    function buildTitle() {
      var m = mk(4, 4).getContext('2d'); m.font = '700 100px ' + FONT;
      var ws = ['M', 'O', 'O', 'N'].map(function (ch) { return m.measureText(ch).width; });
      var mm = m.measureText('M'), capU = (mm.actualBoundingBoxAscent > 20 ? mm.actualBoundingBoxAscent : 72) / 100;
      var rU = 0.4, g1 = 0.14, bw = 0.3, g2 = 0.14, trk = 0.12;
      var lettersU = (ws[0] + ws[1] + ws[2] + ws[3]) / 100 + trk * 3, totalU = 2 * rU + g1 + bw + g2 + lettersU;
      var F = Math.min(W * (phone ? 0.86 : 0.8) / totalU, H * 0.2, 340);
      var cap = capU * F, cx = W / 2, cy = H * 0.47, x0 = cx - totalU * F / 2;
      var t = { F: F, cap: cap, cx: cx, cy: cy, r: rU * F, Cx: x0 + rU * F, Cy: cy, w: totalU * F };
      var tx = x0 + (2 * rU + g1) * F, txtW = (bw + g2 + lettersU) * F, pad = 0.3 * F;
      t.lx = tx - pad; t.ly = cy - cap / 2 - pad; t.lw = txtW + 2 * pad; t.lh = cap + 2 * pad;
      var c = mk(t.lw * dpr, t.lh * dpr), g = c.getContext('2d'); g.scale(dpr, dpr);
      var base = pad + cap, top = pad;
      var mg = g.createLinearGradient(0, top, 0, base);
      mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.32, '#d2dae8'); mg.addColorStop(0.49, '#6b7790'); mg.addColorStop(0.53, '#eef3fb'); mg.addColorStop(0.78, '#9ba7bd'); mg.addColorStop(1, '#4b5469');
      g.font = '700 ' + F + 'px ' + FONT; g.textBaseline = 'alphabetic';
      function letters() {
        g.fillRect(pad, top + cap / 2 - 0.045 * F, bw * F, 0.09 * F);
        var x = pad + (bw + g2) * F; ['M', 'O', 'O', 'N'].forEach(function (ch, i) { g.fillText(ch, x, base); x += ws[i] / 100 * F + trk * F; });
      }
      g.shadowColor = 'rgba(110,160,255,0.6)'; g.shadowBlur = 0.12 * F * dpr; g.fillStyle = mg; letters();
      g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0)';
      g.globalCompositeOperation = 'source-atop'; var hl = g.createLinearGradient(0, top, 0, top + cap * 0.12); hl.addColorStop(0, 'rgba(255,255,255,0.7)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = hl; g.fillRect(0, top, t.lw, cap * 0.12);
      t.c = c; t.sh = mk(c.width, c.height);
      T = t;
    }

    function ensureLit(a, k) {
      var key = a.toFixed(3) + '|' + k.toFixed(3); if (key === litKey) return; litKey = key;
      var g = litC.getContext('2d'), c = L / 2, s = sU;
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, L, L);
      g.drawImage(litTex, c - s, c - s, 2 * s, 2 * s);
      g.strokeStyle = 'rgba(255,250,240,0.95)'; g.lineWidth = Math.max(1, s * 0.018); g.beginPath(); g.arc(c, c, s * 0.992, 0, TAU); g.stroke();
      // soft terminator: an offset disk, a little smaller than the moon, removes the night side
      var ox = c + k * s, r2 = s * 0.985, og = g.createRadialGradient(ox, c, r2 * 0.93, ox, c, r2);
      og.addColorStop(0, 'rgba(0,0,0,1)'); og.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = og; g.fillRect(0, 0, L, L);
      if (a < PI - 0.001) { g.globalCompositeOperation = 'destination-in'; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(c, c); g.arc(c, c, s * 1.3, PI - a, PI + a); g.closePath(); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      var x1 = b1.getContext('2d'); x1.clearRect(0, 0, b1.width, b1.height); x1.drawImage(litC, 0, 0, b1.width, b1.height);
      var x2 = b2.getContext('2d'); x2.clearRect(0, 0, b2.width, b2.height); x2.drawImage(b1, 0, 0, b2.width, b2.height);
      [[cR, '#ff3a22'], [cB, '#2a70ff']].forEach(function (q) {
        var x = q[0].getContext('2d'); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, q[0].width, q[0].height);
        x.drawImage(litC, 0, 0, q[0].width, q[0].height); x.globalCompositeOperation = 'source-in'; x.fillStyle = q[1]; x.fillRect(0, 0, q[0].width, q[0].height);
      });
    }

    function streak(x, y, len, al) {
      if (al <= 0.003) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y);
      [[0.014, 'rgba(120,170,255,', 1], [0.004, 'rgba(235,245,255,', 0.6]].forEach(function (q) {
        ctx.save(); ctx.scale(1, q[0]); var l = len * q[2], gr = ctx.createRadialGradient(0, 0, 0, 0, 0, l);
        gr.addColorStop(0, q[1] + al + ')'); gr.addColorStop(0.3, q[1] + (al * 0.4) + ')'); gr.addColorStop(1, q[1] + '0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, l, 0, TAU); ctx.fill(); ctx.restore();
      });
      ctx.restore();
    }

    function drawMoon(mx, my, r, b, a, k, al, caB) {
      if (al <= 0.003) return;
      ensureLit(a, k);
      var D = L * (r / sU), x0 = mx - D / 2, y0 = my - D / 2;
      ctx.globalCompositeOperation = 'lighter';
      var hg = ctx.createRadialGradient(mx - r * 0.5, my, r * 0.4, mx, my, r * 1.75);
      hg.addColorStop(0, 'rgba(70,110,200,' + (0.2 * b * al) + ')'); hg.addColorStop(1, 'rgba(70,110,200,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = hg; ctx.fillRect(mx - r * 1.8, my - r * 1.8, r * 3.6, r * 3.6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = al; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(mx, my, r * 0.996, 0, TAU); ctx.fill();
      ctx.globalAlpha = al * 0.075; ctx.drawImage(tex, mx - r, my - r, 2 * r, 2 * r);
      ctx.globalAlpha = al * 0.18; ctx.strokeStyle = 'rgba(90,120,180,1)'; ctx.lineWidth = Math.max(1, r * 0.008); ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.stroke();
      if (b > 0.002) {
        ctx.globalCompositeOperation = 'lighter';
        var bb = Math.min(1, b);
        ctx.globalAlpha = al * bb; ctx.drawImage(litC, x0, y0, D, D);
        var ca = (1.2 + 4 * bb + (caB || 0)) * (r / R + 0.4);
        ctx.globalAlpha = al * bb * 0.5; ctx.drawImage(cR, x0 - ca, y0, D, D); ctx.drawImage(cB, x0 + ca, y0, D, D);
        ctx.globalAlpha = al * Math.min(1, b * 0.75); ctx.drawImage(b1, x0, y0, D, D);
        ctx.globalAlpha = al * Math.min(1, b * 1.1); ctx.drawImage(b2, x0, y0, D, D);
        if (b > 1) { ctx.globalAlpha = al * Math.min(1, b - 1); ctx.drawImage(b1, x0, y0, D, D); ctx.drawImage(litC, x0, y0, D, D); }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    function spawnEmbers(Cx, Cy, tw) {
      var n = reduce ? 30 : phone ? 60 : 100;
      for (var i = 0; i < n; i++) {
        var burst = !reduce && i < n * 0.45, a = sR() * TAU, sp = burst ? 220 + sR() * 520 : 0;
        embers.push({ x: burst ? Cx : Cx + (sR() - 0.15) * tw, y: Cy + (sR() - 0.5) * T.cap * 1.4, vx: Math.cos(a) * sp + (sR() - 0.5) * 30, vy: Math.sin(a) * sp - (15 + sR() * 45), age: -sR() * (burst ? 0.05 : 1.4), life: 2.4 + sR() * 2, s: 1.2 + sR() * 2.4, ph: sR() * TAU, burst: burst });
      }
    }

    function init() {
      var ns = phone ? 150 : 240, nm = phone ? 34 : 56, i;
      for (i = 0; i < ns; i++) stars.push({ x: (sR() - 0.5) * 2.3, y: (sR() - 0.5) * 2.3, z: 0.3 + sR() * 0.7, s: 0.5 + Math.pow(sR(), 3) * 1.8, b: 0.25 + sR() * 0.75, tw: 1 + sR() * 3, ph: sR() * TAU });
      for (i = 0; i < nm; i++) motes.push({ x: sR(), y: sR(), vx: (sR() - 0.5) * 0.012, vy: (sR() - 0.5) * 0.008, s: 0.8 + sR() * 2, a: 0.04 + sR() * 0.12, ph: sR() * TAU });
      layout();
    }

    var lastT = 0, embersOn = false;
    function frame(now) {
      raf = 0; if (ended) return;
      if (!root.isConnected) { cleanup(); return; }
      try { draw(now); } catch (e) { try { console.warn('C-MOON intro frame', e); } catch (_) {} cleanup(); return; }
      if (!ended) raf = requestAnimationFrame(frame);
    }

    function draw(now) {
      var t = Math.max(0, (now - startMs) / 1000), dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
      if (skipAt >= 0 && t - skipAt >= 0.42) { cleanup(); return; }
      if (t >= T_END) { cleanup(); return; }
      if (titleDirty) { titleDirty = false; buildTitle(); }
      var after = t >= T_IMPACT, ti = t - T_IMPACT;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

      // camera: slow push-in, shake after the hit (tiny rumble just before it)
      var Z = reduce ? 1 : 1 + 0.05 * eio(Math.min(t, T_IMPACT) / T_IMPACT) + (after ? 0.02 * cl(ti / 4) : 0), sx = 0, sy = 0;
      if (!reduce) {
        var amp = after ? Math.min(W, H) * 0.024 * Math.exp(-ti * 4.5) : Math.min(W, H) * 0.0025 * sm(4.6, 5.5, t);
        sx = amp * (Math.sin(t * 91) + 0.5 * Math.sin(t * 57.3)); sy = amp * (0.8 * Math.cos(t * 83.1) + 0.4 * Math.sin(t * 41.7));
      }
      ctx.save(); ctx.translate(W / 2 + sx, H / 2 + sy); ctx.scale(Z, Z); ctx.translate(-W / 2, -H / 2);

      // stars
      var sf = sm(0.3, 2.4, t) * (after ? 0.75 : 1), i;
      if (sf > 0) {
        ctx.fillStyle = '#fff';
        for (i = 0; i < stars.length; i++) {
          var st = stars[i], par = reduce ? 1 : 1 + 0.06 * t / st.z, x = W / 2 + st.x * W / 2 * par, y = H / 2 + st.y * H / 2 * par;
          if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
          var al = sf * st.b * (0.7 + 0.3 * Math.sin(t * st.tw + st.ph));
          if (st.s > 1.4) { ctx.globalAlpha = al * 0.6; ctx.drawImage(dot, x - st.s * 2.5, y - st.s * 2.5, st.s * 5, st.s * 5); }
          ctx.globalAlpha = al; ctx.fillRect(x - st.s / 2, y - st.s / 2, st.s, st.s);
        }
        ctx.globalAlpha = 1;
      }

      // the big moon (before the hit; with reduced motion it cross-fades out instead of cutting)
      var bigA = after ? (reduce ? 1 - cl(ti / 0.5) : 0) : 1, lp = null, b = 0;
      if (bigA > 0) {
        var u = eo3((t - 1.4) / 4.2), mx = W / 2 + R * (0.6 - 0.45 * u), my = H / 2 + R * 1.35 * (1 - u);
        var a = PI * eio((t - 2.55) / 2.85), k = 0.035 + 0.105 * eio((t - 2.6) / 2.9);
        b = t < 2.5 ? 0 : 0.1 + 0.9 * Math.pow(cl((t - 2.5) / 3), 1.6);
        b *= 1 + 0.9 * sm(5.35, 5.6, Math.min(t, T_IMPACT));
        drawMoon(mx, my, R, b, a, k, bigA, 5 * sm(5.3, 5.6, t));
        lp = { x: mx - R * 0.985, y: my };
        if (a > 0.02 && a < PI - 0.05) {
          ctx.globalCompositeOperation = 'lighter';
          [PI - a, PI + a].forEach(function (an) { var gx = mx + Math.cos(an) * R * 0.985, gy = my + Math.sin(an) * R * 0.985, gs = R * 0.24; ctx.globalAlpha = bigA * Math.min(1, 0.4 + b) * Math.sqrt(1 - a / PI); ctx.drawImage(dot, gx - gs / 2, gy - gs / 2, gs, gs); });
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        streak(lp.x, lp.y, W * (0.35 + 0.5 * Math.min(1, b)), bigA * Math.min(1, b * b * 0.55 + sm(5.3, 5.6, t) * 0.5));
        if (b > 0.05) { var fs = R * (0.25 + 0.35 * Math.min(1.5, b)); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = bigA * Math.min(1, b * 0.8); ctx.drawImage(dot, lp.x - fs / 2, lp.y - fs / 2, fs, fs); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      }

      // dust motes, lit when they pass near the sunlit rim
      var mf = sm(0.5, 2.5, t);
      if (mf > 0) {
        ctx.globalCompositeOperation = 'lighter';
        var lx = lp ? lp.x : T.Cx - T.r, ly = lp ? lp.y : T.Cy, lr = lp ? R * 1.7 : T.r * 4, lb = lp ? Math.min(1, b) : 0.6;
        for (i = 0; i < motes.length; i++) {
          var m = motes[i]; m.x += (m.vx + Math.sin(t * 0.7 + m.ph) * 0.003) * dt; m.y += (m.vy + Math.cos(t * 0.5 + m.ph) * 0.002) * dt;
          if (m.x < -0.05) m.x += 1.1; else if (m.x > 1.05) m.x -= 1.1; if (m.y < -0.05) m.y += 1.1; else if (m.y > 1.05) m.y -= 1.1;
          var px = m.x * W, py = m.y * H, dd = Math.hypot(px - lx, py - ly), boost = lb * Math.max(0, 1 - dd / lr) * 0.6, ss = m.s * 3;
          ctx.globalAlpha = mf * Math.min(1, m.a + boost); ctx.drawImage(dot, px - ss / 2, py - ss / 2, ss, ss);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();

      // title group: the small crescent is the C of C-MOON
      if (after && T) {
        var tA = reduce ? cl(ti / 0.6) : cl(ti * 6), p = cl(ti / 0.3), s = reduce ? 1 : 1 + 0.55 * Math.pow(1 - p, 3) - 0.018 * Math.sin(cl((ti - 0.3) / 0.35) * PI);
        s *= reduce ? 1 : 1 + 0.025 * cl(ti / 4.5);
        var pulse = 1 + 0.6 * Math.exp(-Math.pow((t - 6.05) / 0.16, 2)) + 0.8 * Math.exp(-ti * 6);
        ctx.save(); ctx.translate(T.cx + sx * 0.5, T.cy + sy * 0.5); ctx.scale(s, s); ctx.translate(-T.cx, -T.cy);
        drawMoon(T.Cx, T.Cy, T.r, pulse, PI, 0.36, tA, 3 * Math.exp(-ti * 3));
        ctx.globalAlpha = tA; ctx.drawImage(T.c, T.lx, T.ly, T.lw, T.lh);
        if (!reduce && p < 1) { ctx.globalCompositeOperation = 'lighter'; [1.08, 1.2].forEach(function (gs2, j) { ctx.globalAlpha = 0.28 * (1 - p) / (j + 1); var w2 = T.lw * gs2, h2 = T.lh * gs2; ctx.drawImage(T.c, T.cx + (T.lx - T.cx) * gs2, T.cy + (T.ly - T.cy) * gs2, w2, h2); }); ctx.globalCompositeOperation = 'source-over'; }
        var sw = (t - 6.0) / 1.1;
        if (sw > 0 && sw < 1) {
          var sg = T.sh.getContext('2d'), cw = T.sh.width, ch = T.sh.height, bx = (-0.25 + 1.5 * sw) * cw;
          sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, cw, ch); sg.drawImage(T.c, 0, 0);
          sg.globalCompositeOperation = 'source-atop';
          var bg2 = sg.createLinearGradient(bx - ch * 0.6, 0, bx + ch * 0.2, ch);
          bg2.addColorStop(0, 'rgba(255,255,255,0)'); bg2.addColorStop(0.5, 'rgba(255,255,255,0.95)'); bg2.addColorStop(1, 'rgba(255,255,255,0)');
          sg.fillStyle = bg2; sg.fillRect(0, 0, cw, ch);
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = tA * Math.sin(sw * PI); ctx.drawImage(T.sh, T.lx, T.ly, T.lw, T.lh);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        streak(T.Cx - T.r * 0.97, T.Cy, W * (0.25 + 0.45 * Math.exp(-ti * 1.5)), tA * (0.22 + 0.7 * Math.exp(-ti * 2.2)));

        // tagline
        var tg = sm(6.3, 7.4, t);
        if (tg > 0) {
          var fsz = Math.max(11, T.F * 0.15), spc = fsz * (0.9 - 0.35 * eo3((t - 6.3) / 1.6)), word = 'STUDIOS', ty = T.cy + T.cap / 2 + fsz * 2.3;
          ctx.font = '600 ' + fsz + 'px ' + FONT; ctx.textBaseline = 'alphabetic';
          var wsum = 0, wl = []; for (i = 0; i < word.length; i++) { wl.push(ctx.measureText(word[i]).width); wsum += wl[i]; }
          var tw2 = wsum + spc * (word.length - 1), x = T.cx - tw2 / 2;
          ctx.globalAlpha = tg; ctx.fillStyle = '#cdd6ea';
          for (i = 0; i < word.length; i++) { ctx.fillText(word[i], x, ty); x += wl[i] + spc; }
          var ll = T.F * 0.9 * eo3((t - 6.4) / 1.4), ly2 = ty - fsz * 0.36;
          ctx.globalAlpha = tg * 0.55; ctx.fillStyle = '#9fb3d8';
          ctx.fillRect(T.cx - tw2 / 2 - fsz - ll, ly2, ll, 1); ctx.fillRect(T.cx + tw2 / 2 + fsz, ly2, ll, 1);
          ctx.globalAlpha = 1;
        }
      }

      // shockwave and flash
      if (after) {
        if (!embersOn) { embersOn = true; spawnEmbers(T.Cx, T.Cy, T.w); }
        if (!reduce && ti < 1.3) {
          ctx.globalCompositeOperation = 'lighter';
          [[0, 1], [0.09, 0.5]].forEach(function (q) {
            var pp = cl((ti - q[0]) / 1.15); if (pp <= 0 || pp >= 1) return;
            var rr = eo3(pp) * Math.hypot(W, H) * 0.75 + T.r;
            ctx.globalAlpha = q[1] * Math.pow(1 - pp, 1.6); ctx.strokeStyle = 'rgba(190,215,255,1)'; ctx.lineWidth = 2 + 30 * (1 - pp) * q[1];
            ctx.beginPath(); ctx.arc(T.Cx, T.Cy, rr, 0, TAU); ctx.stroke();
          });
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        }
        if (!reduce && ti < 0.7) { ctx.globalAlpha = Math.pow(1 - ti / 0.7, 2.2); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      }

      // embers
      if (embers.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (i = 0; i < embers.length; i++) {
          var e = embers[i]; e.age += dt; if (e.age < 0 || e.age > e.life) continue;
          var dr = e.burst ? Math.exp(-dt * 2.2) : 1; e.vx *= dr; e.vy = e.vy * dr - 22 * dt;
          e.x += (e.vx + Math.sin(t * 2 + e.ph) * 12) * dt; e.y += e.vy * dt;
          var ea = Math.pow(1 - e.age / e.life, 1.3) * (0.75 + 0.25 * Math.sin(t * 13 + e.ph)) * Math.min(1, e.age * 8), es = e.s * 4;
          ctx.globalAlpha = ea; ctx.drawImage(ember, e.x - es / 2, e.y - es / 2, es, es);
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }

      // lens finish: vignette, letterbox bars, film grain, fade
      ctx.drawImage(vign, 0, 0, W, H);
      var bar = H * 0.085 * sm(0, 1.4, t); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var gp = grainPat[Math.floor(t * 24) % grainPat.length];
      if (gp) { var ox = Math.floor(sR() * 128), oy = Math.floor(sR() * 128); ctx.save(); ctx.translate(-ox, -oy); ctx.globalAlpha = 0.055; ctx.fillStyle = gp; ctx.fillRect(0, 0, cv.width + ox, cv.height + oy); ctx.restore(); }
      var fade = Math.max(sm(T_FADE0, T_FADE1, t), skipAt >= 0 ? cl((t - skipAt) / 0.4) : 0);
      if (fade > 0) { ctx.globalAlpha = fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1; }
    }

    function begin() {
      if (state === 'play' || ended) return;
      state = 'play';
      if (promptEl) { promptEl.remove(); promptEl = null; }
      hold(16000);
      try { if (ac && ac.state !== 'closed') snd = buildAudio(ac); } catch (e) { snd = null; try { console.warn('C-MOON intro audio', e); } catch (_) {} }
      startMs = performance.now() + 60; lastT = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function skip() {
      if (state !== 'play' || skipAt >= 0) return;
      var t = (performance.now() - startMs) / 1000; if (t < 1) return;
      skipAt = t; if (snd) snd.fade(0.4);
    }
    function unlock() {
      if (!ac) return;
      try { var p = ac.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      try { var bf = ac.createBuffer(1, 1, 22050), src = ac.createBufferSource(); src.buffer = bf; src.connect(ac.destination); src.start(0); } catch (e) {}
    }
    function gesture() {
      unlock();
      var go = false, fire = function () { if (!go) { go = true; begin(); } };
      if (ac) { try { var p = ac.resume(); if (p && p.then) p.then(fire, fire); } catch (e) {} setTimeout(fire, 350); } else fire();
    }
    function onPointer(e) {
      e.stopPropagation();
      if (state === 'prompt') { state = 'starting'; gesture(); } else if (state === 'play') skip();
    }
    function onKey(e) {
      if (ended) return;
      if (!root.isConnected) { cleanup(); return; }   // the index.html fallback removed the overlay: give the keys back to the game
      e.stopImmediatePropagation();
      if (/^(Shift|Control|Alt|Meta|CapsLock|Tab|F\d+)$/.test(e.key || '')) return;
      if (state === 'prompt') { state = 'starting'; gesture(); } else if (state === 'play') skip();
    }
    function onClickStop(e) { e.stopPropagation(); if (state === 'starting' || state === 'prompt') unlock(); }
    var rsT = 0; function onResize() { clearTimeout(rsT); rsT = setTimeout(function () { if (!ended) { try { layout(); } catch (e) {} } }, 120); }
    function onFonts() { titleDirty = true; }

    function cleanup() {
      if (ended) return; ended = true;
      if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(rsT);
      root.removeEventListener('pointerdown', onPointer); root.removeEventListener('click', onClickStop); root.removeEventListener('touchend', onClickStop);
      window.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize);
      try { if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', onFonts); } catch (e) {}
      if (ac) { var a2 = ac; ac = null; try { if (snd) snd.fade(0.05); } catch (e) {} setTimeout(function () { try { if (a2.state !== 'closed') a2.close(); } catch (e) {} }, 120); }
      try { root.remove(); } catch (e) {}
      [litC, b1, b2, cR, cB, vign, tex, litTex, T && T.c, T && T.sh].forEach(function (c) { if (c) { c.width = c.height = 1; } });
      cv.width = cv.height = 1;
      fin();
    }

    root.addEventListener('pointerdown', onPointer); root.addEventListener('click', onClickStop); root.addEventListener('touchend', onClickStop, { passive: true });
    window.addEventListener('keydown', onKey, true); window.addEventListener('resize', onResize);

    function boot() {
      if (ended) return;
      try { if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onFonts); } catch (e) {}
      var fontP = new Promise(function (r) { setTimeout(r, 1500); try { if (document.fonts && document.fonts.load) document.fonts.load('700 100px "Chakra Petch"').then(r, r); else r(); } catch (e) { r(); } });
      fontP.then(function () {
        if (ended) return;
        init();
        var AC = window.AudioContext || window.webkitAudioContext;
        try { if (AC) ac = new AC(); } catch (e) { ac = null; }
        if (!ac) { begin(); return; }
        if (ac.state === 'running') { begin(); return; }
        var decided = false, decide = function () {
          if (decided || ended) return; decided = true;
          if (ac && ac.state === 'running') { begin(); return; }
          // the browser wants a tap before it plays sound: ask for one, then play the intro with sound
          state = 'prompt'; hold(600000);
          promptEl = document.createElement('div');
          promptEl.style.cssText = 'position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;color:#cfd6e6;font:600 15px ' + FONT.replace(/"/g, "'") + ';letter-spacing:.28em;text-transform:uppercase;pointer-events:none;padding:0 16px' + (reduce ? '' : ';animation:cmoonP 2.4s ease-in-out infinite');
          promptEl.textContent = '▶  ' + tr('Tap to begin');
          var stl = document.createElement('style'); stl.textContent = '@keyframes cmoonP{0%,100%{opacity:.35}50%{opacity:1}}';
          root.appendChild(stl); root.appendChild(promptEl);
        };
        try { var p = ac.resume(); if (p && p.then) p.then(function () { if (ac && ac.state === 'running') decide(); }, function () {}); } catch (e) {}
        setTimeout(decide, 250);
      }).catch(function (e) { try { console.warn('C-MOON intro boot', e); } catch (_) {} cleanup(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
  }

  window.CMOON_INTRO = { play: function () { return play(false); } };
  if (/[?&]nointro(=|&|$)/.test(Q) || (navigator.webdriver && !/[?&]intro=1/.test(Q))) { signalDone(); return; }
  play(true);
})();
