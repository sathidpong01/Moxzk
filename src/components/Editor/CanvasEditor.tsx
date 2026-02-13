import { useCallback, useEffect, useRef, useState } from 'react'
import * as fabric from 'fabric'
import type { TextRegion } from '../../types'
import { getMoodFont, fontToCss } from '../../config/fonts'

interface CanvasEditorProps {
  cleanedImageUrl: string
  regions: TextRegion[]
  onRegionUpdate: (id: string, updates: Partial<TextRegion>) => void
  onSelectedRegion: (id: string | null) => void
}

export default function CanvasEditor({
  cleanedImageUrl,
  regions,
  onRegionUpdate,
  onSelectedRegion,
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const [zoom, setZoom] = useState(1)

  const initCanvas = useCallback(() => {
    if (!canvasRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#1a1a2e',
      selection: true,
    })

    fabricRef.current = canvas

    canvas.on('selection:created', (e) => {
      const target = e.selected?.[0]
      if (target && target.data?.regionId) {
        onSelectedRegion(target.data.regionId)
      }
    })

    canvas.on('selection:updated', (e) => {
      const target = e.selected?.[0]
      if (target && target.data?.regionId) {
        onSelectedRegion(target.data.regionId)
      }
    })

    canvas.on('selection:cleared', () => {
      onSelectedRegion(null)
    })

    canvas.on('object:modified', (e) => {
      const target = e.target
      if (!target || !target.data?.regionId) return

      const regionId = target.data.regionId as string
      onRegionUpdate(regionId, {
        bbox: {
          x: target.left ?? 0,
          y: target.top ?? 0,
          width: (target.width ?? 100) * (target.scaleX ?? 1),
          height: (target.height ?? 30) * (target.scaleY ?? 1),
        },
        rotation: target.angle ?? 0,
      })
    })

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
  }, [onRegionUpdate, onSelectedRegion])

  useEffect(() => {
    const cleanup = initCanvas()
    return cleanup
  }, [initCanvas])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !cleanedImageUrl) return

    fabric.FabricImage.fromURL(cleanedImageUrl).then((img) => {
      const maxWidth = 800
      const maxHeight = 600
      const scale = Math.min(maxWidth / (img.width ?? 800), maxHeight / (img.height ?? 600), 1)

      canvas.setDimensions({
        width: (img.width ?? 800) * scale,
        height: (img.height ?? 600) * scale,
      })

      img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false })
      canvas.backgroundImage = img
      canvas.renderAll()
    })
  }, [cleanedImageUrl])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    const existingTexts = canvas.getObjects().filter((o) => o.data?.regionId)
    existingTexts.forEach((o) => canvas.remove(o))

    regions.forEach((region) => {
      const font = getMoodFont(region.mood)

      const textbox = new fabric.Textbox(region.translatedText, {
        left: region.bbox.x,
        top: region.bbox.y,
        width: region.bbox.width,
        fontSize: region.fontSize,
        fontFamily: font.family,
        fontWeight: font.weight,
        fontStyle: font.style,
        fill: region.fontColor,
        textAlign: 'center',
        editable: true,
        cornerColor: '#6366f1',
        cornerStyle: 'circle',
        transparentCorners: false,
        borderColor: '#6366f1',
        data: { regionId: region.id },
      })

      canvas.add(textbox)
    })

    canvas.renderAll()
  }, [regions])

  const handleZoom = useCallback((delta: number) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const newZoom = Math.max(0.25, Math.min(4, zoom + delta))
    setZoom(newZoom)
    canvas.setZoom(newZoom)
    canvas.renderAll()
  }, [zoom])

  const handleResetZoom = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    setZoom(1)
    canvas.setZoom(1)
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
    canvas.renderAll()
  }, [])

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button className="btn btn-sm btn-outline" onClick={() => handleZoom(0.1)}>
          🔍+
        </button>
        <button className="btn btn-sm btn-outline" onClick={() => handleZoom(-0.1)}>
          🔍−
        </button>
        <button className="btn btn-sm btn-outline" onClick={handleResetZoom}>
          Reset
        </button>
        <span className="text-xs text-base-content/50 ml-2">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Canvas */}
      <div className="canvas-container rounded-xl overflow-hidden border border-base-300">
        <canvas ref={canvasRef} />
      </div>

      <p className="text-xs text-base-content/40">
        คลิกที่ข้อความเพื่อเลือก — ลาก/resize/rotate ได้อิสระ — ดับเบิลคลิกเพื่อแก้ไขข้อความ
      </p>
    </div>
  )
}
