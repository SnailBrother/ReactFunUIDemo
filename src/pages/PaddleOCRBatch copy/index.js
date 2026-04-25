import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import styles from './index.module.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const OcrTextExtraction = () => {
  const [selectedFiles, setSelectedFiles] = useState([]); // 改为数组，支持多个文件
  const [filePreviews, setFilePreviews] = useState([]); // 预览列表
  const [fileType, setFileType] = useState(null);
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
  const [currentFileIndex, setCurrentFileIndex] = useState(0); // 当前处理进度
  const fileInputRef = useRef(null);

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

  // 处理文件选择（支持多个图片和PDF）
  const handleFileSelect = (files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const validFiles = [];
    const previews = [];

    for (const file of fileArray) {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';

      if (isImage || isPDF) {
        validFiles.push(file);
        
        if (isImage) {
          const reader = new FileReader();
          reader.onloadend = () => {
            previews.push({ type: 'image', url: reader.result, name: file.name });
            if (previews.length === validFiles.length) {
              setFilePreviews([...previews]);
            }
          };
          reader.readAsDataURL(file);
        } else {
          previews.push({ type: 'pdf', url: null, name: file.name });
          if (previews.length === validFiles.length) {
            setFilePreviews([...previews]);
          }
        }
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setFileType(validFiles[0].type.startsWith('image/') ? 'image' : 'pdf');
      setError('');
      setExtractedText('');
      setRawText('');
      setStructuredText('');
    } else {
      setError('请选择有效的图片或PDF文件');
    }
  };

  // 处理文件选择 input
  const handleImageSelect = (e) => {
    const files = e.target.files;
    handleFileSelect(files);
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
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  // PDF 转图片并识别
// PDF 转图片并识别 - 修改为返回每页的独立结果
const extractTextFromPDF = async (pdfFile) => {
  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    let allPageResults = [];

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
      const imageFile = new File([blob], `page_${i + 1}.jpg`, { type: 'image/jpeg' });
      
      const result = await ocrInstance.predict(imageFile);
      
      let pageText = '';
      if (result && result.length > 0) {
        result.forEach(box => {
          if (box.items) {
            box.items.forEach(item => {
              pageText += (item.text || '') + '\n';
            });
          }
        });
      }
      
      if (pageText.trim()) {
        allPageResults.push({
          pageNumber: i,
          text: pageText.trim()
        });
      }
    }

    return allPageResults;

  } catch (error) {
    console.error('PDF 解析失败:', error);
    throw new Error('PDF 解析失败: ' + error.message);
  }
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

  try {
    let allFullText = '';
    let fileCounter = 0;

    for (const file of selectedFiles) {
      setCurrentFileIndex(fileCounter + 1);
      const isImage = file.type.startsWith('image/');
      
      if (isImage) {
        // 单张图片处理
        const fileText = await extractTextFromImage(file);
        if (fileText) {
          allFullText += `【文件 ${fileCounter + 1}: ${file.name}】\n${fileText}\n\n`;
        }
      } else {
        // PDF 处理，返回每页的结果数组
        const pageResults = await extractTextFromPDF(file);
        if (pageResults && pageResults.length > 0) {
          allFullText += `【文件 ${fileCounter + 1}: ${file.name}】\n`;
          for (const page of pageResults) {
            allFullText += `  📄 第 ${page.pageNumber} 页\n`;
            allFullText += `${page.text}\n\n`;
          }
          allFullText += `\n`;
        }
      }
      fileCounter++;
    }

    // 保存原始文本
    setRawText(allFullText);

    // 生成结构化文本
    const formattedText = formatStructuredText(allFullText);
    setStructuredText(formattedText);
    setExtractedText(formattedText);

    console.log('原始文本:', allFullText);
    console.log('结构化文本:', formattedText);

  } catch (err) {
    console.error('识别失败', err);
    setError('识别失败: ' + err.message);
  } finally {
    setIsLoading(false);
    setPdfProgress(0);
    setCurrentFileIndex(0);
  }
};

  // 移除单个文件
  const removeFile = (index) => {
    const newFiles = [...selectedFiles];
    const newPreviews = [...filePreviews];
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setSelectedFiles(newFiles);
    setFilePreviews(newPreviews);
    
    if (newFiles.length === 0) {
      setExtractedText('');
      setRawText('');
      setStructuredText('');
    }
  };

  // 重置所有
  const handleReset = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
    setFileType(null);
    setExtractedText('');
    setRawText('');
    setStructuredText('');
    setError('');
    setPdfProgress(0);
    setCurrentFileIndex(0);
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

  // 切换Tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'raw') {
      setExtractedText(rawText);
    } else {
      setExtractedText(structuredText);
    }
  };

  // 清除错误
  const handleClearError = () => {
    setError('');
  };

  const hasContent = extractedText && extractedText.trim() !== '';

  
// 修改后的格式化函数 - 支持多文件
// 修改后的格式化函数 - 支持多文件和多页
const formatStructuredText = (fullText) => {
  if (!fullText || !fullText.trim()) {
    return '未识别到文字';
  }

  // 按文件分割
  const fileSections = fullText.split(/【文件 \d+: [^\n]+】\n/);
  const fileNames = fullText.match(/【文件 \d+: ([^\n]+)】/g);
  
  if (!fileNames || fileNames.length <= 1) {
    // 单文件处理，检查是否有多个页面
    const pageSections = fullText.split(/  📄 第 \d+ 页\n/);
    const pageNumbers = fullText.match(/📄 第 (\d+) 页/g);
    
    if (pageNumbers && pageNumbers.length > 1) {
      // 多页PDF：分别处理每页
      let allResults = '';
      for (let i = 0; i < pageNumbers.length; i++) {
        const pageNum = pageNumbers[i].match(/\d+/)[0];
        const pageContent = pageSections[i + 1] || '';
        allResults += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        allResults += `📄 第 ${pageNum} 页\n`;
        allResults += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        allResults += formatSingleFileStructured(pageContent);
        allResults += `\n\n`;
      }
      return allResults;
    }
    return formatSingleFileStructured(fullText);
  }
  
  // 多文件：分别处理每个文件
  let allResults = '';
  
  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i].replace(/【文件 \d+: |】/g, '').trim();
    const fileContent = fileSections[i + 1] || '';
    
    // 检查文件内容是否包含多页
    const pageSections = fileContent.split(/  📄 第 \d+ 页\n/);
    const pageNumbers = fileContent.match(/📄 第 (\d+) 页/g);
    
    allResults += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    allResults += `📁 文件 ${i + 1}: ${fileName}\n`;
    allResults += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (pageNumbers && pageNumbers.length > 1) {
      // 该文件是多页PDF
      for (let j = 0; j < pageNumbers.length; j++) {
        const pageNum = pageNumbers[j].match(/\d+/)[0];
        const pageContent = pageSections[j + 1] || '';
        allResults += `\n  📄 第 ${pageNum} 页\n`;
        allResults += formatSingleFileStructured(pageContent);
        allResults += `\n`;
      }
    } else {
      // 单页图片或单页PDF
      allResults += formatSingleFileStructured(fileContent);
    }
    allResults += `\n\n`;
  }
  
  return allResults;
};

// 单文件结构化格式化函数（原 formatStructuredText 的内容）
// 单文件结构化格式化函数 - 修复产权证号匹配
const formatSingleFileStructured = (fullText) => {
  // 先保留原始文本用于产权证号匹配，然后清理用于其他字段
  const originalText = fullText;
  let cleanedText = fullText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  console.log('清理后的文本:', cleanedText);

  const result = {};

  // ========== 修复产权证号匹配 ==========
  // 方案1: 在清理文本中查找（已合并换行）
  let codeMatch = null;
  
  // 先尝试标准格式（清理后的文本）
  codeMatch = cleanedText.match(/渝[（\(]?\s*(\d+)\s*[）\)]?\s*([\u4e00-\u9fa5]+区?)\s*不动产权第\s*(\d+)\s*号/);
  
  if (!codeMatch) {
    // 方案2: 直接在原始文本中匹配 OCR 断行格式
    // 匹配: 渝（ 2026 江津区 不动产权第 000193860 号
    const yearMatch = originalText.match(/渝[（\(]?\s*(\d+)/);
    const areaMatch = originalText.match(/[）\)]?\s*([\u4e00-\u9fa5]+区?)\s*不动产权第/);
    const numberMatch = originalText.match(/不动产权第\s*(\d+)\s*号/);
    
    if (yearMatch && areaMatch && numberMatch) {
      result.产权证号 = `渝（${yearMatch[1]}）${areaMatch[1]}不动产权第${numberMatch[1]}号`;
    } else {
      // 方案3: 尝试直接匹配换行分隔的
      const codePattern = /渝\s*\n?\s*[（\(]?\s*(\d+)\s*\n?\s*[）\)]?\s*\n?\s*([\u4e00-\u9fa5]+区?)\s*\n?\s*不动产权第\s*\n?\s*(\d+)\s*\n?\s*号/s;
      const multiLineMatch = originalText.match(codePattern);
      if (multiLineMatch) {
        result.产权证号 = `渝（${multiLineMatch[1]}）${multiLineMatch[2]}不动产权第${multiLineMatch[3]}号`;
      } else {
        // 方案4: 简单提取数字和区域组合
        const year = originalText.match(/\b(20\d{2})\b/);
        const area = originalText.match(/([\u4e00-\u9fa5]{2,3}区)/);
        const num = originalText.match(/不动产权第\s*(\d+)/);
        if (year && area && num) {
          result.产权证号 = `渝（${year[1]}）${area[1]}不动产权第${num[1]}号`;
        } else {
          result.产权证号 = '未识别';
        }
      }
    }
  } else {
    result.产权证号 = `渝（${codeMatch[1]}）${codeMatch[2]}不动产权第${codeMatch[3]}号`;
  }

  // 其他字段保持不变...
  // 权利人
  const qlrMatch = cleanedText.match(/权利人\s*[:：]?\s*([^\s]+)/);
  result.权利人 = qlrMatch ? qlrMatch[1].trim() : '';

  // 共有情况
  const gyqkMatch = cleanedText.match(/共有情况\s*[:：]?\s*([^\s]+)/);
  result.共有情况 = gyqkMatch ? gyqkMatch[1].trim() : '';

  // 坐落
  const addrPattern = /坐落\s*[:：]?\s*([^\n\r]+?)(?=\s*不动产单元号|不动产单元号\s|权利类型|权利性质|$)/;
  const addrMatch = cleanedText.match(addrPattern);
  if (addrMatch) {
    result.坐落 = addrMatch[1].trim();
  } else {
    const fallbackAddrMatch = cleanedText.match(/单独所有\s*([^\n\r]+?)\s*不动产单元号/);
    result.坐落 = fallbackAddrMatch ? fallbackAddrMatch[1].trim() : '';
  }

  // 不动产单元号
  const unitPattern = /不动产单元号\s*[:：]?\s*([A-Z0-9\s\-\/]+)/;
  const unitMatch = cleanedText.match(unitPattern);
  result.不动产单元号 = unitMatch ? unitMatch[1].replace(/\s+/g, '').trim() : '';

  // 权利类型
  const typePattern = /权利类型\s*[:：]?\s*([^\n\r]+?)(?=\s*权利性质|用途|面积|$)/;
  const typeMatch = cleanedText.match(typePattern);
  result.权利类型 = typeMatch ? typeMatch[1].trim() : '';

  // 权利性质 - 修复，只提取到"出让"
// 权利性质 - 修复，正确提取"出让"或"划拨"
let natureText = '';
// 先尝试直接匹配"权利性质"后面的内容
const naturePattern = /权利性质\s*[:：]?\s*([^\n\r]+?)(?=\s*用途|\s*面积|\s*使用期限|\s*$)/;
const natureMatch = cleanedText.match(naturePattern);
if (natureMatch) {
  natureText = natureMatch[1].trim();
  // 优先提取"出让"或"划拨"
  if (natureText.includes('出让')) {
    result.权利性质 = '出让';
  } else if (natureText.includes('划拨')) {
    result.权利性质 = '划拨';
  } else {
    result.权利性质 = natureText;
  }
} else {
  // 备用方案：直接查找"出让"或"划拨"关键词
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

  // 用途 - 修复，处理"途"断行
// 用途 - 修复，处理"途"断行和"用"断行
let useText = '';

// 方案1: 先尝试匹配完整格式
let useMatch = cleanedText.match(/用途\s*[:：]?\s*([^面积面\n\r]+?)(?=\s*面积|\s*面|\s*使用期限|\s*$)/);
if (useMatch) {
  useText = useMatch[1].trim();
} else {
  // 方案2: 处理"用"和"途"被分开的情况
  // 先找到"用"或"途"的位置
  const yongMatch = originalText.match(/用[\s\n]*([\u4e00-\u9fa5\/]+)/);
  const tuMatch = originalText.match(/途[\s\n]*([\u4e00-\u9fa5\/]+)/);
  
  if (yongMatch && yongMatch[1]) {
    useText = yongMatch[1].trim();
  } else if (tuMatch && tuMatch[1]) {
    useText = tuMatch[1].trim();
  }
}

// 清理用途文本
if (useText) {
  // 移除可能的乱码和多余字符
  let cleanedUse = useText.replace(/^[\d、．.]+\s*/, '');
  // 如果包含"/"，提取有效部分
  const slashMatch = cleanedUse.match(/([\u4e00-\u9fa5]+\/[\u4e00-\u9fa5]+)/);
  if (slashMatch) {
    result.用途 = slashMatch[1];
  } else {
    // 如果没有"/"，直接取清理后的文本
    result.用途 = cleanedUse;
  }
} else {
  result.用途 = '';
}

  // 面积
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

  // 使用期限
  const timePattern = /使用期限\s*[:：]?\s*([^\n\r]+?)(?=\s*[\d、．.]+\s*、?房屋结构|[\d、．.]+\s*、?权利人证件号码|[\d、．.]+\s*、?权利其他状况|权利其他状况|权利人证件号码|房屋结构|业务编号|$)/;
  const timeMatch = cleanedText.match(timePattern);
  result.使用期限 = timeMatch ? timeMatch[1].trim() : '';

  // 房屋结构
  const structurePattern = /房屋结构\s*[:：]?\s*([^;\n\r]+?)(?=\s*[;\n\r]|\s*专有建筑面积|\s*权利其他状况|\s*所在楼层|\s*[0-9]+、|$)/;
  const structureMatch = cleanedText.match(structurePattern);
  result.房屋结构 = structureMatch ? structureMatch[1].trim().replace(/[；;]$/, '') : '';

  // 套内面积
  const innerAreaPattern = /专有建筑面积[（(]套内面积[）)]\s*[:：]?\s*([\d\.]+)\s*平方米/;
  const innerAreaMatch = cleanedText.match(innerAreaPattern);
  result.套内面积 = innerAreaMatch ? `${innerAreaMatch[1]}平方米` : '';

  // 所在楼层
  const floorPattern = /所在楼层\s*[（(]?名义层[）)]?\s*[:：]?\s*([^\n\r]+?)(?=\s*[\d、．.]+\s*、?业务编号|[\d、．.]+\s*、?权利其他状况|业务编号|权利其他状况|$)/;
  const floorMatch = cleanedText.match(floorPattern);
  result.所在楼层 = floorMatch ? floorMatch[1].trim() : '';

  // 业务编号
  const bizPattern = /业务编号\s*[:：]?\s*([^\s]+)/;
  const bizMatch = cleanedText.match(bizPattern);
  result.业务编号 = bizMatch ? bizMatch[1].trim() : '';

  // 营业执照和身份证
  let 营业执照 = '';
  let 身份证号 = '';
  const businessMatch = cleanedText.match(/营业执照\s*[:：]?\s*([0-9A-Za-z]+)/);
  if (businessMatch) 营业执照 = businessMatch[1].trim();
  const idCardMatch = cleanedText.match(/身份证\s*[:：]?\s*([0-9Xx]{15,18})/);
  if (idCardMatch) 身份证号 = idCardMatch[1].trim();

  // 构建最终输出
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

  return (
    <div className={styles.container}>
      {/* 左侧：提取的文字 */}
      <div className={styles.leftPanel}>
        <div className={styles.panelHeader}>
          <h3>提取的文字</h3>
          <div className={styles.buttonGroup}>
            {hasContent && (
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

        <div className={styles.textContent}>
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
              <p>正在识别文件 {currentFileIndex}/{selectedFiles.length}...</p>
              {pdfProgress > 0 && (
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${pdfProgress}%` }} />
                </div>
              )}
              <p className={styles.loadingHint}>请稍候，大文件可能需要几秒钟</p>
            </div>
          ) : extractedText ? (
            <div className={styles.extractedText}>
              <pre>{extractedText}</pre>
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

      {/* 右侧：上传文件 */}
      <div className={styles.rightPanel}>
        <div className={styles.panelHeader}>
          <h3>文件上传</h3>
          {!isModelLoading && ocrInstance && (
            <span className={styles.modelStatus}>✓ OCR 引擎就绪</span>
          )}
          {selectedFiles.length > 0 && (
            <span className={styles.fileCount}>已选 {selectedFiles.length} 个文件</span>
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
            accept="image/*,application/pdf"
            onChange={handleImageSelect}
            multiple
            style={{ display: 'none' }}
          />
          
          {filePreviews.length > 0 ? (
            <div className={styles.filePreviewList}>
              {filePreviews.map((preview, index) => (
                <div key={index} className={styles.filePreviewItem}>
                  {preview.type === 'image' ? (
                    <img src={preview.url} alt={preview.name} className={styles.thumbnailImage} />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32" className={styles.pdfIcon}>
                      <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10h-4v-2h4v2zm0-4h-4v-2h4v2z"/>
                    </svg>
                  )}
                  <span className={styles.fileName}>{preview.name}</span>
                  <button
                    className={styles.removeFileBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.uploadPlaceholder}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z" />
              </svg>
              <p>点击或拖拽文件到此处上传</p>
              <span>支持 JPG、PNG、BMP、PDF 等格式，可多选</span>
            </div>
          )}
        </div>

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