1. 创建目录：

bash
mkdir public\tesseract-data
2. 下载以下两个文件，放到 public\tesseract-data\ 目录下：

中文简体：https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata

英文：https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata

3. 修改 TesseractOCR.jsx 中的 getWorker 函数：

javascript
// 初始化 Worker（使用本地语言包）
const getWorker = async () => {
  if (!workerRef.current) {
    setStatusText('正在加载OCR引擎...');
    setProgress(10);
    
    try {
      workerRef.current = await Tesseract.createWorker('chi_sim+eng', 1, {
        langPath: '/tesseract-data', // 指向 public/tesseract-data 目录
        logger: (m) => {
          console.log('Tesseract:', m);
          if (m.status === 'loading tesseract core') {
            setProgress(30);
            setStatusText('加载核心引擎...');
          } else if (m.status === 'initializing tesseract') {
            setProgress(50);
            setStatusText('初始化引擎...');
          } else if (m.status === 'loading language traineddata') {
            setProgress(70);
            setStatusText('加载本地语言包...');
          } else if (m.status === 'loaded language traineddata') {
            setProgress(90);
            setStatusText('语言包加载完成');
          } else if (m.status === 'initializing api') {
            setProgress(95);
            setStatusText('初始化API...');
          } else if (m.status === 'recognizing text') {
            setProgress(m.progress * 100);
            setStatusText(`识别中... ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      setProgress(100);
      setStatusText('准备就绪');
    } catch (error) {
      console.error('Worker 初始化失败:', error);
      throw new Error('OCR引擎初始化失败，请检查语言包文件是否存在');
    }
  }
  return workerRef.current;
};
方法三最简单可靠，直接下载两个文件放到 public/tesseract-data/ 目录下，然后配置 langPath: '/tesseract-data' 就行了，不需要安装任何 npm 包