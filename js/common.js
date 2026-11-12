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

  const PALETTE = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#b197fc', '#f783ac', '#e599f7', '#66d9e8', '#a9e34b'];
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
