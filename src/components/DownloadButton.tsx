import { useState, useEffect } from 'react';
import { Download, Archive, File, Loader2, Lock, Eye, EyeOff, Gauge, Trash2, Apple, Monitor } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import type { ZipOptions } from '@/utils/zipFiles';

interface DownloadButtonProps {
  fileCount: number;
  isProcessing: boolean;
  folderName: string | null;
  progress: { current: number; total: number } | null;
  onDownloadZip: (filename: string, options?: ZipOptions) => Promise<void>;
  onDownloadSingle: () => void;
}

export function DownloadButton({
  fileCount,
  isProcessing,
  folderName,
  progress,
  onDownloadZip,
  onDownloadSingle,
}: DownloadButtonProps) {
  const { settings, updateSetting } = useSettings();
  const [zipFilename, setZipFilename] = useState('files.zip');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sync filename input default to folderName prop while keeping it user-editable.
  // This is the documented "controlled input synced to prop" exception to set-state-in-effect.
  useEffect(() => {
    if (folderName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setZipFilename(`${folderName}.zip`);
    }
  }, [folderName]);

  if (fileCount === 0) {
    return null;
  }

  const isSingleFile = fileCount === 1;

  const handleDownload = async () => {
    if (isSingleFile && !settings.compressSingle) {
      onDownloadSingle();
    } else {
      const options: ZipOptions = {
        compressionLevel: settings.compressionLevel,
        excludeSystemFiles: settings.excludeSystemFiles,
        targetForm: settings.normalizationForm,
      };
      if (password.trim()) {
        options.password = password.trim();
      }
      await onDownloadZip(zipFilename, options);
    }
  };

  return (
    <Card className="animate-fadeIn">
      <CardContent className="pt-6 space-y-4">
        {/* Single file options */}
        {isSingleFile && (
          <div className="flex items-center justify-center gap-2">
            <Label className="text-sm text-muted-foreground mr-2">다운로드 방식:</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateSetting('compressSingle', false)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                  !settings.compressSingle
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
              >
                <File className="w-4 h-4" />
                파일 그대로
              </button>
              <button
                type="button"
                onClick={() => updateSetting('compressSingle', true)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                  settings.compressSingle
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
              >
                <Archive className="w-4 h-4" />
                ZIP 압축
              </button>
            </div>
          </div>
        )}

        {/* ZIP options */}
        {(fileCount > 1 || settings.compressSingle) && (
          <div className="space-y-3">
            {/* ZIP filename input */}
            <div className="flex items-center gap-3">
              <Label htmlFor="zipFilename" className="flex items-center gap-2 text-muted-foreground whitespace-nowrap w-16">
                <Archive className="w-4 h-4" />
                파일명
              </Label>
              <Input
                id="zipFilename"
                type="text"
                value={zipFilename}
                onChange={(e) => setZipFilename(e.target.value)}
                placeholder="파일명.zip"
                className="flex-1"
              />
            </div>

            {/* Password input */}
            <div className="flex items-center gap-3">
              <Label htmlFor="password" className="flex items-center gap-2 text-muted-foreground whitespace-nowrap w-16">
                <Lock className="w-4 h-4" />
                암호
              </Label>
              <div className="flex-1 relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="선택사항"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Normalization direction */}
            <div className="flex items-center gap-3">
              <Label id="direction-label" className="flex items-center gap-2 text-muted-foreground whitespace-nowrap w-16">
                방향
              </Label>
              <div role="group" aria-labelledby="direction-label" className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => updateSetting('normalizationForm', 'NFC')}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium flex items-center justify-center gap-1.5",
                    settings.normalizationForm === 'NFC'
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                  aria-label="Mac에서 Windows로 (NFD → NFC)"
                >
                  <Apple className="w-4 h-4" />
                  →
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('normalizationForm', 'NFD')}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium flex items-center justify-center gap-1.5",
                    settings.normalizationForm === 'NFD'
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                  aria-label="Windows에서 Mac으로 (NFC → NFD)"
                >
                  <Monitor className="w-4 h-4" />
                  →
                  <Apple className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compression level */}
            <div className="flex items-center gap-3">
              <Label id="compression-label" className="flex items-center gap-2 text-muted-foreground whitespace-nowrap w-16">
                <Gauge className="w-4 h-4" />
                압축률
              </Label>
              <div role="group" aria-labelledby="compression-label" className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => updateSetting('compressionLevel', 0)}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium",
                    settings.compressionLevel === 0
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  저장만
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('compressionLevel', 5)}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium",
                    settings.compressionLevel === 5
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  표준
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('compressionLevel', 9)}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded-lg border-2 transition-all text-sm font-medium",
                    settings.compressionLevel === 9
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  최대
                </button>
              </div>
            </div>

            {/* Exclude system files */}
            <div className="flex items-center gap-3">
              <Label className="flex items-center gap-2 text-muted-foreground whitespace-nowrap w-16">
                <Trash2 className="w-4 h-4" />
                정리
              </Label>
              <label className="flex-1 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.excludeSystemFiles}
                  onChange={(e) => updateSetting('excludeSystemFiles', e.target.checked)}
                  className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">
                  불필요 파일 제외 (.DS_Store, Thumbs.db 등)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Download button */}
        <Button
          onClick={handleDownload}
          disabled={isProcessing}
          size="lg"
          className={cn(
            "w-full gap-2",
            password.trim() && "gradient-button"
          )}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {progress ? `압축 중... ${progress.current}/${progress.total}` : '압축 중...'}
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {isSingleFile && !settings.compressSingle
                ? '정규화된 파일 다운로드'
                : password.trim()
                  ? 'ZIP 다운로드 (암호화)'
                  : 'ZIP 다운로드'
              }
              {(fileCount > 1 || settings.compressSingle) && (
                <span className="ml-1 px-2 py-0.5 bg-primary-foreground/20 rounded text-xs">
                  {fileCount}개 파일
                </span>
              )}
            </>
          )}
        </Button>
        {isProcessing && progress && (
          <Progress
            value={(progress.current / progress.total) * 100}
            className="mt-2"
            aria-label={`압축 진행: ${progress.current}/${progress.total}`}
          />
        )}
      </CardContent>
    </Card>
  );
}
