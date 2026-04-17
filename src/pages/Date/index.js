import React, { useState, useMemo, useEffect, useRef } from 'react';
import styles from './index.module.css';

// 工具函数：获取指定年月的天数
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

// 工具函数：获取指定年月的第一天是星期几（0=周日，1=周一...6=周六）
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const DatePicker = ({ 
  value, 
  onChange, 
  placeholder = "请选择日期",
  format = 'YYYY-MM-DD' // 支持格式：'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY年MM月DD日'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'month' | 'year'
  const [tempDate, setTempDate] = useState(() => {
    if (value) return parseDate(value);
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  const [inputValue, setInputValue] = useState(value || '');
  
  // 年份视图的起始年份（用于显示 decade）
  const [yearDecadeStart, setYearDecadeStart] = useState(() => {
    const year = (value ? parseDate(value) : new Date()).getFullYear();
    return Math.floor(year / 10) * 10;
  });

  const wrapperRef = useRef(null);

  // 解析日期字符串
  function parseDate(dateStr) {
    if (!dateStr) return new Date();
    
    // 尝试解析不同格式
    // 格式1: YYYY-MM-DD
    let match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    
    // 格式2: YYYY/MM/DD
    match = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    
    // 格式3: YYYY年MM月DD日
    match = dateStr.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    
    // 默认返回当前日期
    return new Date();
  }

  // 格式化日期
  function formatDate(date, formatStr = format) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    switch (formatStr) {
      case 'YYYY/MM/DD':
        return `${year}/${month}/${day}`;
      case 'YYYY年MM月DD日':
        return `${year}年${month}月${day}日`;
      case 'YYYY-MM-DD':
      default:
        return `${year}-${month}-${day}`;
    }
  }

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setViewMode('day');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 同步输入值
  useEffect(() => {
    if (value) {
      setInputValue(value);
      setTempDate(parseDate(value));
    }
  }, [value]);

  // 同步年份 decade
  useEffect(() => {
    const year = tempDate.getFullYear();
    setYearDecadeStart(Math.floor(year / 10) * 10);
  }, [tempDate]);

  // 日历数据
  const calendarDays = useMemo(() => {
    const year = tempDate.getFullYear();
    const month = tempDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    
    let firstDay = getFirstDayOfMonth(year, month);
    // 转换为以周一为一周的第一天
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    
    const prevMonthDays = getDaysInMonth(year, month - 1);
    const days = [];

    // 上个月的日期
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ 
        date: new Date(year, month - 1, prevMonthDays - i), 
        isCurrentMonth: false 
      });
    }
    
    // 当前月的日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ 
        date: new Date(year, month, i), 
        isCurrentMonth: true 
      });
    }
    
    // 下个月的日期（补齐42格）
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ 
        date: new Date(year, month + 1, i), 
        isCurrentMonth: false 
      });
    }
    
    return days;
  }, [tempDate]);

  // 切换年月
  const toPrevMonth = () => {
    setTempDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const toNextMonth = () => {
    setTempDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const toPrevYear = () => {
    setTempDate(prev => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
  };

  const toNextYear = () => {
    setTempDate(prev => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
  };

  const toPrevDecade = () => {
    setYearDecadeStart(prev => prev - 10);
  };

  const toNextDecade = () => {
    setYearDecadeStart(prev => prev + 10);
  };

  // 选择处理
  const handleSelectDate = (date) => {
    const fmt = formatDate(date);
    setInputValue(fmt);
    onChange?.(fmt);
    setIsOpen(false);
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
    setIsOpen(false);
    setViewMode('day');
  };

  // 判断选中和今天
  const isSelected = (date) => {
    if (!inputValue) return false;
    try {
      const parsed = parseDate(inputValue);
      return date.getFullYear() === parsed.getFullYear() &&
             date.getMonth() === parsed.getMonth() &&
             date.getDate() === parsed.getDate();
    } catch {
      return false;
    }
  };
  
  const isToday = (date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  };

  // 生成年份列表（用于年份视图）
  const decadeYears = useMemo(() => {
    const years = [];
    years.push(yearDecadeStart - 1);
    for (let i = 0; i < 10; i++) {
      years.push(yearDecadeStart + i);
    }
    years.push(yearDecadeStart + 10);
    return years;
  }, [yearDecadeStart]);

  // 月份列表
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  // 渲染头部
  const renderHeader = () => {
    if (viewMode === 'day') {
      return (
        <div className={styles.headerBar}>
          <button className={styles.navBtn} onClick={toPrevYear} title="上一年">«</button>
          <button className={styles.navBtn} onClick={toPrevMonth} title="上一月">‹</button>
          <div className={styles.titleGroup}>
            <span 
              className={styles.clickableTitle}
              onClick={() => setViewMode('year')}
            >
              {tempDate.getFullYear()}年
            </span>
            <span 
              className={styles.clickableTitle}
              onClick={() => setViewMode('month')}
            >
              {tempDate.getMonth() + 1}月
            </span>
          </div>
          <button className={styles.navBtn} onClick={toNextMonth} title="下一月">›</button>
          <button className={styles.navBtn} onClick={toNextYear} title="下一年">»</button>
        </div>
      );
    }

    if (viewMode === 'month') {
      return (
        <div className={styles.headerBar}>
          <button className={styles.navBtn} onClick={toPrevYear} title="上一年">«</button>
          <span 
            className={styles.clickableTitle}
            onClick={() => setViewMode('year')}
          >
            {tempDate.getFullYear()}年
          </span>
          <button className={styles.navBtn} onClick={toNextYear} title="下一年">»</button>
        </div>
      );
    }

    if (viewMode === 'year') {
      return (
        <div className={styles.headerBar}>
          <button className={styles.navBtn} onClick={toPrevDecade} title="前十年">«</button>
          <span className={styles.normalTitle}>
            {yearDecadeStart}年 - {yearDecadeStart + 9}年
          </span>
          <button className={styles.navBtn} onClick={toNextDecade} title="后十年">»</button>
        </div>
      );
    }
  };

  // 渲染内容
  const renderContent = () => {
    if (viewMode === 'day') {
      return (
        <>
          <div className={styles.weekdays}>
            {['一', '二', '三', '四', '五', '六', '日'].map(day => (
              <div key={day} className={styles.weekday}>{day}</div>
            ))}
          </div>
          <div className={styles.daysGrid}>
            {calendarDays.map((item, index) => {
              const date = item.date;
              return (
                <div
                  key={index}
                  className={`
                    ${styles.dayCell}
                    ${!item.isCurrentMonth ? styles.otherMonth : ''}
                    ${isSelected(date) ? styles.selected : ''}
                    ${isToday(date) ? styles.today : ''}
                  `}
                  onClick={() => handleSelectDate(date)}
                >
                  {date.getDate()}
                </div>
              );
            })}
          </div>
          <div className={styles.footer}>
            <button className={styles.todayBtn} onClick={handleToday}>今天</button>
          </div>
        </>
      );
    }

    if (viewMode === 'month') {
      return (
        <div className={styles.monthGrid}>
          {months.map((month, index) => (
            <div
              key={month}
              className={`
                ${styles.monthCell}
                ${tempDate.getMonth() === index ? styles.active : ''}
              `}
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
        <div className={styles.yearGrid}>
          {decadeYears.map((year) => {
            const isInDecade = year >= yearDecadeStart && year <= yearDecadeStart + 9;
            return (
              <div
                key={year}
                className={`
                  ${styles.yearCell}
                  ${!isInDecade ? styles.outOfDecade : ''}
                  ${currentYear === year ? styles.active : ''}
                `}
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
    <div className={styles.datePickerWrapper} ref={wrapperRef}>
      <div
        className={styles.inputWrapper}
        onClick={() => setIsOpen(!isOpen)}
      >
        <input 
          className={styles.input} 
          placeholder={placeholder} 
          readOnly 
          value={inputValue} 
        />
        <span className={styles.calendarIcon}>📅</span>
      </div>

      {isOpen && (
        <div className={styles.calendarPanel} onClick={(e) => e.stopPropagation()}>
          {renderHeader()}
          <div className={styles.panelBody}>
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;