const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|bmp|tiff|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('只支持图片格式: jpeg, jpg, png, bmp, tiff, gif'));
    }
  }
});

// 文字提取 API
app.post('/api/extract-text', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请上传图片文件' });
  }

  try {
    const imagePath = req.file.path;
    
    // 使用 Tesseract.js 进行 OCR 识别
    // 支持中文简体+英文识别
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      'chi_sim+eng', // 中文简体 + 英文
      {
        logger: (m) => {
          // 可选：进度日志输出
          if (process.env.NODE_ENV === 'development') {
            console.log(m);
          }
        },
        tessedit_pageseg_mode: 6, // 统一的文本块识别模式
      }
    );

    // 清理临时文件
    fs.unlinkSync(imagePath);

    // 处理识别结果
    const cleanedText = text
      .trim()
      .replace(/\n{3,}/g, '\n\n'); // 将多个连续换行替换为最多两个

    res.json({
      success: true,
      text: cleanedText,
      charCount: cleanedText.length,
      message: '文字提取成功'
    });

  } catch (error) {
    console.error('OCR 识别失败:', error);
    
    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: '文字识别失败: ' + error.message
    });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(port, () => {
  console.log(`OCR 服务运行在 http://localhost:${port}`);
});