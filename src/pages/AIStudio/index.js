import React, { useState, useRef, useCallback } from 'react';
import styles from './index.module.css';

const AIStudio = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [extractedData, setExtractedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [activeFileId, setActiveFileId] = useState(null);
  const [parseMode, setParseMode] = useState('ocr');
  const [parseProgress, setParseProgress] = useState(0);
  
  const fileInputRef = useRef(null);
  
  // 配置本地代理服务器
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

  // 调用OCR API（通过本地代理）
// 调用OCR API（通过本地代理）
const callOCRAPI = async (imageBase64, apiType = 'ocr') => {
  try {
    const base64Data = imageBase64.split(',')[1];
    
    console.log('发送请求到代理服务器...');
    
    const response = await fetch(API_CONFIG.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Data,
        type: apiType
      })
    });
    
    const data = await response.json();
    
    // 添加调试日志
    console.log('API返回的原始数据:', JSON.stringify(data, null, 2));
    
    if (data.error_code) {
      throw new Error(`API错误: ${data.error_msg} (${data.error_code})`);
    }
    
    return data;
  } catch (error) {
    console.error('OCR API调用失败:', error);
    throw error;
  }
};

  // 从HTML表格中提取纯文本
  const extractTextFromHTML = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  // 解析OCR结果 - 适配飞桨AI Studio PP-OCRv5
// 解析OCR结果 - 专门处理不动产证格式
// 解析OCR结果 - 处理JSON格式的不动产证数据
const parseOCRResult = (result) => {
  console.log('开始解析，result类型:', typeof result);
  console.log('result内容:', result);
  
  let fullText = '';
  let tableData = {};
  
  // 检查是否是JSON对象且包含result字段
  if (result && typeof result === 'object') {
    // 情况1: 数据在 result.result 中
    let dataSource = result.result || result.data || result;
    
    // 如果是字符串，尝试解析JSON
    if (typeof dataSource === 'string') {
      try {
        dataSource = JSON.parse(dataSource);
      } catch(e) {
        fullText = dataSource;
      }
    }
    
    // 检查是否有OCR结果（PP-OCRv5返回格式）
    if (dataSource.layoutParsingResults && dataSource.layoutParsingResults.length > 0) {
      // 从layoutParsingResults中提取markdown文本
      for (const layoutResult of dataSource.layoutParsingResults) {
        if (layoutResult.markdown && layoutResult.markdown.text) {
          fullText += layoutResult.markdown.text + '\n';
        }
        if (layoutResult.tableResult && layoutResult.tableResult.html) {
          fullText += layoutResult.tableResult.html + '\n';
        }
      }
    }
    
    // 检查是否有ocrResults
    if (dataSource.ocrResults && dataSource.ocrResults.length > 0) {
      for (const pageResult of dataSource.ocrResults) {
        if (pageResult.prunedResult) {
          for (const item of pageResult.prunedResult) {
            if (item.length >= 2 && typeof item[1] === 'string') {
              fullText += item[1] + '\n';
            }
          }
        }
      }
    }
    
    // 如果还是没找到，尝试直接提取字符串内容
    if (!fullText && dataSource.text) {
      fullText = dataSource.text;
    }
  } else if (typeof result === 'string') {
    fullText = result;
  }
  
  // 如果fullText还是空，尝试从原始result中提取
  if (!fullText && result.rawResult) {
    fullText = JSON.stringify(result.rawResult);
  }
  
  // 清理文本：提取纯文本内容，移除JSON格式标记
  let cleanedText = fullText;
  
  // 移除block_bbox, block_id等JSON标记
  cleanedText = cleanedText.replace(/,"block_bbox":[^,}]+/g, '');
  cleanedText = cleanedText.replace(/,"block_id":\d+/g, '');
  cleanedText = cleanedText.replace(/,"block_order":\d+/g, '');
  cleanedText = cleanedText.replace(/,"group_id":\d+/g, '');
  cleanedText = cleanedText.replace(/,"block_polygon":[^}]+/g, '');
  cleanedText = cleanedText.replace(/[{}"]/g, '');
  cleanedText = cleanedText.replace(/\\"/g, '"');
  cleanedText = cleanedText.replace(/\\n/g, '\n');
  
  // 提取产权证号
  const certNumberMatch = cleanedText.match(/渝[（(]\d+[）)][^\\n,]+/);
  const certNumber = certNumberMatch ? certNumberMatch[0] : '';
  
  // 提取表格数据 - 支持多种格式
  const patterns = [
    // HTML表格格式
    /<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi,
    // 键值对格式（中文冒号）
    /([^：:\\n,]+)[：:]\\s*([^,\\n]+)/g,
  ];
  
  // 处理HTML表格
  let match;
  const htmlPattern = /<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
  while ((match = htmlPattern.exec(cleanedText)) !== null) {
    let key = match[1].trim();
    let value = match[2].trim();
    if (key && value && !key.includes('table') && !key.includes('border') && !key.includes('style')) {
      tableData[key] = value;
    }
  }
  
  // 处理键值对
  const kvPattern = /([^：:\\n,]+)[：:]\\s*([^,\\n]+)/g;
  while ((match = kvPattern.exec(cleanedText)) !== null) {
    let key = match[1].trim();
    let value = match[2].trim();
    if (key && value && !tableData[key] && key.length < 20 && value.length < 500) {
      // 过滤掉不需要的字段
      const excludeKeys = ['block_bbox', 'block_id', 'block_order', 'group_id', 'block_polygon', 'result', 'errorCode'];
      if (!excludeKeys.includes(key)) {
        tableData[key] = value;
      }
    }
  }
  
  // 构建格式化的显示文本
  let formattedText = '';
  
  // 1. 添加产权证号
  if (certNumber) {
    formattedText += certNumber + '\n\n';
  }
  
  // 2. 按顺序添加字段
  const fieldOrder = [
    '权利人', '共有情况', '坐落', '不动产单元号', '权利类型', 
    '权利性质', '用途', '面积', '使用期限', '权利其他状况'
  ];
  
  for (const field of fieldOrder) {
    if (tableData[field]) {
      formattedText += `${field}\t${tableData[field]}\n`;
    }
  }
  
  // 3. 处理权利其他状况中的细分字段
  if (tableData['权利其他状况']) {
    const otherInfo = tableData['权利其他状况'];
    if (otherInfo.includes('身份证')) {
      const idMatch = otherInfo.match(/身份证[：:]?\s*(\d+)/);
      if (idMatch) formattedText += `身份证号\t${idMatch[1]}\n`;
    }
    if (otherInfo.includes('房屋结构')) {
      const structureMatch = otherInfo.match(/房屋结构[：:]?\s*([^；;]+)/);
      if (structureMatch) formattedText += `房屋结构\t${structureMatch[1]}\n`;
    }
    if (otherInfo.includes('专有建筑面积')) {
      const areaMatch = otherInfo.match(/专有建筑面积[（(]套内面积[）)]\s*[：:]?\s*([^；;]+)/);
      if (areaMatch) formattedText += `套内面积\t${areaMatch[1]}\n`;
    }
    if (otherInfo.includes('所在楼层')) {
      const floorMatch = otherInfo.match(/所在楼层[（(]名义层[）)]\s*[：:]?\s*([^；;]+)/);
      if (floorMatch) formattedText += `所在楼层\t${floorMatch[1]}\n`;
    }
    if (otherInfo.includes('业务编号')) {
      const bizMatch = otherInfo.match(/业务编号[：:]?\s*(\d+)/);
      if (bizMatch) formattedText += `业务编号\t${bizMatch[1]}\n`;
    }
  }
  
  // 如果没有提取到数据，显示清理后的文本
  if (!formattedText) {
    // 移除JSON格式标记
    let displayText = cleanedText
      .replace(/\\n/g, '\n')
      .replace(/,,+/g, ',')
      .replace(/^\s*\[|\]\s*$/g, '');
    
    // 提取有意义的中文内容
    const chineseLines = displayText.split('\n').filter(line => /[\u4e00-\u9fa5]/.test(line));
    if (chineseLines.length > 0) {
      formattedText = chineseLines.join('\n');
    } else {
      formattedText = '识别成功，但未能提取到结构化数据。原始返回：\n' + displayText.substring(0, 500);
    }
  }
  
  // 将格式化文本转换为行数组
  const lines_array = formattedText.split('\n').filter(line => line.trim()).map(line => {
    if (line.includes('\t')) {
      const [key, value] = line.split('\t');
      return { text: line, key: key, value: value || '' };
    }
    return { text: line, key: null, value: null };
  });
  
  return {
    text: formattedText,
    lines: lines_array,
    confidence: 95,
    tableData: tableData,
    rawData: result
  };
};

  // 解析文档版面分析结果 - 适配PP-OCRv5
  const parseDocAnalysisResult = (result) => {
    const layoutResults = result.result?.layoutParsingResults;
    
    if (!layoutResults || layoutResults.length === 0) {
      return { text: '未识别到内容', sections: [] };
    }
    
    const sections = [];
    let fullText = '';
    
    for (const layoutResult of layoutResults) {
      // 提取Markdown作为section
      const markdownText = layoutResult.markdown?.text || '';
      if (markdownText) {
        sections.push({
          type: 'markdown',
          text: markdownText,
          confidence: 0.95
        });
        fullText += markdownText + '\n\n';
      }
      
      // 提取表格作为section
      const tableResult = layoutResult.tableResult;
      if (tableResult && tableResult.html) {
        sections.push({
          type: 'table',
          text: tableResult.html,
          confidence: 0.9
        });
        fullText += `表格: ${extractTextFromHTML(tableResult.html)}\n\n`;
      }
    }
    
    return {
      text: fullText,
      sections: sections
    };
  };

  // 处理单个文件
  const processFile = async (file, preview, index) => {
    try {
      setCurrentFileIndex(index);
      setParseProgress(0);
      
      const progressInterval = setInterval(() => {
        setParseProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      let result;
      switch(parseMode) {
        case 'accurate':
          result = await callOCRAPI(preview.thumbnail, 'accurate');
          break;
        case 'table':
          result = await callOCRAPI(preview.thumbnail, 'table');
          break;
        case 'layout':
          result = await callOCRAPI(preview.thumbnail, 'layout');
          break;
        default:
          result = await callOCRAPI(preview.thumbnail, 'ocr');
      }
      
      clearInterval(progressInterval);
      setParseProgress(100);
      
      let parsedResult;
      if (parseMode === 'layout') {
        parsedResult = parseDocAnalysisResult(result);
      } else {
        parsedResult = parseOCRResult(result);
      }
      
      return {
        id: preview.id,
        fileName: file.name,
        uploadTime: preview.uploadTime,
        result: parsedResult,
        rawResult: result,
        parseMode: parseMode,
        parseTime: new Date().toLocaleString()
      };
    } catch (error) {
      console.error(`处理文件 ${file.name} 失败:`, error);
      throw error;
    }
  };

  // 批量处理文件
  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) {
      setError('请先选择图片文件');
      return;
    }

    setIsLoading(true);
    setError('');
    setExtractedData([]);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const preview = filePreviews[i];
        
        const result = await processFile(file, preview, i);
        setExtractedData(prev => [...prev, result]);
        
        if (i === 0 && !activeFileId) {
          setActiveFileId(result.id);
        }
      }
    } catch (error) {
      setError(`处理失败: ${error.message}`);
    } finally {
      setIsLoading(false);
      setParseProgress(0);
    }
  };

  // 删除文件
  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
    
    if (activeFileId === filePreviews[index]?.id) {
      setActiveFileId(null);
    }
  };

  // 清空所有文件
  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setExtractedData([]);
    setActiveFileId(null);
    setError('');
  };

  // 导出结果
  const exportResults = () => {
    if (extractedData.length === 0) {
      setError('没有可导出的数据');
      return;
    }
    
    const exportText = extractedData.map(data => {
      return `文件名：${data.fileName}\n解析时间：${data.parseTime}\n解析模式：${data.parseMode}\n识别结果：\n${data.result.text}\n${'='.repeat(50)}\n`;
    }).join('\n');
    
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr_results_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 复制文本
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('已复制到剪贴板');
    } catch (err) {
      setError('复制失败');
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
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取当前激活文件的解析结果
  const activeResult = extractedData.find(data => data.id === activeFileId);

  return (
    <div className={styles.container}>
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>文本提取</h1>
         
        </div>
        <div className={styles.headerRight}>
          <div className={styles.apiStatus}>
            <span className={styles.dot}></span>
            PP-OCRv5已就绪
          </div>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className={styles.mainContent}>
        {/* 左侧面板 - 文件管理 */}
        <div className={styles.leftPanel}>
          <div className={styles.panelHeader}>
            <h3>文档管理</h3>
            <button onClick={clearAllFiles} className={styles.clearBtn}>
              清空所有
            </button>
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
            <p>点击或拖拽文件到此区域</p>
            <small>支持 PNG、JPG 格式，可批量上传</small>
          </div>

          {/* 解析模式选择 */}
          <div className={styles.parseModeSection}>
            <label className={styles.sectionLabel}>解析模式</label>
            <div className={styles.modeButtons}>
              <button
                className={`${styles.modeBtn} ${parseMode === 'ocr' ? styles.active : ''}`}
                onClick={() => setParseMode('ocr')}
              >
                通用OCR
              </button>
              <button
                className={`${styles.modeBtn} ${parseMode === 'accurate' ? styles.active : ''}`}
                onClick={() => setParseMode('accurate')}
              >
                高精度OCR
              </button>
              <button
                className={`${styles.modeBtn} ${parseMode === 'table' ? styles.active : ''}`}
                onClick={() => setParseMode('table')}
              >
                表格识别
              </button>
              <button
                className={`${styles.modeBtn} ${parseMode === 'layout' ? styles.active : ''}`}
                onClick={() => setParseMode('layout')}
              >
                版面分析
              </button>
            </div>
          </div>

          {/* 文件列表 */}
          {filePreviews.length > 0 && (
            <div className={styles.fileList}>
              <div className={styles.fileListHeader}>
                <span>已选文件 ({filePreviews.length})</span>
                <button onClick={handleProcessFiles} disabled={isLoading} className={styles.processAllBtn}>
                  {isLoading ? '解析中...' : '开始解析'}
                </button>
              </div>
              
              <div className={styles.fileItems}>
                {filePreviews.map((preview, index) => {
                  const result = extractedData.find(d => d.id === preview.id);
                  return (
                    <div
                      key={preview.id}
                      className={`${styles.fileItem} ${activeFileId === preview.id ? styles.active : ''}`}
                      onClick={() => setActiveFileId(preview.id)}
                    >
                      <img src={preview.thumbnail} alt={preview.name} className={styles.fileThumb} />
                      <div className={styles.fileInfo}>
                        <div className={styles.fileName}>{preview.name}</div>
                        <div className={styles.fileMeta}>
                          <span>{formatFileSize(preview.size)}</span>
                          {result && <span className={styles.parsed}>✓ 已解析</span>}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                        className={styles.removeBtn}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 右侧面板 - 结果展示 */}
        <div className={styles.rightPanel}>
          <div className={styles.panelHeader}>
            <h3>解析结果</h3>
            {extractedData.length > 0 && (
              <div className={styles.resultActions}>
                <button onClick={exportResults} className={styles.exportBtn}>
                  导出结果
                </button>
              </div>
            )}
          </div>

          {/* 加载状态 */}
          {isLoading && (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${parseProgress}%` }}></div>
              </div>
              <p>正在解析第 {currentFileIndex + 1}/{selectedFiles.length} 个文档...</p>
              <p className={styles.loadingTip}>文档解析中，请稍候...</p>
            </div>
          )}

          {/* 解析结果展示 */}
          {!isLoading && activeResult && (
            <div className={styles.resultContainer}>
              <div className={styles.resultHeader}>
                <div className={styles.resultTitle}>
                  <strong>{activeResult.fileName}</strong>
                  <span className={styles.resultBadge}>{activeResult.parseMode}</span>
                </div>
                <div className={styles.resultTime}>
                  解析时间：{activeResult.parseTime}
                </div>
                <button
                  onClick={() => copyToClipboard(activeResult.result.text)}
                  className={styles.copyBtn}
                >
                  复制全文
                </button>
              </div>

              <div className={styles.resultContent}>
                {/* 版面分析结果 */}
                {activeResult.parseMode === 'layout' && activeResult.result.sections && (
                  <div className={styles.sectionsView}>
                    {activeResult.result.sections.map((section, idx) => (
                      <div key={idx} className={styles.section}>
                        <div className={styles.sectionType}>
                          <span className={styles.typeTag}>{section.type}</span>
                          <span className={styles.confidence}>置信度: {(section.confidence * 100).toFixed(2)}%</span>
                        </div>
                        <div className={styles.sectionText}>{section.text}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* OCR结果 - 带行号 */}
                {activeResult.parseMode !== 'layout' && activeResult.result.lines && (
                  <div className={styles.linesView}>
                    {activeResult.result.lines.map((line, idx) => (
                      <div key={idx} className={styles.lineItem}>
                        <div className={styles.lineNumber}>{idx + 1}</div>
                        <div className={styles.lineText}>{line.text}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 纯文本视图 */}
                {!activeResult.result.lines && !activeResult.result.sections && (
                  <div className={styles.plainText}>
                    <pre>{activeResult.result.text}</pre>
                  </div>
                )}
              </div>

              <div className={styles.resultFooter}>
                <div className={styles.statInfo}>
                  共识别 {activeResult.result.lines?.length || activeResult.result.sections?.length || 0} 个字段
                </div>
                <div className={styles.confidenceInfo}>
                  识别置信度: {(activeResult.result.confidence || 0)}%
                </div>
              </div>
            </div>
          )}

          {/* 空状态 */}
          {!isLoading && !activeResult && filePreviews.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📄</div>
              <p>暂无解析结果</p>
              <small>请先上传图片，然后点击"开始解析"</small>
            </div>
          )}

          {!isLoading && !activeResult && filePreviews.length > 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🚀</div>
              <p>点击"开始解析"按钮开始识别文档</p>
              <small>将使用{parseMode === 'ocr' ? '通用OCR' : parseMode === 'accurate' ? '高精度OCR' : parseMode === 'table' ? '表格识别' : '版面分析'}模式</small>
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
    </div>
  );
};

export default AIStudio;