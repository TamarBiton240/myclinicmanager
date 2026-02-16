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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { format, addMonths } from "date-fns";
import { he } from "date-fns/locale";

interface TreatmentArea {
  area_name: string;
  heat_level: string;
  pain_level: string;
}

const TreatmentWorkflow = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [areaMode, setAreaMode] = useState<"single" | "fullbody">("single");
  const [areas, setAreas] = useState<TreatmentArea[]>([{ area_name: "", heat_level: "", pain_level: "" }]);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "partial" | "debt" | "">("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [wantsReminder, setWantsReminder] = useState(false);
  const [reminderMonths, setReminderMonths] = useState("3");
  const [notes, setNotes] = useState("");

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
      const { data } = await supabase.from("appointments").select("*, clients(full_name, id)").eq("id", id!).single();
      return data;
    },
    enabled: !!id && !!user,
  });

  // Get treatment number for each area
  const { data: previousTreatments = [] } = useQuery({
    queryKey: ["prev-treatments", appointment?.client_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatment_areas")
        .select("area_name, heat_level, appointments!inner(client_id, status)")
        .eq("appointments.client_id", appointment!.client_id)
        .eq("appointments.status", "closed");
      return data ?? [];
    },
    enabled: !!appointment?.client_id,
  });

  const getTreatmentNumber = (areaName: string) => {
    return previousTreatments.filter((t: any) => t.area_name === areaName).length + 1;
  };

  const getLastHeatLevel = (areaName: string) => {
    const prev = previousTreatments.filter((t: any) => t.area_name === areaName);
    return prev.length > 0 ? prev[prev.length - 1].heat_level : null;
  };

  useEffect(() => {
    if (areaMode === "fullbody" && fullBodyAreas.length > 0) {
      setAreas(fullBodyAreas.map((a: string) => ({ area_name: a, heat_level: "", pain_level: "" })));
    } else if (areaMode === "single") {
      setAreas([{ area_name: "", heat_level: "", pain_level: "" }]);
    }
  }, [areaMode, bodyAreasConfig]);

  const updateArea = (index: number, field: keyof TreatmentArea, value: string) => {
    setAreas((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const allAreasValid = areas.every((a) => a.area_name && a.heat_level && a.pain_level);
  const canFinish = allAreasValid && paymentStatus !== "";

  const finishTreatment = useMutation({
    mutationFn: async () => {
      // Insert treatment areas with pain level and treatment number
      const areasToInsert = areas.map((a) => ({
        appointment_id: id!,
        area_name: a.area_name,
        heat_level: validateHeatLevel(a.heat_level),
        pain_level: parseFloat(a.pain_level) || 0,
        treatment_number: getTreatmentNumber(a.area_name),
      }));
      const { error: areaError } = await supabase.from("treatment_areas").insert(areasToInsert);
      if (areaError) throw areaError;

      // Update appointment
      const updateData: any = {
        payment_status: paymentStatus,
        payment_amount: parseFloat(paymentAmount) || 0,
        status: "closed",
        notes,
        reminder_requested: wantsReminder,
      };

      if (wantsReminder) {
        updateData.reminder_date = addMonths(new Date(), parseInt(reminderMonths)).toISOString();
      }

      const { error: aptError } = await supabase.from("appointments").update(updateData).eq("id", id!);
      if (aptError) throw aptError;

      // If reminder requested, create future appointment
      if (wantsReminder && appointment) {
        const reminderDate = addMonths(new Date(), parseInt(reminderMonths));
        await supabase.from("appointments").insert({
          client_id: appointment.client_id,
          treatment_type: appointment.treatment_type,
          scheduled_at: reminderDate.toISOString(),
          user_id: user!.id,
          staff_member_id: appointment.staff_member_id,
          plan_id: appointment.plan_id,
          status: "open",
        });
      }
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
          <h1 className="text-2xl font-display font-semibold">סיום טיפול</h1>
          <p className="text-muted-foreground text-sm">
            {appointment.clients?.full_name} — {format(new Date(appointment.scheduled_at), "d בMMMM yyyy", { locale: he })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => <div key={s} className={`flex-1 h-2 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />)}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-lg font-display">שלב 1: אזורי טיפול, חום וכאב</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {appointment.treatment_type === "laser" && (
              <div className="flex items-center gap-4">
                <Button variant={areaMode === "single" ? "default" : "outline"} size="sm" onClick={() => setAreaMode("single")}>אזורים מותאמים</Button>
                <Button variant={areaMode === "fullbody" ? "default" : "outline"} size="sm" onClick={() => setAreaMode("fullbody")}>גוף מלא</Button>
              </div>
            )}
            {areas.map((area, i) => {
              const lastHeat = getLastHeatLevel(area.area_name);
              const treatNum = getTreatmentNumber(area.area_name);
              return (
                <div key={i} className="p-4 rounded-lg bg-secondary/50 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">אזור {i + 1}</Badge>
                    {areaMode === "fullbody" && <span className="font-medium text-sm">{area.area_name}</span>}
                    {area.area_name && (
                      <Badge variant="outline" className="text-xs">טיפול #{treatNum}</Badge>
                    )}
                    {lastHeat !== null && (
                      <Badge variant="outline" className="text-xs bg-warning/10">חום קודם: {lastHeat}</Badge>
                    )}
                  </div>
                  {(areaMode === "single" || appointment.treatment_type === "electrolysis") && (
                    <div className="space-y-1">
                      <Label className="text-xs">שם אזור *</Label>
                      <Input value={area.area_name} onChange={(e) => updateArea(i, "area_name", e.target.value)} placeholder="למשל שפה עליונה" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">רמת חום/אנרגיה *</Label>
                      <Input type="number" value={area.heat_level} onChange={(e) => updateArea(i, "heat_level", e.target.value)} placeholder="0-100" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">רמת כאב (1-10) *</Label>
                      <Input type="number" value={area.pain_level} onChange={(e) => updateArea(i, "pain_level", e.target.value)} placeholder="1-10" min="1" max="10" />
                    </div>
                  </div>
                </div>
              );
            })}
            {(areaMode === "single" || appointment.treatment_type === "electrolysis") && (
              <Button variant="outline" size="sm" onClick={() => setAreas([...areas, { area_name: "", heat_level: "", pain_level: "" }])}>+ הוסף אזור</Button>
            )}
            <div className="flex justify-start">
              <Button onClick={() => setStep(2)} disabled={!allAreasValid}>הבא <ArrowLeft className="w-4 h-4 mr-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-lg font-display">שלב 2: תשלום</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {([
                { v: "paid" as const, l: "שולם מלא" },
                { v: "partial" as const, l: "שולם חלקי" },
                { v: "debt" as const, l: "חוב" },
              ]).map(({ v, l }) => (
                <Button key={v} variant={paymentStatus === v ? "default" : "outline"} onClick={() => setPaymentStatus(v)}>{l}</Button>
              ))}
            </div>
            {(paymentStatus === "paid" || paymentStatus === "partial") && (
              <div className="space-y-2">
                <Label>סכום ששולם (₪)</Label>
                <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" />
              </div>
            )}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowRight className="w-4 h-4 ml-1" /> חזרה</Button>
              <Button onClick={() => setStep(3)} disabled={!paymentStatus}>הבא <ArrowLeft className="w-4 h-4 mr-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-lg font-display">שלב 3: תזכורת והערות</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
              <Label>האם הלקוחה רוצה תזכורת לטיפול הבא?</Label>
              <Switch checked={wantsReminder} onCheckedChange={setWantsReminder} />
            </div>
            {wantsReminder && (
              <div className="space-y-2">
                <Label>בעוד כמה חודשים?</Label>
                <div className="flex gap-2">
                  {["1", "2", "3", "4", "6"].map((m) => (
                    <Button
                      key={m}
                      variant={reminderMonths === m ? "default" : "outline"}
                      size="sm"
                      onClick={() => setReminderMonths(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות לטיפול..." rows={3} />
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowRight className="w-4 h-4 ml-1" /> חזרה</Button>
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
