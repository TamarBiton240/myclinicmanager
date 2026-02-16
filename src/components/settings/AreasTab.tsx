import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const AREA_COLORS = [
  "#94a3b8", "#6366f1", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316",
];

const AreasTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newArea, setNewArea] = useState("");

  const { data: bodyAreas = [] } = useQuery({
    queryKey: ["body-areas-config"],
    queryFn: async () => {
      const { data } = await supabase.from("body_areas_config").select("*").order("sort_order");
      return data ?? [];
    },
  });

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

  const updateAreaColor = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      await supabase.from("body_areas_config").update({ color }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["body-areas-config"] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-display">אזורי גוף</CardTitle>
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
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {AREA_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateAreaColor.mutate({ id: area.id, color: c })}
                      className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-125"
                      style={{
                        backgroundColor: c,
                        borderColor: area.color === c ? "hsl(var(--foreground))" : "transparent",
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{area.area_name}</span>
              </div>
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
  );
};

export default AreasTab;
