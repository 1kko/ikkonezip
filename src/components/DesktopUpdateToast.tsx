import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UpdateManifest } from '@/utils/checkForUpdate';

interface DesktopUpdateToastProps {
  manifest: UpdateManifest | null;
  onDownload: () => void | Promise<void>;
  onDismiss: () => void;
}

export function DesktopUpdateToast({ manifest, onDownload, onDismiss }: DesktopUpdateToastProps) {
  if (!manifest) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-popover text-popover-foreground shadow-lg px-4 py-3 max-w-[90vw] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">새 버전 {manifest.version} 사용 가능</span>
        <span className="text-xs text-muted-foreground">{manifest.notes}</span>
      </div>
      <Button type="button" size="sm" onClick={onDownload}>
        다운로드
      </Button>
      <button
        type="button"
        aria-label="닫기"
        onClick={onDismiss}
        className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
