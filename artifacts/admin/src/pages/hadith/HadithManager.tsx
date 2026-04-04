import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BookOpen,
  Save,
  Star,
  Eye,
  RotateCcw,
  Info,
  CheckCircle,
} from "lucide-react";

interface HadithBook {
  id: string;
  name: string;
  arabicName: string;
  author: string;
  total: number;
  description: string;
}

const HADITH_BOOKS: HadithBook[] = [
  { id: "eng-bukhari", name: "Sahih al-Bukhari", arabicName: "صحيح البخاري", author: "Imam al-Bukhari", total: 7563, description: "The most authentic hadith collection." },
  { id: "eng-muslim", name: "Sahih Muslim", arabicName: "صحيح مسلم", author: "Imam Muslim ibn al-Hajjaj", total: 3032, description: "Second most authentic collection." },
  { id: "eng-abudawud", name: "Sunan Abu Dawud", arabicName: "سنن أبي داود", author: "Imam Abu Dawud", total: 5274, description: "Focused on legal hadiths." },
  { id: "eng-tirmidhi", name: "Jami at-Tirmidhi", arabicName: "جامع الترمذي", author: "Imam at-Tirmidhi", total: 3956, description: "Includes legal rulings and grading." },
  { id: "eng-nasai", name: "Sunan an-Nasai", arabicName: "سنن النسائي", author: "Imam an-Nasai", total: 5761, description: "Strict criteria for acceptance." },
  { id: "eng-ibnmajah", name: "Sunan Ibn Majah", arabicName: "سنن ابن ماجه", author: "Imam Ibn Majah", total: 4341, description: "Unique hadiths not found elsewhere." },
  { id: "eng-malik", name: "Muwatta Malik", arabicName: "موطأ مالك", author: "Imam Malik ibn Anas", total: 1594, description: "Earliest systematic hadith collection." },
  { id: "eng-riyadussalihin", name: "Riyad as-Salihin", arabicName: "رياض الصالحين", author: "Imam an-Nawawi", total: 1896, description: "Hadiths for piety and good character." },
  { id: "eng-nawawi40", name: "Al-Nawawi 40 Hadith", arabicName: "الأربعون النووية", author: "Imam an-Nawawi", total: 42, description: "42 essential Islamic fundamentals." },
];

const TOTAL_HADITHS = HADITH_BOOKS.reduce((s, b) => s + b.total, 0);

type Settings = Record<string, string>;

export default function HadithManager() {
  const { isAtLeast } = useAuth();
  const canEdit = isAtLeast("admin");

  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewHadith, setPreviewHadith] = useState<{ text: string; number: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const allKeys = [
    ...HADITH_BOOKS.map((b) => `hadith_book_enabled_${b.id}`),
    "hadith_daily_book",
    "hadith_daily_number",
    "hadith_feature_enabled",
  ];

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", allKeys);
    const map: Settings = {};
    (data || []).forEach((r: { key: string; value: unknown }) => {
      const v = r.value;
      map[r.key] = typeof v === "string" ? v.replace(/^"|"$/g, "") : String(v);
    });
    // Defaults: all books enabled
    HADITH_BOOKS.forEach((b) => {
      if (!(`hadith_book_enabled_${b.id}` in map)) {
        map[`hadith_book_enabled_${b.id}`] = "true";
      }
    });
    if (!("hadith_feature_enabled" in map)) map["hadith_feature_enabled"] = "true";
    if (!("hadith_daily_book" in map)) map["hadith_daily_book"] = "eng-nawawi40";
    if (!("hadith_daily_number" in map)) map["hadith_daily_number"] = "1";
    setSettings(map);
    setLoading(false);
  }

  function setVal(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function toggleBook(bookId: string) {
    const key = `hadith_book_enabled_${bookId}`;
    setVal(key, settings[key] === "true" ? "false" : "true");
  }

  function enableAll() {
    const updates: Settings = { ...settings };
    HADITH_BOOKS.forEach((b) => {
      updates[`hadith_book_enabled_${b.id}`] = "true";
    });
    setSettings(updates);
  }

  async function save() {
    if (!canEdit) return void toast.error("Admin access required");
    setSaving(true);
    try {
      const upserts = allKeys.map((key) => ({
        key,
        value: settings[key] ?? "true",
      }));
      const { error } = await supabase.from("app_settings").upsert(upserts, { onConflict: "key" });
      if (error) throw error;
      toast.success("Hadith settings saved successfully");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function previewDailyHadith() {
    const book = settings["hadith_daily_book"] || "eng-nawawi40";
    const number = parseInt(settings["hadith_daily_number"] || "1", 10);
    setPreviewLoading(true);
    setPreviewHadith(null);
    try {
      const res = await fetch(
        `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${book}/hadiths/${number}.min.json`
      );
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setPreviewHadith({ text: data.text || "No text available", number: data.hadithnumber });
    } catch {
      toast.error("Could not load hadith. Check book and number.");
    } finally {
      setPreviewLoading(false);
    }
  }

  const enabledCount = HADITH_BOOKS.filter(
    (b) => settings[`hadith_book_enabled_${b.id}`] === "true"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Hadith Manager
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure which hadith books appear in the app and manage the Daily Hadith feature.
          </p>
        </div>
        <Button onClick={save} disabled={saving || !canEdit} className="gap-2 shrink-0">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-primary">{TOTAL_HADITHS.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total Hadiths Available</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-500">{enabledCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Books Enabled in App</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-amber-500">{HADITH_BOOKS.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total Books Available</div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            Hadith Feature
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Show Hadith on Home Screen</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Displays the Hadith card on the mobile app home screen between Quran and Discover sections.
              </p>
            </div>
            <Switch
              checked={settings["hadith_feature_enabled"] === "true"}
              onCheckedChange={(v) => setVal("hadith_feature_enabled", v ? "true" : "false")}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Book Visibility */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Book Visibility
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{enabledCount}/{HADITH_BOOKS.length} enabled</Badge>
              <Button variant="ghost" size="sm" onClick={enableAll} className="h-7 text-xs gap-1">
                <RotateCcw className="h-3 w-3" />
                Enable All
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Toggle which hadith books users can access in the app.
          </p>
        </CardHeader>
        <CardContent className="space-y-0">
          {HADITH_BOOKS.map((book, i) => {
            const enabled = settings[`hadith_book_enabled_${book.id}`] === "true";
            return (
              <div key={book.id}>
                {i > 0 && <Separator className="my-0" />}
                <div className="flex items-center gap-4 py-3.5">
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => canEdit && toggleBook(book.id)}
                    disabled={!canEdit}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{book.name}</span>
                      <span className="text-xs text-muted-foreground font-arabic">{book.arabicName}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground">{book.author}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-primary font-medium">{book.total.toLocaleString()} hadiths</span>
                    </div>
                  </div>
                  <Badge variant={enabled ? "default" : "outline"} className="text-xs shrink-0">
                    {enabled ? "Visible" : "Hidden"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Daily Hadith */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Daily Hadith
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Set a featured hadith that appears prominently in the app. Update this daily for fresh content.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Book</Label>
              <select
                value={settings["hadith_daily_book"] || "eng-nawawi40"}
                onChange={(e) => setVal("hadith_daily_book", e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
              >
                {HADITH_BOOKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.total.toLocaleString()} hadiths)
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Hadith Number</Label>
              <Input
                type="number"
                min={1}
                value={settings["hadith_daily_number"] || "1"}
                onChange={(e) => setVal("hadith_daily_number", e.target.value)}
                disabled={!canEdit}
                placeholder="e.g. 1"
              />
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={previewDailyHadith}
            disabled={previewLoading}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {previewLoading ? "Loading..." : "Preview Hadith"}
          </Button>

          {previewHadith && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Hadith #{previewHadith.number}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {HADITH_BOOKS.find((b) => b.id === settings["hadith_daily_book"])?.name}
                </span>
              </div>
              <p className="text-sm leading-relaxed">{previewHadith.text}</p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              The Daily Hadith is served via a free public CDN (jsdelivr.net) that caches the fawazahmed0/hadith-api GitHub repository.
              No API key is required. Make sure to save settings after changing the daily hadith.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* API Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            API Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted/40 p-3 text-xs font-mono text-muted-foreground break-all">
            https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/&#123;book&#125;/hadiths/&#123;number&#125;.min.json
          </div>
          <p className="text-xs text-muted-foreground">
            All hadith data is fetched from the open-source <strong>fawazahmed0/hadith-api</strong> served via jsDelivr CDN.
            It provides 9 major hadith collections with full English translations. No API key required.
            Data is cached by the CDN for fast delivery worldwide.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {HADITH_BOOKS.map((b) => (
              <div key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {b.name} — {b.total.toLocaleString()}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
