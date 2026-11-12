'use strict';
/*
  Kompetenzkarte und Aufgaben-Generatoren.
  Jeder Strang hat Stufen (1, 2, 3 ...). Aufgaben werden erzeugt, nicht aufgelistet.
  Neuen Strang hinzufügen: in MR.STRANDS eintragen, einen Generator in GEN anlegen.
*/
(function (MR) {
  const R = MR.ri;

  MR.STRANDS = {
    s0: {
      id: 's0', name: 'Stufe 0 · Ursache-Wirkung', short: 'S0', manual: true,
      levels: [
        { label: '0a Ursache-Wirkung', desc: 'Ein Druck löst Licht und Ton aus' },
        { label: '0b Reagieren', desc: 'Auf ein Signal warten, dann drücken' },
        { label: '0c Auswählen', desc: 'Zwischen zwei Dingen wählen' },
        { label: '0d Zählen mit Taster', desc: 'So oft drücken, wie die Zahl zeigt' }
      ]
    },
    mengen: {
      id: 'mengen', name: 'Mengen erfassen', short: 'Menge',
      levels: [{ label: 'Mengen bis 3' }, { label: 'Mengen bis 5' }, { label: 'Mengen bis 10' }, { label: 'Mengen bis 20' }]
    },
    plus: {
      id: 'plus', name: 'Plus', short: 'Plus',
      levels: [
        { label: 'Plus bis 5' }, { label: 'Plus bis 10' }, { label: 'Plus bis 20, ohne Zehnerübergang' },
        { label: 'Plus bis 20, mit Zehnerübergang' }, { label: 'Plus bis 100, ohne Übergang' }, { label: 'Plus bis 100, mit Übergang' }
      ]
    },
    minus: {
      id: 'minus', name: 'Minus', short: 'Minus',
      levels: [
        { label: 'Minus bis 5' }, { label: 'Minus bis 10' }, { label: 'Minus bis 20, ohne Zehnerübergang' },
        { label: 'Minus bis 20, mit Zehnerübergang' }, { label: 'Minus bis 100, ohne Übergang' }, { label: 'Minus bis 100, mit Übergang' }
      ]
    }
  };
  MR.STRAND_ORDER = ['s0', 'mengen', 'plus', 'minus'];
  MR.nLevels = s => MR.STRANDS[s].levels.length;

  /* ---------- Mengen ---------- */
  function freePositions(n) {
    const pts = [];
    for (let tries = 0; pts.length < n && tries < 400; tries++) {
      const p = { x: R(10, 90), y: R(10, 50) };
      if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) > 17)) pts.push(p);
    }
    for (let i = pts.length; i < n; i++) pts.push({ x: 10 + (i % 5) * 18, y: 15 + Math.floor(i / 5) * 18 });
    return pts;
  }
  function genMengen(L) {
    const rng = [[1, 3], [2, 5], [3, 10], [8, 20]][L - 1];
    const n = R(rng[0], rng[1]);
    const layout = L <= 2 ? 'free' : 'frame';
    return {
      q: 'Wie viele?', speak: 'Wie viele sind es?', answer: n, tags: ['mengen-' + layout],
      visual: { type: 'dots', n, layout, pos: layout === 'free' ? freePositions(n) : null }
    };
  }

  /* ---------- Plus ---------- */
  function genPlus(L) {
    let a, b, tag;
    if (L === 1) { a = R(1, 4); b = R(1, 5 - a); tag = 'bis5'; }
    else if (L === 2) { a = R(2, 8); b = R(1, 10 - a); tag = 'bis10'; }
    else if (L === 3) {
      const u1 = R(0, 8), u2 = R(1, 9 - u1); a = 10 + u1; b = u2; if (Math.random() < .5) [a, b] = [b, a]; tag = 'teen';
    } else if (L === 4) { a = R(2, 9); b = R(11 - a, 9); tag = 'zuegang10'; }
    else if (L === 5) {
      const t1 = R(1, 8), t2 = R(0, 9 - t1), u1 = R(0, 8);
      const u2 = t2 === 0 ? R(1, 9 - u1) : R(0, 9 - u1);
      a = t1 * 10 + u1; b = t2 * 10 + u2; tag = 'zweistellig';
    } else {
      const u1 = R(2, 9), u2 = R(10 - u1, 9), t1 = R(1, 7), t2 = R(0, 8 - t1);
      a = t1 * 10 + u1; b = t2 * 10 + u2; tag = 'zuegang100';
    }
    return { q: a + ' + ' + b, speak: a + ' plus ' + b, answer: a + b, a, b, op: '+', tags: [tag] };
  }

  /* ---------- Minus ---------- */
  function genMinus(L) {
    let a, b, tag;
    if (L === 1) { a = R(2, 5); b = R(1, a - 1); tag = 'bis5'; }
    else if (L === 2) { a = R(4, 10); b = R(1, a - 1); tag = 'bis10'; }
    else if (L === 3) { a = R(11, 19); b = R(1, a % 10); tag = 'teen'; }
    else if (L === 4) { a = R(11, 18); b = R((a % 10) + 1, 9); tag = 'zuegang10'; }
    else if (L === 5) {
      const t1 = R(2, 9), u1 = R(1, 9), t2 = R(0, t1 - 1);
      const u2 = t2 === 0 ? R(1, u1) : R(0, u1);
      a = t1 * 10 + u1; b = t2 * 10 + u2; tag = 'zweistellig';
    } else {
      const t1 = R(2, 9), u1 = R(0, 8), u2 = R(u1 + 1, 9), t2 = R(0, t1 - 1);
      a = t1 * 10 + u1; b = t2 * 10 + u2; tag = 'zuegang100';
    }
    return { q: a + ' − ' + b, speak: a + ' minus ' + b, answer: a - b, a, b, op: '-', tags: [tag] };
  }

  const GEN = { mengen: genMengen, plus: genPlus, minus: genMinus };

  /* ---------- Stufe 0 ---------- */
  const SHAPES = [
    { name: 'der rote Kreis', c: '#ff5a5a', s: 'circle' },
    { name: 'das blaue Quadrat', c: '#4f8cff', s: 'square' },
    { name: 'das gelbe Dreieck', c: '#ffd43b', s: 'tri' },
    { name: 'der grüne Kreis', c: '#2fd27a', s: 'circle' }
  ];
  function genS0(L) {
    if (L === 1) return { kind: 'fx', q: 'Drücke!', speak: 'Drücke!', tags: ['s0'] };
    if (L === 2) return { kind: 'react', q: 'Warte auf das Signal', speak: 'Warte. Wenn es leuchtet, drücke.', delay: R(1500, 4000), tags: ['s0'] };
    if (L === 3) {
      const two = MR.shuffle(SHAPES).slice(0, 2); const target = R(0, 1);
      return { kind: 'choose2', q: 'Wähle ' + two[target].name, speak: 'Wähle ' + two[target].name, shapes: two, target, tags: ['s0'] };
    }
    const n = R(1, 3);
    return { kind: 'count', q: 'Drücke ' + n + ' Mal', speak: 'Drücke ' + n + ' Mal', n, tags: ['s0'] };
  }

  MR.makeTask = function (strand, level) {
    const t = strand === 's0' ? genS0(level) : GEN[strand](level);
    t.strand = strand; t.level = level; t.id = MR.rid(6);
    return t;
  };

  /* Auswahlantworten mit plausiblen Ablenkern */
  MR.makeChoices = function (t, n) {
    n = n || 4;
    const ans = t.answer, min = t.strand === 'mengen' ? 1 : 0;
    const ok = x => x >= min && x !== ans;
    const near = MR.shuffle([ans + 1, ans - 1, ans + 2, ans - 2].filter(ok));
    const far = (ans >= 10 || t.level >= 5) ? MR.shuffle([ans + 10, ans - 10].filter(ok)) : [];
    const order = [...near.slice(0, 2), ...far.slice(0, 1), ...near.slice(2), ans + 3, ans - 3, ans + 4, ans + 5, ans - 4];
    const pool = []; order.forEach(x => { if (ok(x) && !pool.includes(x)) pool.push(x); });
    return MR.shuffle([ans, ...pool.slice(0, n - 1)]);
  };

  /* Hilfe: Material zur Aufgabe (als HTML) */
  MR.dotsSVG = function (n, layout, pos, split) {
    if (layout === 'free') {
      const c = (pos || freePositions(n)).map(p => `<circle cx="${p.x}" cy="${p.y}" r="6.5" fill="var(--accent)"/>`).join('');
      return `<svg viewBox="0 0 100 60" aria-hidden="true">${c}</svg>`;
    }
    const frames = Math.max(1, Math.ceil(n / 10)); let out = '';
    for (let f = 0; f < frames; f++) {
      const y0 = f * 44;
      for (let i = 0; i < 10; i++) {
        const x = 5 + (i % 5) * 18, y = y0 + 4 + Math.floor(i / 5) * 18, idx = f * 10 + i;
        out += `<rect x="${x}" y="${y}" width="17" height="17" rx="3" fill="none" stroke="var(--line)" stroke-width="1.2"/>`;
        if (idx < n) {
          const col = (split != null && idx >= split) ? 'var(--accent2)' : 'var(--accent)';
          out += `<circle cx="${x + 8.5}" cy="${y + 8.5}" r="6" fill="${col}"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 100 ${frames * 44}" aria-hidden="true">${out}</svg>`;
  };
  MR.hintHTML = function (t) {
    if (t.strand === 'mengen') return MR.dotsSVG(t.answer, 'frame');
    if (t.op === '+' && t.level <= 4) return MR.dotsSVG(t.a + t.b, 'frame', null, t.a) + `<div>${t.a} und ${t.b} zusammen</div>`;
    if (t.op === '-' && t.level <= 4) return MR.dotsSVG(t.a, 'frame') + `<div>Von ${t.a} nimm ${t.b} weg</div>`;
    if (t.op === '+') {
      const tz = Math.floor(t.b / 10) * 10, ez = t.b % 10;
      return `<div>Erst ${t.a} + ${tz} = ${t.a + tz}, dann + ${ez}</div>`;
    }
    const tz = Math.floor(t.b / 10) * 10, ez = t.b % 10;
    return `<div>Erst ${t.a} − ${tz} = ${t.a - tz}, dann − ${ez}</div>`;
  };
  MR.shapeSVG = function (sh) {
    let body;
    if (sh.s === 'circle') body = `<circle cx="50" cy="50" r="44" fill="${sh.c}"/>`;
    else if (sh.s === 'square') body = `<rect x="8" y="8" width="84" height="84" rx="8" fill="${sh.c}"/>`;
    else body = `<polygon points="50,6 94,92 6,92" fill="${sh.c}"/>`;
    return `<svg class="shape" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
  };
})(window.MR);
