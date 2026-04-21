// Stub for virtual:pwa-register/react — replaced by vi.mock() in tests
import type { Dispatch, SetStateAction } from 'react';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

export type { RegisterSWOptions };

export function useRegisterSW(options?: RegisterSWOptions): {
  needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
  offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
} {
  void options;
  throw new Error('useRegisterSW stub — mock this in your test via vi.mock');
}
