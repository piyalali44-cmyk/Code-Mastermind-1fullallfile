import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { formatRelative } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Users, CreditCard, Headphones, Mic2, AlertTriangle, TrendingUp, BookOpen, Star, Globe, Activity, DollarSign, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const defaults = getDefaultDates();
  const [revenueStart, setRevenueStart] = useState(defaults.start);
  const [revenueEnd, setRevenueEnd] = useState(defaults.end);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  const loadRevenue = useCallback(async () => {
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

      if (priceRes.error) console.error("Price fetch error", priceRes.error);
      if (subsRes.error) console.error("Subscriptions fetch error", subsRes.error);

      // Revenue amounts from date-filtered subs only
      const subs = subsRes.data || [];
      let weeklyCount = 0, monthlyCount = 0, activeCount = 0;
      subs.forEach((s: { plan: string; status: string; started_at: string; provider: string }) => {
        if (s.status !== "active" || s.provider === "admin") return;
        activeCount++;
        if (s.plan === "weekly") weeklyCount++;
        else if (s.plan === "monthly") monthlyCount++;
      });

      // Trial / granted counts from ALL subscriptions (no date filter — avoids timezone mismatches)
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
  }, [revenueStart, revenueEnd]);

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true);
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const safe = async <T,>(promise: PromiseLike<T>, fallback: T): Promise<T> => {
          try { return await promise; } catch { return fallback; }
        };
        type AnyResult = any;

        const [
          { count: totalUsers },
          { count: premiumSubscribers },
          { count: totalEpisodes },
          { count: publishedEpisodes },
          { count: draftEpisodes },
          { count: reviewEpisodes },
          { count: totalSeries },
          { count: pendingReports },
          { count: newUsers7d },
          { data: recentActivityRaw },
          { data: growthData },
          { data: topContent },
          { data: countryData },
          { data: allSubs },
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_tier", "premium"),
          supabase.from("episodes").select("*", { count: "exact", head: true }),
          supabase.from("episodes").select("*", { count: "exact", head: true }).eq("pub_status", "published"),
          supabase.from("episodes").select("*", { count: "exact", head: true }).eq("pub_status", "draft"),
          supabase.from("episodes").select("*", { count: "exact", head: true }).eq("pub_status", "under_review"),
          supabase.from("series").select("*", { count: "exact", head: true }),
          safe(supabase.from("content_reports").select("*", { count: "exact", head: true }).eq("status", "pending") as PromiseLike<AnyResult>, { count: 0, data: null, error: null } as AnyResult),
          supabase.from("profiles").select("*", { count: "exact", head: true }).gte("updated_at", sevenDaysAgo),
          safe(
            supabase.from("admin_activity_log").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(8) as PromiseLike<AnyResult>,
            { data: [], error: null } as AnyResult
          ),
          supabase.from("profiles").select("joined_at").gte("joined_at", thirtyDaysAgo).order("joined_at"),
          supabase.from("episodes").select("title, play_count").order("play_count", { ascending: false }).limit(5),
          supabase.from("profiles").select("country").not("country", "is", null),
          safe(supabase.from("subscriptions").select("provider,status").eq("status", "active") as PromiseLike<AnyResult>, { data: [], error: null } as AnyResult),
        ]);

        const subsData: { provider: string; status: string }[] = (allSubs as any) ?? [];
        const paidPremium = subsData.filter(s => s.provider !== "admin").length;
        const grantedPremium = subsData.filter(s => s.provider === "admin").length;

        const byDate: Record<string, number> = {};
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          byDate[d.toISOString().slice(0, 10)] = 0;
        }
        (growthData || []).forEach((p: { joined_at: string }) => {
          const key = p.joined_at?.slice(0, 10);
          if (key && byDate[key] !== undefined) byDate[key]++;
        });
        const userGrowth = Object.entries(byDate).map(([date, count]) => ({
          date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
          count,
        }));

        const countryCounts: Record<string, number> = {};
        (countryData || []).forEach((p: { country: string | null }) => {
          if (p.country) countryCounts[p.country] = (countryCounts[p.country] || 0) + 1;
        });
        const topCountries: CountryRow[] = Object.entries(countryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([country, count]) => ({ country, count }));

        setData({
          totalUsers: totalUsers ?? 0,
          premiumSubscribers: premiumSubscribers ?? 0,
          paidPremium,
          grantedPremium,
          totalEpisodes: totalEpisodes ?? 0,
          publishedEpisodes: publishedEpisodes ?? 0,
          draftEpisodes: draftEpisodes ?? 0,
          reviewEpisodes: reviewEpisodes ?? 0,
          totalSeries: totalSeries ?? 0,
          newUsers7d: newUsers7d ?? 0,
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
  }, []);

  useEffect(() => { loadRevenue(); }, [loadRevenue]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-4 w-64 bg-muted/50 animate-pulse rounded-lg" />
        </div>
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[100px] md:h-[110px] bg-card border border-border animate-pulse rounded-xl" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-7">
          <div className="lg:col-span-4 h-[280px] md:h-[360px] bg-card border border-border animate-pulse rounded-xl" />
          <div className="lg:col-span-3 h-[280px] md:h-[360px] bg-card border border-border animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  const kpis = [
    { title: "Total Users", value: data.totalUsers.toLocaleString(), icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { title: "Premium", value: data.premiumSubscribers.toLocaleString(), icon: CreditCard, color: "text-primary", bg: "bg-primary/10", sub: `${data.paidPremium} paid · ${data.grantedPremium} granted` },
    { title: "Episodes", value: data.totalEpisodes.toLocaleString(), icon: Mic2, color: "text-green-400", bg: "bg-green-500/10", sub: `${data.publishedEpisodes} pub · ${data.draftEpisodes} draft` },
    { title: "Series", value: data.totalSeries.toLocaleString(), icon: BookOpen, color: "text-purple-400", bg: "bg-purple-500/10" },
    { title: "Active (7d)", value: `+${data.newUsers7d.toLocaleString()}`, icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { title: "Reports", value: data.pendingReports.toLocaleString(), icon: AlertTriangle, color: data.pendingReports > 0 ? "text-red-400" : "text-muted-foreground", bg: data.pendingReports > 0 ? "bg-red-500/10" : "bg-muted/50", alert: data.pendingReports > 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Live overview of StayGuided Me</p>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
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

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              User Activity
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

        <Card className="lg:col-span-3">
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
                Top Episodes
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topContent} layout="vertical">
                  <XAxis type="number" stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="title" stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} width={140} />
                  <Tooltip contentStyle={{ backgroundColor: "#101825", borderColor: "#253045", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="plays" fill="#D4A030" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function getFlagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return "\u{1F30D}";
  const code = countryCode.toUpperCase();
  const base = 0x1F1E6;
  const A = 65;
  return String.fromCodePoint(base + code.charCodeAt(0) - A) +
    String.fromCodePoint(base + code.charCodeAt(1) - A);
}
