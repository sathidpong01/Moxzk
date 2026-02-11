"use server";


import { optimizeImageForAI } from "@/lib/image";
import { translateMangaImage, MangaPage } from "@/lib/gemini";

// Define the return type for the server action
export type TranslateActionState = {
  success: boolean;
  data?: MangaPage;
  error?: string;
  originalImageBase64?: string; // Returning base64 for preview simplicity
};

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB Limit (Client checks first, but server validates too)
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function translateMangaPage(
  prevState: TranslateActionState | null,
  formData: FormData
): Promise<TranslateActionState> {
  const file = formData.get("file") as File | null;

  if (!file) {
    return { success: false, error: "No file uploaded" };
  }

  // Basic Validation
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File size exceeds 4MB limit." };
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { success: false, error: "Only JPEG, PNG, and WebP are allowed." };
  }

  try {
    // 1. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Optimize image (Resize/Compress)
    const optimizedBuffer = await optimizeImageForAI(buffer);

    // 3. Call Gemini AI
    const mangaData = await translateMangaImage(optimizedBuffer);

    // 4. Return result
    // Note: In production, we'd upload the image to S3/Blob storage and return a URL.
    // For this prototype, we'll return the base64 string to render immediately.
    const base64Image = `data:image/jpeg;base64,${optimizedBuffer.toString("base64")}`;

    return {
      success: true,
      data: mangaData,
      originalImageBase64: base64Image,
    };
  } catch (error) {
    console.error("Translation Action Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }
}
