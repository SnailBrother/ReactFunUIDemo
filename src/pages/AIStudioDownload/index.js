import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import styles from './index.module.css';
import PropertyTable from './PropertyTable';
import { parsePropertyInfo } from './propertyParser';
import { Tesseract } from './Tesseract';//这个主要是用来初步筛选哪些页面需要识别，不然全部识别会浪费时间、金钱及api得额度

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
  const [activeTab, setActiveTab] = useState('table'); // table | raw | json

  // 调试相关状态
  const [debugData, setDebugData] = useState({
    allRawText: '',
    allJsonResponse: []
  });

  const fileInputRef = useRef(null);

  const API_CONFIG = {
    proxyUrl: 'http://localhost:3001/api/ocr'
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
                file: file,
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
                file: file,
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
  const extractTextFromOCRResult = (result) => {
    let fullText = '';

    try {
      if (result && typeof result === 'object') {
        let dataSource = result.result || result.data || result;

        if (typeof dataSource === 'string') {
          try {
            dataSource = JSON.parse(dataSource);
          } catch (e) {
            fullText = dataSource;
          }
        }

        if (dataSource.layoutParsingResults) {
          for (const layoutResult of dataSource.layoutParsingResults) {
            if (layoutResult.markdown?.text) {
              fullText += layoutResult.markdown.text + '\n';
            }
            if (layoutResult.tableResult?.html) {
              fullText += layoutResult.tableResult.html + '\n';
            }
          }
        }

        if (dataSource.ocrResults) {
          for (const pageResult of dataSource.ocrResults) {
            if (pageResult.prunedResult) {
              for (const item of pageResult.prunedResult) {
                if (item.length >= 2) {
                  if (typeof item[1] === 'string') {
                    if (item[1].includes('<table') || item[1].includes('<td')) {
                      fullText += item[1] + '\n';
                    } else {
                      fullText += item[1] + '\n';
                    }
                  } else if (typeof item[1] === 'object' && item[1].html) {
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

    fullText = fullText
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");

    return fullText;
  };

  // 批量处理文件
// 批量处理文件 - 修复顺序问题
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

    // 【重要】按照 filePreviews 的原始顺序处理
    // 为每个预览项添加原始索引，确保顺序正确
    const orderedPreviews = filePreviews.map((preview, idx) => ({
      ...preview,
      originalIndex: idx
    }));

    for (let i = 0; i < orderedPreviews.length; i++) {
      const preview = orderedPreviews[i];
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

      const result = await callOCRAPI(imageBase64);
      
      // 保存响应时也记录原始顺序
      allApiResponses.push({
        originalIndex: preview.originalIndex,
        fileName: preview.name,
        pageNumber: preview.pageNumber,
        response: result
      });

      clearInterval(progressInterval);
      setParseProgress(100);

      let fullText = extractTextFromOCRResult(result);

      if (allRawText) allRawText += '\n\n';
      allRawText += `【${preview.name} - 第${preview.pageNumber}页】\n${fullText}`;

      const propertyInfo = parsePropertyInfo(fullText, preview.name);

      if (propertyInfo) {
        // 保存时也记录原始顺序
        allPropertyData.push({
          ...propertyInfo,
          _originalIndex: preview.originalIndex,
          _pageNumber: preview.pageNumber,
          _fileName: preview.name
        });
      }
    }

    // 【重要】按照原始索引排序，确保显示顺序与上传顺序一致
    const sortedPropertyData = allPropertyData.sort((a, b) => 
      a._originalIndex - b._originalIndex
    );
    
    // 移除临时字段，但保留文件名和页码信息用于调试
    const finalPropertyData = sortedPropertyData.map(item => {
      const { _originalIndex, _pageNumber, _fileName, ...rest } = item;
      return {
        ...rest,
        _fileName,    // 保留文件名用于调试
        _pageNumber   // 保留页码用于调试
      };
    });

    // 同样对响应数据排序
    const sortedApiResponses = allApiResponses.sort((a, b) => 
      a.originalIndex - b.originalIndex
    );

    setPropertyData(finalPropertyData);
    setDebugData({
      allRawText: allRawText,
      allJsonResponse: sortedApiResponses
    });
    setActiveTab('table');

    if (finalPropertyData.length === 0) {
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
      const newFiles = selectedFiles.filter(f => f !== previewToRemove.file);
      setSelectedFiles(newFiles);
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

    // 过滤：产权证号、坐落、权利人、面积 至少有两个有数据
    const validData = propertyData.filter(data => {
      const hasFields = [
        data.产权证号 && data.产权证号.trim() !== '' && data.产权证号 !== '未识别',
        data.坐落 && data.坐落.trim() !== '' && data.坐落 !== '未识别',
        data.权利人 && data.权利人.trim() !== '' && data.权利人 !== '未识别',
        data.面积 && data.面积.trim() !== '' && data.面积 !== '未识别'
      ].filter(Boolean).length;
      return hasFields >= 2;
    });

    if (validData.length === 0) {
      setError('没有符合导出条件的数据（产权证号、坐落、权利人、面积至少需要两个有数据）');
      return;
    }

    // 定义表头（用途拆分为土地用途和房屋用途）
    const headers = [
      '产权证号', '权利人', '共有情况', '坐落', '不动产单元号',
      '权利性质', '土地用途', '房屋用途',
      '共有宗地面积(㎡)', '房屋建筑面积(㎡)',
      '使用期限', '房屋结构', '套内面积(㎡)', '所在楼层'
    ];

    // 构建数据行
    const rows = validData.map(data => {
      // 解析面积
      const { landArea, buildingArea } = parseArea(data.面积 || '');

      // 解析用途
      const { landUse, buildingUse } = parseUsage(data.用途 || '');

      // 解析使用期限（只提取日期）
      const deadline = parseDate(data.使用期限 || '');

      // 解析套内面积（只提取数字）
      const innerArea = parseInnerArea(data.套内面积 || '');

      return [
        data.产权证号 || '',
        data.权利人 || '',
        data.共有情况 || '',
        data.坐落 || '',
        data.不动产单元号 || '',
        data.权利性质 || '',
        landUse,         // 土地用途
        buildingUse,     // 房屋用途
        landArea,        // 数字类型
        buildingArea,    // 数字类型
        deadline,        // 日期类型
        data.房屋结构 || '',
        innerArea,       // 数字类型
        data.所在楼层 || ''
      ];
    });

    // 创建工作簿
    const wb = XLSX.utils.book_new();

    // 将数据转为 worksheet
    const worksheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // 设置列宽
    ws['!cols'] = [
      { wch: 35 },  // 产权证号
      { wch: 20 },  // 权利人
      { wch: 15 },  // 共有情况
      { wch: 40 },  // 坐落
      { wch: 30 },  // 不动产单元号
      { wch: 10 },  // 权利性质
      { wch: 18 },  // 土地用途
      { wch: 18 },  // 房屋用途
      { wch: 16 },  // 共有宗地面积(㎡)
      { wch: 16 },  // 房屋建筑面积(㎡)
      { wch: 20 },  // 使用期限
      { wch: 15 },  // 房屋结构
      { wch: 14 },  // 套内面积(㎡)
      { wch: 15 },  // 所在楼层
    ];

    // 设置单元格类型和数据格式
    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 1; // 数据行索引（跳过表头）

      // 共有宗地面积（第 9 列，索引 8）- 数字类型
      const landCell = XLSX.utils.encode_cell({ r: rowIndex, c: 8 });
      if (ws[landCell] && rows[i][8] !== '') {
        ws[landCell].t = 'n';
        ws[landCell].z = '#,##0.00';
      }

      // 房屋建筑面积（第 10 列，索引 9）- 数字类型
      const buildingCell = XLSX.utils.encode_cell({ r: rowIndex, c: 9 });
      if (ws[buildingCell] && rows[i][9] !== '') {
        ws[buildingCell].t = 'n';
        ws[buildingCell].z = '#,##0.00';
      }

      // 使用期限（第 11 列，索引 10）- 日期类型
      const dateCell = XLSX.utils.encode_cell({ r: rowIndex, c: 10 });
      if (ws[dateCell] && rows[i][10] !== '') {
        ws[dateCell].t = 'd';
        ws[dateCell].z = 'yyyy-mm-dd';
      }

      // 套内面积（第 13 列，索引 12）- 数字类型
      const innerCell = XLSX.utils.encode_cell({ r: rowIndex, c: 12 });
      if (ws[innerCell] && rows[i][12] !== '') {
        ws[innerCell].t = 'n';
        ws[innerCell].z = '#,##0.00';
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, '不动产信息');

    // 生成文件名
    const now = new Date();
    const fileName = `不动产信息_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  // 解析用途：拆分为土地用途和房屋用途
  function parseUsage(usageText) {
    let landUse = '';
    let buildingUse = '';

    if (!usageText) return { landUse: '', buildingUse: '' };

    // 用 / 分割
    if (usageText.includes('/')) {
      const parts = usageText.split('/');
      landUse = parts[0]?.trim() || '';
      buildingUse = parts[1]?.trim() || '';
    } else {
      // 如果没有 /，整个作为土地用途
      landUse = usageText.trim();
    }

    return { landUse, buildingUse };
  }

  // 解析面积：拆分为共有宗地面积和房屋建筑面积（只保留数值）
  function parseArea(areaText) {
    let landArea = '';
    let buildingArea = '';

    if (!areaText) return { landArea: '', buildingArea: '' };

    // 提取共有宗地面积数值
    const landMatch = areaText.match(/共有宗地面积\s*(\d+\.?\d*)/);
    if (landMatch) {
      landArea = parseFloat(landMatch[1]);
    }

    // 提取房屋建筑面积数值
    const buildingMatch = areaText.match(/房屋建筑面积\s*(\d+\.?\d*)/);
    if (buildingMatch) {
      buildingArea = parseFloat(buildingMatch[1]);
    }

    return { landArea, buildingArea };
  }

  // 解析使用期限：只提取日期部分
  function parseDate(dateText) {
    if (!dateText) return '';

    // 匹配日期格式：2052年05月14日 或 2052-05-14 等
    const dateMatch = dateText.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2].padStart(2, '0');
      const day = dateMatch[3].padStart(2, '0');
      // 返回 Date 对象，这样 Excel 才能识别为日期类型
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // 如果只有年份，如 "2052年"
    const yearMatch = dateText.match(/(\d{4})年/);
    if (yearMatch) {
      return `${yearMatch[1]}-01-01`;
    }

    return dateText;
  }

  // 解析套内面积：只提取数值
  function parseInnerArea(innerAreaText) {
    if (!innerAreaText) return '';

    // 提取数字部分
    const numMatch = innerAreaText.match(/(\d+\.?\d*)/);
    if (numMatch) {
      return parseFloat(numMatch[1]);
    }

    return innerAreaText;
  }


  // 复制文本
  const handleCopyText = (text) => {
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        alert('文字已复制到剪贴板');
      });
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
        {/* 左侧面板 - 文件上传 */}
        <div className={styles.leftPanel}>
          <div className={styles.panelHeader}>
            <h3>文件上传</h3>
            <div className={styles.headerActions}>
              {filePreviews.length > 0 && (
                <button onClick={handleReset} className={styles.resetBtn}>
                  重置
                </button>
              )}
              {propertyData.length > 0 && (
                <button onClick={handleDownloadExcel} className={styles.downloadBtn}>
                  📥
                  {/* 下载表格 */}
                </button>
              )}
            </div>
          </div>

          {/* 上传区域 - 没有文件时显示 */}
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

          {/* 处理按钮 */}
          {filePreviews.length > 0 && (
            <button
              onClick={handleProcessFiles}
              disabled={isLoading}
              className={styles.processBtn}
            >
              {isLoading ? `处理中 ${currentFileIndex + 1}/${filePreviews.length}...` : `开始识别 (${filePreviews.length}页)`}
            </button>
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
              <p>正在处理第 {currentFileIndex + 1}/{filePreviews.length} 页</p>
            </div>
          )}

          {/* 文件预览列表 */}
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
                      <button
                        onClick={() => removeFile(index)}
                        className={styles.removeBtn}
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
              <p>总大小：{(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB</p>
            </div>
          )}
        </div>

        {/* 右侧面板 - 识别结果 */}
        <div className={styles.rightPanel}>
          <div className={styles.panelHeader}>
            <h3>识别结果</h3>
          </div>

          {/* Tab 切换栏 */}
          {propertyData.length > 0 && (
            <div className={styles.tabBar}>
              <button
                className={`${styles.tabButton} ${activeTab === 'table' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('table')}
              >
                📋 文档解析
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === 'raw' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('raw')}
              >
                📄 原始文本
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === 'json' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('json')}
              >
                📡 JSON响应
              </button>
            </div>
          )}

          <div className={styles.resultContent}>
            {/* 加载状态 */}
            {isLoading && (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>正在识别中...</p>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className={styles.errorToast}>
                <span>⚠️ {error}</span>
                <button onClick={() => setError('')}>关闭</button>
              </div>
            )}

            {/* 文档解析 - 表格视图 */}
            {!isLoading && activeTab === 'table' && propertyData.length > 0 && (
              <>
                <PropertyTable data={propertyData} />
                <div className={styles.statistics}>
                  <span>共识别 {propertyData.length} 条记录</span>
                  <span>识别时间: {new Date().toLocaleString()}</span>
                </div>
              </>
            )}

            {/* 原始文本 */}
            {!isLoading && activeTab === 'raw' && (
              <div className={styles.rawTextView}>
                <div className={styles.rawTextHeader}>
                  <button
                    onClick={() => handleCopyText(debugData.allRawText)}
                    className={styles.copyBtn}
                  >
                    复制全部
                  </button>
                </div>
                <pre className={styles.rawTextContent}>
                  {debugData.allRawText || '暂无原始文本'}
                </pre>
              </div>
            )}

            {/* JSON响应 */}
            {!isLoading && activeTab === 'json' && (
              <div className={styles.jsonView}>
                <div className={styles.jsonHeader}>
                  <button
                    onClick={() => handleCopyText(JSON.stringify(debugData.allJsonResponse, null, 2))}
                    className={styles.copyBtn}
                  >
                    复制全部
                  </button>
                </div>
                <pre className={styles.jsonContent}>
                  {JSON.stringify(debugData.allJsonResponse, null, 2)}
                </pre>
              </div>
            )}

            {/* 空状态 */}
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