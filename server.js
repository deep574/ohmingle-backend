const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(cors({ origin: '*' }));
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: false },
  allowEIO3: true
});
app.get('/', (req, res) => res.json({ message: 'Ohmingle Server Running!' }));
let waitingUsers = [];
const activePairs = new Map();
let onlineUsers = new Set();
function broadcastOnlineCount() { io.emit('onlineCount', onlineUsers.size); }
io.on('connection', (socket) => {
  console.log('✅ Connected:', socket.id);
  onlineUsers.add(socket.id);
  broadcastOnlineCount();
  socket.on('findStranger', () => {
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
    if (waitingUsers.length > 0) {
      const partnerId = waitingUsers.shift();
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        activePairs.set(socket.id, partnerId);
        activePairs.set(partnerId, socket.id);
        socket.emit('strangerFound', { role: 'caller' });
        partnerSocket.emit('strangerFound', { role: 'callee' });
      } else { waitingUsers.push(socket.id); socket.emit('waiting'); }
    } else { waitingUsers.push(socket.id); socket.emit('waiting'); }
  });
  socket.on('offer', (offer) => { const p = activePairs.get(socket.id); if (p) { const ps = io.sockets.sockets.get(p); if (ps) ps.emit('offer', offer); } });
  socket.on('answer', (answer) => { const p = activePairs.get(socket.id); if (p) { const ps = io.sockets.sockets.get(p); if (ps) ps.emit('answer', answer); } });
  socket.on('iceCandidate', (c) => { const p = activePairs.get(socket.id); if (p) { const ps = io.sockets.sockets.get(p); if (ps) ps.emit('iceCandidate', c); } });
  socket.on('message', (data) => { const p = activePairs.get(socket.id); if (p) { const ps = io.sockets.sockets.get(p); if (ps) ps.emit('message', data); } });
  function disconnectFromPartner() {
    const p = activePairs.get(socket.id);
    if (p) { const ps = io.sockets.sockets.get(p); if (ps) ps.emit('strangerLeft'); activePairs.delete(socket.id); activePairs.delete(p); }
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
  }
  socket.on('skip', () => disconnectFromPartner());
  socket.on('disconnect', () => { console.log('❌ Disconnected:', socket.id); onlineUsers.delete(socket.id); disconnectFromPartner(); broadcastOnlineCount(); });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`🚀 Ohmingle backend running on port ${PORT}`));
