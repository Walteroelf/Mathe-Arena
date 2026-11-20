'use strict';
/*
  Lehrer-Seite (iPad, MacBook oder Windows-Rechner, nur Browser):
  - Klassenliste mit echten Namen (liegt NUR auf diesem Gerät)
  - Kopie der Lernstände aller Kinder (Hauptablage bleibt das iPad des Kindes)
  - Steuerung der Runde, Ampel, Einstellungen pro Kind, Sicherung
*/
(function () {
  const $ = s => document.querySelector(s);
  const E = MR.Engine;
  const KEY = 'mr.teacher';

  let T = MR.store.get(KEY, null);
  if (!T) T = { v: 1, pin: null, tafel: null, kids: {}, lastBackup: 0, created: Date.now(), ui: { mode: 'koop', dur: 480 } };
  T.kids = T.kids || {}; T.ui = T.ui || { mode: 'koop', dur: 480 };
  let saveTimer = null;
  function saveT() { clearTimeout(saveTimer); saveTimer = setTimeout(() => MR.store.set(KEY, T), 300); }
  function saveNow() { clearTimeout(saveTimer); MR.store.set(KEY, T); }

  let link = null, linked = false, authed = false, pairError = '';
  let live = { ph: 'lobby', mode: 'koop', dur: 480, left: 0, goal: { prog: 0, target: 0 }, players: [], unclaimed: [] };
  let liveAt = 0, tab = 'runde', unlocked = false;

  /* ---------- PIN-Sperre ---------- */
  async function checkPin(pin) { return T.pin && (await MR.sha256(T.pin.salt + pin)) === T.pin.hash; }
  async function setPin(pin) { const salt = MR.rid(12); T.pin = { salt, hash: await MR.sha256(salt + pin) }; saveNow(); }

  function showGate() {
    unlocked = false; $('#app').classList.add('hidden'); $('#gate').classList.remove('hidden');
    const g = $('#gate');
    if (T.pin) {
      g.innerHTML = `<h1>${MR.icon('lock')} Lehrer</h1><p class="muted">Bitte PIN eingeben.</p>
        <div class="row"><input id="gPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" style="font-size:1.6rem;width:8em;text-align:center"><button class="btn primary" id="gGo">Öffnen</button></div>
        <p id="gMsg" class="small" style="color:var(--bad)"></p>`;
      const go = async () => { if (await checkPin($('#gPin').value.trim())) unlock(); else { $('#gMsg').textContent = 'PIN stimmt nicht.'; $('#gPin').value = ''; } };
      $('#gGo').onclick = go; $('#gPin').onkeydown = e => { if (e.key === 'Enter') go(); };
      setTimeout(() => $('#gPin').focus(), 50);
    } else if (!T.pinAsked) {
      g.innerHTML = `<h1>Lehrer</h1><p>Hier liegen die echten Namen der Kinder. Eine PIN schützt dieses Gerät, falls es mal herumliegt.</p>
        <div class="row"><input id="gPin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN (4–6 Ziffern)" autocomplete="off" style="font-size:1.4rem;width:9em"><button class="btn primary" id="gSet">PIN festlegen</button></div>
        <p><button class="btn small" id="gSkip">Ohne PIN weiter</button></p><p id="gMsg" class="small" style="color:var(--bad)"></p>`;
      $('#gSet').onclick = async () => {
        const p = $('#gPin').value.trim();
        if (!/^\d{4,6}$/.test(p)) { $('#gMsg').textContent = 'Bitte 4 bis 6 Ziffern.'; return; }
        await setPin(p); T.pinAsked = true; saveNow(); unlock();
      };
      $('#gSkip').onclick = () => { T.pinAsked = true; saveNow(); unlock(); };
    } else unlock();
  }
  function unlock() {
    unlocked = true; $('#gate').classList.add('hidden'); $('#app').classList.remove('hidden');
    $('#selMode').value = T.ui.mode; $('#selDur').value = String(T.ui.dur); $('#selGoal').value = T.ui.view || 'piste';
    renderAll(); if (!link) pairFromHash();
  }
  $('#lockBtn').onclick = () => { if (T.pin) showGate(); else toast('Keine PIN gesetzt (Reiter Sicherung)'); };

  /* ---------- Kopplung und Verbindung ---------- */
  function parseCode(s) {
    const m = String(s || '').toUpperCase().replace(/\s/g, '').match(/^([A-Z]{4})-?([A-Z]{6})$/);
    return m ? { room: m[1], key: m[2] } : null;
  }
  function pairFromHash() {
    const k = MR.hashParams().get('k');
    if (k) {
      const c = parseCode(k);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* weiter */ }
      if (c) { T.tafel = c; saveNow(); }
    }
    if (T.tafel) connect(); else renderBar();
  }
  const tafelUrl = new URL('tafel.html' + MR.netQuery, location.href).href;
  const schuelerUrl = new URL('schueler.html' + MR.netQuery, location.href).href;
  $('#tafelUrl').textContent = tafelUrl; $('#tafelLink').href = tafelUrl;
  $('#copyUrl').onclick = async () => {
    try { await navigator.clipboard.writeText(tafelUrl); toast('Adresse kopiert'); } catch (e) { toast('Bitte die Adresse von Hand abschreiben'); }
  };
  $('#pairIn').addEventListener('input', e => {
    let v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10);
    if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });
  $('#pairIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#pairGo').click(); });
  $('#pairGo').onclick = () => {
    const c = parseCode($('#pairIn').value);
    if (!c) { $('#pairMsg').textContent = 'Der Code besteht aus 4 + 6 Buchstaben.'; return; }
    T.tafel = c; saveNow(); pairError = ''; connect();
  };
  function connect() {
    if (link) { try { link.close(); } catch (e) { /* weiter */ } }
    linked = false; authed = false;
    link = MR.joinRoom(T.tafel.room, {
      onStatus: s => { linked = s === 'open'; if (!linked) authed = false; renderBar(); renderRunde(); },
      onOpen: () => link.send({ k: 'auth', key: T.tafel.key }),
      onData: handle
    });
    renderBar();
  }
  function handle(d) {
    if (!d || typeof d !== 'object') return;
    switch (d.k) {
      case 'auth':
        authed = !!d.ok; pairError = d.ok ? '' : 'Der Kopplungscode passt nicht zur Tafel. An der Tafel im Menü einen neuen Code ablesen.';
        renderBar(); renderRunde(); break;
      case 'roster': live = d; liveAt = Date.now(); renderRunde(); if (tab === 'klasse') renderKlasse(); break;
      case 'prof': onProf(d.id, d.profile); break;
      case 'joined': onJoined(d); break;
    }
  }
  const cmd = o => { if (link && link.open && authed) link.send(Object.assign({ k: 'cmd' }, o)); };

  function kidOf(id, name) { return T.kids[id] || (T.kids[id] = { id, name: name || '', label: '', profile: null, seen: 0, pending: null }); }
  function onProf(id, p) {
    if (!p || !p.id) return;
    const k = kidOf(id, p.name);
    if (!k.profile || p.rev >= k.profile.rev) k.profile = p;
    k.name = p.name; k.seen = Date.now(); saveT();
  }
  function onJoined(d) {
    const k = kidOf(d.id, d.name); k.seen = Date.now();
    if (k.profile && k.profile.rev > d.rev) { cmd({ c: 'restore', id: d.id, profile: k.profile }); k.pending = null; }
    else if (k.pending) { cmd({ c: 'ovr', id: d.id, ovr: k.pending }); k.pending = null; }
    saveT();
  }

  /* ---------- Rundensteuerung ---------- */
  $('#selMode').onchange = () => { T.ui.mode = $('#selMode').value; saveT(); };
  $('#selDur').onchange = () => { T.ui.dur = +$('#selDur').value; saveT(); };
  $('#selGoal').onchange = () => { T.ui.view = $('#selGoal').value; saveT(); };
  $('#btnStart').onclick = () => cmd({ c: 'start', mode: $('#selMode').value, dur: +$('#selDur').value, view: $('#selGoal').value });
  $('#btnStop').onclick = () => cmd({ c: 'stop' });
  $('#btnLobby').onclick = () => cmd({ c: 'lobby' });

  function renderBar() {
    const chip = $('#chipTafel');
    if (!T.tafel) chip.innerHTML = '<span class="dot"></span> nicht gekoppelt';
    else if (authed) chip.innerHTML = '<span class="dot ok"></span> Tafel ' + MR.esc(T.tafel.room);
    else if (linked) chip.innerHTML = '<span class="dot warn"></span> prüfe Code …';
    else chip.innerHTML = '<span class="dot bad"></span> suche Tafel ' + MR.esc(T.tafel.room) + ' …';
    $('#pairCard').classList.toggle('hidden', !!authed);
    $('#pairMsg').textContent = pairError;
  }

  function ampel(p) {
    const s = p.stat || {}, off = !p.online;
    if (off) return { c: 'off', t: 'offline', dot: '' };
    if (s.help) return { c: 'red', t: 'Hilfe angefordert', dot: 'bad' };
    const slow = s.input && s.input !== 'tap';
    if (s.phase === 'run' && s.idle > (slow ? 150000 : 90000)) return { c: 'yellow', t: 'keine Aktion seit ' + Math.round(s.idle / 1000) + ' s', dot: 'warn' };
    if (s.phase === 'run' && s.errRun >= 3) return { c: 'yellow', t: 'mehrere Fehler in Folge', dot: 'warn' };
    const k = T.kids[p.id]; const sug = k && k.profile && E.levelSummary(k.profile).some(x => x.suggest);
    if (sug) return { c: 'blue', t: 'Stufe 0: Aufstieg vorgeschlagen', dot: 'blue' };
    if (s.phase === 'run' && s.streak >= 7) return { c: 'blue', t: 'vielleicht unterfordert', dot: 'blue' };
    return { c: 'green', t: s.phase === 'run' ? 'läuft' : 'bereit', dot: 'ok' };
  }
  const nameOf = id => { const k = T.kids[id]; return k && k.label ? k.label : ''; };

  function renderRunde() {
    if (!unlocked) return;
    const phaseNames = { lobby: 'Lobby', run: 'Runde läuft', wrap: 'Letzte Aufgaben', end: 'Runde zu Ende' };
    const g = live.goal || {};
    let line = authed ? (phaseNames[live.ph] || live.ph) : 'Zuerst mit der Tafel verbinden (siehe oben).';
    if (authed && live.ph === 'run') line += ' · noch ' + MR.fmtTime(live.left - (Date.now() - liveAt)) + (live.mode === 'koop' && g.target ? ' · Klassenziel ' + Math.round(g.prog / g.target * 100) + ' %' : '');
    $('#phaseLine').textContent = line;
    ['btnStart', 'btnStop', 'btnLobby'].forEach(id => { $('#' + id).disabled = !authed; });
    if (!authed) { $('#liveBox').innerHTML = ''; return; }
    const ae = document.activeElement;
    if (ae && ae.tagName === 'SELECT' && $('#liveBox').contains(ae)) return;   // Auswahl nicht wegnehmen
    const order = { red: 0, yellow: 1, blue: 2, green: 3, off: 4 };
    const list = live.players.map(p => ({ p, a: ampel(p) })).sort((x, y) => order[x.a.c] - order[y.a.c] || x.p.name.localeCompare(y.p.name));
    let h = '';
    if (live.unclaimed && live.unclaimed.length) {
      const opts = Object.values(T.kids).filter(k => k.profile).sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name))
        .map(k => `<option value="${k.id}">${MR.esc(k.label ? k.label + ' (' + k.name + ')' : k.name)}</option>`).join('');
      h += `<div class="card"><h3>Neue iPads warten auf ein Profil</h3>${live.unclaimed.map(u => `<div class="row" style="margin:6px 0"><span>iPad ${MR.esc(u.tmp)}</span><select data-claim-sel="${u.tmp}">${opts}</select><button class="btn small primary" data-claim="${u.tmp}">Profil senden</button></div>`).join('')}</div>`;
    }
    h += '<div class="kids">' + list.map(({ p, a }) => {
      const k = T.kids[p.id], lv = k && k.profile ? E.levelSummary(k.profile).map(x => `<span>${x.short} ${x.level}</span>`).join('') : '';
      const lbl = nameOf(p.id), s = p.stat || {};
      return `<div class="kid ${a.c}"><div class="nm"><span class="dot ${a.dot}"></span>${MR.esc(lbl || p.name)} ${lbl ? `<span class="muted small">${MR.esc(p.name)}</span>` : ''}</div>
        <div class="tk">${MR.esc(s.task || '–')}</div>
        <div class="small muted">${MR.esc(a.t)} · Serie ${p.streak || 0} · ${p.pts} P. · ${p.ok}/${p.tot} richtig</div>
        <div class="lv">${lv}</div>
        <div class="row"><button class="btn small" data-kid="${p.id}">${MR.icon('gear')} Einstellungen</button><button class="btn small" data-hint="${p.id}">${MR.icon('bulb')} Hilfe zeigen</button></div></div>`;
    }).join('') + '</div>';
    if (!list.length) h += `<div class="card"><h3 style="margin-top:0">Kinder verbinden</h3><p>Noch keine iPads verbunden. Die Kinder öffnen auf dem iPad <code>${MR.esc(schuelerUrl)}</code> und scannen den QR-Code an der Tafel (oder tippen den 4-stelligen Code ein). Ab dem zweiten Mal verbindet sich das iPad von selbst.</p></div>`;
    $('#liveBox').innerHTML = h;
  }
  $('#liveBox').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.kid) openKid(b.dataset.kid);
    else if (b.dataset.hint) cmd({ c: 'hint', id: b.dataset.hint });
    else if (b.dataset.claim) {
      const sel = $(`[data-claim-sel="${b.dataset.claim}"]`), k = T.kids[sel && sel.value];
      if (k && k.profile) { cmd({ c: 'claim', tmp: b.dataset.claim, profile: k.profile }); toast('Profil gesendet'); }
    }
  });
  setInterval(() => { if (unlocked && tab === 'runde') renderRunde(); }, 1000);

  /* ---------- Klasse ---------- */
  function renderKlasse(force) {
    const kids = Object.values(T.kids).sort((a, b) => (a.label || a.name).localeCompare(b.label || b.name));
    const onl = new Set((live.players || []).filter(p => p.online).map(p => p.id));
    const html = `<div class="card"><h3>Klasse (${kids.length})</h3>
      <p class="muted small">Die Namen stehen nur auf diesem Gerät. Auf der Tafel und den iPads erscheinen nur die Pseudonyme.</p>
      <div style="overflow:auto"><table class="tbl"><tr><th>Name</th><th>Pseudonym</th><th>Stufen</th><th>Auffällig</th><th>Zuletzt</th><th></th></tr>
      ${kids.map(k => {
        const lv = k.profile ? E.levelSummary(k.profile).map(x => `<span title="${MR.esc(x.label)}">${x.short} ${x.level}</span>`).join('') : '–';
        const te = k.profile ? E.topError(k.profile) : null;
        return `<tr><td><input data-label="${k.id}" value="${MR.esc(k.label)}" placeholder="Name eintragen" style="width:11em"></td>
          <td>${onl.has(k.id) ? '<span class="dot ok"></span> ' : ''}${MR.esc(k.name)}</td><td><div class="lv">${lv}</div></td>
          <td class="small">${te ? MR.esc(E.TAG_NAMES[te.tag] || te.tag) : ''}</td><td class="small">${MR.fmtDate(k.seen)}</td>
          <td><button class="btn small" data-kid="${k.id}" aria-label="Einstellungen">${MR.icon('gear')}</button></td></tr>`;
      }).join('')}</table></div>
      ${kids.length ? '' : '<p class="muted">Sobald sich ein iPad verbindet, erscheint hier das Kind.</p>'}</div>`;
    // Nicht neu zeichnen, solange jemand tippt oder nichts neu ist (sonst springt die Eingabe weg)
    const box = $('#tab-klasse'), ae = document.activeElement;
    if (!force && ae && box.contains(ae) && ae.tagName === 'INPUT') return;
    if (box.dataset.sig === html) return;
    box.dataset.sig = html; box.innerHTML = html;
  }
  $('#tab-klasse').addEventListener('input', e => {
    const id = e.target.dataset && e.target.dataset.label; if (!id || !T.kids[id]) return;
    T.kids[id].label = e.target.value.trim(); saveT();
  });
  $('#tab-klasse').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.kid) openKid(b.dataset.kid); });

  /* ---------- Einstellungen pro Kind ---------- */
  function mergeOvr(a, b) {
    a = a || {}; const o = { cfg: Object.assign({}, a.cfg), lvls: Object.assign({}, a.lvls) };
    const c = b.cfg || {};
    Object.keys(c).forEach(key => { if ((key === 'sw' || key === 'gaze') && typeof c[key] === 'object') o.cfg[key] = Object.assign({}, o.cfg[key], c[key]); else o.cfg[key] = c[key]; });
    Object.assign(o.lvls, b.lvls || {});
    return o;
  }
  function sendOvr(id, ovr) {
    const k = kidOf(id); if (k.profile) E.applyOvr(k.profile, ovr, true);
    const p = (live.players || []).find(x => x.id === id);
    if (p && p.online && authed) cmd({ c: 'ovr', id, ovr }); else k.pending = mergeOvr(k.pending, ovr);
    saveT();
  }
  function openKid(id) {
    const k = T.kids[id]; if (!k) return;
    MR.KidSettings.open($('#modal'), {
      name: k.name, label: k.label, profile: k.profile,
      noProfileText: 'Von diesem Kind liegt noch kein Stand vor. Die Einstellungen werden beim nächsten Verbinden übernommen.',
      onSave: ovr => { sendOvr(id, ovr); toast('Gespeichert'); renderAll(); },
      onSuggest: lvls => { sendOvr(id, { lvls }); toast('Stufe angepasst'); },
      onDelete: () => {
        if (!confirm('Dieses Kind aus der Klasse auf diesem Gerät entfernen? Das iPad behält seinen Stand.')) return false;
        delete T.kids[id]; saveNow(); renderAll(); return true;
      }
    });
  }

  /* ---------- Sicherung ---------- */
  const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pw, salt) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(text, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(pw, salt), new TextEncoder().encode(text)));
    return JSON.stringify({ typ: 'mathe-arena-sicherung', v: 1, enc: true, salt: b64(salt), iv: b64(iv), data: b64(ct) });
  }
  async function decrypt(obj, pw) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) }, await deriveKey(pw, unb64(obj.salt)), unb64(obj.data));
    return new TextDecoder().decode(pt);
  }
  function backupInfo() {
    const n = Object.keys(T.kids).length;
    $('#backInfo').innerHTML = `Diese Klasse liegt auf <b>diesem Gerät</b>: ${n} ${n === 1 ? 'Kind' : 'Kinder'}. Letzte Sicherung: <b>${T.lastBackup ? MR.fmtDate(T.lastBackup) : 'noch nie'}</b>.`;
  }
  $('#backExport').onclick = async () => {
    const pw = $('#backPw').value;
    const payload = JSON.stringify({ typ: 'mathe-arena-klasse', v: 1, created: Date.now(), kids: T.kids });
    let out;
    if (pw) {
      if (!(window.crypto && crypto.subtle)) { toast('Verschlüsselung geht in diesem Browser nicht (nur über https)'); return; }
      out = await encrypt(payload, pw);
    } else {
      if (!confirm('Ohne Passwort enthält die Datei die echten Namen im Klartext. Trotzdem speichern?')) return;
      out = JSON.stringify({ typ: 'mathe-arena-sicherung', v: 1, enc: false, payload: JSON.parse(payload) });
    }
    MR.download('mathe-arena-sicherung-' + new Date().toISOString().slice(0, 10) + '.json', out);
    T.lastBackup = Date.now(); saveNow(); backupInfo(); renderBanner();
  };
  $('#backImport').onclick = async () => {
    const f = $('#impFile').files[0], msg = $('#impMsg'); msg.style.color = '';
    if (!f) { msg.textContent = 'Bitte eine Datei wählen.'; return; }
    try {
      let obj = JSON.parse(await f.text()), payload;
      if (obj.typ !== 'mathe-arena-sicherung') throw new Error('Das ist keine Mathe-Arena-Sicherung.');
      if (obj.enc) payload = JSON.parse(await decrypt(obj, $('#impPw').value)); else payload = obj.payload;
      let n = 0, upd = 0;
      Object.keys(payload.kids || {}).forEach(id => {
        const b = payload.kids[id], k = T.kids[id];
        if (!k) { T.kids[id] = b; n++; return; }
        if (b.profile && (!k.profile || b.profile.rev > k.profile.rev)) { k.profile = b.profile; upd++; }
        if (!k.label && b.label) k.label = b.label;
      });
      saveNow(); msg.textContent = `Fertig: ${n} neue Kinder, ${upd} Stände aktualisiert.`; renderAll();
    } catch (e) { msg.style.color = 'var(--bad)'; msg.textContent = 'Das hat nicht geklappt: ' + (e && e.name === 'OperationError' ? 'Passwort falsch.' : (e.message || e)); }
  };
  $('#setPin').onclick = async () => {
    const p = $('#newPin').value.trim(); if (!/^\d{4,6}$/.test(p)) { toast('Bitte 4 bis 6 Ziffern'); return; }
    await setPin(p); $('#newPin').value = ''; toast('PIN gesetzt');
  };
  $('#noPin').onclick = () => { T.pin = null; saveNow(); toast('PIN entfernt'); };

  function renderBanner() {
    const n = Object.keys(T.kids).length, old = T.lastBackup ? (Date.now() - T.lastBackup) / 86400000 : 999;
    $('#bannerBox').innerHTML = n && old > 14 ? `<div class="banner">${T.lastBackup ? 'Die letzte Sicherung ist ' + Math.floor(old) + ' Tage alt.' : 'Es gibt noch keine Sicherung.'} Die echten Namen liegen nur auf diesem Gerät. <a href="#" id="goBack">Jetzt sichern</a></div>` : '';
    const g = $('#goBack'); if (g) g.onclick = ev => { ev.preventDefault(); setTab('sicherung'); };
  }

  /* ---------- Reiter, Toast ---------- */
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    ['runde', 'klasse', 'sicherung', 'hilfe'].forEach(x => $('#tab-' + x).classList.toggle('hidden', x !== t));
    if (t === 'klasse') renderKlasse(true); if (t === 'sicherung') backupInfo(); if (t === 'runde') renderRunde();
  }
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });
  let toastT = null;
  function toast(msg) {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.style.cssText = 'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);background:var(--panel2);border:2px solid var(--line);padding:10px 18px;border-radius:999px;z-index:60;font-weight:600'; document.body.appendChild(el); }
    el.textContent = msg; el.style.display = '';
    clearTimeout(toastT); toastT = setTimeout(() => { el.style.display = 'none'; }, 2400);
  }
  function renderAll() { renderBar(); renderBanner(); renderRunde(); if (tab === 'klasse') renderKlasse(); if (tab === 'sicherung') backupInfo(); }

  addEventListener('beforeunload', saveNow);
  window.MRTeacher = { get T() { return T; }, get live() { return live; } };   // für Tests
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  showGate();
})();
