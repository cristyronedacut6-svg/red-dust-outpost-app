// Red Dust Outpost · Adventure Mode soundscape: engine rumble that follows the throttle, re-entry wind,
// a slow ambient space pad and soft cockpit beeps. Built with Web Audio on the game's existing mixer (ac/BUS from index.html),
// so it uses the CPU audio thread only — no graphics cost at all.
let A = null;
const g = () => { try { return typeof ac === 'function' ? ac() : null; } catch (e) { return null; } };
const bus = () => { try { return typeof BUS !== 'undefined' ? BUS : null; } catch (e) { return null; } };
const noiseBuf = ctx => { try { if (typeof NB !== 'undefined' && NB) return NB; } catch (e) {} const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
function build() { const ctx = g(), B = bus(); if (!ctx || !B) return null; const out0 = B.amb || ctx.destination, mus = B.mus || out0;
  // the medium: sound is shaped by the air it travels through (thin Martian air is quiet and dull, thick Venus air loud; in vacuum only the suit or hull carries it)
  const airF = ctx.createBiquadFilter(); airF.type = 'lowpass'; airF.frequency.value = 18000; airF.Q.value = .5; const airG = ctx.createGain(); airG.gain.value = 1; airF.connect(airG); airG.connect(out0); const out = airF;
  const loop = (f) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = true; s.playbackRate.value = f; s.start(); return s; };
  // engine: filtered noise roar + a low sawtooth throb
  const en = loop(1), enF = ctx.createBiquadFilter(); enF.type = 'lowpass'; enF.frequency.value = 160; enF.Q.value = .7; const enG = ctx.createGain(); enG.gain.value = 0; en.connect(enF); enF.connect(enG); enG.connect(out);
  const sub = ctx.createOscillator(); sub.type = 'sawtooth'; sub.frequency.value = 38; const subF = ctx.createBiquadFilter(); subF.type = 'lowpass'; subF.frequency.value = 110; const subG = ctx.createGain(); subG.gain.value = 0; sub.connect(subF); subF.connect(subG); subG.connect(out); sub.start();
  // wind / plasma roar for atmospheric entry and flying in air
  const wn = loop(.7), wF = ctx.createBiquadFilter(); wF.type = 'bandpass'; wF.frequency.value = 500; wF.Q.value = .6; const wG = ctx.createGain(); wG.gain.value = 0; wn.connect(wF); wF.connect(wG); wG.connect(out);
  // ambient pad: two detuned tones drifting slowly, into the reverb, very quiet
  const padG = ctx.createGain(); padG.gain.value = 0; const pads = [55, 82.4, 110.3].map((f, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle'; o.frequency.value = f; const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = .05 + i * .03; lg.gain.value = f * .006; lf.connect(lg); lg.connect(o.frequency); lf.start(); o.connect(padG); o.start(); return o; });
  const pF = ctx.createBiquadFilter(); pF.type = 'lowpass'; pF.frequency.value = 700; padG.connect(pF); pF.connect(mus); if (B.rv) pF.connect(B.rv);
  // on the surface: the suit itself (fan hum and slow breathing, heard inside the helmet whatever the world) and the outside breeze (through the air filter, so silent in vacuum)
  const su = loop(.35), suF = ctx.createBiquadFilter(); suF.type = 'lowpass'; suF.frequency.value = 260; const suG = ctx.createGain(); suG.gain.value = 0; su.connect(suF); suF.connect(suG); suG.connect(out0);
  const br = loop(.9), brF = ctx.createBiquadFilter(); brF.type = 'bandpass'; brF.frequency.value = 900; brF.Q.value = 1.4; const brG = ctx.createGain(); brG.gain.value = 0; br.connect(brF); brF.connect(brG); brG.connect(out0);
  const bz = loop(.45), bzF = ctx.createBiquadFilter(); bzF.type = 'lowpass'; bzF.frequency.value = 420; const bzG = ctx.createGain(); bzG.gain.value = 0; bz.connect(bzF); bzF.connect(bzG); bzG.connect(out);
  return { ctx, enG, enF, subG, sub, wG, wF, padG, nextBeep: 0, out, airF, airG, air: 'ship', suG, brG, bzG, bzF, bt: 0 };
}
const ramp = (p, v, ctx, t = .12) => { try { p.setTargetAtTime(v, ctx.currentTime, t); } catch (e) {} };
// [low-pass Hz, gain] per medium. Mars: about 20 dB quieter and high pitches die off fast in the thin CO2 (measured by Perseverance's microphones).
const AIR = { ship: [18000, 1], vac: [320, .6], mars: [1400, .4], earth: [18000, 1], titan: [9000, 1.2], venus: [5200, 1.35], moon: [320, .6], pluto: [600, .3], triton: [600, .3], io: [450, .5] };
// outside breeze level per world (only worlds with real air; Mars is faint because the air is so thin)
const BREEZE = { earth: .08, mars: .05, titan: .07, venus: .1, pluto: .01 };
export const AUD = {
  start() { if (!A) A = build(); if (A) ramp(A.padG.gain, .05, A.ctx, 1.5); },
  // a short burst of radio static before Mission Control speaks (heard through the suit radio)
  radio() { if (!A) return; const c = A.ctx, b = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); b.buffer = A.nb || (A.nb = (() => { const n = c.createBuffer(1, c.sampleRate * .3, c.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return n; })());
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = .8; g.gain.setValueAtTime(.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(.05, c.currentTime + .01); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .22); b.connect(f); f.connect(g); g.connect(A.out); b.start(); b.stop(c.currentTime + .25); },
  stop() { if (!A) return; [A.enG, A.subG, A.wG, A.padG, A.suG, A.brG, A.bzG].forEach(n => ramp(n.gain, 0, A.ctx, .3)); },
  // eng 0..1 throttle, boost 0/1, wind 0..1, cockpit bool
  set({ eng = 0, boost = 0, wind = 0, cockpit = false, dt = .016, air = 'ship', suit = 0, gust = 0, effort = 0 }) { if (!A) return; const c = A.ctx, k = cockpit ? 1.25 : 1;
    if (A.suG) { A.bt += dt * (.22 + effort * .25); const br = Math.pow(Math.max(0, Math.sin(A.bt * 6.283)), 3); ramp(A.suG.gain, suit * .035, c, .5); ramp(A.brG.gain, suit * (.006 + effort * .01) * br, c, .25);
      ramp(A.bzG.gain, suit ? (BREEZE[air] || 0) * (1 + gust * 4) : 0, c, .8); ramp(A.bzF.frequency, 300 + gust * 900, c, .8); }
    if (air !== A.air) { A.air = air; const M = AIR[air] || AIR.ship; ramp(A.airF.frequency, M[0], c, .6); ramp(A.airG.gain, M[1], c, .6); }
    ramp(A.enG.gain, (eng * (.16 + boost * .14)) * k, c); ramp(A.enF.frequency, 140 + eng * 380 + boost * 520, c, .25);
    ramp(A.subG.gain, eng * (.05 + boost * .05) * k, c); ramp(A.sub.frequency, 34 + eng * 10 + boost * 14, c, .4);
    ramp(A.wG.gain, wind * .55, c, .2); ramp(A.wF.frequency, 380 + wind * 1500, c, .3);
    if (cockpit && c.currentTime > A.nextBeep) { A.nextBeep = c.currentTime + 7 + Math.random() * 9; const o = c.createOscillator(), gg = c.createGain(); o.type = 'sine'; o.frequency.value = Math.random() < .5 ? 1320 : 990; gg.gain.setValueAtTime(0, c.currentTime); gg.gain.linearRampToValueAtTime(.035, c.currentTime + .01); gg.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .18); o.connect(gg); gg.connect(A.out); o.start(); o.stop(c.currentTime + .2); } }
};
