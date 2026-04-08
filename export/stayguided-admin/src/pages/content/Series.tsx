import { useCallback, useEffect, useRef, useState } from "react";
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
import { PaginationBar } from "@/components/ui/PaginationBar";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Search, BookOpen } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { formatDate } from "@/lib/utils";
import type { Series, Category, AccessTier } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  under_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  approved: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  scheduled: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  published: "bg-green-500/10 text-green-400 border-green-500/30",
  unpublished: "bg-red-500/10 text-red-400 border-red-500/30",
};

const ACCESS_TIERS: { value: AccessTier; label: string; className: string }[] = [
  { value: "guest",   label: "Guest",   className: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
  { value: "free",    label: "Free",    className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { value: "premium", label: "Premium", className: "bg-primary/10 text-primary border-primary/30" },
];

const blank = (): Partial<Series> => ({
  title: "", description: "", short_summary: "", cover_url: "", language: "en",
  is_premium: false, access_tier: "free", is_featured: false, pub_status: "draft", category_id: "",
});

export default function SeriesPage() {
  const [items, setItems] = useState<Series[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAccess, setFilterAccess] = useState("all");
  const [form, setForm] = useState<Partial<Series>>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const { profile } = useAuth();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async (debounce = false) => {
    if (debounce) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadNow(), 400);
      return;
    }
    loadNow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadNow() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    const [{ data: seriesData }, { data: cats }] = await Promise.all([
      supabase.from("series").select("*, category:categories(id,name)").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("order_index"),
    ]);
    // Deduplicate by id
    const raw = seriesData ?? [];
    const seen = new Set<string>();
    const unique = raw.filter((s: Series) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
    setItems(unique);
    setCategories(cats ?? []);
    setLoading(false);
    loadingRef.current = false;
  }

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-series-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "series" }, () => { load(true); })
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => { load(true); })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() { setForm(blank()); setEditing(null); setSheetOpen(true); }
  function openEdit(s: Series) { setForm({ ...s }); setEditing(s.id); setSheetOpen(true); }

  async function save() {
    if (!form.title?.trim()) return void toast.error("Title is required");
    setSaving(true);
    try {
      const accessTier = form.access_tier ?? "free";
      const payload = {
        title: form.title, description: form.description, short_summary: form.short_summary,
        cover_url: form.cover_url, language: form.language || "en",
        access_tier: accessTier, is_premium: accessTier === "premium",
        is_featured: form.is_featured, pub_status: form.pub_status, category_id: form.category_id || null,
        updated_at: new Date().toISOString(),
      };
      let id = editing;
      if (editing) {
        const { error } = await supabase.from("series").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("series").insert(payload).select().single();
        if (error) throw error;
        id = data.id;
      }
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: editing ? "Updated series" : "Created series",
        entity_type: "series", entity_id: id, details: { title: form.title },
      }).then(() => {}, () => {});
      toast.success(editing ? "Series updated" : "Series created");
      setSheetOpen(false);
      load();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally { setSaving(false); }
  }

  async function deleteSeries(s: Series) {
    try {
      const { error } = await supabase.from("series").delete().eq("id", s.id);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: "Deleted series", entity_type: "series",
        entity_id: s.id, details: { title: s.title },
      }).then(() => {}, () => {});
      toast.success("Series deleted");
      setDeleteTarget(null);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("series").delete().in("id", ids);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: "Bulk deleted series",
        entity_type: "series", details: { count: ids.length, ids },
      }).then(() => {}, () => {});
      toast.success(`${ids.length} ${ids.length === 1 ? "series" : "series"} deleted`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setBulkDeleting(false); }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filtered = items.filter(s => {
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || s.pub_status === filterStatus;
    const matchAccess = filterAccess === "all" || (s.access_tier ?? "free") === filterAccess;
    return matchSearch && matchStatus && matchAccess;
  });

  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const allPageSelected = pageItems.length > 0 && pageItems.every(s => selectedIds.has(s.id));
  const somePageSelected = pageItems.some(s => selectedIds.has(s.id));

  function toggleSelectAll() {
    if (allPageSelected) {
      const next = new Set(selectedIds);
      pageItems.forEach(s => next.delete(s.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      pageItems.forEach(s => next.add(s.id));
      setSelectedIds(next);
    }
  }

  function handleFilterChange() {
    setPage(0);
    setSelectedIds(new Set());
  }

  const colSpan = 9;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Series</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.length} series total</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Series</Button>
            </SheetTrigger>
            <SheetContent className="w-[500px] overflow-y-auto">
              <SheetHeader><SheetTitle>{editing ? "Edit Series" : "New Series"}</SheetTitle></SheetHeader>
              <div className="space-y-4 mt-6">

                <ImageUpload
                  value={form.cover_url || ""}
                  onChange={(url) => setForm(f => ({ ...f, cover_url: url }))}
                  label="Cover Image"
                  folder="series"
                  shape="square"
                  placeholder="Upload cover or paste URL"
                />

                <div className="space-y-1">
                  <Label>Title *</Label>
                  <Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Series title" />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <Select value={form.category_id || ""} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Short Summary</Label>
                  <Input value={form.short_summary || ""} onChange={e => setForm(f => ({ ...f, short_summary: e.target.value }))} placeholder="Brief description shown in listings" />
                </div>
                <div className="space-y-1">
                  <Label>Full Description</Label>
                  <Textarea rows={4} value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed description of this series" />
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
                    <Select value={form.pub_status || "draft"} onValueChange={v => setForm(f => ({ ...f, pub_status: v as Series["pub_status"] }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["draft","under_review","approved","scheduled","published","unpublished"].map(s => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Access Tier</Label>
                  <Select
                    value={form.access_tier ?? "free"}
                    onValueChange={v => setForm(f => ({ ...f, access_tier: v as AccessTier, is_premium: v === "premium" }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guest">Guest — No login required</SelectItem>
                      <SelectItem value="free">Free — All registered users</SelectItem>
                      <SelectItem value="premium">Premium — Subscribers only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="featured" checked={!!form.is_featured} onCheckedChange={v => setForm(f => ({ ...f, is_featured: v }))} />
                  <Label htmlFor="featured">Featured series</Label>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Series"}</Button>
                  <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search series…" value={search} onChange={e => { setSearch(e.target.value); handleFilterChange(); }} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); handleFilterChange(); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {["draft","under_review","approved","scheduled","published","unpublished"].map(s => (
                <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAccess} onValueChange={v => { setFilterAccess(v); handleFilterChange(); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Access" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Access</SelectItem>
              {ACCESS_TIERS.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <input
                  type="checkbox"
                  className="rounded border-border cursor-pointer"
                  checked={allPageSelected}
                  ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                  onChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Series</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Lang</TableHead>
              <TableHead>Episodes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: colSpan }).map((__, j) => (
                  <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                ))}
              </TableRow>
            )) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <BookOpen className="h-10 w-10 opacity-30" />
                    <p className="font-medium">No series found</p>
                    <p className="text-sm">Create your first series using the button above.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : pageItems.map(s => (
              <TableRow key={s.id} className={selectedIds.has(s.id) ? "bg-primary/5" : ""}>
                <TableCell className="pl-4">
                  <input
                    type="checkbox"
                    className="rounded border-border cursor-pointer"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {s.cover_url ? (
                      <img src={s.cover_url} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center border border-border">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-sm">{s.title}</div>
                      {s.short_summary && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{s.short_summary}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{(s.category as unknown as Category)?.name || "—"}</TableCell>
                <TableCell className="text-sm uppercase font-mono">{s.language}</TableCell>
                <TableCell className="text-sm">{s.episode_count ?? 0}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_COLORS[s.pub_status] || ""}>
                    {s.pub_status.replace(/_/g," ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {(() => {
                      const tier = ACCESS_TIERS.find(t => t.value === (s.access_tier ?? "free")) ?? ACCESS_TIERS[1];
                      return <Badge variant="outline" className={`text-xs ${tier.className}`}>{tier.label}</Badge>;
                    })()}
                    {s.is_featured && <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">Featured</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={p => { setPage(p); setSelectedIds(new Set()); }}
          onPageSizeChange={s => { setPageSize(s); setPage(0); }}
        />
      </Card>

      {/* Single delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Series</DialogTitle>
            <DialogDescription>
              Delete <strong>"{deleteTarget?.title}"</strong> and all its episodes? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteSeries(deleteTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={o => !o && setBulkDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Series</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{selectedIds.size} selected series</strong> and all their episodes? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={bulkDeleting} onClick={handleBulkDelete}>
              {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
