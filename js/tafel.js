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
  let cfg = { mode: 'koop', dur: 480, view: 'piste' };   // view: piste (Rennstrecke) | wiese (Blumenwiese)
  let endsAt = 0, wrapUntil = 0, goal = { prog: 0, target: 0 }, ticker = [], tickerDirty = false, titles = [];
  let garden = [], planted = 0, celebrated = false;      // Blumenwiese: eine Blume pro richtiger Antwort

  const newR = () => ({ pts: 0, ok: 0, tot: 0, ups: 0, streak: 0, best: 0 });
  const MODE_SHORT = { koop: 'Zusammen spielen', wett: 'Wettbewerb', ohne: 'Ohne Wertung' };
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
    if (d.ok) { goal.prog++; pushTick(p, d); if (garden.length < 3000) garden.push({ id: p.id, up: !!d.up }); }
  }
  function pushTick(p, d) {
    ticker.push({ name: p.name, c: MR.colorOf(p.id), up: !!d.up, ts: Date.now() });
    if (ticker.length > 12) ticker.shift();
    tickerDirty = true;
  }

  /* ---------- Befehle (Lehrer-Gerät oder Tafel-Menü) ---------- */
  function onCmd(d) {
    switch (d.c) {
      case 'start': startRound({ mode: d.mode, dur: d.dur, view: d.view }); break;
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
    if (o.view) cfg.view = o.view;
    saveCfg();
    garden = []; planted = 0; celebrated = false; resetMeadow();
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
    if (cfg.mode === 'wett') { const w = best(p => p.r.pts); if (w) out.push({ ic: MR.icon('trophy'), t: 'Sieger', who: w.name, sub: w.r.pts + ' Punkte' }); }
    const sk = best(p => p.r.best); if (sk && sk.r.best >= 3) out.push({ ic: MR.icon('flame'), t: 'Serienkönig', who: sk.name, sub: 'Serie von ' + sk.r.best });
    const au = best(p => p.r.ups); if (au && au.r.ups >= 1) out.push({ ic: MR.icon('up'), t: 'Aufsteiger', who: au.name, sub: au.r.ups + (au.r.ups > 1 ? ' Stufen' : ' Stufe') });
    return out;
  }

  function rosterMsg() {
    const now = Date.now();
    return {
      k: 'roster', ph: phase, mode: cfg.mode, dur: cfg.dur, view: cfg.view,
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
    $('#teachTag').textContent = teacher ? 'verbunden' : '';
    $('#btnPair2').innerHTML = teacher ? MR.icon('check') + ' Lehrer-Gerät verbunden' : MR.icon('person') + ' Lehrer-Gerät verbinden';
    $('#setSummary').textContent = (MODE_SHORT[cfg.mode] || '') + (cfg.mode === 'koop' ? ' · ' + (cfg.view === 'wiese' ? 'Blumenwiese' : 'Rennstrecke') : '') + ' · ' + Math.round(cfg.dur / 60) + ' Min.';
    renderHelpBadge();
    const list = [...players.values()];
    const wieseOn = cfg.mode === 'koop' && cfg.view === 'wiese' && phase !== 'lobby';
    $('#wieseBg').classList.toggle('hidden', !wieseOn);
    $('#wieseBg').classList.toggle('low', phase === 'end');
    $('#vEnd').classList.toggle('wiese', wieseOn);
    if (wieseOn) updateMeadow();
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
      const wiese = cfg.mode === 'koop' && cfg.view === 'wiese';
      $('#trackBox').classList.toggle('hidden', wett || wiese);
      $('#lanes').classList.toggle('hidden', !wett);
      if (wett) renderLanes(list); else if (!wiese) renderTrack(ohne);
      if (tickerDirty) {
        tickerDirty = false;
        $('#ticker').innerHTML = ticker.slice(-6).map(t => `<span class="tick" style="--c:${t.c}">${MR.icon(t.up ? 'up' : 'check')} ${MR.esc(t.name)}</span>`).join('');
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
      $('#endHead').innerHTML = prog >= 1 ? 'Ziel erreicht! ' + MR.icon('star') : 'Gut gemacht!';
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

  /* ---------- Blumenwiese ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
  // Blütenfarben: Aicher-Palette ohne Grün, damit die Blüten auf der Wiese leuchten
  const PETALS = ['#FFFFFF', '#FFD100', '#F39200', '#4DB2E6'];
  function petalColor(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PETALS[h % PETALS.length]; }
  function flowerSVG(i, c, up) {
    const hx = halton(i + 1, 2), yn = halton(i + 1, 3);
    const x = 40 + 920 * hx, y = 215 + 160 * yn;
    const k = Math.min(1, Math.sqrt(36 / Math.max(goal.target, 36)));
    const sc = k * (0.85 + 0.95 * yn) * (up ? 1.4 : 1);
    const h = 46 + ((i * 37) % 26), lean = ((i * 53) % 11) - 5;
    const mid = (c === '#FFD100' || c === '#F39200') ? '#0D2B4E' : '#FFD100';
    const type = up ? 'sun' : ['daisy', 'tulip', 'five'][i % 3];
    let head = '';
    if (type === 'daisy') {
      for (let a = 0; a < 360; a += 45) head += `<ellipse cx="0" cy="-15" rx="7" ry="14" fill="${c}" transform="rotate(${a})"/>`;
      head += `<circle r="9" fill="${mid}"/>`;
    } else if (type === 'five') {
      for (let a = 0; a < 360; a += 72) head += `<circle cx="0" cy="-13" r="10.5" fill="${c}" transform="rotate(${a})"/>`;
      head += `<circle r="7" fill="${mid}"/>`;
    } else if (type === 'tulip') {
      head = `<path d="M-14,-8 Q-14,11 0,11 Q14,11 14,-8 L9,-27 L3,-13 L0,-30 L-3,-13 L-9,-27 Z" fill="${c}"/>`;
    } else {
      for (let a = 0; a < 360; a += 24) head += `<ellipse cx="0" cy="-22" rx="7" ry="15" fill="#FFD100" stroke="#0D2B4E" stroke-width="1" transform="rotate(${a})"/>`;
      head += `<circle r="15" fill="#F39200" stroke="#0D2B4E" stroke-width="1.5"/><circle r="9" fill="${c}"/>`;
    }
    return `<g class="fl" data-y="${y.toFixed(1)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${lean}) scale(${sc.toFixed(3)})">
      <g class="fl-stem"><path d="M0 0 C 5 ${-h * .3} -5 ${-h * .65} 0 ${-h}" stroke="var(--gruen)" stroke-width="5" fill="none" stroke-linecap="round"/>
        <ellipse cx="-11" cy="${-h * .35}" rx="10" ry="4.5" fill="var(--hellgruen)" transform="rotate(-35 -11 ${-h * .35})"/>
        <ellipse cx="11" cy="${-h * .5}" rx="10" ry="4.5" fill="var(--hellgruen)" transform="rotate(35 11 ${-h * .5})"/></g>
      <g transform="translate(0,${-h})"><g class="fl-head">${head}</g></g></g>`;
  }
  function resetMeadow() { const l = $('#flowers'); if (l) l.innerHTML = ''; const f = $('#fx'); if (f) f.innerHTML = ''; }
  function butterfly(y) {
    const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'bfly'); g.style.setProperty('--y', y + 'px');
    g.innerHTML = '<g class="wing"><ellipse cx="-9" cy="-4" rx="9" ry="12" fill="#F39200"/><ellipse cx="9" cy="-4" rx="9" ry="12" fill="#4DB2E6"/></g><rect x="-1.5" y="-12" width="3" height="22" rx="1.5" fill="#0D2B4E"/>';
    $('#fx').appendChild(g); setTimeout(() => g.remove(), 9000);
  }
  function updateMeadow() {
    const layer = $('#flowers');
    while (planted < garden.length) {
      const g = garden[planted], c = petalColor(g.id);
      const tmp = document.createElementNS(SVGNS, 'g'); tmp.innerHTML = flowerSVG(planted, c, g.up);
      const node = tmp.firstElementChild, y = +node.dataset.y;
      // weiter hinten stehende Blumen zuerst zeichnen (Tiefe)
      let before = null; for (const el of layer.children) { if (+el.dataset.y > y) { before = el; break; } }
      layer.insertBefore(node, before);
      if (g.up) butterfly(120 + (planted * 41) % 120);
      planted++;
    }
    const prog = goal.target > 0 ? goal.prog / goal.target : 0;
    $('#meadowInfo').innerHTML = `${MR.icon('flower')} ${planted} ${planted === 1 ? 'Blume' : 'Blumen'}` + (cfg.mode === 'koop' && goal.target ? ` · Ziel ${goal.target}` + (prog >= 1 ? ' erreicht' : '') : '');
    if (prog >= 1 && !celebrated) { celebrated = true; for (let i = 0; i < 4; i++) setTimeout(() => butterfly(90 + i * 55), i * 700); }
  }

  setInterval(() => {
    const now = performance.now();
    if (phase === 'run' && endsAt - now <= 0) { phase = 'wrap'; wrapUntil = now + 6000; }
    if (phase === 'wrap' && now >= wrapUntil) finishRound();
    render();
  }, 300);

  /* ---------- Menü ---------- */
  function saveCfg() { MR.store.set('mr.tafelcfg', { mode: cfg.mode, dur: cfg.dur, view: cfg.view }); }
  function openMenu() {
    $('#selMode').value = cfg.mode; $('#selDur').value = String(cfg.dur); $('#selGoal').value = cfg.view;
    $('#ovl').classList.remove('hidden');
  }
  function openPair() {
    $('#ovl').classList.add('hidden');
    makePairQR(); $('#pairUrl').textContent = new URL('lehrer.html' + MR.netQuery, location.href).href;
    $('#ovlPair').classList.remove('hidden');
  }
  function go() { startRound({ mode: cfg.mode, dur: cfg.dur, view: cfg.view }); }
  $('#gear').addEventListener('click', openMenu);
  $('#btnMenu').addEventListener('click', openMenu);
  $('#btnGo').addEventListener('click', go);
  $('#btnPair2').addEventListener('click', openPair);
  $('#pairClose').addEventListener('click', () => $('#ovlPair').classList.add('hidden'));
  ['selMode', 'selDur', 'selGoal'].forEach(id => $('#' + id).addEventListener('change', () => {
    cfg.mode = $('#selMode').value; cfg.dur = +$('#selDur').value; cfg.view = $('#selGoal').value; saveCfg(); render();
  }));
  $('#ovlClose').addEventListener('click', () => $('#ovl').classList.add('hidden'));
  $('#btnStop').addEventListener('click', () => { stopRound(); $('#ovl').classList.add('hidden'); });
  $('#btnLobby').addEventListener('click', () => { toLobby(); $('#ovl').classList.add('hidden'); });

  /* ---------- Einstellungen pro Kind (nur für die Lehrkraft) ---------- */
  function openKidSettings(id) {
    const p = players.get(id); if (!p) return;
    MR.KidSettings.open($('#kidModal'), {
      name: p.name, label: '', profile: p.prof,
      noProfileText: 'Der Stand dieses Kindes kommt gleich an. Die Einstellungen gehen trotzdem durch.',
      onSave: ovr => { send(p.conn, { k: 'ovr', ovr }); if (p.prof) MR.Engine.applyOvr(p.prof, ovr, true); renderKidsList(); },
      onSuggest: lvls => { send(p.conn, { k: 'ovr', ovr: { lvls } }); }
    });
  }
  function renderKidsList() {
    const list = [...players.values()].sort((a, b) => a.name.localeCompare(b.name));
    $('#kidsList').innerHTML = list.length ? list.map(p => `<div class="helpRow ${p.conn ? '' : 'off'}"><span class="chip" style="--c:${MR.colorOf(p.id)}"><span class="dot"></span>${MR.esc(p.name)}</span><span class="grow muted">${MR.KidSettings.summaryHTML(p.prof)}</span><button class="btn small" data-kid="${MR.esc(p.id)}" ${p.conn ? '' : 'disabled'}>${MR.icon('gear')} Einstellen</button></div>`).join('') : '<p class="muted">Noch keine iPads verbunden. Die Kinder scannen zuerst den QR-Code.</p>';
  }
  $('#btnKids').addEventListener('click', () => { renderKidsList(); $('#ovlKids').classList.remove('hidden'); });
  $('#kidsClose').addEventListener('click', () => $('#ovlKids').classList.add('hidden'));
  $('#kidsList').addEventListener('click', e => { const b = e.target.closest('[data-kid]'); if (b && !b.disabled) openKidSettings(b.dataset.kid); });

  /* ---------- Hilfe-Ansicht (nur für die Lehrkraft) ---------- */
  function statusOf(p) {
    const s = p.stat || {}, on = !!p.conn && Date.now() - p.lastSeen < 10000;
    if (!on) return { k: 'off', rank: 5, t: 'nicht verbunden' };
    if (s.help) return { k: 'help', rank: 0, t: 'braucht Hilfe' };
    const slow = s.input && s.input !== 'tap';
    if (s.phase === 'run' && s.idle > (slow ? 150000 : 90000)) return { k: 'idle', rank: 1, t: 'keine Aktion seit ' + Math.round(s.idle / 1000) + ' s' };
    if (s.phase === 'run' && s.errRun >= 3) return { k: 'err', rank: 2, t: 'mehrere Fehler in Folge' };
    if (s.phase === 'run' && s.streak >= 7) return { k: 'fast', rank: 3, t: 'vielleicht unterfordert' };
    return { k: 'ok', rank: 4, t: s.phase === 'run' ? 'läuft' : 'bereit' };
  }
  function helpCount() { return [...players.values()].filter(p => { const k = statusOf(p).k; return k === 'help' || k === 'idle' || k === 'err'; }).length; }
  function renderHelpBadge() {
    const b = $('#btnHelp'), run = phase === 'run' || phase === 'wrap', n = helpCount();
    b.classList.toggle('hidden', !run);
    b.innerHTML = MR.icon('hand') + ' Wer braucht Hilfe?' + (n ? ' (' + n + ')' : '');
    b.classList.toggle('alert', n > 0);
  }
  function renderHelpList() {
    const list = [...players.values()].map(p => ({ p, st: statusOf(p) })).sort((a, b) => a.st.rank - b.st.rank || a.p.name.localeCompare(b.p.name));
    $('#helpList').innerHTML = list.length ? list.map(({ p, st }) => `<div class="helpRow ${st.k}"><span class="chip" style="--c:${MR.colorOf(p.id)}"><span class="dot"></span>${MR.esc(p.name)}</span><span class="grow"><b>${MR.esc((p.stat && p.stat.task) || '')}</b> <span class="muted">${MR.esc(st.t)}</span></span>${p.conn ? `<button class="btn small" data-hint="${MR.esc(p.id)}">${MR.icon('bulb')} Hilfe zeigen</button><button class="btn small" data-kid="${MR.esc(p.id)}" aria-label="Einstellungen">${MR.icon('gear')}</button>` : ''}</div>`).join('') : '<p class="muted">Noch keine iPads verbunden.</p>';
  }
  $('#btnHelp').addEventListener('click', () => { renderHelpList(); $('#ovlHelp').classList.remove('hidden'); });
  $('#helpClose').addEventListener('click', () => $('#ovlHelp').classList.add('hidden'));
  $('#helpList').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.hint) { const p = players.get(b.dataset.hint); if (p) send(p.conn, { k: 'hint' }); }
    else if (b.dataset.kid) openKidSettings(b.dataset.kid);
  });
  setInterval(() => {
    if (!$('#ovlHelp').classList.contains('hidden')) renderHelpList();
    if (!$('#ovlKids').classList.contains('hidden') && $('#kidModal').classList.contains('hidden')) renderKidsList();
  }, 1000);

  $('#btnNewRoom').addEventListener('click', () => { if (confirm('Neuen Raum anlegen? Alle Geräte müssen sich neu verbinden.')) { newRoom(); $('#ovl').classList.add('hidden'); } });
  $('#btnFull').addEventListener('click', () => { try { document.documentElement.requestFullscreen(); } catch (e) { /* weiter */ } });

  // Bildschirm anlassen
  async function keepAwake() { try { if (navigator.wakeLock) await navigator.wakeLock.request('screen'); } catch (e) { /* weiter */ } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) keepAwake(); });
  keepAwake();

  window.MRBoard = { players, get phase() { return phase; }, get goal() { return goal; }, get room() { return room; }, get tkey() { return tkey; } };   // für Tests
  { const sc = MR.store.get('mr.tafelcfg', null); if (sc) { if (sc.mode) cfg.mode = sc.mode; if (sc.dur) cfg.dur = +sc.dur; if (sc.view) cfg.view = sc.view; } }
  initRoom(); startHost(); render();
})();
