
const path = require('path');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'index.js'),
  output: {
    path: path.resolve(__dirname, '.'),
    filename: 'index.bundle.js',
    libraryTarget: 'module',
    chunkFormat: false,
  },
  experiments: {
    outputModule: true,
  },
  target: 'web',
  optimization: {
    minimize: false,
    moduleIds: 'named',
    usedExports: true,
    concatenateModules: false
  },
  resolve: {},
  plugins: []
};
