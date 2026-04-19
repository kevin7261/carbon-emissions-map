const { defineConfig } = require('@vue/cli-service');

module.exports = defineConfig({
  publicPath: '/carbon-emissions-map/',
  transpileDependencies: true,
  devServer: {
    port: 8080,
    host: 'localhost',
  },
});
