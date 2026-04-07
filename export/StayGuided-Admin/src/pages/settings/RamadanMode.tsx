import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Moon, Save, AlertTriangle, RefreshCw, CheckCircle2,
  Zap, Star, Gift, Heart,
} from "lucide-react";

interface FlagRow { id: string; key: string; is_enabled: boolean; }

export default function RamadanMode() {
  const [ramadanOn, setRamadanOn]       = useState(false);
  const [donationOn, setDonationOn]     = useState(false);
  const [donationFlag, setDonationFlag] = useState<FlagRow | null>(null);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  const { profile, isAtLeast } = useAuth();
  const canEdit = isAtLeast("admin");

  async function load() {
    setLoading(true);
    try {
      const [appRes, flagRes] = await Promise.all([
        supabase.from("app_settings").select("key,value").eq("key", "ramadan_mode").single(),
        supabase.from("feature_flags").select("id,key,is_enabled").eq("key", "donation_banner").single(),
      ]);

      if (appRes.data) {
        const v = appRes.data.value;
        const str = typeof v === "string" ? v.replace(/^"|"$/g, "") : String(v ?? "");
        setRamadanOn(str === "true");
      }

      if (flagRes.data) {
        setDonationFlag(flagRes.data as FlagRow);
        setDonationOn(flagRes.data.is_enabled);
      } else {
        // Row doesn't exist yet — create it
        const { data: inserted } = await supabase
          .from("feature_flags")
          .upsert({ key: "donation_banner", name: "Donation Banner", description: "Show donation banner on home screen", section: "seasonal", is_enabled: false, rollout_pct: 100 })
          .select("id,key,is_enabled")
          .single();
        if (inserted) {
          setDonationFlag(inserted as FlagRow);
          setDonationOn(inserted.is_enabled);
        }
      }
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!canEdit) return void toast.error("Admin access required");
    setSaving(true);
    try {
      await supabase.from("app_settings").upsert({
        key: "ramadan_mode",
        value: String(ramadanOn),
        type: "boolean",
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
      });

      if (donationFlag) {
        await supabase.from("feature_flags").update({
          is_enabled: donationOn,
          updated_at: new Date().toISOString(),
        }).eq("id", donationFlag.id);
      } else {
        await supabase.from("feature_flags").upsert({
          key: "donation_banner",
          name: "Donation Banner",
          description: "Show donation banner on home screen",
          section: "seasonal",
          is_enabled: donationOn,
          rollout_pct: 100,
        });
      }

      await supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: `Ramadan Mode ${ramadanOn ? "enabled" : "disabled"}, Donation Banner ${donationOn ? "enabled" : "disabled"}`,
        entity_type: "app_settings",
      });

      toast.success("Settings saved — changes auto-sync to the mobile app");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const features = [
    { icon: Moon,    label: "Ramadan countdown widget on home screen"            },
    { icon: Star,    label: "Islamic gold theme & crescent moon visual elements"  },
    { icon: Zap,     label: "Curated Ramadan audio content surfaced first"        },
    { icon: Gift,    label: "Ramadan-specific daily challenges & XP bonuses"      },
    { icon: Heart,   label: "Donation banner displayed on home screen (if enabled)" },
  ];

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Moon className="h-6 w-6 text-primary" />
            Ramadan Mode
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enable seasonal Ramadan features across the mobile app. Changes auto-sync instantly.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {ramadanOn && (
            <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 gap-1">
              <Moon className="h-3 w-3" /> Ramadan Active
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {!canEdit && (
        <Card className="border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Admin access required to change these settings.
          </div>
        </Card>
      )}

      {/* ── Ramadan Mode Toggle ──────────────────────────── */}
      <Card className={`border-2 transition-all ${
        ramadanOn
          ? "border-purple-500/40 bg-gradient-to-br from-purple-500/5 to-transparent"
          : "border-border"
      }`}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Moon className={`h-5 w-5 ${ramadanOn ? "text-purple-400" : "text-muted-foreground"}`} />
                <p className="text-base font-semibold">
                  Ramadan Mode{" "}
                  <span className={`text-sm font-normal ${ramadanOn ? "text-purple-400" : "text-muted-foreground"}`}>
                    {ramadanOn ? "— Enabled" : "— Disabled"}
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground ml-7">
                Activates all Ramadan-specific features in the mobile app instantly.
              </p>
            </div>
            <Switch
              disabled={!canEdit || loading}
              checked={ramadanOn}
              onCheckedChange={setRamadanOn}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── What Ramadan Mode enables ─────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            What Ramadan Mode Enables
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 py-2.5">
              <Icon className={`h-4 w-4 shrink-0 ${ramadanOn ? "text-purple-400" : "text-muted-foreground"}`} />
              <p className={`text-sm ${ramadanOn ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
              {ramadanOn && <CheckCircle2 className="h-3.5 w-3.5 text-green-400 ml-auto shrink-0" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Donation Banner Toggle ───────────────────────── */}
      <Card className={`border-2 transition-all ${
        donationOn
          ? "border-yellow-500/40 bg-gradient-to-br from-yellow-500/5 to-transparent"
          : "border-border"
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Heart className="h-4 w-4 text-yellow-400" />
            Donation Banner
            <Badge variant="outline" className="text-xs ml-auto">
              Feature Flag
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className={`text-sm font-medium ${donationOn ? "text-yellow-300" : "text-foreground"}`}>
                {donationOn ? "Banner is visible on home screen" : "Banner is hidden"}
              </p>
              <p className="text-xs text-muted-foreground">
                Shows a Ramadan donation call-to-action banner on the app home screen.
                Best enabled during Ramadan alongside Ramadan Mode.
              </p>
            </div>
            <Switch
              disabled={!canEdit || loading}
              checked={donationOn}
              onCheckedChange={setDonationOn}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Save Button ──────────────────────────────────── */}
      <Button
        onClick={save}
        disabled={saving || !canEdit || loading}
        className="w-full sm:w-auto"
        size="lg"
      >
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving…" : "Save All Settings"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Changes are applied in real-time — the mobile app updates within seconds without requiring an app restart.
      </p>
    </div>
  );
}
