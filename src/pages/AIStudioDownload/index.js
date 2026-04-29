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
  
  // PDF转换进度
  const [pdfConverting, setPdfConverting] = useState(false);
  const [pdfConvertProgress, setPdfConvertProgress] = useState(0);
  const [currentPdfName, setCurrentPdfName] = useState('');

  // 新增：文件选择相关状态
  const [selectedPreviewIds, setSelectedPreviewIds] = useState(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);

  const fileInputRef = useRef(null);

  // PDF 转图片（带进度回调）
  const pdfToImages = async (pdfFile, onProgress) => {
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
        
        if (onProgress) {
          onProgress(i, totalPages);
        }
      }
      return pages;
    } catch (error) {
      console.error('PDF 转图片失败:', error);
      throw new Error('PDF 解析失败: ' + error.message);
    }
  };

  // 处理文件选择（带进度显示）
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
            setPdfConverting(true);
            setCurrentPdfName(file.name);
            setPdfConvertProgress(0);
            
            const pages = await pdfToImages(file, (current, total) => {
              setPdfConvertProgress(Math.round((current / total) * 100));
            });
            
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
            setError(`PDF转换失败: ${err.message}`);
          } finally {
            setPdfConverting(false);
            setCurrentPdfName('');
            setPdfConvertProgress(0);
          }
        }
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setFilePreviews(prev => [...prev, ...allPreviews]);
      setError('');
      // 清空选择状态
      setSelectedPreviewIds(new Set());
      setIsSelectAll(false);
    } else {
      setError('请选择有效的图片或PDF文件');
    }
  }, []);

  // 切换单个文件选中状态
  const toggleSelectPreview = (previewId) => {
    const newSelected = new Set(selectedPreviewIds);
    if (newSelected.has(previewId)) {
      newSelected.delete(previewId);
    } else {
      newSelected.add(previewId);
    }
    setSelectedPreviewIds(newSelected);
    setIsSelectAll(newSelected.size === filePreviews.length && filePreviews.length > 0);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (isSelectAll) {
      setSelectedPreviewIds(new Set());
      setIsSelectAll(false);
    } else {
      const allIds = new Set(filePreviews.map(preview => preview.id));
      setSelectedPreviewIds(allIds);
      setIsSelectAll(true);
    }
  };

  // 反选
  const invertSelection = () => {
    const allIds = new Set(filePreviews.map(preview => preview.id));
    const newSelected = new Set();
    
    filePreviews.forEach(preview => {
      if (!selectedPreviewIds.has(preview.id)) {
        newSelected.add(preview.id);
      }
    });
    
    setSelectedPreviewIds(newSelected);
    setIsSelectAll(newSelected.size === filePreviews.length && filePreviews.length > 0);
  };

// 删除选中的文件
const deleteSelectedFiles = () => {
  if (selectedPreviewIds.size === 0) {
    setError('请先选择要删除的文件');
    return;
  }

  // 确认删除 - 使用 window.confirm
  if (!window.confirm(`确定要删除选中的 ${selectedPreviewIds.size} 个文件吗？`)) {
    return;
  }

  // 过滤掉选中的预览项
  const newPreviews = filePreviews.filter(preview => !selectedPreviewIds.has(preview.id));
  
  // 更新文件列表
  const remainingFiles = new Set(newPreviews.map(p => p.file));
  const newSelectedFiles = selectedFiles.filter(f => remainingFiles.has(f));
  
  setFilePreviews(newPreviews);
  setSelectedFiles(newSelectedFiles);
  
  // 清空选择状态
  setSelectedPreviewIds(new Set());
  setIsSelectAll(false);
  
  // 如果所有文件都被删除，清空结果数据
  if (newPreviews.length === 0) {
    setPropertyData([]);
    setDebugData({ allRawText: '', allJsonResponse: [] });
  }
  
  setError('');
};

// 删除单个文件（保留原有功能）
const removeFile = (index, previewId) => {
  // 如果已经选中了其他文件，询问是否只删除这一个
  if (selectedPreviewIds.size > 0 && !selectedPreviewIds.has(previewId)) {
    if (!window.confirm('当前有选中的文件，是否只删除当前这个文件？')) {
      return;
    }
  }
  
  const previewToRemove = filePreviews[index];
  const newPreviews = filePreviews.filter((_, i) => i !== index);
  setFilePreviews(newPreviews);

  const remainingFromSameFile = newPreviews.some(p => p.file === previewToRemove.file);
  if (!remainingFromSameFile) {
    setSelectedFiles(prev => prev.filter(f => f !== previewToRemove.file));
  }

  // 从选中的集合中移除
  const newSelected = new Set(selectedPreviewIds);
  newSelected.delete(previewId);
  setSelectedPreviewIds(newSelected);
  setIsSelectAll(newSelected.size === newPreviews.length && newPreviews.length > 0);

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
    setSelectedPreviewIds(new Set());
    setIsSelectAll(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

  // 批量处理文件（实时显示结果）
  const handleProcessFiles = async () => {
    if (filePreviews.length === 0) {
      setError('请先选择图片或PDF文件');
      return;
    }

    setIsLoading(true);
    setError('');
    setPropertyData([]);
    setDebugData({ allRawText: '', allJsonResponse: [] });

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

        const result = await callExtractAPI(imageBase64);

        clearInterval(progressInterval);
        setParseProgress(100);

        allApiResponses.push({
          index: i,
          fileName: preview.name,
          pageNumber: preview.pageNumber,
          data: result.data,
          rawText: result.rawText
        });

        if (allRawText) allRawText += '\n\n---\n\n';
        allRawText += `【${preview.name} - 第${preview.pageNumber}页】\n${result.rawText || ''}`;

        if (result.success && result.data) {
          const newData = {
            ...result.data,
            _index: i,
            _fileName: preview.name,
            _pageNumber: preview.pageNumber,
            _id: Date.now() + Math.random()
          };
          allPropertyData.push(newData);
          
          setPropertyData([...allPropertyData]);
          setDebugData({
            allRawText: allRawText,
            allJsonResponse: [...allApiResponses]
          });
        }
      }

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

  // 下载Excel（保持不变）
  const handleDownloadExcel = () => {
    if (propertyData.length === 0) {
      setError('没有可导出的数据');
      return;
    }

    const validData = propertyData.filter(data => {
      const isEmpty = (val) => !val || val.trim() === '' || val.trim() === '未提及';
      const locationEmpty = isEmpty(data.坐落);
      return !(locationEmpty);
    });

    if (validData.length === 0) {
      setError('没有符合导出条件的数据（产权证号、权利人、坐落至少需要一个有有效数据）');
      return;
    }

    const headers = [
      '序号', '产权证号', '权利人', '坐落', 
      '房屋用途', '房屋结构', '房屋建筑面积(㎡)', '套内面积(㎡)', '所在楼层',
      '土地用途', '共有宗地面积(㎡)', '使用期限'
    ];

    const parseUsage = (usageText) => {
      if (!usageText) return { landUse: '', buildingUse: '' };
      const cleaned = usageText.replace(/[（(][^）)]*[）)]/g, '').trim();
      if (cleaned.includes('/')) {
        const parts = cleaned.split('/');
        return { landUse: parts[0]?.trim() || '', buildingUse: parts[1]?.trim() || '' };
      }
      return { landUse: cleaned, buildingUse: '' };
    };

    const parseArea = (areaText) => {
      if (!areaText) return { landArea: '', buildingArea: '' };
      let cleaned = areaText
        .replace(/\$\s*/g, '').replace(/\\,/g, '').replace(/\\;/g, '')
        .replace(/m\s*\^\s*\{2\}\s*/g, '㎡').replace(/m\s*\^\s*2\b/g, '㎡')
        .replace(/\^\s*\{2\}\s*/g, '²').replace(/\\mathrm\{([^}]+)\}/g, '$1')
        .replace(/\\text\{([^}]+)\}/g, '$1').replace(/\\+/g, '').replace(/\s+/g, ' ').trim();

      let landArea = '', buildingArea = '';
      const landMatch = cleaned.match(/共有宗地面积\s*(\d+\.?\d*)/);
      if (landMatch) landArea = parseFloat(landMatch[1]);
      const buildingMatch = cleaned.match(/房屋建筑面积\s*(\d+\.?\d*)/);
      if (buildingMatch) buildingArea = parseFloat(buildingMatch[1]);
      return { landArea, buildingArea };
    };

    const parseDate = (dateText) => {
      if (!dateText) return '';
      const patterns = [/(\d{4})年(\d{1,2})月(\d{1,2})日/, /(\d{4})-(\d{1,2})-(\d{1,2})/, /(\d{4})\/(\d{1,2})\/(\d{1,2})/];
      for (const pattern of patterns) {
        const match = dateText.match(pattern);
        if (match) return `${match[1]}年${match[2].padStart(2, '0')}月${match[3].padStart(2, '0')}日`;
      }
      const yearMatch = dateText.match(/(\d{4})年/);
      return yearMatch ? `${yearMatch[1]}年` : dateText;
    };

    const parseInnerArea = (innerAreaText) => {
      if (!innerAreaText) return '';
      const numMatch = innerAreaText.match(/(\d+\.?\d*)/);
      return numMatch ? parseFloat(numMatch[1]) : '';
    };

    const rows = validData.map((data, index) => {
      const { landUse, buildingUse } = parseUsage(data.用途 || '');
      const { landArea, buildingArea } = parseArea(data.面积 || '');
      const deadline = parseDate(data.使用期限 || '');
      const innerArea = parseInnerArea(data.套内面积 || '');
      return [
        index + 1, data.产权证号 || '', data.权利人 || '', data.坐落 || '',
        buildingUse, data.房屋结构 || '', buildingArea, innerArea, data.所在楼层 || '',
        landUse, landArea, deadline
      ];
    });

    const wb = XLSX.utils.book_new();
    const worksheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    ws['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 15 }, { wch: 45 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 22 }];

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 1;
      const buildingCell = XLSX.utils.encode_cell({ r: rowIndex, c: 6 });
      if (ws[buildingCell] && rows[i][6] !== '') { ws[buildingCell].t = 'n'; ws[buildingCell].z = '#,##0.00'; }
      const innerCell = XLSX.utils.encode_cell({ r: rowIndex, c: 7 });
      if (ws[innerCell] && rows[i][7] !== '') { ws[innerCell].t = 'n'; ws[innerCell].z = '#,##0.00'; }
      const landCell = XLSX.utils.encode_cell({ r: rowIndex, c: 10 });
      if (ws[landCell] && rows[i][10] !== '') { ws[landCell].t = 'n'; ws[landCell].z = '#,##0.00'; }
    }

    XLSX.utils.book_append_sheet(wb, ws, '不动产信息');
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

          {/* PDF转换进度显示 */}
          {pdfConverting && (
            <div className={styles.pdfConvertProgress}>
              <div className={styles.progressSection}>
                <div className={styles.progressLabel}>
                  正在转换PDF: {currentPdfName}
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${pdfConvertProgress}%` }}></div>
                </div>
                <div className={styles.progressPercent}>{pdfConvertProgress}%</div>
              </div>
            </div>
          )}

          {filePreviews.length > 0 && (
            <>
              {/* 批量操作工具栏 */}
              <div className={styles.batchToolbar}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isSelectAll}
                    onChange={toggleSelectAll}
                    className={styles.checkbox}
                  />
                  全选
                </label>
                <button onClick={invertSelection} className={styles.toolbarBtn}>
                  反选
                </button>
                {selectedPreviewIds.size > 0 && (
                  <button 
                    onClick={deleteSelectedFiles} 
                    className={`${styles.toolbarBtn} ${styles.deleteBtn}`}
                  >
                    删除({selectedPreviewIds.size})
                  </button>
                )}
                <span className={styles.selectedCount}>
                  已选 {selectedPreviewIds.size}/{filePreviews.length}
                </span>
              </div>

              <button
                onClick={handleProcessFiles}
                disabled={isLoading || pdfConverting}
                className={styles.processBtn}
              >
                {isLoading ? `识别中 ${currentFileIndex + 1}/${filePreviews.length}...` : `开始识别 (${filePreviews.length}页)`}
              </button>
            </>
          )}

          {isLoading && (
            <div className={styles.progressSection}>
              <div className={styles.progressLabel}>
                正在识别第 {currentFileIndex + 1}/{filePreviews.length} 页
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${parseProgress}%` }}></div>
              </div>
              <div className={styles.progressPercent}>{parseProgress}%</div>
            </div>
          )}

          {filePreviews.length > 0 && (
            <div className={styles.previewList}>
              <div className={styles.previewListHeader}>
                <span>文件预览 ({filePreviews.length}页)</span>
              </div>
              <div className={styles.previewItems}>
                {filePreviews.map((preview, index) => (
                  <div 
                    key={preview.id} 
                    className={`${styles.previewItem} ${selectedPreviewIds.has(preview.id) ? styles.selected : ''}`}
                  >
                    <div className={styles.previewHeader}>
                      <label className={styles.itemCheckbox}>
                        <input
                          type="checkbox"
                          checked={selectedPreviewIds.has(preview.id)}
                          onChange={() => toggleSelectPreview(preview.id)}
                          onClick={(e) => e.stopPropagation()}
                          className={styles.checkbox}
                        />
                      </label>
                      <span className={styles.pageBadge}>第{preview.pageNumber}页</span>
                      <span className={styles.previewName}>{preview.name}</span>
                      <button 
                        onClick={() => removeFile(index, preview.id)} 
                        className={styles.removeBtn}
                        title="删除"
                      >
                        ×
                      </button>
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
            {isLoading && propertyData.length > 0 && (
              <span className={styles.realtimeBadge}>⏳ 实时更新中... 已识别 {propertyData.length} 条</span>
            )}
          </div>

          {propertyData.length > 0 && (
            <div className={styles.tabBar}>
              <button className={`${styles.tabButton} ${activeTab === 'table' ? styles.activeTab : ''}`} onClick={() => setActiveTab('table')}>📋 文档解析</button>
              <button className={`${styles.tabButton} ${activeTab === 'raw' ? styles.activeTab : ''}`} onClick={() => setActiveTab('raw')}>📄 原始文本</button>
              <button className={`${styles.tabButton} ${activeTab === 'json' ? styles.activeTab : ''}`} onClick={() => setActiveTab('json')}>📡 JSON响应</button>
            </div>
          )}

          <div className={styles.resultContent}>
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

            {error && (
              <div className={styles.errorToast}>
                <span>⚠️ {error}</span>
                <button onClick={() => setError('')}>关闭</button>
              </div>
            )}

            {isLoading && propertyData.length === 0 && (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>正在识别中...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIStudio;