import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Palette, Save, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type S = Record<string, string>;

export default function AppSettingsAppearance() {
  const [s, setS] = useState<S>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile, isAtLeast } = useAuth();
  const canEdit = isAtLeast("super_admin");

  const keys = ["app_name","maintenance_mode","maintenance_message","force_update_version","ramadan_mode"];

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
      const boolKeys = ["maintenance_mode","ramadan_mode"];
      const upserts = keys.map(key => ({
        key,
        value: s[key] ?? "",
        type: boolKeys.includes(key) ? "boolean" as const : "string" as const,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
      }));
      const { error } = await supabase.from("app_settings").upsert(upserts);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: "Updated appearance settings", entity_type: "app_settings" }).then(() => {}, () => {});
      toast.success("Settings saved — changes auto-sync to the mobile app");
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>;

  const isMaintenance = s["maintenance_mode"] === "true";
  const isRamadan = s["ramadan_mode"] === "true";

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><Palette className="h-6 w-6 text-primary" />Appearance & Maintenance</h1>
        <p className="text-sm text-muted-foreground mt-1">App branding, maintenance mode, and seasonal settings.</p>
      </div>
      {!canEdit && <Card className="border-yellow-500/30 bg-yellow-500/5 p-4"><div className="flex items-center gap-2 text-yellow-400 text-sm"><AlertTriangle className="h-4 w-4" />Super admin only.</div></Card>}

      {isMaintenance && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /><span className="text-sm font-medium">Maintenance mode is ACTIVE — users cannot access the app</span></div>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">App Branding</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>App Display Name</Label>
            <Input disabled={!canEdit} value={s["app_name"] || ""} onChange={e => setS(x => ({ ...x, app_name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Force Update Minimum Version</Label>
            <p className="text-xs text-muted-foreground">Users on versions below this will be forced to update. Set to "0" to disable.</p>
            <Input disabled={!canEdit} value={s["force_update_version"] || "0"} onChange={e => setS(x => ({ ...x, force_update_version: e.target.value }))} className="w-32" placeholder="1.2.0" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center justify-between">
          Maintenance Mode
          {isMaintenance && <Badge variant="destructive">Active</Badge>}
        </CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">Shows maintenance screen to all users except admins</p>
            </div>
            <Switch disabled={!canEdit} checked={isMaintenance} onCheckedChange={v => setS(x => ({ ...x, maintenance_mode: String(v) }))} />
          </div>
          <div className="space-y-1">
            <Label>Maintenance Message</Label>
            <Textarea rows={2} disabled={!canEdit} value={s["maintenance_message"] || ""} onChange={e => setS(x => ({ ...x, maintenance_message: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center justify-between">
          Seasonal Features
          {isRamadan && <Badge variant="outline" className="text-purple-400 border-purple-400/30">🌙 Ramadan Active</Badge>}
        </CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Ramadan Mode 🌙</p>
              <p className="text-xs text-muted-foreground">Enables Ramadan countdown, special UI themes, and curated Ramadan content</p>
            </div>
            <Switch disabled={!canEdit} checked={isRamadan} onCheckedChange={v => setS(x => ({ ...x, ramadan_mode: String(v) }))} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveAll} disabled={saving || !canEdit}><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save Settings"}</Button>
    </div>
  );
}
