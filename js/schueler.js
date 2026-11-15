'use strict';
/* Schüler-Seite (iPad): Profil, Aufgaben, Eingabearten, Verbindung zur Tafel */
(function () {
  const $ = s => document.querySelector(s);
  const E = MR.Engine, Sw = MR.Input.Sw, Scanner = MR.Input.Scanner, Dwell = MR.Input.Dwell;

  let P = null;                       // Lernprofil (liegt auf diesem iPad)
  let link = null, room = '', linkOpen = false, waitRestore = false;
  const sess = newSess();
  let task = null, locked = true, cleanup = [], lastAction = performance.now(), helpFlag = false, sinceProf = 0;
  let settingsOpen = false, nameTheme = 'jugend', toastT = null;

  function newSess() {
    return { phase: 'idle', endsAt: 0, totalMs: 0, count: 0, ok: 0, tot: 0, ups: 0, upNames: [], pts: 0, streak: 0, best: 0, s0: 0, lastStrand: '', sameRun: 0, solo: false, timeUp: false, mode: 'koop' };
  }

  /* ---------- Ton, Sprache ---------- */
  let actx = null;
  function unlock() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* kein Ton */ } }
  function tone(f, d, type, v, when) {
    if (!P || !P.cfg.sound || !actx) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + (when || 0);
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
    } catch (e) { /* weiter */ }
  }
  const sfx = {
    ok() { tone(660, .12); tone(880, .18, 'sine', .12, .1); },
    bad() { tone(240, .22, 'triangle', .08); },
    pop() { tone(500 + Math.random() * 300, .16, 'sine', .14); },
    go() { tone(880, .25, 'triangle', .14); },
    up() { tone(523, .12); tone(659, .12, 'sine', .12, .12); tone(784, .22, 'sine', .12, .24); }
  };
  function speak(text) {
    try {
      if (!window.speechSynthesis || !text) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; u.rate = 0.9; speechSynthesis.speak(u);
    } catch (e) { /* weiter */ }
  }
  addEventListener('pointerdown', unlock, { passive: true });
  addEventListener('keydown', unlock);

  /* ---------- Profil ---------- */
  function save() { MR.store.set('mr.profile', P); }
  function applyTheme() {
    const th = (P && P.cfg.theme) || nameTheme;
    document.body.className = 'student theme-' + th;
  }
  function updateTop() {
    $('#tbName').textContent = P ? P.name : 'Mathe-Arena';
    $('#tbPts').textContent = P && sess.phase === 'run' && sess.mode !== 'ohne' ? sess.pts + ' P.' : '';
    $('#tbConn').textContent = link ? (linkOpen ? '● Tafel' : '○ verbinde …') : '';
  }
  Sw.cfgFn = () => P && P.cfg;

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  }

  /* ---------- Start ---------- */
  function boot() {
    P = MR.store.get('mr.profile', null);
    if (P) P = E.ensure(P);
    const hr = (MR.hashParams().get('r') || '').toUpperCase();
    if (hr) MR.store.set('mr.room', hr);
    room = hr || MR.store.get('mr.room', '');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    applyTheme(); updateTop();
    if (!P) { renderSetup(); show('scSetup'); return; }
    afterProfile();
    if (P.stats.tot === 0 && !MR.store.get('mr.saw', false)) { /* erster Start */ }
  }
  function afterProfile() {
    applyTheme(); updateTop();
    if (room) { connect(); showLobby(); } else show('scRoom');
  }

  /* ---------- Einrichtung: Name wählen ---------- */
  function renderSetup() {
    $('#themeSeg').innerHTML = Object.keys(MR.THEMES).map(k => `<button data-t="${k}" class="${k === nameTheme ? 'on' : ''}">${MR.THEMES[k].label}</button>`).join('');
    const names = MR.suggestNames(nameTheme, 6);
    $('#nameGrid').innerHTML = names.map(n => `<button class="btn" data-n="${MR.esc(n)}">${MR.esc(n)}</button>`).join('');
    document.body.className = 'student theme-' + nameTheme;
  }
  $('#themeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; nameTheme = b.dataset.t; renderSetup(); });
  $('#moreNames').addEventListener('click', renderSetup);
  $('#nameGrid').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    P = E.newProfile(b.dataset.n, nameTheme); save();
    afterProfile();
  });
  $('#restoreBtn').addEventListener('click', () => {
    waitRestore = true;
    if (room) { connect(); showLobby(); } else show('scRoom');
  });

  /* ---------- Raum ---------- */
  $('#roomGo').addEventListener('click', () => {
    const c = $('#roomIn').value.trim().toUpperCase(); if (c.length < 4) return;
    room = c; MR.store.set('mr.room', room); connect();
    if (P) showLobby(); else showLobby();
  });
  $('#roomIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('#roomGo').click(); });
  $('#soloGo').addEventListener('click', () => { if (!P) { renderSetup(); show('scSetup'); } else startRun(true); });
  $('#lobSolo').addEventListener('click', () => { if (P) startRun(true); });
  $('#lobRoom').addEventListener('click', () => { show('scRoom'); });

  function connect() {
    if (link) { try { link.close(); } catch (e) { /* weiter */ } link = null; linkOpen = false; }
    if (!room) return;
    link = MR.joinRoom(room, {
      onStatus: s => { linkOpen = s === 'open'; updateTop(); if (!settingsOpen) refreshLobby(); },
      onOpen: () => { sendJoin(); },
      onData: handle
    });
  }
  function sendJoin() {
    if (!link || !link.open) return;
    if (!P) { link.send({ k: 'join', fresh: true }); return; }
    link.send({ k: 'join', id: P.id, name: P.name, rev: P.rev, theme: P.cfg.theme });
    sendProf();
  }
  function sendProf() { if (link && link.open && P) link.send({ k: 'prof', id: P.id, profile: P }); }
  function sendStat() {
    if (!link || !link.open || !P) return;
    link.send({
      k: 'stat', id: P.id, phase: sess.phase, input: P.cfg.input,
      task: task ? (task.strand === 's0' ? 'Stufe 0' : (task.strand === 'mengen' ? 'Menge' : task.q)) : '',
      strand: task ? task.strand : '', level: task ? task.level : 0,
      streak: sess.streak, errRun: task ? (P.skills[task.strand] || {}).errRun || 0 : 0,
      idle: Math.round(performance.now() - lastAction), help: helpFlag, pts: sess.pts, ok: sess.ok, tot: sess.tot
    });
  }
  setInterval(sendStat, 2000);

  /* ---------- Nachrichten von der Tafel ---------- */
  function handle(d) {
    if (!d || typeof d !== 'object') return;
    switch (d.k) {
      case 'welcome': case 'ph': onPhase(d); break;
      case 'ovr': applyOvr(d.ovr); break;
      case 'hint': if (task && task.strand !== 's0') showHintBox(); break;
      case 'restore': restoreProfile(d.profile); break;
    }
  }
  function onPhase(d) {
    if (d.mode) sess.mode = d.mode;
    if (!P) return;
    if (d.ph === 'run') {
      sess.endsAt = performance.now() + (d.left || 0);
      sess.totalMs = d.dur || d.left || 1;
      if (sess.phase !== 'run' && !settingsOpen) startRun(false);
      else if (sess.phase === 'run' && sess.solo) { /* Solo läuft weiter */ }
    } else if (d.ph === 'lobby') {
      if (sess.phase === 'run' && !sess.solo) endRun();
      if (sess.phase !== 'run') { sess.phase = 'lobby'; if (!settingsOpen && $('#scEnd').classList.contains('on') === false) showLobby(); }
    } else if (d.ph === 'end') {
      if (sess.phase === 'run' && !sess.solo) endRun();
    }
    updateTop();
  }
  function applyOvr(o) {
    if (!P || !o) return;
    E.applyOvr(P, o); save(); applyTheme(); sendProf();
    const c = o.cfg || {};
    if (task && !locked && (c.input || c.answer || c.choices || c.sw || c.gaze || c.screenTap)) renderTask(task, true);
    toast('Einstellungen von der Lehrkraft übernommen');
  }
  function restoreProfile(p) {
    if (!p || !p.id) return;
    P = E.ensure(p); save(); waitRestore = false;
    applyTheme(); updateTop(); sendJoin(); toast('Dein Profil wurde wiederhergestellt');
    showLobby();
  }

  /* ---------- Lobby ---------- */
  function showLobby() {
    sess.phase = sess.phase === 'run' ? sess.phase : 'lobby';
    show('scLobby'); refreshLobby();
  }
  function refreshLobby() {
    if (!$('#scLobby').classList.contains('on')) return;
    $('#lobHello').textContent = P ? 'Hallo ' + P.name : 'Profil wird geholt …';
    let t;
    if (waitRestore && !P) t = linkOpen ? 'Warte auf die Lehrkraft. Sie stellt dein Profil wieder her.' : 'Verbinde mit der Tafel …';
    else if (linkOpen) t = 'Verbunden. Gleich geht es los.';
    else if (room) t = 'Verbinde mit der Tafel … (Raum ' + room + ')';
    else t = 'Nicht verbunden.';
    $('#lobStatus').textContent = t;
    $('#lobSolo').style.display = P ? '' : 'none';
  }

  /* ---------- Runde ---------- */
  function startRun(solo) {
    runCleanup();
    const e = sess.endsAt, tm = sess.totalMs;
    Object.assign(sess, newSess(), { phase: 'run', solo: !!solo, mode: sess.mode, endsAt: solo ? 0 : e, totalMs: solo ? 0 : tm });
    show('scPlay'); updateTop(); nextTask();
  }
  function afterTask(delay) {
    setTimeout(() => {
      if (sess.phase !== 'run') return;
      if (sess.timeUp || (sess.solo && sess.tot >= 12)) endRun(); else nextTask();
    }, delay);
  }
  function nextTask() {
    if (sess.phase !== 'run') return;
    renderTask(E.chooseNext(P, sess));
  }
  function endRun() {
    if (sess.phase !== 'run') return;
    runCleanup(); locked = true; task = null;
    const wasSolo = sess.solo; sess.phase = 'end';
    if (sess.tot > 0) {
      P.stats.rounds++;
      P.history.push({ ts: Date.now(), ok: sess.ok, tot: sess.tot, ups: sess.ups, pts: sess.pts, best: sess.best, solo: wasSolo });
      if (P.history.length > 40) P.history.shift();
      P.rev++; save();
    }
    if (link && link.open) link.send({ k: 'done', id: P.id, sum: { ok: sess.ok, tot: sess.tot, ups: sess.ups, best: sess.best, pts: sess.pts } });
    sendProf();
    const lines = [];
    if (sess.tot === 0) lines.push('Diesmal gab es keine Aufgaben.');
    else if (sess.s0 > 0 && sess.s0 === sess.tot) lines.push('Du hast <b>' + sess.tot + '</b> Mal mitgemacht. Stark!');
    else lines.push('<b>' + sess.ok + '</b> richtige Antworten');
    if (sess.best >= 3) lines.push('Beste Serie: <b>' + sess.best + '</b>');
    if (sess.ups) lines.push('Aufstieg: ' + sess.upNames.map(MR.esc).join(', '));
    if (!wasSolo && sess.mode !== 'ohne') lines.push('<span class="muted">' + sess.pts + ' Punkte</span>');
    $('#endText').innerHTML = lines.join('<br>');
    show('scEnd'); updateTop(); $('#timebar').style.display = 'none';
  }
  $('#endOk').addEventListener('click', () => { sess.phase = 'lobby'; showLobby(); });

  /* ---------- Zeit ---------- */
  setInterval(() => {
    const bar = $('#timebar');
    if (sess.phase === 'run' && !sess.solo && sess.endsAt) {
      const left = sess.endsAt - performance.now();
      bar.style.display = '';
      $('#timefill').style.width = Math.max(0, Math.min(100, left / (sess.totalMs || left) * 100)) + '%';
      if (left <= 0 && !sess.timeUp) { sess.timeUp = true; if (locked && !task) { /* nichts offen */ } }
    } else bar.style.display = 'none';
  }, 250);

  /* ---------- Aufgaben anzeigen ---------- */
  function runCleanup() { cleanup.forEach(f => { try { f(); } catch (e) { /* weiter */ } }); cleanup = []; Sw.handlers.select = null; Sw.handlers.next = null; }
  function toast(msg) {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:var(--panel2);border:2px solid var(--line);padding:10px 18px;border-radius:999px;z-index:60;font-weight:600'; document.body.appendChild(el); }
    el.textContent = msg; el.style.display = '';
    clearTimeout(toastT); toastT = setTimeout(() => { el.style.display = 'none'; }, 2600);
  }

  function renderTask(t, keepT0) {
    runCleanup();
    task = t; if (!keepT0 || !t.t0) t.t0 = performance.now();
    locked = false; lastAction = performance.now();
    const st = $('#stage'); st.className = 'stage';
    if (t.strand === 's0') { renderS0(t); buildBottom(); return; }
    t.mode = E.answerMode(P, t, false);
    const vis = t.strand === 'mengen' ? MR.dotsSVG(t.visual.n, t.visual.layout, t.visual.pos) : '';
    const qtxt = t.strand === 'mengen' ? 'Wie viele?' : MR.esc(t.q) + ' = ?';
    st.innerHTML = `<div class="qwrap"><div class="visual">${vis}</div><div class="q">${qtxt}</div><div class="hintBox" id="hintBox"></div></div><div id="ans"></div>`;
    if (t.hinted) showHintBox();
    if (t.mode === 'choice') renderChoice(t); else renderPad(t);
    if (P.cfg.speak) speak(t.speak);
    buildBottom();
  }

  function bindOptions(els, onPick) {
    const cfg = P.cfg;
    if (cfg.input === 'switch') {
      const sc = new Scanner(els, i => { onPick(i); if (!locked) sc.start(); }, cfg.sw);
      sc.start(); cleanup.push(() => sc.stop());
      if (cfg.screenTap) els.forEach((el, i) => el.addEventListener('click', () => { if (!locked) { sc.stop(); onPick(i); if (!locked) sc.start(); } }));
      return;
    }
    els.forEach((el, i) => el.addEventListener('click', () => onPick(i)));
    if (cfg.input === 'gaze') els.forEach((el, i) => cleanup.push(Dwell.attach(el, () => onPick(i), { ms: cfg.gaze.dwellMs })));
  }

  function renderChoice(t) {
    const n = P.cfg.choices === 2 ? 2 : 4;
    if (!t.choiceVals || t.choiceVals.length !== n) t.choiceVals = MR.makeChoices(t, n);
    const ans = $('#ans');
    ans.innerHTML = `<div class="opts n${n}">${t.choiceVals.map((v, i) => `<button class="opt" data-i="${i}">${v}</button>`).join('')}</div>`;
    const els = [...ans.querySelectorAll('.opt')]; t.els = els;
    bindOptions(els, i => submit(t.choiceVals[i], els[i]));
  }

  function renderPad(t) {
    const ans = $('#ans'); let val = '';
    ans.innerHTML = `<div class="pad"><div class="padval" id="padval">&nbsp;</div><div class="padgrid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button data-d="${d}">${d}</button>`).join('')}<button data-d="del">⌫</button><button data-d="0">0</button><button class="go" data-d="ok">✓</button></div></div>`;
    const pv = $('#padval');
    ans.querySelector('.padgrid').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || locked) return;
      const d = b.dataset.d;
      if (d === 'del') val = val.slice(0, -1);
      else if (d === 'ok') { if (val !== '') submit(parseInt(val, 10), null); return; }
      else if (val.length < 4) val += d;
      pv.textContent = val || ' ';
    });
  }

  function submit(val, el) {
    if (locked || !task) return;
    locked = true; lastAction = performance.now(); helpFlag = false;
    const t = task, ms = performance.now() - t.t0, ok = val === t.answer;
    const timeless = P.cfg.input !== 'tap';
    const res = E.record(P, t, { ok, ms: timeless ? 0 : ms, hinted: !!t.hinted, guess: !timeless && t.mode === 'choice' && !ok && ms < 600, streak: ok ? sess.streak + 1 : 0 });
    if (t.mode === 'choice' && t.els) {
      t.els.forEach((b, i) => { if (t.choiceVals[i] === t.answer) b.classList.add('right'); });
      if (!ok && el) el.classList.add('wrong');
    } else {
      const pv = $('#padval'); if (pv) pv.textContent = ok ? String(val) : val + ' → ' + t.answer;
    }
    finishTask(t, res, ok);
  }

  function finishTask(t, res, ok) {
    sess.tot++;
    if (t.strand === 's0') sess.s0++;
    if (ok) { sess.ok++; sess.streak++; sess.best = Math.max(sess.best, sess.streak); } else sess.streak = 0;
    sess.pts += res.pts;
    if (res.up) { sess.ups++; sess.upNames.push(res.upLabel); }
    save(); updateTop();
    const st = $('#stage'); st.classList.remove('flashOk', 'flashBad'); void st.offsetWidth; st.classList.add(ok ? 'flashOk' : 'flashBad');
    if (ok) sfx.ok(); else sfx.bad();
    if (res.up) { showUp(res.upLabel); setTimeout(sfx.up, 400); }
    if (link && link.open) link.send({ k: 'ev', id: P.id, ok, strand: t.strand, level: t.level, pts: res.pts, up: res.up, streak: sess.streak });
    if (++sinceProf >= 5) { sinceProf = 0; sendProf(); }
    afterTask(t.strand === 's0' ? 1700 : (ok ? 900 : 2200) + (res.up ? 900 : 0));
  }
  function showUp(label) {
    const b = document.createElement('div'); b.className = 'upBanner'; b.textContent = '⬆ Aufstieg: ' + label;
    $('#stage').appendChild(b); setTimeout(() => b.remove(), 2400);
  }

  function showHintBox() {
    if (!task || task.strand === 's0') return;
    task.hinted = true;
    const hb = $('#hintBox'); if (hb) hb.innerHTML = MR.hintHTML(task);
  }

  function buildBottom() {
    const b = $('#bottombar'); const tap = P.cfg.input === 'tap';
    if (!tap) { b.innerHTML = ''; return; }
    let h = '';
    if (P.cfg.hints && task && task.strand !== 's0') h += '<button class="btn" id="bHint">💡 Hilfe</button>';
    h += '<button class="btn" id="bHelp">✋ Lehrkraft</button>';
    if (sess.solo) h += '<button class="btn" id="bDone">Fertig</button>';
    b.innerHTML = h;
    const q = id => b.querySelector(id);
    if (q('#bHint')) q('#bHint').onclick = () => { showHintBox(); lastAction = performance.now(); };
    q('#bHelp').onclick = () => { helpFlag = true; sendStat(); toast('Die Lehrkraft weiß Bescheid'); };
    if (q('#bDone')) q('#bDone').onclick = () => endRun();
  }

  /* ---------- Stufe 0: Ursache-Wirkung ---------- */
  function burst(host) {
    if (!host) return;
    host.style.position = host.style.position || 'relative';
    const r = host.getBoundingClientRect();
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('span'); p.className = 'particle';
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * Math.min(160, r.width / 2);
      p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d + 'px');
      p.style.left = r.width / 2 + 'px'; p.style.top = r.height / 2 + 'px';
      p.style.background = ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#e599f7'][i % 5];
      host.appendChild(p); setTimeout(() => p.remove(), 950);
    }
  }
  function bindPress(press, tgt) {
    const cfg = P.cfg, area = $('#stage');
    if (cfg.input === 'gaze') {
      cleanup.push(Dwell.attach(tgt, press, { ms: cfg.gaze.dwellMs, repeat: true }));
      tgt.addEventListener('click', press);
    } else if (cfg.input === 'switch') {
      Sw.handlers.select = press; cleanup.push(() => { Sw.handlers.select = null; });
      if (cfg.screenTap) { area.addEventListener('pointerdown', press); cleanup.push(() => area.removeEventListener('pointerdown', press)); }
    } else {
      area.addEventListener('pointerdown', press); cleanup.push(() => area.removeEventListener('pointerdown', press));
    }
  }
  const PRAISE = ['Super!', 'Geschafft!', 'Stark!', 'Genau!', 'Toll!'];
  function completeS0(t) {
    if (locked) return; locked = true; lastAction = performance.now();
    const res = E.record(P, t, { ok: true, first: t.first !== false });
    const say = $('#say'); if (say) say.textContent = MR.pick(PRAISE);
    finishTask(t, res, true);
  }
  function renderS0(t) {
    const cfg = P.cfg, st = $('#stage');
    const word = cfg.input === 'switch' ? 'Taster' : (cfg.input === 'gaze' ? 'Hierher schauen' : 'Tippen');
    let inner = `<div class="say" id="say">${MR.esc(t.q)}</div>`;
    if (t.kind === 'count') inner += `<div class="numBig">${t.n}</div><div class="slots" id="slots">${'<div class="slot"></div>'.repeat(t.n)}</div>`;
    if (t.kind === 'choose2') inner += `<div class="opts n2" id="opts2" style="width:100%;flex:0 0 42vh">${t.shapes.map(s => `<button class="opt">${MR.shapeSVG(s)}</button>`).join('')}</div>`;
    else inner += `<button class="bigTarget${t.kind === 'react' ? ' calm' : ''}" id="tgt" ${t.kind === 'count' ? 'style="width:min(36vw,26vh)"' : ''}><span id="tgtL">${t.kind === 'react' ? '…' : word}</span></button>`;
    st.innerHTML = `<div class="s0">${inner}</div>`;
    if (cfg.speak) speak(t.speak);
    const tgt = $('#tgt');
    if (t.kind === 'fx') {
      bindPress(() => { if (locked) return; burst(tgt); sfx.pop(); completeS0(t); }, tgt);
    } else if (t.kind === 'react') {
      let armed = false;
      const id = setTimeout(() => { armed = true; tgt.classList.remove('calm'); tgt.classList.add('go'); $('#tgtL').textContent = 'Jetzt!'; sfx.go(); }, t.delay);
      cleanup.push(() => clearTimeout(id));
      bindPress(() => { if (locked || !armed) return; burst(tgt); sfx.pop(); completeS0(t); }, tgt);
    } else if (t.kind === 'count') {
      let c = 0; const slots = [...document.querySelectorAll('.slot')];
      bindPress(() => {
        if (locked || c >= t.n) return;
        slots[c].classList.add('f'); c++; burst(tgt); sfx.pop(); lastAction = performance.now();
        if (c === t.n) completeS0(t);
      }, tgt);
    } else if (t.kind === 'choose2') {
      const els = [...document.querySelectorAll('#opts2 .opt')];
      bindOptions(els, i => {
        if (locked) return;
        if (i === t.target) { els[i].classList.add('right'); sfx.pop(); completeS0(t); }
        else { t.first = false; sfx.bad(); els[i].style.opacity = .35; lastAction = performance.now(); }
      });
    }
  }

  /* ---------- Einstellungen (1 Sekunde auf ⚙ halten) ---------- */
  let gearT = null;
  const gear = $('#gearBtn');
  gear.addEventListener('pointerdown', () => { clearTimeout(gearT); gearT = setTimeout(openSettings, 900); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => gear.addEventListener(ev, () => clearTimeout(gearT)));
  gear.addEventListener('keydown', e => { if (e.key === 'Enter') openSettings(); });

  function openSettings() {
    if (!P) return;
    settingsOpen = true; runCleanup();
    $('#settings').classList.remove('hidden'); renderSettings();
    Sw.testCb = testKey;
  }
  function closeSettings() {
    settingsOpen = false; Sw.testCb = null; Sw.learning = null;
    $('#settings').classList.add('hidden');
    P.rev++; save(); sendProf(); applyTheme();
    if (task && !locked && sess.phase === 'run') renderTask(task, true);
    else if (sess.phase === 'run') nextTask();
    else if ($('#scLobby').classList.contains('on')) refreshLobby();
  }
  function seg(name, val, opts) {
    return `<div class="seg">${opts.map(o => `<button data-act="${name}" data-v="${o[0]}" class="${String(val) === String(o[0]) ? 'on' : ''}">${o[1]}</button>`).join('')}</div>`;
  }
  function sel(name, val, opts) {
    return `<select data-sel="${name}">${opts.map(o => `<option value="${o[0]}" ${String(val) === String(o[0]) ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
  }
  function keyMode(sw) {
    if (sw.any) return 'any';
    if (sw.keys.length === 1 && sw.keys[0] === ' ') return 'space';
    if (sw.keys.length === 1 && sw.keys[0] === 'Enter') return 'enter';
    return 'learned';
  }
  function renderSettings() {
    const c = P.cfg, sw = c.sw, km = keyMode(sw);
    const ansVal = c.answer === 'choice' ? (c.choices === 2 ? 'choice2' : 'choice4') : c.answer;
    const learned = [...sw.keys.map(MR.Input.keyLabel)].join(', ') || '–';
    const next = sw.nextKeys.map(MR.Input.keyLabel).join(', ') || '–';
    $('#settings').innerHTML = `<div class="inner">
      <div class="row"><h2 class="grow">Einstellungen · ${MR.esc(P.name)}</h2><button class="btn primary" data-act="close">Fertig</button></div>
      <div class="card"><h3>Wie antwortest du?</h3>
        ${seg('input', c.input, [['tap', '👆 Tippen'], ['switch', '🔘 Taster'], ['gaze', '👁 Blick']])}
        <p class="muted small">Tippen: Finger. Taster: Schalter, iSwitch oder Leertaste/Enter. Blick: Augensteuerung, Verweilen wählt.</p>
        <label class="chk"><input type="checkbox" data-chk="screenTap" ${c.screenTap ? 'checked' : ''}> Bildschirm antippen zählt auch</label>
      </div>
      <div class="card"><h3>Antwortform</h3>
        ${seg('answer', ansVal, [['auto', 'Automatisch'], ['choice4', '4 Felder'], ['choice2', '2 Felder'], ['type', 'Eintippen']])}
        <p class="muted small">Mit Taster oder Blick gibt es immer Auswahlfelder.</p>
      </div>
      <div class="card"><h3>Taster</h3>
        <p class="small muted">Taster-Adapter melden sich als Tastatur. iPad: Einstellungen → Bedienungshilfen → Schaltersteuerung muss aus sein.</p>
        <div><b>Welche Taste zählt?</b></div>
        ${seg('keymode', km, [['any', 'Jede Taste'], ['space', 'Leertaste'], ['enter', 'Enter'], ['learned', 'Gelernte']])}
        <div class="small">Gelernte Taste(n): <b>${MR.esc(learned)}</b> · Taster 2 („Weiter“): <b>${MR.esc(next)}</b></div>
        <div class="row">
          <button class="btn" data-act="learn1">Taster 1 anlernen</button>
          <button class="btn" data-act="learn2">Taster 2 anlernen (Weiter)</button>
          <button class="btn small danger" data-act="clearkeys">Gelernte löschen</button>
        </div>
        <div class="row"><label>Sperrzeit ${sel('lockMs', sw.lockMs, [[200, '0,2 s'], [400, '0,4 s'], [800, '0,8 s'], [1500, '1,5 s']])}</label>
          <label>Durchlauf-Tempo ${sel('scanMs', sw.scanMs, [[1200, 'schnell'], [1800, 'normal'], [2500, 'langsam'], [3500, 'sehr langsam']])}</label></div>
        <div class="testbox" id="testbox"><div class="testdot" id="testdot"></div><div id="testtext">Taster testen: Jetzt eine Taste drücken …</div></div>
      </div>
      <div class="card"><h3>Blick</h3>
        <label>Verweildauer ${sel('dwellMs', c.gaze.dwellMs, [[800, '0,8 s'], [1200, '1,2 s'], [1800, '1,8 s'], [2500, '2,5 s']])}</label>
      </div>
      <div class="card"><h3>Sonstiges</h3>
        <label class="chk"><input type="checkbox" data-chk="sound" ${c.sound ? 'checked' : ''}> Töne</label>
        <label class="chk"><input type="checkbox" data-chk="speak" ${c.speak ? 'checked' : ''}> Aufgaben vorlesen</label>
        <label class="chk"><input type="checkbox" data-chk="hints" ${c.hints ? 'checked' : ''}> Hilfe-Knopf anzeigen</label>
        <div style="margin-top:8px"><b>Stil</b></div>
        ${seg('theme', c.theme, Object.keys(MR.THEMES).map(k => [k, MR.THEMES[k].label]))}
      </div>
      <div class="card"><h3>Verbindung</h3>
        <div class="row"><input id="setRoom" maxlength="4" value="${MR.esc(room)}" style="width:6em;text-transform:uppercase;letter-spacing:.15em">
          <button class="btn" data-act="reconnect">Verbinden</button>
          <span class="small muted">${linkOpen ? '● verbunden' : '○ nicht verbunden'}</span></div>
      </div>
      <div class="card"><h3>Mein Profil</h3>
        <p class="small muted">Dein Lernstand liegt auf diesem iPad. Eine Kopie bekommt die Lehrkraft. Du kannst ihn auch als Datei sichern.</p>
        <button class="btn" data-act="export">Profil als Datei sichern</button>
      </div>
      <div class="small muted"><a href="index.html?wechseln">Gerät ändern (Tafel oder iPad)</a> · Mathe-Arena ${MR.VERSION}</div>
    </div>`;
  }
  function testKey(key, down, status) {
    const box = $('#testbox'), dot = $('#testdot'), tx = $('#testtext'); if (!box) return;
    dot.classList.toggle('down', down);
    if (down) tx.textContent = 'Angekommen: ' + MR.Input.keyLabel(key) + (status === 'select' ? ' ✓ zählt als Taster 1' : status === 'next' ? ' ✓ zählt als Taster 2 (Weiter)' : ' – zählt im Moment nicht');
  }
  function learn(slot) {
    const box = $('#testbox'), tx = $('#testtext'); if (!box) return;
    box.classList.add('learning'); tx.textContent = 'Jetzt ' + (slot === 1 ? 'Taster 1' : 'Taster 2') + ' drücken …';
    if (document.activeElement) document.activeElement.blur();
    Sw.learning = {
      cb: key => {
        const sw = P.cfg.sw;
        if (slot === 1) { sw.any = false; if (!sw.keys.includes(key)) sw.keys.push(key); sw.nextKeys = sw.nextKeys.filter(k => k !== key); }
        else { sw.nextKeys = [key]; sw.keys = sw.keys.filter(k => k !== key); if (!sw.keys.length) { sw.any = false; } }
        save(); renderSettings();
        const t2 = $('#testtext'); if (t2) t2.textContent = 'Gelernt: ' + MR.Input.keyLabel(key) + (slot === 1 ? ' (Taster 1)' : ' (Taster 2, Weiter)');
      }
    };
  }
  $('#settings').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, v = b.dataset.v, c = P.cfg, sw = c.sw;
    if (a === 'close') return closeSettings();
    if (a === 'input') { c.input = v; if (v === 'switch') c.screenTap = false; else c.screenTap = true; }
    else if (a === 'answer') {
      if (v === 'choice4') { c.answer = 'choice'; c.choices = 4; } else if (v === 'choice2') { c.answer = 'choice'; c.choices = 2; } else c.answer = v;
    } else if (a === 'keymode') {
      if (v === 'any') { sw.any = true; sw.keys = []; }
      else if (v === 'space') { sw.any = false; sw.keys = [' ']; }
      else if (v === 'enter') { sw.any = false; sw.keys = ['Enter']; }
      else { sw.any = false; }
    } else if (a === 'theme') { c.theme = v; applyTheme(); }
    else if (a === 'learn1') return learn(1);
    else if (a === 'learn2') return learn(2);
    else if (a === 'clearkeys') { sw.any = true; sw.keys = []; sw.nextKeys = []; }
    else if (a === 'reconnect') { const r = $('#setRoom').value.trim().toUpperCase(); if (r.length === 4) { room = r; MR.store.set('mr.room', r); connect(); toast('Verbinde …'); } return; }
    else if (a === 'export') { MR.download('mathe-arena-profil-' + P.name.replace(/\s+/g, '-') + '.json', JSON.stringify(P, null, 1)); return; }
    save(); renderSettings();
  });
  $('#settings').addEventListener('change', e => {
    const t = e.target, c = P.cfg;
    if (t.dataset.chk) c[t.dataset.chk] = t.checked;
    else if (t.dataset.sel === 'lockMs') c.sw.lockMs = +t.value;
    else if (t.dataset.sel === 'scanMs') c.sw.scanMs = +t.value;
    else if (t.dataset.sel === 'dwellMs') c.gaze.dwellMs = +t.value;
    save();
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden && P) { save(); sendProf(); } });
  window.MRStudent = { get P() { return P; }, sess, get task() { return task; } };   // für Tests
  boot();
})();
