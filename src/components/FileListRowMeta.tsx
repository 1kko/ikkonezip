import { FileText, Image, Archive, Code, File } from 'lucide-react';
import { useThumbnail } from '@/hooks/useThumbnail';
import { IMAGE_EXTENSIONS } from '@/utils/isImageFile';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import type { MouseEvent, ReactNode } from 'react';

interface FileListRowMetaProps {
  file: ProcessedFile;
  onPreviewOpen?: (id: string) => void;
}

function getFileIcon(filename: string): ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconClass = 'w-6 h-6';

  if (IMAGE_EXTENSIONS.has(ext)) {
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

export function FileListRowMeta({ file, onPreviewOpen }: FileListRowMetaProps) {
  const thumbnailUrl = useThumbnail(file.file);

  if (thumbnailUrl) {
    const handleOpen = (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onPreviewOpen?.(file.id);
    };

    return (
      <HoverCard openDelay={150} closeDelay={100}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={handleOpen}
            aria-label={`${file.originalName} 미리보기`}
            className="flex-shrink-0 w-10 h-10 rounded-md overflow-hidden bg-muted cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-ring"
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
    );
  }

  return (
    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
      {getFileIcon(file.originalName)}
    </div>
  );
}
