/* Red Dust Outpost · v88 save safety.
   - Save format version ('rdo2-saveV'). Older saves are kept exactly as they are; a backup is taken before the
     version mark is written, so nothing is ever overwritten silently.
   - Automatic backups of every 'rdo2-' key (two generations: 'rdo2bak' and 'rdo2bak1'), taken at launch, on the title
     screen, after each world result and every two minutes of play.
   - If a stored value is damaged, LS.get restores it from the backup (see index.html).
   - Settings → Gameplay: back up now, restore the last backup, export a save file, import a save file. */
(function () {
  'use strict';
  const SAVE_V = 2, PRE = 'rdo2-', MAXV = 400000;
  const ls = window.localStorage; if (!ls) return;
  function snapshot() { const d = {}; for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (!k || k.indexOf(PRE) !== 0) continue; const v = ls.getItem(k); if (v != null && v.length <= MAXV) { try { JSON.parse(v); d[k] = v; } catch (e) { /* skip damaged values */ } } } return { t: Date.now(), v: SAVE_V, d }; }
  function backup() { try { const s = JSON.stringify(snapshot()), old = ls.getItem('rdo2bak'); if (old && old !== s) ls.setItem('rdo2bak1', old); ls.setItem('rdo2bak', s); return true; } catch (e) { return false; } }
  function restore(which) { try { const b = JSON.parse(ls.getItem(which || 'rdo2bak') || 'null'); if (!b || !b.d) return false; Object.keys(b.d).forEach(k => { if (k.indexOf(PRE) === 0) ls.setItem(k, b.d[k]); }); return true; } catch (e) { return false; } }
  function info(which) { try { const b = JSON.parse(ls.getItem(which || 'rdo2bak') || 'null'); return b && b.d ? { t: b.t, n: Object.keys(b.d).length } : null; } catch (e) { return null; } }
  // migration: version 1 (no mark) → 2. No data had to change; the backup comes first, then the mark.
  try { const v = +(ls.getItem(PRE + 'saveV') || 0); if (v < SAVE_V) { backup(); ls.setItem(PRE + 'saveV', String(SAVE_V)); } } catch (e) {}
  backup();
  setInterval(() => { if (window.S && S.run) backup(); }, 120000);
  addEventListener('visibilitychange', () => { if (document.hidden) backup(); });
  if (typeof title === 'function') { const t0 = title; window.title = title = function () { const r = t0.apply(this, arguments); try { backup(); } catch (e) {} return r; }; }
  if (typeof showDone === 'function') { const d0 = showDone; window.showDone = showDone = function () { const r = d0.apply(this, arguments); setTimeout(backup, 300); return r; }; }
  function exportSave() {
    const blob = new Blob([JSON.stringify(snapshot())], { type: 'application/json' }), a = document.createElement('a'), d = new Date();
    a.href = URL.createObjectURL(blob); a.download = `red-dust-outpost-save-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function importSave(done) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { let ok = false; try { const b = JSON.parse(rd.result); if (b && b.d && typeof b.d === 'object') { const keys = Object.keys(b.d).filter(k => k.indexOf(PRE) === 0 && typeof b.d[k] === 'string'); keys.forEach(k => JSON.parse(b.d[k])); if (keys.length) { backup(); keys.forEach(k => ls.setItem(k, b.d[k])); ok = true; } } } catch (e) { ok = false; } done(ok); }; rd.readAsText(f); };
    inp.click();
  }
  const when = t => { if (!t) return '—'; const d = new Date(t); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
  // add the controls to Settings → Gameplay
  if (typeof settings === 'function') { const s0 = settings; window.settings = settings = function (back) { const r = s0.apply(this, arguments); try { panel(back); } catch (e) { console.warn('save88', e); } return r; }; }
  function panel(back) {
    const g = document.querySelector('#ov .u-grp[data-k="play"]'); if (!g || g.querySelector('.u-save')) return; const bi = info();
    const row = document.createElement('div'); row.className = 'u-srow u-save';
    row.innerHTML = `<b style="display:block;margin-bottom:6px">💾 <span>Save safety</span></b><div class="acts" style="margin:0;gap:6px;flex-wrap:wrap"><button class="btn" id="svBk">Back up now</button><button class="btn" id="svRs" ${bi ? '' : 'disabled'}>Restore last backup</button><button class="btn" id="svEx">Export save file</button><button class="btn" id="svIm">Import save file</button></div>
      <p class="u-sd"><span>Your progress is saved on this device and backed up automatically.</span> <span>Last backup</span>: <b id="svWhen">${when(bi && bi.t)}</b>${LS.bad && LS.bad.length ? ` · <span>Recovered damaged data</span>: ${LS.bad.length}` : ''}</p><p class="u-sd" id="svMsg" aria-live="polite"></p>`;
    g.appendChild(row); const msg = t => { row.querySelector('#svMsg').textContent = t; };
    row.querySelector('#svBk').onclick = () => { msg(backup() ? 'Backup saved.' : 'Could not save a backup: storage is full.'); row.querySelector('#svWhen').textContent = when(Date.now()); };
    row.querySelector('#svRs').onclick = () => { if (!confirmTwice(row.querySelector('#svRs'))) return; msg(restore() ? 'Backup restored. Reloading…' : 'No backup to restore.'); setTimeout(() => location.reload(), 800); };
    row.querySelector('#svEx').onclick = () => { exportSave(); msg('Save file downloaded.'); };
    row.querySelector('#svIm').onclick = () => importSave(ok => { msg(ok ? 'Save file loaded. Reloading…' : 'That file is not a Red Dust Outpost save.'); if (ok) setTimeout(() => location.reload(), 800); });
  }
  // a destructive action needs a second tap (no browser dialogs, which block the game)
  function confirmTwice(b) { if (b.dataset.arm) return true; b.dataset.arm = 1; const t = b.textContent; b.textContent = 'Tap again to restore'; setTimeout(() => { delete b.dataset.arm; b.textContent = t; }, 3000); return false; }
  window.SAVE88 = { backup, restore, info, snapshot, SAVE_V };
  if (window.I18N && I18N.add) I18N.add([
    ['Save safety', 'Kaligtasan ng save', 'Kaluwasan sa save', 'Seguridad del guardado', 'Sécurité des sauvegardes', 'Segurança do salvamento', 'Speicherschutz', 'Keamanan simpanan', 'セーブの保護', '存档安全', '저장 보호', 'सेव सुरक्षा'],
    ['Back up now', 'Mag-backup ngayon', 'Backup karon', 'Copia ahora', 'Sauvegarder', 'Fazer backup agora', 'Jetzt sichern', 'Cadangkan sekarang', '今すぐバックアップ', '立即备份', '지금 백업', 'अभी बैकअप'],
    ['Restore last backup', 'Ibalik ang huling backup', 'Ibalik ang katapusang backup', 'Restaurar última copia', 'Restaurer la dernière sauvegarde', 'Restaurar último backup', 'Letzte Sicherung wiederherstellen', 'Pulihkan cadangan terakhir', '最後のバックアップを復元', '恢复上次备份', '마지막 백업 복원', 'पिछला बैकअप लौटाएँ'],
    ['Export save file', 'I-export ang save file', 'I-export ang save file', 'Exportar partida', 'Exporter la sauvegarde', 'Exportar arquivo de save', 'Spielstand exportieren', 'Ekspor file simpanan', 'セーブをファイルに書き出す', '导出存档文件', '저장 파일 내보내기', 'सेव फ़ाइल निर्यात करें'],
    ['Import save file', 'I-import ang save file', 'I-import ang save file', 'Importar partida', 'Importer une sauvegarde', 'Importar arquivo de save', 'Spielstand importieren', 'Impor file simpanan', 'セーブファイルを読み込む', '导入存档文件', '저장 파일 가져오기', 'सेव फ़ाइल आयात करें'],
    ['Your progress is saved on this device and backed up automatically.', 'Naka-save ang progreso mo sa device na ito at awtomatikong naba-backup.', 'Na-save ang imong progreso niini nga device ug awtomatik nga na-backup.', 'Tu progreso se guarda en este dispositivo y se respalda automáticamente.', 'Votre progression est enregistrée sur cet appareil et sauvegardée automatiquement.', 'Seu progresso fica salvo neste aparelho com backup automático.', 'Dein Fortschritt wird auf diesem Gerät gespeichert und automatisch gesichert.', 'Progresmu disimpan di perangkat ini dan dicadangkan otomatis.', '進行状況はこの端末に保存され、自動でバックアップされます。', '进度保存在本设备上,并会自动备份。', '진행 상황은 이 기기에 저장되고 자동 백업됩니다.', 'आपकी प्रगति इस डिवाइस पर सहेजी जाती है और अपने-आप बैकअप होती है।'],
    ['Last backup', 'Huling backup', 'Katapusang backup', 'Última copia', 'Dernière sauvegarde', 'Último backup', 'Letzte Sicherung', 'Cadangan terakhir', '最後のバックアップ', '上次备份', '마지막 백업', 'पिछला बैकअप'],
    ['Recovered damaged data', 'Naibalik na sirang datos', 'Naibalik nga guba nga datos', 'Datos dañados recuperados', 'Données endommagées récupérées', 'Dados danificados recuperados', 'Beschädigte Daten wiederhergestellt', 'Data rusak dipulihkan', '破損データを復旧', '已恢复损坏数据', '손상 데이터 복구', 'खराब डेटा वापस मिला'],
    ['Backup saved.', 'Na-save ang backup.', 'Na-save ang backup.', 'Copia guardada.', 'Sauvegarde enregistrée.', 'Backup salvo.', 'Sicherung gespeichert.', 'Cadangan tersimpan.', 'バックアップしました。', '备份已保存。', '백업 저장됨.', 'बैकअप सहेजा गया।'],
    ['Save file downloaded.', 'Na-download ang save file.', 'Na-download ang save file.', 'Archivo de partida descargado.', 'Fichier de sauvegarde téléchargé.', 'Arquivo de save baixado.', 'Speicherdatei heruntergeladen.', 'File simpanan diunduh.', 'セーブファイルを保存しました。', '存档文件已下载。', '저장 파일을 내려받았습니다.', 'सेव फ़ाइल डाउनलोड हुई।'],
    ['Tap again to restore', 'I-tap ulit para ibalik', 'I-tap usab aron ibalik', 'Toca otra vez para restaurar', 'Touchez encore pour restaurer', 'Toque de novo para restaurar', 'Zum Wiederherstellen erneut tippen', 'Ketuk lagi untuk memulihkan', 'もう一度タップで復元', '再点一次以恢复', '다시 탭하면 복원', 'लौटाने के लिए फिर टैप करें'],
    ['That file is not a Red Dust Outpost save.', 'Hindi save ng Red Dust Outpost ang file na iyan.', 'Dili save sa Red Dust Outpost kana nga file.', 'Ese archivo no es una partida de Red Dust Outpost.', 'Ce fichier n’est pas une sauvegarde de Red Dust Outpost.', 'Esse arquivo não é um save de Red Dust Outpost.', 'Diese Datei ist kein Red-Dust-Outpost-Spielstand.', 'File itu bukan simpanan Red Dust Outpost.', 'Red Dust Outpostのセーブではありません。', '该文件不是Red Dust Outpost存档。', 'Red Dust Outpost 저장 파일이 아닙니다.', 'यह Red Dust Outpost की सेव फ़ाइल नहीं है।']]);
})();
