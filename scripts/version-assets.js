import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function contentVersion(content) {
  return createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex").slice(0, 12);
}

export function versionAssets(directory, { check = false } = {}) {
  const root = resolve(directory);
  const versions = new Map();
  const visiting = new Set();
  const changes = new Map();

  function moduleVersion(filename) {
    const file = resolve(filename);
    const local = relative(root, file);
    if (local.startsWith("..") || isAbsolute(local)) throw new Error("Runtime assets must stay inside the website directory.");
    if (versions.has(file)) return versions.get(file);
    if (visiting.has(file)) throw new Error(`Circular runtime import: ${local}`);
    visiting.add(file);
    const original = readFileSync(file, "utf8");
    const updated = original.replace(/(\bfrom\s+["'])(\.\/[^"'?\r\n]+\.js)(?:\?v=[a-f0-9]+)?(["'])/g,
      (_, prefix, specifier, suffix) => `${prefix}${specifier}?v=${moduleVersion(resolve(dirname(file), specifier))}${suffix}`);
    const version = contentVersion(updated);
    if (updated !== original) changes.set(file, updated);
    visiting.delete(file);
    versions.set(file, version);
    return version;
  }

  const scriptVersion = moduleVersion(resolve(root, "book.js"));
  const styleVersion = contentVersion(readFileSync(resolve(root, "style.css"), "utf8"));
  const index = resolve(root, "index.html");
  const original = readFileSync(index, "utf8");
  const updated = original
    .replace(/(href=["'])style\.css(?:\?v=[a-f0-9]+)?(["'])/g, `$1style.css?v=${styleVersion}$2`)
    .replace(/(src=["'])book\.js(?:\?v=[a-f0-9]+)?(["'])/g, `$1book.js?v=${scriptVersion}$2`);
  if (!updated.includes(`style.css?v=${styleVersion}`)) throw new Error("The reader stylesheet link is missing.");
  if (!updated.includes(`book.js?v=${scriptVersion}`)) throw new Error("The reader module entry is missing.");
  if (updated !== original) changes.set(index, updated);

  if (check && changes.size) {
    throw new Error("Asset cache versions are stale. Run npm.cmd run version-assets before committing.");
  }
  if (!check) for (const [file, content] of changes) writeFileSync(file, content, "utf8");
  return { changed: changes.size, stylesheet: styleVersion, script: scriptVersion };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const result = versionAssets(root, { check: process.argv.includes("--check") });
  console.log(`Asset versions ${process.argv.includes("--check") ? "verified" : "updated"}: CSS ${result.stylesheet}, JS ${result.script}.`);
}
