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
    key: '/Date',
    icon: <SettingOutlined />,
    label: '日期控件',
    component: lazy(() => import('./pages/Date')),
  },
  {
    key: '/PaddleOCR',
    icon: <SettingOutlined />,
    label: 'Paddle文字提取',
    component: lazy(() => import('./pages/PaddleOCR')),
  },
  {
    key: '/PaddleOCRBatch',
    icon: <SettingOutlined />,
    label: 'Paddle批量文字提取',
    component: lazy(() => import('./pages/PaddleOCRBatch')),
  },
  {
    key: '/AIStudio',
    icon: <SettingOutlined />,
    label: 'AIStudio文字提取',
    component: lazy(() => import('./pages/AIStudio')),
  },
  {
    key: '/AIStudioDownload',
    icon: <SettingOutlined />,
    label: 'AIStudio表格下载',
    component: lazy(() => import('./pages/AIStudioDownload')),
  },
  {
    key: '/Tesseract',
    icon: <SettingOutlined />,
    label: 'Tesseract文字提取',
    component: lazy(() => import('./pages/Tesseract')),
  },
  
  {
    key: '/PythonOCR',
    icon: <SettingOutlined />,
    label: 'Python文字提取',
    component: lazy(() => import('./pages/PythonOCR')),
  },
  {
    key: '/DoubaoOCR',
    icon: <SettingOutlined />,
    label: ' DoubaoOCR文字提取',
    component: lazy(() => import('./pages/DoubaoOCR')),
  },
  {
    key: '/Reader',
    icon: <SettingOutlined />,
    label: '阅读',
    component: lazy(() => import('./pages/Reader')),
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
  },
  {
    key: '/login',
    icon: <SettingOutlined />,
    label: '登录',
    component: lazy(() => import('./pages/LogIn')),
  },
  {
    key: '/WaterWave',
    icon: <SettingOutlined />,
    label: '水波荡漾',
    component: lazy(() => import('./pages/WaterWave')),
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