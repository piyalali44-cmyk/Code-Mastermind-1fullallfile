import { useEffect, useState } from "react";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, ShieldCheck, CreditCard, RotateCcw, Trash2, MessageSquare, Star, Activity, KeyRound, Pencil, Gift, Zap, Medal, Plus, Minus, TrendingUp, Award, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { formatDate, formatDateTime } from "@/lib/utils";

function countryToFlag(code: string) {
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

interface UserFull {
  id: string; display_name: string | null; avatar_url: string | null;
  email: string; country: string | null; bio: string | null;
  subscription_tier: string; subscription_expires_at: string | null;
  is_active: boolean; is_blocked: boolean; blocked_reason: string | null;
  role: string | null; joined_at: string; last_active_at: string | null;
  referral_code: string | null; login_provider: string | null;
}
interface SubData { provider: string | null; plan: string | null; status: string | null; expires_at: string | null; }
interface XPData { total_xp: number; level: number; }
interface StreakData { current_streak: number; longest_streak: number; last_activity_date: string; }
interface Note { id: string; note: string; created_by: string | null; created_at: string; }
interface XPLog { id: string; xp_amount: number; reason: string | null; earned_at: string; }
interface BadgeItem { id: string; name: string; slug: string; icon: string; xp_reward: number; description: string | null; earned_at?: string; earned?: boolean; }

type ActionType = "block" | "unblock" | "grant_premium" | "revoke_premium" | "delete" | "reset_password" | "edit_name" | "award_xp" | null;

export default function UserDetail({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserFull | null>(null);
  const [sub, setSub] = useState<SubData | null>(null);
  const [xp, setXp] = useState<XPData | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActionType>(null);
  const [blockReason, setBlockReason] = useState("");
  const [grantDays, setGrantDays] = useState(7);
  const [grantPlan, setGrantPlan] = useState("weekly");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [acting, setActing] = useState(false);
  const [xpHistory, setXpHistory] = useState<XPLog[]>([]);
  const [allBadges, setAllBadges] = useState<BadgeItem[]>([]);
  const [userBadges, setUserBadges] = useState<BadgeItem[]>([]);
  const [xpAwardAmount, setXpAwardAmount] = useState<number>(50);
  const [xpAwardReason, setXpAwardReason] = useState("");
  const [xpAwardType, setXpAwardType] = useState<"add" | "deduct">("add");
  const [badgeLoading, setBadgeLoading] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const { profile, isAtLeast } = useAuth();
  const canManageXP = isAtLeast("admin");
  const canManageRoles = isAtLeast("admin");
  const isSuperAdmin = isAtLeast("super_admin");
  const [, navigate] = useLocation();

  async function load() {
    setLoading(true);
    const [{ data: u }, { data: subData }, { data: x }, { data: s }, { data: n }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("subscriptions").select("provider,plan,status,expires_at").eq("user_id", userId).maybeSingle(),
      supabase.from("user_xp").select("total_xp,level").eq("user_id", userId).single(),
      supabase.from("user_streaks").select("current_streak,longest_streak,last_activity_date").eq("user_id", userId).single(),
      supabase.from("admin_notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    const userData = u as UserFull;
    setUser(userData);
    setSelectedRole(userData?.role || "user");
    setSub(subData as SubData | null);
    setXp(x);
    setStreak(s);
    setNotes((n as Note[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    loadXpHistory();
    loadBadges();
  }, [userId]);

  async function loadXpHistory() {
    const { data } = await supabase
      .from("daily_xp_log")
      .select("id,xp_amount,reason,earned_at")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false })
      .limit(30);
    setXpHistory((data as XPLog[]) ?? []);
  }

  async function loadBadges() {
    const [{ data: earned }, { data: all }] = await Promise.all([
      supabase.from("user_badges").select("badge_id,earned_at,badges(id,name,slug,icon,xp_reward,description)").eq("user_id", userId),
      supabase.from("badges").select("id,name,slug,icon,xp_reward,description"),
    ]);
    const earnedMap = new Map<string, string>();
    (earned || []).forEach((e: any) => earnedMap.set(e.badge_id, e.earned_at));
    const allB = (all || []) as BadgeItem[];
    const userB = allB.filter(b => earnedMap.has(b.id)).map(b => ({ ...b, earned: true, earned_at: earnedMap.get(b.id) }));
    setUserBadges(userB);
    setAllBadges(allB.map(b => ({ ...b, earned: earnedMap.has(b.id), earned_at: earnedMap.get(b.id) })));
  }

  async function updateUserRole() {
    if (!user || !canManageRoles) return;
    if (selectedRole === "super_admin" && !isSuperAdmin) return void toast.error("Super Admin role শুধুমাত্র Super Admin দিতে পারবেন");
    if (selectedRole === (user.role || "user")) return void toast.info("Role পরিবর্তন হয়নি");
    setRoleUpdating(true);
    try {
      const { error } = await supabase.from("profiles").update({ role: selectedRole }).eq("id", userId);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: `Changed role for ${user.email}: ${user.role || "user"} → ${selectedRole}`,
        entity_type: "admin_user",
        entity_id: userId,
        details: { old_role: user.role || "user", new_role: selectedRole },
      }).then(() => {}, () => {});
      toast.success(`Role ${selectedRole} এ আপডেট করা হয়েছে`);
      load();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setRoleUpdating(false);
    }
  }

  async function awardBadge(badgeId: string) {
    setBadgeLoading(true);
    try {
      // Use SECURITY DEFINER RPC — bypasses RLS, handles XP award atomically
      const { data, error } = await supabase.rpc("admin_award_badge", {
        p_user_id: userId,
        p_badge_id: badgeId,
      });
      if (error) throw error;
      const badge = allBadges.find(b => b.id === badgeId);
      const result = data as { already_had?: boolean; xp_reward?: number } | null;
      if (result?.already_had) {
        toast.info(`User already has badge "${badge?.name}"`);
      } else {
        toast.success(`Badge "${badge?.name}" awarded${result?.xp_reward ? ` (+${result.xp_reward} XP)` : ""}`);
      }
      await Promise.all([loadBadges(), loadXpHistory(), load()]);
    } catch (e: any) { toast.error(e.message); }
    finally { setBadgeLoading(false); }
  }

  async function revokeBadge(badgeId: string) {
    setBadgeLoading(true);
    try {
      // Use SECURITY DEFINER RPC — bypasses RLS
      const { error } = await supabase.rpc("admin_revoke_badge", {
        p_user_id: userId,
        p_badge_id: badgeId,
      });
      if (error) throw error;
      toast.success("Badge revoked");
      await loadBadges();
    } catch (e: any) { toast.error(e.message); }
    finally { setBadgeLoading(false); }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    await supabase.from("admin_notes").insert({ user_id: userId, note: newNote, created_by: profile?.id });
    setNewNote("");
    load();
    toast.success("Note added");
  }

  async function performAction() {
    setActing(true);
    const db = supabaseAdmin || supabase;
    try {
      if (action === "block") {
        const { error } = await db.from("profiles")
          .update({ is_blocked: true, blocked_reason: blockReason || null })
          .eq("id", userId);
        if (error) throw new Error(error.message);
        toast.success("User blocked");
      } else if (action === "unblock") {
        const { error } = await db.from("profiles")
          .update({ is_blocked: false, blocked_reason: null })
          .eq("id", userId);
        if (error) throw new Error(error.message);
        toast.success("User unblocked");
      } else if (action === "grant_premium") {
        const expires = grantPlan === "lifetime" ? null : new Date(Date.now() + grantDays * 86_400_000).toISOString();
        const { error } = await db.from("profiles")
          .update({ subscription_tier: "premium", subscription_expires_at: expires })
          .eq("id", userId);
        if (error) throw new Error(error.message);
        await db.from("subscriptions").upsert(
          { user_id: userId, plan: grantPlan, status: "active", started_at: new Date().toISOString(), expires_at: expires, provider: "admin" },
          { onConflict: "user_id" }
        );
        toast.success(grantPlan === "lifetime" ? "Lifetime premium granted!" : `Premium granted for ${grantDays} days (${grantPlan} plan)`);
      } else if (action === "revoke_premium") {
        const { error } = await db.from("profiles")
          .update({ subscription_tier: "free", subscription_expires_at: null })
          .eq("id", userId);
        if (error) throw new Error(error.message);
        await db.from("subscriptions").update({ status: "cancelled" }).eq("user_id", userId);
        toast.success("Premium revoked");
      } else if (action === "reset_password") {
        if (!newPassword || newPassword.length < 6) {
          toast.error("Password must be at least 6 characters");
          setActing(false);
          return;
        }
        if (!supabaseAdmin) throw new Error("Service key not configured");
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) throw new Error(error.message);
        toast.success("Password updated successfully");
        setNewPassword("");
      } else if (action === "edit_name") {
        if (!editName.trim()) {
          toast.error("Name cannot be empty");
          setActing(false);
          return;
        }
        const { error } = await supabase.from("profiles").update({ display_name: editName.trim() }).eq("id", userId);
        if (error) throw new Error(error.message);
        toast.success("Display name updated");
      } else if (action === "award_xp") {
        if (!xpAwardAmount || xpAwardAmount <= 0) {
          toast.error("Enter a valid XP amount");
          setActing(false);
          return;
        }
        const finalAmount = xpAwardType === "add" ? xpAwardAmount : -(xpAwardAmount);
        const reason = xpAwardReason || (xpAwardType === "add" ? "Admin manual award" : "Admin manual deduction");
        // Use SECURITY DEFINER RPC — bypasses RLS, handles XP atomically in DB
        const { error } = await supabase.rpc("admin_award_xp", {
          p_user_id: userId,
          p_amount:  finalAmount,
          p_reason:  reason,
        });
        if (error) throw new Error(error.message);
        toast.success(`${xpAwardType === "add" ? "+" : "-"}${xpAwardAmount} XP ${xpAwardType === "add" ? "awarded" : "deducted"}`);
        await loadXpHistory();
      } else if (action === "delete") {
        if (!supabaseAdmin) throw new Error("Service key not configured — cannot delete users");
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw new Error(error.message);
        toast.success("User deleted");
        navigate("/users");
        return;
      }
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: action?.replace(/_/g, " ") || "action",
        entity_type: "user",
        entity_id: userId,
        details: action === "block" ? { reason: blockReason }
          : action === "grant_premium" ? { days: grantDays, plan: grantPlan }
          : action === "edit_name" ? { name: editName }
          : action === "reset_password" ? { note: "password changed" }
          : {},
      }).then(() => {}, () => {});
      setAction(null);
      setTimeout(() => load(), 300);
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setActing(false); }
  }

  if (loading) return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>;
  if (!user) return <div className="p-6 text-muted-foreground">User not found</div>;

  const level = xp ? (xp.level || Math.floor(xp.total_xp / 500) + 1) : 1;
  const isAdminGranted = sub?.provider === "admin";

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/users")}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">User Detail</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">{user.display_name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">{user.display_name || "No name"}</h2>
                {user.is_blocked && <Badge variant="destructive">Blocked</Badge>}
                {user.role && user.role !== "user" && <Badge variant="outline" className="text-primary border-primary/30">{user.role}</Badge>}
              </div>
              <div className="text-muted-foreground text-sm mt-0.5">{user.email}</div>
              {user.bio && <div className="text-sm text-muted-foreground mt-2">{user.bio}</div>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                {user.country && (
                  <span className="flex items-center gap-1">
                    <span className="text-base leading-none">{countryToFlag(user.country)}</span>
                    {user.country}
                  </span>
                )}
                <span>Joined {formatDate(user.joined_at)}</span>
                {user.last_active_at && <span>Last active {formatDate(user.last_active_at)}</span>}
                <span>Provider: {user.login_provider || "email"}</span>
                {user.referral_code && <span>Code: <span className="font-mono text-primary">{user.referral_code}</span></span>}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Subscription</span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <Badge
                  variant={user.subscription_tier === "premium" ? "default" : "secondary"}
                  className={user.subscription_tier === "premium" ? "bg-primary/20 text-primary border-primary/30" : ""}
                >
                  {user.subscription_tier === "premium" ? "Premium" : "Free"}
                </Badge>
                {user.subscription_tier === "premium" && isAdminGranted && (
                  <Badge variant="outline" className="text-green-400 border-green-400/30 text-[10px] gap-0.5">
                    <Gift className="h-3 w-3" />Admin Granted
                  </Badge>
                )}
                {user.subscription_tier === "premium" && !isAdminGranted && sub && (
                  <Badge variant="outline" className="text-blue-400 border-blue-400/30 text-[10px] gap-0.5">
                    <CreditCard className="h-3 w-3" />Purchased
                  </Badge>
                )}
                {sub?.status === "trial" && (
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 text-[10px]">Trial</Badge>
                )}
                {sub?.status === "cancelled" && (
                  <Badge variant="outline" className="text-red-400 border-red-400/30 text-[10px]">Cancelled</Badge>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {sub?.plan && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Plan</span>
                  <span className="text-[11px] font-medium capitalize">{sub.plan}</span>
                </div>
              )}
              {sub?.provider && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Source</span>
                  <span className="text-[11px] font-medium capitalize">{sub.provider}</span>
                </div>
              )}
              {user.subscription_tier === "premium" && user.subscription_expires_at && sub?.plan !== "lifetime" && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Expires</span>
                  <span className="text-[11px] font-medium">{formatDate(user.subscription_expires_at)}</span>
                </div>
              )}
              {sub?.plan === "lifetime" && (
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Expires</span>
                  <span className="text-[11px] font-medium text-primary">Never</span>
                </div>
              )}
            </div>
          </Card>
          {[
            { label: "XP", value: <span className="font-mono font-semibold">{xp?.total_xp?.toLocaleString() || 0}</span> },
            { label: "Level", value: <span className="font-mono font-semibold">{level}</span> },
            { label: "Streak", value: <span className="font-mono font-semibold">{streak?.current_streak || 0} days</span> },
            { label: "Best Streak", value: <span className="font-mono font-semibold">{streak?.longest_streak || 0} days</span> },
          ].map(({ label, value }) => (
            <Card key={label} className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-sm">{value}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Admin Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {!user.is_blocked ? (
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => setAction("block")}>
                <ShieldAlert className="h-4 w-4 mr-1" />Block User
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="text-green-400 border-green-400/30" onClick={() => setAction("unblock")}>
                <ShieldCheck className="h-4 w-4 mr-1" />Unblock User
              </Button>
            )}
            {user.subscription_tier !== "premium" ? (
              <Button size="sm" variant="outline" className="text-primary border-primary/30" onClick={() => setAction("grant_premium")}>
                <CreditCard className="h-4 w-4 mr-1" />Grant Premium
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAction("revoke_premium")}>
                <RotateCcw className="h-4 w-4 mr-1" />Revoke Premium
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { setEditName(user.display_name || ""); setAction("edit_name"); }}>
              <Pencil className="h-4 w-4 mr-1" />Edit Name
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setNewPassword(""); setAction("reset_password"); }}>
              <KeyRound className="h-4 w-4 mr-1" />Reset Password
            </Button>
            <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => setAction("delete")}>
              <Trash2 className="h-4 w-4 mr-1" />Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role & Permissions */}
      {canManageRoles && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Admin Role ও Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">বর্তমান Role</Label>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={
                        user?.role === "super_admin" ? "bg-destructive/10 text-destructive border-destructive/30" :
                        user?.role === "admin" ? "bg-primary/10 text-primary border-primary/30" :
                        user?.role === "editor" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                        user?.role === "content" ? "bg-green-500/10 text-green-400 border-green-500/30" :
                        user?.role === "support" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
                        "bg-muted text-muted-foreground border-border"
                      }
                    >
                      {(user?.role || "user").replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>নতুন Role দিন</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User — সাধারণ ইউজার (কোনো admin access নেই)</SelectItem>
                      <SelectItem value="support">Support — ইউজার ম্যানেজমেন্ট ও কন্টাক্ট মেসেজ</SelectItem>
                      <SelectItem value="content">Content — কন্টেন্ট ও হাদীস ম্যানেজমেন্ট</SelectItem>
                      <SelectItem value="editor">Editor — কন্টেন্ট + জার্নি + ফিড এডিটর</SelectItem>
                      <SelectItem value="admin">Admin — সব ফিচার (সুপার সেটিংস ছাড়া)</SelectItem>
                      {isSuperAdmin && <SelectItem value="super_admin">Super Admin — সম্পূর্ণ নিয়ন্ত্রণ</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={updateUserRole}
                  disabled={roleUpdating || selectedRole === (user?.role || "user")}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  {roleUpdating ? "সংরক্ষণ হচ্ছে…" : "Role আপডেট করুন"}
                </Button>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                <p className="font-medium text-foreground text-sm mb-2">Role Permission সারাংশ</p>
                {[
                  { role: "support", label: "Support", perms: "ইউজার দেখা, কন্টাক্ট মেসেজ, Analytics" },
                  { role: "content", label: "Content", perms: "Content + Hadith + Journey + Analytics" },
                  { role: "editor", label: "Editor", perms: "Content + Feed + Gamification + Notifications" },
                  { role: "admin", label: "Admin", perms: "সব কিছু (Monetization সহ, Super settings ছাড়া)" },
                  { role: "super_admin", label: "Super Admin", perms: "সম্পূর্ণ access, সব settings সহ" },
                ].map(({ role: r, label, perms }) => (
                  <div key={r} className={`flex gap-2 py-0.5 ${selectedRole === r ? "text-foreground font-medium" : ""}`}>
                    <span className="shrink-0 w-20">{label}</span>
                    <span className="text-muted-foreground">{perms}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* XP & Badge Management Tabs */}
      <Tabs defaultValue="xp">
        <TabsList className="mb-3">
          <TabsTrigger value="xp" className="gap-1.5"><Zap className="h-4 w-4" />XP Management</TabsTrigger>
          <TabsTrigger value="badges" className="gap-1.5"><Medal className="h-4 w-4" />Badges</TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5"><MessageSquare className="h-4 w-4" />Notes</TabsTrigger>
        </TabsList>

        {/* XP Tab */}
        <TabsContent value="xp" className="space-y-4 mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Manual XP Adjustment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  size="sm"
                  variant={xpAwardType === "add" ? "default" : "outline"}
                  onClick={() => setXpAwardType("add")}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />Award XP
                </Button>
                <Button
                  size="sm"
                  variant={xpAwardType === "deduct" ? "destructive" : "outline"}
                  onClick={() => setXpAwardType("deduct")}
                  className="gap-1.5"
                >
                  <Minus className="h-4 w-4" />Deduct XP
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={1}
                    value={xpAwardAmount}
                    onChange={e => setXpAwardAmount(parseInt(e.target.value) || 0)}
                    disabled={!canManageXP}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Reason (optional)</Label>
                  <Input
                    placeholder="e.g. Contest winner"
                    value={xpAwardReason}
                    onChange={e => setXpAwardReason(e.target.value)}
                    disabled={!canManageXP}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground">Current XP</span>
                <span className="text-sm font-mono font-semibold">{xp?.total_xp?.toLocaleString() || 0}</span>
              </div>
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground">After adjustment</span>
                <span className={`text-sm font-mono font-semibold ${xpAwardType === "add" ? "text-green-500" : "text-destructive"}`}>
                  {xpAwardType === "add"
                    ? ((xp?.total_xp || 0) + (xpAwardAmount || 0)).toLocaleString()
                    : Math.max(0, (xp?.total_xp || 0) - (xpAwardAmount || 0)).toLocaleString()
                  }
                </span>
              </div>
              <Button
                onClick={() => setAction("award_xp")}
                disabled={!canManageXP || !xpAwardAmount}
                className="w-full gap-2"
                variant={xpAwardType === "deduct" ? "destructive" : "default"}
              >
                <Zap className="h-4 w-4" />
                {xpAwardType === "add" ? `Award ${xpAwardAmount} XP` : `Deduct ${xpAwardAmount} XP`}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                XP History (last 30)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {xpHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">No XP history yet</div>
              ) : (
                <div className="space-y-1.5">
                  {xpHistory.map(log => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div>
                        <div className="text-xs text-foreground">{log.reason || "XP earned"}</div>
                        <div className="text-[10px] text-muted-foreground">{formatDateTime(log.earned_at)}</div>
                      </div>
                      <span className={`text-sm font-mono font-semibold ${log.xp_amount >= 0 ? "text-green-500" : "text-destructive"}`}>
                        {log.xp_amount >= 0 ? "+" : ""}{log.xp_amount} XP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Badges Tab */}
        <TabsContent value="badges" className="space-y-4 mt-0">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  Earned Badges
                </CardTitle>
                <span className="text-xs text-muted-foreground">{userBadges.length} / {allBadges.length}</span>
              </div>
            </CardHeader>
            <CardContent>
              {userBadges.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">No badges earned yet</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {userBadges.map(b => (
                    <div key={b.id} className="flex items-center gap-2 bg-muted/40 rounded-lg p-2.5">
                      <span className="text-xl">{b.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{b.name}</div>
                        <div className="text-[10px] text-muted-foreground">+{b.xp_reward} XP</div>
                      </div>
                      {canManageXP && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => revokeBadge(b.id)} disabled={badgeLoading}>
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {canManageXP && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Award a Badge
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2">
                  {allBadges.filter(b => !b.earned).map(b => (
                    <div key={b.id} className="flex items-center gap-3 border border-border rounded-lg px-3 py-2.5">
                      <span className="text-xl">{b.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{b.name}</div>
                        {b.description && <div className="text-xs text-muted-foreground truncate">{b.description}</div>}
                        <div className="text-xs text-primary mt-0.5">+{b.xp_reward} XP</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => awardBadge(b.id)} disabled={badgeLoading} className="gap-1 shrink-0">
                        <Plus className="h-3.5 w-3.5" />Award
                      </Button>
                    </div>
                  ))}
                  {allBadges.filter(b => !b.earned).length === 0 && (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      User has earned all available badges! 🎉
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-0">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" />Admin Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {notes.map(n => (
                <div key={n.id} className="bg-muted/30 rounded-lg p-3 text-sm">
                  <div className="text-foreground">{n.note}</div>
                  <div className="text-xs text-muted-foreground mt-1">{formatDateTime(n.created_at)}</div>
                </div>
              ))}
              {notes.length === 0 && <div className="text-sm text-muted-foreground">No notes yet</div>}
              <Separator />
              <div className="flex gap-2">
                <Textarea rows={2} placeholder="Add a note…" value={newNote} onChange={e => setNewNote(e.target.value)} className="flex-1" />
                <Button size="sm" onClick={addNote} disabled={!newNote.trim()}><Star className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={action !== null} onOpenChange={o => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "block" && "Block User"}
              {action === "unblock" && "Unblock User"}
              {action === "grant_premium" && "Grant Premium"}
              {action === "revoke_premium" && "Revoke Premium"}
              {action === "reset_password" && "Reset Password"}
              {action === "edit_name" && "Edit Display Name"}
              {action === "delete" && "Delete Account"}
              {action === "award_xp" && (xpAwardType === "add" ? "Award XP" : "Deduct XP")}
            </DialogTitle>
            <DialogDescription>
              {action === "block" && "The user will be prevented from accessing the app."}
              {action === "unblock" && `Restore access for ${user.display_name || "this user"}.`}
              {action === "grant_premium" && "Grant premium access manually. This will NOT count as revenue."}
              {action === "revoke_premium" && "Remove premium access immediately."}
              {action === "reset_password" && `Set a new password for ${user.display_name || user.email}.`}
              {action === "edit_name" && `Change display name for ${user.email}.`}
              {action === "delete" && "This will permanently delete the account and all data. This cannot be undone."}
              {action === "award_xp" && `${xpAwardType === "add" ? "Add" : "Remove"} ${xpAwardAmount} XP ${xpAwardType === "add" ? "to" : "from"} ${user.display_name || user.email}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {action === "block" && (
              <div className="space-y-1">
                <Label>Block Reason (optional)</Label>
                <Textarea rows={2} placeholder="Reason…" value={blockReason} onChange={e => setBlockReason(e.target.value)} />
              </div>
            )}
            {action === "grant_premium" && (() => {
              const expiryDate = grantPlan === "lifetime" ? null : new Date(Date.now() + grantDays * 24 * 60 * 60 * 1000);
              return (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Plan type</Label>
                    <Select value={grantPlan} onValueChange={v => { setGrantPlan(v); setGrantDays(v === "weekly" ? 7 : v === "monthly" ? 30 : 36500); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="lifetime">Lifetime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {grantPlan !== "lifetime" && (
                    <div className="space-y-1">
                      <Label>Days to grant</Label>
                      <Input type="number" min={1} max={3650} value={grantDays} onChange={e => setGrantDays(parseInt(e.target.value) || 7)} />
                    </div>
                  )}
                  <div className="bg-accent/30 border border-border rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="font-medium text-foreground capitalize">{grantPlan}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium text-foreground">{grantPlan === "lifetime" ? "Forever" : `${grantDays} days`}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Expires</span>
                      <span className="font-medium text-foreground">{expiryDate ? expiryDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Never"}</span>
                    </div>
                  </div>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground">
                    <Gift className="h-3.5 w-3.5 inline mr-1 text-primary" />
                    Admin-granted premium is marked separately and will <strong className="text-foreground">not</strong> count toward revenue.
                  </div>
                </div>
              );
            })()}
            {action === "reset_password" && (
              <div className="space-y-1">
                <Label>New Password</Label>
                <Input type="password" placeholder="Min 6 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
            )}
            {action === "edit_name" && (
              <div className="space-y-1">
                <Label>Display Name</Label>
                <Input placeholder="Enter new name" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
            )}
            {action === "delete" && (
              <div className="space-y-1">
                <Label className="text-destructive">Type "DELETE" to confirm</Label>
                <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button
              variant={action === "delete" || action === "block" ? "destructive" : "default"}
              onClick={performAction}
              disabled={acting || (action === "delete" && deleteConfirm !== "DELETE") || (action === "reset_password" && newPassword.length < 6)}
            >
              {acting ? "Processing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
