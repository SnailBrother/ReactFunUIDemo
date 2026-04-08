import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import styles from './VideoCall.module.css';

const socket = io('https://webrtc-signaling-server-production.up.railway.app');

export default function VideoCall() {
  const [roomId, setRoomId] = useState('test123');
  const [isJoined, setIsJoined] = useState(false);
  const [peers, setPeers] = useState([]); // 存储所有远程对等连接信息

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // 存储所有 peer 连接，key: userId
  const socketRef = useRef(socket);
  const userIdRef = useRef(Math.random().toString(36).substring(7)); // 生成唯一用户ID

  // 获取摄像头/麦克风
  const getMedia = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('请允许摄像头/麦克风权限！');
      console.error(err);
    }
  };

  // 清理单个连接
  const cleanupPeer = (userId) => {
    if (peerConnectionsRef.current[userId]) {
      peerConnectionsRef.current[userId].destroy();
      delete peerConnectionsRef.current[userId];
    }
    // 从状态中移除该用户
    setPeers(prev => prev.filter(peer => peer.userId !== userId));
  };

  // 清理所有连接
  const cleanupAll = () => {
    Object.keys(peerConnectionsRef.current).forEach(userId => {
      peerConnectionsRef.current[userId].destroy();
    });
    peerConnectionsRef.current = {};
    setPeers([]);
    if (remoteVideoRefs.current) {
      Object.keys(remoteVideoRefs.current).forEach(userId => {
        if (remoteVideoRefs.current[userId]) {
          remoteVideoRefs.current[userId].srcObject = null;
        }
      });
    }
  };

  // 存储远程视频的 refs
  const remoteVideoRefs = useRef({});

  // 创建对等连接
  const createPeer = (targetUserId, isInitiator = true, stream) => {
    const peer = new SimplePeer({
      initiator: isInitiator,
      stream: stream || localStreamRef.current,
      trickle: false
    });

    peer.on('signal', (signal) => {
      socketRef.current.emit('signal', {
        roomId,
        signal,
        targetUserId,
        fromUserId: userIdRef.current
      });
    });

    peer.on('stream', (remoteStream) => {
      // 当收到远程流时，更新对应的视频元素
      if (remoteVideoRefs.current[targetUserId]) {
        remoteVideoRefs.current[targetUserId].srcObject = remoteStream;
      } else {
        // 如果 ref 还不存在，等待一下再尝试
        const checkRef = setInterval(() => {
          if (remoteVideoRefs.current[targetUserId]) {
            remoteVideoRefs.current[targetUserId].srcObject = remoteStream;
            clearInterval(checkRef);
          }
        }, 100);
      }
    });

    peer.on('error', (err) => {
      console.error(`与用户 ${targetUserId} 的连接错误:`, err);
    });

    peer.on('close', () => {
      console.log(`与用户 ${targetUserId} 的连接已关闭`);
      cleanupPeer(targetUserId);
    });

    peerConnectionsRef.current[targetUserId] = peer;
    return peer;
  };

  // 加入房间
  const joinRoom = () => {
    if (!roomId) return alert('输入房间号');
    
    socketRef.current.emit('join-room', {
      roomId,
      userId: userIdRef.current
    });
    setIsJoined(true);
  };

  // 发起与特定用户的通话（可选，用于手动呼叫）
  const callUser = (targetUserId) => {
    if (!localStreamRef.current) {
      alert('请先获取设备权限');
      return;
    }
    if (!isJoined) {
      alert('请先加入房间');
      return;
    }
    
    if (!peerConnectionsRef.current[targetUserId]) {
      createPeer(targetUserId, true, localStreamRef.current);
    }
  };

  useEffect(() => {
    getMedia();

    // 监听新用户加入房间
    socketRef.current.on('user-joined', (data) => {
      console.log('新用户加入:', data.userId);
      
      // 如果不是自己，创建连接
      if (data.userId !== userIdRef.current && !peerConnectionsRef.current[data.userId]) {
        // 添加新用户到列表
        setPeers(prev => [...prev, { userId: data.userId, connected: false }]);
        
        // 主动发起连接
        createPeer(data.userId, true, localStreamRef.current);
      }
    });

    // 监听用户离开
    socketRef.current.on('user-left', (data) => {
      console.log('用户离开:', data.userId);
      cleanupPeer(data.userId);
    });

    // 监听信令
    socketRef.current.on('signal-receive', (data) => {
      // 忽略自己发送的信令
      if (data.fromUserId === userIdRef.current) return;
      
      // 如果还没有与该用户的连接，创建被动连接
      if (!peerConnectionsRef.current[data.fromUserId] && localStreamRef.current) {
        // 添加用户到列表
        setPeers(prev => {
          if (!prev.some(p => p.userId === data.fromUserId)) {
            return [...prev, { userId: data.fromUserId, connected: false }];
          }
          return prev;
        });
        
        // 创建被动连接
        createPeer(data.fromUserId, false, localStreamRef.current);
      }
      
      // 发送信令
      if (peerConnectionsRef.current[data.fromUserId]) {
        peerConnectionsRef.current[data.fromUserId].signal(data.signal);
      }
    });

    // 获取房间现有用户
    socketRef.current.on('room-users', (data) => {
      console.log('房间现有用户:', data.users);
      const otherUsers = data.users.filter(uid => uid !== userIdRef.current);
      
      otherUsers.forEach(userId => {
        if (!peerConnectionsRef.current[userId]) {
          setPeers(prev => [...prev, { userId, connected: false }]);
          createPeer(userId, true, localStreamRef.current);
        }
      });
    });

    // 组件卸载时清理
    return () => {
      socketRef.current.off('user-joined');
      socketRef.current.off('user-left');
      socketRef.current.off('signal-receive');
      socketRef.current.off('room-users');
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      cleanupAll();
    };
  }, []);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>多人视频通话 (WebRTC)</h2>

      <div className={styles.roomBox}>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="输入房间号"
          className={styles.input}
          disabled={isJoined}
        />
        <button 
          onClick={joinRoom} 
          className={styles.btn}
          disabled={isJoined}
        >
          {isJoined ? '已加入房间' : '加入房间'}
        </button>
      </div>

      <div className={styles.infoBox}>
        <p>当前房间: {roomId}</p>
        <p>您的ID: {userIdRef.current}</p>
        <p>在线人数: {peers.length + 1}</p>
      </div>

      <div className={styles.videoWrapper}>
        <div className={styles.videoCard}>
          <h4>本地画面 (我)</h4>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={styles.video}
          />
        </div>

        {peers.map((peer) => (
          <div key={peer.userId} className={styles.videoCard}>
            <h4>远程画面 - {peer.userId.substring(0, 8)}</h4>
            <video
              ref={(el) => {
                if (el) remoteVideoRefs.current[peer.userId] = el;
              }}
              autoPlay
              playsInline
              className={styles.video}
            />
            <div className={styles.connectionStatus}>
              {peer.connected ? '已连接' : '连接中...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}