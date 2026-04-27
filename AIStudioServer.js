const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 飞桨AI Studio配置
const PADDLE_CONFIG = {
    apiUrl: 'https://xeg5tdc0g4x3o0r6.aistudio-app.com/layout-parsing',
    accessToken: 'c677bed1a3f4e8071c03c4adf361918cd47aae03'
};

// OCR代理接口
app.post('/api/ocr', async (req, res) => {
    try {
        const { image, type = 'ocr' } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: '缺少图片数据' });
        }
        
        const payload = {
            file: image,
            fileType: 1,
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useChartRecognition: false
        };
        
        console.log('发送请求到PP-OCRv5 API...');
        
        const response = await axios.post(PADDLE_CONFIG.apiUrl, payload, {
            headers: {
                'Authorization': `token ${PADDLE_CONFIG.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        // 打印返回数据的结构
        console.log('API返回状态码:', response.status);
        console.log('返回数据的keys:', Object.keys(response.data));
        console.log('返回数据预览:', JSON.stringify(response.data).substring(0, 500));
        
        // 直接返回原始数据，不做转换
        res.json(response.data);
        
    } catch (error) {
        console.error('OCR API错误:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            res.status(401).json({
                error_code: 401,
                error_msg: 'Token无效或已过期，请在飞桨AI Studio重新获取Token'
            });
        } else {
            res.status(error.response?.status || 500).json({
                error_code: -1,
                error_msg: error.response?.data?.errorMsg || error.message
            });
        }
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'PP-OCRv5 Proxy'
    });
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║       飞桨AI Studio - PP-OCRv5 代理服务器已启动                    ║
╠══════════════════════════════════════════════════════════════════╣
║  端口: ${PORT}                                                      ║
║  OCR接口: http://localhost:${PORT}/api/ocr                         ║
╚══════════════════════════════════════════════════════════════════╝
    `);
});