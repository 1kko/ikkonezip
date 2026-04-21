import { ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ProcessedFile } from '@/hooks/useFileProcessor';

interface PreviewModalProps {
  open: boolean;
  files: ProcessedFile[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function PreviewModal({ open, files, onConfirm, onCancel }: PreviewModalProps) {
  const filesToRename = files.filter((f) => f.needsNormalization);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>파일명 미리보기</DialogTitle>
          <DialogDescription>
            아래 {filesToRename.length}개 파일이 정규화됩니다. 진행하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-72 pr-4">
          <div className="space-y-2">
            {filesToRename.map((file) => (
              <div
                key={file.id}
                className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm"
              >
                <code className="px-2 py-1 bg-red-500/10 text-red-700 dark:text-red-300 rounded text-xs font-mono truncate">
                  {file.path}
                </code>
                <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <code className="px-2 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded text-xs font-mono truncate">
                  {file.normalizedPath}
                </code>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            취소
          </Button>
          <Button onClick={onConfirm}>다운로드 진행</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
