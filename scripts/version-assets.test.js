import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { contentVersion, versionAssets } from "./version-assets.js";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "portfolio-asset-test-"));
  t.after(() => rmSync(root, { recursive: true }));
  writeFileSync(join(root, "index.html"), '<link rel="stylesheet" href="style.css" /><script type="module" src="book.js"></script>');
  writeFileSync(join(root, "style.css"), ".paper { position: absolute; }\n");
  writeFileSync(join(root, "book.js"), 'import { pages } from "./book-model.js";\nconsole.log(pages);\n');
  writeFileSync(join(root, "book-model.js"), 'import { pages } from "./portfolio-data.js";\nexport { pages };\n');
  writeFileSync(join(root, "portfolio-data.js"), "export const pages = [];\n");
  return root;
}

test("HTML and the complete runtime import chain use content-specific cache keys", t => {
  const root = fixture(t);
  const result = versionAssets(root);
  assert.ok(readFileSync(join(root, "index.html"), "utf8").includes(`style.css?v=${result.stylesheet}`));
  assert.ok(readFileSync(join(root, "index.html"), "utf8").includes(`book.js?v=${result.script}`));
  assert.match(readFileSync(join(root, "book.js"), "utf8"), /book-model\.js\?v=[a-f0-9]{12}/);
  assert.match(readFileSync(join(root, "book-model.js"), "utf8"), /portfolio-data\.js\?v=[a-f0-9]{12}/);
  assert.equal(versionAssets(root).changed, 0);
  assert.equal(versionAssets(root, { check: true }).changed, 0);
});

test("changing a nested module invalidates its parents and the HTML entry", t => {
  const root = fixture(t);
  const before = versionAssets(root);
  writeFileSync(join(root, "portfolio-data.js"), "export const pages = [1];\n");
  assert.throws(() => versionAssets(root, { check: true }), /cache versions are stale/);
  const after = versionAssets(root);
  assert.notEqual(after.script, before.script);
  assert.equal(after.stylesheet, before.stylesheet);
});

test("changing only CSS gives browsers a new stylesheet URL", t => {
  const root = fixture(t);
  const before = versionAssets(root);
  writeFileSync(join(root, "style.css"), ".paper { position: absolute; width: 50%; }\n");
  const after = versionAssets(root);
  assert.notEqual(after.stylesheet, before.stylesheet);
  assert.equal(after.script, before.script);
});

test("cache hashes are stable across Git's Windows line-ending conversion", () => {
  assert.equal(contentVersion("a\r\nb\r\n"), contentVersion("a\nb\n"));
});

test("the actual website has up-to-date asset cache versions", () => {
  assert.equal(versionAssets(fileURLToPath(new URL("..", import.meta.url)), { check: true }).changed, 0);
});
