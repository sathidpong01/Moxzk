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

  const rootProps = getRootProps()
  const inputProps = getInputProps()

  if (!hasImages) {
    return (
      <div className="w-full" onPaste={handlePaste}>
        <div
          {...rootProps}
          className={`moxzk-upload-dropzone w-full cursor-pointer px-6 py-14 transition ${
            isDragActive
              ? 'scale-[1.01] border-[var(--moxzk-accent)] bg-blue-500/[0.08]'
              : 'hover:border-white/24 hover:bg-white/[0.04]'
          }`}
        >
          <input {...inputProps} />
          <div className="flex flex-col items-center justify-center gap-3">
            {isDragActive ? (
              <Upload className="h-12 w-12 animate-bounce text-[var(--moxzk-accent)]" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-12 w-12 text-[var(--moxzk-dim)]" aria-hidden="true" />
            )}
            <div className="text-center">
              <p className="text-lg font-bold text-[var(--moxzk-text)]">
                {isDragActive ? 'วางรูปที่นี่' : 'ลากรูปมาวาง, วาง (Ctrl+V), หรือคลิกเลือก'}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--moxzk-dim)]">
                รองรับ JPG, PNG, WebP และเลือกได้หลายรูป
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="w-full space-y-3" onPaste={handlePaste} aria-labelledby="selected-images-heading">
      <div className="flex flex-col gap-3 text-left sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="selected-images-heading" className="text-base font-bold text-[var(--moxzk-text)]">
            {previews.length} หน้าที่เลือก
          </h2>
          <p className="text-xs text-[var(--moxzk-muted)]">
            ลำดับนี้จะถูกใช้เป็นเลขหน้าใน artboard
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <div
            {...rootProps}
            className={`moxzk-button moxzk-button-soft moxzk-button-sm ${
              isDragActive ? 'border-[var(--moxzk-accent)] bg-blue-500/10 text-blue-100' : ''
            }`}
          >
            <input {...inputProps} />
            {isDragActive ? <Upload size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
            {isDragActive ? 'วางเพื่อเพิ่ม' : 'เพิ่มรูป'}
          </div>
          <button
            className="moxzk-button moxzk-button-danger moxzk-button-sm"
            onClick={handleClearAll}
          >
            <Trash2 size={12} aria-hidden="true" />
            ลบทั้งหมด
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {previews.map((url, i) => (
          <div key={i} className="group relative overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.04]">
            <div className="absolute left-2 top-2 z-10 rounded-[8px] bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur">
              หน้า {i + 1}
            </div>
            <img
              src={url}
              alt={`หน้า ${i + 1}`}
              className="aspect-3/4 w-full object-cover"
            />
            <button
              className="moxzk-icon-button absolute right-2 top-2 h-7 w-7 rounded-[10px] bg-red-500/82 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove(i)
              }}
              aria-label={`ลบหน้า ${i + 1}`}
            >
              <X size={10} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
