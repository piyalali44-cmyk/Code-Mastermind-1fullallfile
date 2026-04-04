import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Search, Mic2, Volume2, ChevronLeft, ChevronRight } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Episode, Series } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  under_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  approved: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  published: "bg-green-500/10 text-green-400 border-green-500/30",
  unpublished: "bg-red-500/10 text-red-400 border-red-500/30",
};

const PAGE_SIZES = [20, 50, 100];

const blank = (): Partial<Episode> => ({
  title: "", description: "", short_summary: "", audio_url: "", cover_override_url: "", duration: 0,
  episode_number: 1, language: "en", is_premium: false, pub_status: "published", series_id: "",
});

export default function Episodes() {
  const [items, setItems] = useState<Episode[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [seriesList, setSeriesList] = useState<Pick<Series, "id" | "title">[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSeries, setFilterSeries] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState<Partial<Episode>>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Episode | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    let query = supabase.from("episodes").select("*, series:series(id,title)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filterSeries !== "all") query = query.eq("series_id", filterSeries);
    if (filterStatus !== "all") query = query.eq("pub_status", filterStatus);
    if (search) query = query.ilike("title", `%${search}%`);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const [episodesResult, { data: ser }] = await Promise.all([
      query,
      supabase.from("series").select("id,title").order("title"),
    ]);

    setItems(episodesResult.data ?? []);
    setTotalCount(episodesResult.count ?? 0);
    setSeriesList(ser ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [page, pageSize, filterSeries, filterStatus, search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function openNew() { setForm(blank()); setEditing(null); setSheetOpen(true); }
  function openEdit(ep: Episode) { setForm({ ...ep }); setEditing(ep.id); setSheetOpen(true); }

  async function save() {
    if (!form.title?.trim()) return void toast.error("Title is required");
    if (!form.series_id) return void toast.error("Series is required");
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description, short_summary: form.short_summary,
        audio_url: form.audio_url, cover_override_url: form.cover_override_url || null,
        duration: form.duration || 0,
        episode_number: form.episode_number || 1, language: form.language || "en",
        is_premium: form.is_premium, pub_status: form.pub_status, series_id: form.series_id,
        key_lessons: form.key_lessons, transcript: form.transcript,
        updated_at: new Date().toISOString(),
      };
      let id = editing;
      if (editing) {
        const { error } = await supabase.from("episodes").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("episodes").insert(payload).select().single();
        if (error) throw error;
        id = data.id;
      }
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: editing ? "Updated episode" : "Created episode",
        entity_type: "episode", entity_id: id, details: { title: form.title },
      }).then(() => {}, () => {});
      toast.success(editing ? "Episode updated" : "Episode created");
      setSheetOpen(false);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteEpisode(ep: Episode) {
    try {
      const { error } = await supabase.from("episodes").delete().eq("id", ep.id);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: "Deleted episode", entity_type: "episode",
        entity_id: ep.id, details: { title: ep.title },
      }).then(() => {}, () => {});
      toast.success("Episode deleted");
      setDeleteTarget(null);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
  }

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(1); };
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Episodes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{totalCount} episodes total</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Episode</Button>
          </SheetTrigger>
          <SheetContent className="w-[520px] overflow-y-auto">
            <SheetHeader><SheetTitle>{editing ? "Edit Episode" : "New Episode"}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">

              <ImageUpload
                value={form.cover_override_url || ""}
                onChange={(url) => setForm(f => ({ ...f, cover_override_url: url }))}
                label="Cover Image"
                folder="episodes"
                shape="square"
                placeholder="Upload cover or paste URL"
              />

              <div className="space-y-1">
                <Label>Series *</Label>
                <Select value={form.series_id || ""} onValueChange={v => setForm(f => ({ ...f, series_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select series" /></SelectTrigger>
                  <SelectContent>{seriesList.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Episode Number</Label>
                  <Input type="number" min={1} value={form.episode_number || 1} onChange={e => setForm(f => ({ ...f, episode_number: parseInt(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-1">
                  <Label>Duration (seconds)</Label>
                  <Input type="number" min={0} value={form.duration || 0} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Title *</Label>
                <Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Episode title" />
              </div>
              <div className="space-y-1">
                <Label>Short Summary</Label>
                <Input value={form.short_summary || ""} onChange={e => setForm(f => ({ ...f, short_summary: e.target.value }))} placeholder="Brief description" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={3} value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Full episode description" />
              </div>

              <div className="space-y-2">
                <Label>Audio File URL</Label>
                <div className="flex gap-2">
                  <Volume2 className="h-4 w-4 mt-3 text-muted-foreground shrink-0" />
                  <Input
                    value={form.audio_url || ""}
                    onChange={e => setForm(f => ({ ...f, audio_url: e.target.value }))}
                    placeholder="https://example.com/audio.mp3"
                  />
                </div>
                {form.audio_url && (
                  <audio controls className="w-full h-10 rounded" src={form.audio_url} key={form.audio_url}>
                    Your browser does not support audio.
                  </audio>
                )}
              </div>

              <div className="space-y-1">
                <Label>Key Lessons</Label>
                <Textarea rows={2} value={form.key_lessons || ""} onChange={e => setForm(f => ({ ...f, key_lessons: e.target.value }))} placeholder="Comma-separated key takeaways" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Language</Label>
                  <Select value={form.language || "en"} onValueChange={v => setForm(f => ({ ...f, language: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[["en","English"],["ar","Arabic"],["ur","Urdu"],["fr","French"],["tr","Turkish"]].map(([v,l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={form.pub_status || "draft"} onValueChange={v => setForm(f => ({ ...f, pub_status: v as Episode["pub_status"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["draft","under_review","approved","published","unpublished"].map(s => (
                        <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch id="ep-premium" checked={!!form.is_premium} onCheckedChange={v => setForm(f => ({ ...f, is_premium: v }))} />
                <Label htmlFor="ep-premium">Premium only</Label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Episode"}</Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search episodes…" value={search} onChange={e => handleSearchChange(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterSeries} onValueChange={handleFilterChange(setFilterSeries)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Series" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Series</SelectItem>
              {seriesList.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={handleFilterChange(setFilterStatus)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {["draft","under_review","approved","published","unpublished"].map(s => (
                <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>#</TableHead>
              <TableHead>Episode</TableHead>
              <TableHead>Series</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Plays</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Premium</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((__, j) => (
                  <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                ))}
              </TableRow>
            )) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Mic2 className="h-10 w-10 opacity-30" />
                    <p className="font-medium">No episodes found</p>
                    <p className="text-sm">Add your first episode using the button above.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.map(ep => {
              const epCover = ep.cover_override_url;
              return (
                <TableRow key={ep.id} className="transition-colors hover:bg-muted/20">
                  <TableCell className="text-sm font-mono text-muted-foreground">{ep.episode_number}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {epCover ? (
                        <img src={epCover} alt="" className="h-10 w-10 rounded object-cover border border-border shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center border border-border shrink-0">
                          <Mic2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm">{ep.title}</div>
                        {ep.short_summary && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{ep.short_summary}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{(ep.series as unknown as Series)?.title || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ep.duration ? formatDuration(ep.duration) : "—"}</TableCell>
                  <TableCell className="text-sm">{(ep.play_count ?? 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[ep.pub_status] || ""}>
                      {ep.pub_status.replace(/_/g," ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ep.is_premium
                      ? <Badge variant="outline" className="text-primary border-primary/30 text-xs">Premium</Badge>
                      : <span className="text-muted-foreground text-xs">Free</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(ep.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ep)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(ep)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages} ({totalCount} total)
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Episode</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>"{deleteTarget?.title}"</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteEpisode(deleteTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
