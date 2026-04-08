import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Share2, Save, AlertTriangle } from "lucide-react";

type S = Record<string, string>;

export default function ReferralSettings() {
  const [s, setS] = useState<S>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile, isAtLeast } = useAuth();
  const canEdit = isAtLeast("super_admin");

  const keys = ["referral_enabled","referral_code_prefix","max_referrals_per_user","referrer_xp_reward","referred_xp_reward"];

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
      const upserts = keys.map(key => ({
        key,
        value: s[key] ?? "",
        type: key === "referral_enabled" ? "boolean" : key === "referral_code_prefix" ? "string" : "number",
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
      }));
      const { error } = await supabase.from("app_settings").upsert(upserts);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: "Updated referral settings", entity_type: "app_settings" }).then(() => {}, () => {});
      toast.success("Referral settings saved — app will update within 30 minutes");
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  const prefix = s["referral_code_prefix"] || "SG";
  const exampleCode = `${prefix}A3F7D2`;

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><Share2 className="h-6 w-6 text-primary" />Referral System</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure the referral program and reward amounts.</p>
      </div>
      {!canEdit && <Card className="border-yellow-500/30 bg-yellow-500/5 p-4"><div className="flex items-center gap-2 text-yellow-400 text-sm"><AlertTriangle className="h-4 w-4" />Super admin only.</div></Card>}

      <Card>
        <CardHeader><CardTitle className="text-sm">Program Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Enable Referral Program</p><p className="text-xs text-muted-foreground">Users can share their referral codes to earn XP</p></div>
            <Switch disabled={!canEdit} checked={s["referral_enabled"] === "true"} onCheckedChange={v => setS(x => ({ ...x, referral_enabled: String(v) }))} />
          </div>
          <div className="space-y-1">
            <Label>Referral Code Prefix</Label>
            <p className="text-xs text-muted-foreground">Prepended to each user's referral code. Example: <code className="text-primary font-mono">{exampleCode}</code></p>
            <Input disabled={!canEdit} value={prefix} onChange={e => setS(x => ({ ...x, referral_code_prefix: e.target.value.toUpperCase() }))} className="w-24 font-mono uppercase" placeholder="SG" maxLength={4} />
          </div>
          <div className="space-y-1">
            <Label>Max Referrals Per User</Label>
            <p className="text-xs text-muted-foreground">Maximum number of successful referrals a single user can make (0 = unlimited)</p>
            <Input type="number" min={0} disabled={!canEdit} value={s["max_referrals_per_user"] ?? "50"} onChange={e => setS(x => ({ ...x, max_referrals_per_user: e.target.value }))} className="w-24" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">XP Rewards</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Referrer XP Reward</Label>
            <p className="text-xs text-muted-foreground">XP awarded to the user who shared their referral code</p>
            <Input type="number" min={0} disabled={!canEdit} value={s["referrer_xp_reward"] ?? "500"} onChange={e => setS(x => ({ ...x, referrer_xp_reward: e.target.value }))} className="w-32" />
          </div>
          <div className="space-y-1">
            <Label>Referred User XP Reward</Label>
            <p className="text-xs text-muted-foreground">XP awarded to the new user who entered the referral code</p>
            <Input type="number" min={0} disabled={!canEdit} value={s["referred_xp_reward"] ?? "100"} onChange={e => setS(x => ({ ...x, referred_xp_reward: e.target.value }))} className="w-32" />
          </div>
        </CardContent>
      </Card>

      <div className="bg-muted/30 rounded-xl p-4 text-sm">
        <p className="font-medium text-foreground mb-1">Referral Code Format</p>
        <code className="text-xs font-mono text-primary">{prefix} + first 6 uppercase hex characters of user UUID</code>
        <p className="text-xs text-muted-foreground mt-1">Example: User with UUID <code className="font-mono">a3f7d2...</code> gets code <code className="font-mono text-primary">{exampleCode}</code></p>
      </div>

      <Button onClick={saveAll} disabled={saving || !canEdit}><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save Settings"}</Button>
    </div>
  );
}
