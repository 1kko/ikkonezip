import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

export function Footer() {
  const { theme, setTheme } = useTheme();

  return (
    <footer className="mt-12 pb-8 animate-fadeIn">
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={cn(
            "p-2 rounded-lg transition-all",
            theme === 'light'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="라이트 모드"
        >
          <Sun className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={cn(
            "p-2 rounded-lg transition-all",
            theme === 'dark'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="다크 모드"
        >
          <Moon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setTheme('system')}
          className={cn(
            "p-2 rounded-lg transition-all",
            theme === 'system'
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title="시스템 설정"
        >
          <Monitor className="w-4 h-4" />
        </button>
      </div>
    </footer>
  );
}
