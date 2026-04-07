import { useState } from "react";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";

const MIGRATIONS = [
  {
    id: "subscription_production",
    label: "Subscription Production Schema",
    file: "20260407_subscription_production.sql",
    description: "Adds store, product_id, purchase_token columns; purchase_events audit log; auto-expiry trigger; record_verified_purchase() function. Required before App Store / Google Play purchases go live.",
  },
  {
    id: "missing_feature_flags",
    label: "Missing Feature Flags",
    file: "20260407_missing_feature_flags.sql",
    description: "Seeds 16 missing feature flags (leaderboard, referral, quran_player, push_notifications, etc.) so the Admin Feature Flags page can control them.",
  },
];

const STORAGE_KEY = "admin_migration_banner_dismissed";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function setDismissed(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export default function MigrationBanner() {
  const [dismissed, setDismissedState] = useState<Set<string>>(getDismissed);
  const [expanded, setExpanded] = useState(false);

  const visible = MIGRATIONS.filter(m => !dismissed.has(m.id));
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    setDismissedState(next);
  }

  function dismissAll() {
    const next = new Set(MIGRATIONS.map(m => m.id));
    setDismissed(next);
    setDismissedState(next);
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold text-amber-300">
              {visible.length} pending SQL migration{visible.length > 1 ? "s" : ""} — action required
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-xs text-amber-400 hover:text-amber-200 flex items-center gap-1 transition-colors"
              >
                {expanded ? "Hide" : "Show details"}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <button
                onClick={dismissAll}
                className="text-xs text-amber-400 hover:text-amber-200 transition-colors"
              >
                Dismiss all
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-300/70 mt-0.5">
            Run the following SQL file{visible.length > 1 ? "s" : ""} in your{" "}
            <a
              href="https://supabase.com/dashboard/project/tkruzfskhtcazjxdracm/sql"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-amber-200"
            >
              Supabase SQL Editor
            </a>{" "}
            to complete the setup.
          </p>

          {expanded && (
            <div className="mt-3 flex flex-col gap-2">
              {visible.map(m => (
                <div key={m.id} className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-amber-200">{m.label}</span>
                      <code className="text-[10px] bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                        supabase/migrations/{m.file}
                      </code>
                    </div>
                    <p className="text-xs text-amber-300/60 mt-1">{m.description}</p>
                  </div>
                  <button
                    onClick={() => dismiss(m.id)}
                    className="text-amber-400/60 hover:text-amber-200 transition-colors mt-0.5 shrink-0"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
