import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Flag, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeatureFlag {
  id: string; key: string; name: string; description: string | null;
  section: string; is_enabled: boolean; rollout_pct: number;
}

const SECTION_COLORS: Record<string, string> = {
  content: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  quran: "bg-green-500/10 text-green-400 border-green-500/30",
  gamification: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  growth: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  notifications: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  premium: "bg-primary/10 text-primary border-primary/30",
  appearance: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  access: "bg-red-500/10 text-red-400 border-red-500/30",
  monetization: "bg-green-500/10 text-green-400 border-green-500/30",
  seasonal: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  analytics: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  general: "bg-muted text-muted-foreground",
};

export default function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("feature_flags").select("*").order("section").order("name");
    setFlags(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggle(flag: FeatureFlag) {
    setSaving(s => ({ ...s, [flag.id]: true }));
    try {
      const newVal = !flag.is_enabled;
      const { error } = await supabase.from("feature_flags").update({ is_enabled: newVal, updated_at: new Date().toISOString() }).eq("id", flag.id);
      if (error) throw error;
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, is_enabled: newVal } : f));
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: `${newVal ? "Enabled" : "Disabled"} feature flag: ${flag.key}`, entity_type: "feature_flag", entity_id: flag.id }).then(() => {}, () => {});
      toast.success(`${flag.name} ${newVal ? "enabled" : "disabled"}`);
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(s => ({ ...s, [flag.id]: false })); }
  }

  async function updateRollout(flag: FeatureFlag, pct: number) {
    setSaving(s => ({ ...s, [flag.id]: true }));
    try {
      const { error } = await supabase.from("feature_flags").update({ rollout_pct: pct, updated_at: new Date().toISOString() }).eq("id", flag.id);
      if (error) throw error;
      setFlags(flags.map(f => f.id === flag.id ? { ...f, rollout_pct: pct } : f));
      toast.success("Rollout percentage updated");
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(s => ({ ...s, [flag.id]: false })); }
  }

  const sections = [...new Set(flags.map(f => f.section))];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Flag className="h-6 w-6 text-primary" />Feature Flags
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {flags.filter(f => f.is_enabled).length} of {flags.length} features enabled
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
      ) : sections.map(section => (
        <Card key={section}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge variant="outline" className={SECTION_COLORS[section] || SECTION_COLORS.general}>{section}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border">
            {flags.filter(f => f.section === section).map(flag => (
              <div key={flag.id} className="flex items-center justify-between py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{flag.name}</p>
                    {!flag.is_enabled && <span className="text-xs text-muted-foreground">(off)</span>}
                  </div>
                  {flag.description && <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>}
                  <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">{flag.key}</p>
                </div>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  {flag.is_enabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-8 text-right">{flag.rollout_pct}%</span>
                      <Input
                        type="number" min={0} max={100}
                        value={flag.rollout_pct}
                        onChange={e => updateRollout(flag, parseInt(e.target.value) || 0)}
                        className="w-16 h-7 text-xs text-center"
                      />
                    </div>
                  )}
                  <Switch
                    checked={flag.is_enabled}
                    onCheckedChange={() => toggle(flag)}
                    disabled={saving[flag.id]}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
