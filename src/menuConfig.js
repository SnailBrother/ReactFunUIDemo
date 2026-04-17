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
  {
    key: '/login',
    icon: <SettingOutlined />,
    label: '登录',
    component: lazy(() => import('./pages/LogIn')),
  },
  {
    key: '/waterwave',
    icon: <SettingOutlined />,
    label: '水波动画',
    component: lazy(() => import('./pages/WaterWave')),
  },
  {
    key: '/Date',
    icon: <SettingOutlined />,
    label: '日期控件',
    component: lazy(() => import('./pages/Date')),
  },
  {
    key: '/Reader',
    icon: <SettingOutlined />,
    label: '阅读',
    component: lazy(() => import('./pages/Reader')),
  },
  {
    key: '/VideoCall',
    icon: <SettingOutlined />,
    label: 'VideoCall',
    component: lazy(() => import('./pages/VideoCall')),
  },
  {
    key: '/WordEditor',
    icon: <SettingOutlined />,
    label: 'Word编辑',
    component: lazy(() => import('./pages/WordEditor')),
  },
  {
    key: '/MusicVisualization',
    icon: <SettingOutlined />,
    label: '音频可视化',
    component: lazy(() => import('./pages/MusicVisualization')),
  },
  {
    key: '/DogMove',
    icon: <SettingOutlined />,
    label: '小狗移动',
    component: lazy(() => import('./pages/DogMove')),
  }
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