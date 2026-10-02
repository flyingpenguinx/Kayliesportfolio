import { pages } from "./portfolio-data.js";

export { pages };

export const sections = [
  { id: "resume", label: "Resume", start: 2, end: 2, range: "2", color: "#9b4960" },
  { id: "scholars-village", label: "Scholars Village", start: 3, end: 4, range: "3-4", color: "#7d8274" },
  { id: "sfo-internship", label: "SFO Internship", start: 5, end: 8, range: "5-8", color: "#9dc7f3" },
  { id: "mixed-use-development", label: "Mixed-use Development", start: 9, end: 12, range: "9-12", color: "#97684c" },
  { id: "design-village-2026", label: "Design Village 2026", start: 13, end: 14, range: "13-14", color: "#323246" },
  { id: "logo-design", label: "Logo Design", start: 15, end: 15, range: "15", color: "#a26ab5" },
  { id: "japan-study-abroad", label: "Japan Study Abroad", start: 16, end: 18, range: "16-18", color: "#bd5c3c" },
  { id: "thank-you", label: "Thank you", start: 19, end: 19, range: "19", color: "#bfc1c5" },
];

const aliases = { about: "resume", work: "scholars-village", contact: "thank-you" };

export const pageDimensions = { width: 792, height: 612 };

export function fitImage(width, height, availableWidth, availableHeight) {
  if (![width, height, availableWidth, availableHeight].every(Number.isFinite)
      || width <= 0 || height <= 0 || availableWidth < 0 || availableHeight < 0) {
    throw new RangeError("Image dimensions and available bounds must be valid.");
  }
  const scale = Math.min(availableWidth / width, availableHeight / height);
  return { width: width * scale, height: height * scale };
}

export function fitBook(availableWidth, availableHeight, singlePage = false) {
  return fitImage(pageDimensions.width * (singlePage ? 1 : 2), pageDimensions.height, availableWidth, availableHeight);
}

export function pageIndexFromHash(hash) {
  if (!hash || hash === "#") return 0;
  let id;
  try {
    id = decodeURIComponent(hash.replace(/^#/, ""));
  } catch (error) {
    if (error instanceof URIError) return null;
    throw error;
  }
  const index = pages.findIndex((page) => page.id === (aliases[id] ?? id));
  return index === -1 ? null : index;
}

export function adjacentPage(index, direction, singlePage = false) {
  spreadForPage(index);
  if (singlePage) return Math.max(0, Math.min(pages.length - 1, index + Math.sign(direction)));
  const start = spreadForPage(index).left ?? 0;
  if (direction > 0) return start === 0 ? 1 : Math.min(pages.length - 1, start + 2);
  if (direction < 0) return start <= 1 ? 0 : start - 2;
  return index;
}

export function viewForPage(index, singlePage = false) {
  const spread = spreadForPage(index);
  return singlePage ? { left: null, right: index } : spread;
}

export function turnPlan(from, to, singlePage = false) {
  const current = viewForPage(from, singlePage);
  const target = viewForPage(to, singlePage);
  const forward = to > from;
  const opening = from === 0;
  const closing = to === 0;
  return {
    forward,
    opening,
    closing,
    front: closing || opening ? 0 : forward ? current.right : target.right,
    back: singlePage ? (forward ? to : from) : (forward ? target.left : current.left),
    underSide: singlePage ? (forward ? "right" : null) : opening ? "right" : closing ? null : forward ? "right" : "left",
    underIndex: singlePage ? to : forward ? target.right : target.left,
    duration: opening ? 1050 : closing ? 1000 : singlePage ? 700 : 820,
  };
}

export function spreadForPage(index) {
  if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
    throw new RangeError("Portfolio page index is out of range.");
  }
  if (index === 0) return { left: null, right: 0 };
  const left = index % 2 === 1 ? index : index - 1;
  return { left, right: left + 1 < pages.length ? left + 1 : null };
}

export function pageNumber(index) {
  return index === 0 ? "" : index === 1 ? "00" : String(index).padStart(2, "0");
}

export function spreadLabel(index) {
  const { left, right } = spreadForPage(index);
  if (left === null) return "Cover";
  return right === null ? pageNumber(left) : `${pageNumber(left)} / ${pageNumber(right)}`;
}

export function sectionForPage(index) {
  return sections.find((section) => index >= section.start && index <= section.end) ?? null;
}

export function pageLabel(index) {
  return index === 0 ? "Cover" : `${pages[index].title} / ${pageNumber(index)}`;
}

export function contentsBounds(row) {
  // The reference PDF is 792 x 612 pt, with eight rows at 52 pt intervals.
  return { left: 0, top: (100 + row * 52) / 612 * 100, width: 96, height: 52 / 612 * 100 };
}
