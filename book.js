import { pages, sections, pageIndexFromHash, adjacentPage, viewForPage, turnPlan, fitBook, fitImage, pageNumber, spreadLabel, sectionForPage, pageLabel } from "./book-model.js?v=a73402445041";
import { renderPageSurface, renderPageHotspots, figures } from "./page-renderer.js?v=8aac276601e4";

const book = document.getElementById("book");
const stage = document.querySelector(".book-stage");
const binding = document.getElementById("book-binding");
const spreadPages = document.getElementById("page-content");
const pageTitle = document.getElementById("page-title");
const panels = Object.fromEntries(["left", "right"].map((side) => {
  const paper = document.getElementById(`${side}-page`);
  return [side, {
    paper,
    title: paper.querySelector("h2"),
    content: paper.querySelector(".paper-content"),
  }];
}));
const turningPage = document.getElementById("turning-page");
const frontContent = document.getElementById("turn-front-content");
const backContent = document.getElementById("turn-back-content");
const previousButton = document.getElementById("previous-page");
const nextButton = document.getElementById("next-page");
const openBookButton = document.getElementById("open-book");
const pageSelect = document.getElementById("page-select");
const pageCount = document.getElementById("page-count");
const pageStatus = document.getElementById("page-status");
const readerError = document.getElementById("reader-error");
const loadingIndicator = document.getElementById("loading-indicator");
const sectionTabs = document.getElementById("section-tabs");
const zoomLeftButton = document.getElementById("zoom-left");
const zoomButton = document.getElementById("zoom-button");
const zoomDialog = document.getElementById("zoom-dialog");
const zoomImage = document.getElementById("zoom-image");
const zoomLinks = document.getElementById("zoom-links");
const zoomFrame = document.getElementById("zoom-frame");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileLayout = window.matchMedia("(max-width: 900px)");
const artworkCache = new Map();
const activeTouchPointers = new Set();
let currentIndex = 0;
let desiredIndex = 0;
let pendingNavigation = null;
let busy = false;
let ready = false;
const activeAnimations = [];
let singlePage = mobileLayout.matches;
let swipeStart = null;
let suppressClickUntil = 0;
let zoomRequest = 0;
let zoomAsset = null;
let backdropPressed = false;

function loadImage(source) {
  if (!artworkCache.has(source)) {
    const image = new Image();
    image.src = source;
    artworkCache.set(source, image.decode().catch((error) => {
      artworkCache.delete(source);
      throw error;
    }));
  }
  return artworkCache.get(source);
}

function visiblePages(index) {
  return Object.values(viewForPage(index, singlePage)).filter((page) => page !== null);
}

function loadSpread(index) {
  return Promise.all(visiblePages(index).map((page) => loadImage(pages[page].image)));
}

function showError(message) {
  readerError.textContent = message;
  readerError.hidden = false;
}

function setBusy(value) {
  const spread = viewForPage(currentIndex, singlePage);
  book.setAttribute("aria-busy", String(value));
  spreadPages.inert = value;
  previousButton.disabled = value || !ready || currentIndex === 0;
  nextButton.disabled = value || !ready || adjacentPage(currentIndex, 1, singlePage) === currentIndex;
  pageSelect.disabled = value || !ready;
  openBookButton.disabled = value || !ready;
  zoomLeftButton.disabled = value || !ready || spread.left === null;
  zoomButton.disabled = value || !ready || spread.right === null;
}

function resizeBook() {
  const style = getComputedStyle(stage);
  const width = Math.max(0, stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
  const height = Math.max(0, stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
  const size = fitBook(width, height, singlePage);
  book.style.width = `${size.width}px`;
  book.style.height = `${size.height}px`;
}

function renderPaper(side, index) {
  const panel = panels[side];
  const unchanged = panel.paper.dataset.pageIndex === String(index);
  panel.paper.classList.toggle("is-blank", index === null);
  panel.paper.dataset.pageId = index === null ? "blank" : pages[index].id;
  panel.paper.dataset.pageIndex = String(index);
  panel.title.textContent = index === null ? "Blank end page"
    : index === 0 ? "Portfolio cover" : `${pages[index].title}, page ${pageNumber(index)}`;
  if (!unchanged) panel.content.replaceChildren(renderPageSurface(index));
}

function renderTranscript(index) {
  document.getElementById("transcript-summary").textContent = singlePage ? "Read page text" : "Read spread text";
  document.getElementById("transcript-title").textContent = index === 0 ? "Portfolio cover"
    : singlePage ? pageLabel(index) : `Spread ${spreadLabel(index)}`;
  const content = document.getElementById("transcript-content");
  content.replaceChildren();
  for (const pageIndex of visiblePages(index)) {
    const page = pages[pageIndex];
    const heading = document.createElement("h3");
    heading.textContent = pageLabel(pageIndex);
    const description = document.createElement("p");
    description.textContent = page.description;
    const text = document.createElement("div");
    text.textContent = pageIndex === 1
      ? sections.map((section, row) => `${String(row + 1).padStart(2, "0")} ${section.label} / ${section.range}`).join("\n")
      : page.text || "This page presents visual project work. Enlarge the page to explore the drawings and images.";
    content.append(heading, description, text);
  }
}

function renderSpread(index) {
  const spread = viewForPage(index, singlePage);
  book.dataset.layout = singlePage ? "single" : "spread";
  resizeBook();
  book.classList.toggle("is-closed", index === 0);
  panels.left.paper.hidden = spread.left === null;
  renderPaper("left", spread.left);
  renderPaper("right", spread.right);
  openBookButton.hidden = index !== 0;
  pageTitle.textContent = index === 0 ? "Portfolio cover"
    : singlePage ? pageLabel(index) : `${pages[index].title}, spread ${spreadLabel(index)}`;
  book.dataset.pageId = pages[index].id;
  book.dataset.leftPage = spread.left === null ? "" : pages[spread.left].id;
  book.dataset.rightPage = spread.right === null ? "" : pages[spread.right].id;
  pageSelect.value = String(index);
  const sheets = visiblePages(index).map((page) => String(page + 1).padStart(2, "0"));
  pageCount.textContent = index === 0 ? "Cover" : `Sheets ${sheets.join(" - ")} / ${pages.length}`;
  const closesBook = index > 0 && adjacentPage(index, -1, singlePage) === 0;
  previousButton.setAttribute("aria-label", closesBook ? "Close book" : singlePage ? "Previous page" : "Previous spread");
  previousButton.querySelector("span").textContent = closesBook ? "Close" : "Previous";
  nextButton.setAttribute("aria-label", index === 0 ? "Open book" : singlePage ? "Next page" : "Next spread");
  nextButton.querySelector("span").textContent = index === 0 ? "Open book" : "Next";
  zoomLeftButton.hidden = spread.left === null;
  zoomButton.hidden = spread.right === null;
  document.getElementById("zoom-right-label").textContent = index === 0 ? "Enlarge cover" : singlePage ? "Enlarge page" : "Right page";
  document.getElementById("reader-hint").textContent = index === 0
    ? "Click the cover to open. Arrows or swipe turn the book."
    : singlePage ? "Swipe to turn. Tap images to enlarge."
      : "Turn with arrows. Click images to enlarge.";
  renderTranscript(index);
  const activeSection = sectionForPage(index);
  for (const link of sectionTabs.children) {
    const active = link.dataset.section === (index === 1 ? "contents" : activeSection?.id);
    if (active) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  document.title = `${pages[index].title} | Kaylie Rivera`;
  pageStatus.textContent = index === 0
    ? "Book closed. Portfolio cover."
    : visiblePages(index).map((page) => `${pages[page].title}, page ${pageNumber(page)}`).join(". ");
}

function setLeafContent(face, index) {
  const source = Object.values(panels).find((panel) => panel.paper.dataset.pageIndex === String(index));
  const surface = source?.content.querySelector(".page-surface");
  const shade = document.createElement("div");
  shade.className = "leaf-shade";
  face.replaceChildren(surface ? surface.cloneNode(true) : renderPageSurface(index), shade);
  face.dataset.pageId = index === null ? "blank" : pages[index].id;
}

function animate(node, frames, timing) {
  const animation = node.animate(frames, timing);
  activeAnimations.push(animation);
}

function finishAnimations() {
  for (const animation of activeAnimations) animation.finish();
}

async function turnSpread(targetIndex) {
  const current = viewForPage(currentIndex, singlePage);
  const target = viewForPage(targetIndex, singlePage);
  if (reducedMotion.matches || typeof turningPage.animate !== "function"
      || (current.left === target.left && current.right === target.right)) {
    renderSpread(targetIndex);
    return;
  }
  const plan = turnPlan(currentIndex, targetIndex, singlePage);
  setLeafContent(frontContent, plan.front);
  setLeafContent(backContent, plan.back);
  if (plan.opening) {
    book.classList.remove("is-closed");
    book.classList.add("is-opening");
    panels.left.paper.hidden = target.left === null;
    renderPaper("left", target.left);
    openBookButton.hidden = true;
  } else if (plan.closing) {
    book.classList.add("is-closing");
  }
  if (plan.underSide) renderPaper(plan.underSide, plan.underIndex);
  book.classList.add("is-turning");
  turningPage.hidden = false;
  const timing = {
    duration: plan.duration,
    easing: "cubic-bezier(.4, 0, .2, 1)",
    fill: "both",
  };
  // Keep the leaf's hinge fixed. Move the entire binding when centering a closing cover.
  animate(turningPage, [
    { transform: `rotateY(${plan.forward ? 0 : -180}deg)` },
    { transform: `rotateY(${plan.forward ? -180 : 0}deg)` },
  ], timing);
  if (!singlePage && (plan.opening || plan.closing)) {
    animate(binding, [
      { transform: plan.opening ? "translateX(-25%)" : "translateX(0)" },
      { transform: plan.opening ? "translateX(0)" : "translateX(-25%)" },
    ], timing);
  }
  if (!plan.opening && !plan.closing) {
    const bend = plan.forward ? 2.2 : -2.2;
    for (const [face, direction] of [[frontContent, 1], [backContent, -1]]) {
      animate(face, [{ transform: "skewY(0deg)" }, { transform: `skewY(${bend * direction}deg)`, offset: .5 }, { transform: "skewY(0deg)" }], timing);
    }
  }
  for (const shade of turningPage.querySelectorAll(".leaf-shade")) {
    animate(shade, [{ opacity: 0 }, { opacity: .22, offset: .5 }, { opacity: 0 }], timing);
  }
  try {
    await Promise.all(activeAnimations.map((animation) => animation.finished));
    renderSpread(targetIndex);
  } catch (error) {
    renderSpread(currentIndex);
    throw error;
  } finally {
    turningPage.hidden = true;
    for (const animation of activeAnimations) animation.cancel();
    activeAnimations.length = 0;
    book.classList.remove("is-opening", "is-closing", "is-turning");
  }
}

function updateAddress(index, mode) {
  if (mode === "none") return;
  const hash = `#${pages[index].id}`;
  if (window.location.hash === hash) return;
  window.history[mode === "replace" ? "replaceState" : "pushState"](null, "", hash);
}

function preloadNeighbors() {
  for (const index of new Set([adjacentPage(currentIndex, -1, singlePage), adjacentPage(currentIndex, 1, singlePage)])) {
    if (index === currentIndex) continue;
    loadSpread(index).catch((error) => {
      console.warn(`Could not preload spread ${spreadLabel(index)}. Navigation will retry.`, error);
    });
  }
}

async function processNavigation() {
  if (busy) return;
  busy = true;
  setBusy(true);
  let focusPage = false;
  try {
    while (pendingNavigation) {
      const request = pendingNavigation;
      pendingNavigation = null;
      readerError.hidden = true;
      loadingIndicator.hidden = false;
      try {
        await loadSpread(request.index);
      } catch (error) {
        console.error(`Unable to load portfolio spread ${spreadLabel(request.index)}.`, error);
        showError("This spread couldn't load. Please try again, or use Download PDF to view the original portfolio.");
        if (ready && !pendingNavigation) updateAddress(currentIndex, "replace");
        continue;
      } finally {
        loadingIndicator.hidden = true;
      }
      // A newer request can supersede image loading, but never interrupt a turning leaf.
      if (pendingNavigation && pendingNavigation.index !== request.index) continue;
      if (!ready) renderSpread(request.index);
      else if (request.index !== currentIndex) await turnSpread(request.index);
      currentIndex = request.index;
      ready = true;
      if (!pendingNavigation) updateAddress(currentIndex, request.history);
      focusPage = request.focus;
      if (request.error) showError(request.error);
    }
  } finally {
    busy = false;
    desiredIndex = currentIndex;
    pageSelect.value = String(currentIndex);
    setBusy(false);
    if (focusPage) pageTitle.focus({ preventScroll: true });
    if (ready) preloadNeighbors();
  }
}

function navigateTo(index, { history = "push", focus = false, error = "" } = {}) {
  viewForPage(index, singlePage);
  if (zoomDialog.open && index !== currentIndex) zoomDialog.close();
  desiredIndex = index;
  pendingNavigation = { index, history, focus, error };
  processNavigation().catch((navigationError) => {
    console.error("Portfolio navigation failed.", navigationError);
    showError("The page turn couldn't finish. Please try again, or use Download PDF to view the portfolio.");
  });
}

function navigateFromAddress() {
  const index = pageIndexFromHash(window.location.hash);
  if (index === null) {
    const message = "This link doesn't match a portfolio section. Choose Contents or a page from the menu.";
    if (!ready) navigateTo(0, { history: "none", error: message });
    else showError(message);
    return;
  }
  if (ready && index === desiredIndex) return;
  navigateTo(index, { history: "none" });
}

pageSelect.replaceChildren(...pages.map((page, index) => {
  const option = document.createElement("option");
  option.value = String(index);
  option.textContent = pageLabel(index);
  return option;
}));

const bookmarks = [{ id: "contents", label: "Table of contents", range: "00", color: "#ffffff" }, ...sections];
bookmarks.forEach((section, row) => {
  const link = document.createElement("a");
  link.className = `section-tab${row === 0 ? " contents-tab" : ""}`;
  link.href = `#${section.id}`;
  link.dataset.pageLink = "";
  link.dataset.section = section.id;
  link.style.setProperty("--section-color", section.color);
  link.setAttribute("aria-label", `${section.label}, portfolio pages ${section.range}`);
  link.title = section.label;
  const number = document.createElement("span");
  number.className = "section-number";
  number.textContent = String(row).padStart(2, "0");
  number.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "section-label";
  label.textContent = section.label;
  label.setAttribute("aria-hidden", "true");
  link.append(number, label);
  sectionTabs.append(link);
});

previousButton.addEventListener("click", () => navigateTo(adjacentPage(desiredIndex, -1, singlePage)));
nextButton.addEventListener("click", () => navigateTo(adjacentPage(desiredIndex, 1, singlePage)));
openBookButton.addEventListener("click", () => navigateTo(1));
pageSelect.addEventListener("change", () => navigateTo(Number(pageSelect.value)));
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  const portfolio = document.getElementById("portfolio");
  portfolio.focus();
  portfolio.scrollIntoView({ block: "start" });
});

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (book.contains(event.target) && Date.now() < suppressClickUntil) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const imageButton = event.target.closest("button[data-zoom-page]");
  if (imageButton) {
    openZoom(Number(imageButton.dataset.zoomPage),
      imageButton.dataset.zoomFigure === undefined ? null : Number(imageButton.dataset.zoomFigure));
    return;
  }
  const link = event.target.closest("a[data-page-link]");
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const index = pageIndexFromHash(link.hash);
  event.preventDefault();
  if (index === null) {
    showError("This section link isn't available. Choose a page from the page menu.");
    return;
  }
  if (zoomDialog.open) zoomDialog.close();
  navigateTo(index, { focus: link.closest(".paper") !== null || link.closest(".header-links") !== null || link.classList.contains("page-hotspot") });
}, true);

document.addEventListener("keydown", (event) => {
  if (zoomDialog.open) {
    if (event.key === "Escape") {
      event.preventDefault();
      zoomDialog.close();
    }
    return;
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
  const destinations = {
    ArrowRight: adjacentPage(desiredIndex, 1, singlePage),
    PageDown: adjacentPage(desiredIndex, 1, singlePage),
    ArrowLeft: adjacentPage(desiredIndex, -1, singlePage),
    PageUp: adjacentPage(desiredIndex, -1, singlePage),
    Home: 0,
    End: pages.length - 1,
  };
  if (!(event.key in destinations)) return;
  event.preventDefault();
  navigateTo(destinations[event.key]);
});

book.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
  if (event.target instanceof Element && event.target.closest(".section-tabs")) return;
  activeTouchPointers.add(event.pointerId);
  if (activeTouchPointers.size !== 1) {
    swipeStart = null;
    return;
  }
  swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY, time: Date.now() };
});
window.addEventListener("pointerup", (event) => {
  activeTouchPointers.delete(event.pointerId);
  if (!swipeStart || swipeStart.id !== event.pointerId) return;
  const { x, y, time } = swipeStart;
  swipeStart = null;
  const distanceX = event.clientX - x;
  const distanceY = event.clientY - y;
  const threshold = Math.max(44, book.clientWidth * .08);
  if (Date.now() - time > 1200 || Math.abs(distanceX) < threshold || Math.abs(distanceY) > Math.abs(distanceX) * .7) return;
  suppressClickUntil = Date.now() + 350;
  navigateTo(adjacentPage(desiredIndex, distanceX < 0 ? 1 : -1, singlePage));
});
window.addEventListener("pointercancel", (event) => {
  activeTouchPointers.delete(event.pointerId);
  swipeStart = null;
});

function resizeZoom() {
  if (!zoomAsset) return;
  const style = getComputedStyle(zoomDialog);
  const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const toolbar = zoomDialog.querySelector(".zoom-toolbar");
  const width = Math.max(0, Math.min(1600, window.innerWidth - paddingX - 34));
  const height = Math.max(0, window.innerHeight - paddingY - (toolbar.clientHeight || 80) - 34);
  const size = fitImage(zoomAsset.width, zoomAsset.height,
    zoomAsset.qr ? Math.min(width, 560) : width, zoomAsset.qr ? Math.min(height, 560) : height);
  zoomFrame.style.width = `${size.width}px`;
  zoomFrame.style.height = `${size.height}px`;
}

async function openZoom(index, figureIndex = null) {
  if (index === null) return;
  if (!Number.isInteger(index) || !pages[index] || (figureIndex !== null
      && (!Number.isInteger(figureIndex) || !figures[index]?.[figureIndex]))) {
    console.error("An invalid portfolio image was requested.", { index, figureIndex });
    showError("This image isn't available. Choose another image or use Download PDF.");
    return;
  }
  const request = ++zoomRequest;
  const page = pages[index];
  const figure = figureIndex === null ? null : figures[index][figureIndex];
  const asset = figure
    ? { image: figure.image, width: figure.width, height: figure.height, caption: figure.caption, qr: figure.kind === "qr" }
    : { image: page.image, width: 1980, height: 1530, caption: page.title, qr: false };
  try {
    await loadImage(asset.image);
  } catch (error) {
    console.error(`Unable to enlarge ${asset.caption}.`, error);
    showError("This image couldn't load. Try again or use Download PDF.");
    return;
  }
  if (request !== zoomRequest || !visiblePages(currentIndex).includes(index)) return;
  zoomAsset = asset;
  document.getElementById("zoom-title").textContent = asset.caption;
  zoomImage.src = asset.image;
  zoomImage.alt = figure ? figure.caption : page.description;
  zoomImage.classList.toggle("is-qr", asset.qr);
  zoomImage.width = asset.width;
  zoomImage.height = asset.height;
  if (figureIndex === null) renderPageHotspots(zoomLinks, index);
  else zoomLinks.replaceChildren();
  resizeZoom();
  if (!zoomDialog.open) zoomDialog.showModal();
  resizeZoom();
  document.getElementById("close-zoom").focus({ preventScroll: true });
}

zoomLeftButton.addEventListener("click", () => openZoom(viewForPage(currentIndex, singlePage).left));
zoomButton.addEventListener("click", () => openZoom(viewForPage(currentIndex, singlePage).right));
document.getElementById("close-zoom").addEventListener("click", () => zoomDialog.close());
zoomDialog.addEventListener("pointerdown", (event) => {
  backdropPressed = event.target === zoomDialog;
});
zoomDialog.addEventListener("click", (event) => {
  if (event.target === zoomDialog && backdropPressed) zoomDialog.close();
});
zoomDialog.addEventListener("close", () => {
  ++zoomRequest;
  zoomAsset = null;
});
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) finishAnimations();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) finishAnimations();
});
mobileLayout.addEventListener("change", () => {
  singlePage = mobileLayout.matches;
  finishAnimations();
  if (ready && !busy) {
    renderSpread(currentIndex);
    setBusy(false);
    preloadNeighbors();
  }
});
new ResizeObserver(resizeBook).observe(stage);
window.addEventListener("resize", resizeZoom);
window.addEventListener("hashchange", navigateFromAddress);
window.addEventListener("popstate", navigateFromAddress);
navigateFromAddress();
