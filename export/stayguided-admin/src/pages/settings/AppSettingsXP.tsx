import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star, Save, AlertTriangle } from "lucide-react";

type S = Record<string, string>;

const XP_GROUPS = [
  {
    title: "Content XP",
    desc: "XP awarded for completing content",
    fields: [
      { key: "xp_per_episode", label: "XP per Episode Completed", desc: "Awarded when user finishes an audio episode" },
      { key: "xp_per_surah", label: "XP per Surah Completed", desc: "Awarded when user finishes listening to a surah" },
      { key: "xp_per_hadith", label: "XP per Hadith Read", desc: "Awarded when user reads/bookmarks a hadith" },
      { key: "xp_per_journey_chapter", label: "XP per Journey Chapter", desc: "Awarded when user completes a journey chapter" },
    ],
  },
  {
    title: "Engagement XP",
    desc: "XP for daily engagement and streaks",
    fields: [
      { key: "xp_daily_login", label: "XP for Daily Login", desc: "Awarded once per day for opening the app" },
      { key: "xp_streak_multiplier", label: "Streak XP Multiplier", desc: "Bonus multiplier when streak is active (e.g. 1.5 = 50% bonus)" },
      { key: "streak_grace_hours", label: "Streak Grace Period (hours)", desc: "Hours of inactivity before a streak breaks (default: 24)" },
    ],
  },
  {
    title: "Gamification XP",
    desc: "XP for quizzes and achievements",
    fields: [
      { key: "xp_per_quiz_completed", label: "XP per Quiz Completed", desc: "Awarded when user completes any quiz (regardless of score)" },
      { key: "xp_per_quiz_correct", label: "XP per Correct Answer", desc: "Bonus XP for each correct answer in a quiz" },
    ],
  },
  {
    title: "Social XP",
    desc: "XP for referrals and social actions",
    fields: [
      { key: "referrer_xp_reward", label: "Referrer XP Reward", desc: "XP given to the user whose referral code was used" },
      { key: "referred_xp_reward", label: "New User Referral XP", desc: "XP given to the new user who entered a referral code" },
    ],
  },
  {
    title: "Level Configuration",
    desc: "Configure how levels work",
    fields: [
      { key: "xp_per_level", label: "XP Required per Level", desc: "XP needed to advance each level (default: 500). Level = floor(total_xp / this_value) + 1" },
      { key: "max_level", label: "Maximum Level", desc: "Cap for the highest achievable level (0 = no cap)" },
    ],
  },
];

const ALL_XP_FIELDS = XP_GROUPS.flatMap(g => g.fields);

export default function AppSettingsXP() {
  const [s, setS] = useState<S>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile, isAtLeast } = useAuth();
  const canEdit = isAtLeast("super_admin");

  const keys = ALL_XP_FIELDS.map(f => f.key);

  const DEFAULTS: Record<string, string> = {
    xp_per_episode: "10", xp_per_surah: "15", xp_per_hadith: "5",
    xp_per_journey_chapter: "20", xp_daily_login: "5",
    xp_streak_multiplier: "1.5", streak_grace_hours: "24",
    xp_per_quiz_completed: "25", xp_per_quiz_correct: "5",
    referrer_xp_reward: "50", referred_xp_reward: "25",
    xp_per_level: "500", max_level: "0",
  };

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("app_settings").select("key,value").in("key", keys);
    const map: S = { ...DEFAULTS };
    (data || []).forEach((r: { key: string; value: unknown }) => {
      map[r.key] = String(r.value).replace(/^"|"$/g, "");
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
        value: s[key] ?? DEFAULTS[key] ?? "0",
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
      }));
      const { error } = await supabase.from("app_settings").upsert(upserts, { onConflict: "key" });
      if (error) throw error;
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: "Updated XP & Streak settings", entity_type: "app_settings" }).then(() => {}, () => {});
      toast.success("XP settings saved successfully");
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  const xpPerLevel = parseInt(s["xp_per_level"] || "500") || 500;

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><Star className="h-6 w-6 text-primary" />XP & Streaks</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure XP rewards, streak mechanics, and level progression.</p>
        </div>
        <Button onClick={saveAll} disabled={saving || !canEdit} className="gap-2 shrink-0">
          <Save className="h-4 w-4" />{saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>

      {!canEdit && (
        <Card className="border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 text-yellow-400 text-sm"><AlertTriangle className="h-4 w-4" />Super admin only. Contact your super admin to change XP settings.</div>
        </Card>
      )}

      {XP_GROUPS.map(group => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{group.desc}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.fields.map(({ key, label, desc }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-sm">{label}</Label>
                  <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
                  <Input
                    type="number" step="0.1" min={0}
                    disabled={!canEdit}
                    value={s[key] ?? DEFAULTS[key] ?? ""}
                    onChange={e => setS(x => ({ ...x, [key]: e.target.value }))}
                    className="w-28"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-semibold text-foreground">Level Formula</p>
        <code className="text-xs font-mono text-primary block">Level = floor(total_xp / {xpPerLevel}) + 1</code>
        <p className="text-xs">With current settings: Level 1 = 0–{xpPerLevel - 1} XP · Level 2 = {xpPerLevel}–{xpPerLevel * 2 - 1} XP · Level 10 = {xpPerLevel * 9}+ XP</p>
      </div>
    </div>
  );
}
