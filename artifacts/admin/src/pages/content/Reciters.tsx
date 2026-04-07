import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, GripVertical, Mic2 } from "lucide-react";
import { PaginationBar } from "@/components/ui/PaginationBar";
import ImageUpload from "@/components/ImageUpload";
import type { Reciter } from "@/lib/types";

const blank = (): Partial<Reciter> => ({
  name_english: "", name_arabic: "", bio: "", photo_url: "", api_reciter_id: "",
  streaming_bitrate: 128, download_bitrate: 192,
  supports_ayah_level: false, is_active: true, is_default: false, order_index: 0,
});

export default function Reciters() {
  const [items, setItems] = useState<Reciter[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Reciter>>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Reciter | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [associatedCount, setAssociatedCount] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const { profile } = useAuth();

  const pageItems = items.slice(page * pageSize, (page + 1) * pageSize);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("reciters").select("*").order("order_index");
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(blank()); setEditing(null); setSheetOpen(true); }
  function openEdit(r: Reciter) { setForm({ ...r }); setEditing(r.id); setSheetOpen(true); }

  async function save() {
    if (!form.name_english?.trim()) return void toast.error("Name is required");
    setSaving(true);
    try {
      const payload = {
        name_english: form.name_english, name_arabic: form.name_arabic, bio: form.bio,
        photo_url: form.photo_url, api_reciter_id: form.api_reciter_id,
        streaming_bitrate: form.streaming_bitrate ?? 128, download_bitrate: form.download_bitrate ?? 192,
        supports_ayah_level: form.supports_ayah_level, is_active: form.is_active,
        is_default: form.is_default, order_index: form.order_index ?? 0,
      };
      let id = editing;
      if (editing) {
        if (payload.is_default) await supabase.from("reciters").update({ is_default: false }).neq("id", editing);
        const { error } = await supabase.from("reciters").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        if (payload.is_default) await supabase.from("reciters").update({ is_default: false }).not("id", "is", null);
        const { data, error } = await supabase.from("reciters").insert(payload).select().single();
        if (error) throw error;
        id = data.id;
      }
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: editing ? "Updated reciter" : "Created reciter",
        entity_type: "reciter", entity_id: id, details: { name: form.name_english },
      }).then(() => {}, () => {});
      toast.success(editing ? "Reciter updated" : "Reciter added");
      setSheetOpen(false);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleActive(r: Reciter) {
    await supabase.from("reciters").update({ is_active: !r.is_active }).eq("id", r.id);
    setItems(items.map(x => x.id === r.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function handleDeleteClick(r: Reciter) {
    setAssociatedCount(0);
    setDeleteTarget(r);
  }

  async function deleteReciter(r: Reciter) {
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("reciters").delete().eq("id", r.id);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: "Deleted reciter",
        entity_type: "reciter", entity_id: r.id, details: { name: r.name_english },
      }).then(() => {}, () => {});
      toast.success("Reciter deleted");
      setDeleteTarget(null);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setDeleteLoading(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Reciters</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.length} reciters configured</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Reciter</Button>
          </SheetTrigger>
          <SheetContent className="w-[460px] overflow-y-auto">
            <SheetHeader><SheetTitle>{editing ? "Edit Reciter" : "Add Reciter"}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">

              <ImageUpload
                value={form.photo_url || ""}
                onChange={(url) => setForm(f => ({ ...f, photo_url: url }))}
                label="Reciter Photo"
                folder="reciters"
                shape="circle"
                placeholder="Upload photo or paste URL"
              />

              <div className="space-y-1">
                <Label>English Name *</Label>
                <Input value={form.name_english || ""} onChange={e => setForm(f => ({ ...f, name_english: e.target.value }))} placeholder="e.g. Mishary Rashid Alafasy" />
              </div>
              <div className="space-y-1">
                <Label>Arabic Name</Label>
                <Input dir="rtl" value={form.name_arabic || ""} onChange={e => setForm(f => ({ ...f, name_arabic: e.target.value }))} placeholder="مشاري راشد العفاسي" />
              </div>
              <div className="space-y-1">
                <Label>API Reciter ID</Label>
                <Input value={form.api_reciter_id || ""} onChange={e => setForm(f => ({ ...f, api_reciter_id: e.target.value }))} placeholder="e.g. ar.alafasy" />
              </div>
              <div className="space-y-1">
                <Label>Bio</Label>
                <Textarea rows={3} value={form.bio || ""} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Brief biography of this reciter" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Streaming kbps</Label>
                  <Input type="number" value={form.streaming_bitrate || 128} onChange={e => setForm(f => ({ ...f, streaming_bitrate: parseInt(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Download kbps</Label>
                  <Input type="number" value={form.download_bitrate || 192} onChange={e => setForm(f => ({ ...f, download_bitrate: parseInt(e.target.value) }))} />
                </div>
              </div>
              <div className="space-y-3 pt-1 border-t border-border">
                <p className="text-sm font-medium pt-3">Settings</p>
                {[
                  { id: "reciter-active", label: "Active", desc: "Visible to users", key: "is_active" as const },
                  { id: "reciter-default", label: "Default Reciter", desc: "Pre-selected for new users", key: "is_default" as const },
                  { id: "reciter-ayah", label: "Supports Ayah-level timing", desc: "Word-by-word highlighting", key: "supports_ayah_level" as const },
                ].map(({ id, label, desc, key }) => (
                  <div key={id} className="flex items-center justify-between">
                    <Label htmlFor={id} className="flex flex-col cursor-pointer">
                      <span className="text-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground font-normal">{desc}</span>
                    </Label>
                    <Switch id={id} checked={!!form[key]} onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))} />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : editing ? "Save Changes" : "Add Reciter"}
                </Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-8" />
              <TableHead>Reciter</TableHead>
              <TableHead>API ID</TableHead>
              <TableHead>Bitrate</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                ))}
              </TableRow>
            )) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Mic2 className="h-10 w-10 opacity-30" />
                    <p className="font-medium">No reciters configured</p>
                    <p className="text-sm">Add a reciter using the button above.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : pageItems.map(r => (
              <TableRow key={r.id} className="transition-colors hover:bg-muted/20">
                <TableCell><GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={r.photo_url || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                        {r.name_english.split(" ").map(w => w[0]).join("").slice(0,2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">{r.name_english}</div>
                      {r.name_arabic && <div className="text-xs text-muted-foreground" dir="rtl">{r.name_arabic}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">{r.api_reciter_id || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.streaming_bitrate}k / {r.download_bitrate}k</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {r.is_default && <Badge variant="outline" className="text-xs text-primary border-primary/30">Default</Badge>}
                    {r.supports_ayah_level && <Badge variant="outline" className="text-xs text-cyan-400 border-cyan-400/30">Ayah</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
          total={items.length}
          onPageChange={setPage}
          onPageSizeChange={s => { setPageSize(s); setPage(0); }}
        />
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Reciter</DialogTitle>
            <DialogDescription>
              {associatedCount > 0 ? (
                <>
                  This reciter has <strong>{associatedCount} associated episode{associatedCount !== 1 ? "s" : ""}</strong>. Deleting it may affect that content. Are you sure you want to permanently delete <strong>"{deleteTarget?.name_english}"</strong>?
                </>
              ) : (
                <>
                  Permanently delete <strong>"{deleteTarget?.name_english}"</strong>? This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteLoading} onClick={() => deleteTarget && deleteReciter(deleteTarget)}>
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
