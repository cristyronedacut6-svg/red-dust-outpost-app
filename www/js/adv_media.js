// Red Dust Outpost · replays and postcards.
// Highlights (the launch from Earth, every atmospheric entry and landing, every lift-off) are recorded automatically from the
// game canvas as short video clips. Postcards are framed stills with the game's wordmark, place and date, ready to save or share.
export function makeMedia(ctx) {
  const clips = [], MAX = 5; let rec = null, chunks = [], meta = null, stopT = null;
  const mime = (() => { if (!window.MediaRecorder) return null; for (const m of ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} } return null; })();
  const can = () => !!(mime && ctx.canvas.captureStream && ctx.enabled());
  function start(name, place) { if (!can()) return; if (rec) { if (meta && meta.name === name) return; stopNow(); }
    try { const stream = ctx.canvas.captureStream(30); chunks = []; rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 }); meta = { name, place: place || ctx.place(), t0: performance.now(), date: new Date() };
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; const m = meta, ch = chunks; rec.onstop = () => finish(m, ch); rec.start(500); clearTimeout(stopT); stopT = setTimeout(stopNow, 60000); } catch (e) { rec = null; } }
  function stop(delay = 1500) { if (!rec) return; clearTimeout(stopT); stopT = setTimeout(stopNow, delay); }
  function stopNow() { clearTimeout(stopT); if (rec && rec.state !== 'inactive') { try { meta.poster = grab(.5); } catch (e) {} rec.stop(); } rec = null; }
  function finish(m, ch) { if (!ch.length) return; const blob = new Blob(ch, { type: mime.split(';')[0] }); if (blob.size < 20000) return;
    clips.unshift({ ...m, blob, url: URL.createObjectURL(blob), dur: (performance.now() - m.t0) / 1000, ext: mime.includes('mp4') ? 'mp4' : 'webm' }); while (clips.length > MAX) URL.revokeObjectURL(clips.pop().url);
    ctx.toast(`Replay saved: <b>${m.name}</b> · open Media to watch or share`, 3200); }
  // a still of the current frame, taken right after a render so the WebGL buffer is valid
  function grab(scale = 1) { ctx.render(); const c = ctx.canvas; if (scale >= 1) return c.toDataURL('image/jpeg', .92); const o = document.createElement('canvas'); o.width = c.width * scale; o.height = c.height * scale; o.getContext('2d').drawImage(c, 0, 0, o.width, o.height); return o.toDataURL('image/jpeg', .8); }
  // ---- postcard: the frame, a thin inset border, the wordmark, where you are and when
  function postcard() { ctx.render(); const src = ctx.canvas, W = 1800, H = 1013, o = document.createElement('canvas'); o.width = W; o.height = H; const g = o.getContext('2d');
    const sr = src.width / src.height, dr = W / H; let sw = src.width, sh = src.height, sx = 0, sy = 0; if (sr > dr) { sw = sh * dr; sx = (src.width - sw) / 2; } else { sh = sw / dr; sy = (src.height - sh) / 2; } g.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
    const gr = g.createLinearGradient(0, H * .55, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.62)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2; g.strokeRect(34, 34, W - 68, H - 68);
    const P = ctx.place(), d = new Date(), font = getComputedStyle(document.body).getPropertyValue('--disp').trim() || 'system-ui';
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    g.font = `300 22px ${font}`; g.globalAlpha = .9; spaced(g, 'GREETINGS FROM', 78, H - 168, 6);
    g.globalAlpha = 1; g.font = `700 66px ${font}`; g.fillText(P.title, 74, H - 104);
    g.font = `400 24px ${font}`; g.globalAlpha = .85; g.fillText(P.sub, 78, H - 66);
    g.textAlign = 'right'; g.font = `800 26px ${font}`; g.globalAlpha = 1; spacedR(g, 'RED DUST OUTPOST', W - 78, H - 98, 7);
    g.font = `400 18px ${font}`; g.globalAlpha = .75; g.fillText(`${d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} · Moon Productions`, W - 78, H - 66);
    g.globalAlpha = .55; g.font = `400 14px ${font}`; g.fillText('3D models and maps: NASA', W - 78, H - 44); g.textAlign = 'left'; g.globalAlpha = 1;
    // a small postmark in the corner
    g.save(); g.translate(W - 150, 128); g.rotate(-.18); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 62, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 50, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.textAlign = 'center'; g.font = `700 13px ${font}`; g.fillText(P.stamp.toUpperCase(), 0, -6); g.font = `400 11px ${font}`; g.fillText(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase(), 0, 14); g.restore();
    return o; }
  function spaced(g, t, x, y, sp) { for (const ch of t) { g.fillText(ch, x, y); x += g.measureText(ch).width + sp; } }
  function spacedR(g, t, x, y, sp) { let w = 0; for (const ch of t) w += g.measureText(ch).width + sp; g.textAlign = 'left'; spaced(g, t, x - w + sp, y, sp); g.textAlign = 'right'; }
  async function share(blob, name, title) { const file = new File([blob], name, { type: blob.type }); try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return true; } } catch (e) { if (e && e.name === 'AbortError') return true; } return false; }
  function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  // ---- the Media panel: take a postcard, watch and share replays, auto-record on or off
  function panel() { const p = document.createElement('div'); p.className = 'pnl'; const fmt = s => s < 60 ? Math.round(s) + ' s' : Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s';
    p.innerHTML = `<div class="crd md"><div class="ey">MEDIA</div><h2>Postcards and replays</h2>
      <div class="row" style="justify-content:flex-start"><button class="pr" id="mdP">Take a postcard</button><button id="mdR">${ctx.enabled() ? 'Auto-record highlights: on' : 'Auto-record highlights: off'}</button></div>
      <div class="mt">${mime ? 'Launches, atmospheric entries, landings and lift-offs are recorded automatically. The last five are kept until you close the game.' : 'This browser cannot record video, but postcards work everywhere.'}</div>
      <div class="rl">${clips.length ? clips.map((c, i) => `<div class="rc"><video src="${c.url}" ${c.poster ? `poster="${c.poster}"` : ''} controls playsinline preload="metadata"></video><div class="rm"><b>${c.name}</b><span>${c.place.title} · ${fmt(c.dur)}</span><div><button data-s="${i}">Save</button><button data-h="${i}">Share</button></div></div></div>`).join('') : '<div class="mt" style="opacity:.7">No replays yet. Land somewhere, lift off, or launch from Earth.</div>'}</div>
      <div class="row"><button id="mdX">Close</button></div></div>`;
    ctx.root.appendChild(p); const q = s => p.querySelector(s); q('#mdX').onclick = () => p.remove();
    q('#mdR').onclick = () => { ctx.setEnabled(!ctx.enabled()); p.remove(); panel(); };
    q('#mdP').onclick = () => { p.remove(); requestAnimationFrame(() => requestAnimationFrame(() => card())); };
    p.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const c = clips[+b.dataset.s]; save(c.blob, `red-dust-outpost-${c.name.toLowerCase().replace(/\W+/g, '-')}.${c.ext}`); });
    p.querySelectorAll('[data-h]').forEach(b => b.onclick = async () => { const c = clips[+b.dataset.h]; if (!(await share(c.blob, `red-dust-outpost.${c.ext}`, 'Red Dust Outpost'))) save(c.blob, `red-dust-outpost.${c.ext}`); }); }
  function card() { const cv = postcard(); ctx.sfx && ctx.sfx('shutter'); const url = cv.toDataURL('image/jpeg', .92), p = document.createElement('div'); p.className = 'pnl';
    p.innerHTML = `<div class="crd md"><div class="ey">POSTCARD</div><img src="${url}" alt="Postcard" style="width:100%;border-radius:10px;display:block;margin:6px 0 10px"><div class="row"><button class="pr" id="pcS">Save</button><button id="pcH">Share</button><button id="pcX">Close</button></div></div>`;
    ctx.root.appendChild(p); const blob = () => new Promise(r => cv.toBlob(r, 'image/jpeg', .92)); p.querySelector('#pcX').onclick = () => p.remove();
    p.querySelector('#pcS').onclick = async () => save(await blob(), `red-dust-outpost-postcard-${Date.now()}.jpg`);
    p.querySelector('#pcH').onclick = async () => { const b = await blob(); if (!(await share(b, 'red-dust-outpost-postcard.jpg', 'Greetings from ' + ctx.place().title))) save(b, 'red-dust-outpost-postcard.jpg'); }; }
  return { start, stop, panel, card, get recording() { return !!rec; }, clips };
}
