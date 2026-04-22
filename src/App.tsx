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
import { Card, CardContent } from '@/components/ui/card';
import { PreviewModal } from '@/components/PreviewModal';
import { PwaUpdateToast } from '@/components/PwaUpdateToast';
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
        <Header />

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
        <footer className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm text-secondary-foreground">
            <Zap className="w-4 h-4 text-primary" />
            NFD → NFC 변환으로 한글 파일명 호환성 해결
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            모든 처리는 브라우저에서 이루어지며, 파일이 서버로 업로드되지 않습니다.
          </p>
          <p className="mt-3">
            <a
              href="/desktop-install.html"
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              데스크톱 앱 다운로드
            </a>
          </p>
          <Footer />
        </footer>
      </div>
      <PwaUpdateToast />
    </div>
  );
}

export default App;
