import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Trash2, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { validateImageFiles } from '../../utils/fileValidation'

interface ImageUploaderProps {
  onImagesSelected: (files: File[]) => void
  selectedImages: File[]
}

export default function ImageUploader({ onImagesSelected, selectedImages }: ImageUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const imageFiles = acceptedFiles.filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length === 0) return
      const validation = await validateImageFiles(imageFiles)
      if (!validation.valid) {
        toast.error(validation.error)
        return
      }
      onImagesSelected([...selectedImages, ...imageFiles])
      const newPreviews = imageFiles.map((f) => URL.createObjectURL(f))
      setPreviews((prev) => [...prev, ...newPreviews])
    },
    [onImagesSelected, selectedImages],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple: true,
  })

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files: File[] = []
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length > 0) onDrop(files)
    },
    [onDrop],
  )

  const handleRemove = useCallback(
    (index: number) => {
      URL.revokeObjectURL(previews[index])
      setPreviews((prev) => prev.filter((_, i) => i !== index))
      onImagesSelected(selectedImages.filter((_, i) => i !== index))
    },
    [previews, selectedImages, onImagesSelected],
  )

  const handleClearAll = useCallback(() => {
    previews.forEach((url) => URL.revokeObjectURL(url))
    setPreviews([])
    onImagesSelected([])
  }, [previews, onImagesSelected])

  return (
    <div className="w-full space-y-4" onPaste={handlePaste} tabIndex={0}>
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 w-full transition-all cursor-pointer
          ${isDragActive ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-base-300 hover:border-primary/50'}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {isDragActive ? (
            <Upload className="w-12 h-12 text-primary animate-bounce" />
          ) : (
            <ImageIcon className="w-12 h-12 text-base-content/30" />
          )}
          <p className="text-base-content/60 text-lg">
            {isDragActive ? 'วางรูปที่นี่!' : 'ลากรูปมาวาง, วาง (Ctrl+V), หรือคลิกเลือก'}
          </p>
          <p className="text-base-content/30 text-sm">
            รองรับ: JPG, PNG, WebP — เลือกได้หลายรูป
          </p>
        </div>
      </div>

      {/* Preview thumbnails */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-base-content/60">
              {previews.length} รูปที่เลือก
            </span>
            <button
              className="btn btn-ghost btn-xs text-error gap-1"
              onClick={handleClearAll}
            >
              <Trash2 size={12} />
              ลบทั้งหมด
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {previews.map((url, i) => (
              <div key={i} className="relative group">
                <img
                  src={url}
                  alt={`Preview ${i + 1}`}
                  className="w-full h-32 object-cover rounded-lg border border-base-300"
                />
                <button
                  className="btn btn-circle btn-xs btn-error absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(i)
                  }}
                >
                  <X size={10} />
                </button>
                <span className="absolute bottom-1 left-1 badge badge-sm badge-neutral">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
