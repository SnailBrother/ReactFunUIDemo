// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// 存储房间信息
const rooms = new Map(); // roomId -> { users: Map(userId -> socketId), createdAt }

// 生成房间ID
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 清理空房间
function cleanupEmptyRooms() {
  for (const [roomId, room] of rooms.entries()) {
    if (room.users.size === 0) {
      rooms.delete(roomId);
      console.log(`房间 ${roomId} 已清理`);
    }
  }
}

// 每5分钟清理一次空房间
setInterval(cleanupEmptyRooms, 5 * 60 * 1000);

io.on('connection', (socket) => {
  console.log(`用户连接: ${socket.id}`);
  
  let currentRoomId = null;
  let currentUserId = null;

  // 创建房间
  socket.on('create-room', async (data, callback) => {
    try {
      const roomId = generateRoomId();
      const userId = data.userId;
      
      const room = {
        users: new Map(),
        createdAt: Date.now()
      };
      room.users.set(userId, socket.id);
      rooms.set(roomId, room);
      
      currentRoomId = roomId;
      currentUserId = userId;
      
      socket.join(roomId);
      
      console.log(`房间创建: ${roomId}, 用户: ${userId}`);
      
      callback({
        success: true,
        roomId: roomId,
        users: []
      });
    } catch (error) {
      console.error('创建房间失败:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });

  // 加入房间
  socket.on('join-room', async (data, callback) => {
    try {
      const { roomId, userId } = data;
      
      if (!rooms.has(roomId)) {
        callback({
          success: false,
          error: '房间不存在'
        });
        return;
      }
      
      const room = rooms.get(roomId);
      
      // 检查用户是否已在房间中
      if (room.users.has(userId)) {
        // 更新socket id
        room.users.set(userId, socket.id);
      } else {
        room.users.set(userId, socket.id);
      }
      
      currentRoomId = roomId;
      currentUserId = userId;
      
      socket.join(roomId);
      
      // 获取房间内所有用户
      const users = Array.from(room.users.keys());
      
      console.log(`用户加入房间: ${roomId}, 用户: ${userId}, 房间人数: ${users.length}`);
      
      // 通知房间内其他用户有新用户加入
      socket.to(roomId).emit('user-joined', {
        userId: userId,
        users: users
      });
      
      callback({
        success: true,
        roomId: roomId,
        users: users.filter(id => id !== userId)
      });
    } catch (error) {
      console.error('加入房间失败:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });

  // 信令消息转发
  socket.on('signal', (data) => {
    const { toUserId, signal } = data;
    
    if (!currentRoomId) return;
    
    const room = rooms.get(currentRoomId);
    if (!room) return;
    
    const targetSocketId = room.users.get(toUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('signal', {
        fromUserId: currentUserId,
        signal: signal
      });
    }
  });

  // 获取房间信息
  socket.on('get-room-info', (data, callback) => {
    const { roomId } = data;
    
    if (!rooms.has(roomId)) {
      callback({
        success: false,
        error: '房间不存在'
      });
      return;
    }
    
    const room = rooms.get(roomId);
    callback({
      success: true,
      users: Array.from(room.users.keys())
    });
  });

  // 离开房间
  socket.on('leave-room', (data) => {
    if (currentRoomId && currentUserId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.users.delete(currentUserId);
        
        // 通知其他用户
        socket.to(currentRoomId).emit('user-left', {
          userId: currentUserId,
          users: Array.from(room.users.keys())
        });
        
        socket.leave(currentRoomId);
        
        console.log(`用户离开房间: ${currentRoomId}, 用户: ${currentUserId}`);
      }
    }
    
    currentRoomId = null;
    currentUserId = null;
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log(`用户断开: ${socket.id}`);
    
    if (currentRoomId && currentUserId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.users.delete(currentUserId);
        
        // 通知其他用户
        socket.to(currentRoomId).emit('user-left', {
          userId: currentUserId,
          users: Array.from(room.users.keys())
        });
        
        console.log(`用户断开房间: ${currentRoomId}, 用户: ${currentUserId}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`信令服务器运行在 http://localhost:${PORT}`);
});