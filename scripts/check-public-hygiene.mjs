import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".vite",
  "playwright-report",
  "test-results"
]);

const blockedPatternSources = [
  String.raw`C:\\Users\\`,
  `${"One"}${"Drive"}\\\\`,
  `${"Chat"}${"GPT"}`,
  `${"implementation"} ${"instructions"} addressed to the repository ${"owner"}`,
  `${"private"} ${"notes"}`,
  String.raw`AKIA[0-9A-Z]{16}`,
  `-----BEGIN ${"PRIVATE"} ${"KEY"}-----`
];

const blockedPatterns = blockedPatternSources.map((source) => new RegExp(source, "i"));

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

const files = await collectFiles(root);
const failures = [];

for (const file of files) {
  if (file.endsWith("scripts\\check-public-hygiene.mjs") || file.endsWith("scripts/check-public-hygiene.mjs")) {
    continue;
  }

  const content = await readFile(file, "utf8").catch(() => "");
  for (const pattern of blockedPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file}: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Repo hygiene check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Repo hygiene check passed.");
