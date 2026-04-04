import { useEffect, useState } from "react";
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
import { AlertTriangle, CheckCircle, XCircle, Eye, RefreshCw, Clock, Shield, FileWarning, Inbox } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { ContentReport } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  reviewing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  resolved: "bg-green-500/10 text-green-400 border-green-500/30",
  dismissed: "bg-muted text-muted-foreground",
};

const REASON_LABELS: Record<string, string> = {
  incorrect_info: "Incorrect Info",
  poor_audio: "Poor Audio",
  misleading: "Misleading",
  inappropriate: "Inappropriate",
  copyright: "Copyright",
  other: "Other",
};

interface Stats {
  total: number;
  pending: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
}

export default function ContentReports() {
  const [items, setItems] = useState<ContentReport[]>([]);
  const [allItems, setAllItems] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selected, setSelected] = useState<ContentReport | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [acting, setActing] = useState(false);
  const { profile } = useAuth();

  const stats: Stats = {
    total: allItems.length,
    pending: allItems.filter(r => r.status === "pending").length,
    reviewing: allItems.filter(r => r.status === "reviewing").length,
    resolved: allItems.filter(r => r.status === "resolved").length,
    dismissed: allItems.filter(r => r.status === "dismissed").length,
  };

  async function load() {
    setLoading(true);
    try {
      const { data: allData, error: allError } = await supabase
        .from("content_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (allError) throw allError;

      const allReports = (allData ?? []) as ContentReport[];

      const reporterIds = [...new Set(allReports.map(r => r.reporter_id).filter(Boolean))];
      if (reporterIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", reporterIds);
        if (profiles) {
          const profileMap = new Map(profiles.map((p: { id: string; display_name: string }) => [p.id, p]));
          allReports.forEach(r => {
            if (r.reporter_id) r.reporter = profileMap.get(r.reporter_id) as ContentReport["reporter"];
          });
        }
      }

      setAllItems(allReports);
      if (filterStatus === "all") {
        setItems(allReports);
      } else {
        setItems(allReports.filter(r => r.status === filterStatus));
      }
    } catch {
      toast.error("Failed to load reports");
      setItems([]);
      setAllItems([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (filterStatus === "all") {
      setItems(allItems);
    } else {
      setItems(allItems.filter(r => r.status === filterStatus));
    }
  }, [filterStatus, allItems]);

  async function updateStatus(report: ContentReport, newStatus: string) {
    setActing(true);
    try {
      const { error } = await supabase.from("content_reports").update({
        status: newStatus,
        reviewed_by: profile?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", report.id);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: `Marked report as ${newStatus}`,
        entity_type: "content_report",
        entity_id: report.id,
        details: { content_id: report.content_id, content_type: report.content_type, note: actionNote || undefined },
      }).then(() => {}, () => {});
      toast.success(`Report marked as ${newStatus}`);
      setSelected(null);
      load();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Content Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and review user-submitted content reports
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-yellow-500/40 transition-colors" onClick={() => setFilterStatus("pending")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-400" />
              <span className="text-xs text-muted-foreground font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-blue-500/40 transition-colors" onClick={() => setFilterStatus("reviewing")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground font-medium">Reviewing</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{stats.reviewing}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-500/40 transition-colors" onClick={() => setFilterStatus("resolved")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span className="text-xs text-muted-foreground font-medium">Resolved</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{stats.resolved}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-muted-foreground/40 transition-colors" onClick={() => setFilterStatus("all")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Total</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
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
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead>Content ID</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </TableCell>
                  ))}
                </TableRow>
              )) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        {filterStatus === "pending" ? (
                          <Inbox className="h-6 w-6 text-muted-foreground" />
                        ) : (
                          <FileWarning className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">
                          {filterStatus === "pending" ? "No pending reports" : `No ${filterStatus === "all" ? "" : filterStatus + " "}reports found`}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {filterStatus === "pending" ? "All caught up! No reports need your attention." : "Try changing the filter to see other reports."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : items.map(r => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => { setSelected(r); setActionNote(""); }}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">{r.content_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {r.content_id?.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="text-sm">{REASON_LABELS[r.reason] || r.reason}</TableCell>
                  <TableCell className="text-sm">{r.reporter?.display_name || "Unknown"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              Review Report
            </DialogTitle>
            <DialogDescription>
              Review the details and take appropriate action.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Type</p>
                  <p className="capitalize font-medium">{selected.content_type}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Reason</p>
                  <p className="font-medium">{REASON_LABELS[selected.reason]}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Content ID</p>
                  <p className="font-mono text-xs break-all">{selected.content_id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Status</p>
                  <Badge variant="outline" className={STATUS_COLORS[selected.status]}>{selected.status}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Reporter</p>
                  <p className="font-medium">{selected.reporter?.display_name || "Unknown"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Date</p>
                  <p className="text-xs">{formatDateTime(selected.created_at)}</p>
                </div>
              </div>
              {selected.description && (
                <div>
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-1.5">Description</p>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm border border-border/50">{selected.description}</div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Admin Note (optional)</Label>
                <Textarea rows={2} placeholder="Add an internal note..." value={actionNote} onChange={e => setActionNote(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:justify-start pt-2">
            {selected?.status === "pending" && (
              <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => selected && updateStatus(selected, "reviewing")} disabled={acting}>
                <Eye className="h-4 w-4 mr-1" />
                Mark Reviewing
              </Button>
            )}
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => selected && updateStatus(selected, "resolved")} disabled={acting}>
              <CheckCircle className="h-4 w-4 mr-1" />Resolve
            </Button>
            <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => selected && updateStatus(selected, "dismissed")} disabled={acting}>
              <XCircle className="h-4 w-4 mr-1" />Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
