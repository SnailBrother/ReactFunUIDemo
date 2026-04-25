# 因为 @paddleocr/paddleocr-js 依赖的 @techstark/opencv-js 包含了 Node.js 核心模块（fs、path），而 Webpack 5 默认不再为浏览器环境提供这些 polyfill

如果使用 Create React App（未 eject）
由于 CRA 隐藏了 webpack 配置，需要先安装两个插件：

bash
npm install react-app-rewired customize-cra path-browserify
然后在项目根目录创建 config-overrides.js：


const { override, addWebpackResolve } = require('customize-cra');

module.exports = override(
  addWebpackResolve({
    fallback: {
      "path": require.resolve("path-browserify"),
      "fs": false,
      "os": false,
      "crypto": false,
      "stream": false,
      "buffer": false,
      "util": false,
      "url": false,
      "http": false,
      "https": false,
      "zlib": false
    }
  })
);
修改 package.json 中的 scripts：

"scripts": {
  "start": "react-app-rewired start",
  "build": "react-app-rewired build",
  "test": "react-app-rewired test"
}