const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

let waitingUser = null;
const activePairs = new Map();

app.get('/', (req, res) => {
  res.json({ message: 'Ohmingle Server Running!' });
});

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  io.emit('onlineCount', io.engine.clientsCount);

  socket.on('findStranger', () => {
    console.log('🔍 Finding stranger for:', socket.id);
    console.log('⏳ Current waiting user:', waitingUser);

    // Remove from active pairs if exists
    const existingStranger = activePairs.get(socket.id);
    if (existingStranger) {
      io.to(existingStranger).emit('strangerLeft');
      activePairs.delete(existingStranger);
      activePairs.delete(socket.id);
    }

    if (waitingUser && waitingUser !== socket.id && io.sockets.sockets.get(waitingUser)) {
      // Match found!
      const stranger = waitingUser;
      waitingUser = null;

      activePairs.set(socket.id, stranger);
      activePairs.set(stranger, socket.id);

      console.log('🎉 Matched:', socket.id, '↔', stranger);

      // Tell both they are connected
      socket.emit('strangerFound', { role: 'caller' });
      io.to(stranger).emit('strangerFound', { role: 'receiver' });

    } else {
      // Wait for stranger
      waitingUser = socket.id;
      socket.emit('waiting');
      console.log('⏳ Waiting:', socket.id);
    }
  });

  socket.on('message', (data) => {
    const stranger = activePairs.get(socket.id);
    if (stranger) {
      io.to(stranger).emit('message', data);
    }
  });

  socket.on('offer', (data) => {
    const stranger = activePairs.get(socket.id);
    console.log('📤 Offer from', socket.id, 'to', stranger);
    if (stranger) {
      io.to(stranger).emit('offer', data);
    }
  });

  socket.on('answer', (data) => {
    const stranger = activePairs.get(socket.id);
    console.log('📤 Answer from', socket.id, 'to', stranger);
    if (stranger) {
      io.to(stranger).emit('answer', data);
    }
  });

  socket.on('iceCandidate', (data) => {
    const stranger = activePairs.get(socket.id);
    if (stranger) {
      io.to(stranger).emit('iceCandidate', data);
    }
  });

  socket.on('skip', () => {
    const stranger = activePairs.get(socket.id);
    if (stranger) {
      io.to(stranger).emit('strangerLeft');
      activePairs.delete(stranger);
      activePairs.delete(socket.id);
    }
    if (waitingUser === socket.id) {
      waitingUser = null;
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    const stranger = activePairs.get(socket.id);
    if (stranger) {
      io.to(stranger).emit('strangerLeft');
      activePairs.delete(stranger);
      activePairs.delete(socket.id);
    }
    if (waitingUser === socket.id) {
      waitingUser = null;
    }
    io.emit('onlineCount', io.engine.clientsCount);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Ohmingle server running on port ${PORT}`);
});