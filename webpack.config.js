const path = require('path');
const ConcatPlugin = require('webpack-concat-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/eaas-client.js',
  output: {
    filename: 'eaas-client.js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new ConcatPlugin({
      uglify: false,
      sourceMap: false,
      name: 'guacamole',
      outputPath: 'guacamole',
      fileName: '[name].js',
      filesToConcat: ['./resources/guacamole/js/*.js'],
      attributes: {
        async: true
    }}),
    new ConcatPlugin({
      uglify: false,
      sourceMap: false,
      name: 'guacamole',
      outputPath: 'guacamole',
      fileName: '[name].css',
      filesToConcat: ['./resources/guacamole/css/*.js'],
      attributes: {
        async: true
    }}),
    new CopyWebpackPlugin([
       {from: "./resources/xpra/", to: "xpra"},
       {from: "./resources/webemulator/", to: "webemulator"},
       {from: "./src/eaas-client.css", to: ""},
    ]),
  ]
};
