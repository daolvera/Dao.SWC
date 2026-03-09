const target = process.env["service__SwcApi__https_0"] ||
  process.env["service__SwcApi__http_0"] ||
  "https://localhost:7493"; // Fallback for standalone dev

module.exports = {
  "/api": {
    target,
    secure: process.env["NODE_ENV"] !== "development",
    changeOrigin: true,
    pathRewrite: {
      "^/api": "" // Remove /api prefix when forwarding to the API
    },
    ws: true, // Enable WebSocket support for SignalR
  }
};
