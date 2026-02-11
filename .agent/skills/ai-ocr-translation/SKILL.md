---
name: ai-ocr-translation
description: This skill should be used when the user needs guidelines for implementing Google Gemini 2.5 Flash for Manga OCR & Translation using structured JSON output.
version: 1.1.0
author: ZAY_HIII
created: 2026-02-11
updated: 2026-02-11
platforms: [claude-code, codex, github-copilot-cli]
category: code
tags: [ai, ocr, translation, gemini, zod, nextjs16]
risk: safe
---

# AI OCR & Translation (Gemini 2.5 Flash)

This skill defines how to invoke Google's Gemini API for extracting text from manga pages and translating it to Thai, using the new `@google/genai` SDK.

## 1. Model Selection

- **Primary**: `gemini-2.5-flash` (Newest, best price/performance).
- **Secondary**: `gemini-2.0-flash` (Stable backup).

## 2. Input Format

- Convert images to `Buffer` (JPEG/PNG).
- Resize to max dimension **2048px** (preserve aspect ratio) using `sharp` before sending.

## 3. Zod Schema (Strict Output)

Use strict schema validation to ensure the AI returns usable JSON.

```typescript
import { z } from "zod";

export const BubbleSchema = z.object({
  box_2d: z.tuple([
    z.number().describe("ymin (0-1000)"),
    z.number().describe("xmin (0-1000)"),
    z.number().describe("ymax (0-1000)"),
    z.number().describe("xmax (0-1000)"),
  ]),
  text_content: z
    .string()
    .describe("Original Japanese/English text in the bubble"),
  translation: z.string().describe("Thai translation of the text"),
  type: z
    .enum(["speech", "sfx", "thought", "narration"])
    .describe("Type of bubble"),
});

export const MangaPageSchema = z.object({
  bubbles: z.array(BubbleSchema),
});
```

## 4. Implementation Pattern (@google/genai)

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function translateImage(imageBuffer: Buffer) {
  const { response } = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        parts: [
          { text: "Extract speech bubbles and translate to Thai..." },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBuffer.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: zodToGeminiSchema(MangaPageSchema), // Helper needed to convert Zod -> Gemini Schema
    },
  });

  return JSON.parse(response.text());
}
```

## 5. Error Handling

- **Safety Settings**: Set `BLOCK_NONE` for all categories.
- **Retries**: Implement simple retry logic (max 3 times).
