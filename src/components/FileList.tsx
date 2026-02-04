import { FileText, Image, Archive, Code, File, X, Trash2, AlertTriangle } from 'lucide-react';
import type { ProcessedFile } from '@/hooks/useFileProcessor';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ReactNode } from 'react';

interface FileListProps {
  files: ProcessedFile[];
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
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

export function FileList({ files, onRemoveFile, onClearAll }: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const filesNeedingNormalization = files.filter(f => f.needsNormalization).length;

  return (
    <Card className="animate-fadeIn">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1.5">
              <FileText className="w-3 h-3" />
              {files.length}개 파일
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              {formatFileSize(totalSize)}
            </Badge>
            {filesNeedingNormalization > 0 && (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                {filesNeedingNormalization}개 정규화 필요
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            모두 삭제
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-72 custom-scrollbar pr-2">
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                {/* File icon */}
                <div className="flex-shrink-0">
                  {getFileIcon(file.originalName)}
                </div>

                {/* File name */}
                <span className="flex-1 min-w-0 text-sm truncate">
                  {file.path}
                </span>

                {/* NFD badge */}
                {file.needsNormalization && (
                  <Badge variant="warning" className="flex-shrink-0 text-[10px] px-1.5 py-0">
                    NFD
                  </Badge>
                )}

                {/* File size */}
                <span className="flex-shrink-0 text-xs text-muted-foreground font-mono">
                  {formatFileSize(file.size)}
                </span>

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onRemoveFile(file.id)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
