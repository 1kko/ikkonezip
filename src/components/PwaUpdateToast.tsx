import { useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Wipe every Cache Storage entry the workbox SW owns. Catches stale precache
// buckets that cleanupOutdatedCaches misses when the new SW is still waiting.
async function purgeCaches() {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    // Cache Storage rejection is non-fatal — reload still happens.
  }
}

export function PwaUpdateToast() {
  // Single-shot guard: controllerchange can fire twice in some browsers when
  // SW chains transitions (waiting → installing → activating).
  const reloadingRef = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_, registration) {
      // The default updateServiceWorker(true) flow calls location.reload()
      // synchronously after postMessage(SKIP_WAITING). On slow machines that
      // races the SW's actual activation — reload runs against the OLD SW,
      // which serves the OLD precached HTML/JS. Listening for
      // controllerchange instead defers reload until the new SW has taken
      // control, so the next paint comes from the new precache manifest.
      if (registration && 'serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloadingRef.current) return;
          reloadingRef.current = true;
          window.location.reload();
        });
      }
    },
  });

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
          void (async () => {
            // reloadPage=false: just send SKIP_WAITING. The controllerchange
            // listener above triggers the reload once the new SW is active.
            try {
              await updateServiceWorker(false);
            } catch {
              // Hook rejected — fall through to manual purge + reload.
            }
            await purgeCaches();
            // Safety net: if no controllerchange fires within 3s (e.g. no
            // waiting SW because cache went stale via a different path),
            // force the reload anyway so the user is never stuck.
            setTimeout(() => {
              if (reloadingRef.current) return;
              reloadingRef.current = true;
              window.location.reload();
            }, 3000);
          })();
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
