import { spawn } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "netlify-dist");
const port = 4183;

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: "inherit", env: process.env });
    child.on("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`)));
  });
}

await run("npm", ["run", "build"]);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "dist/client"), output, { recursive: true });

const server = spawn("npm", ["run", "start", "--", "--port", String(port)], {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
  env: { ...process.env, PORT: String(port) },
});

try {
  let html;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) {
        html = await response.text();
        break;
      }
    } catch {
      // The server can take a moment to accept connections after startup.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  if (!html) throw new Error("Could not render the production homepage");
  await writeFile(resolve(output, "index.html"), html.replaceAll(`http://localhost:${port}`, "https://playa.intelchen.com"));
} finally {
  server.kill("SIGTERM");
}
