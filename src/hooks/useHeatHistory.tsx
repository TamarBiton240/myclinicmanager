import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HeatHistoryEntry {
  area_name: string;
  heat_level: number;
  scheduled_at: string;
}

export const useHeatHistory = (clientId: string | undefined) => {
  return useQuery({
    queryKey: ["heat-history", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      // Get last treatment areas for this client via appointments
      const { data } = await supabase
        .from("appointments")
        .select("scheduled_at, treatment_areas(area_name, heat_level)")
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: false })
        .limit(5);

      if (!data) return [];

      // Flatten and deduplicate by area_name (keep most recent)
      const seen = new Set<string>();
      const history: HeatHistoryEntry[] = [];
      for (const apt of data) {
        for (const area of (apt.treatment_areas || []) as any[]) {
          if (!seen.has(area.area_name)) {
            seen.add(area.area_name);
            history.push({
              area_name: area.area_name,
              heat_level: area.heat_level,
              scheduled_at: apt.scheduled_at,
            });
          }
        }
      }
      return history;
    },
    enabled: !!clientId,
  });
};

