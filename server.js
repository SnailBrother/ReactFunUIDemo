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
    accessToken: '4df69cfd910022d78aa8f95733ec4bbe83f040b9'
};

// AI大模型配置
const AI_MODEL_CONFIG = {
    apiUrl: 'https://aistudio.baidu.com/llm/lmapi/v3/chat/completions',
    accessToken: '4df69cfd910022d78aa8f95733ec4bbe83f040b9',
    model: 'ernie-4.5-0.3b',
    temperature: 0.1,
    maxTokens: 2000,
    topP: 0.8
};

// 从OCR结果中提取纯文本
function extractTextFromOCRResult(result) {
    let fullText = '';

    try {
        if (result && typeof result === 'object') {
            let dataSource = result.result || result.data || result;

            if (typeof dataSource === 'string') {
                try { dataSource = JSON.parse(dataSource); } catch (e) { fullText = dataSource; }
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
                                    fullText += item[1] + '\n';
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

// 在 extractTextFromOCRResult 函数最后的 return 语句中修改
return fullText
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ')
    // ===== 新增：清理LaTeX格式 =====
    .replace(/\$\s*/g, '')                        // 移除 $ 符号
    .replace(/\\,/g, '')                           // 移除 \,
    .replace(/\\;/g, '')                           // 移除 \;
    .replace(/m\s*\^\s*\{2\}\s*/g, 'm²')          // m^{2} -> m²
    .replace(/m\s*\^\s*2\b/g, 'm²')               // m^2 -> m²
    .replace(/\^\s*\{2\}\s*/g, '²')               // ^{2} -> ²
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')        // \mathrm{xxx} -> xxx
    .replace(/\\text\{([^}]+)\}/g, '$1')          // \text{xxx} -> xxx
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')        // \mathbf{xxx} -> xxx
    .replace(/\\+/g, '')                           // 移除剩余的 \
    .replace(/\s+/g, ' ')                          // 合并多余空格
    .replace(/(\d+\.?\d*)\s+(m²|㎡|平方米)/g, '$1$2'); // 数字和单位之间去空格

}

// 从HTML表格中提取基础数据（用于给AI提供结构化参考）
function extractFromHTMLTable(text) {
    const result = {};
    
    const certMatch = text.match(/渝\s*[（(]\s*\d{4}\s*[）)]\s*[\u4e00-\u9fa5]+(?:区|县|市)\s*不动产权\s*第\s*\d+\s*号/);
    if (certMatch) {
        result.产权证号 = certMatch[0].replace(/\s+/g, '');
    }

    const rowPattern = /<tr>(.*?)<\/tr>/gi;
    let rowMatch;
    
    const fieldMap = {
        '权利人': '权利人',
        '共有情况': '共有情况',
        '坐落': '坐落',
        '不动产单元号': '不动产单元号',
        '权利类型': '权利类型',
        '权利性质': '权利性质',
        '用途': '用途',
        '面积': '面积',
        '使用期限': '使用期限',
        '权利其他状况': '权利其他状况'
    };

    while ((rowMatch = rowPattern.exec(text)) !== null) {
        const rowContent = rowMatch[1];
        const tdPattern = /<td[^>]*>(.*?)<\/td>/gi;
        const cells = [];
        let tdMatch;
        
        while ((tdMatch = tdPattern.exec(rowContent)) !== null) {
            let content = tdMatch[1]
                .replace(/<[^>]+>/g, '')
                .replace(/&nbsp;/g, ' ')
                .trim();
            cells.push(content);
        }

        if (cells.length >= 2) {
            const key = cells[0];
            const value = cells.filter(c => c.trim()).pop() || '';
            
            if (fieldMap[key]) {
                result[fieldMap[key]] = value;
            }
        }
    }

    return result;
}

// ========== 从权利其他状况文本中正则提取子字段（兜底方案） ==========
function extractFromOtherRights(text) {
    const result = {};
    
    if (!text) return result;

    // 身份证号
    const idMatch = text.match(/(?:身份证|身份证号|身份证号码)[：:]*\s*(\d{15,18}[Xx]?)/i);
    if (idMatch) result.身份证号 = idMatch[1];

    // 营业执照
    const bizMatch = text.match(/(?:营业执照|执照)(?:号)?[：:]*\s*([0-9A-Za-z]+)/i);
    if (bizMatch) result.营业执照 = bizMatch[1];

    // 房屋结构
    const structMatch = text.match(/房屋结构[：:]\s*([^，,；;。]+)/);
    if (structMatch) result.房屋结构 = structMatch[1].trim();

    // 套内面积
    const areaMatch = text.match(/(?:专有建筑面积|套内面积)\s*(?:[（(][^）)]*[）)])?\s*[：:]*\s*(\d+\.?\d*)\s*(?:平方米|㎡|m²)?/);
    if (areaMatch) result.套内面积 = areaMatch[1] + '平方米';

    // 所在楼层
    const floorMatch = text.match(/(?:所在楼层|楼层|名义层)\s*(?:[（(][^）)]*[）)])?\s*[：:]*\s*([^，,；;。]+)/);
    if (floorMatch) result.所在楼层 = floorMatch[1].trim();

    // 业务编号
    const bizNumMatch = text.match(/业务编号[：:]*\s*(\d+)/);
    if (bizNumMatch) result.业务编号 = bizNumMatch[1];

    return result;
}


// ========== AI提取不动产信息 ==========
async function extractPropertyInfoWithAI(text, htmlExtracted) {
    // 预处理：清理文本，方便AI识别
    const cleanedText = text
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 8000);

    // 构建结构化的参考信息
    let referenceInfo = '';
    if (htmlExtracted && Object.keys(htmlExtracted).length > 0) {
        referenceInfo = `\n【HTML表格提取的参考数据】\n${JSON.stringify(htmlExtracted, null, 2)}\n`;
        if (htmlExtracted.权利其他状况) {
            referenceInfo += `\n【重要】请特别注意解析"权利其他状况"字段的内容：\n"${htmlExtracted.权利其他状况}"\n`;
        }
    }

    const systemPrompt = `你是不动产证信息提取专家。请从文本中提取所有字段，返回纯JSON对象（不要markdown代码块标记）。

【必须返回的JSON格式】：
{"产权证号":"","权利人":"","共有情况":"","坐落":"","不动产单元号":"","权利类型":"","权利性质":"","用途":"","面积":"","使用期限":"","房屋结构":"","套内面积":"","所在楼层":"","业务编号":"","营业执照":"","身份证号":""}

【关键提取规则】：
1. "权利其他状况"字段中包含了：身份证号、房屋结构、套内面积、所在楼层、业务编号、营业执照
   你必须把它们分别提取到对应的根级字段中！

2. 实际案例示范：
   输入："权利其他状况": "身份证：51022219660604403X，房屋结构：钢筋混凝土结构，专有建筑面积（套内面积）：166.63平方米，所在楼层（名义层）：13层，业务编号：201604281021090"
   你应该返回：
   - "身份证号": "51022219660604403X"
   - "房屋结构": "钢筋混凝土结构"
   - "套内面积": "166.63平方米"
   - "所在楼层": "13层"
   - "业务编号": "201604281021090"

3. 不动产单元号要完整，如"500105 007002 G800219 F80030090"，不要截断

4. 面积格式如"共有宗地面积25984.2m²/房屋建筑面积206.97m²"

5. 使用期限如"国有建设用地使用权2061年12月19日止"

6. 未找到的字段设为空字符串""

7. 不要返回"权利其他状况"字段，将其拆解到对应的根级字段`;

    const userMessage = `请提取以下不动产证信息：\n\n${cleanedText}${referenceInfo}\n\n请务必拆解"权利其他状况"中的内容到对应字段！`;

    try {
        console.log('发送AI请求...');
        
        const response = await axios.post(
            AI_MODEL_CONFIG.apiUrl,
            {
                model: AI_MODEL_CONFIG.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                stream: false,
                extra_body: { penalty_score: 1 },
                max_completion_tokens: 2000,
                temperature: 0.05,  // 极低温度，提高确定性
                top_p: 0.8,
                frequency_penalty: 0,
                presence_penalty: 0
            },
            {
                headers: {
                    'Authorization': `Bearer ${AI_MODEL_CONFIG.accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 1800000
            }
        );

        const aiContent = response.data.choices?.[0]?.message?.content;
        if (!aiContent) throw new Error('AI未能返回有效内容');

        console.log('AI原始返回:\n' + aiContent);

        // 解析JSON
        let parsedData = null;
        
        // 尝试多种方式解析
        const parseAttempts = [
            // 方式1：直接解析
            () => JSON.parse(aiContent),
            // 方式2：去掉markdown标记
            () => JSON.parse(aiContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()),
            // 方式3：提取JSON对象
            () => {
                const match = aiContent.match(/\{[\s\S]*\}/);
                return match ? JSON.parse(match[0]) : null;
            }
        ];

        for (const attempt of parseAttempts) {
            try {
                parsedData = attempt();
                if (parsedData && typeof parsedData === 'object') break;
            } catch (e) {
                continue;
            }
        }

        if (!parsedData) {
            console.error('所有JSON解析方式都失败了');
            return null;
        }

        console.log('解析后的数据:', JSON.stringify(parsedData, null, 2));

        // 如果AI返回了"权利其他状况"，从中提取子字段
        if (parsedData.权利其他状况 && typeof parsedData.权利其他状况 === 'string' && parsedData.权利其他状况.trim()) {
            console.log('AI返回了权利其他状况，从中提取子字段...');
            const extracted = extractFromOtherRights(parsedData.权利其他状况);
            for (const [key, value] of Object.entries(extracted)) {
                if (!parsedData[key] || parsedData[key] === '') {
                    parsedData[key] = value;
                }
            }
        }

        // 确保所有字段都存在
        const defaultFields = [
            '产权证号', '权利人', '共有情况', '坐落', '不动产单元号',
            '权利类型', '权利性质', '用途', '面积', '使用期限',
            '房屋结构', '套内面积', '所在楼层', '业务编号', '营业执照', '身份证号'
        ];

        defaultFields.forEach(field => {
            if (!parsedData[field] || parsedData[field] === undefined) {
                parsedData[field] = '';
                console.log(`字段 "${field}" 为空，已设置为空字符串`);
            }
        });

        // 删除权利其他状况
        delete parsedData.权利其他状况;

        return parsedData;

    } catch (error) {
        console.error('AI提取错误:', error.message);
        return null;
    }
}

// ========== 统一OCR+AI提取接口 ==========
// ========== 统一OCR+AI提取接口 ==========
app.post('/api/ocr-and-extract', async (req, res) => {
    try {
        const { image } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: '缺少图片数据' });
        }

        console.log('\n========================================');
        console.log('步骤1: 调用OCR识别...');
        console.log('========================================');
        
        // 1. OCR识别
        const ocrResponse = await axios.post(PADDLE_CONFIG.apiUrl, {
            file: image,
            fileType: 1,
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useChartRecognition: false
        }, {
            headers: {
                'Authorization': `token ${PADDLE_CONFIG.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 1800000
        });

        console.log('OCR识别完成！');

        // 2. 提取文本
        const rawText = extractTextFromOCRResult(ocrResponse.data);
        
        console.log('========================================');
        console.log('提取的纯文本内容：');
        console.log('========================================');
        console.log(rawText);
        console.log('========================================\n');

        // ========== 新增：检查是否包含不动产证关键字 ==========
        const keywords = ['坐落', '权利人', '面积', '不动产', '产权证', '共有', '权利'];
        const hasKeywords = keywords.some(keyword => rawText.includes(keyword));
        
        if (!hasKeywords) {
            console.log('⚠️ 未检测到不动产证关键字，跳过AI提取，返回空数据');
            console.log('========================================\n');
            
            const emptyData = {
                产权证号: '', 权利人: '', 共有情况: '', 坐落: '',
                不动产单元号: '', 权利类型: '', 权利性质: '', 用途: '',
                面积: '', 使用期限: '', 房屋结构: '', 套内面积: '',
                所在楼层: '', 业务编号: '', 营业执照: '', 身份证号: ''
            };
            
            return res.json({
                success: true,
                data: emptyData,
                rawText: rawText,
                ocrResult: ocrResponse.data,
                skipped: true,
                reason: '未检测到不动产证关键字'
            });
        }
        
        console.log('✅ 检测到不动产证关键字，继续处理...\n');

        // 3. 从HTML表格中提取基础数据（作为AI的参考）
        const htmlExtracted = extractFromHTMLTable(rawText);
        console.log('HTML表格提取的参考数据:');
        console.log(JSON.stringify(htmlExtracted, null, 2));
        console.log('');

        // 4. AI提取（主要方案）
        console.log('========================================');
        console.log('步骤2: AI提取不动产信息...');
        console.log('========================================');
        
        let propertyInfo = await extractPropertyInfoWithAI(rawText, htmlExtracted);

        // 5. 如果AI失败，用HTML提取+正则兜底
        if (!propertyInfo) {
            console.log('⚠️ AI提取失败，使用HTML提取+正则兜底...');
            
            const otherRightsText = htmlExtracted.权利其他状况 || '';
            const otherRightsData = extractFromOtherRights(otherRightsText);
            
            propertyInfo = {
                产权证号: htmlExtracted.产权证号 || '',
                权利人: htmlExtracted.权利人 || '',
                共有情况: htmlExtracted.共有情况 || '',
                坐落: htmlExtracted.坐落 || '',
                不动产单元号: htmlExtracted.不动产单元号 || '',
                权利类型: htmlExtracted.权利类型 || '',
                权利性质: htmlExtracted.权利性质 || '',
                用途: htmlExtracted.用途 || '',
                面积: htmlExtracted.面积 || '',
                使用期限: htmlExtracted.使用期限 || '',
                房屋结构: otherRightsData.房屋结构 || '',
                套内面积: otherRightsData.套内面积 || '',
                所在楼层: otherRightsData.所在楼层 || '',
                业务编号: otherRightsData.业务编号 || '',
                营业执照: otherRightsData.营业执照 || '',
                身份证号: otherRightsData.身份证号 || ''
            };
        }

        console.log('\n========================================');
        console.log('✅ 最终提取结果:');
        console.log('========================================');
        console.log(JSON.stringify(propertyInfo, null, 2));
        console.log('========================================\n');

        // 6. 返回结果
        res.json({
            success: true,
            data: propertyInfo,
            rawText: rawText,
            ocrResult: ocrResponse.data
        });

    } catch (error) {
        console.error('\n❌ 处理错误:', error.message);
        console.error('错误详情:', error.response?.data || error);
        
        res.status(500).json({
            success: false,
            error: '处理失败：' + error.message,
            data: {
                产权证号: '', 权利人: '', 共有情况: '', 坐落: '',
                不动产单元号: '', 权利类型: '', 权利性质: '', 用途: '',
                面积: '', 使用期限: '', 房屋结构: '', 套内面积: '',
                所在楼层: '', 业务编号: '', 营业执照: '', 身份证号: ''
            }
        });
    }
});

// OCR接口（兼容）
app.post('/api/ocr', async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: '缺少图片数据' });
        
        const response = await axios.post(PADDLE_CONFIG.apiUrl, {
            file: image,
            fileType: 1,
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useChartRecognition: false
        }, {
            headers: {
                'Authorization': `token ${PADDLE_CONFIG.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 1800000
        });
        
        res.json(response.data);
    } catch (error) {
        console.error('OCR API错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║       不动产信息提取服务 - 已启动                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  端口: ${PORT}                                                      ║
║  OCR+提取接口:  http://localhost:${PORT}/api/ocr-and-extract       ║
║  策略: AI提取 + 正则兜底（双重保障）                               ║
╚══════════════════════════════════════════════════════════════════╝
    `);
});