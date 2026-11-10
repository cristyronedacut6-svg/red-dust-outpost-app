// Red Dust Outpost · automated checks (node tests/run.mjs). No browser needed.
// 1) every game script parses  2) the offline cache lists every script the page loads
// 3) every translation row has all 12 languages  4) science data is complete and matches SCIENCE.md
// 5) the save-safety module keeps old saves and recovers damaged values (simulated localStorage)
import fs from 'fs'; import vm from 'vm'; import path from 'path';
const W = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'www');
let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('FAIL', n, d || ''); } };
const html = fs.readFileSync(path.join(W, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
for (const f of fs.readdirSync(path.join(W, 'js')).filter(f => f.endsWith('.js'))) { const src = fs.readFileSync(path.join(W, 'js', f), 'utf8'); if (/^\s*(import|export)\s/m.test(src)) continue; try { new vm.Script(src, { filename: f }); ok('parse ' + f, true); } catch (e) { ok('parse ' + f, false, e.message); } }
const sw = fs.readFileSync(path.join(W, 'sw.js'), 'utf8');
for (const s of scripts) ok('offline cache has ' + s, sw.includes("'" + s + "'"));
// translations
const rows = [], pats = [];
const ctx = { window: {}, document: { body: null, documentElement: {} }, localStorage: { getItem: () => null, setItem() {} }, navigator: { language: 'en' }, MutationObserver: class { observe() {} }, NodeFilter: {} };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(W, 'js/i18n.js'), 'utf8'), ctx);
const add0 = ctx.I18N.add; ctx.I18N.add = (r, p) => { rows.push(...(r || [])); pats.push(...(p || [])); return add0(r, p); };
for (const f of ['i18n_ui.js', 'save88.js', 'play88.js']) { try { vm.runInContext(fs.readFileSync(path.join(W, 'js', f), 'utf8'), Object.assign(ctx, { addEventListener() {}, setInterval() {}, Blob: class {}, URL: {}, FileReader: class {} })); } catch (e) { /* modules that need the game skip themselves */ } }
ok('translation rows found', rows.length > 150, rows.length);
rows.forEach(r => ok('12 languages: ' + r[0].slice(0, 40), r.length === 12 && r.every(x => typeof x === 'string' && x.trim()), r.length));
pats.forEach(p => ok('pattern outputs: ' + p[0], p[1].length === 11 && p[1].every(x => x.trim())));
ctx.I18N.set('es'); ok('Spanish lookup works', ctx.I18N.tr('Mission Control') === 'Control de misión', ctx.I18N.tr('Mission Control'));
ok('pattern lookup works', ctx.I18N.tr('Wave 2 of 5') === 'Oleada 2 de 5', ctx.I18N.tr('Wave 2 of 5'));
ctx.I18N.set('en');
// science data
const f87 = fs.readFileSync(path.join(W, 'js/features87.js'), 'utf8'), SCIsrc = f87.slice(f87.indexOf('const SCI = ['), f87.indexOf('window.SCI87'));
const SCI = vm.runInNewContext(SCIsrc.replace('const SCI =', 'SCI =') + ';SCI', {});
ok('6 worlds of discoveries', SCI.length === 6); SCI.forEach((L, i) => { ok('6 discoveries on world ' + i, L.length === 6); ok('unique ids on world ' + i, new Set(L.map(x => x[0])).size === 6); L.forEach(x => ok('discovery text ' + x[0], x[1].length > 3 && x[2].length > 60)); });
const sci = fs.readFileSync(path.join(W, '..', 'SCIENCE.md'), 'utf8');
for (const g of ['1.62 m/s²', '3.71 m/s²', '3.70 m/s²', '1.31 m/s²', '1.35 m/s²', '0.28 m/s²', '121 °C', '5.4 Sv']) ok('SCIENCE.md has ' + g, sci.includes(g));
const ui = fs.readFileSync(path.join(W, 'js/ui86.js'), 'utf8'); for (const g of ['1.62 m/s²', '3.71 m/s²', '0.28 m/s²', '−173 to 121 °C']) ok('planet card uses ' + g, ui.includes(g));
// save safety with a fake localStorage
const store = new Map([['rdo2-stars', '[2,1,0,0,0,0]'], ['rdo2-mx', '3']]);
const lsx = { get length() { return store.size; }, key: i => [...store.keys()][i], getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const c2 = { localStorage: lsx, addEventListener() {}, setInterval() {}, document: { hidden: false }, console }; c2.window = c2; vm.createContext(c2);
vm.runInContext(fs.readFileSync(path.join(W, 'js/save88.js'), 'utf8'), c2);
ok('save version set to 2', lsx.getItem('rdo2-saveV') === '2'); ok('old values untouched', lsx.getItem('rdo2-stars') === '[2,1,0,0,0,0]');
ok('backup taken', JSON.parse(lsx.getItem('rdo2bak')).d['rdo2-stars'] === '[2,1,0,0,0,0]');
const lsLine = html.slice(html.indexOf('const LS={'), html.indexOf('};', html.indexOf('const LS={')) + 2);
const c3 = { localStorage: lsx, HOOK() {} }; vm.createContext(c3); vm.runInContext(lsLine.replace('const LS=', 'LS='), c3);
lsx.setItem('rdo2-stars', '[2,1,{broken'); const got = vm.runInContext("LS.get('stars',[])", c3);
ok('damaged value recovered from backup', JSON.stringify(got) === '[2,1,0,0,0,0]', JSON.stringify(got));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
