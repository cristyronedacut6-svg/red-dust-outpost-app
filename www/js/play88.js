/* Red Dust Outpost · v88 colony cause-and-effect.
   The outpost status panel explains WHY each life-support number is moving and what to do about it, using only the
   values the simulation already has (rates, sunlight, dust, storms, disconnected or switched-off modules).
   The world result screen also gets a short mission report: discoveries, decisions, crew and buildings. */
(function () {
  'use strict';
  if (typeof S === 'undefined' && typeof update !== 'function') return;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = t => S.b.filter(b => b.t === t && !(b.pop != null && b.pop < 0)).length;
  const secs = v => v < 90 ? Math.ceil(v) + ' s' : Math.round(v / 60) + ' min';
  function why() {
    if (!S || !S.res) return ''; const r = S.res, rt = S.rate || {}, out = [];
    const sol = S.b.filter(b => b.t === 'solar'), dusty = sol.filter(b => (b.dust || 0) > .35).length, off = S.b.filter(b => b.off).length, nc = S.b.filter(b => b.nc).length, isNight = typeof night === 'function' && night();
    // power
    if (rt.pw < -.05) { const c = []; if (isNight && sol.length) c.push('it is night, so the solar panels make nothing'); if (S.storm > 0) c.push('a dust storm is blocking the sunlight'); if (dusty) c.push(`${dusty} solar panel${dusty > 1 ? 's are' : ' is'} covered in dust`); if (!sol.length && !n('rtg') && !n('reactor')) c.push('nothing is making power yet');
      if (!c.length) c.push('your modules use more power than you make');
      const t = r.pw > .5 ? ` At this rate the batteries last about ${secs(r.pw / -rt.pw)}.` : '';
      const fix = isNight ? 'Build a battery or an RTG, or switch off a module you do not need tonight.' : dusty ? 'Send the crew to brush the panels, or research the dust shield.' : 'Build more solar panels or an RTG.';
      out.push(['bolt', 'Power is falling because ' + c.join(', and ') + '.' + t, fix, 'bad']); }
    else if (rt.pw > .05 && r.pw >= (S.cap || 0) - .5 && S.cap) out.push(['bolt', 'Power is full. Extra power is being wasted.', 'Build a battery to store more, or add a module that uses power.', 'ok']);
    if (nc) out.push(['bolt', `${nc} module${nc > 1 ? 's are' : ' is'} not connected to power.`, 'Build it closer to the core or add a Pylon.', 'bad']);
    if (off) out.push(['bolt', `${off} module${off > 1 ? 's are' : ' is'} switched off.`, 'Tap it and switch it back on when you have spare power.', 'warn']);
    // air
    if (rt.o2 < -.05) { const g = n('o2'); out.push(['wind', g ? `Air is falling: ${S.crew} crew breathe more than ${g} oxygen generator${g > 1 ? 's' : ''} can make${r.pw <= .5 ? ', and with no power they stop working' : ''}.` : `Air is falling: ${S.crew} crew are breathing and there is no oxygen generator.`, r.pw <= .5 ? 'Fix the power first: oxygen generators need it.' : 'Build another oxygen generator.', 'bad']); }
    // food
    if (rt.fd < -.05) { const f = n('farm'); out.push(['leaf', f ? `Food is falling: ${S.crew} crew eat more than ${f} farm${f > 1 ? 's' : ''} grow${r.pw <= .5 ? ', and farms need power' : ''}.` : `Food is falling: the crew eats and there is no farm yet.`, 'Build a farm, or give a Botanist a job on the base.', 'bad']); }
    // radiation
    if ((r.rad || 0) > 45) out.push(['rad', `Radiation is high${S.storm > 0 && S.lv === 1 ? ' during the storm' : ''}${n('shield') ? '' : ' and there is no shield'}.`, n('shield') ? 'Build another shield, or keep the crew near the shield.' : 'Build a shield module.', 'bad']);
    if (!out.length) out.push(['heart', 'Everything is stable right now.', 'A good moment to build, research or scan a science site.', 'ok']);
    return `<div class="u-sec">Why it is changing</div>` + out.map(([ic, a, b, k]) => `<div class="u-why ${k}">${window.UI86 ? UI86.ic(ic, 14) : ''}<div><b>${esc(a)}</b><span>${esc(b)}</span></div></div>`).join('');
  }
  window.WHY88 = why;
  // mission report on the world result screen
  if (typeof showDone === 'function') { const d0 = showDone; window.showDone = showDone = function () { const r = d0.apply(this, arguments); try { report(); } catch (e) { console.warn('report', e); } return r; }; }
  function report() {
    const sh = document.querySelector('#ov .sheet'); if (!sh || !S || sh.querySelector('.u-rep')) return; let cd = {}; try { cd = LS.get('scodex', {}) || {}; } catch (e) {}
    const sc = (window.SCI87 && SCI87[S.lv] || []).filter(x => cd[S.lv + ':' + x[0]]).length, built = S.b.filter(b => b.t !== 'core').length, kinds = new Set(S.b.map(b => b.t)).size - 1;
    const box = document.createElement('div'); box.className = 'box u-rep';
    box.innerHTML = `<h3>Mission report</h3><div class="u-rg"><div><small>Science sites scanned</small><b>${sc} / 6</b></div><div><small>Modules built</small><b>${built}</b><span>${kinds} <span>kinds</span></span></div><div><small>Crew</small><b>${S.crew}</b><span><span>health</span> ${Math.round(S.hp)}</span></div><div><small>Decisions made</small><b>${S.dec || 0}</b></div></div>${sc < 6 ? '<p class="sub" style="margin:6px 0 0">Tip: walk to the cyan survey markers and press SCAN to find the rest of this world’s science.</p>' : ''}`;
    const acts = sh.querySelector('.acts'); if (acts) sh.insertBefore(box, acts); else sh.appendChild(box);
  }
  const css = document.createElement('style'); css.textContent = `
.u-why{display:flex;gap:8px;align-items:flex-start;padding:6px 8px;margin:4px 0;border-radius:9px;background:#192630;border-left:3px solid #A7B4BF}.u-why.bad{border-left-color:#E76F6F}.u-why.warn{border-left-color:#F2C14E}.u-why.ok{border-left-color:#65C98A}
.u-why svg{margin-top:2px}.u-why b{display:block;font-weight:600;font-size:12.5px;line-height:1.35}.u-why span{display:block;font-size:12px;color:#55D6E8;margin-top:2px}
.u-rep h3{margin:0 0 6px}.u-rg{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px}.u-rg>div{background:#101820;border:1px solid rgba(167,180,191,.16);border-radius:9px;padding:6px 8px}.u-rg small{display:block;font:700 9.5px Inter,system-ui;letter-spacing:.12em;text-transform:uppercase;color:#A7B4BF}.u-rg b{font-size:17px}.u-rg span{display:block;font-size:11.5px;color:#A7B4BF}`;
  document.head.appendChild(css);
  if (window.I18N && I18N.add) I18N.add([
    ['Mission report', 'Ulat ng misyon', 'Taho sa misyon', 'Informe de misión', 'Rapport de mission', 'Relatório da missão', 'Missionsbericht', 'Laporan misi', 'ミッション報告', '任务报告', '임무 보고', 'मिशन रिपोर्ट'],
    ['Science sites scanned', 'Na-scan na lugar', 'Na-scan nga lugar', 'Sitios escaneados', 'Sites scannés', 'Locais escaneados', 'Gescannte Fundorte', 'Situs dipindai', 'スキャンした地点', '已扫描地点', '스캔한 장소', 'स्कैन किए स्थल'],
    ['Modules built', 'Mga module na naitayo', 'Mga module nga natukod', 'Módulos construidos', 'Modules construits', 'Módulos construídos', 'Gebaute Module', 'Modul dibangun', '建設したモジュール', '已建模块', '건설한 모듈', 'बने मॉड्यूल'],
    ['Decisions made', 'Mga desisyon', 'Mga desisyon', 'Decisiones', 'Décisions', 'Decisões', 'Entscheidungen', 'Keputusan', '決断', '决定', '결정', 'फ़ैसले'],
    ['kinds', 'uri', 'klase', 'tipos', 'types', 'tipos', 'Arten', 'jenis', '種類', '种', '종류', 'प्रकार'],
    ['health', 'kalusugan', 'panglawas', 'salud', 'santé', 'saúde', 'Gesundheit', 'kesehatan', '体力', '健康', '체력', 'स्वास्थ्य'],
    ['Everything is stable right now.', 'Maayos ang lahat ngayon.', 'Lig-on ang tanan karon.', 'Todo está estable ahora.', 'Tout est stable pour l’instant.', 'Tudo está estável agora.', 'Alles ist gerade stabil.', 'Semua stabil saat ini.', '今はすべて安定しています。', '目前一切稳定。', '지금은 모두 안정적입니다.', 'अभी सब स्थिर है।'],
    ['A good moment to build, research or scan a science site.', 'Magandang oras para magtayo, magsaliksik o mag-scan.', 'Maayong higayon sa pagtukod, panukiduki o pag-scan.', 'Buen momento para construir, investigar o escanear.', 'Bon moment pour construire, rechercher ou scanner.', 'Bom momento para construir, pesquisar ou escanear.', 'Gute Zeit zum Bauen, Forschen oder Scannen.', 'Saat yang baik untuk membangun, riset, atau memindai.', '建設・研究・スキャンの好機です。', '正适合建造、研究或扫描。', '건설·연구·스캔하기 좋은 때입니다.', 'बनाने, अनुसंधान या स्कैन का अच्छा समय।'],
  ]);
})();
