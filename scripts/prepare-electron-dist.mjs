import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const standaloneDir = path.join(repoRoot, ".next", "standalone");
const serverEntry = path.join(standaloneDir, "server.js");
const staticSource = path.join(repoRoot, ".next", "static");
const staticTarget = path.join(standaloneDir, ".next", "static");
const publicSource = path.join(repoRoot, "public");
const publicTarget = path.join(standaloneDir, "public");

await fs.access(serverEntry);
await fs.mkdir(path.dirname(staticTarget), { recursive: true });
await fs.cp(staticSource, staticTarget, { recursive: true, force: true });

try {
  await fs.access(publicSource);
  await fs.cp(publicSource, publicTarget, { recursive: true, force: true });
} catch {
  // The app can run without a public directory copy if none exists.
}
