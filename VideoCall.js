const express = require('express');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

const privateKey = fs.readFileSync('cqrdpg.com.key', 'utf8');
const certificate = fs.readFileSync('cqrdpg.com_bundle.crt', 'utf8');

const credentials = {
  key: privateKey,
  cert: certificate
};

const server = https.createServer(credentials, app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const roomUsers = {};

app.get('/videocall/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Video Call Server is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/videocall/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = roomUsers[roomId];
  const userCount = room ? room.size : 0;
  const users = room ? Array.from(room.values()).map(u => u.userId) : [];
  
  res.json({
    roomId,
    userCount,
    users,
    exists: !!room
  });
});

io.on('connection', (socket) => {
  console.log('新用户连接:', socket.id);

  socket.on('join-room', (roomId, userId) => {
    if (!roomId || !userId) {
      socket.emit('error', { message: '房间号或用户ID无效' });
      return;
    }

    if (socket.roomId && roomUsers[socket.roomId]) {
      leaveRoom(socket);
    }

    socket.roomId = roomId;
    socket.userId = userId;
    socket.join(roomId);

    if (!roomUsers[roomId]) {
      roomUsers[roomId] = new Map();
    }
    
    const isFirstUser = roomUsers[roomId].size === 0;
    
    roomUsers[roomId].set(socket.id, {
      userId: userId,
      socketId: socket.id,
      joinedAt: Date.now()
    });

    console.log(`${userId} 加入了房间 ${roomId}, 是否第一个: ${isFirstUser}`);

    const userList = Array.from(roomUsers[roomId].values()).map(u => u.userId);
    
    // 发送用户列表和角色信息
    socket.emit('user-list', {
      users: userList,
      isInitiator: !isFirstUser // 第一个用户不是发起方，后续用户是发起方
    });
    
    // 通知其他人，并告诉对方应该作为被动方
    if (!isFirstUser) {
      socket.to(roomId).emit('user-connected', {
        userId: userId,
        isInitiator: false // 已存在的用户作为被动方
      });
    }
    
    socket.emit('join-success', { 
      roomId, 
      userId, 
      userList,
      isFirstUser 
    });
  });

  socket.on('send-signal', (data) => {
    const { roomId, targetUserId, signal } = data;
    
    if (!roomId || !targetUserId || !signal) {
      return;
    }
    
    const targetSocket = findSocketByUserId(roomId, targetUserId);
    if (targetSocket) {
      console.log(`转发信令: ${socket.userId} -> ${targetUserId}, type: ${signal.type || 'candidate'}`);
      io.to(targetSocket).emit('receive-signal', {
        signal: signal,
        fromUserId: socket.userId
      });
    }
  });

  socket.on('disconnect', () => {
    leaveRoom(socket);
    console.log('用户断开:', socket.userId || socket.id);
  });
  
  socket.on('leave-room', () => {
    leaveRoom(socket);
    socket.emit('left-room', { message: '已离开房间' });
  });
});

function leaveRoom(socket) {
  if (socket.roomId && socket.userId) {
    console.log(`${socket.userId} 离开房间 ${socket.roomId}`);
    
    if (roomUsers[socket.roomId]) {
      roomUsers[socket.roomId].delete(socket.id);
      
      if (roomUsers[socket.roomId].size === 0) {
        delete roomUsers[socket.roomId];
      } else {
        const remainingUsers = Array.from(roomUsers[socket.roomId].values()).map(u => u.userId);
        io.to(socket.roomId).emit('user-list', { users: remainingUsers });
        socket.to(socket.roomId).emit('user-disconnected', socket.userId);
      }
    }
    
    socket.leave(socket.roomId);
    delete socket.roomId;
    delete socket.userId;
  }
}

function findSocketByUserId(roomId, userId) {
  if (!roomUsers[roomId]) return null;
  
  for (const [socketId, userInfo] of roomUsers[roomId]) {
    if (userInfo.userId === userId) {
      return socketId;
    }
  }
  return null;
}

const PORT = process.env.PORT || 8443;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTPS 服务器运行在端口 ${PORT}`);
});