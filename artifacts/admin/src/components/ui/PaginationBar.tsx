import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const NavBtn = ({
    onClick,
    disabled,
    title,
    children,
  }: {
    onClick: () => void;
    disabled: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center justify-center h-8 w-8 rounded-md text-sm transition-colors",
        "border border-border/60 bg-card/50",
        "hover:bg-muted hover:border-border",
        "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-border/60",
        "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn(
      "flex flex-wrap items-center justify-between gap-4 px-5 py-3",
      "border-t border-border/50 bg-card/20",
      "text-xs text-muted-foreground",
      className
    )}>
      {/* Record count */}
      <span className="shrink-0 tabular-nums">
        {total === 0
          ? "No records found"
          : <><span className="text-foreground font-medium">{from.toLocaleString()}–{to.toLocaleString()}</span> of <span className="text-foreground font-medium">{total.toLocaleString()}</span> records</>
        }
      </span>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <NavBtn onClick={() => onPageChange(0)} disabled={page === 0} title="First page">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </NavBtn>
        <NavBtn onClick={() => onPageChange(page - 1)} disabled={page === 0} title="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </NavBtn>

        <div className="flex items-center gap-1 mx-1">
          {windowStart > 0 && (
            <span className="inline-flex items-center justify-center h-8 w-6 text-muted-foreground/40 text-xs select-none">…</span>
          )}
          {windowPages.map(pg => (
            <button
              key={pg}
              onClick={() => onPageChange(pg)}
              className={cn(
                "inline-flex items-center justify-center h-8 min-w-[2rem] px-1 rounded-md text-xs font-medium transition-colors",
                pg === page
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border/60 bg-card/50 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border"
              )}
            >
              {pg + 1}
            </button>
          ))}
          {windowStart + 5 < totalPages && (
            <span className="inline-flex items-center justify-center h-8 w-6 text-muted-foreground/40 text-xs select-none">…</span>
          )}
        </div>

        <NavBtn onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1} title="Next page">
          <ChevronRight className="h-3.5 w-3.5" />
        </NavBtn>
        <NavBtn onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1} title="Last page">
          <ChevronsRight className="h-3.5 w-3.5" />
        </NavBtn>
      </div>

      {/* Rows per page */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-muted-foreground">Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={v => { onPageSizeChange(Number(v)); onPageChange(0); }}
        >
          <SelectTrigger className="h-8 w-[68px] text-xs border-border/60 bg-card/50 hover:bg-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map(n => (
              <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
