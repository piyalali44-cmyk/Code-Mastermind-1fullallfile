import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { MessageCircle, Trash2, Flag, RefreshCw, Search, Eye, EyeOff, UserX } from "lucide-react";

const API_BASE: string =
  (import.meta.env as Record<string, string>).VITE_API_BASE_URL || "";

const POLL_INTERVAL_MS = 10_000;

async function apiCall(path: string, method = "GET", body?: object) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  const opts: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${API_BASE}${path}`, opts);
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

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

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveError, setLiveError] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSilentRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    isSilentRef.current = silent;
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        filterType,
        filterStatus,
        search,
      });

      const [commentsRes, blockedRes] = await Promise.all([
        apiCall(`/admin/comments?${params.toString()}`),
        apiCall("/admin/comment-blocked-users"),
      ]);

      setComments(commentsRes.comments ?? []);
      setTotal(commentsRes.total ?? 0);
      setBlockedUsers(new Set(blockedRes.blocked ?? []));
      setLastUpdated(new Date());
      setLiveError(false);
    } catch (err: any) {
      setLiveError(true);
      if (!silent) toast.error(err.message ?? "Failed to load comments");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, filterType, filterStatus, search]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => { load(true); }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  async function softDelete(id: string) {
    try {
      await apiCall(`/admin/comments/${id}/soft-delete`, "POST");
      setComments(prev => prev.map(c => c.id === id ? { ...c, is_deleted: true } : c));
      toast.success("Comment deleted");
    } catch (err: any) { toast.error(err.message); }
  }

  async function restore(id: string) {
    try {
      await apiCall(`/admin/comments/${id}/restore`, "POST");
      setComments(prev => prev.map(c => c.id === id ? { ...c, is_deleted: false } : c));
      toast.success("Comment restored");
    } catch (err: any) { toast.error(err.message); }
  }

  async function toggleFlag(id: string, current: boolean) {
    try {
      await apiCall(`/admin/comments/${id}/flag`, "POST", { flagged: !current });
      setComments(prev => prev.map(c => c.id === id ? { ...c, is_flagged: !current } : c));
      toast.success(current ? "Flag removed" : "Comment flagged");
    } catch (err: any) { toast.error(err.message); }
  }

  async function blockUser(userId: string) {
    setBlockingUser(userId);
    try {
      await apiCall(`/admin/comment-blocked-users/${userId}/block`, "POST");
      setBlockedUsers(prev => new Set([...prev, userId]));
      toast.success("User blocked from commenting");
    } catch (err: any) { toast.error(err.message); }
    finally { setBlockingUser(null); }
  }

  async function unblockUser(userId: string) {
    setBlockingUser(userId);
    try {
      await apiCall(`/admin/comment-blocked-users/${userId}/unblock`, "POST");
      setBlockedUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });
      toast.success("User unblocked");
    } catch (err: any) { toast.error(err.message); }
    finally { setBlockingUser(null); }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Comments</h1>
          <Badge variant="secondary">{total} total</Badge>
          <div className="flex items-center gap-1.5 ml-1">
            <span
              className={`inline-block h-2 w-2 rounded-full ${liveError ? "bg-red-500" : "bg-green-500 animate-pulse"}`}
            />
            <span className={`text-xs font-semibold tracking-wide ${liveError ? "text-red-500" : "text-green-600"}`}>
              {liveError ? "OFFLINE" : "LIVE"}
            </span>
            {lastUpdated && !liveError && (
              <span className="text-xs text-muted-foreground ml-1">
                · updated {timeAgo(lastUpdated.toISOString())}
              </span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(false)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="series">Series</SelectItem>
                <SelectItem value="episode">Episode</SelectItem>
                <SelectItem value="surah">Surah</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2 flex-1 min-w-[200px]">
              <Input
                placeholder="Search comments..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setSearch(searchInput); setPage(0); } }}
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={() => { setSearch(searchInput); setPage(0); }}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="max-w-xs">Comment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : comments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No comments found
                  </TableCell>
                </TableRow>
              ) : (
                comments.map(c => (
                  <TableRow key={c.id} className={c.is_deleted ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="min-w-[120px]">
                        <div className="font-medium text-sm truncate max-w-[140px]">
                          {c.display_name ?? "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[140px]">
                          {c.email ?? c.user_id.slice(0, 8)}
                        </div>
                        {blockedUsers.has(c.user_id) && (
                          <Badge variant="destructive" className="text-xs mt-1">Blocked</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{c.content_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm line-clamp-2 break-words">{c.body}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {c.is_deleted && <Badge variant="destructive" className="text-xs">Deleted</Badge>}
                        {c.is_flagged && <Badge variant="outline" className="text-xs text-orange-600 border-orange-400">Flagged</Badge>}
                        {!c.is_deleted && !c.is_flagged && <Badge variant="secondary" className="text-xs">Active</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {timeAgo(c.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {c.is_deleted ? (
                          <Button size="icon" variant="ghost" title="Restore" onClick={() => restore(c.id)}>
                            <Eye className="h-4 w-4 text-green-600" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" title="Delete" onClick={() => softDelete(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}

                        <Button
                          size="icon"
                          variant="ghost"
                          title={c.is_flagged ? "Remove flag" : "Flag comment"}
                          onClick={() => toggleFlag(c.id, c.is_flagged)}
                        >
                          {c.is_flagged ? (
                            <EyeOff className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Flag className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          title={blockedUsers.has(c.user_id) ? "Unblock user" : "Block user from commenting"}
                          disabled={blockingUser === c.user_id}
                          onClick={() =>
                            blockedUsers.has(c.user_id)
                              ? unblockUser(c.user_id)
                              : blockUser(c.user_id)
                          }
                        >
                          <UserX className={`h-4 w-4 ${blockedUsers.has(c.user_id) ? "text-destructive" : "text-muted-foreground"}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
