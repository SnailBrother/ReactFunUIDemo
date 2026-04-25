import React, { useState, useRef, useEffect } from 'react';
import styles from './index.module.css';

const OcrTextExtraction = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [rawText, setRawText] = useState(''); // 存储原始识别文本
  const [structuredText, setStructuredText] = useState(''); // 存储结构化文本
  const [activeTab, setActiveTab] = useState('structured'); // 'raw' 或 'structured'
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
      setRawText('');
      setStructuredText('');
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
      setRawText('');
      setStructuredText('');
    } else {
      setError('请拖拽有效的图片文件');
    }
  };

  // 结构化格式化函数 - 进一步优化版
  const formatStructuredText = (fullText) => {
    // 先保留原始文本用于产权证号匹配，然后清理用于其他字段
    const originalText = fullText;
    let cleanedText = fullText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    console.log('清理后的文本:', cleanedText);

    const result = {};

    // 产权证号 - 处理多种可能的断行情况
    // 方案1: 在清理文本中查找
    let codeMatch = null;
    // 先尝试标准格式
    codeMatch = cleanedText.match(/渝\s*[（\(]\s*(\d+)\s*[）\)]\s*([\u4e00-\u9fa5]+区?)\s*不动产权第\s*(\d+)\s*号/);

    // 如果没找到，可能是括号后的空格被处理掉了
    if (!codeMatch) {
      codeMatch = cleanedText.match(/渝\s*[（\(]\s*(\d+)\s*[）\)]\s*([\u4e00-\u9fa5]+区?)\s+不动产权第\s+(\d+)\s+号/);
    }

    if (codeMatch) {
      result.产权证号 = `渝（${codeMatch[1]}）${codeMatch[2]}不动产权第${codeMatch[3]}号`;
    } else {
      // 方案2: 在原始文本中按顺序查找各个部分
      const parts = [];

      // 提取年份 - 在"渝（"之后的数字
      const yearMatch = originalText.match(/渝[（\(](\d+)/);
      if (yearMatch) parts.push(yearMatch[1]);

      // 提取区域 - 在年份后的中文区域名
      const areaMatch = originalText.match(/[\u4e00-\u9fa5]+区?[\s\n]*\s*不动产权第/);
      if (areaMatch) {
        const area = areaMatch[0].replace(/[\s\n]+/g, '').replace('不动产权第', '');
        if (area) parts.splice(1, 0, area);
      } else {
        // 如果上面的没找到，尝试简单查找区域名
        const simpleAreaMatch = originalText.match(/[（\(]\d+[）\)][\s\n]*([\u4e00-\u9fa5]+区?)[\s\n]*不动产权第/);
        if (simpleAreaMatch) {
          parts.splice(1, 0, simpleAreaMatch[1]);
        }
      }

      // 提取编号 - "不动产权第"后的数字
      const numberMatch = originalText.match(/不动产权第\s*(\d+)\s*号/);
      if (numberMatch) parts.push(numberMatch[1]);

      if (parts.length >= 3) {
        result.产权证号 = `渝（${parts[0]}）${parts[1]}不动产权第${parts[2]}号`;
      } else {
        result.产权证号 = '未识别';
      }
    }

    // 权利人 - 查找"权利人"后面的值，直到下一个字段
    const qlrPattern = /权利人\s*[:：]?\s*([^\s]+)/;
    const qlrMatch = cleanedText.match(qlrPattern);
    result.权利人 = qlrMatch ? qlrMatch[1].trim() : '';

    // 共有情况 - 查找"共有情况"后面的值
    const gyqkPattern = /共有情况\s*[:：]?\s*([^\s]+)/;
    const gyqkMatch = cleanedText.match(gyqkPattern);
    result.共有情况 = gyqkMatch ? gyqkMatch[1].trim() : '';

    // 坐落 - 从"坐落"开始，直到下一个字段
    // 坐落 - 从"坐落"开始，直到下一个字段
    const addrPattern = /坐落\s*[:：]?\s*([^\n\r]+?)(?=\s*不动产单元号|不动产单元号\s|权利类型|权利性质|$)/;
    const addrMatch = cleanedText.match(addrPattern);
    if (addrMatch) {
      result.坐落 = addrMatch[1].trim();
    } else {
      // 备用：从清理文本中提取地址（在"共有情况"之后，"不动产单元号"之前）
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

    // 权利性质
    const naturePattern = /权利性质\s*[:：]?\s*([^\n\r]+?)(?=\s*用途|面积|使用期限|$)/;
    const natureMatch = cleanedText.match(naturePattern);
    result.权利性质 = natureMatch ? natureMatch[1].trim() : '';

    // 用途
 let useText = '';
// 先尝试匹配"用途"后面的内容
const usePattern = /用途\s*[:：]?\s*([^面积面]+?)(?=\s*面积|\s*面|\s*使用期限|\s*$)/;
const useMatch = cleanedText.match(usePattern);
if (useMatch) {
  useText = useMatch[1].trim();
} else {
  // 如果"用途"匹配不到，可能是"途"断行了，尝试匹配"途"后面的内容
  const tuMatch = cleanedText.match(/途\s*[:：]?\s*([^面积面]+?)(?=\s*面积|\s*面|\s*使用期限|\s*$)/);
  if (tuMatch) {
    useText = tuMatch[1].trim();
  }
}

const cleanUseMatch = useText.match(/([\u4e00-\u9fa5]+\/[\u4e00-\u9fa5]+)/);
result.用途 = cleanUseMatch ? cleanUseMatch[1] : useText;



    // 面积 - 处理"共有宗地面积"和"房屋建筑面积"
    // 面积 - 修复格式，提取正确的土地面积和房屋面积
    let landArea = '';
    let buildingArea = '';

    // 从原始文本中提取数字（更可靠）
    const landAreaMatch = fullText.match(/共有宗地面积\s*(\d+\.?\d*)/);
    const buildingAreaMatch = fullText.match(/房屋建筑面积\s*(\d+\.?\d*)/);

    if (landAreaMatch && buildingAreaMatch) {
      landArea = landAreaMatch[1];
      buildingArea = buildingAreaMatch[1];
      result.面积 = `共有宗地面积${landArea}㎡/房屋建筑面积${buildingArea}㎡`;
    } else {
      // 备用方案：从清理文本中提取
      const areaPattern = /面积\s*[:：]?\s*([^\n\r]+?)(?=\s*使用期限|\s*房屋结构|\s*$)/;
      const areaMatch = cleanedText.match(areaPattern);
      if (areaMatch) {
        let areaText = areaMatch[1].trim();
        // 清理多余字符如 "m{" 或 "面积m{"
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
    // 房屋结构 - 更精确的匹配
    const structurePattern = /房屋结构\s*[:：]?\s*([^;\n\r]+?)(?=\s*[;\n\r]|\s*专有建筑面积|\s*权利其他状况|\s*所在楼层|\s*[0-9]+、|$)/;
    const structureMatch = cleanedText.match(structurePattern);
    result.房屋结构 = structureMatch ? structureMatch[1].trim().replace(/[；;]$/, '') : '';


    // 套内面积/专有建筑面积  
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

    // 身份证号/证件号码
    // 证件号码 - 分别提取营业执照和身份证
    let 营业执照 = '';
    let 身份证号 = '';

    // 提取营业执照号码
    const businessLicensePattern = /营业执照\s*[:：]?\s*([0-9A-Za-z]+)/;
    const businessMatch = cleanedText.match(businessLicensePattern);
    if (businessMatch) {
      营业执照 = businessMatch[1].trim();
    }

    // 提取身份证号码（18位数字，最后可能是X）
    const idCardPattern = /身份证\s*[:：]?\s*([0-9Xx]{15,18})/;
    const idCardMatch = cleanedText.match(idCardPattern);
    if (idCardMatch) {
      身份证号 = idCardMatch[1].trim();
    }

    result.营业执照 = 营业执照;
    result.身份证号 = 身份证号;



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
    if (result.营业执照) {
      finalText += `营业执照：${result.营业执照}\n`;
    }
    if (result.身份证号) {
      finalText += `身份证号：${result.身份证号}\n`;
    }

    return finalText;
  };

  // OCR识别核心函数
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
    setRawText('');
    setStructuredText('');

    try {
      let imageInput = selectedImage;
      if (!(imageInput instanceof File)) {
        const res = await fetch(imagePreview);
        const blob = await res.blob();
        imageInput = new File([blob], 'ocr.jpg', { type: blob.type });
      }

      const results = await ocrInstance.predict(imageInput);

      // 拼接原始文本
      let fullText = '';
      results.forEach(box => {
        if (box.items) {
          box.items.forEach(item => {
            fullText += (item.text || '') + '\n';
          });
        }
      });
      fullText = fullText.trim();

      // 保存原始文本
      setRawText(fullText);

      // 生成结构化文本
      const formattedText = formatStructuredText(fullText);
      setStructuredText(formattedText);
      setExtractedText(formattedText);

      console.log('原始文本:', fullText);
      console.log('结构化文本:', formattedText);

    } catch (err) {
      console.error('识别失败', err);
      setError('识别失败，请重试');
    } finally {
      setIsLoading(false);
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

  // 重置
  const handleReset = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setExtractedText('');
    setRawText('');
    setStructuredText('');
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

  // 清除错误
  const handleClearError = () => {
    setError('');
  };

  // 当前显示的文本是否有内容
  const hasContent = extractedText && extractedText.trim() !== '';

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