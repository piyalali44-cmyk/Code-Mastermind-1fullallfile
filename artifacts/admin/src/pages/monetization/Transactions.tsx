import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, Users, Gift, TrendingUp, Search, RefreshCw,
  ChevronLeft, ChevronRight, ExternalLink, CreditCard, Smartphone,
  Globe, Shield, Calendar, Download, Wifi,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import MigrationBanner from "@/components/MigrationBanner";

/* ─── Types ─────────────────────────────────────────────── */
interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: "weekly" | "monthly" | "lifetime";
  status: "active" | "cancelled" | "expired" | "trial";
  started_at: string;
  expires_at: string | null;
  provider: string;
  provider_subscription_id: string | null;
  store: string | null;
  product_id: string | null;
  original_transaction_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface Subscription extends SubscriptionRow {
  profile: Profile | null;
}

interface Prices { weekly: number; monthly: number; lifetime: number }

/* ─── Constants ──────────────────────────────────────────── */
const PLAN_COLORS: Record<string, string> = {
  weekly:   "bg-amber-500/10  text-amber-400  border-amber-500/30",
  monthly:  "bg-blue-500/10   text-blue-400   border-blue-500/30",
  lifetime: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-500/10  text-green-400  border-green-500/30",
  cancelled: "bg-red-500/10    text-red-400    border-red-500/30",
  expired:   "bg-orange-500/10 text-orange-400 border-orange-500/30",
  trial:     "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

const PROVIDER_META: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  stripe:     { label: "Stripe",  Icon: CreditCard, color: "text-violet-400" },
  apple:      { label: "Apple",   Icon: Smartphone, color: "text-slate-300" },
  ios:        { label: "iOS",     Icon: Smartphone, color: "text-slate-300" },
  android:    { label: "Android", Icon: Smartphone, color: "text-green-400" },
  google:     { label: "Google",  Icon: Smartphone, color: "text-blue-400" },
  admin:      { label: "Granted", Icon: Shield,     color: "text-primary" },
  manual:     { label: "Manual",  Icon: Shield,     color: "text-yellow-400" },
  free_trial: { label: "Trial",   Icon: Globe,      color: "text-cyan-400" },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getProviderMeta(p: string) {
  return PROVIDER_META[p] ?? { label: p, Icon: Globe, color: "text-muted-foreground" };
}

function isGranted(provider: string) {
  return ["admin", "manual", "free_trial"].includes(provider);
}

function getPlanAmount(plan: string, provider: string, prices: Prices) {
  if (isGranted(provider)) return 0;
  return prices[plan as keyof Prices] ?? 0;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

function getDefault() {
  return {
    from: "2020-01-01",
    to: new Date().toISOString().slice(0, 10),
  };
}

/* ─── Component ──────────────────────────────────────────── */
export default function Transactions() {
  const def = getDefault();
  const [dateFrom, setDateFrom] = useState(def.from);
  const [dateTo,   setDateTo]   = useState(def.to);
  const [planF,    setPlanF]    = useState("all");
  const [statusF,  setStatusF]  = useState("all");
  const [providerF,setProviderF]= useState("all");
  const [search,   setSearch]   = useState("");

  const [all,    setAll]    = useState<Subscription[]>([]);
  const [prices, setPrices] = useState<Prices>({ weekly: 0.99, monthly: 4.99, lifetime: 49.99 });
  const [loading,setLoading]= useState(true);
  const [live,   setLive]   = useState(false);

  const [page,     setPage]     = useState(0);
  const [pageSize, setPageSize] = useState(25);

  /* ─── Fetch ────────────────────────────────────────── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [priceRes, subsRes] = await Promise.all([
        supabase.from("app_settings").select("key,value")
          .in("key", ["weekly_price_usd", "monthly_price_usd", "lifetime_price_usd"]),
        supabase.from("subscriptions").select(
          "id,user_id,plan,status,started_at,expires_at,provider,provider_subscription_id,store,product_id,original_transaction_id,created_at"
        )
          .gte("started_at", `${dateFrom}T00:00:00`)
          .lte("started_at", `${dateTo}T23:59:59`)
          .order("started_at", { ascending: false }),
      ]);

      /* prices */
      const p: Prices = { weekly: 0.99, monthly: 4.99, lifetime: 49.99 };
      (priceRes.data ?? []).forEach((r: { key: string; value: string }) => {
        if (r.key === "weekly_price_usd")   p.weekly   = parseFloat(r.value) || 0.99;
        if (r.key === "monthly_price_usd")  p.monthly  = parseFloat(r.value) || 4.99;
        if (r.key === "lifetime_price_usd") p.lifetime = parseFloat(r.value) || 49.99;
      });
      setPrices(p);

      const subs: SubscriptionRow[] = (subsRes.data ?? []) as SubscriptionRow[];

      /* fetch profiles separately to avoid FK-join issues */
      let enriched: Subscription[] = subs.map(s => ({ ...s, profile: null }));
      if (subs.length > 0) {
        const ids = subs.map(s => s.user_id);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id,display_name,email,avatar_url")
          .in("id", ids);

        const profileMap = new Map((profileData ?? []).map((pr: Profile) => [pr.id, pr]));
        enriched = subs.map(s => ({ ...s, profile: profileMap.get(s.user_id) ?? null }));
      }

      setAll(enriched);
      if (!silent) setPage(0);
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  /* ─── Real-time subscription ───────────────────────── */
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const ch = supabase.channel("transactions-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => {
        load(true);
      })
      .subscribe(status => {
        setLive(status === "SUBSCRIBED");
      });
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  /* ─── Filter in-memory ─────────────────────────────── */
  const filtered = all.filter(s => {
    if (planF     !== "all" && s.plan     !== planF)     return false;
    if (statusF   !== "all" && s.status   !== statusF)   return false;
    if (providerF === "paid"    && isGranted(s.provider)) return false;
    if (providerF === "granted" && !isGranted(s.provider))return false;
    if (search) {
      const q = search.toLowerCase();
      const nm = s.profile?.display_name?.toLowerCase() ?? "";
      const em = s.profile?.email?.toLowerCase() ?? "";
      if (!nm.includes(q) && !em.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows   = filtered.slice(page * pageSize, (page + 1) * pageSize);

  /* ─── KPIs ─────────────────────────────────────────── */
  const kpi = filtered.reduce(
    (acc, s) => {
      const amt = getPlanAmount(s.plan, s.provider, prices);
      if (!isGranted(s.provider)) {
        acc.revenue += amt;
        acc.paid++;
        acc[s.plan as "weekly"|"monthly"|"lifetime"] += amt;
      } else {
        acc.granted++;
      }
      if (s.status === "active") acc.active++;
      return acc;
    },
    { revenue: 0, paid: 0, granted: 0, active: 0, weekly: 0, monthly: 0, lifetime: 0 }
  );

  /* ─── CSV export ───────────────────────────────────── */
  function handleExport() {
    const rows = [
      ["User", "Email", "Plan", "Status", "Provider", "Store", "Product ID", "Amount", "Started", "Expires", "Transaction ID", "Original Transaction ID"],
      ...filtered.map(s => [
        s.profile?.display_name ?? "Unknown",
        s.profile?.email ?? "—",
        s.plan, s.status, s.provider,
        s.store ?? "—",
        s.product_id ?? "—",
        isGranted(s.provider) ? "Granted" : fmt(getPlanAmount(s.plan, s.provider, prices)),
        fmtDate(s.started_at),
        s.expires_at ? fmtDate(s.expires_at) : (s.plan === "lifetime" ? "Lifetime" : "—"),
        s.provider_subscription_id ?? "—",
        s.original_transaction_id ?? "—",
      ]),
    ];
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `transactions_${dateFrom}_${dateTo}.csv`,
    });
    a.click();
    toast.success("CSV exported");
  }

  /* ─── Pagination bar ───────────────────────────────── */
  function PaginationBar() {
    const windowStart = Math.max(0, Math.min(totalPages - 5, page - 2));
    const windowPages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => windowStart + i);
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs text-muted-foreground">
        <span>
          {filtered.length === 0 ? "No records" :
            `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} of ${filtered.length.toLocaleString()}`}
        </span>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => setPage(0)} disabled={page === 0}>
            <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {windowPages.map(pg => (
            <Button key={pg}
              variant={pg === page ? "default" : "outline"}
              size="icon" className="h-7 w-7 text-xs"
              onClick={() => setPage(pg)}>
              {pg + 1}
            </Button>
          ))}
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7"
            onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>
            <ChevronRight className="h-3.5 w-3.5" /><ChevronRight className="h-3.5 w-3.5 -ml-2" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
            <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(n => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  /* ─── Render ───────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Revenue & Transactions</h1>
            <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
              live ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground border-border"
            }`}>
              <Wifi className="h-2.5 w-2.5" />
              {live ? "Live" : "Connecting…"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">All subscription purchases and admin-granted access</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading || filtered.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      <MigrationBanner />

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Revenue</span>
              <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <DollarSign className="h-3.5 w-3.5 text-green-400" />
              </div>
            </div>
            <div className="text-2xl font-bold text-green-400">{fmt(kpi.revenue)}</div>
            <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              <div className="flex justify-between"><span>Weekly</span><span className="text-foreground/70">{fmt(kpi.weekly)}</span></div>
              <div className="flex justify-between"><span>Monthly</span><span className="text-foreground/70">{fmt(kpi.monthly)}</span></div>
              <div className="flex justify-between"><span>Lifetime</span><span className="text-foreground/70">{fmt(kpi.lifetime)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Paid</span>
              <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <CreditCard className="h-3.5 w-3.5 text-blue-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{kpi.paid.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground mt-1">paid subscribers in range</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Admin Granted</span>
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold">{kpi.granted.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground mt-1">complimentary — not in revenue</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Active Now</span>
              <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              </div>
            </div>
            <div className="text-2xl font-bold">{kpi.active.toLocaleString()}</div>
            <div className="text-[11px] text-muted-foreground mt-1">currently active subscriptions</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Date range */}
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <div className="flex items-center gap-1.5 h-8 border border-input rounded-md px-2 bg-background">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="bg-transparent text-xs outline-none w-[120px]" />
                </div>
              </div>
              <span className="text-muted-foreground text-sm mb-1.5">→</span>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <div className="flex items-center gap-1.5 h-8 border border-input rounded-md px-2 bg-background">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="bg-transparent text-xs outline-none w-[120px]" />
                </div>
              </div>
              <Button size="sm" className="h-8" onClick={() => load()}>Apply</Button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Plan</Label>
              <Select value={planF} onValueChange={v => { setPlanF(v); setPage(0); }}>
                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
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
              <Select value={statusF} onValueChange={v => { setStatusF(v); setPage(0); }}>
                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
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
              <Select value={providerF} onValueChange={v => { setProviderF(v); setPage(0); }}>
                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="paid">Paid only</SelectItem>
                  <SelectItem value="granted">Granted only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Name or email…" className="pl-8 h-8 text-xs" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result info */}
      <div className="text-sm text-muted-foreground">
        {loading ? "Loading…" : (
          <>
            <span className="font-medium text-foreground">{filtered.length.toLocaleString()}</span>
            {" "}record{filtered.length !== 1 ? "s" : ""}
            {(planF !== "all" || statusF !== "all" || providerF !== "all" || search) && " (filtered)"}
            {" — "}total {all.length.toLocaleString()} in date range
          </>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[200px]">User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Store / Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-10 text-right">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}>
                        <div className="h-4 bg-muted animate-pulse rounded"
                          style={{ animationDelay: `${i * 40}ms`, width: j === 0 ? "80%" : "60%" }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-16">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    {all.length === 0
                      ? "No subscriptions found in this date range"
                      : "No records match your current filters"}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map(sub => {
                  const pm = getProviderMeta(sub.provider);
                  const granted = isGranted(sub.provider);
                  const amount  = getPlanAmount(sub.plan, sub.provider, prices);
                  const initials = (sub.profile?.display_name ?? sub.profile?.email ?? "?")
                    .slice(0, 2).toUpperCase();

                  return (
                    <TableRow key={sub.id} className="group hover:bg-muted/20 transition-colors">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={sub.profile?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate max-w-[130px]">
                              {sub.profile?.display_name ?? <span className="text-muted-foreground italic">Unknown</span>}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                              {sub.profile?.email ?? sub.user_id.slice(0, 8) + "…"}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline"
                          className={`text-xs capitalize font-medium ${PLAN_COLORS[sub.plan] ?? ""}`}>
                          {sub.plan}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {granted ? (
                          <span className="text-xs font-medium text-primary flex items-center gap-1">
                            <Gift className="h-3 w-3" />Granted
                          </span>
                        ) : (
                          <span className="text-sm font-semibold tabular-nums">{fmt(amount)}</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <pm.Icon className={`h-3.5 w-3.5 shrink-0 ${pm.color}`} />
                          <span className="text-xs capitalize">{pm.label}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          {sub.store && sub.store !== "manual" && sub.store !== "admin" ? (
                            <span className={`text-[11px] font-medium capitalize ${
                              sub.store === "app_store" ? "text-slate-300" :
                              sub.store === "google_play" ? "text-green-400" :
                              sub.store === "promo" ? "text-primary" :
                              "text-muted-foreground"
                            }`}>
                              {sub.store === "app_store" ? "App Store" :
                               sub.store === "google_play" ? "Google Play" :
                               sub.store}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                          {sub.product_id && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[100px]" title={sub.product_id}>
                              {sub.product_id}
                            </span>
                          )}
                          {sub.original_transaction_id && (
                            <span className="text-[10px] text-muted-foreground/60 truncate max-w-[100px] font-mono" title={sub.original_transaction_id}>
                              {sub.original_transaction_id.slice(0, 12)}…
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline"
                          className={`text-xs capitalize ${STATUS_COLORS[sub.status] ?? ""}`}>
                          {sub.status}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateShort(sub.started_at)}
                      </TableCell>

                      <TableCell className="text-xs whitespace-nowrap">
                        {sub.expires_at
                          ? <span className="text-muted-foreground">{fmtDateShort(sub.expires_at)}</span>
                          : sub.plan === "lifetime"
                          ? <span className="text-purple-400 font-medium">Lifetime ∞</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>

                      <TableCell className="text-right">
                        <Link href={`/users/${sub.user_id}`}>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
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

        {/* Pagination always visible at bottom */}
        <PaginationBar />
      </Card>

      {/* Footer note */}
      <p className="text-[11px] text-center text-muted-foreground pb-2">
        Prices: Weekly {fmt(prices.weekly)} · Monthly {fmt(prices.monthly)} · Lifetime {fmt(prices.lifetime)}
        {" · "}Admin-granted records are shown but excluded from revenue totals.
      </p>
    </div>
  );
}
