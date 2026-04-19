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
    <div className="upload-canvas flex h-full items-start justify-center overflow-y-auto px-4 pb-10 pt-24 sm:px-6 sm:pb-14 lg:pb-20">
      <div className={`w-full ${hasImages ? 'max-w-5xl space-y-5' : 'max-w-xl space-y-6'} text-center`}>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-balance sm:text-3xl">
            {hasImages ? 'ตรวจรูปก่อนเข้าแก้ไข' : 'เลือกรูปมังงะ'}
          </h1>
          <p className="text-sm text-[var(--mg-muted)]">
            {hasImages
              ? `${images.length} หน้า พร้อมเปิดเป็นพื้นที่จัดหน้า`
              : 'ลากรูปมาวาง วางจากคลิปบอร์ด หรือเลือกไฟล์เพื่อเริ่มแปล'}
          </p>
        </div>

        <ImageUploader
          onImagesSelected={onImagesSelected}
          selectedImages={images}
        />

        <div className="mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <button
            className="mg-button mg-button-primary mg-button-lg flex-1"
            disabled={images.length === 0}
            onClick={onGoToEdit}
          >
            <ImageIcon size={18} />
            {hasImages ? 'เริ่มแก้ไข' : 'เปิดในหน้าแก้ไข'}
            {hasImages && <span className="text-xs font-bold opacity-80">{images.length} หน้า</span>}
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
