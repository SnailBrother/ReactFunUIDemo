// pages/Home/index.js
import React from 'react';
import { Card, Statistic, Row, Col } from 'antd';
import { UserOutlined, ShoppingOutlined, DollarOutlined } from '@ant-design/icons';
import styles from './index.module.css';

const Home = () => {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>🏠 欢迎来到首页</h2>
      
      <Row gutter={[16, 16]} className={styles.statsRow}>
        <Col xs={24} sm={12} lg={8}>
          <Card className={styles.statCard}>
            <Statistic
              title="用户总数"
              value={1128}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className={styles.statCard}>
            <Statistic
              title="订单总数"
              value={93}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card className={styles.statCard}>
            <Statistic
              title="总收入"
              value={112893}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>
      
      <Card className={styles.welcomeCard}>
        <p>欢迎使用管理系统！这是一个示例首页。</p>
        <p>您可以通过侧边栏菜单切换到不同的功能模块。</p>
      </Card>
    </div>
  );
};

export default Home;