import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarDays, Users, Clock, DollarSign } from "lucide-react";
import { format, startOfDay, endOfDay, isSameDay } from "date-fns";

const Dashboard = () => {
  const { user } = useAuth();
  const [showTodayOnly, setShowTodayOnly] = useState(true);

  const { data: todayAppointments = [] } = useQuery({
    queryKey: ["today-appointments", user?.id],
    queryFn: async () => {
      const today = new Date();
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name), treatment_areas(area_name, heat_level)")
        .gte("scheduled_at", startOfDay(today).toISOString())
        .lte("scheduled_at", endOfDay(today).toISOString())
        .order("scheduled_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: debtCount = 0 } = useQuery({
    queryKey: ["debt-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("appointments").select("*", { count: "exact", head: true }).eq("payment_status", "debt");
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: clientCount = 0 } = useQuery({
    queryKey: ["client-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("clients").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{todayAppointments.length}</p>
              <p className="text-sm text-muted-foreground">Today's Treatments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{debtCount}</p>
              <p className="text-sm text-muted-foreground">Unpaid Debts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{clientCount}</p>
              <p className="text-sm text-muted-foreground">Total Clients</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-lg font-display">Today's Clients</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Today only</Label>
            <Switch checked={showTodayOnly} onCheckedChange={setShowTodayOnly} />
          </div>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No treatments scheduled for today.</p>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{apt.clients?.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.scheduled_at), "h:mm a")}
                        {apt.treatment_areas?.length > 0 && ` · ${apt.treatment_areas.map((a: any) => a.area_name).join(", ")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {apt.payment_status === "debt" && <Badge variant="destructive">Debt</Badge>}
                    <Badge className={apt.treatment_type === "laser" ? "bg-laser text-primary-foreground" : "bg-electrolysis text-primary-foreground"}>
                      {apt.treatment_type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
