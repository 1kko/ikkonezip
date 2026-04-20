import { useCallback, useRef, useState } from 'react';
import { Upload, FolderOpen, File as FileIcon, Folder, Archive, ArrowRight, FileText, FolderTree, Apple, Monitor } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFilesSelected: (files: FileList | File[]) => void | Promise<void>;
  hideExample?: boolean;
}

async function traverseFileTree(
  item: FileSystemEntry,
  path: string,
  files: File[]
): Promise<void> {
  if (item.isFile) {
    const fileEntry = item as FileSystemFileEntry;
    return new Promise((resolve) => {
      fileEntry.file((file) => {
        const fileWithPath = new File([file], file.name, { type: file.type });
        Object.defineProperty(fileWithPath, 'webkitRelativePath', {
          value: path + file.name,
          writable: false,
        });
        files.push(fileWithPath);
        resolve();
      });
    });
  } else if (item.isDirectory) {
    const dirEntry = item as FileSystemDirectoryEntry;
    const dirReader = dirEntry.createReader();
    return new Promise((resolve) => {
      dirReader.readEntries(async (entries) => {
        const promises = entries.map((entry) =>
          traverseFileTree(entry, path + item.name + '/', files)
        );
        await Promise.all(promises);
        resolve();
      });
    });
  }
}

export function FileUploader({ onFilesSelected, hideExample = false }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (items) {
      const files: File[] = [];
      const promises: Promise<void>[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry?.();
        if (item) {
          promises.push(traverseFileTree(item, '', files));
        }
      }

      Promise.all(promises).then(() => {
        if (files.length > 0) {
          onFilesSelected(files);
        }
      });
    } else if (e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  }, [onFilesSelected]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
      e.target.value = '';
    }
  }, [onFilesSelected]);

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "relative cursor-pointer transition-all duration-200 border-2 border-dashed",
          hideExample ? "p-8" : "p-8 pb-6",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is not in the standard types
          webkitdirectory=""
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="flex flex-col items-center gap-4 text-center">
          {/* Icon */}
          <div className={cn(
            "flex items-center justify-center w-14 h-14 rounded-full transition-colors",
            isDragging ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          )}>
            <Upload className="w-6 h-6" />
          </div>

          {/* Text */}
          <div>
            <p className={cn(
              "text-lg font-medium transition-colors",
              isDragging ? "text-primary" : "text-foreground"
            )}>
              {isDragging ? '여기에 놓으세요!' : '파일을 드래그하거나 클릭하여 선택'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              파일 또는 폴더를 업로드할 수 있습니다
            </p>
          </div>

          {/* Info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileIcon className="w-3.5 h-3.5" />
              모든 파일 형식
            </span>
            <span className="flex items-center gap-1">
              <Folder className="w-3.5 h-3.5" />
              폴더 업로드 지원
            </span>
            <span className="flex items-center gap-1">
              <Archive className="w-3.5 h-3.5" />
              ZIP 자동 추출
            </span>
          </div>

          {/* Example — inline inside the drop zone */}
          {!hideExample && (
            <div className="w-full mt-2 pt-4 border-t border-dashed border-muted-foreground/20">
              <div className="space-y-3">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-xs font-medium text-muted-foreground">
                  <div className="flex items-center justify-center gap-1.5">
                    <Apple className="w-3.5 h-3.5" />
                    <span>맥에서 생성</span>
                  </div>
                  <div></div>
                  <div className="flex items-center justify-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" />
                    <span>윈도우에서 정상 표시</span>
                  </div>
                </div>

                {/* File example */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                  <div className="flex items-center justify-end gap-2">
                    <FileText className="w-4 h-4 text-destructive/70 flex-shrink-0" />
                    <code className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-mono truncate">
                      ㅎㅏㄴㄱㅡㄹㅍㅏㅇㅣㄹ.txt
                    </code>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <code className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-xs font-mono truncate">
                      한글파일.txt
                    </code>
                  </div>
                </div>

                {/* Folder example */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                  <div className="flex items-center justify-end gap-2">
                    <Folder className="w-4 h-4 text-destructive/70 flex-shrink-0" />
                    <code className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-mono truncate">
                      ㅍㅗㄹㄷㅓㅇㅣㄹㅡㅁ/
                    </code>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <code className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-xs font-mono truncate">
                      폴더이름/
                    </code>
                  </div>
                </div>

                {/* Nested folder example */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                  <div className="flex items-center justify-end gap-2">
                    <FolderTree className="w-4 h-4 text-destructive/70 flex-shrink-0" />
                    <code className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-mono truncate">
                      ㅍㅗㄹㄷㅓ/ㅍㅏㅇㅣㄹ.zip
                    </code>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex items-center gap-2">
                    <FolderTree className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <code className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-xs font-mono truncate">
                      폴더/파일.zip
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Folder select button */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            folderInputRef.current?.click();
          }}
          className="gap-2"
        >
          <FolderOpen className="w-4 h-4" />
          폴더 선택하기
        </Button>
      </div>
    </div>
  );
}
