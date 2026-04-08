import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import styles from './VideoCall.module.css';

// 后端服务器地址
const SERVER_URL = 'https://cqrdpg.com';
const SOCKET_URL = SERVER_URL;

export default function VideoCall() {
  const [roomId, setRoomId] = useState('');
  const [isInRoom, setIsInRoom] = useState(false);
  const [users, setUsers] = useState([]);
  const [connectedPeers, setConnectedPeers] = useState(new Set());
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [debugInfo, setDebugInfo] = useState([]);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerInstancesRef = useRef({});
  const userIdRef = useRef('');
  const socketRef = useRef(null);
  const videoElementsRef = useRef({});
  const debugLogsRef = useRef([]);
  const pendingStreamsRef = useRef(new Map());
  const connectingPeersRef = useRef(new Set());
  const processedSignalsRef = useRef(new Set());
  const connectionEstablishedRef = useRef(new Set());
  const roomJoinTimeRef = useRef(null); // 记录加入房间的时间

  // 添加调试日志函数
  const addDebugLog = useCallback((message) => {
    console.log(message);
    debugLogsRef.current = [...debugLogsRef.current, `${new Date().toLocaleTimeString()}: ${message}`].slice(-20);
    if (!window.__debugUpdateScheduled) {
      window.__debugUpdateScheduled = true;
      setTimeout(() => {
        setDebugInfo([...debugLogsRef.current]);
        window.__debugUpdateScheduled = false;
      }, 100);
    }
  }, []);

  // 生成用户ID
  const getOrCreateUserId = () => {
    let userId = localStorage.getItem('videoCallUserId');
    if (!userId) {
      userId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('videoCallUserId', userId);
    }
    return userId;
  };

  // 绑定远程视频流
  const bindRemoteStream = useCallback((userId, stream) => {
    const videoElement = videoElementsRef.current[userId];
    if (videoElement) {
      addDebugLog(`✅ 绑定远程视频流到 ${userId.slice(-6)}`);
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch(e => addDebugLog(`播放错误: ${e.message}`));
      };
      return true;
    } else {
      addDebugLog(`⏳ 等待视频元素渲染: ${userId.slice(-6)}`);
      pendingStreamsRef.current.set(userId, stream);
      return false;
    }
  }, [addDebugLog]);

  // 设置本地视频显示
  const setupLocalVideo = useCallback((stream) => {
    if (localVideoRef.current) {
      addDebugLog('✅ 找到本地视频元素，正在绑定...');
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.onloadedmetadata = () => {
        addDebugLog('本地视频元数据已加载');
        localVideoRef.current.play().then(() => {
          addDebugLog('✅ 本地视频正在播放');
        }).catch(e => {
          addDebugLog(`⚠️ 本地视频自动播放失败: ${e.message}`);
        });
      };
    } else {
      addDebugLog('⚠️ 本地视频元素尚未渲染，等待...');
      setTimeout(() => {
        if (localVideoRef.current && stream) {
          addDebugLog('✅ 延迟绑定成功');
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(e => console.log(e));
        }
      }, 500);
    }
  }, [addDebugLog]);

  // 获取本地媒体流
  const getMedia = useCallback(async () => {
    try {
      addDebugLog('正在请求摄像头和麦克风权限...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      localStreamRef.current = stream;
      
      addDebugLog(`✅ 获取到媒体流 - 视频轨道: ${stream.getVideoTracks().length}, 音频轨道: ${stream.getAudioTracks().length}`);
      
      stream.getAudioTracks().forEach(track => {
        track.enabled = audioEnabled;
      });
      stream.getVideoTracks().forEach(track => {
        track.enabled = videoEnabled;
      });
      
      setupLocalVideo(stream);
      
      return stream;
    } catch (err) {
      addDebugLog(`❌ 获取媒体设备失败: ${err.message}`);
      setError('无法访问摄像头或麦克风: ' + err.message);
      throw err;
    }
  }, [audioEnabled, videoEnabled, setupLocalVideo, addDebugLog]);

  // 创建 Peer 连接
  const createPeer = useCallback((targetUserId, isInitiator, stream) => {
    if (!stream) {
      addDebugLog(`❌ 创建 Peer 失败: 没有媒体流 (${targetUserId.slice(-6)})`);
      return null;
    }

    // 如果连接已经建立，不再创建
    if (connectionEstablishedRef.current.has(targetUserId)) {
      addDebugLog(`⚠️ 与 ${targetUserId.slice(-6)} 的连接已建立，跳过创建`);
      return null;
    }

    if (connectingPeersRef.current.has(targetUserId)) {
      addDebugLog(`⚠️ 正在连接 ${targetUserId.slice(-6)}，跳过重复创建`);
      return null;
    }

    if (peerInstancesRef.current[targetUserId]) {
      addDebugLog(`销毁已存在的连接: ${targetUserId.slice(-6)}`);
      peerInstancesRef.current[targetUserId].destroy();
      delete peerInstancesRef.current[targetUserId];
    }

    connectingPeersRef.current.add(targetUserId);
    addDebugLog(`创建 Peer: target=${targetUserId.slice(-6)}, initiator=${isInitiator}`);

    const peer = new SimplePeer({
      initiator: isInitiator,
      stream: stream,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', (data) => {
      if (socketRef.current && targetUserId) {
        addDebugLog(`发送信令到 ${targetUserId.slice(-6)}: ${data.type || 'candidate'}`);
        socketRef.current.emit('send-signal', {
          roomId,
          targetUserId,
          signal: data
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      addDebugLog(`✅ 收到 ${targetUserId.slice(-6)} 的视频流，尝试绑定...`);
      const bound = bindRemoteStream(targetUserId, remoteStream);
      if (!bound) {
        addDebugLog(`⏳ 视频元素未就绪，已缓存流: ${targetUserId.slice(-6)}`);
      }
      setConnectedPeers(prev => new Set([...prev, targetUserId]));
      connectingPeersRef.current.delete(targetUserId);
      connectionEstablishedRef.current.add(targetUserId);
    });

    peer.on('connect', () => {
      addDebugLog(`✅ 与 ${targetUserId.slice(-6)} 的 P2P 连接已建立`);
    });

    peer.on('error', (err) => {
      addDebugLog(`❌ Peer 错误 (${targetUserId.slice(-6)}): ${err.message}`);
      connectingPeersRef.current.delete(targetUserId);
      
      // 对于状态错误，不重连，因为可能已经建立连接了
      if (err.message.includes('setRemoteDescription') && 
          err.message.includes('Called in wrong state: stable')) {
        addDebugLog(`⚠️ 连接可能已经建立，忽略此错误`);
        if (peerInstancesRef.current[targetUserId]) {
          connectionEstablishedRef.current.add(targetUserId);
          setConnectedPeers(prev => new Set([...prev, targetUserId]));
        }
        return;
      }
      
      if (!err.message.includes('setLocalDescription') && 
          !err.message.includes('setRemoteDescription') && 
          !err.message.includes('wrong state') &&
          !err.message.includes('Failed to execute')) {
        setError(`连接失败: ${err.message}`);
      }
    });

    peer.on('close', () => {
      addDebugLog(`连接已关闭: ${targetUserId.slice(-6)}`);
      connectingPeersRef.current.delete(targetUserId);
      connectionEstablishedRef.current.delete(targetUserId);
      setConnectedPeers(prev => {
        const newSet = new Set(prev);
        newSet.delete(targetUserId);
        return newSet;
      });
      delete peerInstancesRef.current[targetUserId];
      
      const videoElement = videoElementsRef.current[targetUserId];
      if (videoElement) {
        videoElement.srcObject = null;
      }
    });

    peerInstancesRef.current[targetUserId] = peer;
    return peer;
  }, [roomId, addDebugLog, bindRemoteStream]);

  // 初始化 Socket 连接
  const initSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      path: '/socket.io/',
      secure: true,
      rejectUnauthorized: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      addDebugLog('✅ Socket 已连接');
      setError('');
    });

    socket.on('connect_error', (err) => {
      addDebugLog(`❌ Socket 连接错误: ${err.message}`);
      setError('无法连接到服务器，请检查网络');
    });

    socket.on('error', (data) => {
      addDebugLog(`❌ 服务器错误: ${JSON.stringify(data)}`);
      setError(data.message || '发生错误');
    });

    return socket;
  }, [addDebugLog]);

  // 加入房间
  const joinRoom = useCallback(async () => {
    if (!roomId.trim()) {
      setError('请输入房间号');
      return;
    }

    setIsConnecting(true);
    setError('');
    setDebugInfo([]);
    debugLogsRef.current = [];
    pendingStreamsRef.current.clear();
    connectingPeersRef.current.clear();
    processedSignalsRef.current.clear();
    connectionEstablishedRef.current.clear();
    roomJoinTimeRef.current = Date.now();
    addDebugLog(`开始加入房间: ${roomId}`);

    try {
      const stream = await getMedia();
      addDebugLog('媒体流获取成功，准备连接服务器...');
      
      const socket = initSocket();
      socketRef.current = socket;

      let joinResolve;
      const joinPromise = new Promise((resolve) => {
        joinResolve = resolve;
      });

      socket.on('join-success', (data) => {
        addDebugLog(`✅ 加入房间成功，房间内用户: ${data.users?.length || 0}人`);
        setIsInRoom(true);
        setIsConnecting(false);
        joinResolve();
      });

      // ✅ 关键修复：只有后加入的人作为发起方
socket.on('user-list', (data) => {
  const userList = data.users;
  const shouldBeInitiator = data.isInitiator;
  
  addDebugLog(`用户列表更新: ${userList.length}人，当前用户: ${userIdRef.current?.slice(-6)}`);
  addDebugLog(`服务器指定角色: ${shouldBeInitiator ? '发起方 (将主动发送offer)' : '被动方 (等待对方offer)'}`);
  
  const others = userList.filter(id => id !== userIdRef.current);
  setUsers(others);
  
  // ✅ 只有被指定为发起方的人才能主动创建连接
  if (others.length > 0 && shouldBeInitiator) {
    addDebugLog(`作为发起方，主动连接 ${others.length} 个用户`);
    others.forEach(userId => {
      if (!connectionEstablishedRef.current.has(userId) && 
          !peerInstancesRef.current[userId] && 
          !connectingPeersRef.current.has(userId)) {
        addDebugLog(`发起连接: ${userId.slice(-6)}`);
        createPeer(userId, true, stream);
      }
    });
  } else if (others.length > 0) {
    addDebugLog(`作为被动方，等待对方发起连接，不主动创建 Peer`);
  }
});

      // ✅ 新用户加入时，当前用户判断谁作为发起方
socket.on('user-connected', (data) => {
  const newUserId = data.userId;
  const shouldBeInitiator = data.isInitiator;
  
  if (newUserId !== userIdRef.current) {
    addDebugLog(`新用户加入: ${newUserId.slice(-6)}，服务器指定当前用户角色: ${shouldBeInitiator ? '发起方' : '被动方'}`);
    setUsers(prev => {
      if (!prev.includes(newUserId)) {
        return [...prev, newUserId];
      }
      return prev;
    });
    
    // ✅ 只有被指定为发起方的人才能创建连接
    if (shouldBeInitiator && 
        !connectionEstablishedRef.current.has(newUserId) && 
        !peerInstancesRef.current[newUserId] && 
        !connectingPeersRef.current.has(newUserId)) {
      addDebugLog(`作为发起方，主动连接新用户: ${newUserId.slice(-6)}`);
      createPeer(newUserId, true, stream);
    }
  }
});

      socket.on('user-disconnected', (leftUserId) => {
        addDebugLog(`用户离开: ${leftUserId.slice(-6)}`);
        setUsers(prev => prev.filter(id => id !== leftUserId));
        if (peerInstancesRef.current[leftUserId]) {
          peerInstancesRef.current[leftUserId].destroy();
          delete peerInstancesRef.current[leftUserId];
        }
        connectingPeersRef.current.delete(leftUserId);
        connectionEstablishedRef.current.delete(leftUserId);
        pendingStreamsRef.current.delete(leftUserId);
      });

socket.on('receive-signal', (data) => {
  addDebugLog(`收到信令，来自: ${data.fromUserId?.slice(-6)}，类型: ${data.signal?.type || 'candidate'}`);
  
  if (connectionEstablishedRef.current.has(data.fromUserId)) {
    addDebugLog(`连接已建立，忽略信令`);
    return;
  }
  
  // ✅ 被动方：如果还没有连接，创建被动连接（initiator: false）
  if (!peerInstancesRef.current[data.fromUserId] && !connectingPeersRef.current.has(data.fromUserId)) {
    addDebugLog(`作为被动方，创建 Peer 等待接收 offer`);
    createPeer(data.fromUserId, false, stream);
  }
  
  const peer = peerInstancesRef.current[data.fromUserId];
  if (peer && data.signal) {
    try {
      peer.signal(data.signal);
    } catch (err) {
      addDebugLog(`处理信令错误: ${err.message}`);
    }
  }
});

      userIdRef.current = getOrCreateUserId();
      addDebugLog(`用户ID: ${userIdRef.current.slice(-6)}`);
      socket.emit('join-room', roomId, userIdRef.current);
      
      await Promise.race([
        joinPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('加入超时')), 10000))
      ]);
      
    } catch (err) {
      addDebugLog(`❌ 加入房间失败: ${err.message}`);
      setError('无法加入房间: ' + err.message);
      setIsConnecting(false);
    }
  }, [roomId, getMedia, initSocket, createPeer, addDebugLog]);

  // 离开房间
  const leaveRoom = useCallback(() => {
    addDebugLog('离开房间');
    Object.values(peerInstancesRef.current).forEach(peer => {
      peer.destroy();
    });
    peerInstancesRef.current = {};
    pendingStreamsRef.current.clear();
    connectingPeersRef.current.clear();
    processedSignalsRef.current.clear();
    connectionEstablishedRef.current.clear();
    roomJoinTimeRef.current = null;
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setIsInRoom(false);
    setUsers([]);
    setConnectedPeers(new Set());
    setRoomId('');
    setError('');
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    Object.keys(videoElementsRef.current).forEach(userId => {
      if (videoElementsRef.current[userId]) {
        videoElementsRef.current[userId].srcObject = null;
      }
      delete videoElementsRef.current[userId];
    });
  }, [addDebugLog]);

  // 切换音频
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newState = !audioTrack.enabled;
        audioTrack.enabled = newState;
        setAudioEnabled(newState);
        addDebugLog(`音频 ${newState ? '开启' : '关闭'}`);
      }
    }
  }, [addDebugLog]);

  // 切换视频
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const newState = !videoTrack.enabled;
        videoTrack.enabled = newState;
        setVideoEnabled(newState);
        addDebugLog(`视频 ${newState ? '开启' : '关闭'}`);
      }
    }
  }, [addDebugLog]);

  // 设置远程视频元素的 ref
  const setVideoRef = useCallback((userId, element) => {
    if (element && videoElementsRef.current[userId] !== element) {
      addDebugLog(`📹 远程视频元素已渲染: ${userId.slice(-6)}`);
      videoElementsRef.current[userId] = element;
      
      if (pendingStreamsRef.current.has(userId)) {
        const stream = pendingStreamsRef.current.get(userId);
        addDebugLog(`✅ 立即绑定等待中的视频流: ${userId.slice(-6)}`);
        element.srcObject = stream;
        element.onloadedmetadata = () => {
          element.play().catch(e => addDebugLog(`播放错误: ${e.message}`));
        };
        pendingStreamsRef.current.delete(userId);
      }
    }
  }, [addDebugLog]);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>📹 视频通话</h2>
      
      <div className={styles.debugPanel}>
        <details open>
          <summary>🔍 调试信息 ({debugInfo.length})</summary>
          <div className={styles.debugContent}>
            {debugInfo.map((log, idx) => (
              <div key={idx} className={styles.debugLog}>{log}</div>
            ))}
          </div>
        </details>
      </div>

      {error && (
        <div className={styles.error}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} className={styles.closeError}>✕</button>
        </div>
      )}

      {!isInRoom ? (
        <div className={styles.joinPanel}>
          <input 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)} 
            placeholder="输入房间号"
            className={styles.input}
            onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
            disabled={isConnecting}
          />
          <button 
            onClick={joinRoom} 
            className={styles.joinButton}
            disabled={isConnecting}
          >
            {isConnecting ? '连接中...' : '📞 加入通话'}
          </button>
          <p className={styles.hint}>
            提示：输入相同的房间号即可开始视频通话
          </p>
        </div>
      ) : (
        <div className={styles.callContainer}>
          <div className={styles.controls}>
            <button 
              onClick={toggleAudio} 
              className={audioEnabled ? styles.controlBtn : `${styles.controlBtn} ${styles.controlBtnDisabled}`}
            >
              {audioEnabled ? '🎤 麦克风开' : '🔇 麦克风关'}
            </button>
            <button 
              onClick={toggleVideo} 
              className={videoEnabled ? styles.controlBtn : `${styles.controlBtn} ${styles.controlBtnDisabled}`}
            >
              {videoEnabled ? '📷 摄像头开' : '🚫 摄像头关'}
            </button>
            <button 
              onClick={leaveRoom} 
              className={`${styles.controlBtn} ${styles.controlBtnHangup}`}
            >
              📞 挂断
            </button>
          </div>

          <div className={styles.localVideoContainer}>
            <div className={styles.videoLabel}>
              我 ({userIdRef.current?.slice(-6)})
              {localStreamRef.current && <span className={styles.statusConnected}> ● 已连接</span>}
            </div>
            <video 
              ref={localVideoRef}
              className={styles.localVideo}
              autoPlay 
              muted 
              playsInline
              webkit-playsinline="true"
            />
          </div>

          <div className={styles.remoteVideos}>
            <h4 className={styles.sectionTitle}>
              通话成员 ({users.length}人)
            </h4>
            {users.length === 0 && (
              <div className={styles.emptyState}>
                🌟 等待其他人加入...
              </div>
            )}
            <div className={styles.videoGrid}>
              {users.map(userId => (
                <div key={userId} className={styles.remoteVideoCard}>
                  <div className={styles.videoLabel}>
                    用户 {userId.slice(-6)}
                    <span className={connectedPeers.has(userId) ? styles.statusConnected : styles.statusConnecting} />
                  </div>
                  <video 
                    ref={(el) => setVideoRef(userId, el)}
                    className={styles.remoteVideo}
                    autoPlay 
                    playsInline 
                    webkit-playsinline="true"
                  />
                  <div className={styles.statusText}>
                    {connectedPeers.has(userId) ? '✅ 已连接' : '⏳ 连接中...'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}