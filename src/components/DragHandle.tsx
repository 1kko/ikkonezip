import { GripVertical } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const DragHandle = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function DragHandle({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label="파일 순서 변경 핸들"
        className={cn(
          'flex-shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-ring rounded p-0.5 touch-none',
          className,
        )}
        {...props}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    );
  },
);
