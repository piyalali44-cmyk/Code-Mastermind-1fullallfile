import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, KeyRound, Shield, Save, Loader2 } from "lucide-react";

export default function ProfileSettings() {
  const { profile, role, user } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSaveName() {
    if (!displayName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("id", profile?.id);
      if (error) throw new Error(error.message);
      toast.success("Display name updated");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setSavingPassword(false);
    }
  }

  const initials = (profile?.display_name || profile?.email || "A")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your admin account</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Account Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full gold-gradient flex items-center justify-center text-lg font-bold text-white shrink-0">
              {initials}
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">{profile?.display_name || "No name"}</div>
              <div className="text-sm text-muted-foreground">{profile?.email || user?.email}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">
                  <Shield className="h-3 w-3 mr-0.5" />
                  {role}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Display Name</Label>
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your display name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Email</Label>
              <Input value={profile?.email || user?.email || ""} disabled className="opacity-60" />
              <p className="text-[11px] text-muted-foreground">Email cannot be changed</p>
            </div>
            <Button onClick={handleSaveName} disabled={savingName || !displayName.trim()} size="sm">
              {savingName ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Name
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={savingPassword || !newPassword || newPassword.length < 6 || newPassword !== confirmPassword}
            size="sm"
          >
            {savingPassword ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1.5" />}
            Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
