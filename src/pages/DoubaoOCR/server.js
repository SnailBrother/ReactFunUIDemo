// server.js
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 豆包 API 配置  --legacy-peer-deps
const DOUBAO_CONFIG = {
  apiKey: 'ark-c9f23340-0962-4f59-bebf-f0c8a1a0cab6-1bd7b',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/responses',
  model: 'doubao-seed-2-0-pro-260215'
};

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

// ============ 通用函数 ============

// 调用豆包 API（通用）
async function callDoubaoAPI(messages, timeout = 60000) {
  const requestBody = {
    model: DOUBAO_CONFIG.model,
    input: messages
  };

  const response = await axios.post(DOUBAO_CONFIG.baseUrl, requestBody, {
    headers: {
      'Authorization': `Bearer ${DOUBAO_CONFIG.apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout
  });

  // 提取返回的文本内容
  if (response.data?.output) {
    const output = response.data.output;
    
    if (Array.isArray(output)) {
      for (const item of output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text') {
              return content.text;
            }
          }
        }
      }
    } else if (output.choices) {
      return output.choices[0]?.message?.content || '';
    } else if (typeof output === 'string') {
      return output;
    }
  }
  
  throw new Error('豆包 API 返回格式异常');
}

// 图片转 base64
function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${base64Image}`;
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

// 本地正则解析（降级方案）
function parseByRegex(text) {
  const cleanText = text.replace(/\s+/g, ' ').replace(/[\r\n]+/g, '\n').trim();
  
  const extract = (patterns) => {
    for (const p of patterns) {
      const m = cleanText.match(p);
      if (m) return m[1].trim();
    }
    return '';
  };

  return {
    certificateNumber: extract([
      /([京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼]\d{4}不动产权第\d+号)/,
      /不动产权证书号?[：:\s]*([^\n]+)/
    ]),
    obligee: extract([/权利人[：:\s]*([^\n]+)/]),
    location: extract([/坐落[：:\s]*([^\n]+)/]),
    rightType: extract([/权利性质[：:\s]*(出让|划拨)/]),
    landUse: extract([/用途[：:\s]*([^/\n]+)[/／]/]),
    buildingUse: extract([/用途[：:\s]*[^/\n]+[/／]([^\n]+)/]),
    landArea: extract([/共有宗地面积[：:\s]*([\d.]+)/]),
    buildingArea: extract([/房屋建筑面积[：:\s]*([\d.]+)/]),
    usePeriod: extract([/使用期限[：:\s]*([^。\n]+)/]),
    buildingStructure: extract([/房屋结构[：:\s]*([^\n]+)/]),
    innerArea: extract([/(?:专有建筑面积|套内面积)[：:\s]*([\d.]+)/]),
    floor: extract([/所在楼层[：:\s]*([^\n]+)/]),
    lines: cleanText.split('\n').filter(l => l.trim())
  };
}

// ============ 核心识别函数（一次调用完成） ============

async function extractFromImage(imagePath) {
  console.log('📤 调用豆包 API 识别图片并提取字段...');
  
  const imageUrl = imageToBase64(imagePath);
  
  const prompt = `请识别这张不动产权证书图片，并提取以下字段，以 JSON 格式返回。

返回格式：
{
  "certificateNumber": "证书号",
  "obligee": "权利人",
  "location": "坐落",
  "rightType": "权利性质（出让/划拨）",
  "landUse": "土地用途",
  "buildingUse": "房屋用途",
  "landArea": "共有宗地面积（只数字）",
  "buildingArea": "建筑面积（只数字）",
  "usePeriod": "使用期限（只日期，如2064年12月30日）",
  "buildingStructure": "房屋结构",
  "innerArea": "套内面积（只数字）",
  "floor": "所在楼层"
}

规则：
1. 找不到的字段返回 ""
2. 面积只返回数字，不要单位
3. 使用期限只返回日期，去掉"国有建设用地使用权"和"止"
4. 直接返回纯 JSON，不要其他内容`;

  const responseText = await callDoubaoAPI([{
    role: 'user',
    content: [
      { type: 'input_image', image_url: imageUrl },
      { type: 'input_text', text: prompt }
    ]
  }]);

  // 解析 JSON
  try {
    const cleanJson = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const parsed = JSON.parse(cleanJson);
    parsed.lines = []; // 图片识别不需要原始行
    return cleanParsedFields(parsed);
  } catch (e) {
    console.log('JSON 解析失败，使用正则降级');
    const regexResult = parseByRegex(responseText);
    return cleanParsedFields(regexResult);
  }
}

async function extractFromPDF(pdfPath) {
  console.log('📄 解析 PDF 并提取字段...');
  
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer, {
    preserveFormatting: true,
    disableVersionWarning: true
  });
  
  const rawText = data.text;
  
  const prompt = `从以下不动产权证书文本中提取字段，以 JSON 格式返回。

文本：
${rawText.substring(0, 3000)}

返回格式：
{
  "certificateNumber": "证书号",
  "obligee": "权利人",
  "location": "坐落",
  "rightType": "权利性质（出让/划拨）",
  "landUse": "土地用途",
  "buildingUse": "房屋用途",
  "landArea": "共有宗地面积（只数字）",
  "buildingArea": "建筑面积（只数字）",
  "usePeriod": "使用期限（只日期）",
  "buildingStructure": "房屋结构",
  "innerArea": "套内面积（只数字）",
  "floor": "所在楼层"
}

规则：找不到返回""，面积只返回数字，使用期限只返回日期，直接返回纯JSON。`;

  try {
    const responseText = await callDoubaoAPI([{
      role: 'user',
      content: [{ type: 'input_text', text: prompt }]
    }], 30000);
    
    const cleanJson = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const parsed = JSON.parse(cleanJson);
    parsed.lines = rawText.split('\n').filter(l => l.trim());
    return cleanParsedFields(parsed);
  } catch (e) {
    console.log('API 提取失败，使用正则降级');
    const regexResult = parseByRegex(rawText);
    return cleanParsedFields(regexResult);
  }
}

// ============ API 接口 ============

app.post('/api/extract-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    
    const imagePath = req.file.path;
    console.log('📷 收到图片:', path.basename(imagePath));
    
    const parsedData = await extractFromImage(imagePath);
    
    // 清理临时文件
    try { fs.unlinkSync(imagePath); } catch (e) {}
    
    res.json({
      success: true,
      parsedData,
      engine: 'doubao'
    });
    
  } catch (error) {
    console.error('❌ 识别失败:', error.message);
    
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/extract-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }
    
    const pdfPath = req.file.path;
    console.log('📄 收到PDF:', path.basename(pdfPath));
    
    const parsedData = await extractFromPDF(pdfPath);
    
    try { fs.unlinkSync(pdfPath); } catch (e) {}
    
    res.json({
      success: true,
      parsedData,
      engine: 'doubao'
    });
    
  } catch (error) {
    console.error('❌ 解析失败:', error.message);
    
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', engine: 'doubao' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 服务运行在 http://localhost:${PORT}`);
  console.log(`🤖 使用豆包 API（一次调用完成识别+提取）`);
});