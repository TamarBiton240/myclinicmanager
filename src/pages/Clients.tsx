import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MessageCircle } from "lucide-react";

const Clients = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("full_name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const addClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({
        full_name: form.full_name,
        phone: form.phone || null,
        email: form.email || null,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDialogOpen(false);
      setForm({ full_name: "", phone: "", email: "" });
      toast({ title: "לקוח נוסף בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const filtered = clients.filter((c: any) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const whatsappLink = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-display font-semibold">לקוחות</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-2" />לקוח חדש</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">לקוח חדש</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); addClient.mutate(); }} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={addClient.isPending}>
                {addClient.isPending ? "מוסיף..." : "הוסף לקוח"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
                <TableHead className="hidden md:table-cell">אימייל</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    {isLoading ? "טוען..." : "לא נמצאו לקוחות."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((client: any) => (
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
                    <TableCell className="hidden md:table-cell text-sm">{client.email || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Clients;
