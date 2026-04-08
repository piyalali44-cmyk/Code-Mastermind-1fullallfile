import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Download, Save, AlertTriangle } from "lucide-react";

type S = Record<string, string>;

export default function AppSettingsDownloads() {
  const [s, setS] = useState<S>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile, isAtLeast } = useAuth();
  const canEdit = isAtLeast("super_admin");

  const keys = ["max_downloads_free","max_downloads_premium","download_wifi_only_default","download_expiry_days"];

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("app_settings").select("key,value").in("key", keys);
    const map: S = {};
    (data || []).forEach((r: { key: string; value: unknown }) => {
      map[r.key] = String(r.value);
    });
    setS(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveAll() {
    if (!canEdit) return void toast.error("Super admin only");
    setSaving(true);
    try {
      const boolKeys = ["download_wifi_only_default"];
      const upserts = keys.map(key => ({
        key,
        value: s[key] ?? "",
        type: boolKeys.includes(key) ? "boolean" as const : "number" as const,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
      }));
      const { error } = await supabase.from("app_settings").upsert(upserts);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: "Updated download settings", entity_type: "app_settings" }).then(() => {}, () => {});
      toast.success("Settings saved — app will update within 30 minutes");
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><Download className="h-6 w-6 text-primary" />Downloads & Playback</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure offline download limits and default settings.</p>
      </div>
      {!canEdit && <Card className="border-yellow-500/30 bg-yellow-500/5 p-4"><div className="flex items-center gap-2 text-yellow-400 text-sm"><AlertTriangle className="h-4 w-4" />Super admin only.</div></Card>}

      <Card>
        <CardHeader><CardTitle className="text-sm">Download Limits</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "max_downloads_free", label: "Max Downloads — Free Users", desc: "Maximum episodes a free user can download", min: 0 },
            { key: "max_downloads_premium", label: "Max Downloads — Premium Users", desc: "Maximum episodes a premium user can download", min: 1 },
            { key: "download_expiry_days", label: "Download Expiry (days)", desc: "How long downloaded content remains available before expiring", min: 1 },
          ].map(({ key, label, desc, min }) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <p className="text-xs text-muted-foreground">{desc}</p>
              <Input type="number" min={min} disabled={!canEdit} value={s[key] ?? ""} onChange={e => setS(x => ({ ...x, [key]: e.target.value }))} className="w-32" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Default Settings</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Wi-Fi Only Downloads by Default</p>
              <p className="text-xs text-muted-foreground">New users will have this setting enabled by default</p>
            </div>
            <Switch disabled={!canEdit} checked={s["download_wifi_only_default"] === "true"} onCheckedChange={v => setS(x => ({ ...x, download_wifi_only_default: String(v) }))} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveAll} disabled={saving || !canEdit}><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save Settings"}</Button>
    </div>
  );
}
