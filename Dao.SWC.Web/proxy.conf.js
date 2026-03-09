module.exports = {
  "/api": {
    "target": process.env["service__SwcApi__https_0"] ||
    process.env["service__SwcApi__http_0"],
    secure: process.env["NODE_ENV"] !== "development",
    pathRewrite: { "^/api": "" },
  }
};
