import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Plus, Edit2, Globe, Star } from "lucide-react";

interface ApiSource {
  id: string; name: string; type: string; base_url: string;
  is_active: boolean; is_primary: boolean; priority: number; notes: string | null; created_at: string;
}

const TYPES = [
  "quran_audio","quran_text","translation","tafsir","hadith","prayer_times",
];

const TYPE_LABELS: Record<string, string> = {
  quran_audio: "Qur'an Audio", quran_text: "Qur'an Text", translation: "Translation",
  tafsir: "Tafsir", hadith: "Hadith", prayer_times: "Prayer Times",
};

const blank = (): Partial<ApiSource> => ({
  name: "", type: "quran_audio", base_url: "", is_active: true, is_primary: false, priority: 0, notes: "",
});

export default function ApiSources() {
  const [items, setItems] = useState<ApiSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<ApiSource>>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("api_sources").select("*").order("type").order("priority");
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(blank()); setEditing(null); setSheetOpen(true); }
  function openEdit(a: ApiSource) { setForm({ ...a }); setEditing(a.id); setSheetOpen(true); }

  async function save() {
    if (!form.name?.trim() || !form.base_url?.trim()) return void toast.error("Name and URL are required");
    setSaving(true);
    try {
      const payload = { name: form.name, type: form.type, base_url: form.base_url, is_active: form.is_active, is_primary: form.is_primary, priority: form.priority ?? 0, notes: form.notes || null };
      if (form.is_primary) await supabase.from("api_sources").update({ is_primary: false }).eq("type", form.type!).neq("id", editing || "");
      let id = editing;
      if (editing) {
        const { error } = await supabase.from("api_sources").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("api_sources").insert(payload).select().single();
        if (error) throw error;
        id = data.id;
      }
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: editing ? "Updated API source" : "Added API source", entity_type: "api_source", entity_id: id, details: { name: form.name } }).then(() => {}, () => {});
      toast.success(editing ? "API source updated" : "API source added");
      setSheetOpen(false);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleActive(a: ApiSource) {
    await supabase.from("api_sources").update({ is_active: !a.is_active }).eq("id", a.id);
    setItems(items.map(x => x.id === a.id ? { ...x, is_active: !x.is_active } : x));
  }

  const grouped = TYPES.reduce((acc, type) => {
    const filtered = items.filter(a => a.type === type);
    if (filtered.length > 0) acc[type] = filtered;
    return acc;
  }, {} as Record<string, ApiSource[]>);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><Globe className="h-6 w-6 text-primary" />API Sources</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.length} sources configured</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Source</Button></SheetTrigger>
          <SheetContent className="w-[440px] overflow-y-auto">
            <SheetHeader><SheetTitle>{editing ? "Edit API Source" : "Add API Source"}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="space-y-1"><Label>Name *</Label><Input value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type || "quran_audio"} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Base URL *</Label><Input value={form.base_url || ""} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://api.example.com/v1" /></div>
              <div className="space-y-1">
                <Label>Priority (lower = tried first)</Label>
                <Input type="number" min={0} value={form.priority ?? 0} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} className="w-24" />
              </div>
              <div className="space-y-1"><Label>Notes</Label><Textarea rows={2} value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div className="space-y-2">
                {[{ id: "api-active", label: "Active", key: "is_active" as const }, { id: "api-primary", label: "Primary source for this type", key: "is_primary" as const }].map(({ id, label, key }) => (
                  <div key={id} className="flex items-center gap-2"><Switch id={id} checked={!!form[key]} onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))} /><Label htmlFor={id}>{label}</Label></div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Add"}</Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {loading ? <div className="h-40 bg-muted animate-pulse rounded-xl" /> : Object.entries(grouped).map(([type, sources]) => (
        <div key={type}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">{TYPE_LABELS[type]}</h3>
          <Card>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Base URL</TableHead><TableHead>Priority</TableHead><TableHead>Flags</TableHead><TableHead>Active</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {sources.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-sm">{a.name}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{a.base_url}</TableCell>
                    <TableCell className="text-sm">{a.priority}</TableCell>
                    <TableCell>{a.is_primary && <Badge variant="outline" className="text-primary border-primary/30 gap-1 text-xs"><Star className="h-3 w-3" />Primary</Badge>}</TableCell>
                    <TableCell><Switch checked={a.is_active} onCheckedChange={() => toggleActive(a)} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Edit2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}
