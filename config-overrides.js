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