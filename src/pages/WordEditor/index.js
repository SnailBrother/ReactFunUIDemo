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

  const execCommand = useCallback((command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const insertLink = useCallback(() => {
    const url = prompt('请输入链接地址：', 'https://');
    if (url) {
      document.execCommand('createLink', false, url);
    }
  }, []);

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

  const insertExample = () => {
    const exampleHtml = `
      <p>估价对象1 - 这是第一段内容的详细描述</p>
      <p>估价对象2 - 这是第二段内容的详细描述</p>
      <p>估价对象3 - 这是第三段内容的详细描述</p>
      <p>估价对象4 - 这是第四段内容的详细描述</p>
    `;
    
    setEditorContent(exampleHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = exampleHtml;
    }
  };

  const paragraphs = extractParagraphs(editorContent);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📝 Word文档编辑器</h1>
        <p className={styles.subtitle}>填写表单内容，一键生成Word文档</p>
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
            <button
              type="button"
              onClick={insertExample}
              className={styles.exampleButton}
            >
              📋 插入示例
            </button>
          </div>
          
          <div className={styles.toolbar}>
            <button 
              type="button" 
              onClick={() => execCommand('bold')}
              className={styles.toolbarButton}
              title="加粗"
            >
              <strong>B</strong>
            </button>
            <button 
              type="button" 
              onClick={() => execCommand('italic')}
              className={styles.toolbarButton}
              title="斜体"
            >
              <em>I</em>
            </button>
            <button 
              type="button" 
              onClick={() => execCommand('underline')}
              className={styles.toolbarButton}
              title="下划线"
            >
              <u>U</u>
            </button>
            <button 
              type="button" 
              onClick={() => execCommand('strikeThrough')}
              className={styles.toolbarButton}
              title="删除线"
            >
              <s>S</s>
            </button>
            
            <span className={styles.toolbarDivider}></span>
            
            <button 
              type="button" 
              onClick={() => execCommand('justifyLeft')}
              className={styles.toolbarButton}
              title="左对齐"
            >
              ⬅️
            </button>
            <button 
              type="button" 
              onClick={() => execCommand('justifyCenter')}
              className={styles.toolbarButton}
              title="居中"
            >
              ⬆️
            </button>
            <button 
              type="button" 
              onClick={() => execCommand('justifyRight')}
              className={styles.toolbarButton}
              title="右对齐"
            >
              ➡️
            </button>
            
            <span className={styles.toolbarDivider}></span>
            
            <button 
              type="button" 
              onClick={() => execCommand('insertUnorderedList')}
              className={styles.toolbarButton}
              title="无序列表"
            >
              • 列表
            </button>
            <button 
              type="button" 
              onClick={() => execCommand('insertOrderedList')}
              className={styles.toolbarButton}
              title="有序列表"
            >
              1. 列表
            </button>
            
            <span className={styles.toolbarDivider}></span>
            
            <button 
              type="button" 
              onClick={insertLink}
              className={styles.toolbarButton}
              title="插入链接"
            >
              🔗 链接
            </button>
            
            <span className={styles.toolbarDivider}></span>
            
            <button 
              type="button" 
              onClick={() => execCommand('removeFormat')}
              className={styles.toolbarButton}
              title="清除格式"
            >
              🧹 清除
            </button>
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

        {paragraphs.length > 0 && (
          <div className={styles.previewSection}>
            <h3 className={styles.previewTitle}>📄 段落预览（共 {paragraphs.length} 段）</h3>
            <div className={styles.paragraphList}>
              {paragraphs.map((para, index) => (
                <div key={index} className={styles.paragraphItem}>
                  <span className={styles.paragraphNumber}>{index + 1}.</span>
                  <span className={styles.paragraphText}>{para}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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