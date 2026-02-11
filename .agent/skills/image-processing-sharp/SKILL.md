---
name: image-processing-sharp
description: This skill should be used when the user needs guidelines for high-performance image manipulation using Sharp, specifically for resizing and masking manga pages.
version: 1.0.0
author: ZAY_HIII
created: 2026-02-11
updated: 2026-02-11
platforms: [claude-code, codex, github-copilot-cli]
category: code
tags: [image-processing, sharp, nodejs, resize, masking]
risk: safe
---

# Image Processing (Sharp)

This skill defines how to use `sharp` for all server-side image manipulation in the Manga Translator project.

## 1. Input Handling

- **FormData**: API routes and Server Actions receive `FormData`.
- **Parsing**: `file.arrayBuffer()` -> `Buffer.from(arrayBuffer)`.

## 2. Core Operations

### Resizing (For AI Optimization)

Always resize images before sending to Gemini to save tokens and improve latency.

```typescript
import sharp from "sharp";

async function optimizeForAI(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside", // Preserve aspect ratio, maximize within bounds
      withoutEnlargement: true, // Never scale up small images
    })
    .jpeg({ quality: 80 }) // Compress slightly
    .toBuffer();
}
```

### Masking (For Inpainting - Optional Feature)

The "Quality Mode" requires creating a binary mask.

1. Create a `sharp({ create: { ... } })` blank canvas (black).
2. Create SVG or composite overlays based on bounding boxes (white).
3. Combine using `.composite()`.

## 3. Best Practices

- **Never rely on client-side resizing** for critical AI inputs (security/consistency).
- **Format**: Stick to `jpeg` for AI inputs as it's universally supported and smaller than PNG for photos/scans.
- **Error Handling**: Wrap sharp calls in try/catch blocks; corrupted images are common.
