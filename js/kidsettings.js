'use strict';
/*
  Einstellungen pro Kind (gemeinsam für die Tafel und das freiwillige Lehrer-Gerät).
  MR.KidSettings.open(modalElement, {
    name, label, profile (oder null), noProfileText,
    onSave(ovr), onSuggest(lvls), onDelete() -> true zum Schließen (optional)
  })
  Ein "ovr" ist {cfg:{...}, lvls:{strang:stufe}} und wird vom iPad des Kindes übernommen.
*/
(function (MR) {
  const E = MR.Engine, S = MR.STRANDS;

  function open(modal, o) {
    const P = o.profile ? E.ensure(JSON.parse(JSON.stringify(o.profile))) : { cfg: E.defaultCfg(), skills: {}, name: o.name };
    if (!o.profile) MR.STRAND_ORDER.forEach(s => { P.skills[s] = E.newSkill(s); });
    const c = P.cfg, sw = c.sw;
    const ansVal = c.answer === 'choice' ? (c.choices === 2 ? 'choice2' : 'choice4') : c.answer;
    const km = sw.any ? 'any' : (sw.keys.length === 1 && sw.keys[0] === ' ') ? 'space' : (sw.keys.length === 1 && sw.keys[0] === 'Enter') ? 'enter' : 'keep';
    const opt = (v, t, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${t}</option>`;
    const sug = MR.STRAND_ORDER.filter(s => P.skills[s].suggest);
    const lvRows = MR.STRAND_ORDER.map(s => {
      const L = MR.clamp(Math.floor(P.skills[s].lvl), 1, MR.nLevels(s));
      return `<div class="field"><span>${S[s].name}</span><select data-lvl="${s}"><option value="">unverändert (jetzt Stufe ${L})</option>${S[s].levels.map((l, i) => `<option value="${i + 1}">${i + 1} · ${MR.esc(l.label)}</option>`).join('')}</select></div>`;
    }).join('');
    const title = o.label ? `${MR.esc(o.label)} <span class="muted small">${MR.esc(o.name)}</span>` : MR.esc(o.name);
    modal.innerHTML = `<div class="card">
      <div class="row"><h2 class="grow">${title}</h2><button class="btn" data-m="close">✕</button></div>
      ${!o.profile ? `<div class="banner">${MR.esc(o.noProfileText || 'Von diesem Kind liegt noch kein Stand vor.')}</div>` : ''}
      ${sug.length ? `<div class="banner">Vorschlag: Stufe 0 läuft sicher. <button class="btn small" data-m="sug">Eine Stufe weiter</button></div>` : ''}
      <div class="field"><span>Eingabeart</span><select id="fInput">${opt('tap', 'Tippen', c.input)}${opt('switch', 'Taster', c.input)}${opt('gaze', 'Blick (Augensteuerung)', c.input)}</select></div>
      <div class="field"><span>Antwortform</span><select id="fAns">${opt('auto', 'Automatisch', ansVal)}${opt('choice4', '4 Auswahlfelder', ansVal)}${opt('choice2', '2 Auswahlfelder', ansVal)}${opt('type', 'Eintippen', ansVal)}</select></div>
      <div class="field"><span>Bereiche</span><div>${MR.STRAND_ORDER.map(s => `<label class="chk"><input type="checkbox" data-strand="${s}" ${c.strands.includes(s) ? 'checked' : ''}> ${S[s].name}</label>`).join('')}</div></div>
      <div class="field"><span>Fokus</span><select id="fFocus"><option value="">kein Fokus</option>${MR.STRAND_ORDER.map(s => opt(s, S[s].name, c.focus)).join('')}</select></div>
      <h3 style="margin:6px 0 0">Stufen setzen</h3>${lvRows}
      <h3 style="margin:6px 0 0">Taster und Blick</h3>
      <div class="field"><span>Taste</span><select id="fKey">${km === 'keep' ? opt('keep', 'Gelernte Taste(n) behalten', km) : ''}${opt('any', 'Jede Taste', km)}${opt('space', 'Leertaste', km)}${opt('enter', 'Enter', km)}</select></div>
      <div class="field"><span>Sperrzeit</span><select id="fLock">${[[200, '0,2 s'], [400, '0,4 s'], [800, '0,8 s'], [1500, '1,5 s']].map(x => opt(x[0], x[1], sw.lockMs)).join('')}</select></div>
      <div class="field"><span>Durchlauf-Tempo</span><select id="fScan">${[[1200, 'schnell'], [1800, 'normal'], [2500, 'langsam'], [3500, 'sehr langsam']].map(x => opt(x[0], x[1], sw.scanMs)).join('')}</select></div>
      <div class="field"><span>Blick-Verweildauer</span><select id="fDwell">${[[800, '0,8 s'], [1200, '1,2 s'], [1800, '1,8 s'], [2500, '2,5 s']].map(x => opt(x[0], x[1], c.gaze.dwellMs)).join('')}</select></div>
      <p class="muted small">Eine Taste anlernen geht nur am iPad selbst (⚙ 1 Sekunde gedrückt halten).</p>
      <h3 style="margin:6px 0 0">Sonstiges</h3>
      <div class="field"><span>Stil</span><select id="fTheme">${Object.keys(MR.THEMES).map(t => opt(t, MR.THEMES[t].label, c.theme)).join('')}</select></div>
      <div class="row"><label class="chk"><input type="checkbox" id="fHints" ${c.hints ? 'checked' : ''}> Hilfe-Knopf</label><label class="chk"><input type="checkbox" id="fSpeak" ${c.speak ? 'checked' : ''}> Vorlesen</label><label class="chk"><input type="checkbox" id="fSound" ${c.sound ? 'checked' : ''}> Ton</label><label class="chk"><input type="checkbox" id="fTap" ${c.screenTap ? 'checked' : ''}> Bildschirmtipp zählt</label></div>
      <div class="row"><button class="btn primary" data-m="save">Speichern</button><button class="btn" data-m="close">Abbrechen</button>
        ${o.onDelete ? '<button class="btn danger small" data-m="del" style="margin-left:auto">Aus Klasse entfernen</button>' : ''}</div>
    </div>`;
    modal.classList.remove('hidden');
    const close = () => modal.classList.add('hidden');
    modal.onclick = e => {
      if (e.target === modal) return close();
      const b = e.target.closest('[data-m]'); if (!b) return;
      const a = b.dataset.m;
      if (a === 'close') return close();
      if (a === 'sug') {
        const lvls = {};
        MR.STRAND_ORDER.forEach(s => { const sk = P.skills[s]; if (sk.suggest) lvls[s] = Math.min(MR.nLevels(s), Math.floor(sk.lvl) + 1); });
        if (o.onSuggest) o.onSuggest(lvls); return close();
      }
      if (a === 'del') { if (o.onDelete && o.onDelete()) close(); return; }
      if (a === 'save') {
        const cfg = { sw: {}, gaze: {} };
        cfg.input = modal.querySelector('#fInput').value;
        const av = modal.querySelector('#fAns').value;
        if (av === 'choice4') { cfg.answer = 'choice'; cfg.choices = 4; } else if (av === 'choice2') { cfg.answer = 'choice'; cfg.choices = 2; } else cfg.answer = av;
        cfg.strands = [...modal.querySelectorAll('[data-strand]')].filter(x => x.checked).map(x => x.dataset.strand);
        if (!cfg.strands.length) cfg.strands = ['mengen'];
        cfg.focus = modal.querySelector('#fFocus').value;
        const kv = modal.querySelector('#fKey').value;
        if (kv === 'any') { cfg.sw.any = true; cfg.sw.keys = []; } else if (kv === 'space') { cfg.sw.any = false; cfg.sw.keys = [' ']; } else if (kv === 'enter') { cfg.sw.any = false; cfg.sw.keys = ['Enter']; }
        cfg.sw.lockMs = +modal.querySelector('#fLock').value; cfg.sw.scanMs = +modal.querySelector('#fScan').value; cfg.gaze.dwellMs = +modal.querySelector('#fDwell').value;
        cfg.theme = modal.querySelector('#fTheme').value;
        cfg.hints = modal.querySelector('#fHints').checked; cfg.speak = modal.querySelector('#fSpeak').checked; cfg.sound = modal.querySelector('#fSound').checked; cfg.screenTap = modal.querySelector('#fTap').checked;
        const lvls = {}; modal.querySelectorAll('[data-lvl]').forEach(sel => { if (sel.value) lvls[sel.dataset.lvl] = +sel.value; });
        if (o.onSave) o.onSave({ cfg, lvls }); close();
      }
    };
  }

  /* kurze Zusammenfassung der Einstellungen für Listen */
  function summary(profile) {
    if (!profile) return 'noch keine Daten';
    const c = profile.cfg || {};
    const inp = { tap: '👆 Tippen', switch: '🔘 Taster', gaze: '👁 Blick' }[c.input] || '👆 Tippen';
    const ans = c.input && c.input !== 'tap' ? '' : { auto: ' · Antwort automatisch', choice: c.choices === 2 ? ' · 2 Felder' : ' · 4 Felder', type: ' · Eintippen' }[c.answer] || '';
    return inp + ans;
  }

  MR.KidSettings = { open, summary };
})(window.MR);
