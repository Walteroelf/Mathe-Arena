'use strict';
/*
  Tafel-Ansicht: Spielleitung und Anzeige.
  - Die iPads und das Lehrer-Gerät verbinden sich direkt mit diesem Browser-Tab.
  - Die Tafel speichert keine Lernstände (nur Raumcode und Kopplungsschlüssel). Sie darf gelöscht werden.
  - Auf der Tafel erscheinen nur Pseudonyme.
*/
(function () {
  const $ = s => document.querySelector(s);
  const players = new Map();        // id -> Spieler
  const unclaimed = new Map();      // tmp -> { conn, since }   (frische iPads, die ein Profil brauchen)
  let teacher = null, hostApi = null, room = '', tkey = '', takenTries = 0, tmpN = 0;
  let phase = 'lobby';              // lobby | run | wrap | end
  let cfg = { mode: 'koop', dur: 480 };
  let endsAt = 0, wrapUntil = 0, goal = { prog: 0, target: 0 }, ticker = [], tickerDirty = false, titles = [];

  const newR = () => ({ pts: 0, ok: 0, tot: 0, ups: 0, streak: 0, best: 0 });
  const MODE_NAMES = { koop: 'Kooperativ: gemeinsames Klassenziel', wett: 'Wettbewerb: Fortschrittspunkte', ohne: 'Ohne Wertung' };

  /* ---------- Raum ---------- */
  function persist() {
    MR.store.set('mr.tafel', { room, key: tkey });
    try { history.replaceState(null, '', location.pathname + location.search + '#r=' + room); } catch (e) { /* weiter */ }
  }
  function initRoom() {
    const saved = MR.store.get('mr.tafel', null) || {};
    const hp = (MR.hashParams().get('r') || '').toUpperCase();
    room = /^[A-Z]{4}$/.test(hp) ? hp : (saved.room || MR.genCode());
    tkey = (saved.room === room && saved.key) ? saved.key : MR.genCode(6);
    persist();
  }
  function newRoom() {
    room = MR.genCode(); tkey = MR.genCode(6); takenTries = 0;
    players.clear(); unclaimed.clear(); teacher = null; persist(); startHost(); render();
  }
  function startHost() {
    if (hostApi) { try { hostApi.close(); } catch (e) { /* weiter */ } }
    $('#roomTag').textContent = room; $('#codeBig').textContent = room;
    hostApi = MR.hostRoom(room, {
      onConn: conn => { conn.on('data', d => onMsg(conn, d)); conn.on('close', () => onClose(conn)); },
      onStatus: s => { $('#netTag').textContent = s === 'open' ? '' : (s === 'connecting' ? 'Verbinde …' : 'Netzfehler (' + s + ')'); },
      onOpen: () => { takenTries = 0; makeQRs(); },
      onTaken: () => {
        takenTries++;
        if (takenTries <= 5) { $('#netTag').textContent = 'Raum noch belegt, warte …'; setTimeout(startHost, 3500); }
        else newRoom();
      }
    });
  }
  function makeQRs() {
    const box = $('#qrBox'); box.innerHTML = '';
    const c = MR.makeQR(new URL('schueler.html' + MR.netQuery + '#r=' + room, location.href).href);
    if (c) box.appendChild(c);
  }
  function makePairQR() {
    const box = $('#pairQr'); box.innerHTML = '';
    const c = MR.makeQR(new URL('lehrer.html' + MR.netQuery + '#k=' + room + '-' + tkey, location.href).href);
    if (c) box.appendChild(c);
    $('#pairCode').textContent = room + '-' + tkey;
  }

  /* ---------- Nachrichten ---------- */
  const send = (conn, o) => { try { if (conn && conn.open) conn.send(o); } catch (e) { /* weiter */ } };
  const tsend = o => send(teacher, o);
  const bcast = o => players.forEach(p => send(p.conn, o));
  function phasePayload() {
    if (phase === 'run') return { k: 'ph', ph: 'run', left: Math.max(0, endsAt - performance.now()), dur: cfg.dur * 1000, mode: cfg.mode };
    if (phase === 'lobby') return { k: 'ph', ph: 'lobby', mode: cfg.mode };
    return { k: 'ph', ph: 'end', mode: cfg.mode };
  }
  function newPlayer(id, name) {
    return { id, name, conn: null, lastSeen: Date.now(), rev: 0, theme: 'jugend', stat: {}, prof: null, r: newR() };
  }
  function onMsg(conn, d) {
    if (!d || typeof d !== 'object') return;
    const p = conn.pid ? players.get(conn.pid) : null;
    if (p) p.lastSeen = Date.now();
    switch (d.k) {
      case 'join': handleJoin(conn, d); break;
      case 'ev': if (p) handleEv(p, d); break;
      case 'stat': if (p) { p.stat = d; } break;
      case 'prof': if (p && d.profile) { p.prof = d.profile; p.rev = d.profile.rev; tsend({ k: 'prof', id: p.id, profile: d.profile }); } break;
      case 'done': if (p) tsend({ k: 'done', id: p.id, sum: d.sum }); break;
      case 'auth':
        if (String(d.key || '').toUpperCase() === tkey) {
          if (teacher && teacher !== conn) { try { teacher.close(); } catch (e) { /* weiter */ } }
          teacher = conn; conn.isTeacher = true;
          send(conn, { k: 'auth', ok: true, room });
          $('#ovlPair').classList.add('hidden');
          players.forEach(q => { if (q.prof) send(conn, { k: 'prof', id: q.id, profile: q.prof }); });
          send(conn, rosterMsg());
        } else send(conn, { k: 'auth', ok: false });
        break;
      case 'cmd': if (conn.isTeacher) onCmd(d); break;
    }
  }
  function onClose(conn) {
    if (conn.tmp) unclaimed.delete(conn.tmp);
    const p = conn.pid ? players.get(conn.pid) : null;
    if (p && p.conn === conn) p.conn = null;
    if (teacher === conn) teacher = null;
  }
  function handleJoin(conn, d) {
    if (!d.id) {
      conn.tmp = conn.tmp || 'n' + (++tmpN);
      unclaimed.set(conn.tmp, { conn, since: Date.now() });
      send(conn, Object.assign({}, phasePayload(), { k: 'welcome' }));
      return;
    }
    if (conn.tmp) { unclaimed.delete(conn.tmp); conn.tmp = null; }
    let p = players.get(d.id);
    if (!p) {
      p = newPlayer(d.id, d.name); players.set(d.id, p);
      if (phase === 'run' && cfg.mode === 'koop') goal.target += Math.round(Math.max(0, endsAt - performance.now()) / 14000);
    }
    if (p.conn && p.conn !== conn) { const old = p.conn; p.conn = null; try { old.close(); } catch (e) { /* weiter */ } }
    p.conn = conn; conn.pid = d.id; p.name = d.name || p.name; p.rev = d.rev || 0; p.theme = d.theme || p.theme; p.lastSeen = Date.now();
    send(conn, Object.assign({}, phasePayload(), { k: 'welcome' }));
    tsend({ k: 'joined', id: d.id, name: p.name, rev: p.rev });
  }
  function handleEv(p, d) {
    if (phase !== 'run' && phase !== 'wrap') return;     // Allein-Üben zählt nicht fürs Klassenspiel
    const r = p.r;
    r.tot++; if (d.ok) r.ok++; r.pts += d.pts || 0; if (d.up) r.ups++; r.streak = d.streak || 0; r.best = Math.max(r.best, r.streak);
    if (d.ok) { goal.prog++; pushTick(p, d); }
  }
  function pushTick(p, d) {
    ticker.push({ name: p.name, c: MR.colorOf(p.id), up: !!d.up, ts: Date.now() });
    if (ticker.length > 12) ticker.shift();
    tickerDirty = true;
  }

  /* ---------- Befehle (Lehrer-Gerät oder Tafel-Menü) ---------- */
  function onCmd(d) {
    switch (d.c) {
      case 'start': startRound({ mode: d.mode, dur: d.dur }); break;
      case 'stop': stopRound(); break;
      case 'lobby': toLobby(); break;
      case 'ovr': { const p = players.get(d.id); if (p) send(p.conn, { k: 'ovr', ovr: d.ovr }); break; }
      case 'hint': { const p = players.get(d.id); if (p) send(p.conn, { k: 'hint' }); break; }
      case 'restore': { const p = players.get(d.id); if (p) send(p.conn, { k: 'restore', profile: d.profile }); break; }
      case 'claim': { const u = unclaimed.get(d.tmp); if (u) send(u.conn, { k: 'restore', profile: d.profile }); break; }
    }
  }
  function startRound(o) {
    if (o.mode) cfg.mode = o.mode;
    if (o.dur) cfg.dur = +o.dur;
    phase = 'run'; endsAt = performance.now() + cfg.dur * 1000; titles = []; ticker = []; tickerDirty = true;
    const n = [...players.values()].filter(p => p.conn).length;
    goal = { prog: 0, target: Math.max(8, Math.round(n * cfg.dur / 14)) };
    players.forEach(p => { p.r = newR(); });
    bcast(phasePayload()); render();
  }
  function stopRound() { if (phase === 'run' || phase === 'wrap') finishRound(); }
  function finishRound() {
    phase = 'end'; titles = computeTitles(); bcast(phasePayload()); render();
  }
  function toLobby() { phase = 'lobby'; bcast(phasePayload()); render(); }

  function computeTitles() {
    const arr = [...players.values()].filter(p => p.r.tot > 0), out = [];
    const best = fn => arr.reduce((b, p) => (!b || fn(p) > fn(b)) ? p : b, null);
    if (cfg.mode === 'wett') { const w = best(p => p.r.pts); if (w) out.push({ ic: '🏆', t: 'Sieger', who: w.name, sub: w.r.pts + ' Punkte' }); }
    const sk = best(p => p.r.best); if (sk && sk.r.best >= 3) out.push({ ic: '🔥', t: 'Serienkönig', who: sk.name, sub: 'Serie von ' + sk.r.best });
    const au = best(p => p.r.ups); if (au && au.r.ups >= 1) out.push({ ic: '⬆️', t: 'Aufsteiger', who: au.name, sub: au.r.ups + (au.r.ups > 1 ? ' Stufen' : ' Stufe') });
    return out;
  }

  function rosterMsg() {
    const now = Date.now();
    return {
      k: 'roster', ph: phase, mode: cfg.mode, dur: cfg.dur,
      left: phase === 'run' ? Math.max(0, endsAt - performance.now()) : 0, goal,
      players: [...players.values()].map(p => ({
        id: p.id, name: p.name, online: !!p.conn && now - p.lastSeen < 10000, rev: p.rev,
        pts: p.r.pts, ok: p.r.ok, tot: p.r.tot, ups: p.r.ups, streak: p.r.streak, stat: p.stat
      })),
      unclaimed: [...unclaimed.entries()].map(([tmp, u]) => ({ tmp, since: u.since }))
    };
  }
  setInterval(() => { if (teacher) tsend(rosterMsg()); }, 1000);
  setInterval(() => { if (phase === 'run') bcast(phasePayload()); }, 4000);

  /* ---------- Anzeige ---------- */
  const trackFill = $('#trackFill'), car = $('#car');
  const trackLen = trackFill.getTotalLength();
  trackFill.style.strokeDasharray = trackLen;
  function setView(id) { document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === id)); }
  function chipHTML(p) {
    const on = !!p.conn && Date.now() - p.lastSeen < 10000;
    return `<span class="chip ${on ? '' : 'off'}" style="--c:${MR.colorOf(p.id)}"><span class="dot"></span>${MR.esc(p.name)}</span>`;
  }
  function render() {
    $('#modeTag').textContent = MODE_NAMES[cfg.mode] || '';
    const tt = teacher ? 'Lehrer-Gerät verbunden ✓' : 'Noch kein Lehrer-Gerät verbunden';
    $('#teachTag').textContent = tt; $('#teachLine').textContent = teacher ? tt + ' (Start und Einstellungen dort)' : tt;
    $('#btnPair').textContent = teacher ? '✓ Lehrer-Gerät verbunden' : '👩‍🏫 Lehrer-Gerät koppeln';
    $('#btnPair').classList.toggle('primary', !teacher);
    const list = [...players.values()];
    if (phase === 'lobby') {
      setView('vLobby'); $('#timer').textContent = '';
      $('#chips').innerHTML = list.map(chipHTML).join('');
      const n = list.filter(p => p.conn).length;
      $('#lobHint').textContent = n ? n + (n === 1 ? ' Gerät verbunden' : ' Geräte verbunden') : 'Noch niemand verbunden';
    } else if (phase === 'run' || phase === 'wrap') {
      setView('vRun');
      const left = phase === 'run' ? endsAt - performance.now() : 0;
      $('#timer').textContent = phase === 'wrap' ? 'Letzte Aufgaben …' : MR.fmtTime(left);
      const wett = cfg.mode === 'wett', ohne = cfg.mode === 'ohne';
      $('#trackBox').classList.toggle('hidden', wett);
      $('#lanes').classList.toggle('hidden', !wett);
      if (wett) renderLanes(list); else renderTrack(ohne);
      if (tickerDirty) {
        tickerDirty = false;
        $('#ticker').innerHTML = ticker.slice(-6).map(t => `<span class="tick" style="--c:${t.c}">${t.up ? '⬆ ' : '✓ '}${MR.esc(t.name)}</span>`).join('');
      }
    } else {
      setView('vEnd'); $('#timer').textContent = '';
      renderEnd(list);
    }
  }
  function renderTrack(ohne) {
    const track = $('#track');
    if (ohne) {
      track.style.visibility = 'hidden';
      $('#pctNum').textContent = goal.prog; $('#pctSub').textContent = 'richtige Antworten zusammen';
      return;
    }
    track.style.visibility = '';
    const prog = goal.target > 0 ? goal.prog / goal.target : 0;
    const filled = Math.min(prog, 1);
    trackFill.style.strokeDashoffset = trackLen * (1 - filled);
    const frac = prog >= 1 ? prog % 1 : prog;
    const pt = trackFill.getPointAtLength(frac * trackLen);
    car.setAttribute('transform', `translate(${pt.x},${pt.y})`);
    $('#pctNum').textContent = Math.round(prog * 100) + ' %';
    $('#pctSub').textContent = prog >= 1 ? 'Ziel erreicht! Runde ' + (Math.floor(prog) + 1) : 'Gemeinsam zum Ziel';
  }
  function renderLanes(list) {
    const top = Math.max(40, ...list.map(p => p.r.pts)) * 1.12;
    $('#lanes').innerHTML = list.map(p => `<div class="lane" style="--c:${MR.colorOf(p.id)}"><span>${MR.esc(p.name)}</span><div class="bar"><i style="width:${Math.round(p.r.pts / top * 100)}%"></i></div><span class="v">${p.r.pts}</span></div>`).join('');
  }
  function renderEnd(list) {
    if (cfg.mode === 'koop') {
      const prog = goal.target > 0 ? goal.prog / goal.target : 0;
      $('#endHead').textContent = prog >= 1 ? 'Ziel erreicht! 🎉' : 'Gut gemacht!';
      $('#endSub').textContent = 'Zusammen: ' + goal.prog + ' richtige Antworten (' + Math.round(prog * 100) + ' % vom Ziel)';
    } else if (cfg.mode === 'wett') {
      $('#endHead').textContent = 'Runde zu Ende';
      $('#endSub').textContent = 'Gewertet wird der Fortschritt, nicht die Menge';
    } else {
      $('#endHead').textContent = 'Geschafft!';
      $('#endSub').textContent = 'Zusammen: ' + goal.prog + ' richtige Antworten';
    }
    $('#titles').innerHTML = titles.map(t => `<div class="titleCard"><div class="ic">${t.ic}</div><b>${t.t}</b><div>${MR.esc(t.who)}</div><div class="muted small">${MR.esc(t.sub)}</div></div>`).join('');
    $('#endChips').innerHTML = list.filter(p => p.r.tot > 0).map(chipHTML).join('');
  }

  setInterval(() => {
    const now = performance.now();
    if (phase === 'run' && endsAt - now <= 0) { phase = 'wrap'; wrapUntil = now + 6000; }
    if (phase === 'wrap' && now >= wrapUntil) finishRound();
    render();
  }, 300);

  /* ---------- Menü ---------- */
  function openMenu() {
    $('#selMode').value = cfg.mode; $('#selDur').value = String(cfg.dur);
    $('#ovl').classList.remove('hidden');
  }
  function openPair() {
    $('#ovl').classList.add('hidden');
    makePairQR(); $('#pairUrl').textContent = new URL('lehrer.html' + MR.netQuery, location.href).href;
    $('#ovlPair').classList.remove('hidden');
  }
  $('#gear').addEventListener('click', openMenu);
  $('#btnMenu').addEventListener('click', openMenu);
  $('#btnPair').addEventListener('click', openPair);
  $('#btnPair2').addEventListener('click', openPair);
  $('#pairClose').addEventListener('click', () => $('#ovlPair').classList.add('hidden'));
  $('#ovlClose').addEventListener('click', () => $('#ovl').classList.add('hidden'));
  $('#btnStart').addEventListener('click', () => { startRound({ mode: $('#selMode').value, dur: +$('#selDur').value }); $('#ovl').classList.add('hidden'); });
  $('#btnStop').addEventListener('click', () => { stopRound(); $('#ovl').classList.add('hidden'); });
  $('#btnLobby').addEventListener('click', () => { toLobby(); $('#ovl').classList.add('hidden'); });
  $('#btnNewRoom').addEventListener('click', () => { if (confirm('Neuen Raum anlegen? Alle Geräte müssen sich neu verbinden.')) { newRoom(); $('#ovl').classList.add('hidden'); } });
  $('#btnFull').addEventListener('click', () => { try { document.documentElement.requestFullscreen(); } catch (e) { /* weiter */ } });

  // Bildschirm anlassen
  async function keepAwake() { try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) { /* weiter */ } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
  keepAwake();

  window.MRBoard = { players, get phase() { return phase; }, get goal() { return goal; }, get room() { return room; }, get tkey() { return tkey; } };   // für Tests
  initRoom(); startHost(); render();
})();
