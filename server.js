// BeHeard server: serves the pages and relays small "signaling" messages.
// Audio itself never touches this server; it flows phone -> admin laptop (WebRTC).
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');

const PIN = process.env.ADMIN_PIN || '1234';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static('public'));
app.get('/admin', (req, res) => res.redirect('/admin.html'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let admin = null;
let liveId = null;
let nextId = 0;
const users = new Map(); // id -> { id, name, hand (timestamp|null), ws }

const send = (ws, m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m));
const queue = () => [...users.values()].filter(u => u.hand).sort((a, b) => a.hand - b.hand);

// Push the latest picture of the room to everybody.
function sync() {
  const q = queue();
  send(admin, {
    type: 'roster',
    live: liveId,
    users: [...users.values()].map(u => ({ id: u.id, name: u.name, hand: u.hand })),
  });
  users.forEach(u =>
    send(u.ws, { type: 'state', pos: u.hand ? q.indexOf(u) + 1 : 0, live: u.id === liveId, host: !!admin })
  );
}

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }

    // ---- Admin login
    if (m.type === 'admin') {
      if (m.pin !== PIN) return send(ws, { type: 'denied' });
      admin = ws; ws.role = 'admin';
      send(ws, { type: 'admin-ok' });
      return sync();
    }

    // ---- Admin commands
    if (ws.role === 'admin') {
      const u = users.get(m.to);
      if (m.type === 'grant' && u) {
        const prev = users.get(liveId);
        if (prev && prev !== u) send(prev.ws, { type: 'revoke' });
        liveId = u.id; u.hand = null;
        send(u.ws, { type: 'grant' });
        sync();
      } else if (m.type === 'revoke' && u) {
        if (liveId === u.id) liveId = null;
        send(u.ws, { type: 'revoke' });
        sync();
      } else if (m.type === 'endall') {
        users.forEach(x => { x.hand = null; send(x.ws, { type: 'revoke' }); });
        liveId = null; sync();
      } else if ((m.type === 'answer' || m.type === 'ice') && u) {
        send(u.ws, m);
      }
      return;
    }

    // ---- Audience
    if (m.type === 'join') {
      const u = { id: ++nextId, name: String(m.name || 'Guest').slice(0, 30), hand: null, ws };
      ws.user = u; users.set(u.id, u);
      return sync();
    }
    const u = ws.user; if (!u) return;
    if (m.type === 'hand') { if (!u.hand && liveId !== u.id) { u.hand = Date.now(); sync(); } }
    else if (m.type === 'lower') { u.hand = null; sync(); }
    else if (m.type === 'done') {
      if (liveId === u.id) liveId = null;
      send(admin, { type: 'done', from: u.id }); sync();
    }
    else if (m.type === 'offer' || m.type === 'ice') send(admin, { ...m, from: u.id });
  });

  ws.on('close', () => {
    if (ws === admin) { admin = null; liveId = null; return sync(); }
    if (ws.user) {
      users.delete(ws.user.id);
      if (liveId === ws.user.id) liveId = null;
      sync();
    }
  });
});

server.listen(PORT, () => {
  console.log(`BeHeard running  ->  http://localhost:${PORT}/admin.html   (PIN: ${PIN})`);
  console.log('Phones need HTTPS for the mic. Run:  npx ngrok http ' + PORT);
});