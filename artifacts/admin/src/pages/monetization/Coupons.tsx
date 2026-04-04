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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, PauseCircle, Copy } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { CouponCode } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  percentage: "% Off", fixed: "$ Fixed", free_days: "Free Days",
  free_period: "Free Period", price_override: "Price Override", influencer: "Influencer",
};

const blank = (): Partial<CouponCode> => ({
  code: "", description: "", coupon_type: "percentage", discount_value: 0,
  applies_to_weekly: true, applies_to_monthly: true,
  max_total_uses: undefined, max_uses_per_user: 1,
  new_users_only: false, first_subscription_only: false, is_active: true,
});

export default function Coupons() {
  const [items, setItems] = useState<CouponCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Partial<CouponCode>>(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CouponCode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("coupon_codes").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(blank()); setEditing(null); setSheetOpen(true); }
  function openEdit(c: CouponCode) { setForm({ ...c }); setEditing(c.id); setSheetOpen(true); }

  async function save() {
    if (!form.code?.trim()) return void toast.error("Code is required");
    setSaving(true);
    try {
      const payload = { ...form, code: form.code!.toUpperCase().trim(), created_by: profile?.id };
      let id = editing;
      if (editing) {
        const { error } = await supabase.from("coupon_codes").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("coupon_codes").insert(payload).select().single();
        if (error) throw error;
        id = data.id;
      }
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: editing ? "Updated coupon" : "Created coupon",
        entity_type: "coupon", entity_id: id, details: { code: form.code },
      }).then(() => {}, () => {});
      toast.success(editing ? "Coupon updated" : "Coupon created");
      setSheetOpen(false);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function pauseCoupon(c: CouponCode) {
    await supabase.from("coupon_codes").update({ is_active: false }).eq("id", c.id);
    toast.success("Coupon paused");
    load();
  }

  async function deleteCoupon(c: CouponCode) {
    try {
      const { error } = await supabase.from("coupon_codes").delete().eq("id", c.id);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: "Deleted coupon", entity_type: "coupon", entity_id: c.id, details: { code: c.code } }).then(() => {}, () => {});
      toast.success("Coupon deleted");
      setDeleteTarget(null);
      setDeleteConfirm("");
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
  }

  const hasRedemptions = (deleteTarget?.redemption_count ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Coupon Codes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{items.filter(c => c.is_active).length} active coupons</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Coupon</Button></SheetTrigger>
          <SheetContent className="w-[460px] overflow-y-auto">
            <SheetHeader><SheetTitle>{editing ? "Edit Coupon" : "New Coupon"}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="space-y-1">
                <Label>Code *</Label>
                <Input value={form.code || ""} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="RAMADAN50" className="font-mono" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={form.coupon_type || "percentage"} onValueChange={v => setForm(f => ({ ...f, coupon_type: v as CouponCode["coupon_type"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Value</Label>
                  <Input type="number" min={0} value={form.discount_value ?? 0} onChange={e => setForm(f => ({ ...f, discount_value: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Max Total Uses</Label>
                  <Input type="number" min={0} placeholder="Unlimited" value={form.max_total_uses ?? ""} onChange={e => setForm(f => ({ ...f, max_total_uses: e.target.value ? parseInt(e.target.value) : undefined }))} />
                </div>
                <div className="space-y-1">
                  <Label>Max Per User</Label>
                  <Input type="number" min={1} value={form.max_uses_per_user ?? 1} onChange={e => setForm(f => ({ ...f, max_uses_per_user: parseInt(e.target.value) || 1 }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Influencer Name</Label>
                <Input value={form.influencer_name || ""} onChange={e => setForm(f => ({ ...f, influencer_name: e.target.value }))} placeholder="For tracking (optional)" />
              </div>
              <div className="space-y-2 pt-1">
                {[
                  { id: "c-weekly", label: "Applies to weekly", key: "applies_to_weekly" as const },
                  { id: "c-monthly", label: "Applies to monthly", key: "applies_to_monthly" as const },
                  { id: "c-newonly", label: "New users only", key: "new_users_only" as const },
                  { id: "c-firstsub", label: "First subscription only", key: "first_subscription_only" as const },
                  { id: "c-active", label: "Active", key: "is_active" as const },
                ].map(({ id, label, key }) => (
                  <div key={id} className="flex items-center gap-2">
                    <Switch id={id} checked={!!form[key]} onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))} />
                    <Label htmlFor={id}>{label}</Label>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Coupon"}</Button>
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
            <TableRow>
              <TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Value</TableHead>
              <TableHead>Used</TableHead><TableHead>Max Uses</TableHead><TableHead>Influencer</TableHead>
              <TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 9 }).map((__, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>
            )) : items.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">No coupons yet</TableCell></TableRow>
            ) : items.map(c => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm text-primary">{c.code}</span>
                    <button onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied"); }}>
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{TYPE_LABELS[c.coupon_type] || c.coupon_type}</TableCell>
                <TableCell className="text-sm font-mono">{c.coupon_type === "percentage" ? `${c.discount_value}%` : c.coupon_type === "fixed" ? `$${c.discount_value}` : c.discount_value}</TableCell>
                <TableCell className="text-sm">{c.redemption_count ?? 0}</TableCell>
                <TableCell className="text-sm">{c.max_total_uses ?? "∞"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.influencer_name || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={c.is_active ? "text-green-400 border-green-400/30" : "text-muted-foreground"}>
                    {c.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit2 className="h-4 w-4" /></Button>
                    {c.is_active && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => pauseCoupon(c)}><PauseCircle className="h-4 w-4" /></Button>}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { setDeleteTarget(c); setDeleteConfirm(""); }}><Trash2 className="h-4 w-4" /></Button>
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
            <DialogTitle>Delete Coupon</DialogTitle>
            <DialogDescription>
              {hasRedemptions ? (
                <>This coupon has <strong>{deleteTarget?.redemption_count} redemptions</strong>. Deleting it will not affect existing subscriptions but the code can never be redeemed again.</>
              ) : (
                <>Permanently delete coupon <strong>{deleteTarget?.code}</strong>?</>
              )}
            </DialogDescription>
          </DialogHeader>
          {hasRedemptions && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Alternatively, you can pause this coupon to stop new redemptions while keeping it in records.</p>
              <div className="space-y-1">
                <Label className="text-destructive text-xs">Type the coupon code to confirm deletion:</Label>
                <Input className="font-mono" placeholder={deleteTarget?.code} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            {hasRedemptions && (
              <Button variant="outline" onClick={() => { if (deleteTarget) pauseCoupon(deleteTarget); setDeleteTarget(null); }}>
                <PauseCircle className="h-4 w-4 mr-1" />Pause Instead
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteCoupon(deleteTarget)}
              disabled={hasRedemptions && deleteConfirm !== deleteTarget?.code}
            >
              Delete Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
