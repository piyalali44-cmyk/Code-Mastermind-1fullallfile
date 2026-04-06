import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { MessageCircle, Trash2, Flag, RefreshCw, Search, Eye, EyeOff, UserX } from "lucide-react";

const db = (supabaseAdmin ?? supabase) as typeof supabase;

interface AdminComment {
  id: string;
  user_id: string;
  content_type: string;
  content_id: string;
  body: string;
  is_deleted: boolean;
  is_flagged: boolean;
  created_at: string;
  display_name: string | null;
  email: string | null;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Comments() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [blockingUser, setBlockingUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: blockedData } = await db.from("comment_blocked_users").select("user_id");
      if (blockedData) {
        setBlockedUsers(new Set(blockedData.map((r: { user_id: string }) => r.user_id)));
      }

      let q = db
        .from("content_comments")
        .select("id, user_id, content_type, content_id, body, is_deleted, is_flagged, created_at, profiles!user_id(display_name)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (filterType !== "all") q = q.eq("content_type", filterType);
      if (filterStatus === "active") q = q.eq("is_deleted", false).eq("is_flagged", false);
      if (filterStatus === "flagged") q = q.eq("is_flagged", true);
      if (filterStatus === "deleted") q = q.eq("is_deleted", true);
      if (search) q = q.ilike("body", `%${search}%`);

      const { data, count, error } = await q;
      if (error) throw error;

      const rows: AdminComment[] = (data ?? []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        content_type: r.content_type,
        content_id: r.content_id,
        body: r.body,
        is_deleted: r.is_deleted,
        is_flagged: r.is_flagged,
        created_at: r.created_at,
        display_name: r.profiles?.display_name ?? null,
        email: null,
      }));

      setComments(rows);
      setTotal(count ?? 0);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  const softDelete = async (id: string) => {
    const { error } = await db.from("content_comments").update({ is_deleted: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Comment deleted");
    setComments((prev) => prev.map((c) => c.id === id ? { ...c, is_deleted: true } : c));
  };

  const hardDelete = async (id: string) => {
    if (!confirm("Permanently delete this comment? This cannot be undone.")) return;
    const { error } = await db.from("content_comments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Comment permanently deleted");
    setComments((prev) => prev.filter((c) => c.id !== id));
    setTotal((n) => n - 1);
  };

  const toggleFlag = async (id: string, current: boolean) => {
    const { error } = await db.from("content_comments").update({ is_flagged: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(current ? "Flag removed" : "Comment flagged");
    setComments((prev) => prev.map((c) => c.id === id ? { ...c, is_flagged: !current } : c));
  };

  const restore = async (id: string) => {
    const { error } = await db.from("content_comments").update({ is_deleted: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Comment restored");
    setComments((prev) => prev.map((c) => c.id === id ? { ...c, is_deleted: false } : c));
  };

  const toggleBlockUser = async (userId: string, displayName: string | null) => {
    if (blockingUser === userId) return;
    setBlockingUser(userId);
    try {
      const isBlocked = blockedUsers.has(userId);
      if (isBlocked) {
        const { error } = await db.from("comment_blocked_users").delete().eq("user_id", userId);
        if (error) { toast.error(error.message); return; }
        setBlockedUsers((prev) => { const s = new Set(prev); s.delete(userId); return s; });
        toast.success(`${displayName ?? "User"} can now comment again`);
      } else {
        const { error } = await db.from("comment_blocked_users").upsert({ user_id: userId }, { onConflict: "user_id" });
        if (error) { toast.error(error.message); return; }
        setBlockedUsers((prev) => new Set([...prev, userId]));
        toast.success(`${displayName ?? "User"} blocked from commenting`);
      }
    } finally {
      setBlockingUser(null);
    }
  };

  const activeCount = comments.filter((c) => !c.is_deleted && !c.is_flagged).length;
  const flaggedCount = comments.filter((c) => c.is_flagged).length;
  const deletedCount = comments.filter((c) => c.is_deleted).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Comments</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage user comments on all content</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Comments", value: total, icon: MessageCircle, color: "text-blue-400" },
          { label: "Active", value: activeCount, icon: Eye, color: "text-green-400" },
          { label: "Flagged", value: flaggedCount, icon: Flag, color: "text-yellow-400" },
          { label: "Deleted", value: deletedCount, icon: EyeOff, color: "text-red-400" },
          { label: "Blocked Users", value: blockedUsers.size, icon: UserX, color: "text-red-500" },
        ].map((s) => (
          <Card key={s.label} className="border-border bg-surface">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border">
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search comments..."
              className="pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); setSearch(searchInput); } }}
            />
          </div>
          <Select value={filterType} onValueChange={(v) => { setPage(0); setFilterType(v); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Content type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="episode">Episode</SelectItem>
              <SelectItem value="surah">Surah</SelectItem>
              <SelectItem value="series">Series</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => { setPage(0); setFilterStatus(v); }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="flagged">Flagged</SelectItem>
              <SelectItem value="deleted">Deleted</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setPage(0); setSearch(searchInput); }}>
            <Search className="h-4 w-4 mr-1" /> Search
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <MessageCircle className="h-10 w-10 opacity-30" />
              <p>No comments found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comments.map((c) => (
                  <TableRow key={c.id} className={c.is_deleted ? "opacity-50" : c.is_flagged ? "bg-yellow-500/5" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${blockedUsers.has(c.user_id) ? "bg-red-500/20 text-red-400" : "bg-primary/10 text-primary"}`}>
                          {(c.display_name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium truncate max-w-[120px] block">{c.display_name ?? "Unknown"}</span>
                          {blockedUsers.has(c.user_id) && (
                            <span className="text-[10px] text-red-400 font-semibold">BLOCKED</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{c.content_type}</Badge>
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-[80px] truncate">{c.content_id}</div>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <p className="text-sm line-clamp-2">{c.body}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {c.is_deleted && <Badge className="text-xs bg-red-500/10 text-red-400 border-red-500/30 w-fit">Deleted</Badge>}
                        {c.is_flagged && <Badge className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30 w-fit">Flagged</Badge>}
                        {!c.is_deleted && !c.is_flagged && <Badge className="text-xs bg-green-500/10 text-green-400 border-green-500/30 w-fit">Active</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{timeAgo(c.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {c.is_deleted ? (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => restore(c.id)}>
                            Restore
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400 hover:text-red-300" onClick={() => softDelete(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-7 px-2 ${c.is_flagged ? "text-yellow-400" : "text-muted-foreground"}`}
                          onClick={() => toggleFlag(c.id, c.is_flagged)}
                          title={c.is_flagged ? "Remove flag" : "Flag comment"}
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={blockingUser === c.user_id}
                          className={`h-7 px-2 ${blockedUsers.has(c.user_id) ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-red-400"}`}
                          onClick={() => toggleBlockUser(c.user_id, c.display_name)}
                          title={blockedUsers.has(c.user_id) ? "Unblock user from commenting" : "Block user from commenting"}
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:text-red-400" onClick={() => hardDelete(c.id)}>
                          ✕
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
