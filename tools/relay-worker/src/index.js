// relay-worker — the same room relay as tools/relay.py, as a Cloudflare Worker with one Durable Object per room, for a URL that
// does not change when a laptop sleeps. Deploy (once, after `npx wrangler login`):
//   cd tools/relay-worker && npx wrangler deploy
// then open the game with ?relay=wss://<worker-name>.<account>.workers.dev (remembered in localStorage) or set DEFAULT_RELAY in v2/main.js.
// Protocol (JSON text frames): client → {t:'hello', room, level, fresh} once, then {t:'s', ...state} eight times a second;
// relay → {t:'welcome', pid, level, peers}, {t:'join', pid, level}, {t:'leave', pid}, and every peer's {t:'s', pid, ...state}.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.headers.get('Upgrade') !== 'websocket') return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    // the room is named in the first message, which the socket cannot see before it is accepted, so the room comes from the query (?room=) or the path
    const room = (url.searchParams.get('room') || url.pathname.slice(1) || 'lobby').slice(0, 32);
    const id = env.ROOMS.idFromName(room);
    return env.ROOMS.get(id).fetch(req);
  }
};

export class Room {
  constructor(state) { this.state = state; this.level = null; this.next = 1; this.members = new Map(); this.epoch = Date.now() / 1000; }
  async fetch(req) {
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    server.accept(); const pid = this.next++;
    server.addEventListener('message', (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'hello') {
        this.members.set(pid, server);
        if (this.level === null || m.fresh || this.members.size === 1) this.level = m.level || null;
        this.send(server, { t: 'welcome', pid, level: this.level, peers: [...this.members.keys()].filter((p) => p !== pid), now: Date.now() / 1000, epoch: this.epoch });
        for (const [p, w] of this.members) if (p !== pid) this.send(w, { t: 'join', pid, level: this.level });
      } else if (m.t === 's' && this.members.has(pid)) {
        m.pid = pid; const s = JSON.stringify(m);
        for (const [p, w] of this.members) if (p !== pid) { try { w.send(s); } catch (e) { this.drop(p); } }
      } else if (m.t === 'ping') this.send(server, { t: 'pong', now: Date.now() / 1000, c: m.c });
    });
    const bye = () => this.drop(pid);
    server.addEventListener('close', bye); server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
  send(w, obj) { try { w.send(JSON.stringify(obj)); } catch (e) {} }
  drop(pid) {
    if (!this.members.has(pid)) return; const w = this.members.get(pid); this.members.delete(pid); try { w.close(); } catch (e) {}
    for (const [, o] of this.members) this.send(o, { t: 'leave', pid });
  }
}
