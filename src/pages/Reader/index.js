import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './Reader.module.css';

const Reader = () => {
  // 状态管理：markdown内容、加载状态、错误信息
  const [markdownContent, setMarkdownContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 加载远程README.md文件
  useEffect(() => {
    const fetchMarkdown = async () => {
      try {
        // 发起网络请求获取文件内容
        const response = await fetch('/俯卧撑.md');
        
        // 检查请求是否成功
        if (!response.ok) {
          throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }
        
        // 读取文本内容
        const text = await response.text();
        setMarkdownContent(text);
        setError(null);
      } catch (err) {
        // 捕获并设置错误信息
        setError(`加载失败: ${err.message}`);
        setMarkdownContent('');
        console.error('加载README.md失败:', err);
      } finally {
        // 无论成功失败，都结束加载状态
        setIsLoading(false);
      }
    };

    fetchMarkdown();

    // 清理函数（组件卸载时取消请求）
    return () => {
      // 可以在这里添加请求取消逻辑
    };
  }, []); // 空依赖数组：只在组件挂载时执行一次

  // 渲染不同状态的UI
  if (isLoading) {
    return <div className={styles.loading}>正在加载 README.md 文件...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>README.md 阅读器</h1>
      </header>
      <main className={styles.content}>
        {/* 渲染Markdown内容 */}
        <ReactMarkdown>{markdownContent}</ReactMarkdown>
      </main>
    </div>
  );
};

export default Reader;