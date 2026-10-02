# Kaylie Rivera's portfolio

A static, animated portfolio book based on **Kaylie Rivera - Portfolio 2026.pdf**. Each of its 20 pages displays the original PDF artwork, including the creator's typography, spacing, image placement, and printed contents numbers. Pages keep the original **792 x 612 / 22:17** proportions and fit completely inside the reader. There is no reflow, stretching, cropping, or scrolling inside the book pages.

Desktop displays two-page spreads. Mobile and narrow windows (900px and below) display one complete page at a time. There are no runtime dependencies or build steps; the site is GitHub Pages-compatible.

## Preview

Serve the repository with any static HTTP server. For example:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. The source site uses JavaScript modules, so opening the source HTML directly is not supported.

## Reading the book

- The book starts closed with the original front cover. Clicking the cover or **Open book** reveals the contents and resume together on desktop, or the contents alone on mobile.
- Previous / Next, Left / Right arrow keys, Page Up / Page Down, and horizontal touch swipes turn the pages.
- The cover opens in 1.05 seconds. Paper turns take 820ms on desktop and 700ms on mobile. Cover and leaves share the same spine and use the correct front/back artwork.
- The top-left name/title and Home close the book back to its cover. End opens the final page.
- The white **00** bookmark always returns to the contents. This is an interface shortcut, not a change to the PDF's printed numbering. The original contents rows are clickable, and their printed page ranges are preserved. The sheet counter includes all 20 PDF sheets, including the cover.
- Click a photograph, diagram, logo, or the resume QR code to enlarge that specific image in a popup. Click elsewhere on an interior page, or use **Enlarge page**, to view the whole page.
- The popup preserves the image's proportions and fits it inside the window without internal scrolling. Close it using **Close**, Escape, or the slightly blurred background. The QR image is a lossless, pixel-identical PNG copy of the original embedded QR, enlarged with crisp pixels and a white quiet zone.
- Contents and image links also work inside the full-page popup. Phone and email links remain clickable.
- **Read spread text** / **Read page text**, outside the booklet, exposes extracted text as selectable HTML for accessibility without changing the printed design.
- Browser Back / Forward, shareable page hashes, original `#about`, `#work`, and `#contact` links, responsive layout changes, and reduced-motion preferences remain supported.

Proportions take priority over filling every pixel of the screen. Space around the book is intentional when the window's shape differs from the landscape PDF. The original PDF download is unchanged.

## Files and deployment

- [index.html](index.html) and [style.css](style.css): compact reader and image lightbox.
- [book.js](book.js): page turns, proportional sizing, navigation, image loading, and popup controls.
- [book-model.js](book-model.js): PDF dimensions, spread order, image fitting, printed ranges, and URL handling.
- [page-renderer.js](page-renderer.js): original page images and invisible interactive hit areas. No artwork text is recreated or overlaid.
- [figure-data.js](figure-data.js) and [assets/figures](assets/figures): original picture regions and enlarged-image assets, including the lossless QR.
- [portfolio-data.js](portfolio-data.js) and [assets/pages](assets/pages): original full-page artwork and extracted text.

Deploy these files and the original PDF with [CNAME](CNAME). All production URLs are relative. If the PDF changes, re-render its full pages and picture crops, and update metadata, printed contents ranges, and image hit areas. Replacing only the PDF does not update the book.

## Checks

Node.js is needed only for development checks:

```powershell
npm.cmd test
npm.cmd run check
```

Tests cover page and figure assets, original numbering, desktop / mobile order, leaf faces, opening speed, exact page proportions, fitted portrait / landscape / QR images, URL aliases, and contents hit areas.
