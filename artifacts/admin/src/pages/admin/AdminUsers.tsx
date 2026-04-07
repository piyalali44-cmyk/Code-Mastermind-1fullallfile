import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { UserPlus, Edit2, ShieldCheck, Search, UserCheck, X, Mail } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AdminUser { id: string; display_name: string | null; avatar_url: string | null; email: string; role: string | null; joined_at: string; }
interface FoundUser { id: string; display_name: string | null; avatar_url: string | null; email: string; role: string | null; joined_at: string; }

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-destructive/10 text-destructive border-destructive/30",
  admin: "bg-primary/10 text-primary border-primary/30",
  editor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  content: "bg-green-500/10 text-green-400 border-green-500/30",
  support: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  user: "bg-muted text-muted-foreground border-border",
};

const ROLE_LABELS: Record<string, string> = {
  support: "Support — Contact message replies only",
  content: "Content — Content, series, episodes, hadith & analytics",
  editor: "Editor — Content + journey + feed + gamification + notifications",
  admin: "Admin — All features including user management & monetization",
};

const ROLE_HIERARCHY = ["support", "content", "editor", "admin", "super_admin"];

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState("editor");

  const [promoteSearch, setPromoteSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searchError, setSearchError] = useState("");
  const [promoteRole, setPromoteRole] = useState("editor");
  const [promoting, setPromoting] = useState(false);

  const { profile, session, isAtLeast } = useAuth();
  const isSuperAdmin = isAtLeast("super_admin");
  const isAdmin = isAtLeast("admin");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url,email,role,joined_at")
      .not("role", "is", null)
      .neq("role", "user")
      .order("joined_at");
    setUsers((data as AdminUser[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function searchUser() {
    const q = promoteSearch.trim();
    if (!q) return void toast.error("Enter an email or name to search");
    setSearching(true);
    setFoundUser(null);
    setSearchError("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url,email,role,joined_at")
        .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setSearchError("No user found. Try a different email or name.");
      } else {
        setFoundUser(data as FoundUser);
        setPromoteRole(data.role && data.role !== "user" ? data.role : "editor");
      }
    } catch (err: unknown) {
      setSearchError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function promoteUser() {
    if (!foundUser) return;
    if (!isSuperAdmin && !isAdmin) return void toast.error("Only Admin or Super Admin can assign roles");
    if (promoteRole === "super_admin" && !isSuperAdmin) return void toast.error("Only Super Admin can assign the Super Admin role");
    setPromoting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: promoteRole })
        .eq("id", foundUser.id);
      if (error) throw error;

      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: `Assigned role '${promoteRole}' to existing user: ${foundUser.email}`,
        entity_type: "admin_user",
        entity_id: foundUser.id,
        details: { old_role: foundUser.role || "user", new_role: promoteRole },
      }).then(() => {}, () => {});

      toast.success(`Role "${promoteRole}" assigned to ${foundUser.display_name || foundUser.email}`);
      setFoundUser(null);
      setPromoteSearch("");
      setSearchError("");
      load();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setPromoting(false);
    }
  }

  async function inviteAdmin() {
    if (!inviteEmail.trim()) return void toast.error("Email is required");
    if (!isSuperAdmin) return void toast.error("Only Super Admin can send invitations");
    const token = session?.access_token;
    if (!token) return void toast.error("Session expired, please re-login");
    setInviting(true);
    try {
      const API_BASE: string =
        (import.meta.env as Record<string, string>).VITE_API_BASE_URL ||
        (typeof window !== "undefined" ? `${window.location.origin}/api` : "/api");
      const resp = await fetch(`${API_BASE}/admin/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Failed to send invitation");
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: `Invited admin user: ${inviteEmail}`,
        entity_type: "admin_user",
        details: { email: inviteEmail, role: inviteRole },
      }).then(() => {}, () => {});
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteOpen(false);
      setInviteEmail("");
      load();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function updateRole(user: AdminUser, newRole: string) {
    if (!isSuperAdmin) return void toast.error("Only Super Admin can change roles");
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", user.id);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: `Changed role for ${user.email} to ${newRole}`,
        entity_type: "admin_user",
        entity_id: user.id,
        details: { old_role: user.role, new_role: newRole },
      }).then(() => {}, () => {});
      toast.success("Role updated successfully");
      setEditUser(null);
      load();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }

  async function removeAdmin(user: AdminUser) {
    if (!isSuperAdmin) return void toast.error("Only Super Admin can remove admin access");
    if (user.id === profile?.id) return void toast.error("You cannot remove your own access");
    try {
      await supabase.from("profiles").update({ role: "user" }).eq("id", user.id);
      supabase.from("admin_activity_log").insert({
        admin_id: profile?.id,
        action: `Removed admin access: ${user.email}`,
        entity_type: "admin_user",
        entity_id: user.id,
      }).then(() => {}, () => {});
      toast.success("Admin access removed");
      load();
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Admin Team
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} team member{users.length !== 1 ? "s" : ""}</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Invite by Email
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ROLE_HIERARCHY.slice().reverse().map(r => {
          const count = users.filter(u => u.role === r).length;
          return (
            <div key={r} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground capitalize">{r.replace("_", " ")}</p>
            </div>
          );
        })}
      </div>

      {(isSuperAdmin || isAdmin) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              Assign Role to Existing User
            </CardTitle>
            <p className="text-sm text-muted-foreground">Search for any registered app user by email or name and grant them admin panel access.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by email or name..."
                value={promoteSearch}
                onChange={e => { setPromoteSearch(e.target.value); setFoundUser(null); setSearchError(""); }}
                onKeyDown={e => e.key === "Enter" && searchUser()}
                className="flex-1"
              />
              <Button onClick={searchUser} disabled={searching || !promoteSearch.trim()}>
                <Search className="h-4 w-4 mr-2" />
                {searching ? "Searching…" : "Search"}
              </Button>
            </div>

            {searchError && (
              <p className="text-sm text-destructive">{searchError}</p>
            )}

            {foundUser && (
              <div className="border border-border rounded-xl p-4 space-y-4 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={foundUser.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {foundUser.display_name?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{foundUser.display_name || "No name"}</p>
                      <p className="text-xs text-muted-foreground">{foundUser.email}</p>
                      <p className="text-xs text-muted-foreground">Joined: {formatDate(foundUser.joined_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={ROLE_COLORS[foundUser.role || "user"]}>
                      {(foundUser.role || "user").replace("_", " ")}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setFoundUser(null); setPromoteSearch(""); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label>Assign Role</Label>
                    <Select value={promoteRole} onValueChange={setPromoteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([r, label]) => (
                          <SelectItem key={r} value={r}>{label}</SelectItem>
                        ))}
                        {isSuperAdmin && (
                          <SelectItem value="super_admin">Super Admin — Full control over everything</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={promoteUser}
                    disabled={promoting || promoteRole === (foundUser.role || "user")}
                    className="shrink-0"
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    {promoting ? "Saving…" : "Assign Role"}
                  </Button>
                </div>

                {promoteRole === (foundUser.role || "user") && (
                  <p className="text-xs text-muted-foreground">User already has this role. Select a different role to make a change.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No admin team members yet
                  </TableCell>
                </TableRow>
              ) : users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {u.display_name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{u.display_name || "No name"}</span>
                      {u.id === profile?.id && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">You</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ROLE_COLORS[u.role || ""] || ""}>
                      {u.role?.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(u.joined_at)}</TableCell>
                  <TableCell>
                    {isSuperAdmin && u.id !== profile?.id && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditUser(u); setEditRole(u.role || "editor"); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite by Email</DialogTitle>
            <DialogDescription>Send an email invitation to add a new team member. They will receive a signup link with the assigned role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Email Address</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([r, label]) => (
                    <SelectItem key={r} value={r}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={inviteAdmin} disabled={inviting}>
              <Mail className="h-4 w-4 mr-2" />
              {inviting ? "Sending…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={o => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>Update role for {editUser?.display_name || editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>New Role</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_HIERARCHY.map(r => (
                  <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button variant="outline" className="text-destructive border-destructive/30" onClick={() => editUser && removeAdmin(editUser)}>
              Remove Access
            </Button>
            <Button onClick={() => editUser && updateRole(editUser, editRole)}>Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
