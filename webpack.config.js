
'use strict';

const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  
  entry: [ 
    '@babel/polyfill/noConflict', 
    path.resolve(__dirname, 'index-browser.js') 
  ],

  output: {
    filename: 'quadstore.umd-bundle.js',
    path: __dirname,
    libraryTarget: 'umd',
    library: 'quadstore'
  },

  devtool: 'cheap-module-source-map',

  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [
              require('@babel/plugin-transform-async-to-generator'),
              require('@babel/plugin-syntax-object-rest-spread')
            ]
          }
        }
      }
    ]
  },

  optimization: {
    minimizer: [
      new UglifyJsPlugin({
        cache: true,
        parallel: true,
        uglifyOptions: {
          compress: false,
          mangle: true,
        },
        sourceMap: true
      })
    ]
  }

};