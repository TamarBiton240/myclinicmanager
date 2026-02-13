import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, Clock, DollarSign, UserCheck } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { he } from "date-fns/locale";

const Dashboard = () => {
  const { user } = useAuth();

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

  const { data: staffMembers = [] } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
    enabled: !!user,
  });

  // Count appointments per staff for today
  const staffAppointmentCounts = staffMembers.map((s: any) => ({
    name: s.full_name || "ללא שם",
    count: todayAppointments.filter((a: any) => a.staff_member_id === s.user_id).length,
  })).filter((s) => s.count > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-semibold">לוח בקרה</h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, d בMMMM yyyy", { locale: he })}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-semibold">{todayAppointments.length}</p>
              <p className="text-sm text-muted-foreground">טיפולים היום</p>
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
              <p className="text-sm text-muted-foreground">חובות פתוחים</p>
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
              <p className="text-sm text-muted-foreground">סה"כ לקוחות</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff per-day counts */}
      {staffAppointmentCounts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <UserCheck className="w-5 h-5" /> טיפולים היום לפי צוות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {staffAppointmentCounts.map((s) => (
                <div key={s.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <span className="text-sm font-medium">{s.name}</span>
                  <Badge>{s.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display">לקוחות היום</CardTitle>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">אין טיפולים מתוכננים להיום.</p>
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
                        {format(new Date(apt.scheduled_at), "HH:mm")}
                        {apt.treatment_areas?.length > 0 && ` · ${apt.treatment_areas.map((a: any) => a.area_name).join(", ")}`}
                        {apt.staff_member_id && (() => { const s = staffMembers.find((sm: any) => sm.user_id === apt.staff_member_id); return s ? ` · ${s.full_name}` : ""; })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {apt.payment_status === "debt" && <Badge variant="destructive">חוב</Badge>}
                    <Badge className={apt.treatment_type === "laser" ? "bg-laser text-primary-foreground" : "bg-electrolysis text-primary-foreground"}>
                      {apt.treatment_type === "laser" ? "לייזר" : "אלקטרוליזה"}
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
