import { useCallback, useRef, useState } from 'react'

interface ImageUploaderProps {
  onImagesSelected: (files: File[]) => void
  selectedImages: File[]
}

export default function ImageUploader({ onImagesSelected, selectedImages }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [previews, setPreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (imageFiles.length === 0) return

      onImagesSelected([...selectedImages, ...imageFiles])

      const newPreviews = imageFiles.map((f) => URL.createObjectURL(f))
      setPreviews((prev) => [...prev, ...newPreviews])
    },
    [onImagesSelected, selectedImages],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      const files: File[] = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (files.length > 0) handleFiles(files)
    },
    [handleFiles],
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
        className={`border-2 border-dashed rounded-2xl p-12 w-full transition-all cursor-pointer
          ${isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-base-300 hover:border-primary/50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl">{isDragging ? '📥' : '🖼️'}</span>
          <p className="text-base-content/60 text-lg">
            {isDragging ? 'วางรูปที่นี่!' : 'ลากรูปมาวาง, วาง (Ctrl+V), หรือคลิกเลือก'}
          </p>
          <p className="text-base-content/30 text-sm">
            รองรับ: JPG, PNG, WebP — เลือกได้หลายรูป
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* Preview thumbnails */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-base-content/60">
              {previews.length} รูปที่เลือก
            </span>
            <button
              className="btn btn-ghost btn-xs text-error"
              onClick={handleClearAll}
            >
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
                  ✕
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
