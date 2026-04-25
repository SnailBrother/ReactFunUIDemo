// TextExtraction.js
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import styles from './index.module.css';

const COLUMNS = [
  '不动产权证书',
  '权利人',
  '坐落',
  '权利性质',
  '土地用途',
  '房屋用途',
  '共有宗地面积(㎡)',
  '建筑面积(㎡)',
  '使用期限',
  '房屋结构',
  '套内面积(㎡)',
  '所在楼层',
];

const TextExtraction = () => {
  const [tableData, setTableData] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractStatus, setExtractStatus] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [parsedFields, setParsedFields] = useState(null);
  
  const imageInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // 处理图片上传
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadedFile(file);
    setPreviewType('image');
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setExtractedText('');
    setParsedFields(null);
  };

  // 处理PDF上传
  const handlePdfUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadedFile(file);
    setPreviewType('pdf');
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setExtractedText('');
    setParsedFields(null);
  };

  // 调用后端API提取
  const extractText = async (file) => {
    const formData = new FormData();
    const endpoint = previewType === 'image' 
      ? 'http://localhost:3001/api/extract-image'
      : 'http://localhost:3001/api/extract-pdf';
    
    formData.append(previewType, file);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '识别失败');
    }
    
    return result;
  };

  // 开始提取
  const handleExtract = async () => {
    if (!uploadedFile) {
      alert('请先上传图片或PDF文件');
      return;
    }

    setIsExtracting(true);
    setExtractProgress(10);
    setExtractStatus('正在上传并识别...');
    
    try {
      setExtractProgress(30);
      
      // 调用后端API
      const result = await extractText(uploadedFile);
      
      setExtractProgress(70);
      setExtractStatus('正在解析字段...');
      
      // 显示原始文本
      setExtractedText(result.rawText);
      
      // 获取解析后的字段
      const parsed = result.parsedData;
      setParsedFields(parsed);
      
      // 转换为表格行数据
      const newRow = [
        parsed.certificateNumber || '未识别',
        parsed.obligee || '未识别',
        parsed.location || '未识别',
        parsed.rightType || '未识别',
        parsed.landUse || '未识别',
        parsed.buildingUse || '未识别',
        parsed.landArea || '未识别',
        parsed.buildingArea || '未识别',
        parsed.usePeriod || '未识别',
        parsed.buildingStructure || '未识别',
        parsed.innerArea || '未识别',
        parsed.floor || '未识别',
      ];
      
      setTableData(prev => [...prev, newRow]);
      
      setExtractStatus('提取完成！');
      setExtractProgress(100);
      
      setTimeout(() => {
        setExtractStatus('');
        setExtractProgress(0);
      }, 3000);
      
    } catch (error) {
      console.error('提取失败:', error);
      alert('提取失败: ' + error.message);
      setExtractStatus('提取失败');
      setExtractProgress(0);
    } finally {
      setIsExtracting(false);
    }
  };

  // 下载表格
  const handleDownload = () => {
    if (tableData.length === 0) {
      alert('暂无数据可下载');
      return;
    }

    const wsData = [COLUMNS, ...tableData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '不动产权信息');
    XLSX.writeFile(wb, '不动产权提取结果.xlsx');
  };

  // 格式化显示解析字段
  const formatParsedFields = (fields) => {
    if (!fields) return null;
    
    const lines = fields.lines || [];
    
    return (
      <div className={styles.parsedFields}>
        <div className={styles.fieldGroup}>
          <label>📋 原始文本行数：{lines.length} 行</label>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>1、不动产权证书：</label>
          <span className={styles.fieldValue}>{fields.certificateNumber || '未识别'}</span>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>2、权利人：</label>
          <span className={styles.fieldValue}>{fields.obligee || '未识别'}</span>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>3、坐落：</label>
          <span className={styles.fieldValue}>{fields.location || '未识别'}</span>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>4、权利性质：</label>
          <span className={styles.fieldValue} style={{
            color: fields.rightType === '出让' ? '#10b981' : fields.rightType === '划拨' ? '#f59e0b' : '#ef4444'
          }}>
            {fields.rightType || '未识别'}
          </span>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>5、用途：</label>
          <span className={styles.fieldValue}>
            {fields.landUse || '未识别'} / {fields.buildingUse || '未识别'}
          </span>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>6、面积：</label>
          <span className={styles.fieldValue}>
            共有宗地面积：{fields.landArea || '未识别'}㎡
            <br />
            房屋建筑面积：{fields.buildingArea || '未识别'}㎡
          </span>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>7、使用期限：</label>
          <span className={styles.fieldValue}>{fields.usePeriod || '未识别'}</span>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>8、房屋结构：</label>
          <span className={styles.fieldValue}>{fields.buildingStructure || '未识别'}</span>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>　 专有建筑面积：</label>
          <span className={styles.fieldValue}>{fields.innerArea || '未识别'}㎡</span>
        </div>
        
        <div className={styles.fieldGroup}>
          <label>　 所在楼层：</label>
          <span className={styles.fieldValue}>{fields.floor || '未识别'}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* 左侧表格区域 */}
      <div className={styles.leftPanel}>
        <div className={styles.tableHeader}>
          <h3 className={styles.title}>提取结果表格</h3>
          <button className={styles.downloadBtn} onClick={handleDownload}>
            ⬇️ 下载表格
          </button>
        </div>
        
        <div className={styles.tableWrapper}>
          <table className={styles.excelTable}>
            <thead>
              <tr>
                {COLUMNS.map((col, index) => (
                  <th key={index}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.length > 0 ? (
                tableData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length} className={styles.emptyCell}>
                    暂无数据，请上传文件并点击"开始提取"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 中间解析结果显示区域 */}
      <div className={styles.middlePanel}>
        <div className={styles.middleHeader}>
          <h3 className={styles.title}>字段解析结果</h3>
        </div>
        <div className={styles.parsedDisplay}>
          {parsedFields ? (
            formatParsedFields(parsedFields)
          ) : (
            <div className={styles.textPlaceholder}>
              <p>解析后的字段将按格式显示在这里</p>
              <p className={styles.hint}>上传文件并点击"开始提取"</p>
            </div>
          )}
        </div>
      </div>

      {/* 右侧操作区域 */}
      <div className={styles.rightPanel}>
        <h3 className={styles.title}>文件上传与预览</h3>
        
        <div className={styles.uploadSection}>
          <div className={styles.buttonGroup}>
            <button 
              className={styles.uploadBtn} 
              onClick={() => imageInputRef.current?.click()}
            >
              🖼️ 上传图片
            </button>
            <button 
              className={styles.uploadBtn} 
              onClick={() => pdfInputRef.current?.click()}
            >
              📄 上传PDF
            </button>
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <input
              type="file"
              ref={pdfInputRef}
              accept=".pdf,application/pdf"
              onChange={handlePdfUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div className={styles.previewContainer}>
            {previewUrl ? (
              <>
                {previewType === 'image' && (
                  <img 
                    src={previewUrl} 
                    alt="预览图片" 
                    className={styles.previewImage} 
                  />
                )}
                {previewType === 'pdf' && (
                  <iframe
                    src={previewUrl}
                    title="PDF预览"
                    className={styles.previewPdf}
                    frameBorder="0"
                  />
                )}
                <p className={styles.fileName}>
                  已上传: {uploadedFile?.name}
                </p>
              </>
            ) : (
              <div className={styles.previewPlaceholder}>
                <p>点击上方按钮上传图片或PDF</p>
                <p className={styles.hint}>支持 jpg, png, pdf 格式</p>
              </div>
            )}
          </div>
        </div>

        <div className={styles.actionSection}>
          <button 
            className={styles.extractBtn} 
            onClick={handleExtract}
            disabled={isExtracting || !uploadedFile}
          >
            {isExtracting ? '提取中...' : '✨ 开始提取'}
          </button>
          
          {isExtracting && (
            <div className={styles.progressContainer}>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${extractProgress}%` }}
                />
              </div>
              <span className={styles.progressText}>
                {extractStatus} {extractProgress}%
              </span>
            </div>
          )}
        </div>
        
        {/* 显示原始文本（折叠） */}
        {extractedText && (
          <details className={styles.rawTextDetails}>
            <summary>查看原始识别文本</summary>
            <pre className={styles.rawText}>{extractedText}</pre>
          </details>
        )}
        
        <p className={styles.note}>
          支持不动产权证书图片和PDF识别。
          <br />
          中间区域显示按格式解析的字段。
        </p>
      </div>
    </div>
  );
};

export default TextExtraction;