import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import styles from './index.module.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const OcrTextExtraction = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [extractedText, setExtractedText] = useState('');
  const [rawText, setRawText] = useState('');
  const [structuredText, setStructuredText] = useState('');
  const [activeTab, setActiveTab] = useState('structured');
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [ocrInstance, setOcrInstance] = useState(null);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [pageResults, setPageResults] = useState([]);
  const [highlightedPage, setHighlightedPage] = useState(null);
  const [modalImage, setModalImage] = useState(null); // 弹窗图片
  const fileInputRef = useRef(null);
  const leftPanelRef = useRef(null);
  const rightPanelRef = useRef(null);
  const previewRefs = useRef({});

  // 初始化 PaddleOCR
  useEffect(() => {
    const initPaddleOCR = async () => {
      try {
        setIsModelLoading(true);
        setModelLoadProgress(0);

        const { PaddleOCR } = await import('@paddleocr/paddleocr-js');

        const instance = await PaddleOCR.create({
          lang: 'ch',
          ocrVersion: 'PP-OCRv5',
          worker: true,
          ortOptions: {
            backend: 'auto',
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

  // PDF 转图片（返回每页的图片 blob 和页面号）
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
          type: 'pdf-page'
        });
      }

      return pages;
    } catch (error) {
      console.error('PDF 转图片失败:', error);
      throw new Error('PDF 解析失败: ' + error.message);
    }
  };

  // 处理文件选择
  const handleFileSelect = async (files) => {
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
                type: 'image',
                url: reader.result,
                name: file.name,
                pageNumber: 1,
                file: file,
                originalFile: file
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
                type: 'pdf-page',
                url: page.url,
                name: file.name,
                pageNumber: page.pageNumber,
                file: file,
                blob: page.blob,
                originalFile: file
              });
            });
          } catch (err) {
            console.error('PDF预览生成失败:', err);
            allPreviews.push({
              type: 'pdf',
              url: null,
              name: file.name,
              pageNumber: 1,
              file: file,
              originalFile: file
            });
          }
        }
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setFilePreviews(allPreviews);
      setError('');
      setExtractedText('');
      setRawText('');
      setStructuredText('');
      setPageResults([]);
    } else {
      setError('请选择有效的图片或PDF文件');
    }
  };

  const handleImageSelect = (e) => {
    const files = e.target.files;
    handleFileSelect(files);
  };

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

  // 图片识别
  const extractTextFromImage = async (imageFile) => {
    const results = await ocrInstance.predict(imageFile);

    let fullText = '';
    results.forEach(box => {
      if (box.items) {
        box.items.forEach(item => {
          fullText += (item.text || '') + '\n';
        });
      }
    });

    return fullText.trim();
  };

  // 批量处理所有文件
  const handleExtractText = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('请先选择图片或PDF文件');
      return;
    }
    if (!ocrInstance) {
      setError('OCR 引擎未就绪，请稍后重试');
      return;
    }

    setIsLoading(true);
    setError('');
    setRawText('');
    setStructuredText('');
    setPdfProgress(0);
    setPageResults([]);

    try {
      const results = [];
      let globalPageIndex = 0;

      for (const file of selectedFiles) {
        setCurrentFileIndex(globalPageIndex + 1);
        const isImage = file.type.startsWith('image/');

        if (isImage) {
          const text = await extractTextFromImage(file);
          const structuredText = formatSingleFileStructured(text);

          results.push({
            id: globalPageIndex,
            fileName: file.name,
            pageNumber: 1,
            rawText: text,
            structuredText: structuredText,
            previewIndex: globalPageIndex
          });
          globalPageIndex++;
        } else {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const totalPages = pdf.numPages;

          for (let i = 1; i <= totalPages; i++) {
            setPdfProgress(Math.floor((i / totalPages) * 100));

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
            const imageFile = new File([blob], `page_${i}.jpg`, { type: 'image/jpeg' });

            const text = await extractTextFromImage(imageFile);
            const structuredText = formatSingleFileStructured(text);

            results.push({
              id: globalPageIndex,
              fileName: file.name,
              pageNumber: i,
              rawText: text,
              structuredText: structuredText,
              previewIndex: globalPageIndex
            });
            globalPageIndex++;
          }
        }
      }

      setPageResults(results);

      const allRawText = results.map(r =>
        `【${r.fileName} - 第${r.pageNumber}页】\n${r.rawText}`
      ).join('\n\n');

      const allStructuredText = results.map(r =>
        `━━━ ${r.fileName} - 第${r.pageNumber}页 ━━━\n${r.structuredText}`
      ).join('\n\n');

      setRawText(allRawText);
      setStructuredText(allStructuredText);
      setExtractedText(allStructuredText);

    } catch (err) {
      console.error('识别失败', err);
      setError('识别失败: ' + err.message);
    } finally {
      setIsLoading(false);
      setPdfProgress(0);
      setCurrentFileIndex(0);
    }
  };

  // 移除预览项
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
      setExtractedText('');
      setRawText('');
      setStructuredText('');
      setPageResults([]);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setExtractedText('');
    setRawText('');
    setStructuredText('');
    setPageResults([]);
    setError('');
    setPdfProgress(0);
    setCurrentFileIndex(0);
    setModalImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyText = (text) => {
    if (text) {
      navigator.clipboard.writeText(text);
      alert('文字已复制到剪贴板');
    }
  };

 

// 添加下载Excel函数
const handleDownloadExcel = () => {
  if (!structuredText && !pageResults.length) {
    alert('没有可导出的数据');
    return;
  }

  // 解析结构化文本，提取数据
  const parseStructuredData = (text) => {
    const data = {};
    
    // 产权证号
    const certMatch = text.match(/产权证号[：:]\s*([^\n]+)/);
    data.产权证号 = certMatch ? certMatch[1].trim() : '';
    
    // 权利人
    const ownerMatch = text.match(/权利人[：:]\s*([^\n]+)/);
    data.权利人 = ownerMatch ? ownerMatch[1].trim() : '';
    
    // 坐落
    const locationMatch = text.match(/坐落[：:]\s*([^\n]+)/);
    data.坐落 = locationMatch ? locationMatch[1].trim() : '';
    
    // 用途
    let useMatch = text.match(/用途[：:]\s*([^\n]+)/);
    let useText = useMatch ? useMatch[1].trim() : '';
    useText = useText.replace(/地使用权/, '').replace(/房屋/, '');
    data.用途 = useText;
    
    // 房屋结构
    const structureMatch = text.match(/房屋结构[：:]\s*([^\n]+)/);
    data.房屋结构 = structureMatch ? structureMatch[1].trim().replace(/[；;]$/, '') : '';
    
    // 所在楼层
    let floorMatch = text.match(/所在楼层[：:]\s*([^\n]+)/);
    data.所在楼层 = floorMatch ? floorMatch[1].trim().replace(/[；;]$/, '') : '';
    
    // 建筑面积 - 作为数字提取
    let buildingArea = null;
    const areaLine = text.match(/面积[：:]\s*([^\n]+)/);
    if (areaLine) {
      const areaText = areaLine[1];
      const buildingMatch = areaText.match(/房屋建筑面积\s*(\d+\.?\d*)/);
      if (buildingMatch) {
        buildingArea = parseFloat(buildingMatch[1]);
      }
    }
    data.建筑面积 = buildingArea;
    
    // 套内面积 - 作为数字提取
    let innerArea = null;
    const innerMatch = text.match(/套内面积[：:]\s*([^\n]+)/);
    if (innerMatch) {
      const innerText = innerMatch[1];
      const numMatch = innerText.match(/(\d+\.?\d*)/);
      if (numMatch) {
        innerArea = parseFloat(numMatch[1]);
      }
    }
    data.套内面积 = innerArea;
    
    return data;
  };

  // 收集所有数据
  let allData = [];
  
  if (pageResults.length > 0) {
    for (const result of pageResults) {
      const data = parseStructuredData(result.structuredText);
      // ✅ 只保留产权证号和坐落都有有效数据的记录
      if (data.产权证号 && data.产权证号 !== '未识别' && data.产权证号 !== '' && 
          data.坐落 && data.坐落 !== '未识别' && data.坐落 !== '') {
        allData.push(data);
      }
    }
  } else if (structuredText) {
    const entries = structuredText.split(/(?=产权证号：)/);
    for (const entry of entries) {
      if (entry.trim() && entry.includes('产权证号：')) {
        const data = parseStructuredData(entry);
        // ✅ 只保留产权证号和坐落都有有效数据的记录
        if (data.产权证号 && data.产权证号 !== '未识别' && data.产权证号 !== '' && 
            data.坐落 && data.坐落 !== '未识别' && data.坐落 !== '') {
          allData.push(data);
        }
      }
    }
  }

  if (allData.length === 0) {
    alert('没有提取到有效数据');
    return;
  }

  // 定义表格列
  const worksheetData = [
    ['产权证号', '权利人', '坐落', '用途', '房屋结构', '所在楼层', '建筑面积(㎡)', '套内面积(㎡)']
  ];

  // 添加数据行
  for (const data of allData) {
    worksheetData.push([
      data.产权证号 || '',
      data.权利人 || '',
      data.坐落 || '',
      data.用途 || '',
      data.房屋结构 || '',
      data.所在楼层 || '',
      data.建筑面积 !== null && data.建筑面积 !== undefined ? data.建筑面积 : '',
      data.套内面积 !== null && data.套内面积 !== undefined ? data.套内面积 : ''
    ]);
  }

  // 创建工作簿和工作表
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // 设置列宽和数字格式
  ws['!cols'] = [
    { wch: 38 },
    { wch: 22 },
    { wch: 45 },
    { wch: 28 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18, numFmt: '0.00' },
    { wch: 18, numFmt: '0.00' }
  ];

  XLSX.utils.book_append_sheet(wb, ws, '不动产信息');

  const now = new Date();
  const fileName = `不动产信息_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'raw') {
      setExtractedText(rawText);
    } else {
      setExtractedText(structuredText);
    }
  };

  const handleClearError = () => {
    setError('');
  };

  const handlePageHover = (index) => {
    setHighlightedPage(index);
    // 滚动到对应的预览项
    if (previewRefs.current[index]) {
      previewRefs.current[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handlePageLeave = () => {
    setHighlightedPage(null);
  };

  // 点击预览图片放大
  const handleImageClick = (preview) => {
    if (preview.url) {
      setModalImage(preview.url);
    }
  };

  // 关闭弹窗
  const closeModal = () => {
    setModalImage(null);
  };

  const formatSingleFileStructured = (fullText) => {
    if (!fullText || !fullText.trim()) {
      return '未识别到文字';
    }

    const originalText = fullText;
    let cleanedText = fullText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const result = {};

    let codeMatch = null;
    codeMatch = cleanedText.match(/渝[（\(]?\s*(\d+)\s*[）\)]?\s*([\u4e00-\u9fa5]+区?)\s*不动产权第\s*(\d+)\s*号/);

    if (!codeMatch) {
      const yearMatch = originalText.match(/渝[（\(]?\s*(\d+)/);
      const areaMatch = originalText.match(/[）\)]?\s*([\u4e00-\u9fa5]+区?)\s*不动产权第/);
      const numberMatch = originalText.match(/不动产权第\s*(\d+)\s*号/);

      if (yearMatch && areaMatch && numberMatch) {
        result.产权证号 = `渝（${yearMatch[1]}）${areaMatch[1]}不动产权第${numberMatch[1]}号`;
      } else {
        const year = originalText.match(/\b(20\d{2})\b/);
        const area = originalText.match(/([\u4e00-\u9fa5]{2,3}区)/);
        const num = originalText.match(/不动产权第\s*(\d+)/);
        if (year && area && num) {
          result.产权证号 = `渝（${year[1]}）${area[1]}不动产权第${num[1]}号`;
        } else {
          result.产权证号 = '未识别';
        }
      }
    } else {
      result.产权证号 = `渝（${codeMatch[1]}）${codeMatch[2]}不动产权第${codeMatch[3]}号`;
    }

    const qlrMatch = cleanedText.match(/权利人\s*[:：]?\s*([^\s]+)/);
    result.权利人 = qlrMatch ? qlrMatch[1].trim() : '';

    const gyqkMatch = cleanedText.match(/共有情况\s*[:：]?\s*([^\s]+)/);
    result.共有情况 = gyqkMatch ? gyqkMatch[1].trim() : '';

    const addrPattern = /坐落\s*[:：]?\s*([^\n\r]+?)(?=\s*不动产单元号|不动产单元号\s|权利类型|权利性质|$)/;
    const addrMatch = cleanedText.match(addrPattern);
    if (addrMatch) {
      result.坐落 = addrMatch[1].trim();
    } else {
      const fallbackAddrMatch = cleanedText.match(/单独所有\s*([^\n\r]+?)\s*不动产单元号/);
      result.坐落 = fallbackAddrMatch ? fallbackAddrMatch[1].trim() : '';
    }

    const unitPattern = /不动产单元号\s*[:：]?\s*([A-Z0-9\s\-\/]+)/;
    const unitMatch = cleanedText.match(unitPattern);
    result.不动产单元号 = unitMatch ? unitMatch[1].replace(/\s+/g, '').trim() : '';

    const typePattern = /权利类型\s*[:：]?\s*([^\n\r]+?)(?=\s*权利性质|用途|面积|$)/;
    const typeMatch = cleanedText.match(typePattern);
    result.权利类型 = typeMatch ? typeMatch[1].trim() : '';

    let natureText = '';
    const naturePattern = /权利性质\s*[:：]?\s*([^\n\r]+?)(?=\s*用途|\s*面积|\s*使用期限|\s*$)/;
    const natureMatch = cleanedText.match(naturePattern);
    if (natureMatch) {
      natureText = natureMatch[1].trim();
      if (natureText.includes('出让')) {
        result.权利性质 = '出让';
      } else if (natureText.includes('划拨')) {
        result.权利性质 = '划拨';
      } else {
        result.权利性质 = natureText;
      }
    } else {
      const chengRangMatch = cleanedText.match(/出让/);
      const huaBoMatch = cleanedText.match(/划拨/);
      if (chengRangMatch) {
        result.权利性质 = '出让';
      } else if (huaBoMatch) {
        result.权利性质 = '划拨';
      } else {
        result.权利性质 = '';
      }
    }

    let useText = '';
    let useMatch = cleanedText.match(/用途\s*[:：]?\s*([^面积面\n\r]+?)(?=\s*面积|\s*面|\s*使用期限|\s*$)/);
    if (useMatch) {
      useText = useMatch[1].trim();
    } else {
      const yongMatch = originalText.match(/用[\s\n]*([\u4e00-\u9fa5\/]+)/);
      const tuMatch = originalText.match(/途[\s\n]*([\u4e00-\u9fa5\/]+)/);
      if (yongMatch && yongMatch[1]) {
        useText = yongMatch[1].trim();
      } else if (tuMatch && tuMatch[1]) {
        useText = tuMatch[1].trim();
      }
    }

    if (useText) {
      let cleanedUse = useText.replace(/^[\d、．.]+\s*/, '');
      const slashMatch = cleanedUse.match(/([\u4e00-\u9fa5]+\/[\u4e00-\u9fa5]+)/);
      if (slashMatch) {
        result.用途 = slashMatch[1];
      } else {
        result.用途 = cleanedUse;
      }
    } else {
      result.用途 = '';
    }

    let landArea = '';
    let buildingArea = '';
    const landAreaMatch = fullText.match(/共有宗地面积\s*(\d+\.?\d*)/);
    const buildingAreaMatch = fullText.match(/房屋建筑面积\s*(\d+\.?\d*)/);

    if (landAreaMatch && buildingAreaMatch) {
      landArea = landAreaMatch[1];
      buildingArea = buildingAreaMatch[1];
      result.面积 = `共有宗地面积${landArea}㎡/房屋建筑面积${buildingArea}㎡`;
    } else {
      const areaPattern = /面积\s*[:：]?\s*([^\n\r]+?)(?=\s*使用期限|\s*房屋结构|\s*$)/;
      const areaMatch = cleanedText.match(areaPattern);
      if (areaMatch) {
        let areaText = areaMatch[1].trim();
        areaText = areaText.replace(/面积m?[\{\[]/, '').replace(/[\{\}\[\]]/g, '');
        const landNum = areaText.match(/(\d+\.?\d*)\s*m?/);
        const buildingNum = areaText.match(/房屋建筑面积\s*(\d+\.?\d*)/);
        if (landNum && buildingNum) {
          result.面积 = `共有宗地面积${landNum[1]}㎡/房屋建筑面积${buildingNum[1]}㎡`;
        } else {
          result.面积 = areaText;
        }
      } else {
        result.面积 = '未识别';
      }
    }

    const timePattern = /使用期限\s*[:：]?\s*([^\n\r]+?)(?=\s*[\d、．.]+\s*、?房屋结构|[\d、．.]+\s*、?权利人证件号码|[\d、．.]+\s*、?权利其他状况|权利其他状况|权利人证件号码|房屋结构|业务编号|$)/;
    const timeMatch = cleanedText.match(timePattern);
    result.使用期限 = timeMatch ? timeMatch[1].trim() : '';

    const structurePattern = /房屋结构\s*[:：]?\s*([^;\n\r]+?)(?=\s*[;\n\r]|\s*专有建筑面积|\s*权利其他状况|\s*所在楼层|\s*[0-9]+、|$)/;
    const structureMatch = cleanedText.match(structurePattern);
    result.房屋结构 = structureMatch ? structureMatch[1].trim().replace(/[；;]$/, '') : '';

    const innerAreaPattern = /专有建筑面积[（(]套内面积[）)]\s*[:：]?\s*([\d\.]+)\s*平方米/;
    const innerAreaMatch = cleanedText.match(innerAreaPattern);
    result.套内面积 = innerAreaMatch ? `${innerAreaMatch[1]}平方米` : '';

    const floorPattern = /所在楼层\s*[（(]?名义层[）)]?\s*[:：]?\s*([^\n\r]+?)(?=\s*[\d、．.]+\s*、?业务编号|[\d、．.]+\s*、?权利其他状况|业务编号|权利其他状况|$)/;
    const floorMatch = cleanedText.match(floorPattern);
    result.所在楼层 = floorMatch ? floorMatch[1].trim() : '';

    const bizPattern = /业务编号\s*[:：]?\s*([^\s]+)/;
    const bizMatch = cleanedText.match(bizPattern);
    result.业务编号 = bizMatch ? bizMatch[1].trim() : '';

    let 营业执照 = '';
    let 身份证号 = '';
    const businessMatch = cleanedText.match(/营业执照\s*[:：]?\s*([0-9A-Za-z]+)/);
    if (businessMatch) 营业执照 = businessMatch[1].trim();
    const idCardMatch = cleanedText.match(/身份证\s*[:：]?\s*([0-9Xx]{15,18})/);
    if (idCardMatch) 身份证号 = idCardMatch[1].trim();

    let finalText = '';
    finalText += `产权证号：${result.产权证号}\n`;
    finalText += `权利人：${result.权利人}\n`;
    finalText += `共有情况：${result.共有情况}\n`;
    finalText += `坐落：${result.坐落}\n`;
    finalText += `不动产单元号：${result.不动产单元号}\n`;
    finalText += `权利类型：${result.权利类型}\n`;
    finalText += `权利性质：${result.权利性质}\n`;
    finalText += `用途：${result.用途}\n`;
    finalText += `面积：${result.面积}\n`;
    finalText += `使用期限：${result.使用期限}\n`;
    finalText += `房屋结构：${result.房屋结构}\n`;
    finalText += `套内面积：${result.套内面积}\n`;
    finalText += `所在楼层：${result.所在楼层}\n`;
    finalText += `业务编号：${result.业务编号}\n`;
    if (营业执照) finalText += `营业执照：${营业执照}\n`;
    if (身份证号) finalText += `身份证号：${身份证号}\n`;

    return finalText;
  };

  const hasContent = extractedText && extractedText.trim() !== '';

  return (
    <div className={styles.container}>
      {/* 弹窗模态框 */}
      {/* 右侧内部的模态框 - 只在右侧区域显示 */}
      {modalImage && (
        <div className={styles.rightModal} onClick={closeModal}>
          <div className={styles.rightModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.rightModalClose} onClick={closeModal}>×</button>
            <img src={modalImage} alt="预览大图" className={styles.rightModalImage} />
          </div>
        </div>
      )}

      {/* 左侧：提取的文字 */}
      <div className={styles.leftPanel}>
        <div className={styles.panelHeader}>
          <h3>提取的文字</h3>
          <div className={styles.buttonGroup}>
            {hasContent && (
              <button className={styles.copyButton} onClick={() => handleCopyText(extractedText)}>
                复制全部
              </button>

            )}
            {/* 新增：下载按钮（就在复制旁边） */}
            {extractedText && (
              <button className={styles.copyButton} onClick={handleDownloadExcel}>
                下载表格
              </button>
            )}
            {error && (
              <button className={styles.clearButton} onClick={handleClearError}>
                清除错误
              </button>
            )}
          </div>
        </div>

        {/* Tab 切换栏 */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tabButton} ${activeTab === 'structured' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('structured')}
            disabled={!structuredText}
          >
            📋 结构化格式
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === 'raw' ? styles.activeTab : ''}`}
            onClick={() => handleTabChange('raw')}
            disabled={!rawText}
          >
            📄 原始文本
          </button>
        </div>

        <div className={styles.textContent} ref={leftPanelRef}>
          {isModelLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>正在加载 OCR 模型...</p>
              {modelLoadProgress > 0 && (
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${modelLoadProgress}%` }} />
                </div>
              )}
              <p className={styles.loadingHint}>首次加载需要下载模型文件（约 15-20MB）</p>
            </div>
          ) : isLoading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>正在识别文件 {currentFileIndex}...</p>
              {pdfProgress > 0 && (
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${pdfProgress}%` }} />
                </div>
              )}
              <p className={styles.loadingHint}>请稍候，大文件可能需要几秒钟</p>
            </div>
          ) : pageResults.length > 0 ? (
            <div className={styles.pageResultsList}>
              {pageResults.map((result, index) => (
                <div
                  key={result.id}
                  className={`${styles.pageResultItem} ${highlightedPage === index ? styles.highlighted : ''}`}
                  onMouseEnter={() => handlePageHover(index)}
                  onMouseLeave={handlePageLeave}
                >
                  <div className={styles.pageResultHeader}>
                    <span className={styles.pageNumber}>
                      📄 {result.fileName} - 第{result.pageNumber}页
                    </span>
                    <button
                      className={styles.copyPageButton}
                      onClick={() => handleCopyText(
                        activeTab === 'raw' ? result.rawText : result.structuredText
                      )}
                    >
                      复制本页
                    </button>
                  </div>
                  <pre className={styles.pageResultText}>
                    {activeTab === 'raw' ? result.rawText : result.structuredText}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.placeholder}>
              <p>等待提取文字...</p>
              <p className={styles.placeholderHint}>请上传图片或PDF文件后点击"开始提取"</p>
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

      {/* 右侧：文件上传 + 按钮 + 预览 */}
      <div className={styles.rightPanel}>
        <div className={styles.panelHeader}>
          <h3>文件上传</h3>
          {!isModelLoading && ocrInstance && (
            <span className={styles.modelStatus}>✓ OCR 引擎就绪</span>
          )}
          {filePreviews.length > 0 && (
            <span className={styles.fileCount}>{filePreviews.length} 页预览</span>
          )}
        </div>

        {/* 按钮区域 */}
        <div className={styles.buttonArea}>
          <button
            className={styles.extractButton}
            onClick={handleExtractText}
            disabled={selectedFiles.length === 0 || isLoading || isModelLoading || !ocrInstance}
          >
            {isLoading ? '提取中...' : `开始提取文字 (${selectedFiles.length}个文件)`}
          </button>
          <button
            className={styles.resetButton}
            onClick={handleReset}
            disabled={isLoading}
          >
            重置
          </button>
        </div>

        {/* 上传区域 - 只在没有文件时显示 */}
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
              accept="image/*,application/pdf"
              onChange={handleImageSelect}
              multiple
              style={{ display: 'none' }}
            />

            <div className={styles.uploadContent}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
              <p>点击或拖拽文件上传</p>
              <span>支持 JPG、PNG、BMP、PDF，可多选</span>
            </div>
          </div>
        )}

        {/* 预览区域 - 有文件时显示 */}
        {filePreviews.length > 0 && (
          <div className={styles.previewSection}>
            <div className={styles.previewSectionHeader}>
              <h4>文件预览</h4>
              <span className={styles.previewCount}>共 {filePreviews.length} 页</span>
            </div>

            <div className={styles.previewList}>
              {filePreviews.map((preview, index) => (
                <div
                  key={index}
                  ref={el => previewRefs.current[index] = el}
                  className={`${styles.previewItem} ${highlightedPage === index ? styles.highlighted : ''}`}
                  onMouseEnter={() => handlePageHover(index)}
                  onMouseLeave={handlePageLeave}
                >
                  <div className={styles.previewItemHeader}>
                    <span className={styles.previewPageBadge}>
                      📄 第 {preview.pageNumber} 页
                    </span>
                    <span className={styles.previewFileName}>{preview.name}</span>
                    <button
                      className={styles.removePreviewBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      title="移除此页"
                    >
                      ✕
                    </button>
                  </div>

                  <div
                    className={styles.previewImageContainer}
                    onClick={() => handleImageClick(preview)}
                  >
                    {preview.type === 'image' || preview.type === 'pdf-page' ? (
                      <img
                        src={preview.url}
                        alt={`${preview.name} - 第${preview.pageNumber}页`}
                        className={styles.previewImage}
                      />
                    ) : (
                      <div className={styles.pdfPlaceholder}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                          <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10h-4v-2h4v2zm0-4h-4v-2h4v2z" />
                        </svg>
                        <p>预览不可用</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 文件信息 */}
        {selectedFiles.length > 0 && (
          <div className={styles.imageInfo}>
            <p>已选择 {selectedFiles.length} 个文件</p>
            <p>总大小：{(selectedFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)} KB</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OcrTextExtraction;