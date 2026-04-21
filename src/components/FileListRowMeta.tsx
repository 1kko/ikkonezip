import { FileText, Image, Archive, Code, File } from 'lucide-react';
import { useThumbnail } from '@/hooks/useThumbnail';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import type { ReactNode } from 'react';

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

  if (thumbnailUrl) {
    return (
      <div className="flex-shrink-0 w-4 h-4 rounded overflow-hidden bg-muted">
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div className="flex-shrink-0">
      {getFileIcon(file.originalName)}
    </div>
  );
}
