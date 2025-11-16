// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/noaa",
    createProxyMiddleware({
      target: "https://services.swpc.noaa.gov",
      changeOrigin: true,
      secure: true,
      pathRewrite: { "^/noaa": "" },
      onProxyRes(proxyRes) {
        proxyRes.headers["Access-Control-Allow-Origin"] = "*";
      },
    })
  );
};
