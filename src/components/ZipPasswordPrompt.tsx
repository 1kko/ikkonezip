import { useState } from 'react';
import { Lock, Eye, EyeOff, X, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ZipPasswordPromptProps {
  isProcessing: boolean;
  error: string | null;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
}

export function ZipPasswordPrompt({
  isProcessing,
  error,
  onSubmit,
  onCancel,
}: ZipPasswordPromptProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isProcessing) return;
    await onSubmit(password.trim());
  };

  return (
    <Card className="border-primary/50 bg-primary/5 animate-fadeIn">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-primary/20">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">암호화된 ZIP 파일</p>
              <p className="text-xs text-muted-foreground">
                이 ZIP 파일은 암호로 보호되어 있습니다. 암호를 입력해 주세요.
              </p>
            </div>
          </div>

          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ZIP 암호 입력"
              className="pr-10"
              autoFocus
              disabled={isProcessing}
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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!password.trim() || isProcessing}
              className="flex-1 gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  추출 중...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  확인
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              취소
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
