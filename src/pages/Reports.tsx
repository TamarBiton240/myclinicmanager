import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { DollarSign, UserCheck } from "lucide-react";

const Reports = () => {
  const { user } = useAuth();

  // Unpaid debts
  const { data: debts = [] } = useQuery({
    queryKey: ["debts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name), treatment_areas(area_name, heat_level)")
        .eq("payment_status", "debt")
        .order("scheduled_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  // All treatments for overview
  const { data: recentTreatments = [] } = useQuery({
    queryKey: ["recent-treatments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name), treatment_areas(area_name, heat_level)")
        .order("scheduled_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!user,
  });

  const ReportList = ({ items, emptyText, renderItem }: { items: any[]; emptyText: string; renderItem: (item: any) => React.ReactNode }) => (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{emptyText}</p>
      ) : (
        items.map(renderItem)
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-display font-semibold">Reports</h1>

      <Tabs defaultValue="debts">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="debts" className="text-xs sm:text-sm">
            <DollarSign className="w-3.5 h-3.5 mr-1" /> Unpaid ({debts.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            <UserCheck className="w-3.5 h-3.5 mr-1" /> Recent ({recentTreatments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debts">
          <Card>
            <CardHeader><CardTitle className="text-lg font-display">Unpaid Debts</CardTitle></CardHeader>
            <CardContent>
              <ReportList
                items={debts}
                emptyText="No unpaid debts. 🎉"
                renderItem={(item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5">
                    <div>
                      <p className="font-medium text-sm">{item.clients?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.scheduled_at), "MMM d, yyyy")} · {item.treatment_type}
                        {item.treatment_areas?.length > 0 && ` · ${item.treatment_areas.map((a: any) => a.area_name).join(", ")}`}
                      </p>
                    </div>
                    <Badge variant="destructive">Debt</Badge>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader><CardTitle className="text-lg font-display">Recent Treatments</CardTitle></CardHeader>
            <CardContent>
              <ReportList
                items={recentTreatments}
                emptyText="No treatments yet."
                renderItem={(item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div>
                      <p className="font-medium text-sm">{item.clients?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.scheduled_at), "MMM d, yyyy h:mm a")} · {item.treatment_type}
                        {item.treatment_areas?.length > 0 && ` · ${item.treatment_areas.map((a: any) => a.area_name).join(", ")}`}
                      </p>
                    </div>
                    <Badge variant={item.payment_status === "debt" ? "destructive" : "default"}>
                      {item.payment_status || "—"}
                    </Badge>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
