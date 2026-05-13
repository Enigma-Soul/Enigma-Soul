# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GitHub profile repository (username `Enigma-Soul`). Renders a customized profile page via `README.md` and hosts static HTML pages on GitHub Pages. No build system, package manager, or framework — pure static HTML/CSS/JS and Markdown.

## Development

There are no build/test/lint commands. To preview changes:
- Open `index.html` or `random-repo/index.html` directly in a browser
- Or push to `main` and verify via GitHub Pages (`https://enigma-soul.github.io/Enigma-Soul/`)

README.md renders as the GitHub profile page — changes are visible immediately on push.

## Architecture

Two independent GitHub Pages apps and one Actions workflow:

**`index.html` + `fonts/`** — Minimal landing page displaying "Future" using the `AlimamaAgile` variable font with font-variation-settings.

**`random-repo/`** — Random GitHub repo redirector. Entry point linked from README via `badge.svg`.
- 3D CSS dice (6-face cube with `transform-style: preserve-3d`, `grid-area` dot positioning) auto-rolls every 3s via accumulated `spinCount` rotation
- Canvas particle background with faint connection lines, color adapts to theme
- Dark/light theme via `data-theme` attribute on `<html>`, persisted in `localStorage`
- GitHub Search API (`stars:>100`) with `sessionStorage` cache (1-hour TTL)
- Auto-redirects on `DOMContentLoaded`; stops auto-roll during redirect, resumes on error

**`.github/workflows/snk.yml`** → `output` branch — Generates snake contribution SVGs via `Platane/snk/svg-only@v3`, deployed to `output` branch, embedded in README with dark/light `<picture>` variants.

## README.md Pattern

README uses the `#gh-dark-mode-only` / `#gh-light-mode-only` fragment trick on image links to serve theme-appropriate variants of the same card. All visual content comes from external badge/visualization services — no local image assets except `octo/` (webring navigation) and `random-repo/badge.svg`.

## External Service Dependencies

- `capsule-render.vercel.app` — Animated gradient header/footer banners
- `readme-typing-svg.demolab.com` — Typing SVG animation
- `count.getloli.com` — Visitor counter
- `github-readme-stats.vercel.app` — Stats and language cards
- `github-readme-activity-graph.vercel.app` — Contribution graph
- `stats.justsong.cn` — GitHub/Bilibili stats (Bilibili UID: 3493258967648353)
- `render.gitanimals.org` — Git Animals farm
- `octo-ring.com` — Octo Ring webring
- GitHub Search API — Used by `random-repo/script.js` for fetching popular repos

## Language

The user communicates in Chinese. Respond and write documentation in Chinese unless otherwise specified.
