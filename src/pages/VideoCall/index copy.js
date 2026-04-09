import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import styles from './VideoCall.module.css';

// 后端服务器地址
const SERVER_URL = 'https://cqrdpg.com:8443';
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
  const [featuredUserId, setFeaturedUserId] = useState(null); // 当前放大的用户ID，null表示自己
  const [facingMode, setFacingMode] = useState('user'); // 'user' 前置, 'environment' 后置

  const localVideoRef = useRef(null);
  const featuredVideoRef = useRef(null); // 放大区域的视频引用
  const localStreamRef = useRef(null);
  const peerInstancesRef = useRef({});
  const userIdRef = useRef('');
  const socketRef = useRef(null);
  const videoElementsRef = useRef({}); // 存储每个用户的视频元素
  const debugLogsRef = useRef([]);
  const pendingStreamsRef = useRef(new Map());
  const connectingPeersRef = useRef(new Set());
  const processedSignalsRef = useRef(new Set());
  const connectionEstablishedRef = useRef(new Set());
  const roomJoinTimeRef = useRef(null);

  // 添加调试日志函数
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
      userId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      localStorage.setItem('videoCallUserId', userId);
    }
    return userId;
  };
  // 添加打开原生摄像头选择器的函数
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
      // 停止旧轨道
      oldVideoTrack.stop();
      localStreamRef.current.removeTrack(oldVideoTrack);

      // 添加新轨道到本地流
      localStreamRef.current.addTrack(newVideoTrack);

      // ==============================================
      // 🔥 关键修复：给所有连接替换轨道（对面就能看到了）
      // ==============================================
      Object.values(peerInstancesRef.current).forEach(peer => {
        if (!peer || peer.destroyed || !peer._pc) return;
        try {
          const senders = peer._pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(newVideoTrack).catch(() => {});
          }
        } catch (e) {}
      });

      // 更新本地 UI
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
  // 切换摄像头（修复版）
  // 切换摄像头（完全修复版 - 支持所有设备）
const switchCamera = useCallback(async () => {
  if (!localStreamRef.current) {
    addDebugLog('❌ 没有本地流，无法切换摄像头');
    return;
  }

  const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
  addDebugLog(`🔄 切换摄像头: ${facingMode} -> ${newFacingMode}`);

  try {
    // 停止旧视频轨道
    const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
    oldVideoTrack.stop();
    localStreamRef.current.removeTrack(oldVideoTrack);

    // 获取新视频流
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: newFacingMode },
      audio: false
    });

    const newVideoTrack = newStream.getVideoTracks()[0];
    localStreamRef.current.addTrack(newVideoTrack);

    // ==============================================
    // 🔥 关键修复：同步给所有对方连接替换轨道
    // ==============================================
    Object.values(peerInstancesRef.current).forEach(peer => {
      if (!peer || peer.destroyed || !peer._pc) return;
      try {
        const senders = peer._pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack).catch(() => {});
        }
      } catch (e) {}
    });

    // 更新本地显示
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

  // 绑定远程视频流
  const bindRemoteStream = useCallback((userId, stream) => {
    const videoElement = videoElementsRef.current[userId];
    if (videoElement) {
      addDebugLog(`✅ 绑定远程视频流到 ${userId.slice(-6)}`);
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch(e => addDebugLog(`播放错误: ${e.message}`));
      };

      // 如果当前放大的就是这个用户，更新放大区域
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
// 设置本地视频显示（已修复：刚进房间自动显示顶部大画面）
const setupLocalVideo = useCallback((stream) => {
  if (localVideoRef.current) {
    addDebugLog('✅ 本地视频元素已绑定');
    localVideoRef.current.srcObject = stream;
    localVideoRef.current.onloadedmetadata = () => {
      localVideoRef.current.play().catch(e => addDebugLog(`本地视频播放失败: ${e.message}`));
    };
  }
  
  // 🔥 修复点：强制一进来就把自己绑定到顶部放大区域
  if (featuredVideoRef.current) {
    addDebugLog('🔥 自动设置顶部放大区域为本地画面（默认显示自己）');
    featuredVideoRef.current.srcObject = stream; // 强制赋值
    featuredVideoRef.current.onloadedmetadata = () => {
      featuredVideoRef.current.play().catch(e => addDebugLog(`顶部视频播放失败: ${e.message}`));
    };
  }
}, [addDebugLog]);

  // 获取本地媒体流（支持指定摄像头方向）
  // 获取本地媒体流（改进版 - 更好的设备检测）
  const getMedia = useCallback(async (mode = facingMode) => {
    try {
      addDebugLog(`正在请求摄像头权限，方向: ${mode === 'user' ? '前置' : '后置'}...`);

      // 先获取设备列表，帮助调试
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        addDebugLog(`📷 可用摄像头数量: ${videoDevices.length}`);
        videoDevices.forEach((d, i) => {
          addDebugLog(`  ${i + 1}. ${d.label || '未命名设备'} (${d.deviceId?.slice(-6) || '无ID'})`);
        });
      } catch (e) {
        addDebugLog(`无法枚举设备: ${e.message}`);
      }

      let stream;

      // 尝试多种方式获取流
      const tryGetStream = async (constraints) => {
        addDebugLog(`尝试约束: ${JSON.stringify(constraints)}`);
        return await navigator.mediaDevices.getUserMedia(constraints);
      };

      try {
        // 方式1：使用 exact facingMode
        stream = await tryGetStream({
          video: { facingMode: { exact: mode } },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (err1) {
        addDebugLog(`方式1失败 (exact facingMode): ${err1.message}`);
        try {
          // 方式2：不带 exact 的 facingMode
          stream = await tryGetStream({
            video: { facingMode: mode },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (err2) {
          addDebugLog(`方式2失败 (facingMode): ${err2.message}`);
          try {
            // 方式3：默认摄像头
            stream = await tryGetStream({
              video: true,
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              }
            });
          } catch (err3) {
            throw new Error(`所有获取摄像头方式都失败: ${err3.message}`);
          }
        }
      }

      localStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];
      addDebugLog(`✅ 获取到媒体流 - 视频: ${videoTrack?.label || '未知'}, 音频: ${stream.getAudioTracks().length}`);

      if (videoTrack) {
        const settings = videoTrack.getSettings();
        addDebugLog(`📷 视频设置: ${JSON.stringify(settings)}`);
        // 根据实际获取的摄像头方向更新 facingMode
        if (settings.facingMode) {
          setFacingMode(settings.facingMode);
          addDebugLog(`实际摄像头方向: ${settings.facingMode === 'user' ? '前置' : settings.facingMode === 'environment' ? '后置' : settings.facingMode}`);
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

  // 创建 Peer 连接
  const createPeer = useCallback((targetUserId, isInitiator, stream) => {
    if (!stream) {
      addDebugLog(`❌ 创建 Peer 失败: 没有媒体流 (${targetUserId.slice(-6)})`);
      return null;
    }

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

  // 点击缩略图放大
  const handleThumbnailClick = useCallback((userId) => {
    addDebugLog(`点击放大: ${userId === null ? '自己' : userId.slice(-6)}`);
    setFeaturedUserId(userId);

    // 更新放大区域的视频流
    if (featuredVideoRef.current) {
      if (userId === null) {
        // 放大自己
        featuredVideoRef.current.srcObject = localStreamRef.current;
      } else {
        // 放大远端用户
        const remoteVideo = videoElementsRef.current[userId];
        if (remoteVideo && remoteVideo.srcObject) {
          featuredVideoRef.current.srcObject = remoteVideo.srcObject;
        } else if (pendingStreamsRef.current.has(userId)) {
          featuredVideoRef.current.srcObject = pendingStreamsRef.current.get(userId);
        }
      }
    }
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
    setFeaturedUserId(null); // 默认放大自己
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

      socket.on('user-list', (data) => {
        const userList = data.users;
        const shouldBeInitiator = data.isInitiator;

        addDebugLog(`用户列表更新: ${userList.length}人，当前用户: ${userIdRef.current?.slice(-6)}`);
        addDebugLog(`服务器指定角色: ${shouldBeInitiator ? '发起方' : '被动方'}`);

        const others = userList.filter(id => id !== userIdRef.current);
        setUsers(others);

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
          addDebugLog(`作为被动方，等待对方发起连接`);
        }
      });

      socket.on('user-connected', (data) => {
        const newUserId = data.userId;
        const shouldBeInitiator = data.isInitiator;

        if (newUserId !== userIdRef.current) {
          addDebugLog(`新用户加入: ${newUserId.slice(-6)}`);
          setUsers(prev => {
            if (!prev.includes(newUserId)) {
              return [...prev, newUserId];
            }
            return prev;
          });

          if (shouldBeInitiator &&
            !connectionEstablishedRef.current.has(newUserId) &&
            !peerInstancesRef.current[newUserId] &&
            !connectingPeersRef.current.has(newUserId)) {
            addDebugLog(`主动连接新用户: ${newUserId.slice(-6)}`);
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

        // 如果离开的是当前放大的用户，切换回自己
        if (featuredUserId === leftUserId) {
          handleThumbnailClick(null);
        }
      });

      socket.on('receive-signal', (data) => {
        addDebugLog(`收到信令，来自: ${data.fromUserId?.slice(-6)}`);

        if (connectionEstablishedRef.current.has(data.fromUserId)) {
          addDebugLog(`连接已建立，忽略信令`);
          return;
        }

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
  }, [roomId, getMedia, initSocket, createPeer, addDebugLog, handleThumbnailClick, featuredUserId]);

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
    setFeaturedUserId(null);

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
    if (featuredVideoRef.current) {
      featuredVideoRef.current.srcObject = null;
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
            提示：输入相同的房间号即可开始视频通话，点击下方画面可放大显示
          </p>
        </div>
      ) : (
        <div className={styles.callContainer}>
          {/* 放大区域 - 显示被点击放大的画面 */}
          <div className={styles.featuredArea}>
            <div className={styles.videoLabel}>
              {featuredUserId === null ? (
                <>我 ({userIdRef.current?.slice(-6)})</>
              ) : (
                <>用户 {featuredUserId?.slice(-6)}</>
              )}
              <span className={styles.statusConnected}> ● 已连接</span>
            </div>
            <video
              ref={featuredVideoRef}
              className={styles.featuredVideo}
              autoPlay
              playsInline
              muted={featuredUserId === null}
              webkit-playsinline="true"
            />
          </div>

          {/* 控制栏 */}
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
              onClick={switchCamera}
              className={`${styles.controlBtn} ${styles.cameraSwitchBtn}`}
            >
              🔄 切换摄像头
            </button>
            <button
              onClick={leaveRoom}
              className={`${styles.controlBtn} ${styles.controlBtnHangup}`}
            >
              📞 挂断
            </button>
            <button
              onClick={openDevicePicker}
              className={styles.controlBtn}
            >
              📷 选择摄像头
            </button>
          </div>

          {/* 底部缩略图区域 */}
          <div className={styles.thumbnailSection}>
            <h4 className={styles.sectionTitle}>
              通话成员 ({users.length + 1}人) - 点击画面放大
            </h4>
            <div className={styles.thumbnailGrid}>
              {/* 自己的缩略图 */}
              <div
                className={`${styles.thumbnailCard} ${featuredUserId === null ? styles.activeThumbnail : ''}`}
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
                  webkit-playsinline="true"
                />
                <div className={styles.thumbnailStatus}>✅ 已连接</div>
              </div>

              {/* 远端用户缩略图 */}
              {users.map(userId => (
                <div
                  key={userId}
                  className={`${styles.thumbnailCard} ${featuredUserId === userId ? styles.activeThumbnail : ''}`}
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
                    webkit-playsinline="true"
                  />
                  <div className={styles.thumbnailStatus}>
                    {connectedPeers.has(userId) ? '✅ 已连接' : '⏳ 连接中...'}
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className={styles.emptyThumbnail}>
                  🌟 等待其他人加入...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}