---
name: frontend-styling-tailwind
description: This skill should be used when implementing frontend styles using Tailwind CSS v4, daisyUI, and Mobile-First design principles.
version: 1.1.0
author: ZAY_HIII
created: 2026-02-11
updated: 2026-02-11
platforms: [claude-code, codex, github-copilot-cli]
category: code
tags: [tailwind, css, styling, daisyui, oklch]
risk: safe
---

# Frontend Styling (Tailwind CSS v4 + daisyUI)

This skill defines the styling strategy, leveraging Tailwind v4 and daisyUI for rapid component development.

## 1. Configuration (CSS-First)

We use CSS variables for theming.

```css
/* app/globals.css */
@theme {
  /* Semantic Colors (OKLCH) */
  --color-primary: oklch(0.7 0.15 250);
  --font-thai: "Sarabun", sans-serif;
}
```

## 2. daisyUI Integration

- **Role**: Use daisyUI for complex interactive components (Modals, Drawers, Dropdowns, Toggles) to avoid reinventing the wheel.
- **Customization**: Override daisyUI variables in `@theme` if needed, or use utility classes to tweak.
- **Theme**: Use daisyUI themes (e.g., `light`, `dark`, `cupcake`) via `data-theme` attribute on the `html` tag.

### Common Components

- **Buttons**: `btn btn-primary`, `btn btn-ghost`
- **Inputs**: `input input-bordered w-full`
- **Layout**: `drawer` for sidebars, `modal` for settings.

## 3. Responsive Design (Mobile-First)

- **Bad**: `w-1/2 sm:w-full`
- **Good**: `w-full sm:w-1/2 md:w-1/3`

## 4. Dark Mode

- Use daisyUI's built-in theme switching or `dark:` utilities.
- Ensure `data-theme` is updated dynamically by the Theme Controller.

## 5. Animation

- Use `animate-spin` for loading.
- Use `framer-motion` for page transitions.
