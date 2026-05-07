import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useThumbnail } from '@/hooks/useThumbnail';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

interface ImagePreviewModalProps {
  files: ProcessedFile[];
  index: number | null;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}

export function ImagePreviewModal({
  files,
  index,
  onIndexChange,
  onClose,
}: ImagePreviewModalProps) {
  const open = index !== null && index >= 0 && index < files.length;
  const current = open ? files[index] : null;
  const thumbnailUrl = useThumbnail(current?.file ?? null);

  const hasPrev = open && index > 0;
  const hasNext = open && index < files.length - 1;

  useEffect(() => {
    if (!open) return;
    function handler(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (target.isContentEditable) return;
      }
      if (event.key === 'ArrowLeft' && hasPrev) {
        event.preventDefault();
        onIndexChange(index - 1);
      } else if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, index, hasPrev, hasNext, onIndexChange]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[min(90vw,720px)] p-4">
        <DialogTitle className="pr-8 text-sm font-medium truncate">
          {current?.originalName ?? ''}
        </DialogTitle>
        <div className="relative">
          {thumbnailUrl && current && (
            <img
              src={thumbnailUrl}
              alt={current.originalName}
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="이전 이미지"
            disabled={!hasPrev}
            onClick={() => hasPrev && onIndexChange(index - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-90 shadow"
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label="다음 이미지"
            disabled={!hasNext}
            onClick={() => hasNext && onIndexChange(index + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-90 shadow"
          >
            <ChevronRight />
          </Button>
        </div>
        {open && (
          <div className="text-xs text-muted-foreground text-center font-mono">
            {index + 1} / {files.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
