import React, { useState, useRef, useEffect } from 'react';
import styles from './TextBox.module.css';

const TextBox = ({ 
  label = "标签", 
  onChange, 
  value, 
  searchList = [],
  leftIcon = "#icon-chakantupian4",
  rightIcon = "#icon-guanbi2",
  Type = "SearchBox", // SearchBox 或 NumberInput
  min,
  max,
  step = 1
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // 同步外部 value
  useEffect(() => {
    if (value !== undefined && value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // 处理主输入框的变化
  const handleInputChange = (e) => {
    let val = e.target.value;
    
    // NumberInput 模式：只允许数字
    if (Type === "NumberInput") {
      val = val.replace(/[^0-9.-]/g, '');
      // 防止多个小数点
      if ((val.match(/\./g) || []).length > 1) return;
      // 防止多个负号
      if ((val.match(/-/g) || []).length > 1) return;
      // 负号只能在开头
      if (val.indexOf('-') > 0) return;
    }
    
    setInputValue(val);
    onChange && onChange(Type === "NumberInput" ? Number(val) : val);
  };

  // 清空输入框
  const handleClear = () => {
    setInputValue('');
    onChange && onChange(Type === "NumberInput" ? '' : '');
    inputRef.current?.focus();
  };

  // NumberInput 增加数值
  const handleIncrement = () => {
    const currentVal = inputValue === '' ? 0 : Number(inputValue);
    const newVal = currentVal + step;
    if (max !== undefined && newVal > max) return;
    setInputValue(newVal);
    onChange && onChange(newVal);
    inputRef.current?.focus();
  };

  // NumberInput 减少数值
  const handleDecrement = () => {
    const currentVal = inputValue === '' ? 0 : Number(inputValue);
    const newVal = currentVal - step;
    if (min !== undefined && newVal < min) return;
    setInputValue(newVal);
    onChange && onChange(newVal);
    inputRef.current?.focus();
  };

  // 输入框获得焦点时显示下拉
  const handleInputFocus = () => {
    if (Type === "SearchBox") {
      setIsDropdownVisible(true);
    }
  };

  // 在下拉面板中搜索并点击某一项
  const handleSelectItem = (item) => {
    setInputValue(item);
    onChange && onChange(item);
    setIsDropdownVisible(false);
    setSearchQuery('');
    inputRef.current?.focus();
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
  const filteredData = searchList.filter(item => 
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 处理下拉搜索框输入
  const handleSearchInputChange = (e) => {
    e.stopPropagation();
    setSearchQuery(e.target.value);
  };

  // 处理按键事件（NumberInput 支持上下箭头键）
  const handleKeyDown = (e) => {
    if (Type === "NumberInput") {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleIncrement();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleDecrement();
      }
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <label className={styles.label}>{label}</label>

      <div className={styles.inputWrapper}>
        {/* 左边图标 */}
        <svg className={styles.icon} aria-hidden="true">
          <use xlinkHref={leftIcon}></use>
        </svg>
        
        <input
          ref={inputRef}
          type={Type === "NumberInput" ? "text" : "text"}
          className={`${styles.input} ${Type === "NumberInput" ? styles.numberInput : ''}`}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder="请输入内容..."
          inputMode={Type === "NumberInput" ? "numeric" : "text"}
        />
        
        {/* SearchBox 模式：右边清空图标 */}
        {Type === "SearchBox" && inputValue && (
          <svg 
            className={`${styles.icon} ${styles.rightIcon}`} 
            aria-hidden="true" 
            onClick={handleClear}
          >
            <use xlinkHref={rightIcon}></use>
          </svg>
        )}

        {/* NumberInput 模式：加减按钮 */}
        {Type === "NumberInput" && (
          <div className={styles.numberControls}>
            <button 
              className={styles.numberBtn}
              onClick={handleIncrement}
              onMouseDown={(e) => e.preventDefault()}
              tabIndex={-1}
            >
              <svg className={styles.numberIcon} aria-hidden="true">
                <use xlinkHref="#icon-jiantou_liebiaoshouqi"></use>
              </svg>
            </button>
            <button 
              className={styles.numberBtn}
              onClick={handleDecrement}
              onMouseDown={(e) => e.preventDefault()}
              tabIndex={-1}
            >
              <svg className={styles.numberIcon} aria-hidden="true">
                <use xlinkHref="#icon-jiantou_liebiaozhankai"></use>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* SearchBox 模式：下拉搜索界面 */}
      {Type === "SearchBox" && isDropdownVisible && (
        <div className={styles.dropdownPanel}>
          <input
            type="text"
            className={styles.dropdownSearchInput}
            placeholder="搜索选项..."
            value={searchQuery}
            onChange={handleSearchInputChange}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <ul className={styles.resultList}>
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (
                <li 
                  key={index} 
                  className={styles.resultItem}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectItem(item);
                  }}
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