import { FileArchive, Zap, Shield, WifiOff, FolderTree, Ban, Download, Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useDesktopRelease } from '@/hooks/useDesktopRelease';
import { isMac } from '@/utils/platform';

const APP_NAME = import.meta.env.VITE_APP_NAME || '맥윈집';

export function Header() {
  const { canInstall, install } = usePWAInstall();
  const release = useDesktopRelease();
  // Mac users get the native DMG download (better experience than PWA install).
  // Non-Mac users keep the PWA install prompt where supported.
  const showMacDownload = isMac() && release !== null;
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
        <span className="font-medium text-primary dark:text-violet-400">한글 파일명 깨짐</span>을
        해결하고 압축합니다
      </p>

      {/* Feature badges */}
      <div className="flex items-center justify-center gap-2 mt-6 flex-wrap max-w-lg mx-auto">
        <Badge variant="secondary" className="gap-1.5">
          <Shield className="w-3 h-3" />
          100% 브라우저 처리
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Ban className="w-3 h-3" />
          광고·트래킹 없음
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <WifiOff className="w-3 h-3" />
          오프라인 지원
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Zap className="w-3 h-3" />
          NFD → NFC 변환
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <FolderTree className="w-3 h-3" />
          폴더 구조 유지
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Archive className="w-3 h-3" />
          ZIP 자동 변환
        </Badge>
      </div>

      {/* Mac native DMG download takes precedence over PWA install on macOS. */}
      {showMacDownload ? (
        <div className="mt-6 animate-fadeIn">
          <Button
            asChild
            variant="outline"
            className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
          >
            <a href={release!.downloadUrl} download>
              <Download className="w-4 h-4" />
              맥용 앱 다운로드 (v{release!.version})
            </a>
          </Button>
        </div>
      ) : canInstall ? (
        <div className="mt-6 animate-fadeIn">
          <Button
            onClick={install}
            variant="outline"
            className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
          >
            <Download className="w-4 h-4" />
            데스크탑에 설치
          </Button>
        </div>
      ) : null}
    </header>
  );
}
