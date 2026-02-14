import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { validateHeatLevel } from "@/lib/validateHeatLevel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface TreatmentArea {
  area_name: string;
  heat_level: string;
}

const TreatmentWorkflow = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [areaMode, setAreaMode] = useState<"single" | "fullbody">("single");
  const [areas, setAreas] = useState<TreatmentArea[]>([{ area_name: "", heat_level: "" }]);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "debt" | "">("");

  const { data: bodyAreasConfig = [] } = useQuery({
    queryKey: ["body-areas-config"],
    queryFn: async () => {
      const { data } = await supabase.from("body_areas_config").select("*").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
    enabled: !!user,
  });

  const fullBodyAreas = bodyAreasConfig.map((a: any) => a.area_name);

  const { data: appointment } = useQuery({
    queryKey: ["appointment", id],
    queryFn: async () => {
      const { data } = await supabase.from("appointments").select("*, clients(full_name)").eq("id", id!).single();
      return data;
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (areaMode === "fullbody" && fullBodyAreas.length > 0) {
      setAreas(fullBodyAreas.map((a: string) => ({ area_name: a, heat_level: "" })));
    } else if (areaMode === "single") {
      setAreas([{ area_name: "", heat_level: "" }]);
    }
  }, [areaMode, bodyAreasConfig]);

  const updateArea = (index: number, field: keyof TreatmentArea, value: string) => {
    setAreas((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const allAreasValid = areas.every((a) => a.area_name && a.heat_level);
  const canFinish = allAreasValid && paymentStatus !== "";

  const finishTreatment = useMutation({
    mutationFn: async () => {
      const areasToInsert = areas.map((a) => ({ appointment_id: id!, area_name: a.area_name, heat_level: validateHeatLevel(a.heat_level) }));
      const { error: areaError } = await supabase.from("treatment_areas").insert(areasToInsert);
      if (areaError) throw areaError;
      const { error: aptError } = await supabase.from("appointments").update({ payment_status: paymentStatus as "paid" | "debt" }).eq("id", id!);
      if (aptError) throw aptError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      toast({ title: "טיפול הושלם בהצלחה!" });
      navigate("/");
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  if (!appointment) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">טוען טיפול...</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowRight className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-display font-semibold">סיכום טיפול</h1>
          <p className="text-muted-foreground text-sm">{appointment.clients?.full_name} — {format(new Date(appointment.scheduled_at), "d בMMMM yyyy", { locale: he })}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2].map((s) => <div key={s} className={`flex-1 h-2 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />)}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-lg font-display">שלב 1: אזורי טיפול ורמות חום</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {appointment.treatment_type === "laser" && (
              <div className="flex items-center gap-4">
                <Button variant={areaMode === "single" ? "default" : "outline"} size="sm" onClick={() => setAreaMode("single")}>אזורים מותאמים</Button>
                <Button variant={areaMode === "fullbody" ? "default" : "outline"} size="sm" onClick={() => setAreaMode("fullbody")}>גוף מלא</Button>
              </div>
            )}
            {areas.map((area, i) => (
              <div key={i} className="p-4 rounded-lg bg-secondary/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">אזור {i + 1}</Badge>
                  {areaMode === "fullbody" && <span className="font-medium text-sm">{area.area_name}</span>}
                </div>
                {(areaMode === "single" || appointment.treatment_type === "electrolysis") && (
                  <div className="space-y-1">
                    <Label className="text-xs">שם אזור *</Label>
                    <Input value={area.area_name} onChange={(e) => updateArea(i, "area_name", e.target.value)} placeholder="למשל שפה עליונה" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">רמת חום/אנרגיה *</Label>
                  <Input type="number" value={area.heat_level} onChange={(e) => updateArea(i, "heat_level", e.target.value)} placeholder="למשל 25" />
                </div>
              </div>
            ))}
            {(areaMode === "single" || appointment.treatment_type === "electrolysis") && (
              <Button variant="outline" size="sm" onClick={() => setAreas([...areas, { area_name: "", heat_level: "" }])}>+ הוסף אזור</Button>
            )}
            <div className="flex justify-start">
              <Button onClick={() => setStep(2)} disabled={!allAreasValid}>הבא <ArrowLeft className="w-4 h-4 mr-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-lg font-display">שלב 2: סטטוס תשלום</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {([{ v: "paid", l: "שולם" }, { v: "debt", l: "חוב" }] as const).map(({ v, l }) => (
                <Button key={v} variant={paymentStatus === v ? "default" : "outline"} onClick={() => setPaymentStatus(v)}>{l}</Button>
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowRight className="w-4 h-4 ml-1" /> חזרה</Button>
              <Button onClick={() => finishTreatment.mutate()} disabled={!canFinish || finishTreatment.isPending}>
                <Check className="w-4 h-4 ml-1" />
                {finishTreatment.isPending ? "שומר..." : "סיים טיפול"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TreatmentWorkflow;
