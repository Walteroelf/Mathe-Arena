'use strict';
/*
  Eingabearten für die Schüler-Seite:
  - Tippen:  normales Antippen
  - Taster:  Taster-Adapter und iSwitch melden sich als Tastatur (Leertaste, Enter ...).
             Ein Taster: automatisches Durchlaufen der Antworten (Scannen), Druck wählt die markierte.
             Zwei Taster: Taster 2 = Weiter, Taster 1 = Auswählen.
  - Blick:   Augensteuerung bewegt den Zeiger. Verweilen auf einem Feld wählt es (Ring füllt sich).
             Ein Klick der Augensteuerung funktioniert ebenfalls.
*/
(function (MR) {
  const MOD = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'Unidentified'];
  const LABELS = { ' ': 'Leertaste', 'Enter': 'Enter', 'ArrowLeft': 'Pfeil links', 'ArrowRight': 'Pfeil rechts', 'ArrowUp': 'Pfeil hoch', 'ArrowDown': 'Pfeil runter', 'Tab': 'Tab', 'Escape': 'Escape', 'Backspace': 'Löschtaste' };
  const keyLabel = k => LABELS[k] || (k && k.length === 1 ? k.toUpperCase() : k);
  const isField = t => t && t.matches && t.matches('input,select,textarea');

  const Sw = {
    handlers: { select: null, next: null },
    learning: null,   // { cb(key) }
    testCb: null,     // (key, down, status) im Einstellungsfenster
    cfgFn: () => null,
    last: 0,
    isSelect(sw, key) { const next = sw.nextKeys.includes(key); return sw.any ? !next : sw.keys.includes(key); },
    isNext(sw, key) { return sw.nextKeys.includes(key); }
  };

  document.addEventListener('keydown', e => {
    if (MOD.includes(e.key)) return;
    const cfg = Sw.cfgFn();
    if (Sw.learning) { e.preventDefault(); const l = Sw.learning; Sw.learning = null; l.cb(e.key); return; }
    if (Sw.testCb) {
      if (isField(e.target)) return;
      if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
      if (!e.repeat && cfg) Sw.testCb(e.key, true, Sw.isSelect(cfg.sw, e.key) ? 'select' : (Sw.isNext(cfg.sw, e.key) ? 'next' : 'none'));
      return;
    }
    if (!cfg || cfg.input !== 'switch' || isField(e.target)) return;
    const sw = cfg.sw, isNext = Sw.isNext(sw, e.key), isSel = Sw.isSelect(sw, e.key);
    if (!isNext && !isSel) return;
    e.preventDefault();
    if (e.repeat) return;
    const now = performance.now();
    if (now - Sw.last < sw.lockMs) return;          // Sperrzeit gegen Doppeldrücke
    Sw.last = now;
    const h = isNext ? Sw.handlers.next : Sw.handlers.select;
    if (h) h();
  });
  document.addEventListener('keyup', e => {
    if (MOD.includes(e.key) || !Sw.testCb) return;
    Sw.testCb(e.key, false);
  });

  /* Scannen: markiert nacheinander jede Antwort */
  class Scanner {
    constructor(els, onPick, sw) {
      this.els = els; this.onPick = onPick; this.sw = sw; this.i = -1; this.t = null; this.dead = false; this.w = null;
      this.two = !!(sw.nextKeys && sw.nextKeys.length);
    }
    mark() { this.els.forEach((e, j) => e.classList.toggle('scan', j === this.i)); }
    advance() { this.i = (this.i + 1) % this.els.length; this.mark(); }
    start() {
      this.dead = false; this.i = -1; this.mark();
      Sw.handlers.select = () => this.select();
      Sw.handlers.next = () => { if (this.two) this.advance(); };
      this.w = setTimeout(() => {
        if (this.dead) return;
        this.advance();
        if (!this.two) this.t = setInterval(() => this.advance(), this.sw.scanMs);
      }, 900);
    }
    select() { if (this.i < 0 || this.dead) return; const i = this.i; this.stop(); this.onPick(i); }
    stop() {
      this.dead = true; clearInterval(this.t); clearTimeout(this.w);
      Sw.handlers.select = null; Sw.handlers.next = null;
      this.els.forEach(e => e.classList.remove('scan'));
    }
  }

  /* Verweilen (Blicksteuerung) */
  const Dwell = {
    attach(el, fn, o) {
      o = o || {}; const ms = o.ms || 1200; let t = null, cool = 0;
      const start = () => {
        if (t || performance.now() < cool) return;
        el.style.setProperty('--dwell', ms + 'ms'); el.classList.add('dwelling');
        t = setTimeout(() => {
          t = null; el.classList.remove('dwelling');
          cool = performance.now() + (o.repeat ? 500 : 1500);
          fn();
          if (o.repeat && el.matches(':hover')) setTimeout(start, 550);
        }, ms);
      };
      const stop = () => { clearTimeout(t); t = null; el.classList.remove('dwelling'); };
      el.addEventListener('pointerenter', start);
      el.addEventListener('pointerleave', stop);
      el.addEventListener('pointercancel', stop);
      return stop;
    }
  };

  MR.Input = { Sw, Scanner, Dwell, keyLabel };
})(window.MR);
