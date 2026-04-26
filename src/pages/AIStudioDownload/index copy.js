// AIStudio.jsx - 主组件（完整版本，包含调试面板）
import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import styles from './index.module.css';
import PropertyTable from './PropertyTable';
import { parsePropertyInfo } from './propertyParser';

const AIStudio = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [propertyData, setPropertyData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  
  // 调试相关状态
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugData, setDebugData] = useState({
    apiResponse: null,
    extractedText: '',
    parsedResult: null,
    timestamp: ''
  });
  
  const fileInputRef = useRef(null);
  
  const API_CONFIG = {
    proxyUrl: 'http://localhost:3001/api/ocr'
  };

  // 处理文件选择
  const handleFileSelect = useCallback(async (files) => {
    const validFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/') && 
      (file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg')
    );

    if (validFiles.length === 0) {
      setError('请选择 PNG 或 JPG 格式的图片文件');
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    const previews = await Promise.all(validFiles.map(file => generatePreview(file)));
    setFilePreviews(prev => [...prev, ...previews]);
    setError('');
  }, []);

  // 生成文件预览
  const generatePreview = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          id: Date.now() + Math.random(),
          file: file,
          name: file.name,
          thumbnail: e.target.result,
          size: file.size,
          uploadTime: new Date().toLocaleString()
        });
      };
      reader.readAsDataURL(file);
    });
  };

  // 调用OCR API
  const callOCRAPI = async (imageBase64) => {
    try {
      const base64Data = imageBase64.split(',')[1];
      const response = await fetch(API_CONFIG.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Data, type: 'ocr' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('OCR API调用失败:', error);
      throw error;
    }
  };

  // 从OCR结果中提取文本
// 在 AIStudio.jsx 中更新 extractTextFromOCRResult 函数
const extractTextFromOCRResult = (result) => {
  let fullText = '';
  
  try {
    if (result && typeof result === 'object') {
      let dataSource = result.result || result.data || result;
      
      if (typeof dataSource === 'string') {
        try {
          dataSource = JSON.parse(dataSource);
        } catch(e) {
          fullText = dataSource;
        }
      }
      
      // 处理layoutParsingResults
      if (dataSource.layoutParsingResults) {
        for (const layoutResult of dataSource.layoutParsingResults) {
          // 提取markdown文本
          if (layoutResult.markdown?.text) {
            fullText += layoutResult.markdown.text + '\n';
          }
          
          // 提取表格HTML - 重要！保留HTML格式
          if (layoutResult.tableResult?.html) {
            fullText += layoutResult.tableResult.html + '\n';
          }
        }
      }
      
      // 处理ocrResults
      if (dataSource.ocrResults) {
        for (const pageResult of dataSource.ocrResults) {
          if (pageResult.prunedResult) {
            for (const item of pageResult.prunedResult) {
              if (item.length >= 2) {
                // 检查是否是表格数据
                if (typeof item[1] === 'string') {
                  if (item[1].includes('<table') || item[1].includes('<td')) {
                    // 保留HTML格式
                    fullText += item[1] + '\n';
                  } else {
                    fullText += item[1] + '\n';
                  }
                } else if (typeof item[1] === 'object' && item[1].html) {
                  // 如果包含HTML属性
                  fullText += item[1].html + '\n';
                }
              }
            }
          }
        }
      }
      
      if (!fullText && dataSource.text) {
        fullText = dataSource.text;
      }
    } else if (typeof result === 'string') {
      fullText = result;
    }
  } catch (error) {
    console.error('文本提取失败:', error);
    fullText = JSON.stringify(result);
  }
  
  // 清理文本但保留HTML标签
  fullText = fullText
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
  
  console.log('提取的原始文本:', fullText.substring(0, 500));
  
  return fullText;
};

  // 批量处理文件
  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) {
      setError('请先选择图片文件');
      return;
    }

    setIsLoading(true);
    setError('');
    setPropertyData([]);

    try {
      const allPropertyData = [];
      const allDebugData = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        setCurrentFileIndex(i);
        setParseProgress(0);
        
        const progressInterval = setInterval(() => {
          setParseProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        // 调用API
        const result = await callOCRAPI(filePreviews[i].thumbnail);
        
        // 保存API原始响应到调试数据
        allDebugData.push({
          fileName: filePreviews[i].name,
          apiResponse: result,
          timestamp: new Date().toLocaleString()
        });
        
        clearInterval(progressInterval);
        setParseProgress(100);

        // 提取完整文本
        let fullText = extractTextFromOCRResult(result);
        
        // 保存提取的文本到调试数据
        if (allDebugData[i]) {
          allDebugData[i].extractedText = fullText;
        }
        
        // 解析房产信息
        const propertyInfo = parsePropertyInfo(fullText, filePreviews[i].name);
        
        // 保存解析结果到调试数据
        if (allDebugData[i]) {
          allDebugData[i].parsedResult = propertyInfo;
        }
        
        if (propertyInfo) {
          allPropertyData.push(propertyInfo);
        }
      }

      // 更新状态
      setPropertyData(allPropertyData);
      setDebugData({
        files: allDebugData,
        totalFiles: allDebugData.length,
        processTime: new Date().toLocaleString()
      });
      
      if (allPropertyData.length === 0) {
        setError('未能提取到有效的房产信息，请检查图片质量');
      }
    } catch (error) {
      setError(`处理失败: ${error.message}`);
      console.error('处理错误:', error);
    } finally {
      setIsLoading(false);
      setParseProgress(0);
    }
  };

  // 删除文件
  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // 清空所有文件
  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setPropertyData([]);
    setError('');
    setDebugData({
      apiResponse: null,
      extractedText: '',
      parsedResult: null,
      timestamp: ''
    });
  };

  // 下载Excel
  const handleDownloadExcel = () => {
    if (propertyData.length === 0) {
      setError('没有可导出的数据');
      return;
    }

    // 创建Excel工作表
    const worksheetData = [
      ['产权证号', '权利人', '共有情况', '坐落', '不动产单元号', 
       '权利类型', '权利性质', '用途', '面积', '使用期限', 
       '房屋结构', '套内面积', '所在楼层', '业务编号', 
       '营业执照', '身份证号', '来源文件']
    ];

    propertyData.forEach(data => {
      worksheetData.push([
        data.产权证号 || '',
        data.权利人 || '',
        data.共有情况 || '',
        data.坐落 || '',
        data.不动产单元号 || '',
        data.权利类型 || '',
        data.权利性质 || '',
        data.用途 || '',
        data.面积 || '',
        data.使用期限 || '',
        data.房屋结构 || '',
        data.套内面积 || '',
        data.所在楼层 || '',
        data.业务编号 || '',
        data.营业执照 || '',
        data.身份证号 || '',
        data.sourceFile || ''
      ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // 设置列宽
    ws['!cols'] = [
      { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 30 },
      { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 20 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, '不动产信息');

    const now = new Date();
    const fileName = `不动产信息_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.xlsx`;
    XLSX.writeFile(wb, fileName);
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

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 切换调试面板
  const toggleDebugPanel = () => {
    setShowDebugPanel(!showDebugPanel);
  };

  // 复制调试信息
  const copyDebugInfo = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('调试信息已复制到剪贴板');
    });
  };

  // 下载调试日志
  const downloadDebugLog = () => {
    if (!debugData.files || debugData.files.length === 0) {
      setError('没有调试数据可下载');
      return;
    }

    const debugLog = debugData.files.map((fileDebug, index) => {
      return `
========================================
文件 ${index + 1}/${debugData.totalFiles}: ${fileDebug.fileName}
处理时间: ${fileDebug.timestamp}
========================================

【API原始响应】
${JSON.stringify(fileDebug.apiResponse, null, 2)}

【提取的原始文本】
${fileDebug.extractedText || '未提取到文本'}

【解析后的房产信息】
${JSON.stringify(fileDebug.parsedResult, null, 2)}

`;
    }).join('\n');

    const fullLog = `
╔═══════════════════════════════════════════╗
║     不动产信息提取系统 - 调试日志          ║
╠═══════════════════════════════════════════╣
║  处理时间: ${debugData.processTime}                  ║
║  处理文件数: ${debugData.totalFiles}                          ║
╚═══════════════════════════════════════════╝

${debugLog}

`;

    const blob = new Blob([fullLog], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr_debug_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>不动产信息提取系统</h1>
          <p>基于PP-OCRv5的智能识别</p>
        </div>
        <div className={styles.headerRight}>
          <button 
            onClick={toggleDebugPanel} 
            className={`${styles.debugToggleBtn} ${showDebugPanel ? styles.active : ''}`}
          >
            🐛 {showDebugPanel ? '隐藏调试面板' : '显示调试面板'}
          </button>
          <div className={styles.apiStatus}>
            <span className={styles.dot}></span>
            PP-OCRv5已就绪
          </div>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className={styles.mainContent}>
        {/* 左侧面板 */}
        <div className={styles.leftPanel}>
          <div className={styles.panelHeader}>
            <h3>文档管理</h3>
            <button onClick={clearAllFiles} className={styles.clearBtn}>清空</button>
          </div>

          {/* 上传区域 */}
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
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => handleFileSelect(e.target.files)}
              style={{ display: 'none' }}
            />
            <div className={styles.uploadIcon}>📁</div>
            <p>点击或拖拽文件上传</p>
            <small>支持PNG、JPG格式</small>
          </div>

          {/* 处理按钮 */}
          <button 
            onClick={handleProcessFiles} 
            disabled={isLoading || selectedFiles.length === 0} 
            className={styles.processBtn}
          >
            {isLoading ? `处理中 ${currentFileIndex + 1}/${selectedFiles.length}...` : '开始识别'}
          </button>

          {/* 文件列表 */}
          {filePreviews.length > 0 && (
            <div className={styles.fileList}>
              {filePreviews.map((preview, index) => (
                <div key={preview.id} className={styles.fileItem}>
                  <img src={preview.thumbnail} alt={preview.name} className={styles.fileThumb} />
                  <div className={styles.fileInfo}>
                    <div className={styles.fileName}>{preview.name}</div>
                    <div className={styles.fileMeta}>
                      {formatFileSize(preview.size)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className={styles.removeBtn}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 加载进度 */}
          {isLoading && (
            <div className={styles.progressSection}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${parseProgress}%` }}
                ></div>
              </div>
              <p>正在处理第 {currentFileIndex + 1}/{selectedFiles.length} 个文档</p>
            </div>
          )}
        </div>

        {/* 右侧面板 - 结果展示 */}
        <div className={styles.rightPanel}>
          <div className={styles.panelHeader}>
            <h3>识别结果</h3>
            {propertyData.length > 0 && (
              <div className={styles.actionButtons}>
                <button onClick={handleDownloadExcel} className={styles.downloadBtn}>
                  📥 下载Excel
                </button>
              </div>
            )}
          </div>

          {/* 加载状态 */}
          {isLoading && (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>正在识别中...</p>
            </div>
          )}

          {/* 表格展示 */}
          {!isLoading && propertyData.length > 0 && (
            <PropertyTable data={propertyData} />
          )}

          {/* 空状态 */}
          {!isLoading && propertyData.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📄</div>
              <p>暂无识别结果</p>
              <small>请上传不动产证图片后点击"开始识别"</small>
            </div>
          )}

          {/* 统计信息 */}
          {propertyData.length > 0 && (
            <div className={styles.statistics}>
              <span>共识别 {propertyData.length} 条记录</span>
              <span>识别时间: {new Date().toLocaleString()}</span>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className={styles.errorToast}>
              <span>⚠️ {error}</span>
              <button onClick={() => setError('')}>关闭</button>
            </div>
          )}
        </div>
      </div>

      {/* 调试面板 */}
      {showDebugPanel && (
        <div className={styles.debugPanel}>
          <div className={styles.debugPanelHeader}>
            <h3>🐛 调试信息面板</h3>
            <div className={styles.debugActions}>
              <button onClick={downloadDebugLog} className={styles.debugActionBtn}>
                📥 下载调试日志
              </button>
              <button onClick={toggleDebugPanel} className={styles.debugCloseBtn}>
                ✕
              </button>
            </div>
          </div>
          
          <div className={styles.debugContent}>
            {!debugData.files || debugData.files.length === 0 ? (
              <div className={styles.debugEmpty}>
                <p>暂无调试数据</p>
                <small>请先上传图片并点击"开始识别"</small>
              </div>
            ) : (
              <div className={styles.debugFiles}>
                {debugData.files.map((fileDebug, fileIndex) => (
                  <div key={fileIndex} className={styles.debugFile}>
                    <div className={styles.debugFileHeader}>
                      <h4>
                        📄 文件 {fileIndex + 1}/{debugData.totalFiles}: {fileDebug.fileName}
                      </h4>
                      <span className={styles.debugTimestamp}>{fileDebug.timestamp}</span>
                      <button 
                        onClick={() => copyDebugInfo(JSON.stringify(fileDebug, null, 2))}
                        className={styles.debugCopyBtn}
                      >
                        复制全部
                      </button>
                    </div>
                    
                    {/* API原始响应 */}
                    <div className={styles.debugSection}>
                      <div className={styles.debugSectionHeader}>
                        <h5>📡 API原始响应</h5>
                        <button 
                          onClick={() => copyDebugInfo(JSON.stringify(fileDebug.apiResponse, null, 2))}
                          className={styles.debugCopySmall}
                        >
                          复制
                        </button>
                      </div>
                      <pre className={styles.debugCode}>
                        {JSON.stringify(fileDebug.apiResponse, null, 2)}
                      </pre>
                    </div>
                    
                    {/* 提取的原始文本 */}
                    <div className={styles.debugSection}>
                      <div className={styles.debugSectionHeader}>
                        <h5>📝 提取的原始文本</h5>
                        <button 
                          onClick={() => copyDebugInfo(fileDebug.extractedText || '无文本')}
                          className={styles.debugCopySmall}
                        >
                          复制
                        </button>
                      </div>
                      <pre className={styles.debugText}>
                        {fileDebug.extractedText || '未提取到文本'}
                      </pre>
                    </div>
                    
                    {/* 解析后的房产信息 */}
                    <div className={styles.debugSection}>
                      <div className={styles.debugSectionHeader}>
                        <h5>🏠 解析后的房产信息</h5>
                        <button 
                          onClick={() => copyDebugInfo(JSON.stringify(fileDebug.parsedResult, null, 2))}
                          className={styles.debugCopySmall}
                        >
                          复制
                        </button>
                      </div>
                      <pre className={styles.debugCode}>
                        {JSON.stringify(fileDebug.parsedResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* 调试面板底部信息 */}
          <div className={styles.debugFooter}>
            <span>处理时间: {debugData.processTime}</span>
            <span>处理文件数: {debugData.totalFiles}</span>
            <span>成功解析: {propertyData.length} 条记录</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIStudio;