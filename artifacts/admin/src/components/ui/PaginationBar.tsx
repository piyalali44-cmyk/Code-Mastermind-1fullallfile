import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  className = "",
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to   = Math.min((page + 1) * pageSize, total);

  const windowStart = Math.max(0, Math.min(totalPages - 5, page - 2));
  const windowPages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => windowStart + i);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs text-muted-foreground ${className}`}>
      {/* Count */}
      <span className="shrink-0">
        {total === 0 ? "No records" : `Showing ${from}–${to} of ${total.toLocaleString()}`}
      </span>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          onClick={() => onPageChange(0)} disabled={page === 0}
          title="First page"
        >
          <ChevronLeft className="h-3 w-3" />
          <ChevronLeft className="h-3 w-3 -ml-2.5" />
        </Button>
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          onClick={() => onPageChange(Math.max(0, page - 1))} disabled={page === 0}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {windowStart > 0 && (
          <span className="px-1 text-muted-foreground/50">…</span>
        )}
        {windowPages.map(pg => (
          <Button
            key={pg}
            variant={pg === page ? "default" : "outline"}
            size="icon" className="h-7 w-7 text-xs"
            onClick={() => onPageChange(pg)}
          >
            {pg + 1}
          </Button>
        ))}
        {windowStart + 5 < totalPages && (
          <span className="px-1 text-muted-foreground/50">…</span>
        )}

        <Button
          variant="outline" size="icon" className="h-7 w-7"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1}
          title="Last page"
        >
          <ChevronRight className="h-3 w-3" />
          <ChevronRight className="h-3 w-3 -ml-2.5" />
        </Button>
      </div>

      {/* Rows per page */}
      <div className="flex items-center gap-2 shrink-0">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={v => { onPageSizeChange(Number(v)); onPageChange(0); }}
        >
          <SelectTrigger className="h-7 w-[65px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map(n => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
