import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Layers, ArrowUp, ArrowDown } from "lucide-react";

interface FeedWidget {
  id: string; zone: string; widget_type: string; title: string | null;
  is_active: boolean; priority: number; target_user_type: string;
}

const ZONE_LABELS: Record<string, string> = {
  home_top: "Home — Top Banner",
  home_middle: "Home — Middle Section",
  home_bottom: "Home — Bottom Section",
  discovery: "Discovery Screen",
  player_bottom: "Player — Below Player",
  profile_top: "Profile — Top Card",
};

export default function WidgetInjection() {
  const [widgetsByZone, setWidgetsByZone] = useState<Record<string, FeedWidget[]>>({});
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("feed_widgets").select("*").order("priority");
    const grouped: Record<string, FeedWidget[]> = {};
    (data || []).forEach((w: FeedWidget) => {
      if (!grouped[w.zone]) grouped[w.zone] = [];
      grouped[w.zone].push(w);
    });
    setWidgetsByZone(grouped);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(w: FeedWidget) {
    await supabase.from("feed_widgets").update({ is_active: !w.is_active }).eq("id", w.id);
    const zone = w.zone;
    setWidgetsByZone(prev => ({
      ...prev,
      [zone]: prev[zone].map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x),
    }));
  }

  async function movePriority(w: FeedWidget, dir: "up" | "down") {
    const zone = widgetsByZone[w.zone] || [];
    const idx = zone.findIndex(x => x.id === w.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= zone.length) return;

    const swap = zone[swapIdx];
    const newList = [...zone];
    newList[idx] = { ...newList[idx], priority: swap.priority };
    newList[swapIdx] = { ...newList[swapIdx], priority: w.priority };
    newList.sort((a, b) => a.priority - b.priority);

    await Promise.all([
      supabase.from("feed_widgets").update({ priority: swap.priority }).eq("id", w.id),
      supabase.from("feed_widgets").update({ priority: w.priority }).eq("id", swap.id),
    ]);
    setWidgetsByZone(prev => ({ ...prev, [w.zone]: newList }));
    toast.success("Order updated");
  }

  if (loading) return (
    <div className="p-6 space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}</div>
  );

  const zones = Object.keys(ZONE_LABELS);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />Widget Injection
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visual overview of widgets injected into each app screen zone. Use Feed Manager to add or edit widgets.
        </p>
      </div>

      {zones.map(zone => {
        const widgets = widgetsByZone[zone] || [];
        return (
          <Card key={zone}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{ZONE_LABELS[zone]}</span>
                <Badge variant="outline" className="text-xs text-muted-foreground">{widgets.length} widgets</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {widgets.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
                  No widgets in this zone
                </div>
              ) : (
                <div className="space-y-2">
                  {widgets.map((w, idx) => (
                    <div key={w.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${w.is_active ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-60"}`}>
                      <div className="flex flex-col gap-1">
                        <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0} onClick={() => movePriority(w, "up")}>
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === widgets.length - 1} onClick={() => movePriority(w, "down")}>
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{w.widget_type.replace(/_/g, " ")}</span>
                          {w.title && <span className="text-xs text-muted-foreground">· {w.title}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs capitalize">{w.target_user_type}</Badge>
                          <span className="text-xs text-muted-foreground">Priority {w.priority}</span>
                        </div>
                      </div>
                      <Switch checked={w.is_active} onCheckedChange={() => toggleActive(w)} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
