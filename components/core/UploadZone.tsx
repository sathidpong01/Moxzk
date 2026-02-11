import { useCallback, useTransition } from "react";
import { Upload, Loader2, Sparkles } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { translateMangaPage } from "@/app/actions/translate-action";
import { toast } from "sonner";

export function UploadZone() {
  const { setFile, setPreviewUrl, setIsProcessing, setResult, isProcessing } =
    useAppStore();
  const [isPending, startTransition] = useTransition();

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 1. Update Local State for Preview
      setFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setIsProcessing(true);
      setResult(null); // Clear previous results

      // 2. Create FormData
      const formData = new FormData();
      formData.append("file", file);

      // 3. Trigger Server Action via Transition
      startTransition(async () => {
        try {
          const result = await translateMangaPage(null, formData);

          if (result.success && result.data) {
            setResult(result.data);
            toast.success("Translation Complete!", {
              description: `${result.data.bubbles.length} bubbles detected.`,
            });
          } else {
            console.error(result.error);
            toast.error("Translation Failed", { description: result.error });
          }
        } catch (err) {
          console.error(err);
          toast.error("Error", {
            description: "An unexpected error occurred.",
          });
        } finally {
          setIsProcessing(false);
        }
      });
    },
    [setFile, setPreviewUrl, setIsProcessing, setResult],
  );

  const isLoading = isProcessing || isPending;

  return (
    <div className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-base-300 rounded-xl bg-base-100 hover:bg-base-200 transition-colors w-full max-w-2xl mx-auto min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="bg-primary/10 p-4 rounded-full inline-block">
          {isLoading ? (
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
          ) : (
            <Upload className="w-12 h-12 text-primary" />
          )}
        </div>

        <h2 className="text-2xl font-bold">
          {isLoading ? "Processing Manga..." : "Upload Manga Page"}
        </h2>

        <p className="text-base-content/70 max-w-md mx-auto">
          {isLoading
            ? "AI is detecting bubbles and translating text. This typically takes 5-10 seconds."
            : "Supported formats: JPEG, PNG, WebP. Max size: 4MB."}
        </p>

        {!isLoading && (
          <label className="btn btn-primary btn-lg gap-2 cursor-pointer">
            <Sparkles className="w-5 h-5" />
            Select Image
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              disabled={isLoading}
            />
          </label>
        )}
      </div>
    </div>
  );
}
