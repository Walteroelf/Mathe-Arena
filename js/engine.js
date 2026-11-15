'use strict';
/*
  Lernprofil und mitlernende Aufgabenwahl.

  - Pro Strang (Mengen, Plus, Minus, Stufe 0) gibt es einen Wert "lvl" (z. B. 3.4 = Stufe 3, 40 % bis Stufe 4).
  - Nach jeder Antwort wird lvl Elo-artig angepasst. Gleichgewicht bei ca. 75 % richtig.
  - Am Anfang lernt das System schneller (große Schritte), später ruhiger. Das ist die "Einstufung".
  - Stufe 0 (Taster, Ursache-Wirkung) steigt nie automatisch: Das System schlägt nur vor.
*/
(function (MR) {
  const S = MR.STRANDS;
  const DEF_START = { s0: 1, tippen: 1, spuren: 1, mengen: 2, plus: 2, minus: 2 };

  function defaultCfg(theme) {
    return {
      input: 'tap',               // tap | switch | gaze
      answer: 'auto',             // auto | choice | type
      choices: 4,                 // 2 oder 4 Auswahlfelder
      strands: ['mengen', 'plus', 'minus'],
      focus: '',                  // Fokus-Strang
      hints: true, speak: false, sound: true,
      theme: theme || 'jugend',
      screenTap: true,
      sw: { any: true, keys: [], nextKeys: [], lockMs: 400, scanMs: 1800 },
      gaze: { dwellMs: 1200 }
    };
  }
  function newSkill(strand) {
    const l = DEF_START[strand] || 1;
    return { lvl: l + 0.3, top: l, n: 0, ok: 0, ema: 0.5, streak: 0, errRun: 0, run: 0, last: 0, errs: {}, suggest: false };
  }
  function newProfile(name, theme) {
    const p = { v: 1, id: MR.rid(10), name, rev: 1, ts: Date.now(), created: Date.now(), cfg: defaultCfg(theme), skills: {}, stats: { tot: 0, ok: 0, rounds: 0 }, history: [] };
    MR.STRAND_ORDER.forEach(s => { p.skills[s] = newSkill(s); });
    return p;
  }
  function ensure(p) {
    const d = defaultCfg(p.cfg && p.cfg.theme);
    p.cfg = Object.assign(d, p.cfg || {});
    p.cfg.sw = Object.assign(d.sw, (p.cfg && p.cfg.sw) || {});
    p.cfg.gaze = Object.assign(d.gaze, (p.cfg && p.cfg.gaze) || {});
    p.skills = p.skills || {};
    MR.STRAND_ORDER.forEach(s => { if (!p.skills[s]) p.skills[s] = newSkill(s); });
    p.stats = p.stats || { tot: 0, ok: 0, rounds: 0 };
    p.history = p.history || [];
    return p;
  }

  function chooseNext(p, sess) {
    const cfg = p.cfg; let list = cfg.strands.filter(s => S[s] && !(S[s].tapOnly && cfg.input !== 'tap')); if (!list.length) list = ['mengen'];
    const now = Date.now();
    const w = list.map(s => {
      const k = p.skills[s];
      let x = 1 + (1 - k.ema) * 1.5 + (k.n < 6 ? 1.5 : 0) + Math.min(1, (now - (k.last || 0)) / 180000);
      if (cfg.focus === s) x *= 3;
      if (sess.lastStrand === s && sess.sameRun >= 2) x *= 0.15;
      return x;
    });
    let r = Math.random() * w.reduce((a, b) => a + b, 0), idx = 0;
    for (; idx < w.length; idx++) { r -= w[idx]; if (r <= 0) break; }
    idx = Math.min(idx, list.length - 1);
    const strand = list[idx], k = p.skills[strand], N = MR.nLevels(strand);
    sess.sameRun = sess.lastStrand === strand ? (sess.sameRun || 0) + 1 : 1;
    sess.lastStrand = strand; sess.count = (sess.count || 0) + 1;

    let L = Math.floor(k.lvl); const frac = k.lvl - L; const flags = {};
    if (S[strand].manual) {
      L = MR.clamp(L, 1, N); if (L > 1 && Math.random() < 0.25) L--;
    } else {
      if (Math.random() < frac) L++;
      if (k.errRun >= 2) { L--; flags.easy = true; flags.forceChoice = true; }
      else if (sess.count % 5 === 0) { L--; flags.easy = true; }
      else if (sess.count % 7 === 0 && k.streak >= 2) { L++; flags.challenge = true; }
      L = MR.clamp(L, 1, N);
    }
    return Object.assign(MR.makeTask(strand, L), flags);
  }

  function answerMode(p, t, force) {
    const c = p.cfg;
    if (c.input !== 'tap') return 'choice';
    if (force || t.forceChoice) return 'choice';
    if (c.answer === 'choice') return 'choice';
    if (c.answer === 'type') return 'type';
    const k = p.skills[t.strand];
    return (t.level <= 2 || k.ema < 0.6) ? 'choice' : 'type';
  }

  /* res: { ok, ms, hinted, guess, streak (Sitzungsserie nach dieser Antwort), first (nur Stufe 0) } */
  function record(p, t, res) {
    const k = p.skills[t.strand] || (p.skills[t.strand] = newSkill(t.strand));
    const out = { ok: !!res.ok, pts: 0, up: false, upLabel: '' };
    k.n++; k.last = Date.now(); p.stats.tot++;
    if (S[t.strand].manual) {
      k.ok++; p.stats.ok++;
      if (res.first === false) k.run = 0; else { k.run++; k.streak++; }
      if (k.run >= 8) k.suggest = true;
      out.ok = true; out.pts = 10;
    } else {
      let r = res.ok ? 1 : 0;
      if (res.ok && res.q != null && res.q < 0.75) r = 0.6;      // Nachspuren: ungenau
      if (res.ok && res.hinted) r = 0.5;
      else if (res.ok && res.ms > (t.mode === 'type' ? 15000 : 10000)) r = 0.75;
      const K = Math.max(0.35, 0.9 - 0.08 * k.n) * (res.guess ? 0.5 : 1);
      if (!(t.challenge && !res.ok)) k.lvl = MR.clamp(k.lvl + K * (r - 0.75), 1, MR.nLevels(t.strand) + 0.99);
      if (res.ok && k.streak >= 4) k.lvl = Math.min(MR.nLevels(t.strand) + 0.99, k.lvl + 0.08);
      k.ema = k.ema * 0.85 + (res.ok ? 1 : 0) * 0.15;
      if (res.ok) { k.ok++; k.streak++; k.errRun = 0; p.stats.ok++; }
      else { k.streak = 0; k.errRun++; (t.tags || []).forEach(g => { k.errs[g] = (k.errs[g] || 0) + 1; }); }
      if (Math.floor(k.lvl) > k.top) {
        k.top = Math.floor(k.lvl); out.up = true; out.upLabel = S[t.strand].levels[k.top - 1].label;
      }
      if (res.ok) out.pts = 10 + (t.challenge ? 10 : 0) + Math.min(10, 2 * Math.max(0, (res.streak || 1) - 1));
      if (out.up) out.pts += 30;
    }
    p.rev++; p.ts = Date.now();
    return out;
  }

  /* Einstellungen/Stufen von der Lehrkraft übernehmen (auch auf der Kopie im Lehrer-Gerät) */
  function applyOvr(p, o, noRev) {
    if (!o) return p;
    const c = o.cfg || {};
    Object.keys(c).forEach(key => {
      if ((key === 'sw' || key === 'gaze') && typeof c[key] === 'object') Object.assign(p.cfg[key], c[key]);
      else p.cfg[key] = c[key];
    });
    if (o.lvls) {
      Object.keys(o.lvls).forEach(s => {
        if (!S[s]) return;
        const L = MR.clamp(+o.lvls[s] || 1, 1, MR.nLevels(s));
        const k = p.skills[s] || (p.skills[s] = newSkill(s));
        k.lvl = L + 0.3; k.top = L; k.run = 0; k.errRun = 0; k.suggest = false;
      });
    }
    if (!noRev) { p.rev++; p.ts = Date.now(); }
    return p;
  }

  function levelSummary(p) {
    return MR.STRAND_ORDER.filter(s => p.cfg.strands.includes(s) || p.skills[s].n > 0).map(s => {
      const k = p.skills[s], L = MR.clamp(Math.floor(k.lvl), 1, MR.nLevels(s));
      return { strand: s, short: S[s].short, level: L, label: S[s].levels[L - 1].label, n: k.n, ema: k.ema, suggest: !!k.suggest };
    });
  }
  function topError(p) {
    let best = null;
    Object.keys(p.skills).forEach(s => {
      const e = p.skills[s].errs || {};
      Object.keys(e).forEach(tag => { if (!best || e[tag] > best.n) best = { strand: s, tag, n: e[tag] }; });
    });
    return best && best.n >= 3 ? best : null;
  }
  const TAG_NAMES = {
    zuegang10: 'Zehnerübergang bis 20', zuegang100: 'Übergang bis 100', teen: 'Zahlen 11–19',
    zweistellig: 'zweistellige Zahlen', tippen: 'Zählen durch Tippen', spuren: 'Zahlen nachspuren', bis5: 'bis 5', bis10: 'bis 10', 'mengen-free': 'Mengen erfassen', 'mengen-frame': 'Mengen im Zehnerfeld'
  };

  /* Voreinstellungen pro Kind: für Kolleginnen und Kollegen ohne Fachwissen */
  const PRESETS = {
    taster: { label: 'Ganz früh · nur Taster (Stufe 0)', cfg: { input: 'switch', strands: ['s0'], focus: '', screenTap: false }, lvls: { s0: 1 } },
    blick: { label: 'Ganz früh · Blicksteuerung (Stufe 0)', cfg: { input: 'gaze', strands: ['s0'], focus: '', screenTap: false }, lvls: { s0: 1 } },
    frueh: { label: 'Früh · Zählen, Nachspuren, Mengen (Tippen)', cfg: { input: 'tap', answer: 'choice', choices: 4, strands: ['tippen', 'spuren', 'mengen'], focus: '', screenTap: true }, lvls: { tippen: 1, spuren: 1, mengen: 1 } },
    plus20: { label: 'Rechnen bis 20', cfg: { input: 'tap', answer: 'auto', choices: 4, strands: ['mengen', 'plus', 'minus'], focus: '', screenTap: true }, lvls: { mengen: 3, plus: 2, minus: 2 } },
    plus100: { label: 'Rechnen bis 100', cfg: { input: 'tap', answer: 'auto', choices: 4, strands: ['plus', 'minus'], focus: '', screenTap: true }, lvls: { plus: 5, minus: 5 } }
  };

  MR.Engine = { PRESETS, defaultCfg, newSkill, newProfile, ensure, chooseNext, answerMode, record, applyOvr, levelSummary, topError, TAG_NAMES };
})(window.MR);
