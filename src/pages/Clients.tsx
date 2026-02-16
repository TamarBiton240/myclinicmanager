import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MessageCircle, Pencil, Trash2, ClipboardList } from "lucide-react";

const Clients = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [plansDialogClient, setPlansDialogClient] = useState<any>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", notes: "" });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("full_name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: treatmentPlans = [] } = useQuery({
    queryKey: ["treatment-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("treatment_plans").select("*").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: clientPlans = [] } = useQuery({
    queryKey: ["client-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("client_plans").select("*");
      return data ?? [];
    },
    enabled: !!user,
  });

  const saveClient = useMutation({
    mutationFn: async () => {
      const clientData = {
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || "",
      };

      if (editingClient) {
        const { error } = await supabase.from("clients").update(clientData).eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({ ...clientData, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      closeDialog();
      toast({ title: editingClient ? "לקוחה עודכנה" : "לקוחה נוספה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "לקוחה נמחקה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const toggleClientPlan = useMutation({
    mutationFn: async ({ clientId, planId, isAssigned }: { clientId: string; planId: string; isAssigned: boolean }) => {
      if (isAssigned) {
        await supabase.from("client_plans").delete().eq("client_id", clientId).eq("plan_id", planId);
      } else {
        await supabase.from("client_plans").insert({ client_id: clientId, plan_id: planId });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-plans"] }),
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const openEdit = (client: any) => {
    setForm({
      full_name: client.full_name,
      phone: client.phone || "",
      email: client.email || "",
      notes: client.notes || "",
    });
    setEditingClient(client);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
    setForm({ full_name: "", phone: "", email: "", notes: "" });
  };

  const filtered = clients.filter((c: any) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

  const getClientPlans = (clientId: string) => {
    const planIds = clientPlans.filter((cp: any) => cp.client_id === clientId).map((cp: any) => cp.plan_id);
    return treatmentPlans.filter((p: any) => planIds.includes(p.id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-display font-semibold">לקוחות</h1>
        <Button onClick={() => { closeDialog(); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 ml-2" />לקוחה חדשה
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="חיפוש לקוחות..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead className="hidden sm:table-cell">טלפון</TableHead>
                <TableHead className="hidden md:table-cell">תוכניות</TableHead>
                <TableHead className="hidden lg:table-cell">הערות</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {isLoading ? "טוען..." : "לא נמצאו לקוחות."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((client: any) => {
                  const plans = getClientPlans(client.id);
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.full_name}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {client.phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{client.phone}</span>
                            <a href={whatsappLink(client.phone)} target="_blank" rel="noopener noreferrer" className="text-success hover:opacity-80">
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {plans.map((p: any) => (
                            <Badge key={p.id} variant="secondary" className="text-xs" style={{ borderLeftColor: p.color, borderLeftWidth: 3 }}>
                              {p.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground line-clamp-1">{client.notes || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setPlansDialogClient(client)}>
                            <ClipboardList className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(client)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (confirm("למחוק את הלקוחה?")) deleteClient.mutate(client.id);
                          }}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editingClient ? "עריכת לקוחה" : "לקוחה חדשה"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveClient.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>שם מלא *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>טלפון</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+972..." />
              </div>
              <div className="space-y-2">
                <Label>אימייל</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="הערות על הלקוחה..." rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={saveClient.isPending}>
              {saveClient.isPending ? "שומר..." : editingClient ? "עדכן" : "הוסף לקוחה"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Plans Dialog */}
      <Dialog open={!!plansDialogClient} onOpenChange={(open) => !open && setPlansDialogClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              תוכניות טיפול — {plansDialogClient?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {treatmentPlans.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">אין תוכניות טיפול. הוסיפי דרך ההגדרות.</p>
            )}
            {treatmentPlans.map((plan: any) => {
              const isAssigned = clientPlans.some(
                (cp: any) => cp.client_id === plansDialogClient?.id && cp.plan_id === plan.id
              );
              return (
                <label
                  key={plan.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 cursor-pointer hover:bg-secondary/50"
                >
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={() => {
                      if (plansDialogClient) {
                        toggleClientPlan.mutate({
                          clientId: plansDialogClient.id,
                          planId: plan.id,
                          isAssigned,
                        });
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }} />
                    <span className="text-sm font-medium">{plan.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {plan.treatment_type === "laser" ? "לייזר" : "אפילציה"}
                    </Badge>
                    {plan.price > 0 && <Badge variant="secondary" className="text-xs">₪{plan.price}</Badge>}
                  </div>
                </label>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clients;
