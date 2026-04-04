import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Edit2, CheckCircle, Clock, BookOpen, Plus, ArrowUp, ArrowDown, Trash2, EyeOff, Eye } from "lucide-react";
import type { JourneyChapter } from "@/lib/types";

export default function JourneyTimeline() {
  const [chapters, setChapters] = useState<JourneyChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<JourneyChapter | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Partial<JourneyChapter>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JourneyChapter | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("journey_chapters").select("*").order("order_index");
    setChapters(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openEdit(ch: JourneyChapter) {
    setEditing(ch);
    setIsNew(false);
    setForm({ ...ch });
  }

  function openNew() {
    const maxOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order_index)) : 0;
    const maxChapter = chapters.length > 0 ? Math.max(...chapters.map(c => c.chapter_number)) : 0;
    setIsNew(true);
    setEditing({ id: "", chapter_number: maxChapter + 1, title: "", order_index: maxOrder + 1, is_published: false, show_coming_soon: true } as JourneyChapter);
    setForm({
      chapter_number: maxChapter + 1,
      title: "",
      subtitle: "",
      era_label: "",
      description: "",
      cover_url: "",
      estimated_release: "",
      is_published: false,
      show_coming_soon: true,
      order_index: maxOrder + 1,
    });
  }

  async function save() {
    if (!editing) return;
    if (!form.title?.trim()) return void toast.error("Title is required");
    setSaving(true);
    try {
      const payload = {
        chapter_number: form.chapter_number,
        title: form.title,
        subtitle: form.subtitle || null,
        era_label: form.era_label || null,
        description: form.description || null,
        cover_url: form.cover_url || null,
        is_published: form.is_published,
        show_coming_soon: form.show_coming_soon,
        estimated_release: form.estimated_release || null,
        order_index: form.order_index,
      };
      if (isNew) {
        const { error } = await supabase.from("journey_chapters").insert(payload);
        if (error) throw error;
        supabase.from("admin_activity_log").insert({
          admin_id: profile?.id, action: "Created journey chapter",
          entity_type: "journey_chapter",
          details: { chapter: form.chapter_number, title: form.title },
        }).then(() => {}, () => {});
        toast.success("Chapter created");
      } else {
        const { error } = await supabase.from("journey_chapters").update(payload).eq("id", editing.id);
        if (error) throw error;
        supabase.from("admin_activity_log").insert({
          admin_id: profile?.id, action: "Updated journey chapter",
          entity_type: "journey_chapter", entity_id: editing.id,
          details: { chapter: form.chapter_number, title: form.title },
        }).then(() => {}, () => {});
        toast.success("Chapter saved");
      }
      setEditing(null);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function togglePublish(ch: JourneyChapter) {
    const newVal = !ch.is_published;
    const { error } = await supabase
      .from("journey_chapters")
      .update({ is_published: newVal, show_coming_soon: !newVal })
      .eq("id", ch.id);
    if (error) { toast.error("Failed to update chapter"); return; }
    setChapters(prev => prev.map(c => c.id === ch.id
      ? { ...c, is_published: newVal, show_coming_soon: !newVal }
      : c
    ));
    toast.success(newVal ? "Chapter published — visible in app" : "Chapter hidden from app");
  }

  async function moveChapter(ch: JourneyChapter, direction: "up" | "down") {
    const sorted = [...chapters].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex(c => c.id === ch.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    const tempOrder = ch.order_index;

    const [r1, r2] = await Promise.all([
      supabase.from("journey_chapters").update({ order_index: other.order_index }).eq("id", ch.id),
      supabase.from("journey_chapters").update({ order_index: tempOrder }).eq("id", other.id),
    ]);
    if (r1.error || r2.error) {
      toast.error("Failed to reorder chapters");
      return;
    }
    load();
    toast.success("Order updated — synced to app");
  }

  async function deleteChapter() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("journey_chapters").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    supabase.from("admin_activity_log").insert({
      admin_id: profile?.id, action: "Deleted journey chapter",
      entity_type: "journey_chapter", entity_id: deleteTarget.id,
      details: { chapter: deleteTarget.chapter_number, title: deleteTarget.title },
    }).then(() => {}, () => {});
    toast.success("Chapter deleted");
    setDeleteTarget(null);
    setDeleteConfirm("");
    load();
  }

  const published = chapters.filter(c => c.is_published).length;
  const hidden = chapters.filter(c => !c.is_published).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Journey Timeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {chapters.length} chapters · {published} published · {hidden} hidden
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Chapter</Button>
      </div>

      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
        <div className="space-y-3">
          {loading ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="ml-14 h-16 bg-muted animate-pulse rounded-xl" />
          )) : chapters.map((ch, idx) => (
            <div key={ch.id} className="flex items-start gap-4">
              <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 mt-3 ${ch.is_published ? "bg-primary border-primary" : "bg-card border-border"}`}>
                {ch.is_published ? <CheckCircle className="h-4 w-4 text-background" /> : <Clock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <Card className={`flex-1 p-4 ${!ch.is_published ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">Ch. {ch.chapter_number}</span>
                      {ch.era_label && <Badge variant="outline" className="text-xs">{ch.era_label}</Badge>}
                      {ch.is_published ? (
                        <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">Published</Badge>
                      ) : ch.show_coming_soon ? (
                        <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">Coming Soon</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Hidden</Badge>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-foreground">{ch.title}</p>
                    {ch.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{ch.subtitle}</p>}
                    {ch.estimated_release && !ch.is_published && (
                      <p className="text-xs text-primary mt-1">Est. release: {ch.estimated_release}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveChapter(ch, "up")} title="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === chapters.length - 1} onClick={() => moveChapter(ch, "down")} title="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePublish(ch)} title={ch.is_published ? "Hide" : "Publish"}>
                      {ch.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ch)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(ch)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <SheetContent className="w-[460px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {isNew ? "New Chapter" : `Chapter ${editing?.chapter_number}`}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Chapter Number</Label>
                <Input type="number" min={1} value={form.chapter_number ?? ""} onChange={e => setForm(f => ({ ...f, chapter_number: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="space-y-1">
                <Label>Order Index</Label>
                <Input type="number" min={0} value={form.order_index ?? ""} onChange={e => setForm(f => ({ ...f, order_index: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Subtitle</Label>
              <Input value={form.subtitle || ""} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Era Label</Label>
              <Input value={form.era_label || ""} onChange={e => setForm(f => ({ ...f, era_label: e.target.value }))} placeholder="e.g. 610 CE or Pre-Islamic Era" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={4} value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Cover Image URL</Label>
              <Input value={form.cover_url || ""} onChange={e => setForm(f => ({ ...f, cover_url: e.target.value }))} placeholder="https://…" />
            </div>
            <div className="space-y-1">
              <Label>Estimated Release (if not published)</Label>
              <Input value={form.estimated_release || ""} onChange={e => setForm(f => ({ ...f, estimated_release: e.target.value }))} placeholder="e.g. Q3 2025" />
            </div>
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <Switch id="ch-published" checked={!!form.is_published} onCheckedChange={v => setForm(f => ({ ...f, is_published: v, show_coming_soon: !v }))} />
                <Label htmlFor="ch-published">Published (visible in app)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="ch-coming" checked={!!form.show_coming_soon} onCheckedChange={v => setForm(f => ({ ...f, show_coming_soon: v }))} />
                <Label htmlFor="ch-coming">Show "Coming Soon" teaser</Label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : isNew ? "Create Chapter" : "Save Chapter"}</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) { setDeleteTarget(null); setDeleteConfirm(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chapter</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>Ch. {deleteTarget?.chapter_number} — {deleteTarget?.title}</strong> and remove it from the mobile app. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Type DELETE to confirm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirm(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={deleteConfirm !== "DELETE"} onClick={deleteChapter}>Delete Chapter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
