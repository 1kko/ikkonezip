import { FileArchive, Zap, Shield, ArrowRight, Lock, WifiOff, FolderTree, FileText, Folder, Apple, Monitor, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const APP_NAME = import.meta.env.VITE_APP_NAME || '맥윈집';

interface HeaderProps {
  hideExample?: boolean;
}

export function Header({ hideExample = false }: HeaderProps) {
  return (
    <header className="text-center mb-10 animate-fadeIn">
      {/* Logo */}
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-bg shadow-lg shadow-primary/30">
          <FileArchive className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold mb-3 gradient-title">
        {APP_NAME}
      </h1>

      {/* Subtitle */}
      <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
        맥에서 만든 파일의{' '}
        <span className="font-medium text-primary">한글 파일명 깨짐</span>을
        해결하고 압축합니다
      </p>

      {/* Feature badges */}
      <div className="flex items-center justify-center gap-2 mt-6 flex-wrap max-w-md mx-auto">
        <Badge variant="secondary" className="gap-1.5">
          <Zap className="w-3 h-3" />
          NFD → NFC 변환
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Shield className="w-3 h-3" />
          100% 브라우저 처리
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Lock className="w-3 h-3" />
          개인정보 보호
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <FolderTree className="w-3 h-3" />
          폴더 구조 유지
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <WifiOff className="w-3 h-3" />
          오프라인 지원
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Ban className="w-3 h-3" />
          광고 없음
        </Badge>
      </div>

      {/* Example - hidden when files are added */}
      {!hideExample && (
      <Card className="mt-8 p-5 bg-muted/50 border-dashed">
        <div className="space-y-4">
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
      </Card>
      )}
    </header>
  );
}
