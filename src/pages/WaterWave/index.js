// WaterWave.js
import React, { useRef, useEffect } from 'react';
import styles from './index.module.css';

const Waterwave = ({
  width = "100dvw",    // 改为100dvw（动态视口宽度），dvw表示动态视口宽度单位
  height = 100,        // 高度保持100像素
  amplitude = 20,      // 波浪的起伏幅度（像素），数值越大波浪起伏越明显
  frequency = 0.008,   // 波浪的频率/密度，数值越大波浪越密集
  verticalOffset = 0.65, // 波浪的垂直位置（0-1之间），0.65表示在画布高度的65%位置
  speed = 0.01,        // 波浪横向移动的速度，数值越大移动越快
  floatAmplitude = 10, // 整体波浪上下浮动的幅度（像素），数值越大上下浮动越明显
  floatSpeed = 0.01    // 整体波浪上下浮动的速度，数值越大浮动越快
}) => {
  // 创建canvas元素的引用，用于操作DOM元素
  const canvasRef = useRef(null);
  // 创建动画帧的引用，用于后续停止动画
  const animationRef = useRef(null);
  // 创建横向移动的相位引用，用于控制波浪的移动位置
  const phaseRef = useRef(0);
  // 创建上下浮动的相位引用，用于控制整体波浪的浮动位置
  const floatPhaseRef = useRef(0);

  // useEffect在组件挂载时执行，类似于类组件的componentDidMount
  useEffect(() => {
    // 获取canvas DOM元素
    const canvas = canvasRef.current;
    // 如果canvas不存在，则退出
    if (!canvas) return;

    // 获取canvas的2D绘图上下文，用于绘制图形
    const ctx = canvas.getContext('2d');

    // 获取canvas的实际宽度和高度（注意：这里width可能是字符串"100dvw"，所以需要特殊处理）
    let w, h;

    // 如果width是字符串（如"100dvw"），则计算实际像素值
    if (typeof width === 'string') {
      // 获取视口宽度（viewport width）
      const viewportWidth = window.innerWidth;
      // 如果宽度包含'dvw'，转换为视口宽度的百分比
      if (width.includes('dvw')) {
        const percentage = parseFloat(width) / 100;
        w = viewportWidth * percentage;
      } else {
        // 其他情况，尝试解析为数字
        w = parseFloat(width);
      }
    } else {
      // 如果width是数字，直接使用
      w = width;
    }

    // 处理高度
    if (typeof height === 'string') {
      if (height.includes('dvh')) {
        const viewportHeight = window.innerHeight;
        const percentage = parseFloat(height) / 100;
        h = viewportHeight * percentage;
      } else {
        h = parseFloat(height);
      }
    } else {
      h = height;
    }

    // 设置canvas的实际像素尺寸（重要：这样才能保证清晰度）
    canvas.width = w;
    canvas.height = h;

    // 动画函数：负责绘制每一帧的波浪
    const animate = () => {
      // 安全检查：确保canvas和绘图上下文存在
      if (!canvas || !ctx) return;

      // 更新横向移动的相位：每帧增加speed，实现波浪向左或向右移动的效果
      phaseRef.current += speed;

      // 更新上下浮动的相位：每帧增加floatSpeed，实现整体波浪上下摆动
      floatPhaseRef.current += floatSpeed;

      // 计算当前帧的上下浮动偏移量：使用正弦函数实现平滑的上下摆动
      // Math.sin() 返回 -1 到 1 之间的值，乘以 floatAmplitude 得到实际的偏移像素
      const floatOffset = Math.sin(floatPhaseRef.current) * floatAmplitude;

      // 清除画布上的所有内容，准备绘制新的一帧
      ctx.clearRect(0, 0, w, h);

      // 创建线性渐变填充：从上到下渐变
      // createLinearGradient(x0, y0, x1, y1) 参数：起点坐标和终点坐标
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      // 添加渐变色标：0表示顶部，1表示底部
      gradient.addColorStop(0, '#c6e8ea'); // 顶部颜色：浅青色
      gradient.addColorStop(1, '#0f5f73'); // 底部颜色：深蓝绿色

      // 开始绘制波浪路径
      ctx.beginPath();
      // 将画笔移动到左下角（x=0, y=画布高度），作为波浪路径的起点
      ctx.moveTo(0, h);

      // 遍历画布的每一个像素点（x坐标从0到宽度）
      // 这样可以绘制出连续的波浪曲线
      for (let x = 0; x <= w; x += 1) {
        // 波浪的核心公式：y = sin(频率 × x + 横向相位) × 振幅 + 基础高度 + 上下浮动

        // sinValue: 正弦值，范围在-1到1之间
        // x * frequency: 控制波浪的密度（频率）
        // + phaseRef.current: 横向相位，让波浪随时间移动
        const sinValue = Math.sin(x * frequency + phaseRef.current);

        // waveHeight: 当前点的波浪高度偏移
        // sinValue * amplitude: 将正弦值转换为实际的像素偏移
        const waveHeight = sinValue * amplitude;

        // baseY: 波浪的基础位置（画布高度 × 垂直偏移比例）
        const baseY = h * verticalOffset;

        // 最终Y坐标 = 基础位置 + 波浪偏移 + 整体浮动偏移
        const y = baseY + waveHeight + floatOffset;

        // 将画笔连接到当前计算出的点 (x, y)
        ctx.lineTo(x, y);
      }

      // 从最后一个波浪点连接到右下角 (w, h)
      ctx.lineTo(w, h);
      // 闭合路径：从右下角连接回起点（左下角）
      ctx.closePath();

      // 设置填充样式为刚才创建的渐变
      ctx.fillStyle = gradient;
      // 填充整个波浪路径，形成彩色波浪效果
      ctx.fill();

      // 请求下一帧动画，形成连续的动画效果
      // requestAnimationFrame 会在浏览器下一次重绘时调用 animate 函数
      animationRef.current = requestAnimationFrame(animate);
    };

    // 启动动画
    animate();

    // 清理函数：在组件卸载时执行，防止内存泄漏
    return () => {
      // 如果动画帧存在，则取消动画
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [amplitude, frequency, verticalOffset, width, height, speed, floatAmplitude, floatSpeed]);
  // 依赖数组：当这些参数发生变化时，重新执行useEffect

  return (
    <div className={styles.Container}>
      {/* 
        canvas元素：用于绘制波浪的HTML元素
        ref={canvasRef}: 将canvas DOM元素绑定到canvasRef引用，方便在JavaScript中操作
        width和height已经通过JavaScript动态设置，所以这里不设置width/height属性
        className: 应用CSS样式
      */}
      <div className={styles.waveone}>
        <canvas
          ref={canvasRef}
          className={styles.waveCanvas}
        />
      </div>
      

    </div>
  );
};

export default Waterwave;