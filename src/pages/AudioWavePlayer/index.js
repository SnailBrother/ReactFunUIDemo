import React, { useState, useEffect, useRef } from 'react';
import styles from './index.module.css'; // 引入 CSS Module

const AudioWavePlayer = () => {
  // --- 状态管理 ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(217); // 示例时长
  const [waveHeights, setWaveHeights] = useState([]);
  
  // --- Refs ---
  const audioRef = useRef(null);
  const animationRef = useRef(null);
  const barCount = 80; // 柱子数量，适中即可

  // --- 初始化波形高度 ---
  useEffect(() => {
    setWaveHeights(Array.from({ length: barCount }, () => 0.1));
  }, []);

  // --- 核心算法：模拟音频频谱数据 ---
  // 不使用 Web Audio API，而是通过数学函数模拟“低音”和“高音”的跳动
  const simulateAudioData = (time) => {
    const newHeights = [];
    
    for (let i = 0; i < barCount; i++) {
      // 1. 基础波动：使用正弦波模拟低频的起伏
      // 不同的 i 产生不同的频率，模拟不同频段的音频
      const baseWave = Math.sin(time * 2 + i * 0.2) * 0.5 + 0.5;
      
      // 2. 节奏模拟：高频随机噪点
      // 模拟鼓点或高音，让柱子偶尔突然跳高
      const noise = Math.random();
      
      // 3. 融合算法
      // 中间频率（数组中间）通常能量最强，两边较弱
      const centerBias = 1 - Math.abs(i - barCount / 2) / (barCount / 2);
      
      // 最终高度计算：
      // 基础波动 * 节奏感 + 随机跳动 * 中心权重
      let height = (baseWave * 0.3) + (noise * 0.7 * centerBias);
      
      // 4. 平滑处理：限制最大最小高度，避免视觉闪烁
      height = Math.max(0.05, Math.min(1, height));
      
      newHeights.push(height);
    }
    return newHeights;
  };

  // --- 动画循环 ---
  const animate = (time) => {
    if (!isPlaying) return;

    // 获取模拟的波形数据
    const nextHeights = simulateAudioData(time / 1000); // 传入秒级时间
    setWaveHeights(nextHeights);

    // 使用 requestAnimationFrame 保持 60fps 流畅度
    animationRef.current = requestAnimationFrame(animate);
  };

  // --- 播放控制 ---
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.log("Audio play blocked", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  // --- 副作用处理 ---
  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  // --- 工具函数 ---
  const formatTime = (time) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  return (
    <div className={styles.playerContainer}>
      {/* 隐藏的音频标签 */}
      <audio
        ref={audioRef}
        src="http://121.4.22.55/backend/musics/孽-oldbaby.mp3"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* 时间显示 */}
      <div className={styles.timeDisplay}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* 可视化区域 */}
      <div className={styles.waveformContainer}>
        {waveHeights.map((height, index) => (
          <div
            key={index}
            className={styles.waveBar}
            // 动态高度：使用百分比，配合 CSS 的 align-items: center 实现垂直居中跳动
            style={{ height: `${height * 100}%` }}
          />
        ))}
      </div>

      {/* 控制按钮 */}
      <div className={styles.controls}>
        <button className={styles.controlBtn}>
           🔊 音量
        </button>
        <button 
          className={`${styles.controlBtn} ${styles.playBtn}`} 
          onClick={togglePlay}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>
      </div>
    </div>
  );
};

export default AudioWavePlayer;