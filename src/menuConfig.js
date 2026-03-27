// menuConfig.js
import { lazy } from 'react';
import {
  HomeOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons';

// 菜单配置（同时作为路由配置）
export const menuItems = [
  {
    key: '/home',
    icon: <HomeOutlined />,
    label: '首页',
    component: lazy(() => import('./pages/Home')),
  },
  {
    key: '/user',
    icon: <UserOutlined />,
    label: '用户管理',
    component: lazy(() => import('./pages/User')),
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
    component: lazy(() => import('./pages/Settings')),
  },
];

// 生成路由配置（包含根路径）
export const routes = [
  {
    path: '/',
    component: menuItems[0].component, // 默认首页
    exact: true
  },
  ...menuItems.map(item => ({
    path: item.key,
    component: item.component,
    exact: true
  }))
];