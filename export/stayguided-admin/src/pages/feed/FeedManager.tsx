import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, LayoutGrid, Code2 } from "lucide-react";

interface FeedWidget {
  id: string; zone: string; widget_type: string; title: string | null;
  content: Record<string, unknown> | null;
  is_active: boolean; priority: number; target_user_type: string;
  starts_at: string | null; ends_at: string | null; created_at: string;
}

const ZONES = ["home_top","home_middle","home_bottom","discovery","player_bottom","profile_top"];
const WIDGET_TYPES = ["banner","category_row","series_row","featured_series","continue_listening","daily_challenge","streak_card","ramadan_countdown","donation_cta","referral_cta","custom_html"];

const CONTENT_HINTS: Record<string, string> = {
  banner: '{\n  "image_url": "",\n  "deeplink": "",\n  "alt_text": ""\n}',
  category_row: '{\n  "category_id": ""\n}',
  series_row: '{\n  "series_ids": []\n}',
  featured_series: '{\n  "series_id": "",\n  "description_override": ""\n}',
  donation_cta: '{\n  "title": "",\n  "button_text": "",\n  "target_url": ""\n}',
  referral_cta: '{\n  "title": "",\n  "button_text": "",\n  "target_url": ""\n}',
  custom_html: '{\n  "html_content": ""\n}',
  ramadan_countdown: '{\n  "target_date": "2027-03-01"\n}',
};

const blankForm = (): Partial<FeedWidget> => ({ zone: "home_top", widget_type: "banner", title: "", content: null, is_active: true, priority: 0, target_user_type: "all" });

export default function FeedManager() {
  const [items, setItems] = useState<FeedWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<FeedWidget>>(blankForm());
  const [contentJson, setContentJson] = useState("");
  const [contentError, setContentError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterZone, setFilterZone] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<FeedWidget | null>(null);
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("feed_widgets").select("*").order("zone").order("priority");
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    const f = blankForm();
    setForm(f);
    setContentJson(CONTENT_HINTS[f.widget_type || "banner"] || "{}");
    setContentError("");
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(w: FeedWidget) {
    setForm({ ...w });
    setContentJson(w.content ? JSON.stringify(w.content, null, 2) : "{}");
    setContentError("");
    setEditing(w.id);
    setSheetOpen(true);
  }

  function handleWidgetTypeChange(type: string) {
    setForm(f => ({ ...f, widget_type: type }));
    if (!editing && (!contentJson.trim() || contentJson === "{}" || Object.keys(CONTENT_HINTS).some(k => contentJson === CONTENT_HINTS[k]))) {
      setContentJson(CONTENT_HINTS[type] || "{}");
    }
  }

  function validateJson(val: string) {
    setContentJson(val);
    if (!val.trim() || val.trim() === "{}") {
      setContentError("");
      return;
    }
    try {
      JSON.parse(val);
      setContentError("");
    } catch {
      setContentError("Invalid JSON");
    }
  }

  async function save() {
    if (!form.zone || !form.widget_type) return void toast.error("Zone and type are required");

    let parsedContent: Record<string, unknown> | null = null;
    if (contentJson.trim() && contentJson.trim() !== "{}") {
      try {
        parsedContent = JSON.parse(contentJson);
      } catch {
        return void toast.error("Content JSON is invalid");
      }
    }

    setSaving(true);
    try {
      const payload = {
        zone: form.zone, widget_type: form.widget_type, title: form.title || null,
        content: parsedContent,
        is_active: form.is_active, priority: form.priority ?? 0,
        target_user_type: form.target_user_type || "all",
        starts_at: form.starts_at || null, ends_at: form.ends_at || null,
        created_by: profile?.id,
      };
      let id = editing;
      if (editing) {
        const { error } = await supabase.from("feed_widgets").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("feed_widgets").insert(payload).select().single();
        if (error) throw error;
        id = data.id;
      }
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: editing ? "Updated feed widget" : "Created feed widget", entity_type: "feed_widget", entity_id: id }).then(() => {}, () => {});
      toast.success(editing ? "Widget updated" : "Widget created");
      setSheetOpen(false);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteWidget(w: FeedWidget) {
    await supabase.from("feed_widgets").delete().eq("id", w.id);
    supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: "Deleted feed widget", entity_type: "feed_widget", entity_id: w.id }).then(() => {}, () => {});
    toast.success("Widget deleted");
    setDeleteTarget(null);
    load();
  }

  async function toggleActive(w: FeedWidget) {
    await supabase.from("feed_widgets").update({ is_active: !w.is_active }).eq("id", w.id);
    setItems(items.map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x));
  }

  const filtered = filterZone === "all" ? items : items.filter(w => w.zone === filterZone);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><LayoutGrid className="h-6 w-6 text-primary" />Feed Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.filter(w => w.is_active).length} active widgets</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Widget</Button></SheetTrigger>
          <SheetContent className="w-[480px] overflow-y-auto">
            <SheetHeader><SheetTitle>{editing ? "Edit Widget" : "Add Widget"}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Zone</Label>
                  <Select value={form.zone || "home_top"} onValueChange={v => setForm(f => ({ ...f, zone: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ZONES.map(z => <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Widget Type</Label>
                  <Select value={form.widget_type || "banner"} onValueChange={handleWidgetTypeChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{WIDGET_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Title</Label><Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Optional display title" /></div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Content (JSON)
                </Label>
                <Textarea
                  rows={6}
                  value={contentJson}
                  onChange={e => validateJson(e.target.value)}
                  placeholder='{ "key": "value" }'
                  className="font-mono text-xs"
                />
                {contentError && <p className="text-xs text-destructive">{contentError}</p>}
                {form.widget_type && CONTENT_HINTS[form.widget_type] && (
                  <p className="text-xs text-muted-foreground">
                    Expected fields for <strong>{form.widget_type.replace(/_/g, " ")}</strong>. Edit the JSON above to configure widget data.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <Input type="number" min={0} value={form.priority ?? 0} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-1">
                  <Label>Target Users</Label>
                  <Select value={form.target_user_type || "all"} onValueChange={v => setForm(f => ({ ...f, target_user_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["all","guest","free","premium"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={form.starts_at?.slice(0, 10) || ""} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value || null }))} /></div>
                <div className="space-y-1"><Label>End Date</Label><Input type="date" value={form.ends_at?.slice(0, 10) || ""} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value || null }))} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch id="w-active" checked={!!form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label htmlFor="w-active">Active</Label></div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Create"}</Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardContent className="p-4">
          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Zones" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {ZONES.map(z => <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead>Zone</TableHead><TableHead>Type</TableHead><TableHead>Title</TableHead><TableHead>Content</TableHead><TableHead>Target</TableHead><TableHead>Priority</TableHead><TableHead>Active</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>
            )) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <LayoutGrid className="h-10 w-10 opacity-30" />
                    <p className="font-medium">No widgets found</p>
                    <p className="text-sm">Create a widget using the button above.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered.map(w => (
              <TableRow key={w.id} className="transition-colors hover:bg-muted/20">
                <TableCell><Badge variant="outline" className="text-xs">{w.zone.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-sm">{w.widget_type.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{w.title || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[120px]">
                  {w.content ? (
                    <span className="text-xs font-mono truncate block">{JSON.stringify(w.content).slice(0, 40)}{JSON.stringify(w.content).length > 40 ? "…" : ""}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm capitalize">{w.target_user_type}</TableCell>
                <TableCell className="text-sm">{w.priority}</TableCell>
                <TableCell><Switch checked={w.is_active} onCheckedChange={() => toggleActive(w)} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(w)}><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(w)}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogTitle>Delete Widget</DialogTitle>
            <DialogDescription>
              Permanently delete this <strong>{deleteTarget?.widget_type.replace(/_/g, " ")}</strong> widget{deleteTarget?.title ? ` "${deleteTarget.title}"` : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteWidget(deleteTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
