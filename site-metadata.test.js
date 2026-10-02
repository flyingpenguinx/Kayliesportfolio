import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sections } from "./book-model.js";

test("search and sharing descriptions use the completed portfolio wording", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  const description = "Kaylie Rivera's portfolio. Click to see more.";
  assert.ok(html.includes(`<meta name="description" content="${description}" />`));
  assert.ok(html.includes(`<meta property="og:description" content="${description}" />`));
  assert.ok(html.includes(`<p>${description}</p>`));
  assert.doesNotMatch(html, /more coming soon/i);
});

test("the favicon is a square scalable KR mark using all eight portfolio colors", async () => {
  const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" sizes="any" href="assets\/favicon\.svg" \/>/);
  const icon = await readFile(new URL("./assets/favicon.svg", import.meta.url), "utf8");
  assert.match(icon, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(icon, /width="64" height="64" viewBox="0 0 64 64"/);
  assert.match(icon, /<title[^>]*>Kaylie Rivera — KR with portfolio colors<\/title>/);
  assert.equal([...icon.matchAll(/<path\b/g)].length, 2);
  for (const { color } of sections) assert.ok(icon.includes(`fill="${color}"`));
  assert.doesNotMatch(icon, /<(?:script|image|text)\b/);
});