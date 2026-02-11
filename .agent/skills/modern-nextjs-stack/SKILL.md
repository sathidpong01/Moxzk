---
name: modern-nextjs-stack
description: This skill should be used when implementing architectural patterns for Next.js 16, Server Actions, React 19, and Performance Optimization within the project.
version: 1.1.0
author: ZAY_HIII
created: 2026-02-11
updated: 2026-02-11
platforms: [claude-code, codex, github-copilot-cli]
category: code
tags: [nextjs, react, server-actions, performance, architecture]
risk: safe
---

# Modern Next.js Stack (Next.js 16 + React 19)

This skill document defines the architectural patterns for the Manga Translator project.

## 1. Server Components vs Client Components

| Type                  | Use Case                                                                | Pattern                                  |
| --------------------- | ----------------------------------------------------------------------- | ---------------------------------------- |
| **Server Components** | Data fetching (Gemini), Secrets (API Keys), Heavy Logic (Sharp)         | Default. `async function Page() { ... }` |
| **Client Components** | Interactivity, Hooks (`useState`, `useAppStore`), Browser APIs (Canvas) | Add `'use client'` at top.               |

## 2. Server Actions (The Backend)

- **Location**: `app/actions/{domain}-actions.ts`.
- **Usage**: Handle Form Submissions and Mutations.
- **Pattern**:

  ```typescript
  "use server";

  import { z } from "zod";
  // Next.js 16 Server Actions
  export async function uploadAndTranslateAction(formData: FormData) {
    // Logic here
  }
  ```

## 3. Data Fetching & Caching

- **Fetch**: Use standard `fetch` with `next: { revalidate: ... }`.
- **Streaming**: Wrap heavy UI sections in `<Suspense fallback={<Loading />}>`.

## 4. State Management (Zustand + React 19)

- **Global State**: Use `zustand` for app-wide state (current page, scale).
- **Transitions**: Use `useTransition` for smooth UX updates.

## 5. Directory Structure (Feature-First)

```
app/
├── actions/         # Server Actions
├── components/
│   ├── ui/          # Generic (Button, Input) - Shadcn/Tailwind/DaisyUI
│   ├── features/    # Domain specific (MangaViewer, UploadZone)
├── lib/             # Utilities (Gemini, Sharp)
└── types/           # Shared TS Interfaces
```
