const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 配置文件上传
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// 创建uploads目录
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// 调用 Python PaddleOCR
async function callPythonOCR(imagePath) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', ['ocr_service.py', imagePath]);
    
    let result = '';
    let error = '';
    
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${error}`));
        return;
      }
      
      try {
        const parsed = JSON.parse(result);
        if (parsed.error) {
          reject(new Error(parsed.error));
        } else {
          resolve(parsed);
        }
      } catch (e) {
        reject(new Error(`Failed to parse OCR result: ${e.message}`));
      }
    });
  });
}

// 清理提取的字段
function cleanParsedFields(data) {
  const cleaned = { ...data };
  
  // 清理使用期限 - 只保留日期
  if (cleaned.usePeriod) {
    cleaned.usePeriod = cleaned.usePeriod
      .replace(/^国有建设用地使用权\s*/g, '')
      .replace(/^使用期限\s*/g, '')
      .replace(/^期限\s*/g, '')
      .replace(/\s*止$/g, '')
      .replace(/\s*到期$/g, '')
      .replace(/\s*届满$/g, '')
      .trim();
    
    const dateMatch = cleaned.usePeriod.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
    if (dateMatch) cleaned.usePeriod = dateMatch[1];
  }
  
  // 清理面积 - 只保留数字
  ['landArea', 'buildingArea', 'innerArea'].forEach(field => {
    if (cleaned[field]) {
      const match = String(cleaned[field]).match(/(\d+\.?\d*)/);
      if (match) cleaned[field] = match[1];
    }
  });
  
  // 清理权利性质 - 标准化
  if (cleaned.rightType) {
    if (cleaned.rightType.includes('出让')) cleaned.rightType = '出让';
    else if (cleaned.rightType.includes('划拨')) cleaned.rightType = '划拨';
  }
  
  return cleaned;
}

// 从 OCR 结果解析字段
// 增强版的解析函数
function parseFieldsFromOcrResult(ocrText, rawLines = []) {
  const cleanText = ocrText.replace(/\s+/g, ' ').replace(/[\r\n]+/g, '\n').trim();
  const lines = rawLines.length > 0 
    ? rawLines.map(line => typeof line === 'string' ? line : line.text)
    : cleanText.split('\n').filter(l => l.trim());
  
  console.log('开始解析，共', lines.length, '行');
  console.log('原始行:', lines);
  
  // 更智能的字段提取
  let certificateNumber = '';
  let obligee = '';
  let location = '';
  let rightType = '';
  let landUse = '';
  let buildingUse = '';
  let landArea = '';
  let buildingArea = '';
  let usePeriod = '';
  let buildingStructure = '';
  let innerArea = '';
  let floor = '';
  
  // 遍历每一行查找
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 查找证书号（包含"不动产权"的行）
    if (line.includes('不动产权') && !certificateNumber) {
      const match = line.match(/(\d+)/);
      if (match) certificateNumber = match[1];
      else certificateNumber = line;
    }
    
    // 查找权利人（包含"权利人"或公司名称的行）
    if ((line.includes('权利') || line.includes('公司')) && !obligee) {
      if (line.includes('公司')) obligee = line;
      else if (i + 1 < lines.length && lines[i+1].includes('公司')) obligee = lines[i+1];
    }
    
    // 查找坐落（包含"路"、"号"、"幢"的行）
    if ((line.includes('路') || line.includes('号') || line.includes('幢')) && !location) {
      location = line;
    }
    
    // 查找权利性质
    if (line.includes('权利性质') && !rightType) {
      const match = line.match(/[：:\s]*([^：:\s]+)/);
      if (match) rightType = match[1];
    }
    
    // 查找用途
    if (line.includes('用途') && !landUse) {
      const parts = line.split(/[：:\s]/);
      for (let j = 0; j < parts.length; j++) {
        if (parts[j].includes('用地')) landUse = parts[j];
        if (parts[j].includes('住宅') || parts[j].includes('商业')) buildingUse = parts[j];
      }
    }
    
    // 查找面积数字
    const areaMatch = line.match(/(\d+(?:\.\d+)?)\s*(?:㎡|平方米|m2)/i);
    if (areaMatch) {
      const area = areaMatch[1];
      if (line.includes('宗地') && !landArea) landArea = area;
      else if (line.includes('建筑') && !buildingArea) buildingArea = area;
      else if (line.includes('专有') || line.includes('套内')) innerArea = area;
      else if (!landArea && !buildingArea) buildingArea = area;
    }
    
    // 查找使用期限（包含日期）
    const dateMatch = line.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
    if (dateMatch && !usePeriod) {
      usePeriod = dateMatch[1];
    }
    
    // 查找楼层
    if (line.includes('层') && !floor) {
      const match = line.match(/(\d+)\s*层/);
      if (match) floor = match[1];
    }
    
    // 查找房屋结构
    if ((line.includes('结构') || line.includes('钢混') || line.includes('砖混')) && !buildingStructure) {
      if (line.includes('钢混')) buildingStructure = '钢混';
      else if (line.includes('砖混')) buildingStructure = '砖混';
      else buildingStructure = line;
    }
  }
  
  const result = {
    certificateNumber: certificateNumber || '未识别',
    obligee: obligee || '未识别',
    location: location || '未识别',
    rightType: rightType || '未识别',
    landUse: landUse || '未识别',
    buildingUse: buildingUse || '未识别',
    landArea: landArea || '未识别',
    buildingArea: buildingArea || '未识别',
    usePeriod: usePeriod || '未识别',
    buildingStructure: buildingStructure || '未识别',
    innerArea: innerArea || '未识别',
    floor: floor || '未识别',
    lines: lines
  };
  
  console.log('解析结果:', result);
  return result;
}
// 从图片提取
// 从图片提取
async function extractFromImage(imagePath) {
  console.log('📤 正在使用 EasyOCR 识别图片...');
  
  // 调用 Python OCR
  const ocrResult = await callPythonOCR(imagePath);
  
  const rawText = ocrResult.text;
  const rawLines = ocrResult.lines || [];
  
  console.log(`✅ OCR 识别完成，共识别到 ${rawLines.length} 个文本块`);
  
  // ========== 打印所有识别的文字 ==========
  console.log('\n========== OCR 识别的原始文本（完整） ==========');
  console.log(rawText);
  console.log('================================================\n');
  
  // 打印每个文本块的详细信息
  console.log('========== 详细文本块信息 ==========');
  rawLines.forEach((line, index) => {
    console.log(`[${index + 1}] 文本: "${line.text}"`);
    console.log(`    置信度: ${(line.confidence * 100).toFixed(2)}%`);
    console.log(`    位置: ${JSON.stringify(line.bbox)}`);
  });
  console.log('=====================================\n');
  
  // 用正则表达式解析字段
  const parsedData = parseFieldsFromOcrResult(rawText, rawLines);
  
  // 打印解析后的字段
  console.log('========== 解析后的字段 ==========');
  console.log('证书号:', parsedData.certificateNumber);
  console.log('权利人:', parsedData.obligee);
  console.log('坐落:', parsedData.location);
  console.log('权利性质:', parsedData.rightType);
  console.log('土地用途:', parsedData.landUse);
  console.log('房屋用途:', parsedData.buildingUse);
  console.log('共有宗地面积:', parsedData.landArea);
  console.log('建筑面积:', parsedData.buildingArea);
  console.log('使用期限:', parsedData.usePeriod);
  console.log('房屋结构:', parsedData.buildingStructure);
  console.log('套内面积:', parsedData.innerArea);
  console.log('所在楼层:', parsedData.floor);
  console.log('===================================\n');
  
  return {
    rawText: rawText,
    parsedData: cleanParsedFields(parsedData)
  };
}

// 从 PDF 提取
async function extractFromPDF(pdfPath) {
  console.log('📄 正在解析 PDF...');
  
  // 读取 PDF 文件
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer, {
    preserveFormatting: true,
    disableVersionWarning: true
  });
  
  const rawText = data.text;
  const rawLines = rawText.split('\n').filter(l => l.trim());
  
  console.log(`✅ PDF 解析完成，共 ${rawLines.length} 行文本`);
  
  // 用正则解析字段
  const parsedData = parseFieldsFromOcrResult(rawText, rawLines);
  
  return {
    rawText: rawText,
    parsedData: cleanParsedFields(parsedData)
  };
}

// ============ API 接口 ============

// 图片识别接口
app.post('/api/extract-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    
    const imagePath = req.file.path;
    console.log('📷 收到图片:', path.basename(imagePath));
    
    const result = await extractFromImage(imagePath);
    
    // 清理临时文件
    try { fs.unlinkSync(imagePath); } catch (e) {}
    
    res.json({
      success: true,
      rawText: result.rawText,
      parsedData: result.parsedData,
      engine: 'paddleocr-python'
    });
    
  } catch (error) {
    console.error('❌ 识别失败:', error.message);
    
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// PDF 识别接口
app.post('/api/extract-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    
    const pdfPath = req.file.path;
    console.log('📄 收到PDF:', path.basename(pdfPath));
    
    const result = await extractFromPDF(pdfPath);
    
    // 清理临时文件
    try { fs.unlinkSync(pdfPath); } catch (e) {}
    
    res.json({
      success: true,
      rawText: result.rawText,
      parsedData: result.parsedData,
      engine: 'paddleocr-python'
    });
    
  } catch (error) {
    console.error('❌ 解析失败:', error.message);
    
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    engine: 'paddleocr-python'
  });
});

// 启动服务器
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 服务运行在 http://localhost:${PORT}`);
  console.log(`🔍 使用 Python PaddleOCR 引擎`);
});