import React, { useState, useRef } from 'react';
import styles from './index.module.css';

const OcrTextExtraction = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

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

  // ✅ 核心：调用你的 Python OCR 接口
  const handleExtractText = async () => {
    if (!selectedImage) {
      setError('请先选择一张图片');
      return;
    }

    setIsLoading(true);
    setError('');
    setExtractedText('');

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const base64Image = e.target.result;

        // 调用后端 Flask 服务
        const res = await fetch('http://127.0.0.1:5000/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: base64Image
          })
        });

        const data = await res.json();
        
        if (data.success) {
          setExtractedText(data.text);
        } else {
          setError(data.message || '识别失败');
        }
      };
      
      reader.readAsDataURL(selectedImage);
      
    } catch (err) {
      console.error('识别失败:', err);
      setError('无法连接 OCR 服务，请检查后端是否启动！');
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
      alert('文字已复制到剪贴板');
    }
  };

  return (
    <div className={styles.container}>
      {/* 左侧：提取的文字 */}
      <div className={styles.leftPanel}>
        <div className={styles.panelHeader}>
          <h3>提取的文字</h3>
          {extractedText && (
            <button className={styles.copyButton} onClick={handleCopyText}>
              复制
            </button>
          )}
        </div>
        <div className={styles.textContent}>
          {isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>正在识别图片中的文字...</p>
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
          {error && <div className={styles.error}>{error}</div>}
        </div>
      </div>

      {/* 右侧：上传图片 */}
      <div className={styles.rightPanel}>
        <div className={styles.panelHeader}>
          <h3>图片上传</h3>
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
            disabled={!selectedImage || isLoading}
          >
            {isLoading ? '提取中...' : '开始提取文字'}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default OcrTextExtraction;