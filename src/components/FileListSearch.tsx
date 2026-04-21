import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface FileListSearchProps {
  value: string;
  onChange: (next: string) => void;
}

export function FileListSearch({ value, onChange }: FileListSearchProps) {
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="파일 이름 검색…"
        aria-label="파일 이름 검색"
        className="pl-8 pr-8"
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="검색어 지우기"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
