import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RefreshCw, Headphones, Search, TrendingUp, BarChart2, Calendar, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface SurahStats {
  surah_id: string;
  surah_name: string;
  surah_number: number;
  play_count: number;
  unique_listeners: number;
  last_played: string | null;
}

interface SeriesStats {
  series_id: string;
  series_name: string;
  play_count: number;
  unique_listeners: number;
  last_played: string | null;
}

interface EpisodeStats {
  content_id: string;
  title: string;
  series_name: string;
  series_id: string | null;
  play_count: number;
  unique_listeners: number;
  last_played: string | null;
}

export default function PlayCounts() {
  const [seriesStats, setSeriesStats]   = useState<SeriesStats[]>([]);
  const [episodeStats, setEpisodeStats] = useState<EpisodeStats[]>([]);
  const [surahStats, setSurahStats]     = useState<SurahStats[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [seriesFilter, setSeriesFilter] = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [totalPlays, setTotalPlays]     = useState(0);
  const [totalListeners, setTotalListeners] = useState(0);
  const [totalSurahPlays, setTotalSurahPlays] = useState(0);

  async function load() {
    setLoading(true);
    try {
      // Get accurate total count (no limit)
      let countQuery = supabase
        .from("listening_history")
        .select("id", { count: "exact", head: true })
        .eq("content_type", "episode");
      if (dateFrom) countQuery = countQuery.gte("listened_at", dateFrom + "T00:00:00Z");
      if (dateTo)   countQuery = countQuery.lte("listened_at", dateTo + "T23:59:59Z");
      const { count: exactCount } = await countQuery;

      let query = supabase
        .from("listening_history")
        .select("content_type, content_id, title, series_name, series_id, user_id, listened_at")
        .eq("content_type", "episode")
        .order("listened_at", { ascending: false })
        .limit(50000);

      if (dateFrom) query = query.gte("listened_at", dateFrom + "T00:00:00Z");
      if (dateTo)   query = query.lte("listened_at", dateTo + "T23:59:59Z");

      const { data: epRows, error } = await query;

      if (error) throw error;

      const rows = epRows ?? [];
      setTotalPlays(exactCount ?? rows.length);
      setTotalListeners(new Set(rows.map((r: any) => r.user_id)).size);

      // Aggregate per episode
      const epMap = new Map<string, EpisodeStats>();
      const sMap  = new Map<string, SeriesStats>();

      for (const r of rows as any[]) {
        // Episode aggregation
        const epKey = r.content_id;
        if (!epMap.has(epKey)) {
          epMap.set(epKey, {
            content_id:       r.content_id,
            title:            r.title || "Untitled",
            series_name:      r.series_name || "—",
            series_id:        r.series_id ?? null,
            play_count:       0,
            unique_listeners: 0,
            last_played:      null,
          });
        }
        const ep = epMap.get(epKey)!;
        ep.play_count++;
        if (!ep.last_played || r.listened_at > ep.last_played) ep.last_played = r.listened_at;

        // Series aggregation
        const sKey = r.series_id || r.series_name || "unknown";
        if (!sMap.has(sKey)) {
          sMap.set(sKey, {
            series_id:        r.series_id || sKey,
            series_name:      r.series_name || "Unknown Series",
            play_count:       0,
            unique_listeners: 0,
            last_played:      null,
          });
        }
        const s = sMap.get(sKey)!;
        s.play_count++;
        if (!s.last_played || r.listened_at > s.last_played) s.last_played = r.listened_at;
      }

      // Unique listener counts require a second pass per item
      const epListeners = new Map<string, Set<string>>();
      const sListeners  = new Map<string, Set<string>>();
      for (const r of rows as any[]) {
        const ek = r.content_id;
        if (!epListeners.has(ek)) epListeners.set(ek, new Set());
        epListeners.get(ek)!.add(r.user_id);

        const sk = r.series_id || r.series_name || "unknown";
        if (!sListeners.has(sk)) sListeners.set(sk, new Set());
        sListeners.get(sk)!.add(r.user_id);
      }
      epListeners.forEach((set, k) => { const e = epMap.get(k); if (e) e.unique_listeners = set.size; });
      sListeners.forEach((set, k) => { const s = sMap.get(k); if (s) s.unique_listeners = set.size; });

      setEpisodeStats([...epMap.values()].sort((a, b) => b.play_count - a.play_count));
      setSeriesStats([...sMap.values()].sort((a, b) => b.play_count - a.play_count));

      // ── Surah / Quran stats ────────────────────────────────────────────────
      // Get accurate surah count (no limit)
      let surahCountQuery = supabase
        .from("listening_history")
        .select("id", { count: "exact", head: true })
        .eq("content_type", "surah");
      if (dateFrom) surahCountQuery = surahCountQuery.gte("listened_at", dateFrom + "T00:00:00Z");
      if (dateTo)   surahCountQuery = surahCountQuery.lte("listened_at", dateTo + "T23:59:59Z");
      const { count: exactSurahCount } = await surahCountQuery;

      let surahQuery = supabase
        .from("listening_history")
        .select("content_id, title, user_id, listened_at")
        .eq("content_type", "surah")
        .order("listened_at", { ascending: false })
        .limit(50000);

      if (dateFrom) surahQuery = surahQuery.gte("listened_at", dateFrom + "T00:00:00Z");
      if (dateTo)   surahQuery = surahQuery.lte("listened_at", dateTo   + "T23:59:59Z");

      const { data: surahRows } = await surahQuery;
      const sRows = (surahRows ?? []) as any[];

      setTotalSurahPlays(exactSurahCount ?? sRows.length);

      const surahMap = new Map<string, SurahStats>();
      const surahListeners = new Map<string, Set<string>>();

      for (const r of sRows) {
        const key = r.content_id;
        if (!surahMap.has(key)) {
          const num = parseInt(r.content_id ?? "0", 10) || 0;
          surahMap.set(key, {
            surah_id:         key,
            surah_name:       r.title || `Surah ${key}`,
            surah_number:     num,
            play_count:       0,
            unique_listeners: 0,
            last_played:      null,
          });
          surahListeners.set(key, new Set());
        }
        surahMap.get(key)!.play_count++;
        surahListeners.get(key)!.add(r.user_id);
        const s = surahMap.get(key)!;
        if (!s.last_played || r.listened_at > s.last_played) s.last_played = r.listened_at;
      }

      surahListeners.forEach((set, k) => {
        const s = surahMap.get(k);
        if (s) s.unique_listeners = set.size;
      });

      setSurahStats([...surahMap.values()].sort((a, b) => b.play_count - a.play_count));
    } catch (err: any) {
      toast.error("Failed to load play stats: " + (err?.message || "unknown error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";

  const filteredEpisodes = episodeStats.filter(e => {
    const q = search.toLowerCase();
    const sf = seriesFilter.toLowerCase();
    return (
      (!q || e.title.toLowerCase().includes(q) || e.series_name.toLowerCase().includes(q)) &&
      (!sf || e.series_name.toLowerCase().includes(sf))
    );
  });
  const filteredSeries = seriesStats.filter(s => {
    const q = search.toLowerCase();
    return !q || s.series_name.toLowerCase().includes(q);
  });
  const filteredSurahs = surahStats.filter(s => {
    const q = search.toLowerCase();
    return !q || s.surah_name.toLowerCase().includes(q) || String(s.surah_number).includes(q);
  });

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Headphones className="h-6 w-6 text-primary" /> Play Statistics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading…" : `${totalPlays.toLocaleString()} total plays · ${totalListeners.toLocaleString()} unique listeners`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><TrendingUp className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Episode Plays</p>
                <p className="text-xl font-bold">{loading ? "—" : totalPlays.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><BookOpen className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Surah Plays</p>
                <p className="text-xl font-bold">{loading ? "—" : totalSurahPlays.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Headphones className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Unique Listeners</p>
                <p className="text-xl font-bold">{loading ? "—" : totalListeners.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><BarChart2 className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Surahs Listened</p>
                <p className="text-xl font-bold">{loading ? "—" : surahStats.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Episodes or series…"
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Series</Label>
              <Input
                placeholder="Filter by series…"
                className="h-8 text-sm"
                value={seriesFilter}
                onChange={(e) => setSeriesFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From date</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To date</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  className="h-8 text-sm flex-1"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
                {(dateFrom || dateTo || seriesFilter || search) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => { setDateFrom(""); setDateTo(""); setSeriesFilter(""); setSearch(""); }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
          {(dateFrom || dateTo) && (
            <Button size="sm" className="mt-3" onClick={load}>
              Apply Date Filter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="episodes">
        <TabsList>
          <TabsTrigger value="episodes">By Episode</TabsTrigger>
          <TabsTrigger value="series">By Series</TabsTrigger>
          <TabsTrigger value="quran" className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Quran / Surah
          </TabsTrigger>
        </TabsList>

        {/* Episodes */}
        <TabsContent value="episodes">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Episode</TableHead>
                  <TableHead>Series</TableHead>
                  <TableHead>Plays</TableHead>
                  <TableHead>Unique Listeners</TableHead>
                  <TableHead>Last Played</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <SkeletonRows cols={6} /> :
                  filteredEpisodes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No episode play data yet</TableCell></TableRow>
                  ) : filteredEpisodes.map((ep, i) => (
                    <TableRow key={ep.content_id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium max-w-[220px] truncate">{ep.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{ep.series_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-semibold">
                          {ep.play_count.toLocaleString()} ▶
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{ep.unique_listeners.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmt(ep.last_played)}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Series */}
        <TabsContent value="series">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Series</TableHead>
                  <TableHead>Total Plays</TableHead>
                  <TableHead>Unique Listeners</TableHead>
                  <TableHead>Last Played</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <SkeletonRows cols={5} /> :
                  filteredSeries.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No series play data yet</TableCell></TableRow>
                  ) : filteredSeries.map((s, i) => (
                    <TableRow key={s.series_id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                      <TableCell className="font-semibold">{s.series_name}</TableCell>
                      <TableCell>
                        <Badge className="font-semibold">
                          {s.play_count.toLocaleString()} ▶
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{s.unique_listeners.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmt(s.last_played)}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Surah / Quran */}
        <TabsContent value="quran">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="w-16">No.</TableHead>
                  <TableHead>Surah</TableHead>
                  <TableHead>Total Plays</TableHead>
                  <TableHead>Unique Listeners</TableHead>
                  <TableHead>Last Played</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <SkeletonRows cols={6} /> :
                  filteredSurahs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-14 text-muted-foreground">
                        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        No Quran play data yet
                      </TableCell>
                    </TableRow>
                  ) : filteredSurahs.map((s, i) => (
                    <TableRow key={s.surah_id}>
                      <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {s.surah_number || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">{s.surah_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-semibold">
                          {s.play_count.toLocaleString()} ▶
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{s.unique_listeners.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmt(s.last_played)}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
