// VIBEBALL — real-time 1v1 pong-soccer over WebSockets.
// Server is authoritative: it simulates the ball and broadcasts state ~20x/sec.
const { WebSocketServer } = require('ws');

const W = 640, H = 400, PAD_H = 80, WIN_SCORE = 5;
const TICK = 40; // 25 fps sim
const GOAL_LINES = [
  'GOOOAL! the crowd (3 people) goes wild',
  'SCORED! somewhere, a vuvuzela weeps with joy',
  'BANGER! frame that one',
  'the keeper (nobody) should have saved that',
  'clinical finish. disrespected goalkeeper'
];

function makeBall(dir) {
  const speed = 4.2;
  const angle = (Math.random() * .6 - .3);
  return { x: W / 2, y: H / 2, vx: dir * speed * Math.cos(angle), vy: speed * Math.sin(angle) };
}

function attach(server) {
  const wss = new WebSocketServer({ server, path: '/arena' });
  const rooms = new Map();

  function getRoom(code) {
    let r = rooms.get(code);
    if (!r) {
      r = {
        code, players: [null, null], names: ['Player 1', 'Player 2'],
        pads: [H / 2, H / 2], ball: makeBall(1), sc: [0, 0],
        playing: false, winner: -1, loop: null, spectators: []
      };
      rooms.set(code, r);
    }
    return r;
  }

  function broadcast(r, msg) {
    const data = JSON.stringify(msg);
    for (const c of [...r.players, ...r.spectators]) {
      if (c && c.ws.readyState === 1) c.ws.send(data);
    }
  }

  function startLoop(r) {
    if (r.loop) return;
    r.playing = true;
    r.loop = setInterval(() => {
      const b = r.ball;
      b.x += b.vx; b.y += b.vy;
      if (b.y < 10) { b.y = 10; b.vy *= -1; }
      if (b.y > H - 10) { b.y = H - 10; b.vy *= -1; }
      // paddles at x=30 and x=W-30
      if (b.x < 44 && b.vx < 0 && Math.abs(b.y - r.pads[0]) < PAD_H / 2 + 8) {
        b.x = 44; b.vx *= -1.04; b.vy += ((b.y - r.pads[0]) / (PAD_H / 2)) * 2.4;
        b.vy = Math.max(-7, Math.min(7, b.vy));
      }
      if (b.x > W - 44 && b.vx > 0 && Math.abs(b.y - r.pads[1]) < PAD_H / 2 + 8) {
        b.x = W - 44; b.vx *= -1.04; b.vy += ((b.y - r.pads[1]) / (PAD_H / 2)) * 2.4;
        b.vy = Math.max(-7, Math.min(7, b.vy));
      }
      let scored = false;
      if (b.x < -14) { r.sc[1]++; scored = true; }
      if (b.x > W + 14) { r.sc[0]++; scored = true; }
      if (scored) {
        b.x = W / 2; b.y = H / 2;
        b.vx = (r.sc[0] > r.sc[1] ? -1 : 1) === 1 ? -4.2 : 4.2; // serve toward whoever conceded
        b.vx = Math.random() < .5 ? -4.2 : 4.2;
        b.vy = (Math.random() - .5) * 5;
        broadcast(r, { t: 'goal', line: GOAL_LINES[Math.floor(Math.random() * GOAL_LINES.length)], sc: r.sc });
        __checkWin(r);
      }
      broadcast(r, { t: 's', b: [+b.x.toFixed(1), +b.y.toFixed(1)], p: [+r.pads[0].toFixed(1), +r.pads[1].toFixed(1)], sc: r.sc });
    }, TICK);
  }

  function __checkWin(r) {
    if (r.sc[0] >= WIN_SCORE || r.sc[1] >= WIN_SCORE) {
      r.winner = r.sc[0] >= WIN_SCORE ? 0 : 1;
      clearInterval(r.loop); r.loop = null; r.playing = false;
      broadcast(r, {
        t: 'end', winner: r.winner, names: r.names,
        line: r.winner === 0
          ? `${r.names[0]} WINS THE VIBEBALL CUP! ${r.names[1]} must now do interviews.`
          : `${r.names[1]} WINS! ${r.names[0]} blames the pitch, the ball, and the economy.`
      });
    }
  }

  function cleanup(r) {
    if (!r.players[0] && !r.players[1] && !r.spectators.length) {
      if (r.loop) clearInterval(r.loop);
      rooms.delete(r.code);
    }
  }

  wss.on('connection', ws => {
    ws.on('error', e => console.log('[arena] ws error:', e.message));
    ws.on('message', raw => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      console.log('[arena] msg:', String(raw).slice(0, 90));
      if (m.t === 'join') {
        const code = String(m.room || '').toUpperCase().slice(0, 6);
        const r = getRoom(code);
        const name = String(m.name || 'Anonymous Vibes').slice(0, 18);
        let slot = -1;
        if (!r.players[0]) slot = 0; else if (!r.players[1]) slot = 1;
        const client = { ws, room: r, slot };
        if (slot === -1) { r.spectators.push(client); }
        else {
          r.players[slot] = client; r.names[slot] = name;
          if (slot === 1 && !r.playing && r.winner === -1) startLoop(r);
          if (slot === 1) broadcast(r, { t: 'start', names: r.names });
        }
        ws.client = client;
        ws.send(JSON.stringify({
          t: 'joined', room: r.code, slot, names: r.names,
          waiting: r.spectators.includes(client) || !r.players[1]
        }));
        if (slot !== -1 && r.players[0] && r.players[1] && !r.playing && r.winner === -1) startLoop(r);
        return;
      }
      const c = ws.client;
      if (!c || c.slot < 0) return;
      const r = c.room;
      if (m.t === 'pos') {
        const y = Math.max(PAD_H / 2, Math.min(H - PAD_H / 2, Number(m.y) || H / 2));
        r.pads[c.slot] = y;
      }
      if (m.t === 'rematch') {
        r.sc = [0, 0]; r.winner = -1; r.ball = makeBall(1);
        broadcast(r, { t: 'start', names: r.names });
        startLoop(r);
      }
    });

    ws.on('close', () => {
      const c = ws.client;
      if (!c) return;
      const r = c.room;
      if (c.slot >= 0 && r.players[c.slot] === c) {
        r.players[c.slot] = null;
        broadcast(r, { t: 'left', who: c.slot, names: r.names });
        if (r.loop) { clearInterval(r.loop); r.loop = null; r.playing = false; }
      }
      const si = r.spectators.indexOf(c);
      if (si >= 0) r.spectators.splice(si, 1);
      setTimeout(() => cleanup(r), 3000);
    });
  });

  console.log('[arena] VIBEBALL multiplayer online at /arena');
}

module.exports = { attach };
