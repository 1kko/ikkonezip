import { useState, useEffect } from 'react';
import { Download, Archive, File, Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ZipOptions } from '@/utils/zipFiles';

interface DownloadButtonProps {
  fileCount: number;
  isProcessing: boolean;
  folderName: string | null;
  onDownloadZip: (filename: string, options?: ZipOptions) => Promise<void>;
  onDownloadSingle: () => void;
}

export function DownloadButton({
  fileCount,
  isProcessing,
  folderName,
  onDownloadZip,
  onDownloadSingle,
}: DownloadButtonProps) {
  const [zipFilename, setZipFilename] = useState('files.zip');
  const [compressSingle, setCompressSingle] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Update default filename when folder is uploaded
  useEffect(() => {
    if (folderName) {
      setZipFilename(`${folderName}.zip`);
    }
  }, [folderName]);

  if (fileCount === 0) {
    return null;
  }

  const isSingleFile = fileCount === 1;

  const handleDownload = async () => {
    if (isSingleFile && !compressSingle) {
      onDownloadSingle();
    } else {
      const options: ZipOptions = {};
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
                onClick={() => setCompressSingle(false)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                  !compressSingle
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
              >
                <File className="w-4 h-4" />
                파일 그대로
              </button>
              <button
                type="button"
                onClick={() => setCompressSingle(true)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium",
                  compressSingle
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
        {(fileCount > 1 || compressSingle) && (
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
              압축 중...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {isSingleFile && !compressSingle
                ? '정규화된 파일 다운로드'
                : password.trim()
                  ? 'ZIP 다운로드 (암호화)'
                  : 'ZIP 다운로드'
              }
              {(fileCount > 1 || compressSingle) && (
                <span className="ml-1 px-2 py-0.5 bg-primary-foreground/20 rounded text-xs">
                  {fileCount}개 파일
                </span>
              )}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
