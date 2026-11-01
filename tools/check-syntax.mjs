/** Dependency-free, cross-platform syntax verification of every runtime module. */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const script of readdirSync(join(root, "scripts")).filter(name => name.endsWith(".mjs"))) {
  const result = spawnSync(process.execPath, ["--check", join(root, "scripts", script)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("All runtime modules passed JavaScript syntax validation.");
