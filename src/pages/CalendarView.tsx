import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { Link } from "react-router-dom";

const CalendarView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", treatment_type: "" as "laser" | "electrolysis" | "", scheduled_at: "", duration_minutes: "60" });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const { data: appointments = [] } = useQuery({
    queryKey: ["month-appointments", user?.id, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name)")
        .gte("scheduled_at", calendarStart.toISOString())
        .lte("scheduled_at", calendarEnd.toISOString())
        .order("scheduled_at");
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").order("full_name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const createAppointment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("appointments").insert({
        client_id: form.client_id,
        treatment_type: form.treatment_type as "laser" | "electrolysis",
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: parseInt(form.duration_minutes),
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["month-appointments"] });
      setDialogOpen(false);
      setForm({ client_id: "", treatment_type: "", scheduled_at: "", duration_minutes: "60" });
      toast({ title: "Appointment created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((a: any) => isSameDay(new Date(a.scheduled_at), day));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-display font-semibold">Calendar</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Appointment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">New Appointment</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createAppointment.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Treatment Type *</Label>
                <Select value={form.treatment_type} onValueChange={(v) => setForm({ ...form, treatment_type: v as any })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laser">Laser</SelectItem>
                    <SelectItem value="electrolysis">Electrolysis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date & Time *</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} min="15" step="15" />
              </div>
              <Button type="submit" className="w-full" disabled={createAppointment.isPending || !form.client_id || !form.treatment_type}>
                {createAppointment.isPending ? "Creating..." : "Create Appointment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-display font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-2 md:p-4">
          <div className="grid grid-cols-7 gap-px">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {days.map((day) => {
              const dayAppts = getAppointmentsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[80px] md:min-h-[100px] p-1 rounded-lg border transition-colors ${
                    isToday ? "border-primary bg-primary/5" : "border-transparent"
                  } ${!isCurrentMonth ? "opacity-40" : ""}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayAppts.slice(0, 3).map((apt: any) => (
                      <Link
                        key={apt.id}
                        to={apt.is_completed && !apt.is_summary_signed_off ? `/treatment/${apt.id}` : "#"}
                        className={`block text-[10px] md:text-xs px-1.5 py-0.5 rounded truncate text-primary-foreground ${
                          apt.treatment_type === "laser" ? "bg-laser" : "bg-electrolysis"
                        }`}
                      >
                        {format(new Date(apt.scheduled_at), "HH:mm")} {apt.clients?.full_name}
                      </Link>
                    ))}
                    {dayAppts.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{dayAppts.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-laser" /> Laser</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-electrolysis" /> Electrolysis</div>
      </div>
    </div>
  );
};

export default CalendarView;
