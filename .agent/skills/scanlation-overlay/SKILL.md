---
name: scanlation-overlay
description: This skill should be used when implementing the "Speed Mode" translation overlay using React Konva on the frontend.
version: 1.0.0
author: ZAY_HIII
created: 2026-02-11
updated: 2026-02-11
platforms: [claude-code, codex, github-copilot-cli]
category: code
tags: [frontend, canvas, konva, react, overlay]
risk: safe
---

# Frontend Graphics (React Konva)

This skill describes how to implement the "Speed Mode" (Scanlation Style) using `react-konva`.

## 1. Architecture

- **Stage**: Main canvas container.
- **Optimization**: Use `react-konva-utils` or careful memoization (`React.memo`) for layers that don't change (e.g., the base image).

## 2. Performance (React Best Practices)

- **Memoization**: The base Manga Image should be in its own Component wrapped with `memo`. It shouldn't re-render when dragging a text box.
- **Layering**:
  - `Layer 1 (Static)`: Original Image.
  - `Layer 2 (Dynamic)`: Text Boxes & Overlays. Update only this layer during interaction.
- **Heavy Operations**: If lots of boxes (50+), consider caching the layer as a bitmap using `layer.toImage()` during static viewing.

## 3. Responsive Canvas Logic

- **Strategy**: Calculate `scale` based on `window.innerWidth / image.width`.
- **Store**: Sync `scale/x/y` with Zustand but **debounce** updates if sending back to server/local-storage to avoid thrashing.

## 4. Text Rendering (Thai Font Support)

- **Font**: Use `Sarabun` or `Noto Sans Thai` imported via Google Fonts.
- **Auto-Fitting**:
  - Calculate font size dynamically based on box height.
  - **Wrapping**: Set `width` property on `Text` node to force wrap.

## 5. Interaction

- **Transformer**: Use Konva's Transformer for resizing.
- **Event Delegation**: Attach listeners to the Layer or Stage rather than individual shapes if possible, to reduce overhead (though Konva handles shape hits well).

## 6. Export

- `stageRef.current.toDataURL({ pixelRatio: 2 })` for high-quality export.
