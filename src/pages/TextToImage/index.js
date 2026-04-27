import { useState, useRef } from 'react';
import styles from './TextToImage.module.css';

const TextToImage = () => {
  // 输入内容
  const [inputText, setInputText] = useState('');
  const [userImage, setUserImage] = useState('');
  
  // 控制显示哪个界面
  const [showResult, setShowResult] = useState(false);
  
  // 对话消息列表
  const [messages, setMessages] = useState([]);
  
  // 控制是否在等待生成
  const [isWaiting, setIsWaiting] = useState(false);
  
  // 控制是否显示图片
  const [showImage, setShowImage] = useState(false);
  
  // 文件上传
  const fileRef = useRef(null);

  // 上传图片
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUserImage(url);
  };

  // 点击开始
  const handleStart = () => {
    if (!inputText || !userImage) {
      alert('请输入文字并上传图片');
      return;
    }

    // 隐藏控制面板，显示对话界面
    setShowResult(true);
    setIsWaiting(false);
    setShowImage(false);
    
    // 初始化对话消息 - 只显示用户问题
    const initialMessages = [
      {
        id: 1,
        type: 'user',
        content: `请根据以下文字生成一张图片：\n\n"${inputText}"`,
        timestamp: new Date().toLocaleTimeString()
      }
    ];
    setMessages(initialMessages);

    // 短暂延迟后显示等待动画
    setTimeout(() => {
      setIsWaiting(true);
    }, 500);

    // 3秒后隐藏等待，显示图片
    setTimeout(() => {
      setIsWaiting(false);
      setShowImage(true);
    }, 3500);
  };

  // 重置
  const handleReset = () => {
    setInputText('');
    setUserImage('');
    setShowResult(false);
    setMessages([]);
    setIsWaiting(false);
    setShowImage(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // 渲染控制面板
  const renderControlPanel = () => (
    <div className={styles.controlPanel}>
      <div className={styles.panelHeader}>
        <div className={styles.aiIcon}>🤖</div>
        <h2>AI 图片生成助手</h2>
        <p className={styles.subtitle}>上传图片并描述你想要的效果</p>
      </div>

      <div className={styles.formItem}>
        <label>💬 描述文字：</label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="请输入要展示的文字内容..."
          rows={4}
        />
      </div>

      <div className={styles.formItem}>
        <label>📁 上传图片：</label>
        <div className={styles.uploadArea}>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileRef} 
            onChange={handleUpload}
            id="fileInput"
            className={styles.fileInput}
          />
          <label htmlFor="fileInput" className={styles.uploadLabel}>
            {userImage ? '✓ 图片已选择' : '点击上传图片'}
          </label>
        </div>
        {userImage && (
          <img src={userImage} className={styles.preview} alt="预览" />
        )}
      </div>

      <button className={styles.startBtn} onClick={handleStart}>
        🚀 开始生成
      </button>
    </div>
  );

  // 渲染对话界面
  const renderChatView = () => (
    <div className={styles.chatFullScreen}>
      <div className={styles.chatWrapper}>
        {/* 对话头部 */}
        <div className={styles.chatHeader}>
          <div className={styles.aiAvatar}>🤖</div>
          <div className={styles.headerInfo}>
            <h3>AI 图片生成助手</h3>
            <span className={styles.onlineStatus}>在线</span>
          </div>
        </div>

        {/* 消息区域 */}
        <div className={styles.messagesArea}>
          {/* 用户消息 */}
          <div className={styles.userMessage}>
            <div className={styles.messageBubble}>
              {messages[0]?.content}
            </div>
            <div className={styles.messageTime}>{messages[0]?.timestamp}</div>
          </div>

          {/* 等待动画 */}
          {isWaiting && (
            <div className={styles.aiMessage}>
              <div className={styles.aiAvatarSmall}>🤖</div>
              <div className={styles.waitingBubble}>
                <div className={styles.waitingAnimation}>
                  <div className={styles.waitingSpinner}></div>
                  <span>正在生成图片...</span>
                </div>
              </div>
            </div>
          )}

          {/* 生成完成，显示图片 */}
          {showImage && (
            <div className={styles.aiMessage}>
              <div className={styles.aiAvatarSmall}>🤖</div>
              <div className={styles.messageContent}>
                <div className={styles.resultCard}>
                  <div className={styles.resultImageWrapper}>
                    <img 
                      src={userImage} 
                      alt="生成结果"
                      className={styles.resultImage}
                    />
                  </div>
                  <div className={styles.resultActions}>
                    <a 
                      href={userImage} 
                      download="generated-image.png"
                      className={styles.downloadBtn}
                    >
                      💾 保存图片
                    </a>
                  </div>
                </div>
                <div className={styles.messageTime}>{new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className={styles.chatFooter}>
          <button className={styles.backBtn} onClick={handleReset}>
            ← 返回重新生成
          </button>
          {showImage && (
            <button className={styles.regenerateBtn} onClick={handleStart}>
              🔄 重新生成
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      {!showResult ? renderControlPanel() : renderChatView()}
    </div>
  );
};

export default TextToImage;