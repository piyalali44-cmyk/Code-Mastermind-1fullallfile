import { useEffect, useState, useCallback } from "react";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, shortId } from "@/lib/utils";
import { Search, RefreshCw, UserCheck, ShieldAlert, Eye, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { PaginationBar } from "@/components/ui/PaginationBar";

interface UserRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string;
  country: string | null;
  subscription_tier: string;
  is_blocked: boolean;
  role: string | null;
  joined_at: string | null;
  last_active_at: string | null;
  total_xp: number;
}

const db = supabaseAdmin || supabase;

export default function UsersList() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = db
        .from("profiles")
        .select("id,display_name,avatar_url,email,country,subscription_tier,is_blocked,role,joined_at,last_active_at", { count: "exact" });

      if (search.trim()) {
        const s = search.trim();
        query = query.or(`display_name.ilike.%${s}%,email.ilike.%${s}%`);
      }
      if (filterTier !== "all") {
        query = query.eq("subscription_tier", filterTier);
      }
      if (filterStatus === "active") {
        query = query.eq("is_blocked", false);
      } else if (filterStatus === "blocked") {
        query = query.eq("is_blocked", true);
      }

      const { data, error, count } = await query
        .order("joined_at", { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      if (error) throw error;

      const rows = data || [];
      setTotal(count ?? rows.length);

      const ids = rows.map((u: { id: string }) => u.id);
      let xpMap: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: xpData } = await db
          .from("user_xp")
          .select("user_id,total_xp")
          .in("user_id", ids);
        xpData?.forEach((x: { user_id: string; total_xp: number }) => {
          xpMap[x.user_id] = x.total_xp;
        });
      }

      setUsers(
        rows.map((u: UserRow) => ({
          ...u,
          subscription_tier: u.subscription_tier ?? "free",
          is_blocked: u.is_blocked ?? false,
          total_xp: xpMap[u.id] ?? 0,
        }))
      );
    } catch (err: any) {
      toast.error("Failed to load users: " + (err?.message || "Unknown error"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterTier, filterStatus, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Real-time: auto-refresh when users are created or updated
  useEffect(() => {
    const channel = db
      .channel("admin-users-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        () => { fetchUsers(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => { fetchUsers(); }
      )
      .subscribe();

    return () => { db.removeChannel(channel); };
  }, [fetchUsers]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total.toLocaleString()} total users</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} className="shrink-0">
          <RefreshCw className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 md:p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterTier} onValueChange={(v) => { setFilterTier(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Tier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isMobile ? (
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                      <div className="h-3 w-48 bg-muted/50 animate-pulse rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : users.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <UserCheck className="h-10 w-10 opacity-30 mx-auto mb-2" />
                <p className="font-medium text-muted-foreground">No users found</p>
              </CardContent>
            </Card>
          ) : (
            users.map((user) => (
              <Card key={user.id} className="hover:border-border/80 transition-colors cursor-pointer" onClick={() => navigate(`/users/${user.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {user.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate">{user.display_name || "No name"}</span>
                        <Badge
                          variant={user.subscription_tier === "premium" ? "default" : "secondary"}
                          className={`text-[10px] px-1.5 ${user.subscription_tier === "premium" ? "bg-primary/20 text-primary border-primary/30" : ""}`}
                        >
                          {user.subscription_tier === "premium" ? "PRO" : "Free"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email || shortId(user.id)}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[11px] text-muted-foreground">{(user.total_xp || 0).toLocaleString()} XP</span>
                        {user.is_blocked && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">Blocked</Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>XP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UserCheck className="h-10 w-10 opacity-30" />
                        <p className="font-medium">No users found</p>
                        <p className="text-sm">Users who sign up to StayGuided Me will appear here.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {user.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm text-foreground">{user.display_name || "No name"}</div>
                            <div className="text-xs text-muted-foreground font-mono">{shortId(user.id)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email || "—"}</TableCell>
                      <TableCell className="text-sm">{user.country || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.subscription_tier === "premium" ? "default" : "secondary"}
                          className={user.subscription_tier === "premium" ? "bg-primary/20 text-primary border-primary/30" : ""}
                        >
                          {user.subscription_tier === "premium" ? "Premium" : "Free"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{(user.total_xp || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        {user.is_blocked ? (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldAlert className="h-3 w-3" /> Blocked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-green-400 border-green-400/30">
                            <UserCheck className="h-3 w-3" /> Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(user.joined_at || "")}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); navigate(`/users/${user.id}`); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={size => { setPageSize(size); setPage(0); }}
          />
        </Card>
      )}

      {isMobile && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(0); }}
        />
      )}
    </div>
  );
}
