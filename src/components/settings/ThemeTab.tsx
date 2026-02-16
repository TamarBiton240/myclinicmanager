import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useThemeColor, COLOR_PRESETS } from "@/hooks/useThemeColor";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

const ThemeTab = () => {
  const { primaryColor, updateColor } = useThemeColor();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pinInput, setPinInput] = useState("");

  const { data: currentPin } = useQuery({
    queryKey: ["admin-pin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_settings")
        .select("setting_value")
        .eq("setting_key", "admin_pin")
        .single();
      return (data?.setting_value as string) || "1234";
    },
  });

  const updatePin = useMutation({
    mutationFn: async (newPin: string) => {
      const { data: existing } = await supabase
        .from("clinic_settings")
        .select("id")
        .eq("setting_key", "admin_pin")
        .single();

      if (existing) {
        await supabase.from("clinic_settings")
          .update({ setting_value: JSON.stringify(newPin) })
          .eq("setting_key", "admin_pin");
      } else {
        await supabase.from("clinic_settings")
          .insert({ setting_key: "admin_pin", setting_value: JSON.stringify(newPin) });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pin"] });
      setPinInput("");
      toast({ title: "קוד עודכן" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">צבע ראשי</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hsl}
                onClick={() => updateColor.mutate(preset.hsl)}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className={`w-12 h-12 rounded-xl border-2 transition-all flex items-center justify-center ${
                    primaryColor === preset.hsl ? "border-foreground scale-110 shadow-lg" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: `hsl(${preset.hsl})` }}
                >
                  {primaryColor === preset.hsl && <Check className="w-5 h-5 text-white" />}
                </div>
                <span className="text-xs text-muted-foreground">{preset.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">קוד גישה להגדרות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">קוד נוכחי: {currentPin}</p>
          <div className="flex gap-2">
            <Input
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="קוד חדש..."
              maxLength={10}
            />
            <Button
              onClick={() => updatePin.mutate(pinInput)}
              disabled={!pinInput.trim() || updatePin.isPending}
            >
              עדכן
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThemeTab;
