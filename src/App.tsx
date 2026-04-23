import { useEffect, useMemo, useState, useRef } from 'react';
import { AlertCircle, Zap } from 'lucide-react';
import { Header } from '@/components/Header';
import { FileUploader } from '@/components/FileUploader';
import { FileList } from '@/components/FileList';
import { DownloadButton } from '@/components/DownloadButton';
import { ZipPasswordPrompt } from '@/components/ZipPasswordPrompt';
import { Footer } from '@/components/Footer';
import { useFileProcessor } from '@/hooks/useFileProcessor';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { PreviewModal } from '@/components/PreviewModal';
import { PwaUpdateToast } from '@/components/PwaUpdateToast';
import { DesktopUpdateToast } from '@/components/DesktopUpdateToast';
import { isTauri } from '@/utils/tauri';
import { checkForUpdate, type UpdateManifest } from '@/utils/checkForUpdate';
import type { ZipOptions } from '@/utils/zipFiles';

const APP_NAME = import.meta.env.VITE_APP_NAME || '맥윈집';

function App() {
  const {
    files,
    isProcessing,
    error,
    folderName,
    needsPassword,
    progress,
    addFiles,
    removeFiles,
    reorderFiles,
    renameFile,
    clearFiles,
    downloadAsZip,
    downloadSingle,
    submitZipPassword,
    cancelZipPassword,
  } = useFileProcessor();

  const { settings } = useSettings();

  const [desktopUpdate, setDesktopUpdate] = useState<UpdateManifest | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    if (!settings.checkDesktopUpdates) return;
    const handle = setTimeout(() => {
      const localVersion = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0';
      void checkForUpdate(localVersion).then(setDesktopUpdate);
    }, 1500);
    return () => clearTimeout(handle);
  }, [settings.checkDesktopUpdates]);

  useEffect(() => {
    if (!isTauri()) return;

    const handleColdOpen = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') void openFromPath(detail);
    };
    window.addEventListener('tauri-file-opened', handleColdOpen);

    let unlisten: (() => void) | null = null;
    let mounted = true;
    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<string>('file-opened', ({ payload }) => {
        if (typeof payload === 'string') void openFromPath(payload);
      }).then((u) => {
        if (mounted) {
          unlisten = u;
        } else {
          // Component unmounted before subscription resolved — unlisten immediately.
          u();
        }
      })
    );

    async function openFromPath(path: string) {
      const { readFile } = await import('@tauri-apps/plugin-fs');
      const bytes = await readFile(path);
      const name = path.split('/').pop() ?? 'file.zip';
      const file = new File([bytes], name, { type: 'application/zip' });
      await addFiles([file]);
    }

    return () => {
      mounted = false;
      window.removeEventListener('tauri-file-opened', handleColdOpen);
      unlisten?.();
    };
  }, [addFiles]);

  useEffect(() => {
    document.title = `${APP_NAME} - 한글 파일명 정규화 & 압축`;
  }, []);

  const shortcuts = useMemo(() => ({
    'mod+o': () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[type="file"]:not([webkitdirectory])'
      );
      input?.click();
    },
    'mod+shift+o': () => {
      const input = document.querySelector<HTMLInputElement>(
        'input[type="file"][webkitdirectory]'
      );
      input?.click();
    },
    'enter': () => {
      if (files.length > 0 && !isProcessing) {
        void downloadAsZip();
      }
    },
    'escape': () => {
      if (needsPassword) {
        cancelZipPassword();
      } else if (files.length > 0) {
        clearFiles();
      }
    },
  }), [files.length, isProcessing, downloadAsZip, clearFiles, needsPassword, cancelZipPassword]);

  useKeyboardShortcuts(shortcuts);

  const [previewOpen, setPreviewOpen] = useState(false);
  const pendingDownloadRef = useRef<{ zipFilename: string; options?: ZipOptions } | null>(null);

  const downloadWithPreview = async (zipFilename: string, options?: ZipOptions) => {
    const anyNeedsNormalization = files.some((f) => f.needsNormalization);
    if (anyNeedsNormalization) {
      pendingDownloadRef.current = { zipFilename, options };
      setPreviewOpen(true);
      return;
    }
    await downloadAsZip(zipFilename, options);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        {!isTauri() && <Header />}

        <main className="space-y-6">
          {/* Upload section */}
          {files.length === 0 && (
            <FileUploader onFilesSelected={addFiles} />
          )}

          {/* ZIP password prompt */}
          {needsPassword && (
            <ZipPasswordPrompt
              isProcessing={isProcessing}
              error={error}
              onSubmit={submitZipPassword}
              onCancel={cancelZipPassword}
            />
          )}

          {/* Error message */}
          {error && !needsPassword && (
            <Card className="border-destructive/50 bg-destructive/10 animate-fadeIn">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-destructive/20">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <p className="text-destructive text-sm font-medium">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* File list */}
          <FileList
            files={files}
            onRemoveFiles={removeFiles}
            onRename={renameFile}
            onReorder={reorderFiles}
            onAddFiles={addFiles}
          />

          {/* Download section */}
          <DownloadButton
            fileCount={files.length}
            isProcessing={isProcessing}
            folderName={folderName}
            progress={progress}
            onDownloadZip={downloadWithPreview}
            onDownloadSingle={downloadSingle}
          />

          {/* Reset link */}
          {files.length > 0 && (
            <div className="text-center">
              <button
                type="button"
                onClick={clearFiles}
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
              >
                초기화
              </button>
            </div>
          )}
        </main>

        <PreviewModal
          open={previewOpen}
          files={files}
          onConfirm={async () => {
            setPreviewOpen(false);
            const args = pendingDownloadRef.current;
            pendingDownloadRef.current = null;
            if (args) await downloadAsZip(args.zipFilename, args.options);
          }}
          onCancel={() => {
            setPreviewOpen(false);
            pendingDownloadRef.current = null;
          }}
        />

        {/* Footer */}
        {!isTauri() && (
          <footer className="mt-16 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm text-secondary-foreground">
              <Zap className="w-4 h-4 text-primary" />
              NFD → NFC 변환으로 한글 파일명 호환성 해결
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              모든 처리는 브라우저에서 이루어지며, 파일이 서버로 업로드되지 않습니다.
            </p>
            <Footer />
          </footer>
        )}
      </div>
      <PwaUpdateToast />
      <DesktopUpdateToast
        manifest={desktopUpdate}
        onDownload={() => {
          if (!desktopUpdate) return;
          void (async () => {
            try {
              const { open } = await import('@tauri-apps/plugin-shell');
              await open(desktopUpdate.downloadUrl);
            } catch (err) {
              console.error('Failed to open download URL', err);
            }
          })();
        }}
        onDismiss={() => setDesktopUpdate(null)}
      />
    </div>
  );
}

export default App;
