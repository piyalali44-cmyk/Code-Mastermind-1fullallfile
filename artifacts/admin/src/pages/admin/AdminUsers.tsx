import { useEffect, useState } from "react";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Edit2, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface AdminUser { id: string; display_name: string | null; avatar_url: string | null; email: string; role: string | null; joined_at: string; }

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-destructive/10 text-destructive border-destructive/30",
  admin: "bg-primary/10 text-primary border-primary/30",
  editor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  content: "bg-green-500/10 text-green-400 border-green-500/30",
  support: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
};

const ROLE_HIERARCHY = ["support","content","editor","admin","super_admin"];

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState("editor");
  const { profile, isAtLeast } = useAuth();
  const isSuperAdmin = isAtLeast("super_admin");

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("id,display_name,avatar_url,email,role,joined_at").not("role", "is", null).neq("role", "user").order("joined_at");
    setUsers((data as AdminUser[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function inviteAdmin() {
    if (!inviteEmail.trim()) return void toast.error("Email is required");
    if (!isSuperAdmin) return void toast.error("Super admin only");
    setInviting(true);
    try {
      if (!supabaseAdmin) throw new Error("Service key not configured — cannot invite users");
      const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(inviteEmail, {
        data: { role: inviteRole }
      });
      if (inviteError) throw inviteError;
      if (newUser.user?.id) {
        await supabase.from("profiles").upsert({ id: newUser.user.id, role: inviteRole });
      }
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: `Invited admin user: ${inviteEmail}`, entity_type: "admin_user", details: { email: inviteEmail, role: inviteRole } }).then(() => {}, () => {});
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteOpen(false);
      setInviteEmail("");
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setInviting(false); }
  }

  async function updateRole(user: AdminUser, newRole: string) {
    if (!isSuperAdmin) return void toast.error("Super admin only");
    try {
      const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", user.id);
      if (error) throw error;
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: `Changed role for ${user.email} to ${newRole}`, entity_type: "admin_user", entity_id: user.id, details: { old_role: user.role, new_role: newRole } }).then(() => {}, () => {});
      toast.success("Role updated");
      setEditUser(null);
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
  }

  async function removeAdmin(user: AdminUser) {
    if (!isSuperAdmin) return void toast.error("Super admin only");
    if (user.id === profile?.id) return void toast.error("You cannot remove yourself");
    try {
      await supabase.from("profiles").update({ role: "user" }).eq("id", user.id);
      supabase.from("admin_activity_log").insert({ admin_id: profile?.id, action: `Removed admin access: ${user.email}`, entity_type: "admin_user", entity_id: user.id }).then(() => {}, () => {});
      toast.success("Admin access removed");
      load();
    } catch (err: unknown) { toast.error((err as Error).message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" />Admin Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} admin team members</p>
        </div>
        {isSuperAdmin && <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4 mr-2" />Invite Admin</Button>}
      </div>

      <div className="grid grid-cols-5 gap-3 mb-2">
        {ROLE_HIERARCHY.slice().reverse().map(role => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div key={role} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground capitalize">{role.replace("_", " ")}</p>
            </div>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow><TableHead>User</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Since</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 5 }).map((__, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>
            )) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">No admin users yet</TableCell></TableRow>
            ) : users.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{u.display_name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{u.display_name || "No name"}</span>
                    {u.id === profile?.id && <Badge variant="outline" className="text-xs text-muted-foreground">You</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                <TableCell><Badge variant="outline" className={ROLE_COLORS[u.role || ""] || ""}>{u.role?.replace("_", " ")}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(u.joined_at)}</TableCell>
                <TableCell>
                  {isSuperAdmin && u.id !== profile?.id && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditUser(u); setEditRole(u.role || "editor"); }}><Edit2 className="h-4 w-4" /></Button>
                    </div>
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
          <DialogHeader><DialogTitle>Invite Admin</DialogTitle><DialogDescription>Send an email invite to add a new team member.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1"><Label>Email Address</Label><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@example.com" /></div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="support">Support — View users, handle reports</SelectItem>
                  <SelectItem value="content">Content — Manage content, reciters</SelectItem>
                  <SelectItem value="editor">Editor — Full content + journey editor</SelectItem>
                  <SelectItem value="admin">Admin — All features except super settings</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={inviteAdmin} disabled={inviting}>{inviting ? "Sending…" : "Send Invite"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={o => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Role</DialogTitle><DialogDescription>Update role for {editUser?.display_name || editUser?.email}</DialogDescription></DialogHeader>
          <div className="space-y-1">
            <Label>New Role</Label>
            <Select value={editRole} onValueChange={setEditRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_HIERARCHY.map(r => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button variant="outline" className="text-destructive" onClick={() => editUser && removeAdmin(editUser)}>Remove Admin Access</Button>
            <Button onClick={() => editUser && updateRole(editUser, editRole)}>Update Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
