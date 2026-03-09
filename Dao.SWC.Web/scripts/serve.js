const { spawn } = require("child_process");

const port = process.env.PORT || 4200;
const args = ["serve", "--port", port];

console.log(`Starting Angular dev server on port ${port}...`);

const child = spawn("npx", ["ng", ...args], {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});

child.on("close", (code) => {
  process.exit(code);
});
