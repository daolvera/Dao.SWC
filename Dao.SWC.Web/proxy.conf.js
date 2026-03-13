module.exports = {
  "/api": {
    target:
      process.env["API_URL"] ||
      process.env["API_URL"],
    secure: process.env["NODE_ENV"] !== "development",
    changeOrigin: true,
    logLevel: "debug",
    pathRewrite: {
      "^/api": "" // Remove /api prefix when forwarding to the API
    },
    ws: true, // Enable WebSocket support for SignalR
  },
};