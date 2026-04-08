import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CreditCard, Save, AlertTriangle, ToggleLeft, ToggleRight } from "lucide-react";

export default function SubscriptionPlans() {
  const [local, setLocal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const { profile, isAtLeast } = useAuth();

  const isSuperAdmin = isAtLeast("super_admin");

  const KEYS = [
    "subscription_enabled",
    "weekly_price_usd",
    "monthly_price_usd",
    "trial_days",
    "trial_enabled",
  ];

  const DEFAULTS: Record<string, string> = {
    subscription_enabled: "true",
    weekly_price_usd: "0.99",
    monthly_price_usd: "4.99",
    trial_days: "7",
    trial_enabled: "false",
  };

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("app_settings").select("key,value").in("key", KEYS);
    const loc: Record<string, string> = { ...DEFAULTS };
    (data || []).forEach((r: { key: string; value: string }) => {
      loc[r.key] = String(r.value ?? DEFAULTS[r.key] ?? "");
    });
    setLocal(loc);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveSetting(key: string) {
    if (!isSuperAdmin) return void toast.error("Super admin only");
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const val = local[key] ?? DEFAULTS[key] ?? "";
      const boolKeys = ["trial_enabled", "subscription_enabled"];
      const { error } = await supabase.from("app_settings").upsert({
        key,
        value: val,
        type: boolKeys.includes(key) ? "boolean" : "number",
        updated_by: profile?.id,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: `Updated setting: ${key}`,
        entity_type: "app_settings",
        entity_id: key,
        details: { value: val },
      }).then(() => {}, () => {});
      toast.success("Setting saved — auto-synced to mobile app");
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  }

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />Subscription Plans
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure pricing and trial settings. Changes auto-sync to the mobile app. Super admin only.</p>
      </div>

      {!isSuperAdmin && (
        <Card className="border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Subscription pricing requires super_admin role.</span>
          </div>
        </Card>
      )}

      {/* ── Subscription On / Off ───────────────────────── */}
      <Card className={`border-2 transition-colors ${local["subscription_enabled"] !== "false" ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {local["subscription_enabled"] !== "false"
                  ? <ToggleRight className="h-5 w-5 text-green-400" />
                  : <ToggleLeft className="h-5 w-5 text-destructive" />
                }
                <p className="text-base font-semibold">
                  Subscription {local["subscription_enabled"] !== "false" ? "Enabled" : "Disabled"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                {local["subscription_enabled"] !== "false"
                  ? "Paywall is active — users must subscribe to access premium content."
                  : 'Paywall is OFF — all content is freely accessible. Subscription page shows "Coming Soon".'
                }
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Switch
                disabled={!isSuperAdmin}
                checked={local["subscription_enabled"] !== "false"}
                onCheckedChange={v => setLocal(l => ({ ...l, subscription_enabled: String(v) }))}
              />
              <Button
                size="sm"
                variant={local["subscription_enabled"] !== "false" ? "default" : "destructive"}
                disabled={!isSuperAdmin || saving["subscription_enabled"]}
                onClick={() => saveSetting("subscription_enabled")}
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving["subscription_enabled"] ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "weekly_price_usd", label: "Weekly Price (USD)", step: "0.01" },
            { key: "monthly_price_usd", label: "Monthly Price (USD)", step: "0.01" },
          ].map(({ key, label, step }) => (
            <div key={key} className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label>{label}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step={step}
                    disabled={!isSuperAdmin}
                    value={local[key] ?? ""}
                    onChange={e => setLocal(l => ({ ...l, [key]: e.target.value }))}
                    className="pl-7"
                  />
                </div>
              </div>
              <Button size="sm" disabled={!isSuperAdmin || saving[key]} onClick={() => saveSetting(key)}>
                <Save className="h-4 w-4 mr-1" />{saving[key] ? "Saving…" : "Save"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Free Trial</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Free Trial</p>
              <p className="text-xs text-muted-foreground">New users get a trial period before subscribing</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                disabled={!isSuperAdmin}
                checked={local["trial_enabled"] === "true"}
                onCheckedChange={v => { setLocal(l => ({ ...l, trial_enabled: String(v) })); }}
              />
              <Button size="sm" variant="outline" disabled={!isSuperAdmin || saving["trial_enabled"]} onClick={() => saveSetting("trial_enabled")}>
                Save
              </Button>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label>Trial Duration (days)</Label>
              <Input
                type="number" min={1} max={90}
                disabled={!isSuperAdmin}
                value={local["trial_days"] ?? "7"}
                onChange={e => setLocal(l => ({ ...l, trial_days: e.target.value }))}
              />
            </div>
            <Button size="sm" disabled={!isSuperAdmin || saving["trial_days"]} onClick={() => saveSetting("trial_days")}>
              <Save className="h-4 w-4 mr-1" />Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
