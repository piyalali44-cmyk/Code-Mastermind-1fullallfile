import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, GripVertical, FolderTree, ImageIcon } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import type { Category } from "@/lib/types";
import { slugify } from "@/lib/utils";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [associatedSeriesCount, setAssociatedSeriesCount] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-categories-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
        fetchCategories();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchCategories() {
    setLoading(true);
    const { data, error } = await supabase.from("categories").select("*").order("order_index");
    if (error) toast({ variant: "destructive", title: "Error", description: error.message });
    else setCategories(data || []);
    setLoading(false);
  }

  async function toggleActive(id: string, current: boolean) {
    const { error } = await supabase.from("categories").update({ is_active: !current }).eq("id", id);
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
      return;
    }
    setCategories(categories.map(c => c.id === id ? { ...c, is_active: !current } : c));
    if (profile) {
      supabase.from("admin_activity_log").insert({
        admin_id: profile.id,
        action: `category_${!current ? 'activated' : 'deactivated'}`,
        entity_type: "category", entity_id: id,
        details: { before: { is_active: current }, after: { is_active: !current } }
      }).then(() => {}, () => {});
    }
    toast({ title: "Updated", description: "Category status changed" });
  }

  async function handleDeleteClick(cat: Category) {
    const { count } = await supabase
      .from("series")
      .select("*", { count: "exact", head: true })
      .eq("category_id", cat.id);
    setAssociatedSeriesCount(count ?? 0);
    setDeleteTarget(cat);
  }

  async function deleteCategory(cat: Category) {
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("categories").delete().eq("id", cat.id);
      if (error) throw error;
      if (profile) {
        supabase.from("admin_activity_log").insert({
          admin_id: profile.id,
          action: "category_deleted",
          entity_type: "category", entity_id: cat.id,
          details: { name: cat.name }
        }).then(() => {}, () => {});
      }
      toast({ title: "Deleted", description: `Category "${cat.name}" has been deleted` });
      setDeleteTarget(null);
      fetchCategories();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from("categories").delete().in("id", ids);
      if (error) throw error;
      if (profile) {
        supabase.from("admin_activity_log").insert({
          admin_id: profile.id,
          action: "bulk_categories_deleted",
          entity_type: "category",
          details: { count: ids.length, ids }
        }).then(() => {}, () => {});
      }
      toast({ title: "Deleted", description: `${ids.length} ${ids.length === 1 ? "category" : "categories"} deleted` });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    } finally {
      setBulkDeleting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pageItems = categories.slice(page * pageSize, (page + 1) * pageSize);
  const allPageSelected = pageItems.length > 0 && pageItems.every(c => selectedIds.has(c.id));
  const somePageSelected = pageItems.some(c => selectedIds.has(c.id));

  function toggleSelectAll() {
    if (allPageSelected) {
      const next = new Set(selectedIds);
      pageItems.forEach(c => next.delete(c.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      pageItems.forEach(c => next.add(c.id));
      setSelectedIds(next);
    }
  }

  const colSpan = 7;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{categories.length} categories configured</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <CategoryForm onSave={fetchCategories}>
            <Button className="gap-2 shrink-0"><Plus className="w-4 h-4"/> <span className="hidden sm:inline">New</span> Category</Button>
          </CategoryForm>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-10 pl-4">
                  <input
                    type="checkbox"
                    className="rounded border-border cursor-pointer"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: colSpan }).map((__, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FolderTree className="h-10 w-10 opacity-30" />
                      <p className="font-medium">No categories found</p>
                      <p className="text-sm">Create your first category using the button above.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((cat) => (
                  <TableRow key={cat.id} className={`transition-colors hover:bg-muted/20 ${selectedIds.has(cat.id) ? "bg-primary/5" : ""}`}>
                    <TableCell className="pl-4">
                      <input
                        type="checkbox"
                        className="rounded border-border cursor-pointer"
                        checked={selectedIds.has(cat.id)}
                        onChange={() => toggleSelect(cat.id)}
                      />
                    </TableCell>
                    <TableCell><GripVertical className="w-4 h-4 text-muted-foreground cursor-move" /></TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {cat.icon_url ? (
                          <img src={cat.icon_url} alt={cat.name} className="w-10 h-10 rounded-lg bg-secondary object-cover border border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center border border-border">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{cat.name}</div>
                          {cat.name_arabic && <div className="text-xs text-muted-foreground font-arabic">{cat.name_arabic}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">{cat.slug}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {cat.premium_required && <span className="px-2 py-0.5 rounded text-xs bg-primary/20 text-primary border border-primary/20">Premium</span>}
                        {cat.guest_access && <span className="px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground">Guest</span>}
                        {!cat.premium_required && !cat.guest_access && <span className="text-xs text-muted-foreground">Free</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch checked={cat.is_active} onCheckedChange={() => toggleActive(cat.id, cat.is_active)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <CategoryForm category={cat} onSave={fetchCategories}>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="w-4 h-4"/></Button>
                        </CategoryForm>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(cat)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={categories.length}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={p => { setPage(p); setSelectedIds(new Set()); }}
          onPageSizeChange={s => { setPageSize(s); setPage(0); }}
        />
      </Card>

      {/* Single delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              {associatedSeriesCount > 0 ? (
                <>
                  This category has <strong>{associatedSeriesCount} associated series</strong>. Deleting it may affect those series. Are you sure you want to permanently delete <strong>"{deleteTarget?.name}"</strong>?
                </>
              ) : (
                <>
                  Permanently delete <strong>"{deleteTarget?.name}"</strong>? This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteLoading} onClick={() => deleteTarget && deleteCategory(deleteTarget)}>
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={o => !o && setBulkDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} {selectedIds.size === 1 ? "Category" : "Categories"}</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{selectedIds.size} selected {selectedIds.size === 1 ? "category" : "categories"}</strong>? This may affect associated series and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={bulkDeleting} onClick={handleBulkDelete}>
              {bulkDeleting ? "Deleting..." : `Delete ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({ category, children, onSave }: { category?: Category, children: React.ReactNode, onSave: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<Category>>(category || {
    name: "", name_arabic: "", slug: "", icon_url: "", is_active: true,
    guest_access: false, free_user_access: true, premium_required: false,
    show_in_home: true, is_featured: false, order_index: 0
  });

  useEffect(() => {
    if (open) {
      setFormData(category || {
        name: "", name_arabic: "", slug: "", icon_url: "", is_active: true,
        guest_access: false, free_user_access: true, premium_required: false,
        show_in_home: true, is_featured: false, order_index: 0
      });
    }
  }, [open, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isUpdate = !!category?.id;
      let res;
      if (isUpdate) {
        res = await supabase.from("categories").update(formData).eq("id", category.id).select().single();
      } else {
        res = await supabase.from("categories").insert(formData).select().single();
      }
      if (res.error) throw res.error;
      if (profile) {
        supabase.from("admin_activity_log").insert({
          admin_id: profile.id,
          action: isUpdate ? 'category_updated' : 'category_created',
          entity_type: "category", entity_id: res.data.id,
          details: { before: category, after: res.data }
        }).then(() => {}, () => {});
      }
      toast({ title: "Success", description: "Category saved successfully" });
      onSave();
      setOpen(false);
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="sm:max-w-md overflow-y-auto bg-card border-border">
        <SheetHeader>
          <SheetTitle>{category ? "Edit Category" : "New Category"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-6">

          <ImageUpload
            value={formData.icon_url || ""}
            onChange={(url) => setFormData({...formData, icon_url: url})}
            label="Category Icon / Image"
            folder="categories"
            shape="square"
            placeholder="Upload image or paste URL"
          />

          <div className="space-y-2">
            <Label>Name (English) *</Label>
            <Input
              required
              value={formData.name || ""}
              onChange={(e) => setFormData({
                ...formData,
                name: e.target.value,
                slug: !category ? slugify(e.target.value) : formData.slug
              })}
            />
          </div>

          <div className="space-y-2">
            <Label>Name (Arabic)</Label>
            <Input
              value={formData.name_arabic || ""}
              onChange={(e) => setFormData({...formData, name_arabic: e.target.value})}
              dir="rtl"
              className="font-arabic"
              placeholder="اسم الفئة"
            />
          </div>

          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              required
              value={formData.slug || ""}
              onChange={(e) => setFormData({...formData, slug: slugify(e.target.value)})}
              placeholder="auto-generated"
            />
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold mb-4 text-foreground">Access & Visibility</h3>
            <div className="space-y-4">
              {[
                { key: "is_active" as const, label: "Active", desc: "Visible to users" },
                { key: "is_featured" as const, label: "Featured", desc: "Shown in featured sections" },
                { key: "show_in_home" as const, label: "Show in Home", desc: "Displayed on home feed" },
                { key: "guest_access" as const, label: "Guest Access", desc: "No login required", disabled: formData.premium_required },
                { key: "premium_required" as const, label: "Premium Required", desc: "Subscribers only" },
              ].map(({ key, label, desc, disabled }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="flex flex-col cursor-pointer">
                    <span className="text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground font-normal">{desc}</span>
                  </Label>
                  <Switch
                    checked={!!formData[key]}
                    disabled={disabled}
                    onCheckedChange={(c) => {
                      const update: Partial<Category> = { ...formData, [key]: c };
                      if (key === "premium_required" && c) {
                        update.free_user_access = false;
                        update.guest_access = false;
                      }
                      setFormData(update);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving..." : category ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
