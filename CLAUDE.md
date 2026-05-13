# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a GitHub profile repository (username `Enigma-Soul`). It renders a customized GitHub profile page via `README.md` and hosts two static HTML pages on GitHub Pages. There is no build system, package manager, or framework — everything is static HTML/CSS/JS and Markdown.

## Repository Structure

- `README.md` — The GitHub profile page. Assembles visual elements using external badge/visualization services: capsule-render (animated header/footer), readme-typing-svg (multilingual typing animation), github-readme-stats (activity cards), shields.io (tech badges), github-readme-activity-graph (contribution graph), stats.justsong.cn (GitHub/Bilibili stats), gitanimals (farm visualization).
- `index.html` — Minimal GitHub Pages site displaying "Future" using the custom `AlimamaAgile` variable font.
- `random-repo/` — Standalone GitHub Pages app that fetches popular repos via GitHub Search API and redirects to a random one. Caches results in sessionStorage (1-hour TTL). Features a 3D CSS dice with auto-roll animation (every 3s), particle background, and dark/light theme toggle.
  - `index.html` — Page structure
  - `style.css` — Styles (dark/light themes, dice grid, particles, animations)
  - `script.js` — Logic (particles, theme toggle, dice rotation, GitHub API, redirect)
  - `badge.svg` — Badge icon for the README entry, animated gradient border with dice icon
- `fonts/` — Custom variable font `AlimamaAgile` (WOFF/WOFF2) used by `index.html`.
- `octo/` — Image assets for the Octo Ring webring navigation (header, prev/next/random buttons).
- `output` branch — Stores auto-generated snake contribution SVGs (light/dark variants), deployed by the GitHub Actions workflow.

## GitHub Actions Workflow

`.github/workflows/snk.yml` runs the `Platane/snk/svg-only@v3` action to generate animated SVG snake game visualizations from the contribution graph. It triggers on:
- Cron schedule (every 24 hours)
- Push to `main`
- Manual `workflow_dispatch`

Output SVGs are pushed to the `output` branch via `crazy-max/ghaction-github-pages@v3.1.0` and embedded in README.md.

## Key External Services

The profile depends on these external APIs/services being available:
- `capsule-render.vercel.app` — Animated gradient banners
- `readme-typing-svg.demolab.com` — Typing SVG animation
- `count.getloli.com` — Visitor counter
- `github-readme-stats.vercel.app` — GitHub stats cards
- `github-readme-activity-graph.vercel.app` — Activity graph
- `stats.justsong.cn` — GitHub/Bilibili stats (Bilibili UID: 3493258967648353)
- `render.gitanimals.org` — Git Animals farm
- `octo-ring.com` — Octo Ring webring

## Language

The user communicates in Chinese. README content mixes Chinese and English. Respond and write documentation in Chinese unless otherwise specified.
