import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { menuItems } from '../../menuConfig';
import styles from './index.module.css';

const Sidebar = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = (path) => {
    navigate(path);
    // 移动端点击菜单后自动关闭侧边栏
    if (window.innerWidth <= 768) {
      setCollapsed(true);
    }
  };

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  // 菜单图标映射（可以根据需要扩展）
  const getIcon = (icon) => {
    if (!icon) return null;
    // 如果传入的是 React 元素，直接返回
    if (React.isValidElement(icon)) return icon;
    return null;
  };

  return (
    <>
      {/* 悬浮折叠按钮 */}
      <button
        onClick={toggleSidebar}
        className={`${styles.floatingBtn} ${collapsed ? styles.floatingBtnCollapsed : styles.floatingBtnExpanded}`}
        aria-label={collapsed ? "展开菜单" : "收起菜单"}
      >
        {collapsed ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M15 3L21 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M9 3L3 9L9 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      <div className={styles.layout}>
        {/* 侧边栏遮罩层（移动端） */}
        {!collapsed && (
          <div 
            className={styles.overlay} 
            onClick={() => setCollapsed(true)}
          />
        )}

        {/* 侧边栏 */}
        <aside 
          className={`${styles.sider} ${collapsed ? styles.siderCollapsed : ''}`}
        >
          <div className={styles.logo}>
            <span>Logo</span>
          </div>
          
          <nav className={styles.menuContainer}>
            {menuItems.map((item) => (
              <div
                key={item.key}
                className={`${styles.menuItem} ${location.pathname === item.key ? styles.menuItemActive : ''}`}
                onClick={() => handleMenuClick(item.key)}
              >
                <span className={styles.menuIcon}>
                  {getIcon(item.icon) || (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 9L12 3L21 9L12 15L3 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 13V19L12 22L19 19V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className={styles.menuLabel}>{item.label}</span>
              </div>
            ))}
          </nav>
        </aside>

        {/* 右侧内容区域 */}
        <main 
          className={`${styles.mainLayout} ${collapsed ? styles.mainLayoutExpanded : ''}`}
        >
          <div className={styles.content}>
            {children}
          </div>
        </main>
      </div>
    </>
  );
};

export default Sidebar;