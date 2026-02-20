import ImageUploader from '../Upload/ImageUploader'
import { ImageIcon } from 'lucide-react'

interface UploadStepProps {
  images: File[]
  onImagesSelected: (files: File[]) => void
  onGoToEdit: () => void
}

export default function UploadStep({ images, onImagesSelected, onGoToEdit }: UploadStepProps) {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Upload Manga Images</h2>
          <p className="text-base-content/50 text-sm">
            ลากรูปมังงะมาวาง หรือเลือกไฟล์เพื่อเริ่มแปล
          </p>
        </div>

        <ImageUploader
          onImagesSelected={onImagesSelected}
          selectedImages={images}
        />

        <button
          className="btn btn-primary btn-lg gap-2 shadow-lg w-full max-w-xs mx-auto"
          disabled={images.length === 0}
          onClick={onGoToEdit}
        >
          <ImageIcon size={18} />
          Open in Editor
        </button>
      </div>
    </div>
  )
}
