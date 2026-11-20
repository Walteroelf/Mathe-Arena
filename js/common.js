'use strict';
/* Mathe-Arena: gemeinsame Hilfen (Zufall, Speicher, QR, Hash, Farben) */
window.MR = window.MR || {};
(function (MR) {
  MR.VERSION = '0.1.0';
  MR.PREFIX = 'mathe-arena-';
  MR.CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  MR.qs = new URLSearchParams(location.search);
  // ?net=bc: Testbetrieb ohne Internet, alle Seiten im selben Browser (BroadcastChannel)
  MR.NET = MR.qs.get('net') === 'bc' ? 'bc' : 'peer';
  MR.netQuery = MR.NET === 'bc' ? '?net=bc' : '';

  MR.hashParams = function () { return new URLSearchParams(location.hash.replace(/^#/, '')); };

  MR.genCode = function (n) {
    n = n || 4; let s = '';
    for (let i = 0; i < n; i++) s += MR.CODE_CHARS[Math.floor(Math.random() * MR.CODE_CHARS.length)];
    return s;
  };
  MR.rid = function (n) {
    n = n || 8; const c = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = '';
    for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  };
  MR.ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  MR.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  MR.shuffle = function (a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  MR.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  MR.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Speicher im Browser (nie Fehler nach außen)
  MR.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* egal */ } }
  };

  // Farben der Kinder (Ränder, Punkte, Balken) aus der Olympia-72-Palette, siehe design.css
  const PALETTE = ['#4DB2E6', '#46A84A', '#F39200', '#A6D27A', '#0067B1', '#9A4F00', '#FFD100', '#B9C1C8', '#1E6B2A', '#0D2B4E'];
  MR.colorOf = function (id) {
    let h = 0; const s = String(id);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  };

  MR.makeQR = function (url) {
    try {
      const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
      const n = qr.getModuleCount(), cell = 8, q = 3, size = (n + q * 2) * cell;
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) g.fillRect((k + q) * cell, (r + q) * cell, cell, cell);
      return c;
    } catch (e) { console.error(e); return null; }
  };

  MR.sha256 = async function (s) {
    if (window.crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
      return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return 'f' + (h >>> 0).toString(16);
  };

  MR.fmtTime = function (ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  MR.fmtDate = function (ts) {
    if (!ts) return '–';
    const d = new Date(ts);
    return d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  MR.download = function (name, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  // Kleine Ereignis-Hilfe
  MR.Emitter = class {
    constructor() { this._h = {}; }
    on(e, f) { (this._h[e] = this._h[e] || []).push(f); return this; }
    emit(e, ...a) { (this._h[e] || []).slice().forEach(f => { try { f(...a); } catch (err) { console.error(err); } }); }
  };

  // Pseudonym-Listen je Stil (nur Hauptwörter mit männlichem Artikel, damit "Roter Falke" stimmt)
  MR.THEMES = {
    jugend: {
      label: 'Jugend',
      adj: ['Blauer', 'Roter', 'Schwarzer', 'Goldener', 'Silberner', 'Grüner', 'Schneller', 'Wilder', 'Cooler', 'Eisiger', 'Neon', 'Stiller'],
      noun: ['Falke', 'Wolf', 'Panther', 'Adler', 'Hai', 'Tiger', 'Jaguar', 'Rabe', 'Blitz', 'Turbo', 'Donner', 'Komet', 'Racer', 'Kicker', 'Ninja', 'Pilot', 'Drache', 'Phönix', 'Skater', 'Surfer', 'Sprinter', 'Striker', 'Keeper']
    },
    kinder: {
      label: 'Kinder',
      adj: ['Roter', 'Blauer', 'Gelber', 'Grüner', 'Lila', 'Bunter', 'Lustiger', 'Kleiner'],
      noun: ['Bär', 'Fuchs', 'Hase', 'Igel', 'Löwe', 'Hund', 'Panda', 'Frosch', 'Delfin', 'Papagei', 'Pinguin', 'Tiger']
    },
    erwachsen: {
      label: 'Erwachsene',
      adj: ['Ruhiger', 'Klarer', 'Heller', 'Starker', 'Stiller', 'Weiter', 'Warmer'],
      noun: ['Anker', 'Fels', 'Berg', 'Stern', 'Pfad', 'Wind', 'Fluss', 'Baum', 'Kompass', 'Leuchtturm']
    }
  };
  MR.suggestNames = function (theme, n) {
    const T = MR.THEMES[theme] || MR.THEMES.jugend; const out = new Set();
    while (out.size < (n || 6)) out.add(MR.pick(T.adj) + ' ' + MR.pick(T.noun) + ' ' + MR.ri(10, 99));
    return Array.from(out);
  };
})(window.MR);

/* ---------- Linien-Symbole statt Emojis in Menüs und Knöpfen ----------
   Ersetzt bedienende Zeichen automatisch in jedem Text. Inhalts-Emojis (Pokal, Feuer, Blumen …) bleiben. */
(function () {
  const P = {
    hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 7-6 7-3 0-4.5-1.8-6-4.5L4 13.5a1.5 1.5 0 0 1 2.600-1.500L8 14"/>',
    zahnrad: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M18.400 5.600l-2.100 2.100M7.700 16.300l-2.100 2.100"/>',
    start: '<path d="M8 5.500v13l11-6.500z"/>',
    stopp: '<rect x="6" y="6" width="12" height="12" rx="1.500"/>',
    gruppe: '<circle cx="9" cy="8.500" r="3.200"/><path d="M3 19.500c.6-3.600 3-5.500 6-5.500s5.400 1.900 6 5.500M16 5.700a3.200 3.200 0 0 1 0 5.600M18 14.300c1.800.7 2.800 2.400 3.100 5.200"/>',
    lehrer: '<circle cx="12" cy="8" r="3.800"/><path d="M4.500 20.500c.8-4 3.800-6 7.500-6s6.700 2 7.500 6"/>',
    tafel: '<rect x="3" y="4.500" width="18" height="12" rx="1.500"/><path d="M8 20h8M12 16.500V20"/>',
    tablet: '<rect x="5.500" y="2.500" width="13" height="19" rx="2.500"/><path d="M10.500 18.500h3"/>',
    links: '<path d="M15 5.500 8.500 12l6.500 6.500"/>',
    schloss: '<rect x="5.500" y="10.500" width="13" height="9.500" rx="2"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
    tipp: '<path d="M9 17.500h6M10 20.500h4M12 3.500a5.500 5.500 0 0 0-3.200 10c.8.600 1.200 1.300 1.200 2.500h4c0-1.200.4-1.900 1.200-2.500A5.500 5.500 0 0 0 12 3.500z"/>',
    haken: '<path d="M4.500 12.500 10 18 19.500 6.500"/>',
    kreuz: '<path d="M6 6l12 12M18 6 6 18"/>',
    neu: '<path d="M4.500 12a7.500 7.500 0 0 1 13-5l2 2M19.500 4.500V9h-4.500"/><path d="M19.500 12a7.500 7.500 0 0 1-13 5l-2-2M4.500 19.500V15H9"/>',
    finger: '<path d="M3.500 12h17M7 8.500 3.500 12 7 15.500M17 8.500l3.500 3.500-3.500 3.500"/>',
    taster: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="3.500"/>',
    auge: '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="3"/>'
  };
  const M = { '✋': 'hand', '⚙': 'zahnrad', '⚙️': 'zahnrad', '▶': 'start', '▶️': 'start', '■': 'stopp', '👥': 'gruppe',
    '🧑‍🏫': 'lehrer', '👩‍🏫': 'lehrer', '📺': 'tafel', '📱': 'tablet', '◀': 'links', '🔒': 'schloss', '💡': 'tipp',
    '✓': 'haken', '✔': 'haken', '✕': 'kreuz', '↺': 'neu', '👆': 'finger', '🔘': 'taster', '👁': 'auge', '👁️': 'auge' };
  const rx = new RegExp(Object.keys(M).sort((a, b) => b.length - a.length).join('|'), 'g');
  const skip = /^(SCRIPT|STYLE|TEXTAREA|TITLE|OPTION|SVG|TEXT|TSPAN|CANVAS)$/i;
  function sprite() {
    if (document.getElementById('sym-sprite')) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.id = 'sym-sprite'; s.setAttribute('aria-hidden', 'true'); s.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    s.innerHTML = Object.keys(P).map(k => '<symbol id="s-' + k + '" viewBox="0 0 24 24">' + P[k] + '</symbol>').join('');
    document.body.appendChild(s);
  }
  function conv(n) {
    if (n.nodeType === 3) {
      const par = n.parentNode;
      if (!par || skip.test(par.nodeName) || !rx.test(n.nodeValue)) { rx.lastIndex = 0; return; }
      rx.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m; const t = n.nodeValue;
      while ((m = rx.exec(t))) {
        if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
        const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        sv.setAttribute('class', 'symbol'); sv.setAttribute('aria-hidden', 'true');
        sv.innerHTML = '<use href="#s-' + M[m[0]] + '"/>';
        frag.appendChild(sv); last = m.index + m[0].length;
      }
      if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
      par.replaceChild(frag, n);
    } else if (n.nodeType === 1 && !skip.test(n.nodeName)) {
      for (const c of Array.from(n.childNodes)) conv(c);
    }
  }
  function start() {
    sprite(); conv(document.body);
    new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') conv(m.target); else m.addedNodes.forEach(conv); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
