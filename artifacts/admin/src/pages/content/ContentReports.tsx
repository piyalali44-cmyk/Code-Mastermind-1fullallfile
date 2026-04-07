import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle, XCircle, Eye, RefreshCw, Clock, Shield,
  FileWarning, Inbox, Flag, Headphones, BookOpen, Layers, Wifi, StickyNote, User, Calendar,
} from "lucide-react";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { formatDateTime } from "@/lib/utils";
import type { ContentReport } from "@/lib/types";

/* ─── Config ─────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  reviewing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  resolved:  "bg-green-500/10 text-green-400 border-green-500/30",
  dismissed: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending:   Clock,
  reviewing: Eye,
  resolved:  CheckCircle,
  dismissed: XCircle,
};

const REASON_LABELS: Record<string, string> = {
  incorrect_info: "Incorrect Info",
  poor_audio:     "Poor Audio",
  misleading:     "Misleading",
  inappropriate:  "Inappropriate",
  copyright:      "Copyright",
  other:          "Other",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  episode: Headphones,
  series:  Layers,
  surah:   BookOpen,
};

/* ─── Component ──────────────────────────────────────────── */
export default function ContentReports() {
  const [allItems, setAllItems] = useState<ContentReport[]>([]);
  const [items,    setItems]    = useState<ContentReport[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [live,     setLive]     = useState(false);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selected,     setSelected]     = useState<ContentReport | null>(null);
  const [actionNote,   setActionNote]   = useState("");
  const [acting,       setActing]       = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const { profile } = useAuth();

  const pageItems = items.slice(page * pageSize, (page + 1) * pageSize);

  /* ── Stats ── */
  const stats = {
    total:     allItems.length,
    pending:   allItems.filter(r => r.status === "pending").length,
    reviewing: allItems.filter(r => r.status === "reviewing").length,
    resolved:  allItems.filter(r => r.status === "resolved").length,
    dismissed: allItems.filter(r => r.status === "dismissed").length,
  };

  /* ── Load ── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data: rawData, error } = await supabase
        .from("content_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const reports = (rawData ?? []) as ContentReport[];

      // Enrich with reporter profiles
      const ids = [...new Set(reports.map(r => r.reporter_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,display_name,email,avatar_url")
          .in("id", ids);
        if (profiles) {
          const map = new Map(profiles.map((p: { id: string; display_name: string; email: string }) => [p.id, p]));
          reports.forEach(r => {
            if (r.reporter_id) r.reporter = map.get(r.reporter_id) as ContentReport["reporter"];
          });
        }
      }

      setAllItems(reports);
    } catch {
      toast.error("Failed to load reports");
      setAllItems([]);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Filter ── */
  useEffect(() => {
    setItems(filterStatus === "all" ? allItems : allItems.filter(r => r.status === filterStatus));
    setPage(0);
  }, [filterStatus, allItems]);

  /* ── Real-time ── */
  useEffect(() => {
    const channel = supabase
      .channel("content_reports_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_reports" }, () => {
        load(true);
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  /* ── Update Status ── */
  async function updateStatus(report: ContentReport, newStatus: string) {
    setActing(true);
    try {
      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
      };
      if (actionNote.trim()) updatePayload.admin_note = actionNote.trim();

      const { error } = await supabase
        .from("content_reports")
        .update(updatePayload)
        .eq("id", report.id);
      if (error) throw error;

      // Log to admin activity
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: `Marked report as ${newStatus}`,
        entity_type: "content_report",
        entity_id: report.id,
        details: {
          content_id:    report.content_id,
          content_type:  report.content_type,
          content_title: report.content_title,
          reason:        report.reason,
          note:          actionNote.trim() || undefined,
        },
      }).then(() => {}, () => {});

      toast.success(`Report marked as ${newStatus}`);
      setSelected(null);
      setActionNote("");
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to update report");
    } finally {
      setActing(false);
    }
  }

  /* ── Delete ── */
  async function deleteReport(report: ContentReport) {
    if (!confirm("Permanently delete this report? This cannot be undone.")) return;
    const { error } = await supabase.from("content_reports").delete().eq("id", report.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Report deleted");
    setSelected(null);
    load(true);
  }

  /* ─── Render ──────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Content Reports</h1>
            <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
              live ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground border-border"
            }`}>
              <Wifi className="h-2.5 w-2.5" />
              {live ? "Live" : "Connecting…"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and review user-submitted content reports
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { status: "pending",   label: "Pending",   color: "text-yellow-400", border: "hover:border-yellow-500/40", Icon: Clock, value: stats.pending },
          { status: "reviewing", label: "Reviewing", color: "text-blue-400",   border: "hover:border-blue-500/40",   Icon: Eye,   value: stats.reviewing },
          { status: "resolved",  label: "Resolved",  color: "text-green-400",  border: "hover:border-green-500/40",  Icon: CheckCircle, value: stats.resolved },
          { status: "all",       label: "Total",     color: "text-foreground", border: "hover:border-border/60",     Icon: Shield, value: stats.total },
        ].map(kpi => (
          <Card
            key={kpi.status}
            className={`cursor-pointer transition-colors ${kpi.border} ${filterStatus === kpi.status ? "border-primary/50 bg-primary/5" : ""}`}
            onClick={() => setFilterStatus(kpi.status)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <kpi.Icon className={`h-4 w-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="reviewing">Reviewing</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {items.length} report{items.length !== 1 ? "s" : ""}
          </span>
          {stats.pending > 0 && filterStatus !== "pending" && (
            <span className="ml-auto text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded-full">
              {stats.pending} pending review
            </span>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[90px]">Type</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted animate-pulse rounded" style={{ animationDelay: `${i * 40}ms` }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        {filterStatus === "pending"
                          ? <Inbox className="h-6 w-6 text-muted-foreground" />
                          : <FileWarning className="h-6 w-6 text-muted-foreground" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">
                          {filterStatus === "pending"
                            ? "No pending reports — all caught up!"
                            : `No ${filterStatus === "all" ? "" : filterStatus + " "}reports found`}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {filterStatus === "pending"
                            ? "Reports submitted by users will appear here."
                            : "Try changing the filter to see other reports."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : pageItems.map(r => {
                const TypeIcon = TYPE_ICONS[r.content_type] ?? Flag;
                const StatusIcon = STATUS_ICONS[r.status] ?? Clock;
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => { setSelected(r); setActionNote(r.admin_note || ""); }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <Badge variant="outline" className="text-[10px] capitalize px-1.5">{r.content_type}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <p className="text-sm font-medium truncate">{r.content_title || "—"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{r.content_id?.slice(0, 8)}…</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{REASON_LABELS[r.reason] || r.reason}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.reporter?.display_name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[r.status] || ""}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <PaginationBar
        page={page}
        pageSize={pageSize}
        total={items.length}
        onPageChange={setPage}
        onPageSizeChange={s => { setPageSize(s); setPage(0); }}
      />

      {/* ─── Detail Dialog ─── */}
      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              Review Report
            </DialogTitle>
            <DialogDescription>
              Review the details and take action on this report.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Content info */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {(() => { const Icon = TYPE_ICONS[selected.content_type] ?? Flag; return <Icon className="h-4 w-4 text-muted-foreground" />; })()}
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide capitalize">{selected.content_type}</span>
                  <Badge variant="outline" className={`ml-auto text-xs capitalize ${STATUS_COLORS[selected.status]}`}>
                    {selected.status}
                  </Badge>
                </div>
                <p className="font-semibold text-sm">{selected.content_title || "Unknown content"}</p>
                <p className="font-mono text-[10px] text-muted-foreground break-all">{selected.content_id}</p>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    <Flag className="h-3 w-3" /> Reason
                  </div>
                  <p className="font-medium">{REASON_LABELS[selected.reason] || selected.reason}</p>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    <User className="h-3 w-3" /> Reporter
                  </div>
                  <p className="font-medium">{selected.reporter?.display_name || "Unknown"}</p>
                  {selected.reporter?.email && (
                    <p className="text-[11px] text-muted-foreground">{selected.reporter.email}</p>
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    <Calendar className="h-3 w-3" /> Submitted
                  </div>
                  <p className="text-xs">{formatDateTime(selected.created_at)}</p>
                </div>
                {selected.reviewed_at && (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      <CheckCircle className="h-3 w-3" /> Reviewed
                    </div>
                    <p className="text-xs">{formatDateTime(selected.reviewed_at)}</p>
                  </div>
                )}
              </div>

              {/* User description */}
              {selected.description && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5">User's Description</p>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm border border-border/50 italic">
                    "{selected.description}"
                  </div>
                </div>
              )}

              {/* Previous admin note */}
              {selected.admin_note && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <StickyNote className="h-3 w-3" /> Previous Admin Note
                  </p>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                    {selected.admin_note}
                  </div>
                </div>
              )}

              {/* Admin note input */}
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <StickyNote className="h-3 w-3" />
                  {selected.admin_note ? "Update Admin Note" : "Admin Note (optional)"}
                </Label>
                <Textarea
                  rows={2}
                  placeholder="Add an internal note about this report…"
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  className="text-sm resize-none"
                />
                <p className="text-[10px] text-muted-foreground">This note is only visible to admins.</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-start pt-2">
            {selected?.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                onClick={() => selected && updateStatus(selected, "reviewing")}
                disabled={acting}
              >
                <Eye className="h-4 w-4 mr-1" />Mark Reviewing
              </Button>
            )}
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => selected && updateStatus(selected, "resolved")}
              disabled={acting}
            >
              <CheckCircle className="h-4 w-4 mr-1" />Resolve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              onClick={() => selected && updateStatus(selected, "dismissed")}
              disabled={acting}
            >
              <XCircle className="h-4 w-4 mr-1" />Dismiss
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-muted-foreground hover:text-red-400"
              onClick={() => selected && deleteReport(selected)}
              disabled={acting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
