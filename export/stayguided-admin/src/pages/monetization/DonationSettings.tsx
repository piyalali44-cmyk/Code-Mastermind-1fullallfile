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
import { Heart, Save } from "lucide-react";

type DSettings = Record<string, string>;

export default function DonationSettings() {
  const [settings, setSettings] = useState<DSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile } = useAuth();

  const keys = ["donation_enabled","donation_url","donation_message","show_in_profile","show_in_player"];

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("donation_settings").select("key,value").in("key", keys);
    const map: DSettings = {};
    (data || []).forEach((r: { key: string; value: unknown }) => {
      const raw = r.value;
      map[r.key] = typeof raw === "string" ? raw.replace(/^"|"$/g, "") : JSON.stringify(raw).replace(/^"|"$/g, "");
    });
    setSettings(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveAll() {
    setSaving(true);
    try {
      const upserts = keys.map(key => {
        const val = settings[key] ?? "";
        const isBool = ["donation_enabled","show_in_profile","show_in_player"].includes(key);
        return { key, value: isBool ? val === "true" : `"${val}"` };
      });
      const { error } = await supabase.from("donation_settings").upsert(upserts);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: "Updated donation settings", entity_type: "donation_settings" }).then(() => {}, () => {});
      toast.success("Donation settings saved — app will update within 30 minutes");
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  function set(key: string, val: string) { setSettings(s => ({ ...s, [key]: val })); }

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" />Donation Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure the optional donation feature.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Donation Feature</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Donation Feature</p>
              <p className="text-xs text-muted-foreground">Show donation option to users</p>
            </div>
            <Switch checked={settings["donation_enabled"] === "true"} onCheckedChange={v => set("donation_enabled", String(v))} />
          </div>
          <div className="space-y-1">
            <Label>Donation URL</Label>
            <Input value={settings["donation_url"] || ""} onChange={e => set("donation_url", e.target.value)} placeholder="https://www.launchgood.com/…" />
          </div>
          <div className="space-y-1">
            <Label>Donation Message</Label>
            <Textarea rows={2} value={settings["donation_message"] || ""} onChange={e => set("donation_message", e.target.value)} placeholder="Support Islamic content development" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Display Settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "show_in_profile", label: "Show in Profile tab", desc: "Display donation link on the user profile screen" },
            { key: "show_in_player", label: "Show in Player", desc: "Display donation link in the audio player" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch checked={settings[key] === "true"} onCheckedChange={v => set(key, String(v))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={saveAll} disabled={saving}>
        <Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save All Settings"}
      </Button>
    </div>
  );
}
