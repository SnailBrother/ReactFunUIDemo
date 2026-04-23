#!/usr/bin/env python3
import sys
import json
import warnings
warnings.filterwarnings('ignore')

from paddleocr import PaddleOCR

# 初始化 PaddleOCR（中文模型）
print("正在初始化 PaddleOCR...", file=sys.stderr)
ocr = PaddleOCR(
    lang='ch',  # 使用中文模型
    use_angle_cls=False,  # 关闭角度分类，提高速度
    show_log=False  # 关闭日志
)
print("PaddleOCR 初始化完成", file=sys.stderr)

def ocr_image(image_path):
    """识别图片中的文字"""
    print(f"正在识别图片: {image_path}", file=sys.stderr)
    
    # 执行 OCR
    result = ocr.ocr(image_path, cls=False)
    
    if not result or not result[0]:
        return {
            'text': '',
            'lines': [],
            'raw_text': ''
        }
    
    texts = []
    lines = []
    
    print("\n========== PaddleOCR 识别结果 ==========", file=sys.stderr)
    for idx, line in enumerate(result[0]):
        # line 格式: [[[x1,y1], [x2,y2], [x3,y3], [x4,y4]], [text, confidence]]
        bbox_points = line[0]
        text = line[1][0]
        confidence = line[1][1]
        
        texts.append(text)
        lines.append({
            'text': text,
            'confidence': float(confidence),
            'bbox': [[int(x), int(y)] for x, y in bbox_points]
        })
        
        print(f"[{idx+1}] 文本: {text}", file=sys.stderr)
        print(f"    置信度: {confidence:.4f}", file=sys.stderr)
    
    print("=====================================\n", file=sys.stderr)
    print(f"总共识别到 {len(result[0])} 个文本块", file=sys.stderr)
    
    full_text = '\n'.join(texts)
    print(f"完整文本:\n{full_text}", file=sys.stderr)
    
    return {
        'text': full_text,
        'lines': lines,
        'raw_text': ' '.join(texts)
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No image path provided'}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    try:
        result = ocr_image(image_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)