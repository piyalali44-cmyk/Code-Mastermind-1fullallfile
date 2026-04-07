import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Send, Plus, Bell, Loader2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { PaginationBar } from "@/components/ui/PaginationBar";
import ImageUpload from "@/components/ImageUpload";

interface Campaign {
  id: string; title: string; body: string; image_url: string | null; deep_link: string | null;
  target_type: string; status: string; sent_count: number | null;
  scheduled_at: string | null; sent_at: string | null; created_at: string;
}

const blank = () => ({ title: "", body: "", deep_link: "", target_type: "all", image_url: "" });

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  sending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  sent: "bg-green-500/10 text-green-400 border-green-500/30",
  failed: "bg-red-500/10 text-red-400 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export default function PushNotifications() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blank());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const { profile } = useAuth();

  const pageItems = campaigns.slice(page * pageSize, (page + 1) * pageSize);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("push_campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const titleLen = form.title.length;
  const bodyLen = form.body.length;

  async function createDraft() {
    if (!form.title.trim() || !form.body.trim()) return void toast.error("Title and message are required");
    if (titleLen > 65) return void toast.error("Title must be 65 characters or less");
    if (bodyLen > 240) return void toast.error("Message must be 240 characters or less");
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title, body: form.body,
        deep_link: form.deep_link || null,
        target_type: form.target_type,
        status: "draft",
        created_by: profile?.id,
      };
      if (form.image_url) payload.image_url = form.image_url;
      let result = await supabase.from("push_campaigns").insert(payload).select().single();
      if (result.error?.code === "42703" && form.image_url) {
        delete payload.image_url;
        result = await supabase.from("push_campaigns").insert(payload).select().single();
      }
      const { data, error } = result;
      if (error) throw error;
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: "Created push campaign",
        entity_type: "push_campaign", entity_id: data.id,
        details: { title: form.title, target: form.target_type },
      }).then(() => {}, () => {});
      toast.success("Campaign created as Draft — click Send Now to deliver it");
      setDialogOpen(false);
      setForm(blank());
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function sendCampaign(campaign: Campaign) {
    setSendingId(campaign.id);
    try {
      await supabase.from("push_campaigns").update({ status: "sending" }).eq("id", campaign.id);

      // ── Step 1: fetch ALL users in target audience (for in-app notifications) ──
      let allQuery = supabase.from("profiles").select("id, push_token").eq("is_active", true);
      if (campaign.target_type === "premium") {
        allQuery = allQuery.eq("subscription_tier", "premium");
      } else if (campaign.target_type === "free") {
        allQuery = allQuery.neq("subscription_tier", "premium");
      }
      const { data: allProfiles, error: profilesErr } = await allQuery;
      if (profilesErr) throw profilesErr;

      const allUsers = allProfiles ?? [];

      // ── Step 2: filter only those with valid Expo push tokens ──
      const validProfiles = allUsers.filter(
        (p: any) => typeof p.push_token === "string" && p.push_token.startsWith("ExponentPushToken")
      );
      const tokens = validProfiles.map((p: any) => p.push_token as string);

      // ── Step 3: send Expo push notifications (if any tokens exist) ──
      let successCount = 0;
      if (tokens.length > 0) {
        const CHUNK = 100;
        for (let i = 0; i < tokens.length; i += CHUNK) {
          const chunk = tokens.slice(i, i + CHUNK);
          const messages = chunk.map((token: string) => ({
            to: token,
            title: campaign.title,
            body: campaign.body,
            data: {
              ...(campaign.deep_link ? { url: campaign.deep_link } : {}),
              ...(campaign.image_url ? { image_url: campaign.image_url } : {}),
            },
            sound: "default",
          }));
          const res = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(messages),
          });
          const json = await res.json();
          const chunkSuccesses = (json.data ?? []).filter((r: any) => r.status === "ok").length;
          successCount += chunkSuccesses;
        }
      }

      // ── Step 4: always insert in-app notifications for ALL targeted users ──
      const allUserIds = allUsers.map((p: any) => p.id as string);
      if (allUserIds.length > 0) {
        const notifRows = allUserIds.map((uid: string) => ({
          user_id: uid,
          title: campaign.title,
          body: campaign.body,
          type: "general",
          is_read: false,
          action_type: campaign.deep_link ? "deeplink" : null,
          action_payload: {
            ...(campaign.deep_link ? { url: campaign.deep_link } : {}),
            ...(campaign.image_url ? { image_url: campaign.image_url } : {}),
          },
        }));
        for (let i = 0; i < notifRows.length; i += 500) {
          await supabase.from("notifications").insert(notifRows.slice(i, i + 500));
        }
      }

      await supabase.from("push_campaigns").update({
        status: "sent",
        sent_count: successCount,
        sent_at: new Date().toISOString(),
      }).eq("id", campaign.id);

      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id, action: "Sent push campaign",
        entity_type: "push_campaign", entity_id: campaign.id,
        details: { title: campaign.title, sent_count: successCount, in_app_count: allUserIds.length },
      }).then(() => {}, () => {});

      if (tokens.length === 0) {
        toast.success(
          allUserIds.length > 0
            ? `In-app notification sent to ${allUserIds.length} user${allUserIds.length !== 1 ? "s" : ""} (no push tokens registered yet)`
            : "No users found for this audience"
        );
      } else {
        toast.success(`Push: ${successCount} device${successCount !== 1 ? "s" : ""} • In-app: ${allUserIds.length} user${allUserIds.length !== 1 ? "s" : ""}`);
      }
      load();
    } catch (err: unknown) {
      await supabase.from("push_campaigns").update({ status: "failed" }).eq("id", campaign.id);
      toast.error("Failed to send: " + (err as Error).message);
      load();
    } finally {
      setSendingId(null);
    }
  }

  async function cancelCampaign(id: string) {
    await supabase.from("push_campaigns").update({ status: "cancelled" }).eq("id", id);
    toast.success("Campaign cancelled");
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />Push Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{campaigns.filter(c => c.status === "sent").length} campaigns sent</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead><TableHead>Target</TableHead><TableHead>Status</TableHead>
              <TableHead>Sent</TableHead><TableHead>Date</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>
            )) : campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No campaigns yet</TableCell></TableRow>
            ) : pageItems.map(c => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {c.image_url && (
                      <img src={c.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    )}
                    <div>
                      <div className="font-medium text-sm">{c.title}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[220px]">{c.body}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-xs capitalize">{c.target_type}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge></TableCell>
                <TableCell className="text-sm">{c.sent_count != null ? c.sent_count.toLocaleString() : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.sent_at ? formatDateTime(c.sent_at) : c.scheduled_at ? formatDateTime(c.scheduled_at) : formatDateTime(c.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {c.status === "draft" && (
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={sendingId === c.id}
                        onClick={() => sendCampaign(c)}
                      >
                        {sendingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Send Now
                      </Button>
                    )}
                    {(c.status === "draft" || c.status === "scheduled") && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelCampaign(c.id)}>Cancel</Button>
                    )}
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
        total={campaigns.length}
        onPageChange={setPage}
        onPageSizeChange={s => { setPageSize(s); setPage(0); }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" />New Push Campaign</DialogTitle>
            <DialogDescription>Create a push notification for your users.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Title *</Label>
                <span className={`text-xs ${titleLen > 55 ? titleLen > 65 ? "text-destructive" : "text-yellow-400" : "text-muted-foreground"}`}>{titleLen}/65</span>
              </div>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Notification title" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Message *</Label>
                <span className={`text-xs ${bodyLen > 200 ? bodyLen > 240 ? "text-destructive" : "text-yellow-400" : "text-muted-foreground"}`}>{bodyLen}/240</span>
              </div>
              <Textarea rows={3} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Notification message" />
            </div>
            <ImageUpload
              value={form.image_url}
              onChange={url => setForm(f => ({ ...f, image_url: url }))}
              label="Image (optional)"
              folder="push-campaigns"
              shape="banner"
              placeholder="Upload or paste image URL"
            />
            <div className="space-y-1">
              <Label>Deep Link (optional)</Label>
              <Input value={form.deep_link} onChange={e => setForm(f => ({ ...f, deep_link: e.target.value }))} placeholder="stayguided://screen/journey" />
            </div>
            <div className="space-y-1">
              <Label>Target Audience</Label>
              <Select value={form.target_type} onValueChange={v => setForm(f => ({ ...f, target_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="free">Free Users</SelectItem>
                  <SelectItem value="premium">Premium Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.title || form.body) && (
              <div className="bg-muted/40 rounded-xl p-3 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Preview</p>
                {form.image_url && (
                  <div className="mb-2 rounded-lg overflow-hidden">
                    <img src={form.image_url} alt="Campaign" className="w-full h-24 object-cover" />
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">🕌</div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{form.title || "Title"}</p>
                    <p className="text-xs text-muted-foreground">{form.body || "Message"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={createDraft} disabled={saving}>{saving ? "Saving…" : "Create Draft"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
