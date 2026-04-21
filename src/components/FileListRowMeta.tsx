import { useState } from 'react';
import { FileText, Image, Archive, Code, File } from 'lucide-react';
import { useThumbnail } from '@/hooks/useThumbnail';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import type { MouseEvent, ReactNode } from 'react';

interface FileListRowMetaProps {
  file: ProcessedFile;
}

function getFileIcon(filename: string): ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconClass = "w-4 h-4";

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return <Image className={`${iconClass} text-pink-500`} />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
    return <FileText className={`${iconClass} text-blue-500`} />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className={`${iconClass} text-amber-500`} />;
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java'].includes(ext)) {
    return <Code className={`${iconClass} text-emerald-500`} />;
  }
  return <File className={`${iconClass} text-muted-foreground`} />;
}

export function FileListRowMeta({ file }: FileListRowMetaProps) {
  const thumbnailUrl = useThumbnail(file.file);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (thumbnailUrl) {
    const handleOpen = (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setPreviewOpen(true);
    };

    return (
      <>
        <HoverCard openDelay={150} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              onClick={handleOpen}
              aria-label={`${file.originalName} 미리보기`}
              className="flex-shrink-0 w-4 h-4 rounded overflow-hidden bg-muted cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            side="right"
            align="start"
            className="w-auto p-1 border-border"
          >
            <img
              src={thumbnailUrl}
              alt={file.originalName}
              className="max-w-[240px] max-h-[240px] rounded object-contain"
            />
          </HoverCardContent>
        </HoverCard>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-[min(90vw,720px)] p-4">
            <DialogTitle className="sr-only">{file.originalName}</DialogTitle>
            <img
              src={thumbnailUrl}
              alt={file.originalName}
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="flex-shrink-0">
      {getFileIcon(file.originalName)}
    </div>
  );
}
