import React, { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

import styles from './Tesseract.module.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const TesseractOCR = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  const fileInputRef = useRef(null);
  const workerRef = useRef(null);

 
// 初始化 Worker（使用本地语言包，并开启自动旋转校正）
const getWorker = async () => {
  if (!workerRef.current) {
    setStatusText('正在加载OCR引擎...');
    setProgress(10);
    
    try {
      workerRef.current = await Tesseract.createWorker('chi_sim+eng', 1, {
        langPath: '/tesseract-data', // 指向本地语言包目录
        logger: (m) => {
          console.log('Tesseract:', m);
          // 你原有的进度日志代码保持不变
          if (m.status === 'loading tesseract core') {
            setProgress(30);
            setStatusText('加载核心引擎...');
          } else if (m.status === 'initializing tesseract') {
            setProgress(50);
            setStatusText('初始化引擎...');
          } else if (m.status === 'loading language traineddata') {
            setProgress(70);
            setStatusText('加载本地语言包...');
          } else if (m.status === 'loaded language traineddata') {
            setProgress(90);
            setStatusText('语言包加载完成');
          } else if (m.status === 'initializing api') {
            setProgress(95);
            setStatusText('初始化API...');
          } else if (m.status === 'recognizing text') {
            setProgress(m.progress * 100);
            setStatusText(`识别中... ${Math.round(m.progress * 100)}%`);
          }
        },
        // ★★★ 下面这行是关键：开启自动旋转功能 ★★★
        rotateAuto: true
      });
      setProgress(100);
      setStatusText('准备就绪（已开启方向自动校正）');
    } catch (error) {
      console.error('Worker 初始化失败:', error);
      throw new Error('OCR引擎初始化失败，请检查本地语言包文件是否完整');
    }
  }
  return workerRef.current;
};

  // PDF 转图片
  const pdfToImages = async (pdfFile) => {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      const pages = [];

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        const url = URL.createObjectURL(blob);

        pages.push({
          pageNumber: i,
          blob: blob,
          url: url,
          originalFile: pdfFile
        });
      }

      return pages;
    } catch (error) {
      console.error('PDF 转图片失败:', error);
      throw new Error('PDF 解析失败');
    }
  };

  // 处理文件选择
  const handleFileSelect = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validFiles = [];
    const allPreviews = [];

    for (const file of fileArray) {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';

      if (isImage || isPDF) {
        validFiles.push(file);

        if (isImage) {
          const reader = new FileReader();
          const previewPromise = new Promise((resolve) => {
            reader.onloadend = () => {
              resolve({
                id: Date.now() + Math.random(),
                type: 'image',
                url: reader.result,
                name: file.name,
                pageNumber: 1,
                file: file
              });
            };
          });
          reader.readAsDataURL(file);
          const preview = await previewPromise;
          allPreviews.push(preview);
        } else if (isPDF) {
          try {
            const pages = await pdfToImages(file);
            pages.forEach(page => {
              allPreviews.push({
                id: Date.now() + Math.random(),
                type: 'pdf-page',
                url: page.url,
                name: file.name,
                pageNumber: page.pageNumber,
                file: file,
                blob: page.blob
              });
            });
          } catch (err) {
            console.error('PDF预览生成失败:', err);
          }
        }
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setFilePreviews(prev => [...prev, ...allPreviews]);
      setError('');
      setExtractedText('');
      setStatusText('');
    } else {
      setError('请选择有效的图片或PDF文件');
    }
  }, []);

  // 开始识别
  const handleStartOCR = async () => {
    if (filePreviews.length === 0) {
      setError('请先选择图片或PDF文件');
      return;
    }

    setIsProcessing(true);
    setError('');
    setExtractedText('');
    setTotalPages(filePreviews.length);
    setProgress(0);
    setStatusText('正在初始化OCR引擎...');

    try {
      // 先初始化 Worker（首次会下载语言包）
      const worker = await getWorker();
      
      let allText = '';

      for (let i = 0; i < filePreviews.length; i++) {
        setCurrentPage(i + 1);
        setProgress(0);
        setStatusText(`识别第 ${i + 1}/${filePreviews.length} 页...`);

        const preview = filePreviews[i];
        
        // 识别图片
        const { data } = await worker.recognize(preview.url);
        
        allText += `\n\n═══════════════════════════════════\n`;
        allText += `📄 ${preview.name} - 第 ${preview.pageNumber} 页\n`;
        allText += `═══════════════════════════════════\n\n`;
        allText += data.text.trim();
        
        setProgress(100);
      }

      setExtractedText(allText);
      setStatusText(`识别完成！共 ${filePreviews.length} 页`);
    } catch (err) {
      console.error('OCR识别失败:', err);
      setError('识别失败: ' + err.message + '。请检查网络连接后重试。');
    } finally {
      setIsProcessing(false);
    }
  };

  // 复制文本
  const handleCopyText = () => {
    if (extractedText) {
      navigator.clipboard.writeText(extractedText).then(() => {
        alert('文本已复制到剪贴板');
      });
    }
  };

  // 下载文本
  const handleDownloadText = () => {
    if (!extractedText) return;
    
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr_result_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 删除预览项
  const removeFile = (index) => {
    const previewToRemove = filePreviews[index];
    const newPreviews = filePreviews.filter((_, i) => i !== index);
    setFilePreviews(newPreviews);

    const remainingFromSameFile = newPreviews.some(p => p.file === previewToRemove.file);
    if (!remainingFromSameFile) {
      setSelectedFiles(prev => prev.filter(f => f !== previewToRemove.file));
    }

    if (newPreviews.length === 0) {
      setExtractedText('');
    }
  };

  // 重置
  const handleReset = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setExtractedText('');
    setError('');
    setProgress(0);
    setProgressMessage('');
    setStatusText('');
    setCurrentPage(0);
    setTotalPages(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // 销毁 Worker 以释放内存
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  };

  // 拖拽处理
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
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div className={styles.container}>
      {/* 状态栏 */}
      {statusText && (
        <div className={styles.statusBar}>
          <span>{statusText}</span>
        </div>
      )}
      
      <div className={styles.mainContent}>
        {/* 左侧面板 */}
        <div className={styles.leftPanel}>
          <div className={styles.panelHeader}>
            <h3>文件上传</h3>
            <div className={styles.headerActions}>
              {filePreviews.length > 0 && (
                <button onClick={handleReset} className={styles.resetBtn}>
                  重置
                </button>
              )}
            </div>
          </div>

          {/* 上传区域 */}
          {filePreviews.length === 0 && (
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
                multiple
                accept="image/*,application/pdf"
                onChange={(e) => handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
              />
              <div className={styles.uploadIcon}>📁</div>
              <p>点击或拖拽文件上传</p>
              <small>支持 JPG、PNG、PDF，可多选</small>
              <small style={{color: '#999', marginTop: '8px', display: 'block'}}>
                首次使用需下载中文语言包（约15MB）
              </small>
            </div>
          )}

          {/* 识别按钮 */}
          {filePreviews.length > 0 && (
            <button 
              onClick={handleStartOCR} 
              disabled={isProcessing} 
              className={styles.ocrBtn}
            >
              {isProcessing ? '识别中...' : `开始识别 (${filePreviews.length} 页)`}
            </button>
          )}

          {/* 进度条 */}
          {isProcessing && (
            <div className={styles.progressSection}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
              </div>
              <div className={styles.progressInfo}>
                <span>{statusText}</span>
                <span>第 {currentPage}/{totalPages} 页</span>
              </div>
            </div>
          )}

          {/* 文件预览列表 */}
          {filePreviews.length > 0 && (
            <div className={styles.previewList}>
              <div className={styles.previewListHeader}>
                <span>文件预览 ({filePreviews.length} 页)</span>
              </div>
              <div className={styles.previewItems}>
                {filePreviews.map((preview, index) => (
                  <div key={preview.id} className={styles.previewItem}>
                    <div className={styles.previewHeader}>
                      <span className={styles.pageBadge}>第 {preview.pageNumber} 页</span>
                      <span className={styles.previewName}>{preview.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className={styles.removeBtn}
                        disabled={isProcessing}
                      >
                        ×
                      </button>
                    </div>
                    <div className={styles.previewImageWrapper}>
                      <img
                        src={preview.url}
                        alt={preview.name}
                        className={styles.previewImage}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 文件信息 */}
          {selectedFiles.length > 0 && (
            <div className={styles.fileInfo}>
              <p>已选择 {selectedFiles.length} 个文件</p>
            </div>
          )}
        </div>

        {/* 右侧面板 */}
        <div className={styles.rightPanel}>
          <div className={styles.panelHeader}>
            <h3>识别结果</h3>
            {extractedText && (
              <div className={styles.headerActions}>
                <button onClick={handleCopyText} className={styles.actionBtn}>
                  复制
                </button>
                <button onClick={handleDownloadText} className={styles.actionBtn}>
                  下载TXT
                </button>
              </div>
            )}
          </div>

          <div className={styles.resultContent}>
            {/* 错误提示 */}
            {error && (
              <div className={styles.errorToast}>
                <span>⚠️ {error}</span>
                <button onClick={() => setError('')}>关闭</button>
              </div>
            )}

            {/* 识别结果 */}
            {extractedText ? (
              <pre className={styles.textResult}>{extractedText}</pre>
            ) : !isProcessing ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📄</div>
                <p>暂无识别结果</p>
                <small>请上传文件后点击"开始识别"</small>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TesseractOCR;