// propertyParser.js - 修正所在楼层匹配
export const parsePropertyInfo = (text, sourceFile = '') => {
  if (!text || !text.trim()) return null;

  console.log('开始解析文本:', text.substring(0, 300));

  const result = {
    产权证号: '',
    权利人: '',
    共有情况: '',
    坐落: '',
    不动产单元号: '',
    权利类型: '',
    权利性质: '',
    用途: '',
    面积: '',
    使用期限: '',
    房屋结构: '',
    套内面积: '',
    所在楼层: '',
    业务编号: '',
    营业执照: '',
    身份证号: '',
    sourceFile: sourceFile
  };

  // 首先检查是否包含HTML表格
  if (text.includes('<table') && text.includes('<td')) {
    parseHTMLTable(text, result);
  }
  
  // 然后提取产权证号（可能不在表格中）
  if (!result.产权证号) {
    result.产权证号 = extractCertNumber(text);
  }
  
  // 如果HTML解析没有完全成功，再尝试普通文本解析
  if (!result.权利人 && !result.坐落) {
    parsePlainText(text, result);
  }
  
  // 清理所有字段中的特殊格式
  for (const key in result) {
    if (typeof result[key] === 'string') {
      result[key] = cleanFormatting(result[key]);
    }
  }

  console.log('解析结果:', result);
  
  // 检查是否提取到关键信息
  const hasKeyInfo = result.产权证号 || result.权利人 || result.坐落;
  return hasKeyInfo ? result : null;
};

// 清理文本中的特殊格式
function cleanFormatting(text) {
  if (!text) return '';
  
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\$\s*/g, '')
    .replace(/\\,/g, '')
    .replace(/\\;/g, '')
    .replace(/\\:/g, '')
    .replace(/\\!/g, '')
    .replace(/m\^\{2\}/g, '㎡')
    .replace(/m\^2/g, '㎡')
    .replace(/\^\{2\}/g, '²')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\mathit\{([^}]+)\}/g, '$1')
    .replace(/\\displaystyle/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
    .replace(/\\+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/(\d+\.?\d*)\s+㎡/g, '$1㎡')
    .replace(/(\d+\.?\d*)\s+m²/g, '$1m²')
    .replace(/(\d+\.?\d*)\s+平方米/g, '$1平方米')
    .replace(/\s*，\s*/g, '，')
    .replace(/\s*。\s*/g, '。')
    .replace(/\s*；\s*/g, '；')
    .replace(/\s*：\s*/g, '：')
    .replace(/\s*、\s*/g, '、')
    .replace(/\/\s*/g, '/')
    .replace(/\s*\//g, '/')
    .trim();
}
 
// 解析 HTML 表格（兼容 colspan 和 多列 结构）
function parseHTMLTable(text, result) {
  const rowPattern = /<tr>(.*?)<\/tr>/gi;
  const rows = [];
  let rowMatch;
  
  while ((rowMatch = rowPattern.exec(text)) !== null) {
    rows.push(rowMatch[1]);
  }
  
  const fieldMapping = {
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
  
  for (const row of rows) {
    // 提取所有 td 内容
    const tdPattern = /<td[^>]*>(.*?)<\/td>/gi;
    const cells = [];
    let tdMatch;
    
    while ((tdMatch = tdPattern.exec(row)) !== null) {
      let content = tdMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
      cells.push(content);
    }
    
    if (cells.length >= 2) {
      // 字段名总是在第一个有效单元格
      const keyCandidate = cells[0].trim();
      
      // 映射字段
      if (fieldMapping[keyCandidate]) {
        // 值取最后一个非空单元格，兼容"空列"导致的错位
        const value = cells
          .slice(1)
          .filter(cell => cell.trim() !== '')
          .pop() || '';
        
        if (keyCandidate === '面积') {
          result[fieldMapping[keyCandidate]] = cleanAreaFormat(value);
        } else if (keyCandidate === '权利其他状况') {
          result[fieldMapping[keyCandidate]] = value;
          parseAdditionalRights(value, result);
        } else {
          result[fieldMapping[keyCandidate]] = value;
        }
      }
    }
  }
}

// 特殊清理面积格式
function cleanAreaFormat(areaText) {
  if (!areaText) return '';
  
  let cleaned = areaText
    .replace(/\$\s*/g, '')
    .replace(/\\,/g, '')
    .replace(/\\;/g, '')
    .replace(/m\^\{2\}/g, '㎡')
    .replace(/m\^2/g, '㎡')
    .replace(/\^\{2\}/g, '²')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const landMatch = cleaned.match(/共有宗地面积\s*(\d+\.?\d*)\s*(?:㎡|m²|平方米)?/i);
  const buildingMatch = cleaned.match(/房屋建筑面积\s*(\d+\.?\d*)\s*(?:㎡|m²|平方米)?/i);
  
  if (landMatch && buildingMatch) {
    return `共有宗地面积${landMatch[1]}㎡/房屋建筑面积${buildingMatch[1]}㎡`;
  }
  
  const landMatch2 = cleaned.match(/宗地面积\s*(\d+\.?\d*)/i);
  const buildingMatch2 = cleaned.match(/建筑面积\s*(\d+\.?\d*)/i);
  
  if (landMatch2 && buildingMatch2) {
    return `共有宗地面积${landMatch2[1]}㎡/房屋建筑面积${buildingMatch2[1]}㎡`;
  }
  
  cleaned = cleaned
    .replace(/\/\s*/g, '/')
    .replace(/\s*\//g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned;
}

// 解析权利其他状况中的详细信息（修正版 - 修复所在楼层匹配）
function parseAdditionalRights(text, result) {
  let cleanText = text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n')
    .trim();
  
  console.log('解析权利其他状况原始文本:', cleanText);
  
  // 分割文本
  let segments = [];
  
  // 方式1：按数字序号分割（如：1、2、3、 或 1. 2. 3.）
  if (/\d[、．.]/.test(cleanText)) {
    segments = cleanText.split(/\d[、．.]\s*/).filter(s => s.trim());
    // 移除第一个空段（如果存在）
    if (segments.length > 0 && segments[0].length === 0) {
      segments.shift();
    }
  }
  
  if (segments.length <= 1) {
    if (cleanText.includes('；') || cleanText.includes(';')) {
      segments = cleanText.split(/[；;]/).filter(s => s.trim());
    } else {
      segments = cleanText.split(/\n+/).filter(s => s.trim());
    }
  }
  
  if (segments.length <= 1) {
    segments = [cleanText];
  }
  
  console.log('分割后的段落:', segments);
  
  // 遍历每个段落进行匹配
  for (const segment of segments) {
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) continue;
    
    console.log('处理段落:', trimmedSegment);
    
    // 解析身份证号
    if (!result.身份证号) {
      let idMatch = trimmedSegment.match(/身份证(?:号|号码)?\s*[：:]\s*(\d{15,18}[Xx]?)/);
      if (idMatch) {
        result.身份证号 = idMatch[1].trim();
        console.log('找到身份证号:', result.身份证号);
      }
    }
    
    // 解析营业执照
    if (!result.营业执照) {
      let bizMatch = trimmedSegment.match(/营业执照(?:号)?\s*[：:]\s*([0-9A-Za-z]+)/);
      if (!bizMatch) {
        bizMatch = trimmedSegment.match(/执照\s*[：:]\s*([0-9A-Za-z]+)/);
      }
      if (bizMatch) {
        result.营业执照 = bizMatch[1].trim();
        console.log('找到营业执照:', result.营业执照);
      }
    }
    
    // 解析房屋结构
    if (!result.房屋结构) {
      let structureMatch = trimmedSegment.match(/房屋结构\s*[：:]\s*([^；;，,\d\n]+)/);
      if (!structureMatch) {
        structureMatch = trimmedSegment.match(/房屋结构\s+([^；;，,\d\n]+)/);
      }
      if (!structureMatch) {
        structureMatch = trimmedSegment.match(/结构\s*[：:]\s*([^；;，,\d\n]+)/);
      }
      if (structureMatch) {
        result.房屋结构 = structureMatch[1].trim();
        console.log('找到房屋结构:', result.房屋结构);
      }
    }
    
    // 解析套内面积
    if (!result.套内面积) {
      let areaMatch = trimmedSegment.match(/(?:专有建筑面积|套内面积)\s*(?:[（(][^）)]*[）)])?\s*[：:]\s*(\d+\.?\d*)\s*(?:平方米|㎡|m²)?/);
      if (!areaMatch) {
        areaMatch = trimmedSegment.match(/套内面积\s+(\d+\.?\d*)\s*(?:平方米|㎡|m²)?/);
      }
      if (!areaMatch) {
        areaMatch = trimmedSegment.match(/专有建筑面积\s+(\d+\.?\d*)\s*(?:平方米|㎡|m²)?/);
      }
      if (areaMatch) {
        result.套内面积 = areaMatch[1] + '平方米';
        console.log('找到套内面积:', result.套内面积);
      }
    }
    
    // 解析所在楼层 - 修复：支持以数字开头的格式
    if (!result.所在楼层) {
      // 格式1：所在楼层（名义层）：1、2、3层
      let floorMatch = trimmedSegment.match(/所在楼层\s*(?:[（(][^）)]*[）)])?\s*[：:]\s*([^；;，,\n]+)/);
      if (!floorMatch) {
        // 格式2：所在楼层（名义层） 1、2、3层
        floorMatch = trimmedSegment.match(/所在楼层\s*(?:[（(][^）)]*[）)])?\s+([^；;，,\n]+)/);
      }
      if (!floorMatch) {
        // 格式3：楼层：1、2、3层
        floorMatch = trimmedSegment.match(/楼层\s*[：:]\s*([^；;，,\n]+)/);
      }
      if (!floorMatch) {
        // 格式4：名义层：1、2、3层
        floorMatch = trimmedSegment.match(/名义层\s*[）)]?\s*[：:]\s*([^；;，,\n]+)/);
      }
      if (floorMatch) {
        let floorValue = floorMatch[1].trim();
        // 清理末尾的句号、分号等
        floorValue = floorValue.replace(/[。；;，,]$/, '').trim();
        result.所在楼层 = floorValue;
        console.log('找到所在楼层:', result.所在楼层);
      }
    }
    
    // 解析业务编号
    if (!result.业务编号) {
      let bizMatch = trimmedSegment.match(/业务编号\s*[：:]\s*(\d+)/);
      if (!bizMatch) {
        bizMatch = trimmedSegment.match(/业务号\s*[：:]\s*(\d+)/);
      }
      if (bizMatch) {
        result.业务编号 = bizMatch[1].replace(/[号。]$/, '').trim();
        console.log('找到业务编号:', result.业务编号);
      }
    }
  }
  
  // 全局搜索兜底
  if (!result.房屋结构) {
    const m = cleanText.match(/房屋结构\s*[：:\s]+([^；;，,\d\n]{2,})/);
    if (m) result.房屋结构 = m[1].trim();
  }
  
  if (!result.套内面积) {
    const m = cleanText.match(/(?:套内面积|专有建筑面积)\s*[：:\s]*(\d+\.?\d*)\s*(?:平方米|㎡|m²)?/);
    if (m) result.套内面积 = m[1] + '平方米';
  }
  
  if (!result.所在楼层) {
    // 修正：更灵活的匹配，支持以数字开头
    const m = cleanText.match(/(?:所在楼层|楼层|名义层)\s*(?:[（(][^）)]*[）)])?\s*[：:\s]+([^；;，\n]+)/);
    if (m) {
      let floorValue = m[1].trim();
      floorValue = floorValue.replace(/[。；;，,]$/, '').trim();
      result.所在楼层 = floorValue;
    }
  }
  
  if (!result.业务编号) {
    const m = cleanText.match(/业务编号\s*[：:\s]*(\d+)/);
    if (m) result.业务编号 = m[1].replace(/[号。]$/, '').trim();
  }
  
  console.log('权利其他状况解析完成:', {
    房屋结构: result.房屋结构,
    套内面积: result.套内面积,
    所在楼层: result.所在楼层,
    业务编号: result.业务编号,
    身份证号: result.身份证号,
    营业执照: result.营业执照
  });
}

// 解析普通文本（备用方案）
function parsePlainText(text, result) {
  const cleanedText = cleanFormatting(text);
  
  const patterns = {
    权利人: /权利人\s*[：:]\s*([^\s\\n]+)/i,
    共有情况: /共有情况\s*[：:]\s*([^\s\\n]+)/i,
    坐落: /坐落\s*[：:]\s*([^\\n]+?)(?=\s*(不动产单元号|权利类型|$))/i,
    不动产单元号: /不动产单元号\s*[：:]\s*([A-Za-z0-9\s\-/]+)/i,
    权利类型: /权利类型\s*[：:]\s*([^\\n]+?)(?=\s*(权利性质|用途|$))/i,
    权利性质: /权利性质\s*[：:]\s*([^\\n]+?)(?=\s*(用途|面积|$))/i,
    用途: /用途\s*[：:]\s*([^\\n]+?)(?=\s*(面积|使用期限|$))/i,
    面积: /面积\s*[：:]\s*([^\\n]+?)(?=\s*(使用期限|$))/i,
    使用期限: /使用期限\s*[：:]\s*([^\\n]+?)(?=\s*(权利其他|房屋结构|$))/i
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    if (!result[key] || result[key] === '') {
      const match = cleanedText.match(pattern);
      if (match) {
        if (key === '面积') {
          result[key] = cleanAreaFormat(match[1].trim());
        } else {
          result[key] = match[1].trim();
        }
      }
    }
  }
}

// 提取产权证号
function extractCertNumber(text) {
  const cleanText = cleanFormatting(text);
  
  const standardPattern = /渝\s*[（(]\s*(\d{4})\s*[）)]\s*([\u4e00-\u9fa5]+(?:区|县|市))\s*不动产权\s*第\s*(\d+)\s*号/i;
  const standardMatch = cleanText.match(standardPattern);
  
  if (standardMatch) {
    return `渝（${standardMatch[1]}）${standardMatch[2]}不动产权第${standardMatch[3]}号`;
  }
  
  const yearMatch = cleanText.match(/渝\s*[（(]?\s*(\d{4})/);
  const areaMatch = cleanText.match(/[）)]?\s*([\u4e00-\u9fa5]{2,3}(?:区|县|市))\s*不动产权/);
  const numMatch = cleanText.match(/不动产权\s*第\s*(\d+)/);
  
  if (yearMatch && areaMatch && numMatch) {
    return `渝（${yearMatch[1]}）${areaMatch[1]}不动产权第${numMatch[1]}号`;
  }
  
  const certMatch = cleanText.match(/[渝渝]\s*[（(]\d{4}[）)][\u4e00-\u9fa5]+不动产权第\d+号/i);
  if (certMatch) {
    return certMatch[0].replace(/[\s<>]/g, '');
  }
  
  return '';
}