import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldAlert, Save, AlertTriangle, RefreshCw, Clock, Hash, Ban } from "lucide-react";

type S = Record<string, string>;

const KEYS = [
  "otp_rate_limit_enabled",
  "otp_max_attempts",
  "otp_window_minutes",
  "otp_block_duration_minutes",
];

interface AttemptLog {
  identifier: string;
  otp_type: string;
  attempted_at: string;
}

export default function RateLimiting() {
  const [s, setS] = useState<S>({
    otp_rate_limit_enabled: "true",
    otp_max_attempts: "5",
    otp_window_minutes: "60",
    otp_block_duration_minutes: "60",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<AttemptLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const { profile, isAtLeast } = useAuth();
  const canEdit = isAtLeast("super_admin");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", KEYS);
    const map: S = { ...s };
    (data || []).forEach((r: { key: string; value: unknown }) => {
      const v = r.value;
      map[r.key] = typeof v === "string" ? v.replace(/^"|"$/g, "") : String(v);
    });
    setS(map);
    setLoading(false);
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from("otp_rate_limit_log")
        .select("identifier, otp_type, attempted_at")
        .order("attempted_at", { ascending: false })
        .limit(20);
      if (error) {
        setLogs([]);
      } else {
        setLogs(data ?? []);
      }
    } catch {
      setLogs([]);
    }
    setLogsLoading(false);
  }

  useEffect(() => {
    load();
    loadLogs();
  }, []);

  async function saveAll() {
    if (!canEdit) return void toast.error("Super admin only");
    setSaving(true);
    try {
      const upserts = KEYS.map((key) => ({
        key,
        value: s[key] ?? "",
        type: key === "otp_rate_limit_enabled" ? "boolean" : "number",
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
      }));
      const { error } = await supabase.from("app_settings").upsert(upserts);
      if (error) throw error;
      supabase
        .from("admin_activity_log")
        .insert({
          admin_id: profile?.id,
          action: "Updated OTP rate limit settings",
          entity_type: "app_settings",
        })
        .then(() => {}, () => {});
      toast.success("Rate limit settings saved — takes effect within 5 minutes");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const maxAttempts = parseInt(s["otp_max_attempts"] ?? "5", 10) || 5;
  const windowMin = parseInt(s["otp_window_minutes"] ?? "60", 10) || 60;
  const blockMin = parseInt(s["otp_block_duration_minutes"] ?? "60", 10) || 60;
  const enabled = s["otp_rate_limit_enabled"] === "true";

  const windowLabel =
    windowMin < 60
      ? `${windowMin} min`
      : windowMin === 60
      ? "1 hr"
      : `${windowMin / 60} hrs`;

  if (loading)
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-primary" />
          OTP Rate Limiting
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control how many OTP requests a user can make within a given time window.
        </p>
      </div>

      {!canEdit && (
        <Card className="border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 text-yellow-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Super admin only — only super admins can change these settings.
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Rate Limit Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable Rate Limiting</p>
              <p className="text-xs text-muted-foreground">
                Enforce OTP send limits to prevent abuse
              </p>
            </div>
            <Switch
              disabled={!canEdit}
              checked={enabled}
              onCheckedChange={(v) =>
                setS((x) => ({ ...x, otp_rate_limit_enabled: String(v) }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                Max Attempts
              </Label>
              <p className="text-xs text-muted-foreground">
                Maximum OTPs allowed per time window
              </p>
              <Input
                type="number"
                min={1}
                max={100}
                disabled={!canEdit}
                value={s["otp_max_attempts"] ?? "5"}
                onChange={(e) =>
                  setS((x) => ({ ...x, otp_max_attempts: e.target.value }))
                }
                className="w-24"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Window Duration (min)
              </Label>
              <p className="text-xs text-muted-foreground">
                Time window over which attempts are counted
              </p>
              <Input
                type="number"
                min={1}
                max={10080}
                disabled={!canEdit}
                value={s["otp_window_minutes"] ?? "60"}
                onChange={(e) =>
                  setS((x) => ({ ...x, otp_window_minutes: e.target.value }))
                }
                className="w-24"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                Block Duration (min)
              </Label>
              <p className="text-xs text-muted-foreground">
                How long users are blocked after exceeding the limit
              </p>
              <Input
                type="number"
                min={1}
                max={10080}
                disabled={!canEdit}
                value={s["otp_block_duration_minutes"] ?? "60"}
                onChange={(e) =>
                  setS((x) => ({
                    ...x,
                    otp_block_duration_minutes: e.target.value,
                  }))
                }
                className="w-24"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardContent className="pt-5">
          <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Active Rule Summary
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge
                variant="outline"
                className={
                  enabled
                    ? "border-green-500/40 text-green-400 bg-green-500/10"
                    : "border-red-500/40 text-red-400 bg-red-500/10"
                }
              >
                {enabled ? "✓ Active" : "✗ Inactive"}
              </Badge>
              <Badge variant="outline" className="border-primary/30 text-primary">
                {maxAttempts} OTPs max
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                {windowLabel} window
              </Badge>
              <Badge variant="outline" className="border-orange-500/30 text-orange-400">
                {blockMin} min block
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              A user can send at most{" "}
              <strong className="text-foreground">{maxAttempts}</strong> OTPs
              within a {windowLabel} window. After exceeding the limit, they are
              blocked for{" "}
              <strong className="text-foreground">{blockMin} minutes</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveAll} disabled={saving || !canEdit}>
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving…" : "Save Settings"}
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Recent OTP Attempt Logs</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadLogs}
              disabled={logsLoading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${logsLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {logsLoading ? "Loading…" : "No logs found"}
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {log.otp_type}
                    </Badge>
                    <span className="text-muted-foreground font-mono">
                      {log.identifier.replace(/(.{3}).*(@.*)/, "$1***$2")}
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(log.attempted_at).toLocaleString("bn-BD")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
