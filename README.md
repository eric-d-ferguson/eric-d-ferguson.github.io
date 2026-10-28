# eric-d-ferguson.github.io

Personal site for Eric D Ferguson — hosted on GitHub Pages.

## Stack

Static site: plain HTML, CSS, and JavaScript. No build step, no dependencies.

- `index.html` — page structure and content
- `style.css` — styling (Inter font, light theme with automatic dark mode)
- `script.js` — interactivity (footer year, nav highlighting)
- `phish-game.js` — dormant hidden game, no longer wired up (see below)
- `favicon.png` — site favicon
- `og-image.png` — 1200×630 link-preview image used by the Open Graph tags

## Sections

- **Intro** — name, tagline, and links (the big top section, sometimes called a "hero" in web dev)
- **About** — bio and skills list
- **Contact** — email, GitHub, LinkedIn

## Editing content

All editable sections are marked with `<!-- EDIT: ... -->` comments in `index.html`.

## Project Links

Two side-project links under the personal paragraph in About point to other projects:

- **Phish** — links to [my-phish-stats](https://eric-d-ferguson.github.io/my-phish-stats/) ([source](https://github.com/eric-d-ferguson/my-phish-stats)), a static page of stats pulled from my phish.net show history.
- **Wood** — links out to the [cut-optimizer](https://eric-d-ferguson.github.io/cut-optimizer/) project ([source](https://github.com/eric-d-ferguson/cut-optimizer)).

### Dormant easter egg

`phish-game.js` and the `.game-shell` markup in `index.html` are a donut-dodging game that used to be triggered by clicking the Phish tag. It's no longer wired up to anything — kept in place in case it gets reused later.

## Deployment

Push to `main` — GitHub Pages deploys automatically.
