// pages/Settings/index.js
import React from 'react';
import { Card, Switch, Slider, Select, Button, message } from 'antd';
import styles from './index.module.css';

const Settings = () => {
  const handleSave = () => {
    message.success('设置已保存');
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>⚙️ 系统设置界面</h2>
      
      <Card title="基本设置" className={styles.settingCard}>
        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <span>深色模式</span>
            <span className={styles.settingDesc}>切换界面主题颜色</span>
          </div>
          <Switch />
        </div>
        
        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <span>自动保存</span>
            <span className={styles.settingDesc}>自动保存编辑内容</span>
          </div>
          <Switch defaultChecked />
        </div>
      </Card>
      
      <Card title="通知设置" className={styles.settingCard}>
        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <span>邮件通知</span>
            <span className={styles.settingDesc}>接收重要邮件通知</span>
          </div>
          <Switch defaultChecked />
        </div>
        
        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <span>消息推送</span>
            <span className={styles.settingDesc}>接收实时消息推送</span>
          </div>
          <Switch />
        </div>
      </Card>
      
      <Card title="高级设置" className={styles.settingCard}>
        <div className={styles.settingItem}>
          <div className={styles.settingLabel}>
            <span>数据缓存</span>
            <span className={styles.settingDesc}>设置数据缓存时间</span>
          </div>
          <Select defaultValue="week" style={{ width: 120 }}>
            <Select.Option value="day">1天</Select.Option>
            <Select.Option value="week">1周</Select.Option>
            <Select.Option value="month">1月</Select.Option>
          </Select>
        </div>
        
        <div className={styles.settingItem}>
          <Button type="primary" onClick={handleSave}>
            保存设置
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Settings;