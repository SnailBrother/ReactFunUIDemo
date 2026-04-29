import React, { useState } from 'react';
import styles from './PropertyTable.module.css';

const PropertyTable = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 所有字段（都在同一层级，包括权利其他状况中的字段）
  const fields = [
    { key: '产权证号', label: '产权证号', showLabel: true },
    { key: '权利人', label: '权利人', showLabel: true },
    { key: '共有情况', label: '共有情况', showLabel: true },
    { key: '坐落', label: '坐落', showLabel: true },
    { key: '不动产单元号', label: '不动产单元号', showLabel: true },
    { key: '权利类型', label: '权利类型', showLabel: true },
    { key: '权利性质', label: '权利性质', showLabel: true },
    { key: '用途', label: '用途', showLabel: true },
    { key: '面积', label: '面积', showLabel: true },
    { key: '使用期限', label: '使用期限', showLabel: true },
    { key: '房屋结构', label: '房屋结构', showLabel: true },
    { key: '套内面积', label: '套内面积', showLabel: true },
    { key: '所在楼层', label: '所在楼层', showLabel: true },
    { key: '业务编号', label: '业务编号', showLabel: true },
    { key: '营业执照', label: '营业执照', showLabel: true },
    { key: '身份证号', label: '身份证号', showLabel: true }
  ];

  // 筛选数据
  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    return Object.values(item).some(value => 
      value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // 复制单元格
  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      alert('复制成功！');
    } catch (err) {
      alert('复制失败，请手动复制');
    }
  };

  return (
    <div className={styles.propertyContainer}>
      <div className={styles.toolbar}>
        <input
          type="text"
          placeholder="搜索不动产信息..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <span className={styles.countText}>共 {filteredData.length} 条记录</span>
      </div>

      <div className={styles.certificateList}>
        {filteredData.length === 0 ? (
          <div className={styles.emptyTip}>暂无匹配的不动产信息</div>
        ) : (
          filteredData.map((cert, certIndex) => (
            <div key={certIndex} className={styles.certificateCard}>
              {/* 标题：产权证号 */}
              <div 
                className={styles.certificateHeader}
                onClick={() => handleCopy(cert.产权证号)}
                style={{ cursor: 'pointer' }}
              >
                <span className={styles.certNumber}>{cert.产权证号 || '无编号'}</span>
              </div>

              {/* 表格 - 所有字段统一展示 */}
              <table className={styles.propertyTable}>
                <tbody>
                  {fields.map((field, fieldIndex) => {
                    // 跳过已在标题显示的产权证号
                    if (field.key === '产权证号') return null;
                    
                    const value = cert[field.key];
                    // 跳过空字段
                    if (!value || value === '') return null;
                    
                    return (
                      <tr key={fieldIndex} className={styles.tableRow}>
                        <td className={styles.fieldLabelCell}>{field.label}：</td>
                        <td 
                          className={styles.fieldValueCell}
                          onClick={() => handleCopy(value)}
                          title="点击复制"
                        >
                          {value}
                        </td>
                      </tr>
                    );
                  })}
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