# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

GitHub profile repository (username `Enigma-Soul`). Renders a customized profile page via `README.md` and hosts static HTML pages on GitHub Pages. No build system, package manager, or framework — pure static HTML/CSS/JS and Markdown.

## Development

There are no build/test/lint commands. To preview changes:
- Open `index.html` or tool pages directly in a browser (ES module 需本地 HTTP 服务器，如 `npx serve` 或 `python -m http.server`)
- 或 push 到远程分支后通过 GitHub Pages 验证 (`https://enigma-soul.github.io/Enigma-Soul/`)

README.md renders as the GitHub profile page — changes are visible immediately on push.

## Git 规范

- 默认 push 到 `develop` 分支，不直接 push 到 `main`
- commit 不加 `Co-Authored-By`、`Signed-off-by` 等附加行

## Architecture

Three independent GitHub Pages apps and one Actions workflow:

**`index.html` + `fonts/`** — Minimal landing page displaying "Future" using the `AlimamaAgile` variable font with font-variation-settings.

**`random-repo/`** — Random GitHub repo redirector. Entry point linked from README via `badge.svg`.
- 3D CSS dice (6-face cube with `transform-style: preserve-3d`, `grid-area` dot positioning) auto-rolls every 3s via accumulated `spinCount` rotation
- Canvas particle background with faint connection lines, color adapts to theme
- Dark/light theme via `data-theme` attribute on `<html>`, persisted in `localStorage`
- GitHub Search API (`stars:>100`) with `sessionStorage` cache (1-hour TTL)
- Auto-redirects on `DOMContentLoaded`; stops auto-roll during redirect, resumes on error

**`tools/cipher/`** — Image and video pixel-level encryption/decryption tool.
- `cipher.js` — Pure ES module algorithm library (Gilbert curve + block shuffle), no DOM dependencies
- `app.js` — UI logic, imports from `./cipher.js`
- `style.css` — CSS custom properties theming (`data-theme="dark|light"`), blue color scheme
- `index.html` — HTML skeleton, favicon inline SVG (data URI)
- 图片处理：`createImageBitmap` → `OffscreenCanvas` → `cipher.js` map → `applyMap` → blob
- 视频处理：WebGL2 UV texture remap shader + `requestAnimationFrame` render loop + `MediaRecorder` export

**`.github/workflows/snk.yml`** → `output` branch — Generates snake contribution SVGs via `Platane/snk/svg-only@v3`, deployed to `output` branch, embedded in README with dark/light `<picture>` variants.

## tools/ 规范

每个工具独立目录：`tools/<tool-name>/index.html`。共用算法库放 `tools/<tool-name>/` 下。详见 `tools/README.md`。

UI 规范：
- 主题：`<html data-theme="dark|light">` + CSS 自定义属性，localStorage 持久化
- 响应式：750px 桌面端分界，400px 小屏适配
- 无外部依赖（不用 JSZip/FileSaver 等）

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
