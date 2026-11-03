// Red Dust Outpost · Adventure Mode soundscape: engine rumble that follows the throttle, re-entry wind,
// a slow ambient space pad and soft cockpit beeps. Built with Web Audio on the game's existing mixer (ac/BUS from index.html),
// so it uses the CPU audio thread only — no graphics cost at all.
let A = null;
const g = () => { try { return typeof ac === 'function' ? ac() : null; } catch (e) { return null; } };
const bus = () => { try { return typeof BUS !== 'undefined' ? BUS : null; } catch (e) { return null; } };
const noiseBuf = ctx => { try { if (typeof NB !== 'undefined' && NB) return NB; } catch (e) {} const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
function build() { const ctx = g(), B = bus(); if (!ctx || !B) return null; const out = B.amb || ctx.destination, mus = B.mus || out;
  const loop = (f) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = true; s.playbackRate.value = f; s.start(); return s; };
  // engine: filtered noise roar + a low sawtooth throb
  const en = loop(1), enF = ctx.createBiquadFilter(); enF.type = 'lowpass'; enF.frequency.value = 160; enF.Q.value = .7; const enG = ctx.createGain(); enG.gain.value = 0; en.connect(enF); enF.connect(enG); enG.connect(out);
  const sub = ctx.createOscillator(); sub.type = 'sawtooth'; sub.frequency.value = 38; const subF = ctx.createBiquadFilter(); subF.type = 'lowpass'; subF.frequency.value = 110; const subG = ctx.createGain(); subG.gain.value = 0; sub.connect(subF); subF.connect(subG); subG.connect(out); sub.start();
  // wind / plasma roar for atmospheric entry and flying in air
  const wn = loop(.7), wF = ctx.createBiquadFilter(); wF.type = 'bandpass'; wF.frequency.value = 500; wF.Q.value = .6; const wG = ctx.createGain(); wG.gain.value = 0; wn.connect(wF); wF.connect(wG); wG.connect(out);
  // ambient pad: two detuned tones drifting slowly, into the reverb, very quiet
  const padG = ctx.createGain(); padG.gain.value = 0; const pads = [55, 82.4, 110.3].map((f, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle'; o.frequency.value = f; const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = .05 + i * .03; lg.gain.value = f * .006; lf.connect(lg); lg.connect(o.frequency); lf.start(); o.connect(padG); o.start(); return o; });
  const pF = ctx.createBiquadFilter(); pF.type = 'lowpass'; pF.frequency.value = 700; padG.connect(pF); pF.connect(mus); if (B.rv) pF.connect(B.rv);
  return { ctx, enG, enF, subG, sub, wG, wF, padG, nextBeep: 0, out };
}
const ramp = (p, v, ctx, t = .12) => { try { p.setTargetAtTime(v, ctx.currentTime, t); } catch (e) {} };
export const AUD = {
  start() { if (!A) A = build(); if (A) ramp(A.padG.gain, .05, A.ctx, 1.5); },
  stop() { if (!A) return; [A.enG, A.subG, A.wG, A.padG].forEach(n => ramp(n.gain, 0, A.ctx, .3)); },
  // eng 0..1 throttle, boost 0/1, wind 0..1, cockpit bool
  set({ eng = 0, boost = 0, wind = 0, cockpit = false, dt = .016 }) { if (!A) return; const c = A.ctx, k = cockpit ? 1.25 : 1;
    ramp(A.enG.gain, (eng * (.16 + boost * .14)) * k, c); ramp(A.enF.frequency, 140 + eng * 380 + boost * 520, c, .25);
    ramp(A.subG.gain, eng * (.05 + boost * .05) * k, c); ramp(A.sub.frequency, 34 + eng * 10 + boost * 14, c, .4);
    ramp(A.wG.gain, wind * .55, c, .2); ramp(A.wF.frequency, 380 + wind * 1500, c, .3);
    if (cockpit && c.currentTime > A.nextBeep) { A.nextBeep = c.currentTime + 7 + Math.random() * 9; const o = c.createOscillator(), gg = c.createGain(); o.type = 'sine'; o.frequency.value = Math.random() < .5 ? 1320 : 990; gg.gain.setValueAtTime(0, c.currentTime); gg.gain.linearRampToValueAtTime(.035, c.currentTime + .01); gg.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .18); o.connect(gg); gg.connect(A.out); o.start(); o.stop(c.currentTime + .2); } }
};
