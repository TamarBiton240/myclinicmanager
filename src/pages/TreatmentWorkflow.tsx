import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { addMonths, format } from "date-fns";

const FULL_BODY_AREAS = ["Legs", "Arms", "Back", "Face", "Bikini"];

interface TreatmentArea {
  area_name: string;
  heat_level: string;
  pain_level: string;
  notes: string;
}

const TreatmentWorkflow = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [areaMode, setAreaMode] = useState<"single" | "fullbody">("single");
  const [areas, setAreas] = useState<TreatmentArea[]>([{ area_name: "", heat_level: "", pain_level: "", notes: "" }]);
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "debt" | "package" | "">("");
  const [setReminder, setSetReminder] = useState(true);

  const { data: appointment } = useQuery({
    queryKey: ["appointment", id],
    queryFn: async () => {
      const { data } = await supabase.from("appointments").select("*, clients(full_name)").eq("id", id!).single();
      return data;
    },
    enabled: !!id && !!user,
  });

  useEffect(() => {
    if (areaMode === "fullbody") {
      setAreas(FULL_BODY_AREAS.map((a) => ({ area_name: a, heat_level: "", pain_level: "", notes: "" })));
    } else {
      setAreas([{ area_name: "", heat_level: "", pain_level: "", notes: "" }]);
    }
  }, [areaMode]);

  const updateArea = (index: number, field: keyof TreatmentArea, value: string) => {
    setAreas((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  };

  const addArea = () => setAreas((prev) => [...prev, { area_name: "", heat_level: "", pain_level: "", notes: "" }]);

  const allAreasValid = areas.every((a) => a.area_name && a.heat_level);
  const canFinish = allAreasValid && paymentStatus !== "";

  const finishTreatment = useMutation({
    mutationFn: async () => {
      // Insert treatment areas
      const areasToInsert = areas.map((a) => ({
        appointment_id: id!,
        area_name: a.area_name,
        heat_level: parseFloat(a.heat_level),
        pain_level: a.pain_level ? parseInt(a.pain_level) : null,
        notes: a.notes || null,
      }));
      const { error: areaError } = await supabase.from("treatment_areas").insert(areasToInsert);
      if (areaError) throw areaError;

      // Update appointment
      const updateData: any = {
        is_summary_signed_off: true,
        payment_status: paymentStatus,
      };
      if (setReminder) {
        updateData.next_reminder_date = format(addMonths(new Date(), 3), "yyyy-MM-dd");
      }
      const { error: aptError } = await supabase.from("appointments").update(updateData).eq("id", id!);
      if (aptError) throw aptError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["appointment", id] });
      toast({ title: "Treatment signed off successfully!" });
      navigate("/");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!appointment) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading treatment...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-semibold">Treatment Summary</h1>
          <p className="text-muted-foreground text-sm">{appointment.clients?.full_name} — {format(new Date(appointment.scheduled_at), "MMM d, yyyy")}</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      {/* Step 1: Areas */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Step 1: Treatment Areas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Button variant={areaMode === "single" ? "default" : "outline"} size="sm" onClick={() => setAreaMode("single")}>
                Custom Areas
              </Button>
              <Button variant={areaMode === "fullbody" ? "default" : "outline"} size="sm" onClick={() => setAreaMode("fullbody")}>
                Full Body
              </Button>
            </div>

            {areas.map((area, i) => (
              <div key={i} className="p-4 rounded-lg bg-secondary/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Area {i + 1}</Badge>
                  {areaMode === "fullbody" && <span className="font-medium text-sm">{area.area_name}</span>}
                </div>
                {areaMode === "single" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Area Name *</Label>
                    <Input value={area.area_name} onChange={(e) => updateArea(i, "area_name", e.target.value)} placeholder="e.g. Upper Lip" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Heat/Energy Level *</Label>
                    <Input type="number" value={area.heat_level} onChange={(e) => updateArea(i, "heat_level", e.target.value)} placeholder="e.g. 25" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Pain Level (1-10)</Label>
                    <Input type="number" min="1" max="10" value={area.pain_level} onChange={(e) => updateArea(i, "pain_level", e.target.value)} placeholder="1-10" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={area.notes} onChange={(e) => updateArea(i, "notes", e.target.value)} rows={2} placeholder="Optional notes..." />
                </div>
              </div>
            ))}

            {areaMode === "single" && (
              <Button variant="outline" size="sm" onClick={addArea}>+ Add Area</Button>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!allAreasValid}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Financials */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Step 2: Payment Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(["paid", "debt", "package"] as const).map((status) => (
                <Button
                  key={status}
                  variant={paymentStatus === status ? "default" : "outline"}
                  className="capitalize"
                  onClick={() => setPaymentStatus(status)}
                >
                  {status}
                </Button>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!paymentStatus}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Retention */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">Step 3: Follow-Up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">Set next treatment reminder</p>
                <p className="text-xs text-muted-foreground">Auto-set to {format(addMonths(new Date(), 3), "MMMM d, yyyy")}</p>
              </div>
              <Switch checked={setReminder} onCheckedChange={setSetReminder} />
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => finishTreatment.mutate()} disabled={!canFinish || finishTreatment.isPending}>
                <Check className="w-4 h-4 mr-1" />
                {finishTreatment.isPending ? "Saving..." : "Finish Treatment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TreatmentWorkflow;
