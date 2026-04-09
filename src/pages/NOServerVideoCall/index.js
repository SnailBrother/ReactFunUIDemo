import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import styles from './index.module.css';

const SIGNALING_SERVER_URL = 'http://localhost:3001';

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
  const [featuredUserId, setFeaturedUserId] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

  const localVideoRef = useRef(null);
  const featuredVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const userIdRef = useRef('');
  const peerRef = useRef(null);
  const connectionsRef = useRef(new Map());
  const videoElementsRef = useRef({});
  const debugLogsRef = useRef([]);
  const pendingStreamsRef = useRef(new Map());
  const socketRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());

  const addDebugLog = useCallback((message) => {
    console.log(message);
    debugLogsRef.current = [...debugLogsRef.current, `${new Date().toLocaleTimeString()}: ${message}`].slice(-30);
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
      userId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('videoCallUserId', userId);
    }
    return userId;
  };

  // 打开系统摄像头选择器
  const openDevicePicker = useCallback(async () => {
    addDebugLog(`打开系统摄像头选择器...`);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      const oldVideoTrack = localStreamRef.current?.getVideoTracks()[0];
      const newVideoTrack = stream.getVideoTracks()[0];

      if (oldVideoTrack && newVideoTrack) {
        oldVideoTrack.stop();
        localStreamRef.current.removeTrack(oldVideoTrack);
        localStreamRef.current.addTrack(newVideoTrack);

        peerConnectionsRef.current.forEach(peerConnection => {
          const senders = peerConnection.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(newVideoTrack).catch(() => {});
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        if (featuredUserId === null && featuredVideoRef.current) {
          featuredVideoRef.current.srcObject = localStreamRef.current;
        }

        addDebugLog(`✅ 摄像头切换成功: ${newVideoTrack.label}`);
      }
    } catch (err) {
      addDebugLog(`用户取消或选择失败: ${err.message}`);
    }
  }, [featuredUserId, addDebugLog]);

  // 切换摄像头
  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current) {
      addDebugLog('❌ 没有本地流，无法切换摄像头');
      return;
    }

    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    addDebugLog(`🔄 切换摄像头: ${facingMode} -> ${newFacingMode}`);

    try {
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldVideoTrack) {
        oldVideoTrack.stop();
        localStreamRef.current.removeTrack(oldVideoTrack);
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacingMode } },
        audio: false
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      localStreamRef.current.addTrack(newVideoTrack);

      peerConnectionsRef.current.forEach(peerConnection => {
        const senders = peerConnection.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack).catch(() => {});
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      if (featuredUserId === null && featuredVideoRef.current) {
        featuredVideoRef.current.srcObject = localStreamRef.current;
      }

      setFacingMode(newFacingMode);
      addDebugLog(`✅ 摄像头切换成功`);
    } catch (err) {
      addDebugLog(`❌ 切换失败: ${err.message}`);
    }
  }, [facingMode, featuredUserId, addDebugLog]);

  // 创建PeerConnection
  const createPeerConnection = useCallback((targetUserId) => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);
    
    // 添加本地流
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }

    // 处理ICE候选
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('signal', {
          toUserId: targetUserId,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate
          }
        });
      }
    };

    // 处理远程流
    peerConnection.ontrack = (event) => {
      addDebugLog(`✅ 收到 ${targetUserId.slice(-6)} 的远程流`);
      const remoteStream = event.streams[0];
      
      const videoElement = videoElementsRef.current[targetUserId];
      if (videoElement) {
        videoElement.srcObject = remoteStream;
        videoElement.play().catch(e => addDebugLog(`播放错误: ${e.message}`));
        
        if (featuredUserId === targetUserId && featuredVideoRef.current) {
          featuredVideoRef.current.srcObject = remoteStream;
        }
      } else {
        pendingStreamsRef.current.set(targetUserId, remoteStream);
      }
      
      setConnectedPeers(prev => new Set([...prev, targetUserId]));
    };

    peerConnection.onconnectionstatechange = () => {
      addDebugLog(`连接状态变化 (${targetUserId.slice(-6)}): ${peerConnection.connectionState}`);
      if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
        setConnectedPeers(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });
        
        const videoElement = videoElementsRef.current[targetUserId];
        if (videoElement) {
          videoElement.srcObject = null;
        }
        
        if (featuredUserId === targetUserId) {
          setFeaturedUserId(null);
        }
        
        peerConnectionsRef.current.delete(targetUserId);
      }
    };

    return peerConnection;
  }, [featuredUserId, addDebugLog]);

  // 发起呼叫
  const callUser = useCallback(async (targetUserId) => {
    if (peerConnectionsRef.current.has(targetUserId)) {
      addDebugLog(`已经连接到 ${targetUserId.slice(-6)}，跳过`);
      return;
    }

    if (targetUserId === userIdRef.current) {
      return;
    }

    addDebugLog(`🔗 发起呼叫: ${targetUserId.slice(-6)}`);
    
    const peerConnection = createPeerConnection(targetUserId);
    peerConnectionsRef.current.set(targetUserId, peerConnection);

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socketRef.current.emit('signal', {
        toUserId: targetUserId,
        signal: {
          type: 'offer',
          sdp: offer
        }
      });
    } catch (error) {
      addDebugLog(`❌ 创建Offer失败: ${error.message}`);
    }
  }, [createPeerConnection, addDebugLog]);

  // 处理信令消息
  const handleSignal = useCallback(async (fromUserId, signal) => {
    addDebugLog(`📨 收到信令 from ${fromUserId.slice(-6)}: ${signal.type}`);
    
    let peerConnection = peerConnectionsRef.current.get(fromUserId);
    
    if (signal.type === 'offer' && !peerConnection) {
      peerConnection = createPeerConnection(fromUserId);
      peerConnectionsRef.current.set(fromUserId, peerConnection);
    }
    
    if (!peerConnection) {
      addDebugLog(`❌ 没有找到对应的PeerConnection: ${fromUserId.slice(-6)}`);
      return;
    }
    
    try {
      if (signal.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socketRef.current.emit('signal', {
          toUserId: fromUserId,
          signal: {
            type: 'answer',
            sdp: answer
          }
        });
      } else if (signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice-candidate' && signal.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (error) {
      addDebugLog(`❌ 处理信令失败: ${error.message}`);
    }
  }, [createPeerConnection, addDebugLog]);

  // 绑定远程视频流
  const bindRemoteStream = useCallback((userId, stream) => {
    const videoElement = videoElementsRef.current[userId];
    if (videoElement) {
      addDebugLog(`✅ 绑定远程视频流到 ${userId.slice(-6)}`);
      videoElement.srcObject = stream;
      videoElement.play().catch(e => addDebugLog(`播放错误: ${e.message}`));

      if (featuredUserId === userId && featuredVideoRef.current) {
        featuredVideoRef.current.srcObject = stream;
      }
      return true;
    } else {
      addDebugLog(`⏳ 等待视频元素渲染: ${userId.slice(-6)}`);
      pendingStreamsRef.current.set(userId, stream);
      return false;
    }
  }, [featuredUserId, addDebugLog]);

  // 设置本地视频显示
  const setupLocalVideo = useCallback((stream) => {
    if (localVideoRef.current) {
      addDebugLog('✅ 本地视频元素已绑定');
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(e => addDebugLog(`本地视频播放失败: ${e.message}`));
    }

    if (featuredVideoRef.current) {
      addDebugLog('🔥 自动设置顶部放大区域为本地画面');
      featuredVideoRef.current.srcObject = stream;
      featuredVideoRef.current.play().catch(e => addDebugLog(`顶部视频播放失败: ${e.message}`));
    }
  }, [addDebugLog]);

  // 获取本地媒体流
  const getMedia = useCallback(async (mode = facingMode) => {
    try {
      addDebugLog(`正在请求摄像头权限，方向: ${mode === 'user' ? '前置' : '后置'}...`);

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: mode } },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (err1) {
        addDebugLog(`方式1失败: ${err1.message}`);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: mode },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (err2) {
          addDebugLog(`方式2失败: ${err2.message}`);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        }
      }

      localStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      addDebugLog(`✅ 获取到媒体流 - 视频: ${videoTrack?.label || '未知'}, 音频: ${stream.getAudioTracks().length}`);

      if (videoTrack) {
        const settings = videoTrack.getSettings();
        addDebugLog(`📷 视频设置: ${JSON.stringify(settings)}`);
        if (settings.facingMode) {
          setFacingMode(settings.facingMode);
        }
      }

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
  }, [audioEnabled, videoEnabled, setupLocalVideo, addDebugLog, facingMode]);

  // 加入房间
  const joinRoom = useCallback(async () => {
    if (!roomId.trim()) {
      setError('请输入房间号');
      return;
    }

    setIsConnecting(true);
    setError('');
    debugLogsRef.current = [];
    pendingStreamsRef.current.clear();
    setFeaturedUserId(null);
    setUsers([]);
    setConnectedPeers(new Set());
    connectionsRef.current.clear();
    peerConnectionsRef.current.clear();
    
    addDebugLog(`开始加入房间: ${roomId}`);

    try {
      // 获取媒体流
      const stream = await getMedia();
      addDebugLog('媒体流获取成功');
      
      // 获取用户ID
      const userId = getOrCreateUserId();
      userIdRef.current = userId;
      addDebugLog(`用户ID: ${userId.slice(-6)}`);
      
      // 连接信令服务器
      socketRef.current = io(SIGNALING_SERVER_URL, {
  transports: ['websocket', 'polling'],  // 明确指定传输方式
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
});
    // 添加连接错误处理
socketRef.current.on('connect_error', (error) => {
  addDebugLog(`❌ 连接错误: ${error.message}`);
  console.error('Socket连接错误:', error);
});

socketRef.current.on('disconnect', (reason) => {
  addDebugLog(`⚠️ 断开连接: ${reason}`);
});  
      // 等待连接建立
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('信令服务器连接超时')), 10000);
        
        socketRef.current.on('connect', () => {
          clearTimeout(timeout);
          addDebugLog('✅ 已连接到信令服务器');
          resolve();
        });
        
        socketRef.current.on('connect_error', (err) => {
          clearTimeout(timeout);
          addDebugLog(`❌ 信令服务器连接失败: ${err.message}`);
          reject(err);
        });
      });
      
      // 加入房间
      const result = await new Promise((resolve, reject) => {
        socketRef.current.emit('join-room', { roomId, userId }, (response) => {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error));
          }
        });
      });
      
      addDebugLog(`✅ 成功加入房间: ${roomId}, 现有用户: ${result.users.length}`);
      setUsers(result.users);
      
      // 监听房间事件
      socketRef.current.on('user-joined', (data) => {
        addDebugLog(`👤 用户加入: ${data.userId.slice(-6)}`);
        setUsers(data.users);
        
        // 呼叫新用户
        setTimeout(() => {
          if (!peerConnectionsRef.current.has(data.userId)) {
            callUser(data.userId);
          }
        }, 500);
      });
      
      socketRef.current.on('user-left', (data) => {
        addDebugLog(`👋 用户离开: ${data.userId.slice(-6)}`);
        setUsers(data.users);
        
        // 关闭连接
        const peerConnection = peerConnectionsRef.current.get(data.userId);
        if (peerConnection) {
          peerConnection.close();
          peerConnectionsRef.current.delete(data.userId);
        }
        
        setConnectedPeers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
        
        const videoElement = videoElementsRef.current[data.userId];
        if (videoElement) {
          videoElement.srcObject = null;
        }
        
        if (featuredUserId === data.userId) {
          setFeaturedUserId(null);
        }
      });
      
      socketRef.current.on('signal', (data) => {
        handleSignal(data.fromUserId, data.signal);
      });
      
      // 呼叫房间内现有用户
      for (const existingUser of result.users) {
        setTimeout(() => {
          if (!peerConnectionsRef.current.has(existingUser)) {
            callUser(existingUser);
          }
        }, 1000);
      }
      
      setIsInRoom(true);
      setIsConnecting(false);
      
    } catch (err) {
      addDebugLog(`❌ 加入房间失败: ${err.message}`);
      setError('无法加入房间: ' + err.message);
      setIsConnecting(false);
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }
  }, [roomId, getMedia, callUser, handleSignal, addDebugLog]);

  // 离开房间
  const leaveRoom = useCallback(() => {
    addDebugLog('离开房间');
    
    // 通知服务器离开房间
    if (socketRef.current) {
      socketRef.current.emit('leave-room', {});
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // 关闭所有PeerConnection
    peerConnectionsRef.current.forEach((peerConnection) => {
      peerConnection.close();
    });
    peerConnectionsRef.current.clear();
    pendingStreamsRef.current.clear();
    
    // 停止本地流
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // 清理视频元素
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (featuredVideoRef.current) {
      featuredVideoRef.current.srcObject = null;
    }
    
    Object.keys(videoElementsRef.current).forEach(userId => {
      if (videoElementsRef.current[userId]) {
        videoElementsRef.current[userId].srcObject = null;
      }
      delete videoElementsRef.current[userId];
    });
    
    setUsers([]);
    setConnectedPeers(new Set());
    setFeaturedUserId(null);
    setIsInRoom(false);
    setRoomId('');
    setError('');
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

  // 点击缩略图放大
  const handleThumbnailClick = useCallback((userId) => {
    addDebugLog(`点击放大: ${userId === null ? '自己' : userId.slice(-6)}`);
    setFeaturedUserId(userId);

    if (featuredVideoRef.current) {
      if (userId === null) {
        featuredVideoRef.current.srcObject = localStreamRef.current;
      } else {
        const remoteVideo = videoElementsRef.current[userId];
        if (remoteVideo && remoteVideo.srcObject) {
          featuredVideoRef.current.srcObject = remoteVideo.srcObject;
        } else if (pendingStreamsRef.current.has(userId)) {
          featuredVideoRef.current.srcObject = pendingStreamsRef.current.get(userId);
        }
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
        element.play().catch(e => addDebugLog(`播放错误: ${e.message}`));
        pendingStreamsRef.current.delete(userId);
      }
    }
  }, [addDebugLog]);

  // 清理
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peerConnectionsRef.current.forEach((peerConnection) => {
        peerConnection.close();
      });
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>📹 视频通话</h2>
      </div>

      <div className={styles.debugPanel}>
        <details>
          <summary className={styles.debugSummary}>
            🔍 调试信息 ({debugInfo.length})
          </summary>
          <div className={styles.debugContent}>
            {debugInfo.map((log, idx) => (
              <div key={idx} className={styles.debugLog}>{log}</div>
            ))}
          </div>
        </details>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <span>⚠️ {error}</span>
          <button 
            onClick={() => setError('')}
            className={styles.errorClose}
          >
            ✕
          </button>
        </div>
      )}

      {!isInRoom ? (
        <div className={styles.joinContainer}>
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="输入房间号"
            className={styles.roomInput}
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
          <p className={styles.joinHint}>
            提示：在不同设备上输入相同房间号即可开始视频通话
          </p>
        </div>
      ) : (
        <div className={styles.roomContainer}>
          {/* 放大区域 */}
          <div className={styles.featuredVideo}>
            <div className={styles.featuredHeader}>
              <span>
                {featuredUserId === null ? (
                  <>我 ({userIdRef.current?.slice(-6)})</>
                ) : (
                  <>用户 {featuredUserId?.slice(-6)}</>
                )}
              </span>
              <span className={styles.connectedStatus}>● 已连接</span>
            </div>
            <video
              ref={featuredVideoRef}
              className={styles.featuredVideoElement}
              autoPlay
              playsInline
              muted={featuredUserId === null}
              controls={false}
            />
          </div>

          {/* 控制栏 */}
          <div className={styles.controls}>
            <button
              onClick={toggleAudio}
              className={`${styles.controlButton} ${audioEnabled ? styles.audioOn : styles.audioOff}`}
            >
              {audioEnabled ? '🎤 麦克风开' : '🔇 麦克风关'}
            </button>
            <button
              onClick={toggleVideo}
              className={`${styles.controlButton} ${videoEnabled ? styles.videoOn : styles.videoOff}`}
            >
              {videoEnabled ? '📷 摄像头开' : '🚫 摄像头关'}
            </button>
            <button
              onClick={switchCamera}
              className={`${styles.controlButton} ${styles.switchCamera}`}
            >
              🔄 切换摄像头
            </button>
            <button
              onClick={openDevicePicker}
              className={`${styles.controlButton} ${styles.selectCamera}`}
            >
              📷 选择摄像头
            </button>
            <button
              onClick={leaveRoom}
              className={`${styles.controlButton} ${styles.leaveButton}`}
            >
              📞 挂断
            </button>
          </div>

          {/* 底部缩略图区域 */}
          <div className={styles.participantsSection}>
            <h4 className={styles.participantsTitle}>
              通话成员 ({users.length + 1}人) - 点击画面放大
            </h4>
            <div className={styles.thumbnailGrid}>
              {/* 自己的缩略图 */}
              <div
                className={`${styles.thumbnail} ${featuredUserId === null ? styles.thumbnailActive : styles.thumbnailInactive}`}
                onClick={() => handleThumbnailClick(null)}
              >
                <div className={styles.thumbnailLabel}>
                  我 ({userIdRef.current?.slice(-6)})
                </div>
                <video
                  ref={localVideoRef}
                  className={styles.thumbnailVideo}
                  autoPlay
                  muted
                  playsInline
                  controls={false}
                />
                <div className={`${styles.thumbnailStatus} ${styles.statusConnected}`}>
                  ✅ 已连接
                </div>
              </div>

              {/* 远端用户缩略图 */}
              {users.map(userId => (
                <div
                  key={userId}
                  className={`${styles.thumbnail} ${featuredUserId === userId ? styles.thumbnailActive : styles.thumbnailInactive}`}
                  onClick={() => handleThumbnailClick(userId)}
                >
                  <div className={styles.thumbnailLabel}>
                    用户 {userId.slice(-6)}
                  </div>
                  <video
                    ref={(el) => setVideoRef(userId, el)}
                    className={styles.thumbnailVideo}
                    autoPlay
                    playsInline
                    controls={false}
                  />
                  <div className={`${styles.thumbnailStatus} ${connectedPeers.has(userId) ? styles.statusConnected : styles.statusConnecting}`}>
                    {connectedPeers.has(userId) ? '✅ 已连接' : '⏳ 连接中...'}
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateEmoji}>🌟</div>
                  <div className={styles.emptyStateText}>等待其他人加入...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}