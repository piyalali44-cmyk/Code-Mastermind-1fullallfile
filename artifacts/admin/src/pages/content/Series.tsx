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
import { Plus, Edit2, Trash2, Search, BookOpen } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { formatDate } from "@/lib/utils";
import type { Series, Category } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  under_review: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  approved: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  scheduled: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  published: "bg-green-500/10 text-green-400 border-green-500/30",
  unpublished: "bg-red-500/10 text-red-400 border-red-500/30",
};

const blank = (): Partial<Series> => ({
  title: "", description: "", short_summary: "", cover_url: "", language: "en",
  is_premium: false, is_featured: false, pub_status: "draft", category_id: "",
});

export default function SeriesPage() {
  const [items, setItems] = useState<Series[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState<Partial<Series>>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);
  const [saving, setSaving] = useState(false);
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    const [{ data: seriesData }, { data: cats }] = await Promise.all([
      supabase.from("series").select("*, category:categories(id,name)").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("order_index"),
    ]);
    setItems(seriesData ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(blank()); setEditing(null); setSheetOpen(true); }
  function openEdit(s: Series) { setForm({ ...s }); setEditing(s.id); setSheetOpen(true); }

  async function save() {
    if (!form.title?.trim()) return void toast.error("Title is required");
    setSaving(true);
    try {
      const payload = {
        title: form.title, description: form.description, short_summary: form.short_summary,
        cover_url: form.cover_url, language: form.language || "en", is_premium: form.is_premium,
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

  const filtered = items.filter(s => {
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || s.pub_status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Series</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.length} series total</p>
        </div>
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
              <div className="flex gap-6 pt-1">
                <div className="flex items-center gap-2">
                  <Switch id="premium" checked={!!form.is_premium} onCheckedChange={v => setForm(f => ({ ...f, is_premium: v }))} />
                  <Label htmlFor="premium">Premium only</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="featured" checked={!!form.is_featured} onCheckedChange={v => setForm(f => ({ ...f, is_featured: v }))} />
                  <Label htmlFor="featured">Featured</Label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Series"}</Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardContent className="p-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search series…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {["draft","under_review","approved","scheduled","published","unpublished"].map(s => (
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
            <TableRow>
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
                {Array.from({ length: 8 }).map((__, j) => (
                  <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                ))}
              </TableRow>
            )) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <BookOpen className="h-10 w-10 opacity-30" />
                    <p className="font-medium">No series found</p>
                    <p className="text-sm">Create your first series using the button above.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id}>
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
                    {s.is_premium && <Badge variant="outline" className="text-xs text-primary border-primary/30">Premium</Badge>}
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
      </Card>

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
    </div>
  );
}
