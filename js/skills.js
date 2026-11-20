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
      id: 's0', name: 'Stufe 0 · Taster und Ursache-Wirkung', short: 'S0', manual: true,
      levels: [
        { label: '0a Ursache-Wirkung', desc: 'Ein Druck löst Licht und Ton aus' },
        { label: '0b Reagieren', desc: 'Auf ein Signal warten, dann drücken' },
        { label: '0c Einsammeln', desc: '2 bis 3 Dinge nacheinander einsammeln, jeder Druck sammelt eines' },
        { label: '0d Auswählen', desc: 'Zwischen zwei Dingen wählen' },
        { label: '0e Zählen mit Taster', desc: 'So oft drücken, wie die Zahl zeigt (1 bis 3)' },
        { label: '0f Zählen bis 5', desc: 'So oft drücken, wie die Zahl zeigt (3 bis 5)' }
      ]
    },
    tippen: {
      id: 'tippen', name: 'Zählen und Tippen', short: 'Tippen', tapOnly: true,
      levels: [
        { label: 'Tippen und mitzählen bis 3' }, { label: 'Tippen und mitzählen bis 5' },
        { label: 'So oft tippen, wie Dinge da sind (bis 5)' }, { label: 'So oft tippen, wie Dinge da sind (bis 10)' }
      ]
    },
    spuren: {
      id: 'spuren', name: 'Zahlen nachspuren', short: 'Spuren', tapOnly: true,
      levels: [
        { label: 'Zahlen 1 bis 3 nachspuren' }, { label: 'Zahlen 0 bis 5 nachspuren' },
        { label: 'Zahlen 0 bis 9 nachspuren' }, { label: 'Zweistellige Zahlen nachspuren' }
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
  MR.STRAND_ORDER = ['s0', 'tippen', 'spuren', 'mengen', 'plus', 'minus'];
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
    { name: 'der orange Kreis', c: '#F39200', s: 'circle' },
    { name: 'das hellblaue Quadrat', c: '#4DB2E6', s: 'square' },
    { name: 'das gelbe Dreieck', c: '#FFD100', s: 'tri' },
    { name: 'der grüne Kreis', c: '#46A84A', s: 'circle' }
  ];
  function genS0(L) {
    if (L === 1) return { kind: 'fx', q: 'Drücke!', speak: 'Drücke!', tags: ['s0'] };
    if (L === 2) return { kind: 'react', q: 'Warte auf das Signal', speak: 'Warte. Wenn es leuchtet, drücke.', delay: R(1500, 4000), tags: ['s0'] };
    if (L === 3) { const n = R(2, 3); return { kind: 'collect', n, q: 'Sammle alles ein', speak: 'Sammle alles ein. Jeder Druck sammelt eins.', tags: ['s0'] }; }
    if (L === 4) {
      const two = MR.shuffle(SHAPES).slice(0, 2); const target = R(0, 1);
      return { kind: 'choose2', q: 'Wähle ' + two[target].name, speak: 'Wähle ' + two[target].name, shapes: two, target, tags: ['s0'] };
    }
    const n = L === 5 ? R(1, 3) : R(3, 5);
    return { kind: 'count', q: 'Drücke ' + n + ' Mal', speak: 'Drücke ' + n + ' Mal', n, tags: ['s0'] };
  }

  /* ---------- Zählen und Tippen: so oft tippen, wie Dinge zu sehen sind ---------- */
  function itemPositions(n) {
    const out = [];
    if (n > 5) { for (let i = 0; i < n; i++) out.push({ x: 12 + (i % 5) * 19, y: 18 + Math.floor(i / 5) * 24 }); return out; }
    const cols = n <= 3 ? n : (n === 4 ? 2 : 3), rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols, inRow = r === rows - 1 ? n - r * cols : cols;
      out.push({ x: 50 + (c - (inRow - 1) / 2) * 28, y: 31 + (r - (rows - 1) / 2) * 26 });
    }
    return out;
  }
  function genTippen(L) {
    const n = L === 1 ? R(1, 3) : L === 2 ? R(2, 5) : L === 3 ? R(2, 5) : R(4, 10);
    const confirm = L >= 3;
    return {
      kind: 'tapcount', n, confirm, answer: n, pos: itemPositions(n), tags: ['tippen'],
      q: confirm ? 'Tippe so oft, wie du Dinge siehst' : 'Tippe jedes Ding an und zähle mit',
      speak: confirm ? 'Tippe so oft, wie du Dinge siehst. Dann tippe auf Fertig.' : 'Tippe jedes Ding an und zähle mit.'
    };
  }

  /* ---------- Zahlen nachspuren (Strichform der Ziffern, 100 breit, 140 hoch) ---------- */
  const A = (cx, cy, rx, ry, a0, a1, n) => {
    n = n || 20; const out = [];
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return out;
  };
  MR.DIGITS = {
    '0': [A(50, 70, 30, 52, 270, -90, 30)],
    '1': [[[30, 44], [56, 18], [56, 125]]],
    '2': [[...A(50, 48, 28, 28, 195, 400, 20), [22, 125], [80, 125]]],
    '3': [[...A(48, 42, 25, 26, 200, 450, 18), ...A(48, 96, 28, 28, 270, 520, 20)]],
    '4': [[[62, 15], [18, 92], [84, 92]], [[62, 40], [62, 125]]],
    '5': [[[76, 18], [32, 18], [29, 68], ...A(46, 94, 32, 30, 235, 510, 26)]],
    '6': [[[66, 22], [46, 36], [30, 66], [24, 98], ...A(50, 98, 26, 28, 180, 540, 26)]],
    '7': [[[22, 18], [78, 18], [42, 125]]],
    '8': [A(50, 42, 24, 24, 270, 630, 26), A(50, 96, 28, 28, 270, 630, 28)],
    '9': [[...A(50, 44, 26, 26, 0, -360, 26), [76, 46], [70, 92], [48, 125], [26, 116]]]
  };
  function genSpuren(L) {
    let text;
    if (L === 1) text = String(R(1, 3));
    else if (L === 2) text = String(R(0, 5));
    else if (L === 3) text = String(R(0, 9));
    else text = String(R(10, 20));
    return { kind: 'trace', text, answer: +text, q: 'Fahre die Zahl nach', speak: 'Fahre die Zahl ' + text + ' nach.', tags: ['spuren'] };
  }
  GEN.tippen = genTippen; GEN.spuren = genSpuren;

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
      const c = (pos || freePositions(n)).map(p => `<circle cx="${p.x}" cy="${p.y}" r="6.5" fill="var(--accent)" stroke="var(--dunkelblau)" stroke-width="1.4"/>`).join('');
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
          out += `<circle cx="${x + 8.5}" cy="${y + 8.5}" r="6" fill="${col}" stroke="var(--dunkelblau)" stroke-width="1.2"/>`;
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
    if (sh.s === 'circle') body = `<circle cx="50" cy="50" r="42" fill="${sh.c}" stroke="#0D2B4E" stroke-width="5"/>`;
    else if (sh.s === 'square') body = `<rect x="9" y="9" width="82" height="82" rx="10" fill="${sh.c}" stroke="#0D2B4E" stroke-width="5"/>`;
    else body = `<polygon points="50,8 93,91 7,91" fill="${sh.c}" stroke="#0D2B4E" stroke-width="5" stroke-linejoin="round"/>`;
    return `<svg class="shape" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
  };
})(window.MR);
