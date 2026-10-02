// Builds the app and assembles a small folder (cpanel-deploy/) to upload to cPanel.
// It holds the compiled app only; cPanel's "Run NPM Install" fetches the server-side
// dependencies for the server's own operating system.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const result = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell: process.platform === "win32" });
if (result.status !== 0) process.exit(result.status ?? 1);

const out = "cpanel-deploy";
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

cpSync(".next", join(out, ".next"), {
  recursive: true,
  filter: (src) => !/^\.next[\\/](cache|dev|diagnostics|trace|trace-build|types)([\\/]|$)/.test(src),
});
cpSync("public", join(out, "public"), { recursive: true });

const { dependencies } = JSON.parse(readFileSync("package.json", "utf8"));
const runtime = Object.fromEntries(["next", "react", "react-dom", "mysql2"].map((name) => [name, dependencies[name]]));
writeFileSync(
  join(out, "package.json"),
  JSON.stringify({ name: "kinpin-arts-crm", private: true, scripts: { start: "node server.js" }, dependencies: runtime }, null, 2) + "\n",
);

// Startup file for cPanel's Node.js app (Passenger tells it which port to use).
writeFileSync(
  join(out, "server.js"),
  `process.env.NODE_ENV = "production";
const { createServer } = require("http");
const next = require("next");

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000);
});
`,
);

console.log(`\nReady: ${out}/ — upload its contents to your cPanel app folder (see README).`);
