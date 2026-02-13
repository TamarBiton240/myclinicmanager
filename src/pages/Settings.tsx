import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserCog, Scissors, Palette } from "lucide-react";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const Settings = () => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Body areas
  const { data: bodyAreas = [] } = useQuery({
    queryKey: ["body-areas-config"],
    queryFn: async () => {
      const { data } = await supabase.from("body_areas_config").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const [newArea, setNewArea] = useState("");

  const addArea = useMutation({
    mutationFn: async () => {
      const maxOrder = bodyAreas.length > 0 ? Math.max(...bodyAreas.map((a: any) => a.sort_order)) + 1 : 1;
      await supabase.from("body_areas_config").insert({ area_name: newArea, sort_order: maxOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-areas-config"] });
      setNewArea("");
      toast({ title: "אזור נוסף" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const toggleArea = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await supabase.from("body_areas_config").update({ is_active: !is_active }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["body-areas-config"] }),
  });

  // Staff
  const { data: staffMembers = [] } = useQuery({
    queryKey: ["all-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, phone");
      if (!data) return [];
      // Get roles
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return data.map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.user_id)?.role || "staff",
      }));
    },
  });

  // Staff working hours
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const { data: workingHours = [] } = useQuery({
    queryKey: ["working-hours", selectedStaff],
    queryFn: async () => {
      const { data } = await supabase.from("staff_working_hours").select("*").eq("staff_user_id", selectedStaff!).order("day_of_week");
      return data ?? [];
    },
    enabled: !!selectedStaff,
  });

  const updateHours = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      await supabase.from("staff_working_hours").update({ [field]: value }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["working-hours"] }),
  });

  if (role !== "admin") {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">אין לך הרשאות לצפות בעמוד זה.</p></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-display font-semibold">הגדרות</h1>

      <Tabs defaultValue="staff">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="staff"><UserCog className="w-3.5 h-3.5 ml-1" /> צוות</TabsTrigger>
          <TabsTrigger value="areas"><Scissors className="w-3.5 h-3.5 ml-1" /> אזורי גוף</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg font-display">חברי צוות</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>טלפון</TableHead>
                    <TableHead>תפקיד</TableHead>
                    <TableHead>משמרות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffMembers.map((s: any) => (
                    <TableRow key={s.user_id}>
                      <TableCell className="font-medium">{s.full_name || "ללא שם"}</TableCell>
                      <TableCell className="text-sm">{s.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.role === "admin" ? "default" : "secondary"}>
                          {s.role === "admin" ? "מנהל" : "צוות"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setSelectedStaff(s.user_id)}>
                          הגדר שעות
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Working hours dialog */}
          <Dialog open={!!selectedStaff} onOpenChange={(open) => !open && setSelectedStaff(null)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">שעות עבודה — {staffMembers.find((s: any) => s.user_id === selectedStaff)?.full_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {workingHours.map((wh: any) => (
                  <div key={wh.id} className={`p-3 rounded-lg space-y-2 ${wh.is_working ? "bg-secondary/50" : "bg-muted/30 opacity-60"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{DAY_NAMES[wh.day_of_week]}</span>
                      <Button
                        variant={wh.is_working ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateHours.mutate({ id: wh.id, field: "is_working", value: !wh.is_working })}
                      >
                        {wh.is_working ? "עובד/ת" : "לא עובד/ת"}
                      </Button>
                    </div>
                    {wh.is_working && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">שעת התחלה</Label>
                          <Input
                            type="time"
                            value={wh.start_time?.slice(0, 5)}
                            onChange={(e) => updateHours.mutate({ id: wh.id, field: "start_time", value: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">שעת סיום</Label>
                          <Input
                            type="time"
                            value={wh.end_time?.slice(0, 5)}
                            onChange={(e) => updateHours.mutate({ id: wh.id, field: "end_time", value: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="areas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-display">אזורי גוף — "גוף מלא" בלייזר</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="שם אזור חדש..." />
                <Button onClick={() => addArea.mutate()} disabled={!newArea.trim() || addArea.isPending}>
                  <Plus className="w-4 h-4 ml-1" /> הוסף
                </Button>
              </div>
              <div className="space-y-2">
                {bodyAreas.map((area: any) => (
                  <div key={area.id} className={`flex items-center justify-between p-3 rounded-lg ${area.is_active ? "bg-secondary/50" : "bg-muted/30 opacity-60"}`}>
                    <span className="text-sm font-medium">{area.area_name}</span>
                    <Button
                      variant={area.is_active ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleArea.mutate({ id: area.id, is_active: area.is_active })}
                    >
                      {area.is_active ? "השבת" : "הפעל"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
