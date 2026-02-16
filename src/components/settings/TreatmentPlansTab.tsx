import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil } from "lucide-react";

const PLAN_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
];

const TreatmentPlansTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    treatment_type: "laser" as "laser" | "electrolysis",
    price: "",
    color: "#6366f1",
    selectedAreas: [] as string[],
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["treatment-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("treatment_plans").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: planAreas = [] } = useQuery({
    queryKey: ["treatment-plan-areas"],
    queryFn: async () => {
      const { data } = await supabase.from("treatment_plan_areas").select("*");
      return data ?? [];
    },
  });

  const { data: bodyAreas = [] } = useQuery({
    queryKey: ["body-areas-config"],
    queryFn: async () => {
      const { data } = await supabase.from("body_areas_config").select("*").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      const planData = {
        name: form.name,
        treatment_type: form.treatment_type,
        price: parseFloat(form.price) || 0,
        color: form.color,
      };

      let planId: string;
      if (editingPlan) {
        await supabase.from("treatment_plans").update(planData).eq("id", editingPlan.id);
        planId = editingPlan.id;
        // Delete old areas
        await supabase.from("treatment_plan_areas").delete().eq("plan_id", planId);
      } else {
        const { data, error } = await supabase.from("treatment_plans").insert(planData).select("id").single();
        if (error) throw error;
        planId = data.id;
      }

      // Insert new areas
      if (form.selectedAreas.length > 0) {
        await supabase.from("treatment_plan_areas").insert(
          form.selectedAreas.map((areaId) => ({ plan_id: planId, area_id: areaId }))
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
      queryClient.invalidateQueries({ queryKey: ["treatment-plan-areas"] });
      closeDialog();
      toast({ title: editingPlan ? "תוכנית עודכנה" : "תוכנית נוספה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const togglePlan = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from("treatment_plans").update({ is_active: !is_active }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["treatment-plans"] }),
  });

  const openEdit = (plan: any) => {
    const areas = planAreas.filter((pa: any) => pa.plan_id === plan.id).map((pa: any) => pa.area_id);
    setForm({
      name: plan.name,
      treatment_type: plan.treatment_type,
      price: plan.price?.toString() || "",
      color: plan.color || "#6366f1",
      selectedAreas: areas,
    });
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPlan(null);
    setForm({ name: "", treatment_type: "laser", price: "", color: "#6366f1", selectedAreas: [] });
  };

  const toggleAreaSelection = (areaId: string) => {
    setForm((prev) => ({
      ...prev,
      selectedAreas: prev.selectedAreas.includes(areaId)
        ? prev.selectedAreas.filter((id) => id !== areaId)
        : [...prev.selectedAreas, areaId],
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-display">תוכניות טיפול</CardTitle>
          <Button size="sm" onClick={() => { closeDialog(); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 ml-1" /> תוכנית חדשה
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {plans.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">אין תוכניות עדיין</p>}
          {plans.map((plan: any) => (
            <div
              key={plan.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${plan.is_active ? "bg-secondary/30" : "bg-muted/30 opacity-50"}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: plan.color }} />
                <div>
                  <span className="font-medium text-sm">{plan.name}</span>
                  <div className="flex gap-1.5 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {plan.treatment_type === "laser" ? "לייזר" : "אפילציה"}
                    </Badge>
                    {plan.price > 0 && (
                      <Badge variant="secondary" className="text-xs">₪{plan.price}</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {planAreas.filter((pa: any) => pa.plan_id === plan.id).length} אזורים
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant={plan.is_active ? "outline" : "default"}
                  size="sm"
                  onClick={() => togglePlan.mutate({ id: plan.id, is_active: plan.is_active })}
                >
                  {plan.is_active ? "השבת" : "הפעל"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingPlan ? "עריכת תוכנית" : "תוכנית טיפול חדשה"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); savePlan.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>שם התוכנית *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>סוג טיפול</Label>
                <Select value={form.treatment_type} onValueChange={(v: any) => setForm({ ...form, treatment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laser">לייזר</SelectItem>
                    <SelectItem value="electrolysis">אפילציה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>מחיר (₪)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>צבע</Label>
              <div className="flex gap-2 flex-wrap">
                {PLAN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? "hsl(var(--foreground))" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>אזורים בתוכנית</Label>
              <div className="grid grid-cols-2 gap-2">
                {bodyAreas.map((area: any) => (
                  <label key={area.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30 cursor-pointer hover:bg-secondary/50">
                    <Checkbox
                      checked={form.selectedAreas.includes(area.id)}
                      onCheckedChange={() => toggleAreaSelection(area.id)}
                    />
                    <span className="text-sm">{area.area_name}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={!form.name.trim() || savePlan.isPending}>
              {savePlan.isPending ? "שומר..." : editingPlan ? "עדכן" : "הוסף"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TreatmentPlansTab;
