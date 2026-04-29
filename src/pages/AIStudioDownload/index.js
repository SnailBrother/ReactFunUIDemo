import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import styles from './index.module.css';
import PropertyTable from './PropertyTable';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const AIStudio = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [propertyData, setPropertyData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('table');
  const [debugData, setDebugData] = useState({ allRawText: '', allJsonResponse: [] });

  const fileInputRef = useRef(null);

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

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        const url = URL.createObjectURL(blob);

        pages.push({ pageNumber: i, blob, url, originalFile: pdfFile });
      }
      return pages;
    } catch (error) {
      console.error('PDF 转图片失败:', error);
      throw new Error('PDF 解析失败: ' + error.message);
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
                file,
                size: file.size
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
                file,
                blob: page.blob,
                size: file.size
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
      setPropertyData([]);
      setDebugData({ allRawText: '', allJsonResponse: [] });
    } else {
      setError('请选择有效的图片或PDF文件');
    }
  }, []);

  // 调用后端统一接口：OCR + AI提取
  const callExtractAPI = async (imageBase64) => {
    const base64Data = imageBase64.split(',')[1] || imageBase64;

    const response = await fetch('/api/ocr-and-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  };

  // 批量处理文件
  const handleProcessFiles = async () => {
    if (filePreviews.length === 0) {
      setError('请先选择图片或PDF文件');
      return;
    }

    setIsLoading(true);
    setError('');
    setPropertyData([]);

    try {
      const allPropertyData = [];
      const allApiResponses = [];
      let allRawText = '';

      for (let i = 0; i < filePreviews.length; i++) {
        const preview = filePreviews[i];
        setCurrentFileIndex(i);
        setParseProgress(0);

        const progressInterval = setInterval(() => {
          setParseProgress(prev => Math.min(prev + 10, 90));
        }, 200);

        let imageBase64;

        if (preview.type === 'pdf-page' && preview.blob) {
          imageBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(preview.blob);
          });
        } else {
          imageBase64 = preview.url;
        }

        // 调用统一接口
        const result = await callExtractAPI(imageBase64);

        clearInterval(progressInterval);
        setParseProgress(100);

        // 保存原始数据用于调试
        allApiResponses.push({
          index: i,
          fileName: preview.name,
          pageNumber: preview.pageNumber,
          data: result.data,
          rawText: result.rawText
        });

        if (allRawText) allRawText += '\n\n---\n\n';
        allRawText += `【${preview.name} - 第${preview.pageNumber}页】\n${result.rawText || ''}`;

        // 直接使用后端返回的结构化数据
        if (result.success && result.data) {
          allPropertyData.push({
            ...result.data,
            _index: i,
            _fileName: preview.name,
            _pageNumber: preview.pageNumber
          });
        }
      }

      setPropertyData(allPropertyData);
      setDebugData({
        allRawText: allRawText,
        allJsonResponse: allApiResponses
      });
      setActiveTab('table');

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
      setPropertyData([]);
      setDebugData({ allRawText: '', allJsonResponse: [] });
    }
  };

  // 重置
  const handleReset = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setPropertyData([]);
    setError('');
    setParseProgress(0);
    setCurrentFileIndex(0);
    setDebugData({ allRawText: '', allJsonResponse: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 下载Excel
const handleDownloadExcel = () => {
  if (propertyData.length === 0) {
      setError('没有可导出的数据');
      return;
    }

    // 过滤：产权证号、权利人、坐落 三个都是空或"未提及"的数据直接忽略
    const validData = propertyData.filter(data => {
      const isEmpty = (val) => !val || val.trim() === '' || val.trim() === '未提及';
      
      
      const locationEmpty = isEmpty(data.坐落);
      
      // 三个都为空才忽略，至少有一个有数据就保留
      return !(locationEmpty);
    });

    if (validData.length === 0) {
      setError('没有符合导出条件的数据（产权证号、权利人、坐落至少需要一个有有效数据）');
      return;
    }

    // 定义表头
    const headers = [
      '序号',
      '产权证号', '权利人', '坐落', 
      '房屋用途', '房屋结构', '房屋建筑面积(㎡)', '套内面积(㎡)', '所在楼层',
      '土地用途', '共有宗地面积(㎡)', '使用期限'
    ];

    // ========== 工具函数 ==========
    
    // 解析用途：拆分为土地用途和房屋用途
    const parseUsage = (usageText) => {
      if (!usageText) return { landUse: '', buildingUse: '' };
      
      // 去掉括号中的备注，如"城镇住宅用地/成套住宅（底商）"
      const cleaned = usageText.replace(/[（(][^）)]*[）)]/g, '').trim();
      
      if (cleaned.includes('/')) {
        const parts = cleaned.split('/');
        return {
          landUse: parts[0]?.trim() || '',
          buildingUse: parts[1]?.trim() || ''
        };
      }
      
      // 如果没有 /，整个作为土地用途
      return { landUse: cleaned, buildingUse: '' };
    };

    // 解析面积：拆分为共有宗地面积和房屋建筑面积（只保留数值）
    const parseArea = (areaText) => {
      if (!areaText) return { landArea: '', buildingArea: '' };
      
      // 清理LaTeX格式
      let cleaned = areaText
        .replace(/\$\s*/g, '')
        .replace(/\\,/g, '')
        .replace(/\\;/g, '')
        .replace(/m\s*\^\s*\{2\}\s*/g, '㎡')
        .replace(/m\s*\^\s*2\b/g, '㎡')
        .replace(/\^\s*\{2\}\s*/g, '²')
        .replace(/\\mathrm\{([^}]+)\}/g, '$1')
        .replace(/\\text\{([^}]+)\}/g, '$1')
        .replace(/\\+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      let landArea = '';
      let buildingArea = '';

      // 提取共有宗地面积数值
      const landMatch = cleaned.match(/共有宗地面积\s*(\d+\.?\d*)/);
      if (landMatch) {
        landArea = parseFloat(landMatch[1]);
      } else {
        // 兼容"宗地面积"格式
        const landMatch2 = cleaned.match(/宗地面积\s*(\d+\.?\d*)/);
        if (landMatch2) {
          landArea = parseFloat(landMatch2[1]);
        }
      }

      // 提取房屋建筑面积数值
      const buildingMatch = cleaned.match(/房屋建筑面积\s*(\d+\.?\d*)/);
      if (buildingMatch) {
        buildingArea = parseFloat(buildingMatch[1]);
      } else {
        // 兼容"建筑面积"格式
        const buildingMatch2 = cleaned.match(/(?<!宗地)建筑面积\s*(\d+\.?\d*)/);
        if (buildingMatch2) {
          buildingArea = parseFloat(buildingMatch2[1]);
        }
      }

      return { landArea, buildingArea };
    };

    // 解析使用期限：只提取日期部分
    const parseDate = (dateText) => {
      if (!dateText) return '';

      // 匹配各种日期格式
      const patterns = [
        /(\d{4})年(\d{1,2})月(\d{1,2})日/,   // 2054年03月09日
        /(\d{4})-(\d{1,2})-(\d{1,2})/,        // 2054-03-09
        /(\d{4})\/(\d{1,2})\/(\d{1,2})/       // 2054/03/09
      ];

      for (const pattern of patterns) {
        const match = dateText.match(pattern);
        if (match) {
          const year = match[1];
          const month = match[2].padStart(2, '0');
          const day = match[3].padStart(2, '0');
          return `${year}年${month}月${day}日`;
        }
      }

      // 如果只有年份
      const yearMatch = dateText.match(/(\d{4})年/);
      if (yearMatch) {
        return `${yearMatch[1]}年`;
      }

      return dateText;
    };

    // 解析套内面积：只提取数值
    const parseInnerArea = (innerAreaText) => {
      if (!innerAreaText) return '';

      const numMatch = innerAreaText.match(/(\d+\.?\d*)/);
      if (numMatch) {
        return parseFloat(numMatch[1]);
      }

      return '';
    };

    // ========== 构建数据行 ==========
    const rows = validData.map((data, index) => {
      // 解析用途
      const { landUse, buildingUse } = parseUsage(data.用途 || '');
      
      // 解析面积
      const { landArea, buildingArea } = parseArea(data.面积 || '');
      
      // 解析使用期限
      const deadline = parseDate(data.使用期限 || '');
      
      // 解析套内面积
      const innerArea = parseInnerArea(data.套内面积 || '');

      return [
        index + 1,            // 序号
        data.产权证号 || '',
        data.权利人 || '',
        data.坐落 || '',
        buildingUse,          // 房屋用途
        data.房屋结构 || '',
        buildingArea,         // 房屋建筑面积（数字）
        innerArea,            // 套内面积（数字）
        data.所在楼层 || '',
        landUse,              // 土地用途
        landArea,             // 共有宗地面积（数字）
        deadline              // 使用期限（只保留日期）
      ];
    });

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const worksheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // 设置列宽
    ws['!cols'] = [
      { wch: 6 },   // 序号
      { wch: 35 },  // 产权证号
      { wch: 15 },  // 权利人
      { wch: 45 },  // 坐落
      { wch: 18 },  // 房屋用途
      { wch: 15 },  // 房屋结构
      { wch: 18 },  // 房屋建筑面积(㎡)
      { wch: 15 },  // 套内面积(㎡)
      { wch: 15 },  // 所在楼层
      { wch: 18 },  // 土地用途
      { wch: 18 },  // 共有宗地面积(㎡)
      { wch: 22 },  // 使用期限
    ];

    // ========== 设置单元格类型和数据格式 ==========
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 1; // 数据行索引（跳过表头）

      // 房屋建筑面积（第7列，索引6）- 数字类型，保留2位小数
      const buildingCell = XLSX.utils.encode_cell({ r: rowIndex, c: 6 });
      if (ws[buildingCell] && rows[i][6] !== '') {
        ws[buildingCell].t = 'n';           // 数字类型
        ws[buildingCell].z = '#,##0.00';    // 格式：千分位+2位小数
      }

      // 套内面积（第8列，索引7）- 数字类型，保留2位小数
      const innerCell = XLSX.utils.encode_cell({ r: rowIndex, c: 7 });
      if (ws[innerCell] && rows[i][7] !== '') {
        ws[innerCell].t = 'n';
        ws[innerCell].z = '#,##0.00';
      }

      // 共有宗地面积（第11列，索引10）- 数字类型，保留2位小数
      const landCell = XLSX.utils.encode_cell({ r: rowIndex, c: 10 });
      if (ws[landCell] && rows[i][10] !== '') {
        ws[landCell].t = 'n';
        ws[landCell].z = '#,##0.00';
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, '不动产信息');

    // 生成文件名
    const now = new Date();
    const fileName = `不动产信息_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };
  // 复制文本
  const handleCopyText = (text) => {
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        alert('文字已复制到剪贴板');
      });
    }
  };

  // 拖拽处理
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files); };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        {/* 左侧面板 */}
        <div className={styles.leftPanel}>
          <div className={styles.panelHeader}>
            <h3>文件上传</h3>
            <div className={styles.headerActions}>
              {filePreviews.length > 0 && (
                <button onClick={handleReset} className={styles.resetBtn}>重置</button>
              )}
              {propertyData.length > 0 && (
                <button onClick={handleDownloadExcel} className={styles.downloadBtn}>📥</button>
              )}
            </div>
          </div>

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
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                onChange={(e) => handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
              />
              <div className={styles.uploadIcon}>📁</div>
              <p>点击或拖拽文件上传</p>
              <small>支持PNG、JPG、PDF格式，可多选</small>
            </div>
          )}

          {filePreviews.length > 0 && (
            <button
              onClick={handleProcessFiles}
              disabled={isLoading}
              className={styles.processBtn}
            >
              {isLoading ? `处理中 ${currentFileIndex + 1}/${filePreviews.length}...` : `开始识别 (${filePreviews.length}页)`}
            </button>
          )}

          {isLoading && (
            <div className={styles.progressSection}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${parseProgress}%` }}></div>
              </div>
              <p>正在处理第 {currentFileIndex + 1}/{filePreviews.length} 页</p>
            </div>
          )}

          {filePreviews.length > 0 && (
            <div className={styles.previewList}>
              <div className={styles.previewListHeader}>
                <span>文件预览 ({filePreviews.length}页)</span>
              </div>
              <div className={styles.previewItems}>
                {filePreviews.map((preview, index) => (
                  <div key={preview.id} className={styles.previewItem}>
                    <div className={styles.previewHeader}>
                      <span className={styles.pageBadge}>第{preview.pageNumber}页</span>
                      <span className={styles.previewName}>{preview.name}</span>
                      <button onClick={() => removeFile(index)} className={styles.removeBtn}>×</button>
                    </div>
                    <div className={styles.previewImageWrapper}>
                      <img src={preview.url} alt={preview.name} className={styles.previewImage} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右侧面板 */}
        <div className={styles.rightPanel}>
          <div className={styles.panelHeader}>
            <h3>识别结果</h3>
          </div>

          {propertyData.length > 0 && (
            <div className={styles.tabBar}>
              <button className={`${styles.tabButton} ${activeTab === 'table' ? styles.activeTab : ''}`} onClick={() => setActiveTab('table')}>📋 文档解析</button>
              <button className={`${styles.tabButton} ${activeTab === 'raw' ? styles.activeTab : ''}`} onClick={() => setActiveTab('raw')}>📄 原始文本</button>
              <button className={`${styles.tabButton} ${activeTab === 'json' ? styles.activeTab : ''}`} onClick={() => setActiveTab('json')}>📡 JSON响应</button>
            </div>
          )}

          <div className={styles.resultContent}>
            {isLoading && (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>正在识别中...</p>
              </div>
            )}

            {error && (
              <div className={styles.errorToast}>
                <span>⚠️ {error}</span>
                <button onClick={() => setError('')}>关闭</button>
              </div>
            )}

            {!isLoading && activeTab === 'table' && propertyData.length > 0 && (
              <>
                <PropertyTable data={propertyData} />
                <div className={styles.statistics}>
                  <span>共识别 {propertyData.length} 条记录</span>
                </div>
              </>
            )}

            {!isLoading && activeTab === 'raw' && (
              <div className={styles.rawTextView}>
                <div className={styles.rawTextHeader}>
                  <button onClick={() => handleCopyText(debugData.allRawText)} className={styles.copyBtn}>复制全部</button>
                </div>
                <pre className={styles.rawTextContent}>{debugData.allRawText || '暂无原始文本'}</pre>
              </div>
            )}

            {!isLoading && activeTab === 'json' && (
              <div className={styles.jsonView}>
                <div className={styles.jsonHeader}>
                  <button onClick={() => handleCopyText(JSON.stringify(debugData.allJsonResponse, null, 2))} className={styles.copyBtn}>复制全部</button>
                </div>
                <pre className={styles.jsonContent}>{JSON.stringify(debugData.allJsonResponse, null, 2)}</pre>
              </div>
            )}

            {!isLoading && propertyData.length === 0 && !error && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📄</div>
                <p>暂无识别结果</p>
                <small>请上传文件后点击"开始识别"</small>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIStudio;