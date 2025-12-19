import { useState } from 'react'
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ImagePreviewProps {
  src: string
  alt?: string
  className?: string
  width?: number | string
  height?: number | string
}

export function ImagePreview({ src, alt = 'Image preview', className, width, height }: ImagePreviewProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <img
          src={src}
          alt={alt}
          className={cn(
            "cursor-pointer rounded-lg border border-border hover:opacity-90 transition-opacity object-cover",
            className
          )}
          style={{ width, height }}
        />
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-auto p-0 border-none bg-transparent shadow-none">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">Full size preview of {alt}</DialogDescription>
        <div className="relative w-full h-full flex items-center justify-center">
            <img
            src={src}
            alt={alt}
            className="max-h-[85vh] w-auto max-w-full rounded-md object-contain shadow-2xl bg-black/50"
            />
        </div>
      </DialogContent>
    </Dialog>
  )
}
