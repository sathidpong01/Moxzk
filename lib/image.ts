import sharp from "sharp";

/**
 * Optimizes an image for Gemini AI consumption.
 * - Resizes to max 2048x2048 (preserving aspect ratio) to fit context window.
 * - Converts to JPEG to ensure compatibility and reduce token size.
 */
export async function optimizeImageForAI(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .resize({
        width: 2048,
        height: 2048,
        fit: "inside", // Preserves aspect ratio, fits within dimensions
        withoutEnlargement: true, // Don't upscale small images
      })
      .jpeg({
        quality: 80, // Good balance for OCR/Vision
        mozjpeg: true, // Better compression
      })
      .toBuffer();
  } catch (error) {
    console.error("Image optimization failed:", error);
    throw new Error("Failed to process image");
  }
}
