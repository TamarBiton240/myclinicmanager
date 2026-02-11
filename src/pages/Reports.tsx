import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { DollarSign, Clock, UserCheck } from "lucide-react";

const Reports = () => {
  const { user } = useAuth();

  // Unpaid debts
  const { data: debts = [] } = useQuery({
    queryKey: ["debts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .eq("payment_status", "debt")
        .order("scheduled_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  // Incomplete summaries this week
  const { data: incompleteSummaries = [] } = useQuery({
    queryKey: ["incomplete-week", user?.id],
    queryFn: async () => {
      const now = new Date();
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .eq("is_completed", true)
        .eq("is_summary_signed_off", false)
        .gte("scheduled_at", weekStart.toISOString())
        .lte("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at");
      return data ?? [];
    },
    enabled: !!user,
  });

  // Clients due for follow-up (3+ months since last visit)
  const { data: followUps = [] } = useQuery({
    queryKey: ["follow-ups", user?.id],
    queryFn: async () => {
      const threeMonthsAgo = subMonths(new Date(), 3);
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .not("next_reminder_date", "is", null)
        .lte("next_reminder_date", format(new Date(), "yyyy-MM-dd"))
        .eq("is_summary_signed_off", true)
        .order("next_reminder_date");
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="debts" className="text-xs sm:text-sm">
            <DollarSign className="w-3.5 h-3.5 mr-1" /> Unpaid ({debts.length})
          </TabsTrigger>
          <TabsTrigger value="incomplete" className="text-xs sm:text-sm">
            <Clock className="w-3.5 h-3.5 mr-1" /> Incomplete ({incompleteSummaries.length})
          </TabsTrigger>
          <TabsTrigger value="followups" className="text-xs sm:text-sm">
            <UserCheck className="w-3.5 h-3.5 mr-1" /> Follow-ups ({followUps.length})
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
                      <p className="text-xs text-muted-foreground">{format(new Date(item.scheduled_at), "MMM d, yyyy")}</p>
                    </div>
                    <Badge variant="destructive">Debt</Badge>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incomplete">
          <Card>
            <CardHeader><CardTitle className="text-lg font-display">Incomplete Summaries (This Week)</CardTitle></CardHeader>
            <CardContent>
              <ReportList
                items={incompleteSummaries}
                emptyText="All summaries are complete for this week."
                renderItem={(item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-warning/10">
                    <div>
                      <p className="font-medium text-sm">{item.clients?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(item.scheduled_at), "MMM d, h:mm a")}</p>
                    </div>
                    <Badge className="bg-warning text-primary-foreground">Pending</Badge>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="followups">
          <Card>
            <CardHeader><CardTitle className="text-lg font-display">Clients Due for Follow-Up</CardTitle></CardHeader>
            <CardContent>
              <ReportList
                items={followUps}
                emptyText="No clients due for follow-up."
                renderItem={(item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-info/10">
                    <div>
                      <p className="font-medium text-sm">{item.clients?.full_name}</p>
                      <p className="text-xs text-muted-foreground">Reminder: {format(new Date(item.next_reminder_date), "MMM d, yyyy")}</p>
                    </div>
                    <Badge className="bg-info text-primary-foreground">Due</Badge>
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
