import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Spin } from 'antd';
import Sidebar from './components/Sidebar';
import { routes } from './menuConfig';

import './App.css';

// 单独导入首页组件用于根路径
const Home = lazy(() => import('./pages/Home'));

// 加载组件
const LoadingComponent = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh' 
  }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

function App() {
  return (
    <Router>
      <Sidebar>
        <Suspense fallback={<LoadingComponent />}>
          <Routes>
            {/* 根路径单独处理 */}
            <Route path="/" element={<Home />} />
            
            {/* 动态生成其他路由 */}
            {routes.map((route, index) => {
              const Component = route.component;
              return (
                <Route
                  key={index}
                  path={route.path}
                  element={<Component />}
                />
              );
            })}
          </Routes>
        </Suspense>
      </Sidebar>
    </Router>
  );
}

export default App;