// PropertyTable.jsx - 房产信息表格组件（精准匹配不动产证格式）
import React, { useState } from 'react';
import styles from './PropertyTable.module.css';

const PropertyTable = ({ data }) => {
  const [sortField, setSortField] = useState('产权证号'); // 默认按产权证号排序
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');

  // 核心字段配置（完全匹配你给出的最终格式）
  const baseFields = [
    { key: '产权证号', label: '产权证号', width: '120px' },
    { key: '权利人', label: '权利人', width: '120px' },
    { key: '共有情况', label: '共有情况', width: '120px' },
    { key: '坐落', label: '坐落', width: '120px' },
    { key: '不动产单元号', label: '不动产单元号', width: '120px' },
    { key: '权利类型', label: '权利类型', width: '120px' },
    { key: '权利性质', label: '权利性质', width: '120px' },
    { key: '用途', label: '用途', width: '120px' },
    { key: '面积', label: '面积', width: '120px' },
    { key: '使用期限', label: '使用期限', width: '120px' }
  ];

  // 权利其他状况分组字段
  const otherStatusFields = [
    { key: '房屋结构', label: '房屋结构', width: '120px' },
    { key: '套内面积', label: '套内面积', width: '120px' },
    { key: '所在楼层', label: '所在楼层', width: '120px' }
  ];

  // 筛选数据（支持模糊搜索任意字段）
  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    // 合并基础字段和其他状况字段一起搜索
    const allValues = [
      ...Object.values(item),
      item.房屋结构,
      item.套内面积,
      item.所在楼层
    ];
    return allValues.some(value => 
      value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // 排序数据（中文排序）
  const sortedData = [...filteredData].sort((a, b) => {
    const aValue = a[sortField] || '';
    const bValue = b[sortField] || '';
    
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue, 'zh-CN');
    } else {
      return bValue.localeCompare(aValue, 'zh-CN');
    }
  });

  // 处理排序切换
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 复制单元格内容
  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      alert('复制成功！');
    } catch (err) {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制');
    }
  };

  return (
    <div className={styles.propertyContainer}>
      {/* 搜索和统计栏 */}
      <div className={styles.toolbar}>
        <input
          type="text"
          placeholder="搜索不动产信息（如权利人、坐落等）..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <span className={styles.countText}>共 {sortedData.length} 条不动产记录</span>
      </div>

      {/* 核心：竖向键值对表格（精准匹配不动产证格式） */}
      <div className={styles.certificateList}>
        {sortedData.length === 0 ? (
          <div className={styles.emptyTip}>暂无匹配的不动产信息</div>
        ) : (
          sortedData.map((cert, certIndex) => (
            <div key={certIndex} className={styles.certificateCard}>
              {/* 证书标题栏 */}
              <div 
                className={styles.certificateHeader}
                 onClick={() => handleCopy(cert.产权证号)}
                style={{ cursor: 'pointer' }}
                // onClick={() => handleSort('产权证号')}
              >
                
                <span className={styles.certNumber}>{cert.产权证号 || '无编号'}</span>
              </div>

              {/* 核心表格主体 */}
              <table className={styles.propertyTable}>
                <tbody>
                  {/* 基础字段部分 */}
                  {baseFields.map((field, fieldIndex) => {
                    // 产权证号已在标题栏显示，跳过
                    if (field.key === '产权证号') return null;
                    return (
                      <tr key={`base-${fieldIndex}`} className={styles.tableRow}>
                        <td 
                          className={styles.fieldLabelCell}
                          style={{ width: field.width }}
                        >
                          {field.label}：
                        </td>
                        <td 
                          className={styles.fieldValueCell}
                          onClick={() => handleCopy(cert[field.key])}
                          title="点击复制该内容"
                        >
                          {cert[field.key] || '-'}
                        </td>
                      </tr>
                    );
                  })}

                  {/* 权利其他状况分组（匹配图片的竖排标题样式） */}
                  <tr className={styles.otherStatusRow}>
                    <td 
                      className={styles.otherStatusLabelCell}
                      rowSpan={otherStatusFields.length}
                    >
                      <div className={styles.verticalText}>权利其他状况</div>
                    </td>
                    {/* 第一个子字段 */}
                    <td 
                      className={styles.fieldValueCell}
                      onClick={() => handleCopy(cert[otherStatusFields[0].key])}
                      title="点击复制该内容"
                    >
                      <span className={styles.subFieldLabel}>{otherStatusFields[0].label}：</span>
                      {cert[otherStatusFields[0].key] || '-'}
                    </td>
                  </tr>
                  {/* 剩余的其他状况字段 */}
                  {otherStatusFields.slice(1).map((field, fieldIndex) => (
                    <tr key={`other-${fieldIndex}`} className={styles.tableRow}>
                      <td 
                        className={styles.fieldValueCell}
                        onClick={() => handleCopy(cert[field.key])}
                        title="点击复制该内容"
                      >
                        <span className={styles.subFieldLabel}>{field.label}：</span>
                        {cert[field.key] || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PropertyTable;