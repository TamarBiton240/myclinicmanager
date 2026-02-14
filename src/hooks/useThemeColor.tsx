import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_PRIMARY_HSL = "100 24% 54%";

// Predefined color presets (HSL values)
export const COLOR_PRESETS = [
  { name: "ירוק מרווה", hsl: "100 24% 54%" },
  { name: "כחול רך", hsl: "210 60% 50%" },
  { name: "ורוד עתיק", hsl: "340 40% 55%" },
  { name: "סגול לבנדר", hsl: "270 40% 55%" },
  { name: "כתום חם", hsl: "25 80% 55%" },
  { name: "טורקיז", hsl: "175 50% 45%" },
];

export const useThemeColor = () => {
  const queryClient = useQueryClient();

  const { data: primaryColor = DEFAULT_PRIMARY_HSL } = useQuery({
    queryKey: ["clinic-theme-color"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_settings")
        .select("setting_value")
        .eq("setting_key", "primary_color")
        .single();
      return (data?.setting_value as string) || DEFAULT_PRIMARY_HSL;
    },
  });

  // Apply the color to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", primaryColor);
    root.style.setProperty("--ring", primaryColor);
    root.style.setProperty("--sidebar-primary", primaryColor);
    root.style.setProperty("--sidebar-ring", primaryColor);
    root.style.setProperty("--chart-laser", primaryColor);
    root.style.setProperty("--success", primaryColor);
  }, [primaryColor]);

  const updateColor = useMutation({
    mutationFn: async (newColor: string) => {
      const { data: existing } = await supabase
        .from("clinic_settings")
        .select("id")
        .eq("setting_key", "primary_color")
        .single();

      if (existing) {
        await supabase
          .from("clinic_settings")
          .update({ setting_value: JSON.stringify(newColor) })
          .eq("setting_key", "primary_color");
      } else {
        await supabase
          .from("clinic_settings")
          .insert({ setting_key: "primary_color", setting_value: JSON.stringify(newColor) });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-theme-color"] });
    },
  });

  return { primaryColor, updateColor };
};
