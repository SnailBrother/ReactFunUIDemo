// WaterWave.js
import React, { useRef, useEffect } from 'react';
import styles from './index.module.css';

const Waterwave = ({
  // --- 基础配置 ---
  width = "100dvw",
  height = 100,
  verticalOffset = 0.65,

  // --- 第一层波浪配置 (底层) ---
  amplitude = 20,        // 起伏幅度
  frequency = 0.008,     // 密度
  speed = 0.01,          // 移动速度
  color = '#e7eff169',     // 颜色 (建议深色)
  colorStop = '#f9fdfd67', // 顶部渐变颜色

  // --- 第二层波浪配置 (顶层) ---
  amplitude2 = 15,       // 起伏幅度 (建议比第一层小一点)
  frequency2 = 0.012,    // 密度 (建议与第一层不同，避免重叠同步)
  speed2 = 0.015,        // 移动速度 (建议比第一层快一点)
  color2 = '#eaf5f681',    // 颜色 (建议比第一层亮一点)
  colorStop2 = '#fcfefe91' // 顶部渐变颜色
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // 第一层相位
  const phaseRef = useRef(0);
  // 第二层相位 (独立控制，确保不同步)
  const phaseRef2 = useRef(0);
  
  const floatPhaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let w, h;

    // --- 尺寸计算逻辑 (保持不变) ---
    if (typeof width === 'string') {
      const viewportWidth = window.innerWidth;
      if (width.includes('dvw')) {
        w = viewportWidth * (parseFloat(width) / 100);
      } else {
        w = parseFloat(width);
      }
    } else {
      w = width;
    }

    if (typeof height === 'string') {
      if (height.includes('dvh')) {
        h = window.innerHeight * (parseFloat(height) / 100);
      } else {
        h = parseFloat(height);
      }
    } else {
      h = height;
    }

    canvas.width = w;
    canvas.height = h;

    // --- 绘图函数 ---
    const drawWave = (ctx, currentPhase, amp, freq, baseColor, stopColor, yOffset) => {
        ctx.beginPath();
        ctx.moveTo(0, h);

        for (let x = 0; x <= w; x += 1) {
            // 核心波浪公式
            const sinValue = Math.sin(x * freq + currentPhase);
            const waveHeight = sinValue * amp;
            const y = (h * verticalOffset) + waveHeight + yOffset;
            ctx.lineTo(x, y);
        }

        ctx.lineTo(w, h);
        ctx.closePath();

        // 创建渐变
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, stopColor);
        gradient.addColorStop(1, baseColor);
        
        ctx.fillStyle = gradient;
        ctx.fill();
    };

    const animate = () => {
      if (!canvas || !ctx) return;

      // 1. 更新相位
      phaseRef.current += speed;
      phaseRef2.current += speed2; // 第二层独立更新
      floatPhaseRef.current += 0.01; // 整体浮动速度

      // 2. 计算整体浮动偏移
      const floatOffset = Math.sin(floatPhaseRef.current) * 10; // 固定整体浮动幅度为10

      // 3. 清空画布
      ctx.clearRect(0, 0, w, h);

      // --- 绘制第一层 (底层) ---
      // 先画底层，作为背景
      drawWave(ctx, phaseRef.current, amplitude, frequency, color, colorStop, floatOffset);

      // --- 绘制第二层 (顶层) ---
      // 再画顶层，会覆盖在底层之上
      // 注意：这里使用了不同的 amplitude2, frequency2, phaseRef2
      drawWave(ctx, phaseRef2.current, amplitude2, frequency2, color2, colorStop2, floatOffset);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    amplitude, frequency, speed, color, colorStop, 
    amplitude2, frequency2, speed2, color2, colorStop2, 
    verticalOffset, width, height
  ]);

  return (
    <div className={styles.Container}>
      <div className={styles.waveone}>
        <canvas ref={canvasRef} className={styles.waveCanvas} />
      </div>
    </div>
  );
};

export default Waterwave;