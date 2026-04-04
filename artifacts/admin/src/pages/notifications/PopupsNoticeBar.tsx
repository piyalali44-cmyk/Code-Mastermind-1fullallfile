import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface PopupNotice {
  id: string; title: string; body: string | null; type: string;
  cta_label: string | null; cta_url: string | null;
  is_active: boolean; target_audience: string;
  starts_at: string | null; ends_at: string | null; created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  success: "bg-green-500/10 text-green-400 border-green-500/30",
  promo: "bg-primary/10 text-primary border-primary/30",
  ramadan: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

const blank = (): Partial<PopupNotice> => ({
  title: "", body: "", type: "info", cta_label: "", cta_url: "",
  is_active: false, target_audience: "all",
});

export default function PopupsNoticeBar() {
  const [items, setItems] = useState<PopupNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<PopupNotice>>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("popup_notices").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(blank()); setEditing(null); setSheetOpen(true); }
  function openEdit(p: PopupNotice) { setForm({ ...p }); setEditing(p.id); setSheetOpen(true); }

  async function save() {
    if (!form.title?.trim()) return void toast.error("Title is required");
    setSaving(true);
    try {
      const payload = {
        title: form.title, body: form.body, type: form.type,
        cta_label: form.cta_label || null, cta_url: form.cta_url || null,
        is_active: form.is_active, target_audience: form.target_audience,
        starts_at: form.starts_at || null, ends_at: form.ends_at || null,
        created_by: profile?.id,
      };
      let id = editing;
      if (editing) {
        const { error } = await supabase.from("popup_notices").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("popup_notices").insert(payload).select().single();
        if (error) throw error;
        id = data.id;
      }
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: editing ? "Updated popup notice" : "Created popup notice", entity_type: "popup_notice", entity_id: id, details: { title: form.title } }).then(() => {}, () => {});
      toast.success(editing ? "Notice updated" : "Notice created");
      setSheetOpen(false);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleActive(p: PopupNotice) {
    await supabase.from("popup_notices").update({ is_active: !p.is_active }).eq("id", p.id);
    setItems(items.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function deleteNotice(id: string) {
    await supabase.from("popup_notices").delete().eq("id", id);
    toast.success("Notice deleted");
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Popups & Notice Bar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.filter(i => i.is_active).length} active notices</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Notice</Button></SheetTrigger>
          <SheetContent className="w-[460px] overflow-y-auto">
            <SheetHeader><SheetTitle>{editing ? "Edit Notice" : "New Notice"}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={form.type || "info"} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(TYPE_COLORS).map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Target Audience</Label>
                  <Select value={form.target_audience || "all"} onValueChange={v => setForm(f => ({ ...f, target_audience: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["all","guest","free","premium"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Title *</Label>
                <Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Body</Label>
                <Textarea rows={3} value={form.body || ""} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>CTA Button Label</Label>
                  <Input value={form.cta_label || ""} onChange={e => setForm(f => ({ ...f, cta_label: e.target.value }))} placeholder="Learn More" />
                </div>
                <div className="space-y-1">
                  <Label>CTA URL / Deep Link</Label>
                  <Input value={form.cta_url || ""} onChange={e => setForm(f => ({ ...f, cta_url: e.target.value }))} placeholder="https://… or stayguided://…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.starts_at?.slice(0, 10) || ""} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value || null }))} />
                </div>
                <div className="space-y-1">
                  <Label>End Date</Label>
                  <Input type="date" value={form.ends_at?.slice(0, 10) || ""} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value || null }))} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch id="popup-active" checked={!!form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label htmlFor="popup-active">Active (visible to users)</Label>
              </div>
              {/* Preview */}
              {form.title && (
                <div className={`rounded-xl p-3 border ${TYPE_COLORS[form.type || "info"]?.replace("text-", "border-").replace("/10", "/30") || "border-border"} bg-muted/20`}>
                  <p className="text-xs font-bold mb-0.5">{form.title}</p>
                  {form.body && <p className="text-xs text-muted-foreground">{form.body}</p>}
                  {form.cta_label && <button className="text-xs text-primary font-medium mt-1">{form.cta_label} →</button>}
                </div>
              )}
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
              <TableHead>Notice</TableHead><TableHead>Type</TableHead><TableHead>Audience</TableHead>
              <TableHead>Dates</TableHead><TableHead>Active</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>
            )) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No notices yet</TableCell></TableRow>
            ) : items.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <div>
                    <div className="font-medium text-sm">{p.title}</div>
                    {p.body && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{p.body}</div>}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className={TYPE_COLORS[p.type] || ""}>{p.type}</Badge></TableCell>
                <TableCell className="text-sm capitalize">{p.target_audience}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.starts_at ? formatDate(p.starts_at) : "—"} → {p.ends_at ? formatDate(p.ends_at) : "∞"}
                </TableCell>
                <TableCell><Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteNotice(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>
    </div>
  );
}
