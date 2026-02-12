import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus, Filter } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday as isDateToday } from "date-fns";

const FULL_BODY_AREAS = ["Legs", "Arms", "Back", "Face", "Bikini"];

const CalendarView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [filterType, setFilterType] = useState<"all" | "laser" | "electrolysis">("all");
  const [filterDebt, setFilterDebt] = useState(false);
  const [showTodayOnly, setShowTodayOnly] = useState(false);

  // New treatment form
  const [form, setForm] = useState({
    client_id: "",
    treatment_type: "" as "laser" | "electrolysis" | "",
    scheduled_at: "",
    area: "",
    heat_level: "",
    payment_status: "" as "paid" | "debt" | "",
  });
  const [laserAreas, setLaserAreas] = useState<{ area_name: string; heat_level: string }[]>([]);
  const [useFullBody, setUseFullBody] = useState(false);

  // Edit form state
  const [editAreas, setEditAreas] = useState<{ id?: string; area_name: string; heat_level: string }[]>([]);

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
        .select("*, clients(full_name), treatment_areas(id, area_name, heat_level)")
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

  // Filter appointments
  const filteredAppointments = appointments.filter((a: any) => {
    if (filterType !== "all" && a.treatment_type !== filterType) return false;
    if (filterDebt && a.payment_status !== "debt") return false;
    if (showTodayOnly && !isSameDay(new Date(a.scheduled_at), new Date())) return false;
    return true;
  });

  const createAppointment = useMutation({
    mutationFn: async () => {
      // Create appointment
      const { data: apt, error } = await supabase.from("appointments").insert({
        client_id: form.client_id,
        treatment_type: form.treatment_type as "laser" | "electrolysis",
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        payment_status: form.payment_status as "paid" | "debt",
        user_id: user!.id,
      }).select().single();
      if (error) throw error;

      // Insert treatment areas
      if (form.treatment_type === "laser" && laserAreas.length > 0) {
        const areas = laserAreas.map((a) => ({
          appointment_id: apt.id,
          area_name: a.area_name,
          heat_level: parseFloat(a.heat_level),
        }));
        const { error: areaError } = await supabase.from("treatment_areas").insert(areas);
        if (areaError) throw areaError;
      } else {
        const { error: areaError } = await supabase.from("treatment_areas").insert({
          appointment_id: apt.id,
          area_name: form.area,
          heat_level: parseFloat(form.heat_level),
        });
        if (areaError) throw areaError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["month-appointments"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Treatment created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateAreas = useMutation({
    mutationFn: async () => {
      if (!selectedAppointment) return;
      // Delete old areas and re-insert
      await supabase.from("treatment_areas").delete().eq("appointment_id", selectedAppointment.id);
      const areas = editAreas.map((a) => ({
        appointment_id: selectedAppointment.id,
        area_name: a.area_name,
        heat_level: parseFloat(a.heat_level),
      }));
      const { error } = await supabase.from("treatment_areas").insert(areas);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["month-appointments"] });
      setEditDialogOpen(false);
      toast({ title: "Treatment updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ client_id: "", treatment_type: "", scheduled_at: "", area: "", heat_level: "", payment_status: "" });
    setLaserAreas([]);
    setUseFullBody(false);
  };

  const handleTreatmentTypeChange = (type: string) => {
    setForm({ ...form, treatment_type: type as any, area: "", heat_level: "" });
    if (type === "laser") {
      setLaserAreas([{ area_name: "", heat_level: "" }]);
    } else {
      setLaserAreas([]);
    }
    setUseFullBody(false);
  };

  const toggleFullBody = (checked: boolean) => {
    setUseFullBody(checked);
    if (checked) {
      setLaserAreas(FULL_BODY_AREAS.map((a) => ({ area_name: a, heat_level: "" })));
    } else {
      setLaserAreas([{ area_name: "", heat_level: "" }]);
    }
  };

  const isFormValid = () => {
    if (!form.client_id || !form.treatment_type || !form.scheduled_at || !form.payment_status) return false;
    if (form.treatment_type === "laser") {
      return laserAreas.every((a) => a.area_name && a.heat_level);
    }
    return !!form.area && !!form.heat_level;
  };

  const openEditDialog = (apt: any) => {
    setSelectedAppointment(apt);
    setEditAreas(
      (apt.treatment_areas || []).map((a: any) => ({ id: a.id, area_name: a.area_name, heat_level: String(a.heat_level) }))
    );
    if ((apt.treatment_areas || []).length === 0) {
      setEditAreas([{ area_name: "", heat_level: "" }]);
    }
    setEditDialogOpen(true);
  };

  const getAppointmentsForDay = (day: Date) =>
    filteredAppointments.filter((a: any) => isSameDay(new Date(a.scheduled_at), day));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-display font-semibold">Calendar</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Treatment</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">New Treatment</DialogTitle></DialogHeader>
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
                <Select value={form.treatment_type} onValueChange={handleTreatmentTypeChange}>
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

              {/* Area & Heat for Electrolysis */}
              {form.treatment_type === "electrolysis" && (
                <div className="space-y-3 p-3 rounded-lg bg-secondary/50">
                  <div className="space-y-2">
                    <Label>Area *</Label>
                    <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Upper Lip" />
                  </div>
                  <div className="space-y-2">
                    <Label>Heat/Energy Level *</Label>
                    <Input type="number" value={form.heat_level} onChange={(e) => setForm({ ...form, heat_level: e.target.value })} placeholder="e.g. 25" />
                  </div>
                </div>
              )}

              {/* Area & Heat for Laser (multi-area) */}
              {form.treatment_type === "laser" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Body Areas *</Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Full Body</Label>
                      <Switch checked={useFullBody} onCheckedChange={toggleFullBody} />
                    </div>
                  </div>
                  {laserAreas.map((area, i) => (
                    <div key={i} className="p-3 rounded-lg bg-secondary/50 space-y-2">
                      {useFullBody ? (
                        <p className="font-medium text-sm">{area.area_name}</p>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Area Name *</Label>
                          <Input
                            value={area.area_name}
                            onChange={(e) => {
                              const updated = [...laserAreas];
                              updated[i].area_name = e.target.value;
                              setLaserAreas(updated);
                            }}
                            placeholder="e.g. Legs"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Heat/Energy Level *</Label>
                        <Input
                          type="number"
                          value={area.heat_level}
                          onChange={(e) => {
                            const updated = [...laserAreas];
                            updated[i].heat_level = e.target.value;
                            setLaserAreas(updated);
                          }}
                          placeholder="e.g. 25"
                        />
                      </div>
                    </div>
                  ))}
                  {!useFullBody && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setLaserAreas([...laserAreas, { area_name: "", heat_level: "" }])}>
                      + Add Area
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Payment Status *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["paid", "debt"] as const).map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={form.payment_status === status ? "default" : "outline"}
                      className="capitalize"
                      onClick={() => setForm({ ...form, payment_status: status })}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createAppointment.isPending || !isFormValid()}>
                {createAppointment.isPending ? "Creating..." : "Create Treatment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-[150px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="laser">Laser</SelectItem>
              <SelectItem value="electrolysis">Electrolysis</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={filterDebt} onCheckedChange={setFilterDebt} />
            <Label className="text-sm">Debt Only</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showTodayOnly} onCheckedChange={setShowTodayOnly} />
            <Label className="text-sm">Today Only</Label>
          </div>
        </CardContent>
      </Card>

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
                      <button
                        key={apt.id}
                        onClick={() => openEditDialog(apt)}
                        className={`block w-full text-left text-[10px] md:text-xs px-1.5 py-0.5 rounded truncate text-primary-foreground ${
                          apt.treatment_type === "laser" ? "bg-laser" : "bg-electrolysis"
                        } hover:opacity-80 transition-opacity`}
                      >
                        {format(new Date(apt.scheduled_at), "HH:mm")} {apt.clients?.full_name}
                      </button>
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

      {/* Edit Treatment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Treatment Details</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedAppointment.clients?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{format(new Date(selectedAppointment.scheduled_at), "MMM d, yyyy – h:mm a")}</p>
                </div>
                <Badge className={selectedAppointment.treatment_type === "laser" ? "bg-laser text-primary-foreground" : "bg-electrolysis text-primary-foreground"}>
                  {selectedAppointment.treatment_type}
                </Badge>
              </div>

              <div className="space-y-3">
                <Label className="font-medium">Areas & Heat Levels</Label>
                {editAreas.map((area, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/50 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Area *</Label>
                      <Input
                        value={area.area_name}
                        onChange={(e) => {
                          const updated = [...editAreas];
                          updated[i].area_name = e.target.value;
                          setEditAreas(updated);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Heat/Energy Level *</Label>
                      <Input
                        type="number"
                        value={area.heat_level}
                        onChange={(e) => {
                          const updated = [...editAreas];
                          updated[i].heat_level = e.target.value;
                          setEditAreas(updated);
                        }}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditAreas([...editAreas, { area_name: "", heat_level: "" }])}
                >
                  + Add Area
                </Button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payment Status</span>
                <Badge variant={selectedAppointment.payment_status === "debt" ? "destructive" : "default"}>
                  {selectedAppointment.payment_status || "—"}
                </Badge>
              </div>

              <Button
                className="w-full"
                onClick={() => updateAreas.mutate()}
                disabled={updateAreas.isPending || editAreas.some((a) => !a.area_name || !a.heat_level)}
              >
                {updateAreas.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
