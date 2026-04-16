import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Plus, Upload, X, Trash2, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { validateImageFiles } from '../../utils/fileValidation'

interface ImageUploaderProps {
  onImagesSelected: (files: File[]) => void
  selectedImages: File[]
}

export default function ImageUploader({ onImagesSelected, selectedImages }: ImageUploaderProps) {
  const [previews, setPreviews] = useState<string[]>([])
  const hasImages = selectedImages.length > 0

  useEffect(() => {
    const urls = selectedImages.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [selectedImages])

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
      onImagesSelected(selectedImages.filter((_, i) => i !== index))
    },
    [selectedImages, onImagesSelected],
  )

  const handleClearAll = useCallback(() => {
    onImagesSelected([])
  }, [onImagesSelected])

  return (
    <div className="w-full space-y-4" onPaste={handlePaste} tabIndex={0}>
      <div
        {...getRootProps()}
        className={`w-full cursor-pointer rounded-[8px] border border-dashed transition ${
          hasImages ? 'p-4' : 'p-12'
        }
          ${isDragActive ? 'scale-[1.01] border-[var(--mg-accent)] bg-blue-500/10' : 'border-[var(--mg-border-strong)] bg-white/[0.025] hover:border-white/30'}`}
      >
        <input {...getInputProps()} />
        <div className={`flex items-center justify-center gap-3 ${hasImages ? 'flex-row' : 'flex-col'}`}>
          {isDragActive ? (
            <Upload className={`${hasImages ? 'h-5 w-5' : 'h-12 w-12'} animate-bounce text-[var(--mg-accent)]`} />
          ) : (
            hasImages
              ? <Plus className="h-5 w-5 text-[var(--mg-muted)]" />
              : <ImageIcon className="h-12 w-12 text-[var(--mg-dim)]" />
          )}
          <div className={hasImages ? 'text-left' : 'text-center'}>
            <p className={`${hasImages ? 'text-sm' : 'text-lg'} text-[var(--mg-muted)]`}>
              {isDragActive ? 'วางรูปที่นี่' : hasImages ? 'เพิ่มรูปอีก' : 'ลากรูปมาวาง, วาง (Ctrl+V), หรือคลิกเลือก'}
            </p>
            <p className="text-xs text-[var(--mg-dim)]">
              รองรับ JPG, PNG, WebP และเลือกได้หลายรูป
            </p>
          </div>
        </div>
      </div>

      {/* Preview thumbnails */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <p className="text-sm font-bold text-[var(--mg-text)]">{previews.length} รูปที่เลือก</p>
              <p className="text-xs text-[var(--mg-muted)]">ลำดับนี้จะถูกใช้เป็นเลขหน้าใน artboard</p>
            </div>
            <button
              className="mg-button mg-button-danger mg-button-sm"
              onClick={handleClearAll}
            >
              <Trash2 size={12} />
              ลบทั้งหมด
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {previews.map((url, i) => (
              <div key={i} className="group relative overflow-hidden rounded-[8px] border border-[var(--mg-border)] bg-white/[0.03]">
                <div className="absolute left-1.5 top-1.5 z-10 rounded-[6px] bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur">
                  หน้า {i + 1}
                </div>
                <img
                  src={url}
                  alt={`หน้า ${i + 1}`}
                  className="aspect-3/4 w-full object-cover"
                />
                <button
                  className="mg-icon-button absolute right-1 top-1 h-6 w-6 bg-red-500/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(i)
                  }}
                  aria-label={`Remove image ${i + 1}`}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
