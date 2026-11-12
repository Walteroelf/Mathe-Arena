'use strict';
/*
  Verbindung. Zwei Wege, gleiche Schnittstelle:
  - PeerJS/WebRTC (Standard): Die Geräte schicken sich Daten direkt. Der öffentliche
    PeerJS-Server vermittelt nur den Verbindungsaufbau (keine Namen, keine Lerndaten).
  - BroadcastChannel (?net=bc): Testbetrieb, alle Seiten im selben Browser, ohne Internet.

  MR.hostRoom(room, {onConn(conn), onStatus(s), onOpen(), onTaken()})   -> Tafel
  MR.joinRoom(room, {onData(d), onStatus(s), onOpen()})                  -> iPad, Lehrer-Gerät
  conn:  conn.send(obj), conn.on('data'|'close', fn), conn.close(), conn.open
*/
(function (MR) {
  const E = MR.Emitter;

  /* ---------- PeerJS ---------- */
  class PeerConn extends E {
    constructor(dc) {
      super(); this.dc = dc; this.id = dc.peer; this.open = !!dc.open;
      dc.on('open', () => { this.open = true; this.emit('open'); });
      dc.on('data', d => this.emit('data', d));
      dc.on('close', () => { this.open = false; this.emit('close'); });
      dc.on('error', () => { this.open = false; this.emit('close'); });
    }
    send(o) { try { if (this.dc.open) this.dc.send(o); } catch (e) { /* weiter */ } }
    close() { try { this.dc.close(); } catch (e) { /* weiter */ } }
  }
  const FATAL = ['network', 'server-error', 'socket-error', 'socket-closed'];

  function peerHost(room, h) {
    let peer = null, dead = false;
    const api = { room, close() { dead = true; try { peer && peer.destroy(); } catch (e) { /* weiter */ } } };
    function start() {
      if (dead) return;
      h.onStatus && h.onStatus('connecting');
      peer = new Peer(MR.PREFIX + room);
      peer.on('open', () => { h.onStatus && h.onStatus('open'); h.onOpen && h.onOpen(); });
      peer.on('connection', dc => { h.onConn && h.onConn(new PeerConn(dc)); });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* weiter */ } });
      peer.on('error', e => {
        if (e.type === 'unavailable-id') { h.onTaken && h.onTaken(); return; }
        h.onStatus && h.onStatus('error:' + e.type);
        if (FATAL.includes(e.type)) { try { peer.destroy(); } catch (_) { /* weiter */ } setTimeout(start, 4000); }
      });
    }
    start();
    return api;
  }

  function peerClient(room, h) {
    let peer = null, conn = null, dead = false, timer = null, opened = false;
    const api = {
      room,
      get open() { return !!(conn && conn.open); },
      send(o) { if (conn && conn.open) conn.send(o); },
      close() { dead = true; clearTimeout(timer); try { peer && peer.destroy(); } catch (e) { /* weiter */ } }
    };
    function retry(ms) { clearTimeout(timer); if (!dead) timer = setTimeout(connect, ms || 3000); }
    function connect() {
      if (dead) return;
      if (!peer || peer.destroyed) {
        h.onStatus && h.onStatus('connecting');
        peer = new Peer();
        peer.on('open', () => connect());
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { /* weiter */ } });
        peer.on('error', e => {
          h.onStatus && h.onStatus('error:' + e.type);
          if (e.type === 'peer-unavailable') retry(3000);
          else if (FATAL.includes(e.type)) { try { peer.destroy(); } catch (_) { /* weiter */ } peer = null; retry(4000); }
        });
        return;
      }
      if (!peer.open) return;
      if (conn) { try { conn.close(); } catch (e) { /* weiter */ } }
      h.onStatus && h.onStatus('connecting');
      opened = false;
      const c = new PeerConn(peer.connect(MR.PREFIX + room, { reliable: true }));
      conn = c;
      c.on('open', () => { opened = true; h.onStatus && h.onStatus('open'); h.onOpen && h.onOpen(); });
      c.on('data', d => { h.onData && h.onData(d); });
      c.on('close', () => { if (conn !== c) return; h.onStatus && h.onStatus('closed'); retry(2500); });
      setTimeout(() => { if (conn === c && !opened && !dead) { c.close(); retry(500); } }, 10000);
    }
    connect();
    return api;
  }

  /* ---------- BroadcastChannel (Test) ---------- */
  class BcConn extends E {
    constructor(ch, me, other) { super(); this.ch = ch; this.me = me; this.id = other; this.other = other; this.open = false; this.lastRx = Date.now(); }
    send(o) { if (this.open) this.ch.postMessage({ t: 'data', from: this.me, to: this.other, d: o }); }
    close() { try { this.ch.postMessage({ t: 'kick', from: this.me, to: this.other }); } catch (e) { /* weiter */ } this.open = false; this.emit('close'); }
  }

  function bcHost(room, h) {
    const ch = new BroadcastChannel('mr-' + room); const conns = {};
    const api = { room, close() { ch.close(); } };
    ch.onmessage = e => {
      const m = e.data; if (!m || m.to !== 'host') return;
      let c = conns[m.from];
      if (m.t === 'hello') {
        if (!c) { c = new BcConn(ch, 'host', m.from); conns[m.from] = c; c.open = true; h.onConn && h.onConn(c); }
        c.open = true; c.lastRx = Date.now();
        ch.postMessage({ t: 'ack', from: 'host', to: m.from });
      } else if (c) {
        c.lastRx = Date.now();
        if (m.t === 'data') c.emit('data', m.d);
        else if (m.t === 'ping') ch.postMessage({ t: 'pong', from: 'host', to: m.from });
        else if (m.t === 'bye') { c.open = false; c.emit('close'); delete conns[m.from]; }
      } else if (m.t === 'ping') {
        ch.postMessage({ t: 'lost', from: 'host', to: m.from });
      }
    };
    setInterval(() => {
      const now = Date.now();
      for (const k in conns) { const c = conns[k]; if (now - c.lastRx > 9000) { c.open = false; c.emit('close'); delete conns[k]; } }
    }, 3000);
    setTimeout(() => { h.onStatus && h.onStatus('open'); h.onOpen && h.onOpen(); }, 0);
    return api;
  }

  function bcClient(room, h) {
    const ch = new BroadcastChannel('mr-' + room); const me = 'c' + MR.rid(8);
    let open = false, lastRx = 0, dead = false;
    const api = {
      room,
      get open() { return open; },
      send(o) { if (open) ch.postMessage({ t: 'data', from: me, to: 'host', d: o }); },
      close() { dead = true; try { ch.postMessage({ t: 'bye', from: me, to: 'host' }); } catch (e) { /* weiter */ } ch.close(); }
    };
    ch.onmessage = e => {
      const m = e.data; if (!m || m.to !== me) return;
      lastRx = Date.now();
      if (m.t === 'ack') { if (!open) { open = true; h.onStatus && h.onStatus('open'); h.onOpen && h.onOpen(); } }
      else if (m.t === 'lost' || m.t === 'kick') { if (open) { open = false; h.onStatus && h.onStatus('closed'); } }
      else if (m.t === 'data') h.onData && h.onData(m.d);
    };
    function tick() {
      if (dead) return;
      if (open && Date.now() - lastRx > 9000) { open = false; h.onStatus && h.onStatus('closed'); }
      ch.postMessage({ t: open ? 'ping' : 'hello', from: me, to: 'host' });
    }
    h.onStatus && h.onStatus('connecting');
    setInterval(tick, 2000); tick();
    addEventListener('pagehide', () => { try { ch.postMessage({ t: 'bye', from: me, to: 'host' }); } catch (e) { /* weiter */ } });
    return api;
  }

  MR.hostRoom = (room, h) => (MR.NET === 'bc' ? bcHost(room, h || {}) : peerHost(room, h || {}));
  MR.joinRoom = (room, h) => (MR.NET === 'bc' ? bcClient(room, h || {}) : peerClient(room, h || {}));
})(window.MR);
