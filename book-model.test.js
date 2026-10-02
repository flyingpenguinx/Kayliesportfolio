import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { pages, sections, pageDimensions, fitBook, fitImage, pageIndexFromHash, adjacentPage, spreadForPage, viewForPage, turnPlan, pageNumber, spreadLabel, sectionForPage, pageLabel, contentsBounds } from "./book-model.js";
import { figures } from "./figure-data.js";

test("all 20 PDF pages have unique, addressable IDs and rendered artwork", async () => {
  assert.equal(pages.length, 20);
  assert.equal(new Set(pages.map((page) => page.id)).size, 20);
  for (const [index, page] of pages.entries()) {
    assert.equal(pageIndexFromHash(`#${page.id}`), index);
    assert.ok(page.title && page.description);
    assert.equal(typeof page.text, "string");
    await access(new URL(page.image, import.meta.url));
    const artwork = await readFile(new URL(page.image, import.meta.url));
    assert.equal(artwork.toString("ascii", 0, 4), "RIFF");
    assert.equal(artwork.toString("ascii", 8, 12), "WEBP");
  }
});

test("contents destinations preserve the author's original PDF numbering", () => {
  assert.deepEqual(sections.map(({ start, end }) => [start, end]), [
    [2, 2], [3, 4], [5, 8], [9, 12], [13, 14], [15, 15], [16, 18], [19, 19],
  ]);
  for (const section of sections) {
    assert.equal(pages[section.start].id, section.id);
    assert.equal(pageIndexFromHash(`#${section.id}`), section.start);
    assert.equal(section.range, section.start === section.end
      ? String(section.start)
      : `${section.start}-${section.end}`);
    for (let index = section.start; index <= section.end; index++) {
      assert.equal(sectionForPage(index), section);
    }
  }
  assert.equal(sectionForPage(0), null);
  assert.equal(sectionForPage(1), null);
});

test("every content page belongs to exactly one section", () => {
  for (let index = 2; index < pages.length; index++) {
    assert.equal(sections.filter(({ start, end }) => index >= start && index <= end).length, 1);
  }
});

test("navigation turns whole spreads and respects the front and back of the book", () => {
  assert.equal(adjacentPage(0, -1), 0);
  assert.equal(adjacentPage(19, 1), 19);
  assert.equal(adjacentPage(0, 1), 1);
  assert.equal(adjacentPage(19, -1), 17);
  assert.equal(adjacentPage(1, -1), 0);
  assert.equal(adjacentPage(2, -1), 0);
  assert.equal(adjacentPage(1, 1), 3);
  assert.equal(adjacentPage(2, 1), 3);
  assert.equal(adjacentPage(5, 1), 7);
  assert.equal(adjacentPage(18, 1), 19);
});

test("the cover opens into contents on the left and the original resume on the right", () => {
  assert.deepEqual(spreadForPage(0), { left: null, right: 0 });
  assert.deepEqual(spreadForPage(1), { left: 1, right: 2 });
  assert.deepEqual(spreadForPage(2), { left: 1, right: 2 });
  assert.equal(pageNumber(1), "00");
  assert.equal(pageNumber(2), "02");
  assert.equal(spreadLabel(1), "00 / 02");
});

test("every interior page appears once in physical reading order", () => {
  const sequence = [];
  for (let index = adjacentPage(0, 1); ; index = adjacentPage(index, 1)) {
    sequence.push(...Object.values(spreadForPage(index)).filter((page) => page !== null));
    if (adjacentPage(index, 1) === index) break;
  }
  assert.deepEqual(sequence, Array.from({ length: 19 }, (_, index) => index + 1));
  assert.deepEqual(spreadForPage(3), { left: 3, right: 4 });
  assert.equal(spreadLabel(3), "03 / 04");
  assert.deepEqual(spreadForPage(19), { left: 19, right: null });
  assert.throws(() => spreadForPage(-1), RangeError);
  assert.throws(() => spreadForPage(20), RangeError);
});

test("mobile shows one page at a time without skipping the contents or right-hand pages", () => {
  for (let index = 0; index < pages.length; index++) {
    assert.deepEqual(viewForPage(index, true), { left: null, right: index });
    assert.equal(adjacentPage(index, 1, true), Math.min(19, index + 1));
    assert.equal(adjacentPage(index, -1, true), Math.max(0, index - 1));
  }
});

test("the cover and turning leaves have the correct front, back, and underlying pages", () => {
  const opening = turnPlan(0, 1);
  assert.equal(opening.front, 0);
  assert.equal(opening.back, 1);
  assert.equal(opening.underIndex, 2);
  assert.equal(opening.underSide, "right");
  assert.ok(opening.duration >= 1000);
  const forward = turnPlan(1, 3);
  assert.equal(forward.front, 2);
  assert.equal(forward.back, 3);
  assert.equal(forward.underIndex, 4);
  const backward = turnPlan(3, 1);
  assert.equal(backward.front, 2);
  assert.equal(backward.back, 3);
  assert.equal(backward.underSide, "left");
  assert.equal(backward.underIndex, 1);
  const mobileForward = turnPlan(1, 2, true);
  assert.equal(mobileForward.front, 1);
  assert.equal(mobileForward.back, 2);
  assert.equal(mobileForward.underIndex, 2);
  const closing = turnPlan(7, 0);
  assert.equal(closing.front, 0);
  assert.equal(closing.back, 7);
  assert.equal(closing.underSide, null);
});

test("all original figures have valid high-resolution image files", async () => {
  assert.equal(Object.values(figures).flat().length, 38);
  for (const figure of Object.values(figures).flat()) {
    assert.ok(figure.caption && figure.width > 100 && figure.height > 100);
    const artwork = await readFile(new URL(figure.image, import.meta.url));
    assert.ok(figure.bounds.left >= 0 && figure.bounds.top >= 0);
    assert.ok(figure.bounds.width > 0 && figure.bounds.height > 0);
    assert.ok(figure.bounds.left + figure.bounds.width <= 100.000001);
    assert.ok(figure.bounds.top + figure.bounds.height <= 100.000001);
    if (figure.kind === "qr") {
      assert.equal(artwork.subarray(1, 4).toString("ascii"), "PNG");
      assert.equal(figure.width, figure.height);
    } else assert.equal(artwork.readUInt16BE(0), 0xffd8);
  }
});

test("whole pages always keep the PDF's 22:17 aspect ratio and fit the reader", () => {
  assert.equal(pageDimensions.width / pageDimensions.height, 22 / 17);
  for (const [width, height] of [[1352, 796], [351, 582], [296, 310], [1800, 480]]) {
    for (const single of [false, true]) {
      const size = fitBook(width, height, single);
      assert.ok(size.width <= width + .000001 && size.height <= height + .000001);
      assert.ok(Math.abs((size.width / (single ? 1 : 2)) / size.height - 22 / 17) < .000001);
    }
  }
});

test("image popups preserve portrait, landscape, and QR image proportions", () => {
  for (const [width, height] of [[1927, 995], [603, 1356], [150, 150]]) {
    const size = fitImage(width, height, 320, 600);
    assert.ok(size.width <= 320 && size.height <= 600);
    assert.ok(Math.abs(size.width / size.height - width / height) < .000001);
  }
  assert.throws(() => fitImage(0, 100, 300, 400), RangeError);
});

test("deep links, old site links, and malformed links are handled explicitly", () => {
  assert.equal(pageIndexFromHash(""), 0);
  assert.equal(pageIndexFromHash("#"), 0);
  assert.equal(pageIndexFromHash("#%72esume"), 2);
  assert.equal(pageIndexFromHash("#about"), 2);
  assert.equal(pageIndexFromHash("#work"), 3);
  assert.equal(pageIndexFromHash("#contact"), 19);
  assert.equal(pageIndexFromHash("#missing-section"), null);
  assert.equal(pageIndexFromHash("#%invalid"), null);
  assert.equal(pageIndexFromHash("#toString"), null);
});

test("00 remains a contents shortcut while body labels match the printed PDF", () => {
  assert.equal(pageLabel(0), "Cover");
  assert.equal(pageLabel(1), "Table of contents / 00");
  assert.equal(pageLabel(2), "Resume / 02");
  assert.equal(pageLabel(19), "Thank you / 19");
});

test("contents link areas cover the eight reference rows without overlapping", () => {
  for (let row = 0; row < 8; row++) {
    const bounds = contentsBounds(row);
    assert.equal(bounds.top, (100 + row * 52) / 612 * 100);
    assert.equal(bounds.height, 52 / 612 * 100);
    assert.ok(bounds.top + bounds.height <= 100);
    if (row < 7) {
      assert.ok(Math.abs(bounds.top + bounds.height - contentsBounds(row + 1).top) < .000001);
    }
  }
});
