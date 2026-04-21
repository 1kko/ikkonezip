import { useRegisterSW } from 'virtual:pwa-register/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PwaUpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-popover text-popover-foreground shadow-lg px-4 py-3 max-w-[90vw] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4"
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">새 버전 사용 가능</span>
        <span className="text-xs text-muted-foreground">새로고침하면 최신 버전이 적용됩니다</span>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          updateServiceWorker(true).catch(() => location.reload());
        }}
      >
        새로고침
      </Button>
      <button
        type="button"
        aria-label="닫기"
        onClick={() => setNeedRefresh(false)}
        className="ml-1 rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
