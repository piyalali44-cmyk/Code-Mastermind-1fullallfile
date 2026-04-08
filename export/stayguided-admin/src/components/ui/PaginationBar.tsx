import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    children,
    title,
  }: {
    onClick: () => void;
    disabled: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 min-w-[2rem] px-1.5 rounded text-sm select-none transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
        "disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn(
      "flex flex-wrap items-center justify-between gap-4 px-5 py-2.5",
      "border-t border-border/40 text-xs text-muted-foreground",
      className
    )}>
      {/* Record count */}
      <span className="shrink-0 tabular-nums">
        {total === 0 ? (
          "No records"
        ) : (
          <>
            <span className="font-semibold text-foreground">{from.toLocaleString()}–{to.toLocaleString()}</span>
            {" of "}
            <span className="font-semibold text-foreground">{total.toLocaleString()}</span>
            {" records"}
          </>
        )}
      </span>

      {/* Page navigation */}
      <div className="flex items-center gap-0.5">
        <NavBtn onClick={() => onPageChange(0)} disabled={page === 0} title="First page">
          «
        </NavBtn>
        <NavBtn onClick={() => onPageChange(page - 1)} disabled={page === 0} title="Previous page">
          ‹
        </NavBtn>

        {windowStart > 0 && (
          <span className="h-8 min-w-[2rem] px-1.5 flex items-center justify-center text-muted-foreground/40 select-none">
            …
          </span>
        )}

        {windowPages.map(pg => (
          <button
            key={pg}
            onClick={() => onPageChange(pg)}
            className={cn(
              "h-8 min-w-[2rem] px-1.5 rounded text-xs font-medium transition-colors select-none",
              pg === page
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            {pg + 1}
          </button>
        ))}

        {windowStart + 5 < totalPages && (
          <span className="h-8 min-w-[2rem] px-1.5 flex items-center justify-center text-muted-foreground/40 select-none">
            …
          </span>
        )}

        <NavBtn onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1} title="Next page">
          ›
        </NavBtn>
        <NavBtn onClick={() => onPageChange(totalPages - 1)} disabled={page >= totalPages - 1} title="Last page">
          »
        </NavBtn>
      </div>

      {/* Rows per page */}
      <div className="flex items-center gap-2 shrink-0">
        <span>Rows per page</span>
        <Select
          value={String(pageSize)}
          onValueChange={v => { onPageSizeChange(Number(v)); onPageChange(0); }}
        >
          <SelectTrigger className="h-7 w-[60px] text-xs border-border/50 bg-transparent hover:bg-muted/60 focus:ring-0">
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
