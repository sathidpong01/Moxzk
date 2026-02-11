import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// --- Zod Schemas ---

export const BubbleSchema = z.object({
  box_2d: z
    .tuple([
      z.number().describe("ymin (0-1000)"),
      z.number().describe("xmin (0-1000)"),
      z.number().describe("ymax (0-1000)"),
      z.number().describe("xmax (0-1000)"),
    ])
    .describe("Bounding box in [ymin, xmin, ymax, xmax] format normalized to 0-1000 scale"),
  text_content: z.string().describe("Original Japanese/English text in the bubble"),
  translation: z.string().describe("Thai translation of the text"),
  type: z.enum(["speech", "sfx", "thought", "narration"]).describe("Type of bubble"),
});

export const MangaPageSchema = z.object({
  bubbles: z.array(BubbleSchema).describe("List of all detected bubbles and text regions"),
});

export type MangaPage = z.infer<typeof MangaPageSchema>;

// --- Gemini Setup ---

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Manually defined schema for Gemini 2.5 Flash strict output.
 * Using 'any' for the type definition to avoid import issues with the new SDK types for now,
 * but the structure is compliant with the API requirements.
 */
const geminiResponseSchema: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
  type: "OBJECT",
  properties: {
    bubbles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          box_2d: {
            type: "ARRAY",
            items: { type: "NUMBER" },
            description: "ymin, xmin, ymax, xmax (0-1000)",
          },
          text_content: { type: "STRING" },
          translation: { type: "STRING" },
          type: {
            type: "STRING",
            enum: ["speech", "sfx", "thought", "narration"],
          },
        },
        required: ["box_2d", "text_content", "translation", "type"],
      },
    },
  },
  required: ["bubbles"],
};

export async function translateMangaImage(imageBuffer: Buffer): Promise<MangaPage> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Analyze this manga page and extract/translate all text.",
            },
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
        responseSchema: geminiResponseSchema,
        temperature: 0.3,
        systemInstruction: `You are an expert manga translator and object detector.
1. Detect all speech bubbles, SFX, thought bubbles, and narration boxes in the image.
2. For each detected region, extracting the bounding box is the PRIORITY.
3. The bounding box (box_2d) MUST be normalized to [0, 1000] (ymin, xmin, ymax, xmax).
4. Extract the original text exactly as it appears.
5. Translate the text into natural-sounding Thai (ภาษาไทย).

Output strictly valid JSON obeying the schema.`,
      },
    });

    const responseText = response.text; // Access as property
    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    // Parse and validate with Zod
    const data = JSON.parse(responseText);
    return MangaPageSchema.parse(data);

  } catch (error) {
    console.error("Gemini Translation Error:", error);
    throw error;
  }
}
