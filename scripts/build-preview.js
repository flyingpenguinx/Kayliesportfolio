import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { versionAssets } from "./version-assets.js";

const root = fileURLToPath(new URL("..", import.meta.url));
versionAssets(root, { check: true });
const assets = new Map();
const compiled = new Set();
const scripts = [];

function asset(name) {
  if (!assets.has(name)) {
    const mime = name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".webp") ? "image/webp" : name.endsWith(".png") ? "image/png" : "image/jpeg";
    assets.set(name, `data:${mime};base64,${readFileSync(resolve(root, name)).toString("base64")}`);
  }
  return assets.get(name);
}

function compile(name) {
  if (compiled.has(name)) return;
  let source = readFileSync(resolve(root, name), "utf8");
  source = source.replace(/import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["'];/g, (_, names, specifier) => {
    const dependency = relative(root, fileURLToPath(new URL(specifier, pathToFileURL(resolve(root, name)))));
    compile(dependency);
    return `const {${names}} = modules[${JSON.stringify(dependency)}];`;
  });
  const exports = [...source.matchAll(/export\s+(?:async\s+)?(?:const|let|function|class)\s+(\w+)/g)].map(match => match[1]);
  source = source.replace(/export\s*\{([^}]+)\};/g, (_, names) => {
    exports.push(...names.split(",").map(name => name.trim()));
    return "";
  });
  source = source.replace(/\bexport\s+(?=(?:async\s+)?(?:const|let|function|class)\b)/g, "");
  source = source.replace(/(["'])(assets\/[^"'\r\n]+)\1/g, (_, quote, name) => quote + asset(name) + quote);
  scripts.push(`modules[${JSON.stringify(name)}] = (() => {\n${source}\nreturn {${exports.join(",")}};\n})();`);
  compiled.add(name);
}

compile("book.js");
let html = readFileSync(resolve(root, "index.html"), "utf8")
  .replace(/<script type="module" src="book\.js(?:\?v=[a-f0-9]+)?"><\/script>/, "")
  .replace(/<link rel="stylesheet" href="style\.css(?:\?v=[a-f0-9]+)?" \/>/, `<style>${readFileSync(resolve(root, "style.css"), "utf8")}</style>`);
html = html.replace(/(["'])(assets\/[^"'\r\n]+)\1/g, (_, quote, name) => quote + asset(name) + quote);
html = html.replaceAll("Kaylie%20Rivera%20-%20Portfolio%202026.pdf", pathToFileURL(resolve(root, "Kaylie Rivera - Portfolio 2026.pdf")).href);
html = html.replace("</body>", `<script>(() => { const modules = {};\n${scripts.join("\n")}\n})();</script></body>`);
const output = resolve(process.argv[2] || resolve(tmpdir(), "kaylie-portfolio-preview.html"));
writeFileSync(output, html, "utf8");
console.log(`Server-free preview written to ${output}`);
