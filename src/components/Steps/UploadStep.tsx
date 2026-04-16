import ImageUploader from '../Upload/ImageUploader'
import { FolderOpen, ImageIcon } from 'lucide-react'

interface UploadStepProps {
  images: File[]
  onImagesSelected: (files: File[]) => void
  onGoToEdit: () => void
  onOpenAlbums: () => void
}

export default function UploadStep({ images, onImagesSelected, onGoToEdit, onOpenAlbums }: UploadStepProps) {
  const hasImages = images.length > 0

  return (
    <div className="upload-canvas flex h-full items-center justify-center overflow-y-auto p-6">
      <div className={`w-full space-y-6 ${hasImages ? 'max-w-4xl' : 'max-w-lg'} text-center`}>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">
            {hasImages ? 'ตรวจรูปก่อนเข้า Editor' : 'เลือกรูปมังงะ'}
          </h2>
          <p className="text-sm text-[var(--mg-muted)]">
            {hasImages
              ? `${images.length} หน้า พร้อมเปิดเป็น artboard`
              : 'ลากรูปมาวาง วางจากคลิปบอร์ด หรือเลือกไฟล์เพื่อเริ่มแปล'}
          </p>
        </div>

        <ImageUploader
          onImagesSelected={onImagesSelected}
          selectedImages={images}
        />

        <div className="mx-auto flex w-full max-w-sm flex-col gap-2 sm:flex-row">
          <button
            className="mg-button mg-button-primary mg-button-lg flex-1"
            disabled={images.length === 0}
            onClick={onGoToEdit}
          >
            <ImageIcon size={18} />
            {hasImages ? `เปิด ${images.length} หน้าใน Editor` : 'เปิดในหน้าแก้ไข'}
          </button>
          <button
            className="mg-button mg-button-soft mg-button-lg flex-1"
            onClick={onOpenAlbums}
          >
            <FolderOpen size={18} />
            เปิดจากอัลบั้ม
          </button>
        </div>
      </div>
    </div>
  )
}
