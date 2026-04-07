import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/utils";
import { Search, RefreshCw, Activity } from "lucide-react";
import { toast } from "sonner";
import { PaginationBar } from "@/components/ui/PaginationBar";

interface LogEntry {
  id: string; admin_id: string | null; action: string; entity_type: string | null;
  entity_id: string | null; details: Record<string, unknown>; created_at: string;
}

const ENTITY_COLORS: Record<string, string> = {
  user: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  series: "bg-green-500/10 text-green-400 border-green-500/30",
  episode: "bg-green-500/10 text-green-400 border-green-500/30",
  reciter: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  coupon: "bg-primary/10 text-primary border-primary/30",
  app_settings: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  feature_flag: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  push_campaign: "bg-red-500/10 text-red-400 border-red-500/30",
  popup_notice: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  category: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  journey_chapter: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

export default function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [total, setTotal] = useState(0);

  const entityTypes = [...new Set(Object.keys(ENTITY_COLORS))];

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("admin_activity_log")
        .select("id,admin_id,action,entity_type,entity_id,details,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filterType !== "all") q = q.eq("entity_type", filterType);
      if (search.trim()) q = q.ilike("action", `%${search}%`);

      const { data, count, error } = await q;
      if (error) throw error;
      setLogs((data as LogEntry[]) ?? []);
      setTotal(count ?? 0);
    } catch (err) {
      toast.error("Failed to load activity log");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterType, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  function adminInitial(adminId: string | null) {
    if (!adminId) return "?";
    return adminId.slice(0, 2).toUpperCase();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />Activity Log
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total.toLocaleString()} entries</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-1" />Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search actions…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Entity type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {entityTypes.map(t => (
                <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Admin</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 5 }).map((__, j) => (
                  <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                ))}
              </TableRow>
            )) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  <Activity className="h-8 w-8 opacity-20 mx-auto mb-2" />
                  No activity found
                </TableCell>
              </TableRow>
            ) : logs.map(log => (
              <TableRow key={log.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {adminInitial(log.admin_id)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground font-mono">
                      {log.admin_id ? log.admin_id.slice(0, 8) : "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm max-w-[300px] truncate">{log.action}</TableCell>
                <TableCell>
                  {log.entity_type ? (
                    <Badge variant="outline" className={`text-xs ${ENTITY_COLORS[log.entity_type] || "text-muted-foreground border-border"}`}>
                      {log.entity_type.replace(/_/g, " ")}
                    </Badge>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {log.entity_id?.slice(0, 8) || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDateTime(log.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={s => { setPageSize(s); setPage(0); }}
        />
      </Card>
    </div>
  );
}
