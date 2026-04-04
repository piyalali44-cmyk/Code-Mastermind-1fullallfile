import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Badge {
  id: string; slug: string; name: string; description: string | null;
  icon: string | null; xp_reward: number; created_at: string;
  earned_count?: number;
}

const blank = (): Partial<Badge> => ({ slug: "", name: "", description: "", icon: "🏆", xp_reward: 50 });

export default function BadgeManager() {
  const [items, setItems] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<Badge>>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Badge | null>(null);
  const [saving, setSaving] = useState(false);
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    const { data: badges } = await supabase.from("badges").select("*").order("created_at");
    if (badges) {
      const counts: Record<string, number> = {};
      const { data: earned } = await supabase.from("user_badges").select("badge_id");
      (earned || []).forEach((e: { badge_id: string }) => { counts[e.badge_id] = (counts[e.badge_id] || 0) + 1; });
      setItems(badges.map((b: Badge) => ({ ...b, earned_count: counts[b.id] || 0 })));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(blank()); setEditing(null); setSheetOpen(true); }
  function openEdit(b: Badge) { setForm({ ...b }); setEditing(b.id); setSheetOpen(true); }

  async function save() {
    if (!form.name?.trim() || !form.slug?.trim()) return void toast.error("Name and slug are required");
    setSaving(true);
    try {
      const payload = { name: form.name, slug: form.slug, description: form.description, icon: form.icon, xp_reward: form.xp_reward ?? 0 };
      let id = editing;
      if (editing) {
        const { error } = await supabase.from("badges").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("badges").insert(payload).select().single();
        if (error) throw error;
        id = data.id;
      }
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: editing ? "Updated badge" : "Created badge", entity_type: "badge", entity_id: id, details: { name: form.name } }).then(() => {}, () => {});
      toast.success(editing ? "Badge updated" : "Badge created");
      setSheetOpen(false);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteBadge(b: Badge) {
    try {
      const { error } = await supabase.from("badges").delete().eq("id", b.id);
      if (error) throw error;
      toast.success("Badge deleted");
      setDeleteTarget(null);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Badge Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.length} badges configured</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Badge</Button></SheetTrigger>
          <SheetContent className="w-[420px]">
            <SheetHeader><SheetTitle>{editing ? "Edit Badge" : "New Badge"}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Icon (emoji)</Label>
                  <Input value={form.icon || ""} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="🏆" className="text-2xl text-center" />
                </div>
                <div className="space-y-1">
                  <Label>XP Reward</Label>
                  <Input type="number" min={0} value={form.xp_reward ?? 0} onChange={e => setForm(f => ({ ...f, xp_reward: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Name *</Label>
                <Input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="First Listen" />
              </div>
              <div className="space-y-1">
                <Label>Slug * (unique identifier)</Label>
                <Input value={form.slug || ""} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} placeholder="first_listen" className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={2} value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Create"}</Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Badge</TableHead><TableHead>Slug</TableHead><TableHead>XP Reward</TableHead>
              <TableHead>Times Earned</TableHead><TableHead>Created</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>
            )) : items.map(b => (
              <TableRow key={b.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{b.icon}</span>
                    <div>
                      <div className="font-medium text-sm">{b.name}</div>
                      {b.description && <div className="text-xs text-muted-foreground">{b.description}</div>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">{b.slug}</TableCell>
                <TableCell className="text-sm font-semibold text-primary">+{b.xp_reward} XP</TableCell>
                <TableCell className="text-sm">{(b.earned_count || 0).toLocaleString()}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(b.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(b)}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogTitle>Delete Badge</DialogTitle>
            <DialogDescription>Delete <strong>"{deleteTarget?.name}"</strong>? Users who earned it will lose it from their profile.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteBadge(deleteTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
