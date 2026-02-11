import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MessageCircle, Phone } from "lucide-react";
import { format } from "date-fns";

const Clients = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", date_of_birth: "", medical_notes: "" });

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
        ...form,
        user_id: user!.id,
        date_of_birth: form.date_of_birth || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDialogOpen(false);
      setForm({ full_name: "", phone: "", email: "", date_of_birth: "", medical_notes: "" });
      toast({ title: "Client added successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
        <h1 className="text-3xl font-display font-semibold">Clients</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">New Client</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); addClient.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1234567890" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Medical Notes</Label>
                <Textarea value={form.medical_notes} onChange={(e) => setForm({ ...form, medical_notes: e.target.value })} rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={addClient.isPending}>
                {addClient.isPending ? "Adding..." : "Add Client"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">DOB</TableHead>
                <TableHead className="hidden lg:table-cell">Medical Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {isLoading ? "Loading..." : "No clients found."}
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
                    <TableCell className="hidden md:table-cell text-sm">{client.email}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {client.date_of_birth ? format(new Date(client.date_of_birth), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm max-w-[200px] truncate">
                      {client.medical_notes || "—"}
                    </TableCell>
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
