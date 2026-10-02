import { pages, sections, contentsBounds } from "./book-model.js?v=ed28c3192de4";
import { figures } from "./figure-data.js?v=e22a73c0d59a";

export { figures };

function position(node, bounds) {
  for (const [property, value] of Object.entries(bounds)) node.style[property] = `${value}%`;
}

function zoomButton(index, figureIndex = null) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = figureIndex === null ? "page-enlarge" : "figure-enlarge";
  button.dataset.zoomPage = String(index);
  if (figureIndex !== null) button.dataset.zoomFigure = String(figureIndex);
  const label = figureIndex === null ? `${pages[index].title} page` : figures[index][figureIndex].caption;
  button.setAttribute("aria-label", `Enlarge ${label}`);
  button.setAttribute("aria-haspopup", "dialog");
  button.title = `Enlarge ${label}`;
  if (figureIndex !== null) position(button, figures[index][figureIndex].bounds);
  return button;
}

function link(label, href, bounds, pageLink = false) {
  const node = document.createElement("a");
  node.className = "page-hotspot";
  node.href = href;
  node.setAttribute("aria-label", label);
  node.title = label;
  if (pageLink) node.dataset.pageLink = "";
  position(node, bounds);
  return node;
}

export function renderPageHotspots(container, index, includePageButton = false) {
  container.replaceChildren();
  if (index === null) return;
  if (includePageButton && index !== 0) container.append(zoomButton(index));
  if (index === 1) {
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Table of contents");
    sections.forEach((section, row) => {
      nav.append(link(`${section.label}, PDF pages ${section.range}`, `#${section.id}`, contentsBounds(row), true));
    });
    container.append(nav);
  }
  (figures[index] ?? []).forEach((figure, figureIndex) => {
    container.append(zoomButton(index, figureIndex));
  });
  if (index === 2 || index === 19) {
    const resume = index === 2;
    container.append(
      link("Call Kaylie Rivera at 650-722-4302", "tel:+16507224302", resume
        ? { left: 5.3, top: 22, width: 18.5, height: 2.5 }
        : { left: 37.2, top: 53.6, width: 27, height: 3.7 }),
      link("Email Kaylie Rivera at riv_kaylie@hotmail.com", "mailto:riv_kaylie@hotmail.com", resume
        ? { left: 5.3, top: 24.5, width: 18.5, height: 2.5 }
        : { left: 37.2, top: 58, width: 27, height: 3.7 }),
    );
  }
}

export function renderPageSurface(index) {
  const surface = document.createElement("div");
  surface.className = "page-surface";
  if (index === null) return surface;
  surface.dataset.pageId = pages[index].id;
  const image = document.createElement("img");
  image.className = "page-artwork";
  image.src = pages[index].image;
  image.alt = pages[index].description;
  image.width = 1980;
  image.height = 1530;
  image.draggable = false;
  const targets = document.createElement("div");
  targets.className = "image-targets";
  renderPageHotspots(targets, index, true);
  surface.append(image, targets);
  return surface;
}
