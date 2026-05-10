import React, { useState, useRef, useCallback } from 'react';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import styles from './index.module.css';

const WordEditor = () => {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    date: '',
    summary: ''
  });

  const [loading, setLoading] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const editorRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditorChange = (e) => {
    setEditorContent(e.target.innerHTML);
  };

  // 从HTML中提取纯文本段落
  const extractParagraphs = (html) => {
    if (!html) return [];
    
    const div = document.createElement('div');
    div.innerHTML = html;
    
    const paragraphs = [];
    
    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          paragraphs.push(text);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tagName)) {
          const text = node.textContent.trim();
          if (text) {
            const lines = text.split('\n');
            lines.forEach(line => {
              const trimmed = line.trim();
              if (trimmed) {
                paragraphs.push(trimmed);
              }
            });
          }
        } else {
          Array.from(node.childNodes).forEach(child => processNode(child));
        }
      }
    };
    
    Array.from(div.childNodes).forEach(child => processNode(child));
    
    return paragraphs.filter(p => p !== '');
  };

 

  const generateWord = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/template.docx');
      
      if (!response.ok) {
        throw new Error('模板文件不存在，请在public文件夹放置template.docx');
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      const zip = new PizZip(arrayBuffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '',
      });

      const paragraphs = extractParagraphs(editorContent);
      
      console.log('提取的段落:', paragraphs);

      // 直接使用字符串数组
      const data = {
        title: formData.title || '未命名文档',
        author: formData.author || '匿名',
        date: formData.date || new Date().toLocaleDateString('zh-CN'),
        summary: formData.summary || '暂无摘要',
        paragraphs: paragraphs
      };

      console.log('替换数据:', data);

      doc.setData(data);

      try {
        doc.render();
        
        const generatedDoc = doc.getZip().generate({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        const fileName = `文档_${formData.title || '未命名'}_${new Date().getTime()}.docx`;
        saveAs(generatedDoc, fileName);
        
        alert('✅ Word文档生成成功！');
      } catch (error) {
        console.error('渲染错误:', error);
        alert('文档渲染失败：' + error.message);
      }
    } catch (error) {
      console.error('生成文档错误:', error);
      alert('生成文档失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setFormData({
      title: '',
      author: '',
      date: '',
      summary: ''
    });
    setEditorContent('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
  };

 
 

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📝 Word文档编辑器</h1>
        
      </div>

      <div className={styles.formContainer}>
        <div className={styles.formGroup}>
          <label className={styles.label}>
            文档标题
            <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className={styles.input}
            placeholder="请输入文档标题"
          />
          <span className={styles.fieldHint}>对应Word中的 {`{title}`} 字段</span>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>作者</label>
          <input
            type="text"
            name="author"
            value={formData.author}
            onChange={handleInputChange}
            className={styles.input}
            placeholder="请输入作者姓名"
          />
          <span className={styles.fieldHint}>对应Word中的 {`{author}`} 字段</span>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>日期</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleInputChange}
            className={styles.input}
          />
          <span className={styles.fieldHint}>对应Word中的 {`{date}`} 字段</span>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>摘要</label>
          <textarea
            name="summary"
            value={formData.summary}
            onChange={handleInputChange}
            className={styles.textarea}
            placeholder="请输入文档摘要"
            rows={3}
          />
          <span className={styles.fieldHint}>对应Word中的 {`{summary}`} 字段</span>
        </div>

        <div className={styles.formGroup}>
          <div className={styles.editorHeader}>
            <label className={styles.label}>
              主要内容
              <span className={styles.required}>*</span>
            </label>
           
          </div>
          
 
          
          <div
            ref={editorRef}
            contentEditable={true}
            className={styles.editor}
            onInput={handleEditorChange}
            suppressContentEditableWarning={true}
          >
            <p>请在这里输入主要内容...</p>
          </div>
          
          <span className={styles.fieldHint}>
            按Enter键创建新段落，每个段落会在Word中自动编号
          </span>
        </div>

        
        <div className={styles.buttonGroup}>
          <button
            onClick={generateWord}
            disabled={loading}
            className={styles.primaryButton}
          >
            {loading ? '⏳ 生成中...' : '🚀 生成并下载Word文档'}
          </button>
          
          <button
            onClick={clearForm}
            className={styles.secondaryButton}
            disabled={loading}
          >
            🗑️ 清空表单
          </button>
        </div>
      </div>

      <div className={styles.helpSection}>
        <h3 className={styles.helpTitle}>📖 模板设置说明</h3>
        <div className={styles.templateTip}>
          <p className={styles.important}>Word模板必须使用以下格式：</p>
          <pre className={styles.templateExample}>
{`标题-{title}
作者-{author}
日期-{date}
摘要-{summary}
主要内容
{#paragraphs}
{.}
{/paragraphs}`}
          </pre>
          <p>设置步骤：</p>
          <ol>
            <li>在Word中输入上述内容</li>
            <li>选中 <code>{`{.}`}</code> 这一行</li>
            <li>点击"开始"→"段落"→"编号"设置自动编号</li>
            <li>保存为 template.docx 放到 public 文件夹</li>
          </ol>
          <p className={styles.note}>注意：data中的paragraphs直接是字符串数组，不是对象数组</p>
        </div>
      </div>
    </div>
  );
};

export default WordEditor;