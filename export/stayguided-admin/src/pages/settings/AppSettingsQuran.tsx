import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, Save, AlertTriangle } from "lucide-react";

type S = Record<string, string>;

const RECITERS = [
  { id: "ar.alafasy", name: "Mishary Al-Afasy" },
  { id: "ar.abdulbasitmurattal", name: "Abdul Basit (Murattal)" },
  { id: "ar.saoodshuraym", name: "Saad Al-Ghamdi" },
  { id: "ar.shaatree", name: "Abu Bakr Al-Shatri" },
  { id: "ar.yasserdossari", name: "Yasser Al-Dosari" },
];

const TRANSLATIONS = [
  { id: "en.asad", name: "Muhammad Asad (English)" },
  { id: "en.sahih", name: "Sahih International (English)" },
  { id: "en.pickthall", name: "Pickthall (English)" },
  { id: "ur.maududi", name: "Maududi (Urdu)" },
  { id: "fr.hamidullah", name: "Hamidullah (French)" },
  { id: "tr.diyanet", name: "Diyanet (Turkish)" },
];

export default function AppSettingsQuran() {
  const [s, setS] = useState<S>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile, isAtLeast } = useAuth();
  const canEdit = isAtLeast("super_admin");

  const keys = ["default_reciter","default_translation","show_arabic_default","show_translation_default","quran_streaming_quality","quran_download_quality"];

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
      const boolKeys = ["show_arabic_default","show_translation_default"];
      const upserts = keys.map(key => ({
        key,
        value: s[key] ?? "",
        type: boolKeys.includes(key) ? "boolean" as const : "string" as const,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
      }));
      const { error } = await supabase.from("app_settings").upsert(upserts);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: "Updated Qur'an settings", entity_type: "app_settings" }).then(() => {}, () => {});
      toast.success("Settings saved — app will update within 30 minutes");
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" />Qur'an Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Default Qur'an playback and display settings.</p>
      </div>
      {!canEdit && <Card className="border-yellow-500/30 bg-yellow-500/5 p-4"><div className="flex items-center gap-2 text-yellow-400 text-sm"><AlertTriangle className="h-4 w-4" />Super admin only.</div></Card>}

      <Card>
        <CardHeader><CardTitle className="text-sm">Default Reciter & Translation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Default Reciter</Label>
            <Select disabled={!canEdit} value={s["default_reciter"] || "ar.alafasy"} onValueChange={v => setS(x => ({ ...x, default_reciter: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RECITERS.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Default Translation</Label>
            <Select disabled={!canEdit} value={s["default_translation"] || "en.asad"} onValueChange={v => setS(x => ({ ...x, default_translation: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TRANSLATIONS.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Display Defaults</CardTitle></CardHeader>
        <CardContent className="space-y-0 divide-y divide-border">
          {[
            { key: "show_arabic_default", label: "Show Arabic Text by Default", desc: "Display Arabic Qur'anic text on surah pages" },
            { key: "show_translation_default", label: "Show Translation by Default", desc: "Display translation alongside Arabic text" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
              <Switch disabled={!canEdit} checked={s[key] === "true"} onCheckedChange={v => setS(x => ({ ...x, [key]: String(v) }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Audio Quality</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[
            { key: "quran_streaming_quality", label: "Streaming Quality", options: ["64kbps","128kbps","192kbps","320kbps"] },
            { key: "quran_download_quality", label: "Download Quality", options: ["128kbps","192kbps","320kbps"] },
          ].map(({ key, label, options }) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <Select disabled={!canEdit} value={s[key] || options[1]} onValueChange={v => setS(x => ({ ...x, [key]: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={saveAll} disabled={saving || !canEdit}><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save Settings"}</Button>
    </div>
  );
}
