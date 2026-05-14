import { useEffect, useRef, useState } from 'react'
import { FileImage } from 'lucide-react'
import { downloadImage } from '../../services/storageService'

interface LazyThumbnailProps {
  src: string | null
  alt: string
  className?: string
  imgClassName?: string
  fallbackIconSize?: number
}

export function LazyThumbnail({ src, alt, className, imgClassName, fallbackIconSize = 24 }: LazyThumbnailProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible || !src) return
    if (src.startsWith('data:') || src.startsWith('blob:') || /^https?:\/\//.test(src)) {
      setResolvedSrc(src)
      return
    }
    let cancelled = false
    downloadImage(src)
      .then((url) => {
        if (!cancelled) setResolvedSrc(url)
      })
      .catch((error) => {
        console.warn('[thumbnail] download failed:', error)
        if (!cancelled) setResolvedSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [isVisible, src])

  return (
    <div ref={ref} className={className ?? 'flex h-full w-full items-center justify-center overflow-hidden bg-[#0b0b0b]'}>
      {!isVisible ? (
        <div className="h-full w-full animate-pulse bg-white/10" />
      ) : resolvedSrc ? (
        <img src={resolvedSrc} alt={alt} className={imgClassName ?? 'h-full w-full object-cover'} loading="lazy" />
      ) : (
        <FileImage size={fallbackIconSize} className="text-[var(--moxzk-dim)]" />
      )}
    </div>
  )
}

export default LazyThumbnail
