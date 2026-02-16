import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const STAFF_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
];

const StaffTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: staffMembers = [] } = useQuery({
    queryKey: ["all-staff"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name, phone, color, is_active");
      if (!data) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return data.map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.user_id)?.role || "staff",
      }));
    },
  });

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

  const updateStaff = useMutation({
    mutationFn: async ({ userId, field, value }: { userId: string; field: string; value: any }) => {
      await supabase.from("profiles").update({ [field]: value }).eq("user_id", userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-staff"] });
      toast({ title: "עודכן" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg font-display">חברי צוות</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>צבע</TableHead>
                <TableHead>שם</TableHead>
                <TableHead>טלפון</TableHead>
                <TableHead>תפקיד</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>משמרות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffMembers.map((s: any) => (
                <TableRow key={s.user_id} className={!s.is_active ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {STAFF_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateStaff.mutate({ userId: s.user_id, field: "color", value: c })}
                          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: c,
                            borderColor: s.color === c ? "hsl(var(--foreground))" : "transparent",
                          }}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{s.full_name || "ללא שם"}</TableCell>
                  <TableCell className="text-sm">{s.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={s.role === "admin" ? "default" : "secondary"}>
                      {s.role === "admin" ? "מנהל" : "צוות"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={s.is_active ? "outline" : "default"}
                      size="sm"
                      onClick={() => updateStaff.mutate({ userId: s.user_id, field: "is_active", value: !s.is_active })}
                    >
                      {s.is_active ? "פעיל" : "לא פעיל"}
                    </Button>
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

      <Dialog open={!!selectedStaff} onOpenChange={(open) => !open && setSelectedStaff(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              שעות עבודה — {staffMembers.find((s: any) => s.user_id === selectedStaff)?.full_name}
            </DialogTitle>
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
    </div>
  );
};

export default StaffTab;
