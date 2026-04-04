import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";

interface AllTimeRow {
  id: string; display_name: string; avatar_url: string | null;
  country: string | null; total_xp: number; level: number;
  current_streak: number; rank: number;
}
interface WeeklyRow {
  id: string; display_name: string; avatar_url: string | null;
  country: string | null; weekly_xp: number; rank: number;
}
interface MonthlyRow {
  id: string; display_name: string; avatar_url: string | null;
  country: string | null; monthly_xp: number; rank: number;
}

export default function Leaderboard() {
  const [allTime, setAllTime]   = useState<AllTimeRow[]>([]);
  const [weekly, setWeekly]     = useState<WeeklyRow[]>([]);
  const [monthly, setMonthly]   = useState<MonthlyRow[]>([]);
  const [loading, setLoading]   = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [{ data: a, error: ea }, { data: w, error: ew }, { data: m, error: em }] = await Promise.all([
        supabase.from("leaderboard").select("*").order("rank").limit(100),
        supabase.from("leaderboard_weekly").select("*").order("rank").limit(100),
        supabase.from("leaderboard_monthly").select("*").order("rank").limit(100),
      ]);
      if (ea) throw ea;
      if (ew) throw ew;
      if (em) throw em;
      setAllTime((a ?? []).map((r: any) => ({ ...r, rank: Number(r.rank) })));
      setWeekly((w ?? []).map((r: any) => ({ ...r, rank: Number(r.rank) })));
      setMonthly((m ?? []).map((r: any) => ({ ...r, rank: Number(r.rank) })));
    } catch (err: any) {
      toast.error("Failed to load leaderboard: " + (err?.message || "unknown error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const medal = (rank: number) => {
    if (rank === 1) return <span className="text-lg">🥇</span>;
    if (rank === 2) return <span className="text-lg">🥈</span>;
    if (rank === 3) return <span className="text-lg">🥉</span>;
    return <span className="text-sm font-mono text-muted-foreground">#{rank}</span>;
  };

  const UserCell = ({ name, avatar }: { name: string; avatar: string | null }) => (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatar || undefined} />
        <AvatarFallback className="text-xs bg-primary/10 text-primary">{(name || "?")[0].toUpperCase()}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-sm">{name || "Anonymous"}</span>
    </div>
  );

  const SkeletonRows = ({ cols }: { cols: number }) => (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );

  const EmptyRow = ({ cols }: { cols: number }) => (
    <TableRow>
      <TableCell colSpan={cols} className="text-center py-10 text-muted-foreground">
        No data available
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" /> Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${allTime.length} users ranked`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Top 3 Podium */}
      {!loading && allTime.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {allTime.slice(0, 3).map((r, i) => (
            <Card key={r.id} className={i === 0 ? "border-primary/40 bg-primary/5" : ""}>
              <CardContent className="pt-4 text-center">
                <div className="text-3xl mb-2">{["🥇", "🥈", "🥉"][i]}</div>
                <Avatar className="h-12 w-12 mx-auto mb-2">
                  <AvatarImage src={r.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {(r.display_name || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate">{r.display_name || "Anonymous"}</p>
                <p className="text-primary font-bold">{r.total_xp.toLocaleString()} XP</p>
                <p className="text-xs text-muted-foreground mt-0.5">Level {r.level} · 🔥 {r.current_streak}d</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="alltime">
        <TabsList>
          <TabsTrigger value="alltime">All-Time</TabsTrigger>
          <TabsTrigger value="weekly">This Week</TabsTrigger>
          <TabsTrigger value="monthly">This Month</TabsTrigger>
        </TabsList>

        {/* All-Time */}
        <TabsContent value="alltime">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Total XP</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Streak</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <SkeletonRows cols={6} />
                  : allTime.length === 0 ? <EmptyRow cols={6} />
                  : allTime.map(row => (
                  <TableRow key={row.id} className={row.rank <= 3 ? "bg-primary/5" : ""}>
                    <TableCell className="text-center">{medal(row.rank)}</TableCell>
                    <TableCell><UserCell name={row.display_name} avatar={row.avatar_url} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.country || "—"}</TableCell>
                    <TableCell className="text-sm font-semibold text-primary">{(row.total_xp || 0).toLocaleString()} XP</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">Lv {row.level}</Badge></TableCell>
                    <TableCell className="text-sm">🔥 {row.current_streak}d</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Weekly */}
        <TabsContent value="weekly">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>XP This Week</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <SkeletonRows cols={4} />
                  : weekly.length === 0 ? <EmptyRow cols={4} />
                  : weekly.map(row => (
                  <TableRow key={row.id} className={row.rank <= 3 ? "bg-primary/5" : ""}>
                    <TableCell className="text-center">{medal(row.rank)}</TableCell>
                    <TableCell><UserCell name={row.display_name} avatar={row.avatar_url} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.country || "—"}</TableCell>
                    <TableCell className="text-sm font-semibold text-primary">{(row.weekly_xp || 0).toLocaleString()} XP</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Monthly */}
        <TabsContent value="monthly">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Rank</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>XP This Month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <SkeletonRows cols={4} />
                  : monthly.length === 0 ? <EmptyRow cols={4} />
                  : monthly.map(row => (
                  <TableRow key={row.id} className={row.rank <= 3 ? "bg-primary/5" : ""}>
                    <TableCell className="text-center">{medal(row.rank)}</TableCell>
                    <TableCell><UserCell name={row.display_name} avatar={row.avatar_url} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.country || "—"}</TableCell>
                    <TableCell className="text-sm font-semibold text-primary">{(row.monthly_xp || 0).toLocaleString()} XP</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
