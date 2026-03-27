// pages/User/index.js
import React from 'react';
import { Table, Button, Space, Tag } from 'antd';
import styles from './index.module.css';

const User = () => {
  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
    },
    {
      title: '地址',
      dataIndex: 'address',
      key: 'address',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags) => (
        <>
          {tags.map(tag => (
            <Tag color="blue" key={tag}>
              {tag}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link">编辑</Button>
          <Button type="link" danger>删除</Button>
        </Space>
      ),
    },
  ];

  const data = [
    {
      key: '1',
      name: '张三',
      age: 32,
      address: '北京市朝阳区',
      tags: ['高级用户', 'VIP'],
    },
    {
      key: '2',
      name: '李四',
      age: 28,
      address: '上海市浦东新区',
      tags: ['普通用户'],
    },
    {
      key: '3',
      name: '王五',
      age: 35,
      address: '广州市天河区',
      tags: ['高级用户'],
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>👥 用户管理界面</h2>
        <Button type="primary">新增用户</Button>
      </div>
      
      <Table 
        columns={columns} 
        dataSource={data} 
        className={styles.table}
        pagination={{ pageSize: 5 }}
      />
    </div>
  );
};

export default User;