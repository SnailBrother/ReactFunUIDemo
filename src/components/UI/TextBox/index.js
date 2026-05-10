// TextBox.js
import React, { useState, useRef, useEffect } from 'react';
import styles from './TextBox.module.css';

const SearchIcon = () => (
  <svg className={styles.icon} style={{ left: '12px' }} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
);
const ClearIcon = ({ onClick }) => (
  <svg className={`${styles.icon} ${styles.rightIcon}`} onClick={onClick} width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
);

const MOCK_DATA = ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Node.js', 'JavaScript', 'TypeScript'];

const TextBox = ({ label = "标签", onChange, value }) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  // 处理主输入框的变化
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    onChange && onChange(val);
  };

  // 清空输入框
  const handleClear = (e) => {
    e.stopPropagation();
    setInputValue('');
    onChange && onChange('');
  };

  // 输入框获得焦点时显示下拉
  const handleInputFocus = () => {
    setIsDropdownVisible(true);
  };

  // 在下拉面板中搜索并点击某一项
  const handleSelectItem = (item) => {
    setInputValue(item);
    onChange && onChange(item);
    setIsDropdownVisible(false);
    setSearchQuery('');
  };

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target)
      ) {
        setIsDropdownVisible(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 过滤下拉框的搜索结果
  const filteredData = MOCK_DATA.filter(item => 
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 处理下拉搜索框输入
  const handleSearchInputChange = (e) => {
    e.stopPropagation();
    setSearchQuery(e.target.value);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {/* 左侧 Label */}
      <label className={styles.label}>{label}</label>

      {/* 输入框区域 */}
      <div className={styles.inputWrapper}>
        {/* 左边的图标 */}
        <SearchIcon />
        
        <input
          type="text"
          className={styles.input}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder="请输入内容..."
        />
        
        {/* 右边的图标 (当有内容时显示清空按钮) */}
        {inputValue && <ClearIcon onClick={handleClear} />}
      </div>

      {/* 悬浮出现的下拉搜索界面 */}
      {isDropdownVisible && (
        <div 
          className={styles.dropdownPanel}
          ref={dropdownRef}
          onMouseDown={(e) => e.preventDefault()}
        >
          <input
            type="text"
            className={styles.dropdownSearchInput}
            placeholder="搜索选项..."
            value={searchQuery}
            onChange={handleSearchInputChange}
            autoFocus
          />
          <ul className={styles.resultList}>
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (
                <li 
                  key={index} 
                  className={styles.resultItem}
                  onClick={() => handleSelectItem(item)}
                >
                  {item}
                </li>
              ))
            ) : (
              <li className={styles.resultItem} style={{ color: '#999' }}>无匹配内容</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TextBox;