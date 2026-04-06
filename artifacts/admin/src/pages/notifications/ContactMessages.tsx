import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw, MessageSquare, Mail, Search, ChevronDown, ChevronUp,
  Calendar, Send, CheckCircle2, Clock, InboxIcon, X,
} from "lucide-react";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { toast } from "sonner";

interface ContactMessage {
  id: string;
  created_at: string;
  action: string;
  details: {
    name: string;
    email: string;
    subject: string;
    message: string;
    user_id: string | null;
    status?: string;
    replied?: boolean;
    reply_text?: string;
    replied_at?: string;
    push_sent?: boolean;
  };
}

type StatusFilter = "all" | "unread" | "replied";

export default function ContactMessages() {
  const [messages, setMessages]     = useState<ContactMessage[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [statusFilter, setStatus]   = useState<StatusFilter>("all");
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [replyText, setReplyText]   = useState<Record<string, string>>({});
  const [sending, setSending]       = useState<string | null>(null);
  const [cmPage, setCmPage]         = useState(0);
  const [cmPageSize, setCmPageSize] = useState(25);

  async function load() {
    setLoading(true);
    try {
      let q = supabase
        .from("admin_activity_log")
        .select("id, created_at, action, details")
        .eq("entity_type", "contact_message")
        .order("created_at", { ascending: false })
        .limit(500);

      if (dateFrom) q = q.gte("created_at", dateFrom + "T00:00:00Z");
      if (dateTo)   q = q.lte("created_at", dateTo   + "T23:59:59Z");

      const { data, error } = await q;
      if (error) throw error;
      setMessages((data ?? []) as ContactMessage[]);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markReplied(id: string, replied: boolean, replyBody?: string) {
    try {
      const msg = messages.find(m => m.id === id);
      if (!msg) return;
      const newDetails: ContactMessage["details"] = {
        ...msg.details,
        replied,
        status: replied ? "replied" : "unread",
        ...(replyBody !== undefined ? { reply_text: replyBody, replied_at: new Date().toISOString() } : {}),
      };
      const { error } = await supabase
        .from("admin_activity_log")
        .update({ details: newDetails })
        .eq("id", id);
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === id ? { ...m, details: newDetails } : m));
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }

  async function sendReply(msg: ContactMessage) {
    const body = replyText[msg.id]?.trim();
    if (!body) { toast.error("Please write a reply first"); return; }
    setSending(msg.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        toast.error("Session expired — please refresh the page");
        return;
      }

      const apiBase: string = (import.meta.env as Record<string, string>).VITE_API_BASE_URL ?? "";
      const apiRes = await fetch(`${apiBase}/contact/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messageId: msg.id,
          replyText: body,
          userId: msg.details.user_id ?? null,
          userEmail: msg.details.email,
          userName: msg.details.name,
          subject: msg.details.subject,
        }),
      });

      if (!apiRes.ok) {
        const errBody = await apiRes.json().catch(() => ({}));
        const errMsg = (errBody as Record<string, string>).error || `API error ${apiRes.status}`;
        toast.error(`Reply failed: ${errMsg}`);
        return;
      }

      const apiJson = await apiRes.json();
      const pushSent = apiJson?.pushSent === true;
      const hasPushToken = apiJson?.hasPushToken === true;

      const newDetails: ContactMessage["details"] = {
        ...msg.details,
        replied: true,
        status: "replied",
        reply_text: body,
        replied_at: new Date().toISOString(),
        push_sent: pushSent,
      };
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, details: newDetails } : m));

      if (hasPushToken && pushSent) {
        toast.success("Reply sent & push notification delivered ✓");
      } else if (msg.details.user_id) {
        toast.success("Reply sent to user's notification inbox ✓");
      } else {
        toast.success("Reply saved ✓");
      }

      setReplyText(prev => { const n = { ...prev }; delete n[msg.id]; return n; });
    } catch (err: unknown) {
      toast.error(`Reply failed: ${(err as Error).message}`);
    } finally {
      setSending(null);
    }
  }

  const filtered = messages.filter(m => {
    const q  = search.toLowerCase();
    const sf = statusFilter;
    const matchSearch =
      !q ||
      m.details?.name?.toLowerCase().includes(q) ||
      m.details?.email?.toLowerCase().includes(q) ||
      m.details?.subject?.toLowerCase().includes(q) ||
      m.details?.message?.toLowerCase().includes(q);
    const matchStatus =
      sf === "all" ||
      (sf === "replied"  && m.details?.replied) ||
      (sf === "unread"   && !m.details?.replied);
    return matchSearch && matchStatus;
  });

  const total   = messages.length;
  const unread  = messages.filter(m => !m.details?.replied).length;
  const replied = messages.filter(m =>  m.details?.replied).length;

  function fmt(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function clearFilters() {
    setSearch(""); setDateFrom(""); setDateTo(""); setStatus("all");
  }
  const hasFilters = search || dateFrom || dateTo || statusFilter !== "all";

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Contact Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            User messages submitted from the app's Contact Us page.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unread > 0 && (
            <Badge className="bg-primary text-primary-foreground gap-1">
              <Clock className="h-3 w-3" /> {unread} unread
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── Summary Stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",   value: total,   icon: InboxIcon,     color: "text-foreground"        },
          { label: "Unread",  value: unread,  icon: Clock,         color: "text-primary"           },
          { label: "Replied", value: replied, icon: CheckCircle2,  color: "text-green-400"         },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
                <div>
                  <p className="text-2xl font-bold leading-none">{loading ? "—" : value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            {/* Search */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Name, email, subject…"
                  className="pl-8 h-9 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={v => setStatus(v as StatusFilter)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All messages</SelectItem>
                  <SelectItem value="unread">Unread only</SelectItem>
                  <SelectItem value="replied">Replied only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* From date */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From date</Label>
              <Input
                type="date"
                className="h-9 text-sm"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>

            {/* To date + clear */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To date</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  className="h-9 text-sm flex-1"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="h-9 px-2" onClick={clearFilters} title="Clear filters">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Apply date filter button (only when dates set) */}
          {(dateFrom || dateTo) && (
            <div className="mt-3">
              <Button size="sm" onClick={load}>
                Apply Date Filter
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Table ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead>From</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-[160px]">Date Received</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted animate-pulse rounded w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                  <InboxIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  {hasFilters ? "No messages match your filters" : "No contact messages yet"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(cmPage * cmPageSize, (cmPage + 1) * cmPageSize).map(msg => (
                <>
                  {/* ─ Row ─ */}
                  <TableRow
                    key={msg.id}
                    className={`cursor-pointer transition-colors ${
                      !msg.details?.replied ? "bg-primary/[0.03]" : ""
                    } hover:bg-muted/40`}
                    onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                  >
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          msg.details?.replied
                            ? "border-green-500/30 text-green-400 bg-green-500/10 gap-1"
                            : "border-primary/30 text-primary bg-primary/10 gap-1"
                        }
                      >
                        {msg.details?.replied
                          ? <><CheckCircle2 className="h-3 w-3" /> Replied</>
                          : <><Clock className="h-3 w-3" /> Unread</>
                        }
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-sm leading-tight">{msg.details?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{msg.details?.email || "—"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate max-w-[220px] font-medium">{msg.details?.subject || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[220px] mt-0.5">
                        {msg.details?.message?.slice(0, 60) || ""}…
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(msg.created_at)}
                    </TableCell>
                    <TableCell>
                      {expanded === msg.id
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      }
                    </TableCell>
                  </TableRow>

                  {/* ─ Expanded Detail ─ */}
                  {expanded === msg.id && (
                    <TableRow key={`${msg.id}-detail`}>
                      <TableCell colSpan={5} className="bg-muted/20 border-b border-border p-0">
                        <div className="p-5 space-y-5">

                          {/* Original message */}
                          <div className="bg-background rounded-xl border border-border p-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Original Message
                            </p>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                              {msg.details?.message || "—"}
                            </p>
                          </div>

                          {/* Previous reply (if any) */}
                          {msg.details?.reply_text && (
                            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                                  Your Reply · {fmt(msg.details.replied_at ?? null)}
                                </p>
                                <div className="flex items-center gap-2">
                                  {msg.details.user_id && (
                                    <Badge variant="outline" className={`text-[10px] gap-1 ${
                                      msg.details.push_sent
                                        ? "border-green-500/30 text-green-400"
                                        : "border-muted-foreground/30 text-muted-foreground"
                                    }`}>
                                      {msg.details.push_sent ? <><CheckCircle2 className="h-2.5 w-2.5" /> Push sent</> : "No push"}
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-[10px] gap-1 border-blue-500/30 text-blue-400">
                                    <Mail className="h-2.5 w-2.5" /> In-app notification
                                  </Badge>
                                </div>
                              </div>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                                {msg.details.reply_text}
                              </p>
                            </div>
                          )}

                          <Separator />

                          {/* Reply composer */}
                          <div className="space-y-3">
                            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Mail className="h-4 w-4 text-primary" />
                              Write Reply
                              <span className="text-xs text-muted-foreground font-normal">
                                → to {msg.details.email}
                              </span>
                            </p>
                            <Textarea
                              rows={5}
                              placeholder={`Dear ${msg.details.name || "User"},\n\nType your reply here…`}
                              className="resize-none text-sm font-mono"
                              value={replyText[msg.id] ?? ""}
                              onChange={e => setReplyText(prev => ({ ...prev, [msg.id]: e.target.value }))}
                            />
                            <div className="flex items-center gap-3 flex-wrap">
                              <Button
                                size="sm"
                                className="gap-1.5"
                                disabled={sending === msg.id}
                                onClick={() => sendReply(msg)}
                              >
                                <Send className="h-3.5 w-3.5" />
                                {sending === msg.id ? "Sending…" : "Send Reply"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markReplied(msg.id, !msg.details?.replied)}
                              >
                                {msg.details?.replied ? "Mark as Unread" : "Mark as Replied"}
                              </Button>
                              {msg.details?.user_id && (
                                <Badge variant="outline" className="font-mono text-xs ml-auto">
                                  User: {msg.details.user_id.slice(0, 8)}…
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationBar
          page={cmPage}
          pageSize={cmPageSize}
          total={filtered.length}
          onPageChange={p => { setCmPage(p); setExpanded(null); }}
          onPageSizeChange={s => { setCmPageSize(s); setCmPage(0); setExpanded(null); }}
        />
      </Card>
    </div>
  );
}
