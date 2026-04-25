# ocr_service.py - Python OCR服务
from paddleocr import PaddleOCR
import cv2
import numpy as np
import base64

def extract_text_from_image(image_base64):
    # 解码base64图像
    image_bytes = base64.b64decode(image_base64)
    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    
    # 初始化PaddleOCR
    ocr = PaddleOCR(use_angle_cls=True, lang='ch')  # 中文识别
    
    # 执行OCR
    result = ocr.ocr(image, cls=True)
    
    # 提取文本
    extracted_text = []
    total_confidence = 0
    count = 0
    
    for line in result:
        for item in line:
            text = item[1][0]
            confidence = item[1][1]
            extracted_text.append(text)
            total_confidence += confidence
            count += 1
    
    average_confidence = (total_confidence / count * 100) if count > 0 else 0
    
    return {
        'text': '\n'.join(extracted_text),
        'confidence': round(average_confidence, 2)
    }