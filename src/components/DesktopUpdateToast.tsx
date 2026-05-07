import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UpdateManifest } from '@/utils/checkForUpdate';

interface DesktopUpdateToastProps {
  manifest: UpdateManifest | null;
  onDownload: () => void | Promise<void>;
  onDismiss: () => void;
  isDownloading?: boolean;
}

export function DesktopUpdateToast({ manifest, onDownload, onDismiss, isDownloading = false }: DesktopUpdateToastProps) {
  if (!manifest) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-popover text-popover-foreground shadow-lg px-4 py-3 max-w-[90vw] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
    >
      <span className="text-sm font-medium">새 버전 {manifest.version} 사용 가능</span>
      <Button type="button" size="sm" onClick={onDownload} disabled={isDownloading}>
        {isDownloading ? '다운로드 중…' : '다운로드'}
      </Button>
      <button
        type="button"
        aria-label="닫기"
        onClick={onDismiss}
        disabled={isDownloading}
        className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
