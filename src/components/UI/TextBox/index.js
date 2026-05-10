import React, { useState, useRef, useEffect, useMemo } from 'react';
import styles from './TextBox.module.css';

// 日期工具函数
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const TextBox = ({
  label = "标签",
  onChange,
  value,
  searchList = [],
  leftIcon = "#icon-edit",
  rightIcon = "#icon-clear",
  Type = "SearchBox",
  min,
  max,
  step = 1,
  placeholder,
  dateFormat = 'YYYY-MM-DD',
  // ComboBox 新增属性
  editable = true,        // 是否可自由编辑输入
  multiple = false,       // 是否多选
  connector = '、',       // 多选连接符号
  
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const defaultPlaceholder = placeholder || (
    Type === "DatePicker" ? "请选择日期" :
      Type === "NumberInput" ? "请输入数字" :
        Type === "ComboBox" ? "请选择或输入..." :
          "请输入内容..."
  );
  const inputRef = useRef(null);

  // ComboBox 多选相关状态
  const [selectedItems, setSelectedItems] = useState(() => {
    if (value && multiple) {
      // 如果传入的value是字符串，尝试按连接符分割
      if (typeof value === 'string') {
        return value.split(connector).map(s => s.trim()).filter(s => s);
      }
      return Array.isArray(value) ? value : [];
    }
    return [];
  });

  // 同步外部 value
  useEffect(() => {
    if (value !== undefined) {
      if (Type === "ComboBox" && multiple) {
        if (typeof value === 'string') {
          const items = value.split(connector).map(s => s.trim()).filter(s => s);
          setSelectedItems(items);
          setInputValue(value);
        } else if (Array.isArray(value)) {
          setSelectedItems(value);
          setInputValue(value.join(connector));
        }
      } else if (value !== inputValue) {
        setInputValue(value);
      }
    }
    if (Type === "DatePicker" && value) {
      setTempDate(parseDate(value));
    }
  }, [value, Type, multiple, connector]);

  // 日期选择器相关状态
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [viewMode, setViewMode] = useState('day');
  const [tempDate, setTempDate] = useState(() => {
    if (value && Type === "DatePicker") return parseDate(value);
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  const [yearDecadeStart, setYearDecadeStart] = useState(() => {
    const year = (value && Type === "DatePicker" ? parseDate(value) : new Date()).getFullYear();
    return Math.floor(year / 10) * 10;
  });

  // 同步年份 decade
  useEffect(() => {
    if (Type === "DatePicker") {
      const year = tempDate.getFullYear();
      setYearDecadeStart(Math.floor(year / 10) * 10);
    }
  }, [tempDate, Type]);

  // 解析日期字符串
  function parseDate(dateStr) {
    if (!dateStr) return new Date();
    let match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    match = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    match = dateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    return new Date();
  }

  // 格式化日期
  function formatDate(date, formatStr = dateFormat) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    switch (formatStr) {
      case 'YYYY/MM/DD': return `${year}/${month}/${day}`;
      case 'YYYY年MM月DD日': return `${year}年${month}月${day}日`;
      case 'YYYY-MM-DD':
      default: return `${year}-${month}-${day}`;
    }
  }

  // 日历数据
  const calendarDays = useMemo(() => {
    if (Type !== "DatePicker") return [];
    const year = tempDate.getFullYear();
    const month = tempDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);

    let firstDay = getFirstDayOfMonth(year, month);
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    const prevMonthDays = getDaysInMonth(year, month - 1);
    const days = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return days;
  }, [tempDate, Type]);

  // 十年视图年份列表
  const decadeYears = useMemo(() => {
    const years = [];
    years.push(yearDecadeStart - 1);
    for (let i = 0; i < 10; i++) {
      years.push(yearDecadeStart + i);
    }
    years.push(yearDecadeStart + 10);
    return years;
  }, [yearDecadeStart]);

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  // 日期选择处理
  const handleSelectDate = (date) => {
    const fmt = formatDate(date);
    setInputValue(fmt);
    onChange?.(fmt);
    setIsDatePickerOpen(false);
    setViewMode('day');
  };

  const handleSelectMonth = (month) => {
    setTempDate(prev => new Date(prev.getFullYear(), month, 1));
    setViewMode('day');
  };

  const handleSelectYear = (year) => {
    setTempDate(prev => new Date(year, prev.getMonth(), 1));
    setViewMode('month');
  };

  const handleToday = () => {
    const today = new Date();
    const fmt = formatDate(today);
    setInputValue(fmt);
    onChange?.(fmt);
    setTempDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
    setIsDatePickerOpen(false);
    setViewMode('day');
  };

  const isSelected = (date) => {
    if (!inputValue) return false;
    const parsed = parseDate(inputValue);
    return date.getFullYear() === parsed.getFullYear() &&
      date.getMonth() === parsed.getMonth() &&
      date.getDate() === parsed.getDate();
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  };

  // 日期导航
  const toPrevMonth = () => setTempDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const toNextMonth = () => setTempDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const toPrevYear = () => setTempDate(prev => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
  const toNextYear = () => setTempDate(prev => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
  const toPrevDecade = () => setYearDecadeStart(prev => prev - 10);
  const toNextDecade = () => setYearDecadeStart(prev => prev + 10);

  // 处理主输入框的变化
  const handleInputChange = (e) => {
    let val = e.target.value;

    if (Type === "NumberInput") {
      val = val.replace(/[^0-9.-]/g, '');
      if ((val.match(/\./g) || []).length > 1) return;
      if ((val.match(/-/g) || []).length > 1) return;
      if (val.indexOf('-') > 0) return;
      setInputValue(val);
      onChange && onChange(val === '' ? '' : Number(val));
    } else if (Type === "ComboBox") {
      if (!editable) return; // 不可编辑时不处理
      setInputValue(val);
      
      // 单选模式下，清空选中的项
      if (!multiple) {
        setSelectedItems([]);
        onChange?.(val);
      } else {
        // 多选模式下，如果用户手动编辑输入框，我们不同步到选中项，直到用户选择选项
        onChange?.(val);
      }
    } else {
      setInputValue(val);
      onChange && onChange(val);
    }
  };

  // 清空输入框
  const handleClear = () => {
    setInputValue('');
    if (Type === "ComboBox" && multiple) {
      setSelectedItems([]);
    }
    onChange && onChange(multiple ? [] : '');
    inputRef.current?.focus();
  };

  // NumberInput 增减
  const handleIncrement = () => {
    const currentVal = inputValue === '' ? 0 : Number(inputValue);
    const newVal = currentVal + step;
    if (max !== undefined && newVal > max) return;
    setInputValue(newVal);
    onChange && onChange(newVal);
    inputRef.current?.focus();
  };

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
    if (Type === "SearchBox" || Type === "ComboBox") {
      setIsDropdownVisible(true);
    }
  };

  // 点击输入框区域（DatePicker 模式）
  const handleDatePickerClick = () => {
    if (Type === "DatePicker") {
      setIsDatePickerOpen(!isDatePickerOpen);
      setViewMode('day');
    }
  };

  // 处理 ComboBox 选项的勾选
  const handleCheckboxChange = (item, isChecked) => {
    let newSelectedItems;
    if (isChecked) {
      // 添加选项
      newSelectedItems = [...selectedItems, item];
    } else {
      // 移除选项
      newSelectedItems = selectedItems.filter(selected => selected !== item);
    }
    
    setSelectedItems(newSelectedItems);
    
    // 构建显示文本
    const displayValue = newSelectedItems.join(connector);
    setInputValue(displayValue);
    
    // 回调函数返回数组或字符串
    if (multiple) {
      onChange?.(newSelectedItems);
    } else {
      onChange?.(displayValue);
    }
  };

  // 处理单选模式下的选项选择
  const handleSingleSelect = (item) => {
    setInputValue(item);
    setSelectedItems([item]);
    onChange?.(item);
    setIsDropdownVisible(false);
    setSearchQuery('');
  };

  // 选下拉项 (SearchBox 模式)
  const handleSelectItem = (item) => {
    setInputValue(item);
    onChange && onChange(item);
    setIsDropdownVisible(false);
    setSearchQuery('');
    inputRef.current?.focus();
  };

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsDropdownVisible(false);
        setSearchQuery('');
        setIsDatePickerOpen(false);
        setViewMode('day');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 搜索过滤
  const filteredData = searchList.filter(item =>
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchInputChange = (e) => {
    e.stopPropagation();
    setSearchQuery(e.target.value);
  };

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

  // 渲染 ComboBox 下拉面板
  const renderComboBoxPanel = () => {
    if (Type !== "ComboBox" || !isDropdownVisible) return null;

    return (
      <div className={styles.dropdownPanel} onClick={(e) => e.stopPropagation()}>
        {/* 搜索输入框 - 仅当可编辑时显示 */}
        {editable && (
          <input
            type="text"
            className={styles.dropdownSearchInput}
            placeholder="搜索选项..."
            value={searchQuery}
            onChange={handleSearchInputChange}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        )}
        
        <ul className={styles.resultList}>
          {filteredData.length > 0 ? (
            filteredData.map((item, index) => {
              const isChecked = selectedItems.includes(item);
              
              if (multiple) {
                // 多选模式：显示复选框
                return (
                  <li
                    key={index}
                    className={`${styles.resultItem} ${styles.checkboxItem}`}
                    onClick={() => handleCheckboxChange(item, !isChecked)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <span className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </span>
                    <span className={styles.itemText}>{item}</span>
                  </li>
                );
              } else {
                // 单选模式：直接点击选择
                return (
                  <li
                    key={index}
                    className={`${styles.resultItem} ${selectedItems[0] === item ? styles.selectedItem : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSingleSelect(item);
                    }}
                  >
                    {item}
                  </li>
                );
              }
            })
          ) : (
            <li className={styles.resultItem} style={{ color: '#999' }}>无匹配内容</li>
          )}
        </ul>
      </div>
    );
  };

  // 渲染日期选择器面板
  const renderDatePickerPanel = () => {
    if (Type !== "DatePicker" || !isDatePickerOpen) return null;

    const renderHeader = () => {
      if (viewMode === 'day') {
        return (
          <div className={styles.dateHeaderBar}>
            <button className={styles.dateNavBtn} onClick={toPrevYear} title="上一年">«</button>
            <button className={styles.dateNavBtn} onClick={toPrevMonth} title="上一月">‹</button>
            <div className={styles.dateTitleGroup}>
              <span className={styles.dateClickableTitle} onClick={() => setViewMode('year')}>
                {tempDate.getFullYear()}年
              </span>
              <span className={styles.dateClickableTitle} onClick={() => setViewMode('month')}>
                {tempDate.getMonth() + 1}月
              </span>
            </div>
            <button className={styles.dateNavBtn} onClick={toNextMonth} title="下一月">›</button>
            <button className={styles.dateNavBtn} onClick={toNextYear} title="下一年">»</button>
          </div>
        );
      }

      if (viewMode === 'month') {
        return (
          <div className={styles.dateHeaderBar}>
            <button className={styles.dateNavBtn} onClick={toPrevYear} title="上一年">«</button>
            <span className={styles.dateClickableTitle} onClick={() => setViewMode('year')}>
              {tempDate.getFullYear()}年
            </span>
            <button className={styles.dateNavBtn} onClick={toNextYear} title="下一年">»</button>
          </div>
        );
      }

      if (viewMode === 'year') {
        return (
          <div className={styles.dateHeaderBar}>
            <button className={styles.dateNavBtn} onClick={toPrevDecade} title="前十年">«</button>
            <span className={styles.dateNormalTitle}>
              {yearDecadeStart}年 - {yearDecadeStart + 9}年
            </span>
            <button className={styles.dateNavBtn} onClick={toNextDecade} title="后十年">»</button>
          </div>
        );
      }
    };

    const renderContent = () => {
      if (viewMode === 'day') {
        return (
          <>
            <div className={styles.dateWeekdays}>
              {['一', '二', '三', '四', '五', '六', '日'].map(day => (
                <div key={day} className={styles.dateWeekday}>{day}</div>
              ))}
            </div>
            <div className={styles.dateDaysGrid}>
              {calendarDays.map((item, index) => {
                const date = item.date;
                return (
                  <div
                    key={index}
                    className={`${styles.dateDayCell} ${!item.isCurrentMonth ? styles.dateOtherMonth : ''} ${isSelected(date) ? styles.dateSelected : ''} ${isToday(date) ? styles.dateToday : ''}`}
                    onClick={() => handleSelectDate(date)}
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </div>
            <div className={styles.dateFooter}>
              <button className={styles.dateTodayBtn} onClick={handleToday}>今天</button>
            </div>
          </>
        );
      }

      if (viewMode === 'month') {
        return (
          <div className={styles.dateMonthGrid}>
            {months.map((month, index) => (
              <div
                key={month}
                className={`${styles.dateMonthCell} ${tempDate.getMonth() === index ? styles.dateActive : ''}`}
                onClick={() => handleSelectMonth(index)}
              >
                {month}
              </div>
            ))}
          </div>
        );
      }

      if (viewMode === 'year') {
        const currentYear = tempDate.getFullYear();
        return (
          <div className={styles.dateYearGrid}>
            {decadeYears.map((year) => {
              const isInDecade = year >= yearDecadeStart && year <= yearDecadeStart + 9;
              return (
                <div
                  key={year}
                  className={`${styles.dateYearCell} ${!isInDecade ? styles.dateOutOfDecade : ''} ${currentYear === year ? styles.dateActive : ''}`}
                  onClick={() => isInDecade && handleSelectYear(year)}
                >
                  {year}
                </div>
              );
            })}
          </div>
        );
      }
    };

    return (
      <div className={styles.datePickerPanel} onClick={(e) => e.stopPropagation()}>
        {renderHeader()}
        <div className={styles.datePanelBody}>
          {renderContent()}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <label className={styles.label}>{label}</label>

      <div className={styles.inputWrapper} onClick={handleDatePickerClick}>
        {/* 左边图标 */}
        <svg className={styles.icon} aria-hidden="true">
          <use xlinkHref={leftIcon}></use>
        </svg>

        <input
          ref={inputRef}
          type="text"
          className={`${styles.input} ${Type === "NumberInput" ? styles.numberInput : ''}`}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={defaultPlaceholder}
          inputMode={Type === "NumberInput" ? "numeric" : "text"}
          readOnly={Type === "DatePicker" || (Type === "ComboBox" && !editable)}
        />

        {/* SearchBox/ComboBox 模式：右边清空图标 */}
        {(Type === "SearchBox" || Type === "ComboBox") && inputValue && (
          <svg
            className={`${styles.icon} ${styles.rightIcon}`}
            aria-hidden="true"
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
          >
            <use xlinkHref={rightIcon}></use>
          </svg>
        )}

        {/* ComboBox 模式：下拉箭头图标 */}
        {Type === "ComboBox" && !inputValue && (
          <svg
            className={`${styles.icon} ${styles.rightIcon}`}
            aria-hidden="true"
          >
            <use xlinkHref="#icon-arrow-down"></use>
          </svg>
        )}

        {/* DatePicker 模式：右侧图标 */}
        {Type === "DatePicker" && (
          inputValue ? (
            <svg
              className={`${styles.icon} ${styles.rightIcon}`}
              aria-hidden="true"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
            >
              <use xlinkHref={rightIcon}></use>
            </svg>
          ) : (
            <svg
              className={`${styles.icon} ${styles.rightIcon}`}
              aria-hidden="true"
            >
              <use xlinkHref="#icon-calendar"></use>
            </svg>
          )
        )}

        {/* NumberInput 模式：加减按钮 */}
        {Type === "NumberInput" && (
          <div className={styles.numberControls}>
            <button
              className={styles.numberBtn}
              onClick={(e) => { e.stopPropagation(); handleIncrement(); }}
              onMouseDown={(e) => e.preventDefault()}
              tabIndex={-1}
            >
              <svg className={styles.numberIcon} aria-hidden="true">
                <use xlinkHref="#icon-arrow-up"></use>
              </svg>
            </button>
            <button
              className={styles.numberBtn}
              onClick={(e) => { e.stopPropagation(); handleDecrement(); }}
              onMouseDown={(e) => e.preventDefault()}
              tabIndex={-1}
            >
              <svg className={styles.numberIcon} aria-hidden="true">
                <use xlinkHref="#icon-arrow-down"></use>
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

      {/* ComboBox 模式：下拉多选/单选界面 */}
      {renderComboBoxPanel()}

      {/* DatePicker 模式：日期选择面板 */}
      {renderDatePickerPanel()}
    </div>
  );
};

export default TextBox;