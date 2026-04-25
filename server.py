from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import os
import uuid
import easyocr

app = Flask(__name__)
CORS(app)

print("正在加载模型...")
reader = easyocr.Reader(['ch_sim', 'en'])  # 中文简体 + 英文
print("模型加载完成！")

UPLOAD_DIR = 'uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.route('/extract', methods=['POST'])
def extract_text():
    data = request.get_json()
    img_base64 = data.get('image')
    
    if ',' in img_base64:
        img_base64 = img_base64.split(',')[1]
    
    image_data = base64.b64decode(img_base64)
    filepath = os.path.join(UPLOAD_DIR, str(uuid.uuid4()) + '.jpg')
    
    with open(filepath, 'wb') as f:
        f.write(image_data)
    
    # 识别文字
    result = reader.readtext(filepath)
    os.remove(filepath)
    
    texts = [item[1] for item in result]
    extracted_text = '\n'.join(texts)
    
    return jsonify({'success': True, 'text': extracted_text})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)