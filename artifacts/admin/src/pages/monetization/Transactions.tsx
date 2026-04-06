import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DollarSign, Users, Gift, TrendingUp, Search, RefreshCw,
  ChevronLeft, ChevronRight, ExternalLink, CreditCard, Smartphone, Globe, Shield,
  Calendar, Download,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import { toast } from "sonner";

interface Subscription {
  id: string;
  user_id: string;
  plan: "weekly" | "monthly" | "lifetime";
  status: "active" | "cancelled" | "expired" | "trial";
  started_at: string;
  expires_at: string | null;
  provider: string;
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
  profile: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface Prices {
  weekly: number;
  monthly: number;
  lifetime: number;
}

interface Summary {
  totalRevenue: number;
  paidCount: number;
  grantedCount: number;
  activeCount: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  lifetimeRevenue: number;
}

const PLAN_COLORS: Record<string, string> = {
  weekly:   "bg-primary/10 text-primary border-primary/30",
  monthly:  "bg-blue-500/10 text-blue-400 border-blue-500/30",
  lifetime: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-500/10 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
  expired:   "bg-orange-500/10 text-orange-400 border-orange-500/30",
  trial:     "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

const PROVIDER_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  stripe:   { label: "Stripe",   icon: CreditCard, color: "text-violet-400" },
  apple:    { label: "Apple",    icon: Smartphone, color: "text-slate-300" },
  android:  { label: "Android",  icon: Smartphone, color: "text-green-400" },
  google:   { label: "Google",   icon: Smartphone, color: "text-blue-400" },
  admin:    { label: "Granted",  icon: Shield,     color: "text-primary" },
  manual:   { label: "Manual",   icon: Shield,     color: "text-yellow-400" },
  free_trial: { label: "Trial", icon: Globe,      color: "text-cyan-400" },
};

function getProviderMeta(provider: string) {
  return PROVIDER_META[provider] ?? { label: provider, icon: Globe, color: "text-muted-foreground" };
}

function isGranted(provider: string) {
  return ["admin", "manual", "free_trial"].includes(provider);
}

function getPlanAmount(plan: string, provider: string, prices: Prices): number {
  if (isGranted(provider)) return 0;
  if (plan === "weekly")   return prices.weekly;
  if (plan === "monthly")  return prices.monthly;
  if (plan === "lifetime") return prices.lifetime;
  return 0;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date(0); // all time by default
  start.setFullYear(2020);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

const PAGE_SIZE = 25;

export default function Transactions() {
  const { profile } = useAuth();

  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaults.start);
  const [dateTo,   setDateTo]   = useState(defaults.end);
  const [planFilter,   setPlanFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [all, setAll]         = useState<Subscription[]>([]);
  const [prices, setPrices]   = useState<Prices>({ weekly: 0.99, monthly: 4.99, lifetime: 49.99 });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [priceRes, subsRes] = await Promise.all([
        supabase.from("app_settings").select("key,value").in("key", ["weekly_price_usd", "monthly_price_usd", "lifetime_price_usd"]),
        supabase
          .from("subscriptions")
          .select("*, profile:user_id(display_name, email, avatar_url)")
          .gte("started_at", new Date(dateFrom + "T00:00:00").toISOString())
          .lte("started_at", new Date(dateTo + "T23:59:59").toISOString())
          .order("started_at", { ascending: false }),
      ]);

      const p: Prices = { weekly: 0.99, monthly: 4.99, lifetime: 49.99 };
      (priceRes.data || []).forEach((row: { key: string; value: string }) => {
        if (row.key === "weekly_price_usd")   p.weekly   = parseFloat(row.value) || 0.99;
        if (row.key === "monthly_price_usd")  p.monthly  = parseFloat(row.value) || 4.99;
        if (row.key === "lifetime_price_usd") p.lifetime = parseFloat(row.value) || 49.99;
      });
      setPrices(p);
      setAll((subsRes.data as unknown as Subscription[]) ?? []);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
      setPage(0);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const filtered = all.filter(s => {
    if (planFilter !== "all" && s.plan !== planFilter) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (providerFilter === "paid" && isGranted(s.provider)) return false;
    if (providerFilter === "granted" && !isGranted(s.provider)) return false;
    if (search) {
      const q = search.toLowerCase();
      const name  = s.profile?.display_name?.toLowerCase() ?? "";
      const email = s.profile?.email?.toLowerCase() ?? "";
      if (!name.includes(q) && !email.includes(q) && !s.provider.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const summary: Summary = filtered.reduce(
    (acc, s) => {
      const amt = getPlanAmount(s.plan, s.provider, prices);
      if (!isGranted(s.provider)) {
        acc.totalRevenue += amt;
        acc.paidCount++;
        if (s.plan === "weekly")   acc.weeklyRevenue   += amt;
        if (s.plan === "monthly")  acc.monthlyRevenue  += amt;
        if (s.plan === "lifetime") acc.lifetimeRevenue += amt;
      } else {
        acc.grantedCount++;
      }
      if (s.status === "active") acc.activeCount++;
      return acc;
    },
    { totalRevenue: 0, paidCount: 0, grantedCount: 0, activeCount: 0, weeklyRevenue: 0, monthlyRevenue: 0, lifetimeRevenue: 0 } as Summary
  );

  function handleExport() {
    const rows = [
      ["User", "Email", "Plan", "Status", "Provider", "Amount", "Started", "Expires", "Transaction ID"],
      ...filtered.map(s => [
        s.profile?.display_name ?? "Unknown",
        s.profile?.email ?? "—",
        s.plan,
        s.status,
        s.provider,
        isGranted(s.provider) ? "$0.00 (Granted)" : formatCurrency(getPlanAmount(s.plan, s.provider, prices)),
        formatDate(s.started_at),
        s.expires_at ? formatDate(s.expires_at) : "Never (Lifetime)",
        s.provider_subscription_id ?? "—",
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Revenue & Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All subscription purchases and admin grants</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || filtered.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</span>
              <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 text-green-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-green-400">{formatCurrency(summary.totalRevenue)}</div>
            <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
              <div className="flex justify-between"><span>Weekly</span><span>{formatCurrency(summary.weeklyRevenue)}</span></div>
              <div className="flex justify-between"><span>Monthly</span><span>{formatCurrency(summary.monthlyRevenue)}</span></div>
              <div className="flex justify-between"><span>Lifetime</span><span>{formatCurrency(summary.lifetimeRevenue)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Paid Subscribers</span>
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="h-3.5 w-3.5 text-blue-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{summary.paidCount.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground mt-1">paid subscriptions in range</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Admin Granted</span>
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Gift className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold">{summary.grantedCount.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground mt-1">complimentary access</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Active Now</span>
              <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{summary.activeCount.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground mt-1">currently active subscriptions</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 w-[140px] text-xs" />
              </div>
              <Button size="sm" className="h-8 mt-5" onClick={load} disabled={loading}>Apply</Button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Plan</Label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source</Label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="paid">Paid only</SelectItem>
                  <SelectItem value="granted">Granted only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground">Search user</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Name or email…"
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {loading ? "Loading…" : `${filtered.length.toLocaleString()} record${filtered.length !== 1 ? "s" : ""}`}
          {(planFilter !== "all" || statusFilter !== "all" || providerFilter !== "all" || search) && " (filtered)"}
        </span>
        {totalPages > 1 && (
          <span>Page {page + 1} of {totalPages}</span>
        )}
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" style={{ animationDelay: `${i * 50}ms` }} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    {all.length === 0 ? "No subscriptions found in this date range" : "No records match your filters"}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map(sub => {
                  const pm = getProviderMeta(sub.provider);
                  const ProviderIcon = pm.icon;
                  const amount = getPlanAmount(sub.plan, sub.provider, prices);
                  const granted = isGranted(sub.provider);
                  const initials = (sub.profile?.display_name ?? sub.profile?.email ?? "?").slice(0, 2).toUpperCase();

                  return (
                    <TableRow key={sub.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={sub.profile?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate max-w-[140px]">{sub.profile?.display_name ?? "Unknown User"}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">{sub.profile?.email ?? "—"}</div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className={`text-xs capitalize ${PLAN_COLORS[sub.plan] ?? ""}`}>
                          {sub.plan}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {granted ? (
                          <span className="text-xs text-primary font-medium">Granted</span>
                        ) : (
                          <span className="text-sm font-semibold tabular-nums">{formatCurrency(amount)}</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ProviderIcon className={`h-3.5 w-3.5 ${pm.color}`} />
                          <span className="text-xs">{pm.label}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[sub.status] ?? ""}`}>
                          {sub.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateShort(sub.started_at)}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {sub.expires_at
                          ? formatDateShort(sub.expires_at)
                          : sub.plan === "lifetime"
                          ? <span className="text-purple-400 font-medium">Lifetime ∞</span>
                          : "—"}
                      </TableCell>

                      <TableCell>
                        <Link href={`/users/${sub.user_id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                const pg = Math.max(0, Math.min(totalPages - 5, page - 2)) + i;
                return (
                  <Button key={pg} variant={pg === page ? "default" : "outline"} size="icon" className="h-7 w-7 text-xs" onClick={() => setPage(pg)}>
                    {pg + 1}
                  </Button>
                );
              })}
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Pricing note */}
      <div className="text-[11px] text-muted-foreground text-center">
        Prices used: Weekly {formatCurrency(prices.weekly)} · Monthly {formatCurrency(prices.monthly)} · Lifetime {formatCurrency(prices.lifetime)}
        {" · "}Admin-granted subscriptions are shown but not counted in revenue totals.
      </div>
    </div>
  );
}
