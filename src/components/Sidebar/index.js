import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { menuItems } from '../../menuConfig';
import styles from './index.module.css';

const { Sider, Header, Content } = Layout;

const Sidebar = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = (e) => {
    navigate(e.key);
    // 移动端点击菜单后自动关闭侧边栏
    if (window.innerWidth <= 768) {
      setCollapsed(true);
    }
  };

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <>
      {/* 悬浮折叠按钮 - 始终显示在左侧边缘 */}
      <Button
        type={collapsed ? "primary" : "default"}
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleSidebar}
        className={`${styles.floatingBtn} ${collapsed ? styles.floatingBtnCollapsed : styles.floatingBtnExpanded}`}
      />

      <Layout className={styles.layout}>
        {/* 侧边栏 */}
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={200}
          className={styles.sider}
          collapsedWidth={0} // 完全隐藏，宽度为0
        >
          <div className={styles.logo} />
          
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            className={styles.menu}
          />
        </Sider>

        {/* 右侧内容区域 */}
        <Layout 
          className={styles.mainLayout}
          style={{ marginLeft: collapsed ? 0 : 200 }}
        >
          <Content className={styles.content}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </>
  );
};

export default Sidebar;