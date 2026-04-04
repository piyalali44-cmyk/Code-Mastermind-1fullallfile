import { useEffect, useState, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Users, Headphones, CreditCard, RefreshCw, DollarSign, Calendar, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GOLD = "#D4A030";
const COLORS = ["#3B82F6", "#D4A030", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"];

function countryToFlag(code: string) {
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
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
  dailyRevenue: { date: string; amount: number }[];
}

export default function Analytics() {
  const [period, setPeriod] = useState("30");
  const [userGrowth, setUserGrowth] = useState<{ date: string; users: number; premium: number }[]>([]);
  const [contentStats, setContentStats] = useState<{ name: string; value: number }[]>([]);
  const [xpStats, setXpStats] = useState<{ date: string; xp: number }[]>([]);
  const [tierBreakdown, setTierBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);
  const [countryStats, setCountryStats] = useState<{ flag: string; code: string; count: number }[]>([]);
  const [kpis, setKpis] = useState({ totalUsers: 0, premiumUsers: 0, totalEpisodes: 0, totalSeries: 0 });
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

      // Revenue amounts from date-filtered paid subs only
      const subs = subsRes.data || [];
      let weeklyCount = 0, monthlyCount = 0, activeCount = 0;
      const dailyMap: Record<string, number> = {};

      const start = new Date(revenueStart);
      const end = new Date(revenueEnd);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dailyMap[d.toISOString().slice(0, 10)] = 0;
      }

      subs.forEach((s: { plan: string; status: string; started_at: string; provider: string }) => {
        if (s.status !== "active" || s.provider === "admin") return;
        activeCount++;
        const price = s.plan === "weekly" ? prices.weekly : s.plan === "monthly" ? prices.monthly : 0;
        if (s.plan === "weekly") weeklyCount++;
        else if (s.plan === "monthly") monthlyCount++;
        const day = s.started_at?.slice(0, 10);
        if (day && dailyMap[day] !== undefined) dailyMap[day] += price;
      });

      // Trial / granted counts from ALL subscriptions (no date filter)
      const allSubs = allSubsRes.data || [];
      const trialCount = allSubs.filter((s: { status: string }) => s.status === "trial").length;
      const adminGranted = allSubs.filter((s: { status: string; provider: string }) => s.status === "active" && s.provider === "admin").length;

      const dailyRevenue = Object.entries(dailyMap).map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        amount: Math.round(amount * 100) / 100,
      }));

      setRevenue({
        totalRevenue: weeklyCount * prices.weekly + monthlyCount * prices.monthly,
        weeklyRevenue: weeklyCount * prices.weekly,
        monthlyRevenue: monthlyCount * prices.monthly,
        weeklyCount,
        monthlyCount,
        trialCount,
        activeCount,
        adminGranted,
        dailyRevenue,
      });
    } catch (err) {
      console.error("Revenue load error", err);
    } finally {
      setRevenueLoading(false);
    }
  }, [revenueStart, revenueEnd]);

  async function load() {
    setLoading(true);
    const days = parseInt(period);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers }, { count: premiumUsers }, { count: totalEpisodes }, { count: totalSeries },
      { data: profiles }, { data: premiumProfiles }, { data: xpLog }, { data: episodes },
      { count: freeCount }, { count: trialCount }, { data: countryRows },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_tier", "premium"),
      supabase.from("episodes").select("*", { count: "exact", head: true }),
      supabase.from("series").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("updated_at").gte("updated_at", from),
      supabase.from("profiles").select("updated_at").eq("subscription_tier", "premium").gte("updated_at", from),
      supabase.from("daily_xp_log").select("xp_amount,earned_at").gte("earned_at", from),
      supabase.from("episodes").select("title,play_count").order("play_count", { ascending: false }).limit(8),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("subscription_tier", "free"),
      supabase.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "trial"),
      supabase.from("profiles").select("country").not("country", "is", null),
    ]);

    setKpis({ totalUsers: totalUsers ?? 0, premiumUsers: premiumUsers ?? 0, totalEpisodes: totalEpisodes ?? 0, totalSeries: totalSeries ?? 0 });

    const byDate: Record<string, { users: number; premium: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      byDate[d] = { users: 0, premium: 0 };
    }
    (profiles || []).forEach((p: { updated_at: string }) => { const k = p.updated_at?.slice(0, 10); if (k && byDate[k]) byDate[k].users++; });
    (premiumProfiles || []).forEach((p: { updated_at: string }) => { const k = p.updated_at?.slice(0, 10); if (k && byDate[k]) byDate[k].premium++; });
    setUserGrowth(Object.entries(byDate).map(([date, v]) => ({
      date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), ...v,
    })));

    const xpByDate: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      xpByDate[d] = 0;
    }
    (xpLog || []).forEach((x: { xp_amount: number; earned_at: string }) => {
      const k = x.earned_at?.slice(0, 10);
      if (k && xpByDate[k] !== undefined) xpByDate[k] += x.xp_amount;
    });
    setXpStats(Object.entries(xpByDate).map(([date, xp]) => ({
      date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), xp,
    })));

    setContentStats((episodes || []).filter((e: { play_count: number }) => e.play_count > 0).map((e: { title: string; play_count: number }) => ({ name: e.title, value: e.play_count ?? 0 })));

    const free = (freeCount ?? ((totalUsers ?? 0) - (premiumUsers ?? 0)));
    const premium = premiumUsers ?? 0;
    const trial = trialCount ?? 0;
    setTierBreakdown([
      { name: "Free", value: free, color: COLORS[0] },
      { name: "Premium", value: premium, color: COLORS[1] },
      ...(trial > 0 ? [{ name: "Trial", value: trial, color: COLORS[2] }] : []),
    ].filter(t => t.value > 0));

    const countryMap: Record<string, number> = {};
    (countryRows || []).forEach((r: { country: string | null }) => {
      if (r.country) countryMap[r.country] = (countryMap[r.country] || 0) + 1;
    });
    const sortedCountries = Object.entries(countryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([code, count]) => ({ flag: countryToFlag(code), code, count }));
    setCountryStats(sortedCountries);

    setLoading(false);
  }

  useEffect(() => { load(); }, [period]);
  useEffect(() => { loadRevenue(); }, [loadRevenue]);

  const { theme } = useTheme();
  const tooltipStyle = theme === "dark"
    ? { backgroundColor: "#101825", borderColor: "#253045", borderRadius: "8px", fontSize: "12px" }
    : { backgroundColor: "#ffffff", borderColor: "#E5E2DA", borderRadius: "8px", fontSize: "12px", color: "#1A1A1A" };

  const totalTierUsers = tierBreakdown.reduce((sum, t) => sum + t.value, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Analytics</h1>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { load(); loadRevenue(); }}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total Users", value: kpis.totalUsers.toLocaleString(), icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Premium", value: kpis.premiumUsers.toLocaleString(), icon: CreditCard, color: "text-primary", bg: "bg-primary/10" },
          { label: "Episodes", value: kpis.totalEpisodes.toLocaleString(), icon: Headphones, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Series", value: kpis.totalSeries.toLocaleString(), icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="hover:shadow-md transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </div>
              {loading ? <div className="h-7 bg-muted animate-pulse rounded w-20" /> : <div className="text-xl md:text-2xl font-bold">{value}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 text-green-400" />
              </div>
              Revenue Overview
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
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : revenue ? (
            <div className="space-y-5">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                  <div className="text-xs text-green-400 font-medium mb-1">Total Revenue</div>
                  <div className="text-xl md:text-2xl font-bold text-green-400">{formatCurrency(revenue.totalRevenue)}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{revenue.activeCount} paid subscriptions</div>
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

              {revenue.dailyRevenue.length > 0 && (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenue.dailyRevenue}>
                      <XAxis dataKey="date" stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                      <Bar dataKey="amount" fill="#10B981" radius={[3, 3, 0, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8 text-sm">No revenue data available</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-sm">User Registrations</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowth}>
                <defs>
                  <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} /><stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="users" stroke={GOLD} strokeWidth={2} fill="url(#usersGrad)" name="New Users" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">User Tier Split</CardTitle></CardHeader>
          <CardContent className="h-[220px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="h-32 w-32 bg-muted animate-pulse rounded-full" />
              </div>
            ) : tierBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No user data</div>
            ) : (
              <div className="flex items-center h-full gap-4">
                <div className="flex-1 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={tierBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        nameKey="name"
                        strokeWidth={2}
                        stroke="hsl(var(--background))"
                      >
                        {tierBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} users (${totalTierUsers ? ((value / totalTierUsers) * 100).toFixed(1) : 0}%)`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 min-w-[80px]">
                  {tierBreakdown.map((tier) => (
                    <div key={tier.name} className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tier.color }} />
                      <div>
                        <div className="text-xs font-medium text-foreground">{tier.name}</div>
                        <div className="text-[11px] text-muted-foreground">{tier.value} ({totalTierUsers ? ((tier.value / totalTierUsers) * 100).toFixed(0) : 0}%)</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">XP Earned Per Day</CardTitle></CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={xpStats}>
                <XAxis dataKey="date" stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="xp" fill={GOLD} radius={[3, 3, 0, 0]} name="XP Earned" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top Episodes by Plays</CardTitle></CardHeader>
          <CardContent className="h-[200px]">
            {contentStats.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No play data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contentStats} layout="vertical">
                  <XAxis type="number" stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#4A5568" fontSize={10} tickLine={false} axisLine={false} width={120} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill={GOLD} radius={[0, 3, 3, 0]} name="Plays" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Globe className="h-3.5 w-3.5 text-blue-400" />
            </div>
            Users by Country
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : countryStats.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">No country data yet — users need to set their country in settings</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {countryStats.map(({ flag, code, count }, i) => {
                  const maxCount = countryStats[0].count;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={code} className="flex flex-col gap-1.5 bg-muted/40 rounded-xl p-3 border border-border/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{flag}</span>
                        <span className="text-xs font-mono font-bold text-foreground">{count.toLocaleString()}</span>
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">{code}</div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground text-right">
                Showing top {countryStats.length} countries by user count
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
