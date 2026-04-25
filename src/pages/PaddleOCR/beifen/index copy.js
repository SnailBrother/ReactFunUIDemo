import React, { useState, useRef, useEffect } from 'react';
import styles from './index.module.css';

const OcrTextExtraction = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [ocrInstance, setOcrInstance] = useState(null);
  const fileInputRef = useRef(null);

  // 初始化 PaddleOCR
  useEffect(() => {
    const initPaddleOCR = async () => {
      try {
        setIsModelLoading(true);
        setModelLoadProgress(0);
        
        // 动态导入 PaddleOCR
        const { PaddleOCR } = await import('@paddleocr/paddleocr-js');
        
        // 创建 OCR 实例
        const instance = await PaddleOCR.create({
          lang: 'ch',              // 中英文混合识别
          ocrVersion: 'PP-OCRv5',  // 使用最新 v5 模型
          worker: true,            // 启用 Worker 线程，避免阻塞 UI
          ortOptions: {
            backend: 'auto',       // 自动选择 WebGPU 或 Wasm
            // 可选：设置模型加载进度回调
            onProgress: (progress) => {
              setModelLoadProgress(progress);
            }
          }
        });
        
        setOcrInstance(instance);
        setIsModelLoading(false);
        console.log('PaddleOCR 初始化成功');
      } catch (err) {
        console.error('PaddleOCR 初始化失败:', err);
        setError('OCR 模型加载失败，请刷新页面重试');
        setIsModelLoading(false);
      }
    };
    
    initPaddleOCR();
  }, []);

  // 处理图片选择
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError('');
      setExtractedText('');
    } else {
      setError('请选择有效的图片文件');
    }
  };

  // 拖拽上传
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError('');
      setExtractedText('');
    } else {
      setError('请拖拽有效的图片文件');
    }
  };

  // 核心：使用 PaddleOCR.js 进行文字识别
  const handleExtractText = async () => {
    if (!selectedImage) {
      setError('请先选择一张图片');
      return;
    }
    
    if (!ocrInstance) {
      setError('OCR 引擎未就绪，请稍后重试');
      return;
    }

    setIsLoading(true);
    setError('');
    setExtractedText('');

    try {
      // 将图片文件转换为 Blob 或 File 对象
      let imageInput;
      
      // 如果 selectedImage 已经是 File 对象，直接使用
      if (selectedImage instanceof File) {
        imageInput = selectedImage;
      } else {
        // 否则转换 base64 为 Blob
        const response = await fetch(imagePreview);
        const blob = await response.blob();
        imageInput = new File([blob], 'image.jpg', { type: blob.type });
      }
      
      // 调用 PaddleOCR 识别
      const results = await ocrInstance.predict(imageInput);
      
      // 处理识别结果
      if (results && results.length > 0) {
        // 提取所有识别到的文字
        const allText = results.map(result => {
          // result 是每个识别区域的结果
          if (result.items && result.items.length > 0) {
            // 如果有多个文本项，按行合并
            return result.items.map(item => item.text).join('\n');
          } else if (result.text) {
            return result.text;
          }
          return '';
        }).filter(text => text.trim()).join('\n');
        
        setExtractedText(allText || '未识别到文字');
        
        // 可选：打印详细信息到控制台
        console.log('识别详细结果:', results);
      } else {
        setExtractedText('未识别到任何文字');
      }
      
    } catch (err) {
      console.error('OCR 识别失败:', err);
      setError(`识别失败: ${err.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 更详细的识别（带位置信息）
  const handleExtractTextWithDetails = async () => {
    if (!selectedImage || !ocrInstance) return;

    setIsLoading(true);
    setError('');
    
    try {
      let imageInput = selectedImage;
      if (!(imageInput instanceof File)) {
        const response = await fetch(imagePreview);
        const blob = await response.blob();
        imageInput = new File([blob], 'image.jpg', { type: blob.type });
      }
      
      const results = await ocrInstance.predict(imageInput);
      
      // 格式化输出，包含位置和置信度信息
      let formattedText = '';
      results.forEach((result, idx) => {
        if (result.items && result.items.length > 0) {
          formattedText += `【区域 ${idx + 1}】\n`;
          result.items.forEach(item => {
            formattedText += `  文字: ${item.text}\n`;
            formattedText += `  置信度: ${(item.confidence * 100).toFixed(2)}%\n`;
            if (item.bbox) {
              formattedText += `  位置: [${item.bbox.join(', ')}]\n`;
            }
            formattedText += '\n';
          });
        }
      });
      
      setExtractedText(formattedText || '未识别到文字');
      
    } catch (err) {
      console.error('详细识别失败:', err);
      setError(`详细识别失败: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 重置
  const handleReset = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setExtractedText('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 复制文字
  const handleCopyText = () => {
    if (extractedText) {
      navigator.clipboard.writeText(extractedText);
      // 可以使用更好的提示方式，比如 Toast
      alert('文字已复制到剪贴板');
    }
  };

  // 清除错误
  const handleClearError = () => {
    setError('');
  };

  return (
    <div className={styles.container}>
      {/* 左侧：提取的文字 */}
      <div className={styles.leftPanel}>
        <div className={styles.panelHeader}>
          <h3>提取的文字</h3>
          <div className={styles.buttonGroup}>
            {extractedText && (
              <button className={styles.copyButton} onClick={handleCopyText}>
                复制
              </button>
            )}
            {error && (
              <button className={styles.clearButton} onClick={handleClearError}>
                清除错误
              </button>
            )}
          </div>
        </div>
        <div className={styles.textContent}>
          {isModelLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>正在加载 OCR 模型...</p>
              {modelLoadProgress > 0 && (
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill} 
                    style={{ width: `${modelLoadProgress}%` }}
                  />
                </div>
              )}
              <p className={styles.loadingHint}>首次加载需要下载模型文件（约 15-20MB）</p>
            </div>
          ) : isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>正在识别图片中的文字...</p>
              <p className={styles.loadingHint}>请稍候，大图可能需要几秒钟</p>
            </div>
          ) : extractedText ? (
            <div className={styles.extractedText}>
              <pre>{extractedText}</pre>
            </div>
          ) : (
            <div className={styles.placeholder}>
              <p>等待提取文字...</p>
              <p className={styles.placeholderHint}>请在右侧上传图片后点击"开始提取"</p>
            </div>
          )}
          {error && !isModelLoading && (
            <div className={styles.error}>
              <span>{error}</span>
              <button onClick={handleClearError} className={styles.errorClose}>×</button>
            </div>
          )}
        </div>
      </div>

      {/* 右侧：上传图片 */}
      <div className={styles.rightPanel}>
        <div className={styles.panelHeader}>
          <h3>图片上传</h3>
          {!isModelLoading && ocrInstance && (
            <span className={styles.modelStatus}>✓ OCR 引擎就绪</span>
          )}
        </div>

        <div
          className={`${styles.uploadArea} ${dragOver ? styles.dragOver : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: 'none' }}
          />
          {imagePreview ? (
            <div className={styles.imagePreview}>
              <img src={imagePreview} alt="预览" />
              <button
                className={styles.removeImage}
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div className={styles.uploadPlaceholder}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
              <p>点击或拖拽图片到此处上传</p>
              <span>支持 JPG、PNG、BMP 等格式</span>
            </div>
          )}
        </div>

        <div className={styles.buttonArea}>
          <button
            className={styles.extractButton}
            onClick={handleExtractText}
            disabled={!selectedImage || isLoading || isModelLoading || !ocrInstance}
          >
            {isLoading ? '提取中...' : '开始提取文字'}
          </button>
          <button
            className={styles.detailButton}
            onClick={handleExtractTextWithDetails}
            disabled={!selectedImage || isLoading || isModelLoading || !ocrInstance}
          >
            详细识别（含位置）
          </button>
          <button
            className={styles.resetButton}
            onClick={handleReset}
            disabled={isLoading}
          >
            重置
          </button>
        </div>

        {selectedImage && (
          <div className={styles.imageInfo}>
            <p>文件名：{selectedImage.name}</p>
            <p>大小：{(selectedImage.size / 1024).toFixed(2)} KB</p>
            <p>类型：{selectedImage.type}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OcrTextExtraction;