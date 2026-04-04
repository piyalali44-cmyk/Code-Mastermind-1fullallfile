import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { UserX, Save, AlertTriangle } from "lucide-react";

type S = Record<string, string>;

export default function AppSettingsGuest() {
  const [s, setS] = useState<S>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile, isAtLeast } = useAuth();
  const canEdit = isAtLeast("super_admin");

  const keys = ["guest_can_listen","guest_can_browse","guest_episode_limit","guest_prompt_register"];

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("app_settings").select("key,value").in("key", keys);
    const map: S = {};
    (data || []).forEach((r: { key: string; value: unknown }) => {
      const v = r.value;
      map[r.key] = typeof v === "string" ? v.replace(/^"|"$/g, "") : String(v);
    });
    setS(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveAll() {
    if (!canEdit) return void toast.error("Super admin only");
    setSaving(true);
    try {
      const boolKeys = ["guest_can_listen","guest_can_browse","guest_prompt_register"];
      const upserts = keys.map(key => ({
        key,
        value: s[key] ?? "",
        type: boolKeys.includes(key) ? "boolean" as const : "number" as const,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
      }));
      const { error } = await supabase.from("app_settings").upsert(upserts);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: "Updated guest access settings", entity_type: "app_settings" }).then(() => {}, () => {});
      toast.success("Settings saved — app will update within 30 minutes");
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><UserX className="h-6 w-6 text-primary" />Guest & Access Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Control what unauthenticated users can do in the app.</p>
      </div>
      {!canEdit && <Card className="border-yellow-500/30 bg-yellow-500/5 p-4"><div className="flex items-center gap-2 text-yellow-400 text-sm"><AlertTriangle className="h-4 w-4" />Super admin only.</div></Card>}
      <Card>
        <CardHeader><CardTitle className="text-sm">Guest User Permissions</CardTitle></CardHeader>
        <CardContent className="space-y-4 divide-y divide-border">
          {[
            { key: "guest_can_browse", label: "Allow Guest Browsing", desc: "Guests can browse content without signing up" },
            { key: "guest_can_listen", label: "Allow Guest Listening", desc: "Guests can play audio content" },
            { key: "guest_prompt_register", label: "Prompt Registration", desc: "Show sign-up prompt when guest limit is reached" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch disabled={!canEdit} checked={s[key] === "true"} onCheckedChange={v => setS(x => ({ ...x, [key]: String(v) }))} />
            </div>
          ))}
          <div className="flex items-end gap-3 pt-3">
            <div className="flex-1 space-y-1">
              <Label>Episode Limit for Guests</Label>
              <p className="text-xs text-muted-foreground">Max number of episodes a guest can play per session</p>
              <Input type="number" min={0} max={100} disabled={!canEdit} value={s["guest_episode_limit"] || "3"} onChange={e => setS(x => ({ ...x, guest_episode_limit: e.target.value }))} className="w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Button onClick={saveAll} disabled={saving || !canEdit}><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save Settings"}</Button>
    </div>
  );
}
