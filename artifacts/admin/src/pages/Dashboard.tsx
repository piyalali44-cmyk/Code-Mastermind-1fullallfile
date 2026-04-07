import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { formatRelative } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Users, CreditCard, Headphones, Mic2, AlertTriangle, TrendingUp, BookOpen, Star, Globe, Activity, DollarSign, Calendar, MessageSquare, Clock, CheckCircle2, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import MigrationBanner from "@/components/MigrationBanner";

interface LogEntry {
  id: string; action: string; entity_type: string | null; created_at: string;
}

interface CountryRow { country: string | null; count: number }

interface DashboardData {
  totalUsers: number;
  premiumSubscribers: number;
  paidPremium: number;
  grantedPremium: number;
  totalEpisodes: number;
  publishedEpisodes: number;
  draftEpisodes: number;
  reviewEpisodes: number;
  totalSeries: number;
  newUsers7d: number;
  pendingReports: number;
  recentActivity: LogEntry[];
  userGrowth: { date: string; count: number }[];
  topContent: { title: string; plays: number }[];
  topCountries: CountryRow[];
}

interface RevenueData {
  totalRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  weeklyCount: number;
  monthlyCount: number;
  trialCount: number;
  activeCount: number;
  adminGranted: number;
}

interface ContactStats {
  total: number;
  open: number;
  replied: number;
}

const ENTITY_COLORS: Record<string, string> = {
  user: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  series: "bg-green-500/10 text-green-400 border-green-500/30",
  episode: "bg-green-500/10 text-green-400 border-green-500/30",
  reciter: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  coupon: "bg-primary/10 text-primary border-primary/30",
  app_settings: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  feature_flag: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  category: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  journey_chapter: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", SA: "Saudi Arabia", EG: "Egypt",
  AE: "UAE", PK: "Pakistan", BD: "Bangladesh", NG: "Nigeria", ID: "Indonesia",
  MY: "Malaysia", TR: "Turkey", MA: "Morocco", IN: "India", DE: "Germany",
  FR: "France", CA: "Canada", AU: "Australia", SG: "Singapore",
};

function countryName(code: string | null) {
  if (!code) return "Unknown";
  return COUNTRY_NAMES[code.toUpperCase()] || code.toUpperCase();
}

function getFlagEmoji(code: string | null) {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function Dashboard() {
  const { isAtLeast, profile } = useAuth();
  const isSupportOnly = !isAtLeast("content");

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const defaults = getDefaultDates();
  const [revenueStart, setRevenueStart] = useState(defaults.start);
  const [revenueEnd, setRevenueEnd] = useState(defaults.end);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [contactStats, setContactStats] = useState<ContactStats | null>(null);

  const loadRevenue = useCallback(async () => {
    if (!isAtLeast("admin")) return;
    setRevenueLoading(true);
    try {
      const startDate = new Date(revenueStart + "T00:00:00").toISOString();
      const endDate = new Date(revenueEnd + "T23:59:59").toISOString();

      const [priceRes, subsRes, allSubsRes] = await Promise.all([
        supabase.from("app_settings").select("key,value").in("key", ["weekly_price_usd", "monthly_price_usd"]),
        supabase.from("subscriptions").select("plan,status,started_at,provider").gte("started_at", startDate).lte("started_at", endDate),
        supabase.from("subscriptions").select("provider,status"),
      ]);

      const prices: Record<string, number> = {};
      (priceRes.data || []).forEach((s: { key: string; value: string }) => {
        if (s.key === "weekly_price_usd") prices.weekly = parseFloat(s.value) || 0.99;
        if (s.key === "monthly_price_usd") prices.monthly = parseFloat(s.value) || 4.99;
      });
      if (!prices.weekly) prices.weekly = 0.99;
      if (!prices.monthly) prices.monthly = 4.99;

      const subs = subsRes.data || [];
      let weeklyCount = 0, monthlyCount = 0, activeCount = 0;
      subs.forEach((s: { plan: string; status: string; provider: string }) => {
        if (s.status !== "active" || s.provider === "admin") return;
        activeCount++;
        if (s.plan === "weekly") weeklyCount++;
        else if (s.plan === "monthly") monthlyCount++;
      });

      const allSubs = allSubsRes.data || [];
      const trialCount = allSubs.filter((s: { status: string }) => s.status === "trial").length;
      const adminGranted = allSubs.filter((s: { status: string; provider: string }) => s.status === "active" && s.provider === "admin").length;

      setRevenue({
        totalRevenue: weeklyCount * prices.weekly + monthlyCount * prices.monthly,
        weeklyRevenue: weeklyCount * prices.weekly,
        monthlyRevenue: monthlyCount * prices.monthly,
        weeklyCount,
        monthlyCount,
        trialCount,
        activeCount,
        adminGranted,
      });
    } catch (err) {
      console.error("Revenue load error", err);
    } finally {
      setRevenueLoading(false);
    }
  }, [revenueStart, revenueEnd, isAtLeast]);

  useEffect(() => {
    async function fetchContactStats() {
      try {
        const { data } = await supabase
          .from("admin_activity_log")
          .select("id, details")
          .eq("entity_type", "contact_message");
        const rows = data || [];
        const total = rows.length;
        const replied = rows.filter(r => r.details?.replied === true).length;
        const open = total - replied;
        setContactStats({ total, open, replied });
      } catch {
        setContactStats({ total: 0, open: 0, replied: 0 });
      }
    }

    async function fetchDashboard() {
      setLoading(true);
      // Fire contact stats in parallel — don't wait for main data
      fetchContactStats();
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const safe = async <T,>(promise: PromiseLike<T>, fallback: T): Promise<T> => {
          try { return await promise; } catch { return fallback; }
        };
        type AnyResult = any;

        if (isSupportOnly) {
          setLoading(false);
          return;
        }

        const p = <T,>(q: PromiseLike<T>) => q as unknown as Promise<T>;

        const queries: Promise<AnyResult>[] = [
          p(supabase.from("episodes").select("*", { count: "exact", head: true })),
          p(supabase.from("episodes").select("*", { count: "exact", head: true }).eq("pub_status", "published")),
          p(supabase.from("episodes").select("*", { count: "exact", head: true }).eq("pub_status", "draft")),
          p(supabase.from("episodes").select("*", { count: "exact", head: true }).eq("pub_status", "under_review")),
          p(supabase.from("series").select("*", { count: "exact", head: true })),
          safe(p(supabase.from("content_reports").select("*", { count: "exact", head: true }).eq("status", "pending")), { count: 0, data: null, error: null } as AnyResult),
          p(supabase.from("episodes").select("title, play_count").order("play_count", { ascending: false }).limit(5)),
          safe(
            p(supabase.from("admin_activity_log").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(8)),
            { data: [], error: null } as AnyResult
          ),
        ];

        const adminQueries: Promise<AnyResult>[] = isAtLeast("admin") ? [
          p(supabase.from("profiles").select("*", { count: "exact", head: true })),
          p(supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_tier", "premium")),
          p(supabase.from("profiles").select("*", { count: "exact", head: true }).gte("updated_at", sevenDaysAgo)),
          p(supabase.from("profiles").select("joined_at").gte("joined_at", thirtyDaysAgo).order("joined_at")),
          p(supabase.from("profiles").select("country").not("country", "is", null)),
          safe(p(supabase.from("subscriptions").select("provider,status").eq("status", "active")), { data: [], error: null } as AnyResult),
        ] : [];

        const [
          { count: totalEpisodes },
          { count: publishedEpisodes },
          { count: draftEpisodes },
          { count: reviewEpisodes },
          { count: totalSeries },
          { count: pendingReports },
          { data: topContent },
          { data: recentActivityRaw },
          ...adminResults
        ] = await Promise.all([...queries, ...adminQueries]);

        let totalUsers = 0, premiumSubscribers = 0, newUsers7d = 0;
        let userGrowth: { date: string; count: number }[] = [];
        let topCountries: CountryRow[] = [];
        let paidPremium = 0, grantedPremium = 0;

        if (isAtLeast("admin") && adminResults.length >= 6) {
          totalUsers = adminResults[0]?.count ?? 0;
          premiumSubscribers = adminResults[1]?.count ?? 0;
          newUsers7d = adminResults[2]?.count ?? 0;
          const growthData = adminResults[3]?.data || [];
          const countryData = adminResults[4]?.data || [];
          const allSubs: { provider: string; status: string }[] = adminResults[5]?.data ?? [];
          paidPremium = allSubs.filter(s => s.provider !== "admin").length;
          grantedPremium = allSubs.filter(s => s.provider === "admin").length;

          const byDate: Record<string, number> = {};
          const today = new Date();
          for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            byDate[d.toISOString().slice(0, 10)] = 0;
          }
          growthData.forEach((p: { joined_at: string }) => {
            const key = p.joined_at?.slice(0, 10);
            if (key && byDate[key] !== undefined) byDate[key]++;
          });
          userGrowth = Object.entries(byDate).map(([date, count]) => ({
            date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
            count,
          }));

          const countryCounts: Record<string, number> = {};
          countryData.forEach((p: { country: string | null }) => {
            if (p.country) countryCounts[p.country] = (countryCounts[p.country] || 0) + 1;
          });
          topCountries = Object.entries(countryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([country, count]) => ({ country, count }));
        }

        setData({
          totalUsers,
          premiumSubscribers,
          paidPremium,
          grantedPremium,
          totalEpisodes: totalEpisodes ?? 0,
          publishedEpisodes: publishedEpisodes ?? 0,
          draftEpisodes: draftEpisodes ?? 0,
          reviewEpisodes: reviewEpisodes ?? 0,
          totalSeries: totalSeries ?? 0,
          newUsers7d,
          pendingReports: pendingReports ?? 0,
          recentActivity: (recentActivityRaw as LogEntry[]) ?? [],
          userGrowth,
          topContent: (topContent || []).map((e: { title: string; play_count: number }) => ({ title: e.title, plays: e.play_count ?? 0 })),
          topCountries,
        });

      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();

    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { fetchDashboard(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "episodes" }, () => { fetchDashboard(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "series" }, () => { fetchDashboard(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => { fetchDashboard(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_activity_log" }, () => { fetchDashboard(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isSupportOnly, isAtLeast]);

  useEffect(() => { loadRevenue(); }, [loadRevenue]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-4 w-64 bg-muted/50 animate-pulse rounded-lg" />
        </div>
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[100px] bg-card border border-border animate-pulse rounded-xl" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (isSupportOnly) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total Messages", value: contactStats?.total ?? 0, icon: Inbox, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Awaiting Reply", value: contactStats?.open ?? 0, icon: Clock, color: "text-primary", bg: "bg-primary/10", alert: (contactStats?.open ?? 0) > 0 },
            { label: "Replied", value: contactStats?.replied ?? 0, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
          ].map((kpi, i) => (
            <Card key={i} className={`group card-hover-lift ${kpi.alert ? "border-primary/40" : ""}`}>
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</span>
                  <div className={`h-8 w-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
                <div className="text-2xl md:text-3xl font-bold text-foreground">{kpi.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-primary/20">
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Go to Contact Messages</p>
              <p className="text-sm text-muted-foreground mt-1">View and reply to user messages from the inbox</p>
            </div>
            <Link href="/notifications/contact">
              <Button className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Open Inbox
                {(contactStats?.open ?? 0) > 0 && (
                  <Badge className="ml-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4">
                    {contactStats?.open}
                  </Badge>
                )}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    ...(isAtLeast("admin") ? [
      { title: "Total Users", value: data.totalUsers.toLocaleString(), icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
      { title: "Premium", value: data.premiumSubscribers.toLocaleString(), icon: CreditCard, color: "text-primary", bg: "bg-primary/10", sub: `${data.paidPremium} paid · ${data.grantedPremium} granted` },
    ] : []),
    { title: "Episodes", value: data.totalEpisodes.toLocaleString(), icon: Mic2, color: "text-green-400", bg: "bg-green-500/10", sub: `${data.publishedEpisodes} pub · ${data.draftEpisodes} draft` },
    { title: "Series", value: data.totalSeries.toLocaleString(), icon: BookOpen, color: "text-purple-400", bg: "bg-purple-500/10" },
    ...(isAtLeast("admin") ? [
      { title: "Active (7d)", value: `+${data.newUsers7d.toLocaleString()}`, icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    ] : []),
    { title: "Reports", value: data.pendingReports.toLocaleString(), icon: AlertTriangle, color: data.pendingReports > 0 ? "text-red-400" : "text-muted-foreground", bg: data.pendingReports > 0 ? "bg-red-500/10" : "bg-muted/50", alert: data.pendingReports > 0 },
    ...(isAtLeast("editor") && contactStats ? [
      { title: "Open Messages", value: contactStats.open.toLocaleString(), icon: MessageSquare, color: contactStats.open > 0 ? "text-primary" : "text-muted-foreground", bg: contactStats.open > 0 ? "bg-primary/10" : "bg-muted/50", alert: contactStats.open > 0 },
    ] : []),
  ];

  const colClass = kpis.length <= 3 ? "grid-cols-2 sm:grid-cols-3" :
                   kpis.length <= 4 ? "grid-cols-2 sm:grid-cols-4" :
                   kpis.length <= 5 ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" :
                   "grid-cols-2 md:grid-cols-3 xl:grid-cols-6";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Live overview of StayGuided Me</p>
      </div>

      <MigrationBanner />

      <div className={`grid gap-3 md:gap-4 ${colClass}`}>
        {kpis.map((kpi, i) => (
          <Card
            key={i}
            className={`group card-hover-lift hover:shadow-md animate-stagger-in ${kpi.alert ? "border-red-500/30" : "hover:border-border/80"}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <CardContent className="p-3.5 md:p-5">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.title}</span>
                <div className={`h-7 w-7 md:h-8 md:w-8 rounded-lg ${kpi.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <kpi.icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${kpi.color}`} />
                </div>
              </div>
              <div className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground tracking-tight">{kpi.value}</div>
              {"sub" in kpi && kpi.sub && (
                <span className="block text-[10px] md:text-[11px] text-muted-foreground mt-1 truncate">{kpi.sub}</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {isAtLeast("admin") && (
        <Card className="border-green-500/20">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-3.5 w-3.5 text-green-400" />
                </div>
                Revenue
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                  <Input type="date" value={revenueStart} onChange={e => setRevenueStart(e.target.value)} className="h-8 w-[150px] text-xs" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                  <Input type="date" value={revenueEnd} onChange={e => setRevenueEnd(e.target.value)} className="h-8 w-[150px] text-xs" />
                </div>
                <Button variant="outline" size="sm" className="h-8" onClick={loadRevenue}>
                  <Calendar className="h-3.5 w-3.5 mr-1" />Apply
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : revenue ? (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                  <div className="text-xs text-green-400 font-medium mb-1">Total Revenue</div>
                  <div className="text-xl md:text-2xl font-bold text-green-400">{formatCurrency(revenue.totalRevenue)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{revenue.activeCount} subscriptions</div>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="text-xs text-primary font-medium mb-1">Weekly Plans</div>
                  <div className="text-lg md:text-xl font-bold text-foreground">{formatCurrency(revenue.weeklyRevenue)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{revenue.weeklyCount} subscribers</div>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                  <div className="text-xs text-blue-400 font-medium mb-1">Monthly Plans</div>
                  <div className="text-lg md:text-xl font-bold text-foreground">{formatCurrency(revenue.monthlyRevenue)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{revenue.monthlyCount} subscribers</div>
                </div>
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                  <div className="text-xs text-purple-400 font-medium mb-1">Trial / Granted</div>
                  <div className="text-lg md:text-xl font-bold text-foreground">{revenue.trialCount + revenue.adminGranted}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{revenue.trialCount} trial · {revenue.adminGranted} admin granted</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-6 text-sm">No revenue data available</div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-7">
        {isAtLeast("admin") ? (
          <Card className="lg:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                User Growth
                <span className="text-xs font-normal text-muted-foreground ml-1">Last 30 days</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.userGrowth}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4A030" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4A030" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                  <Tooltip
                    cursor={{ stroke: "#D4A030", strokeWidth: 1, strokeDasharray: "4 4" }}
                    contentStyle={{ backgroundColor: "#101825", borderColor: "#253045", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#D4A030" strokeWidth={2} fill="url(#goldGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          data.topContent.length > 0 && (
            <Card className="lg:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Headphones className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Top Content
                  <span className="text-xs font-normal text-muted-foreground ml-1">By play count</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topContent.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                        <span className="text-sm truncate text-foreground">{item.title}</span>
                      </div>
                      <span className="text-xs font-semibold text-primary shrink-0">{item.plays.toLocaleString()} plays</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        )}

        <Card className={isAtLeast("admin") ? "lg:col-span-3" : "lg:col-span-3"}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-3.5 w-3.5 text-primary" />
              </div>
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {data.recentActivity.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">No activity yet</div>
              ) : (
                data.recentActivity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 text-sm p-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Star className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground text-xs leading-relaxed">
                        <span className="text-muted-foreground">{log.action}</span>
                        {log.entity_type && (
                          <Badge variant="outline" className={`ml-1.5 text-[10px] px-1.5 py-0 ${ENTITY_COLORS[log.entity_type] || "text-muted-foreground border-border"}`}>
                            {log.entity_type.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground/70 mt-0.5">{formatRelative(log.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isAtLeast("admin") && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.topCountries.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Users by Country
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topCountries.map((row, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{getFlagEmoji(row.country)}</span>
                        <span className="text-sm text-foreground">{countryName(row.country)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 rounded-full bg-primary/15 w-20 md:w-24 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{ width: `${Math.min(100, (row.count / (data.topCountries[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-foreground w-8 text-right tabular-nums">{row.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.topContent.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Headphones className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Top Content
                  <span className="text-xs font-normal text-muted-foreground ml-1">By plays</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.topContent.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                        <span className="text-sm truncate text-foreground">{item.title}</span>
                      </div>
                      <span className="text-xs font-semibold text-primary shrink-0">{item.plays.toLocaleString()} plays</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isAtLeast("content") && !isAtLeast("admin") && data.topContent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Headphones className="h-3.5 w-3.5 text-primary" />
              </div>
              Top Content
              <span className="text-xs font-normal text-muted-foreground ml-1">By plays</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topContent.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <span className="text-sm truncate text-foreground">{item.title}</span>
                  </div>
                  <span className="text-xs font-semibold text-primary shrink-0">{item.plays.toLocaleString()} plays</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
