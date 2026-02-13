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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus, Filter } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay,
  addMonths, subMonths, startOfWeek, endOfWeek, addDays, startOfDay, endOfDay,
  eachHourOfInterval, setHours, setMinutes
} from "date-fns";
import { he } from "date-fns/locale";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 - 18:00

const CalendarView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "day" | "week">("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [filterType, setFilterType] = useState<"all" | "laser" | "electrolysis">("all");
  const [filterDebt, setFilterDebt] = useState(false);
  const [showTodayOnly, setShowTodayOnly] = useState(false);

  // Form state
  const [form, setForm] = useState({
    client_id: "",
    treatment_type: "" as "laser" | "electrolysis" | "",
    scheduled_at: "",
    area: "",
    heat_level: "",
    payment_status: "" as "paid" | "debt" | "",
    staff_member_id: "",
  });
  const [laserAreas, setLaserAreas] = useState<{ area_name: string; heat_level: string }[]>([]);
  const [useFullBody, setUseFullBody] = useState(false);
  const [editAreas, setEditAreas] = useState<{ area_name: string; heat_level: string }[]>([]);

  // Data queries
  const { data: bodyAreasConfig = [] } = useQuery({
    queryKey: ["body-areas-config"],
    queryFn: async () => {
      const { data } = await supabase.from("body_areas_config").select("*").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
    enabled: !!user,
  });

  const fullBodyAreas = bodyAreasConfig.map((a: any) => a.area_name);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const queryStart = view === "month" ? calendarStart : view === "week" ? startOfWeek(currentDate) : startOfDay(currentDate);
  const queryEnd = view === "month" ? calendarEnd : view === "week" ? endOfWeek(currentDate) : endOfDay(currentDate);

  const { data: appointments = [] } = useQuery({
    queryKey: ["calendar-appointments", user?.id, format(queryStart, "yyyy-MM-dd"), format(queryEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name), treatment_areas(id, area_name, heat_level)")
        .gte("scheduled_at", queryStart.toISOString())
        .lte("scheduled_at", queryEnd.toISOString())
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

  const { data: staffMembers = [] } = useQuery({
    queryKey: ["staff-members"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const filteredAppointments = appointments.filter((a: any) => {
    if (filterType !== "all" && a.treatment_type !== filterType) return false;
    if (filterDebt && a.payment_status !== "debt") return false;
    if (showTodayOnly && !isSameDay(new Date(a.scheduled_at), new Date())) return false;
    return true;
  });

  const createAppointment = useMutation({
    mutationFn: async () => {
      const { data: apt, error } = await supabase.from("appointments").insert({
        client_id: form.client_id,
        treatment_type: form.treatment_type as "laser" | "electrolysis",
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        payment_status: form.payment_status as "paid" | "debt",
        user_id: user!.id,
        staff_member_id: form.staff_member_id || null,
      }).select().single();
      if (error) throw error;

      if (form.treatment_type === "laser" && laserAreas.length > 0) {
        const areas = laserAreas.map((a) => ({ appointment_id: apt.id, area_name: a.area_name, heat_level: parseFloat(a.heat_level) }));
        await supabase.from("treatment_areas").insert(areas);
      } else {
        await supabase.from("treatment_areas").insert({ appointment_id: apt.id, area_name: form.area, heat_level: parseFloat(form.heat_level) });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "טיפול נוצר בהצלחה" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const updateAreas = useMutation({
    mutationFn: async () => {
      if (!selectedAppointment) return;
      await supabase.from("treatment_areas").delete().eq("appointment_id", selectedAppointment.id);
      const areas = editAreas.map((a) => ({ appointment_id: selectedAppointment.id, area_name: a.area_name, heat_level: parseFloat(a.heat_level) }));
      await supabase.from("treatment_areas").insert(areas);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-appointments"] });
      setEditDialogOpen(false);
      toast({ title: "טיפול עודכן" });
    },
    onError: (e: any) => toast({ title: "שגיאה", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({ client_id: "", treatment_type: "", scheduled_at: "", area: "", heat_level: "", payment_status: "", staff_member_id: "" });
    setLaserAreas([]);
    setUseFullBody(false);
  };

  const handleTreatmentTypeChange = (type: string) => {
    setForm({ ...form, treatment_type: type as any, area: "", heat_level: "" });
    if (type === "laser") setLaserAreas([{ area_name: "", heat_level: "" }]);
    else setLaserAreas([]);
    setUseFullBody(false);
  };

  const toggleFullBody = (checked: boolean) => {
    setUseFullBody(checked);
    setLaserAreas(checked ? fullBodyAreas.map((a: string) => ({ area_name: a, heat_level: "" })) : [{ area_name: "", heat_level: "" }]);
  };

  const isFormValid = () => {
    if (!form.client_id || !form.treatment_type || !form.scheduled_at || !form.payment_status) return false;
    if (form.treatment_type === "laser") return laserAreas.every((a) => a.area_name && a.heat_level);
    return !!form.area && !!form.heat_level;
  };

  const openEditDialog = (apt: any) => {
    setSelectedAppointment(apt);
    const areas = (apt.treatment_areas || []).map((a: any) => ({ area_name: a.area_name, heat_level: String(a.heat_level) }));
    setEditAreas(areas.length > 0 ? areas : [{ area_name: "", heat_level: "" }]);
    setEditDialogOpen(true);
  };

  const getAppointmentsForDay = (day: Date) => filteredAppointments.filter((a: any) => isSameDay(new Date(a.scheduled_at), day));

  // Navigation
  const navigate = (dir: number) => {
    if (view === "month") setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (view === "week") setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) });

  const dayNames = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

  const getTitle = () => {
    if (view === "month") return format(currentDate, "MMMM yyyy", { locale: he });
    if (view === "week") return `${format(weekDays[0], "d/M")} - ${format(weekDays[6], "d/M/yyyy")}`;
    return format(currentDate, "EEEE, d בMMMM yyyy", { locale: he });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-display font-semibold">יומן</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-2" />טיפול חדש</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">טיפול חדש</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createAppointment.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>לקוח *</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="בחר לקוח" /></SelectTrigger>
                  <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>מטפל/ת</Label>
                <Select value={form.staff_member_id} onValueChange={(v) => setForm({ ...form, staff_member_id: v })}>
                  <SelectTrigger><SelectValue placeholder="בחר מטפל/ת" /></SelectTrigger>
                  <SelectContent>{staffMembers.map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "ללא שם"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>סוג טיפול *</Label>
                <Select value={form.treatment_type} onValueChange={handleTreatmentTypeChange}>
                  <SelectTrigger><SelectValue placeholder="בחר סוג" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="laser">לייזר</SelectItem>
                    <SelectItem value="electrolysis">אלקטרוליזה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>תאריך ושעה *</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} required />
              </div>

              {form.treatment_type === "electrolysis" && (
                <div className="space-y-3 p-3 rounded-lg bg-secondary/50">
                  <div className="space-y-2">
                    <Label>אזור *</Label>
                    <Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="למשל שפה עליונה" />
                  </div>
                  <div className="space-y-2">
                    <Label>רמת חום/אנרגיה *</Label>
                    <Input type="number" value={form.heat_level} onChange={(e) => setForm({ ...form, heat_level: e.target.value })} placeholder="למשל 25" />
                  </div>
                </div>
              )}

              {form.treatment_type === "laser" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>אזורי גוף *</Label>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">גוף מלא</Label>
                      <Switch checked={useFullBody} onCheckedChange={toggleFullBody} />
                    </div>
                  </div>
                  {laserAreas.map((area, i) => (
                    <div key={i} className="p-3 rounded-lg bg-secondary/50 space-y-2">
                      {useFullBody ? (
                        <p className="font-medium text-sm">{area.area_name}</p>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">שם אזור *</Label>
                          <Input value={area.area_name} onChange={(e) => { const u = [...laserAreas]; u[i].area_name = e.target.value; setLaserAreas(u); }} placeholder="למשל רגליים" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">רמת חום/אנרגיה *</Label>
                        <Input type="number" value={area.heat_level} onChange={(e) => { const u = [...laserAreas]; u[i].heat_level = e.target.value; setLaserAreas(u); }} placeholder="למשל 25" />
                      </div>
                    </div>
                  ))}
                  {!useFullBody && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setLaserAreas([...laserAreas, { area_name: "", heat_level: "" }])}>
                      + הוסף אזור
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>סטטוס תשלום *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {([{ v: "paid", l: "שולם" }, { v: "debt", l: "חוב" }] as const).map(({ v, l }) => (
                    <Button key={v} type="button" variant={form.payment_status === v ? "default" : "outline"} onClick={() => setForm({ ...form, payment_status: v })}>
                      {l}
                    </Button>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createAppointment.isPending || !isFormValid()}>
                {createAppointment.isPending ? "יוצר..." : "צור טיפול"}
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
            <span className="text-sm font-medium">סינון:</span>
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הסוגים</SelectItem>
              <SelectItem value="laser">לייזר</SelectItem>
              <SelectItem value="electrolysis">אלקטרוליזה</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={filterDebt} onCheckedChange={setFilterDebt} />
            <Label className="text-sm">חובות בלבד</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showTodayOnly} onCheckedChange={setShowTodayOnly} />
            <Label className="text-sm">היום בלבד</Label>
          </div>
        </CardContent>
      </Card>

      {/* View tabs + nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="month">חודש</TabsTrigger>
            <TabsTrigger value="week">שבוע</TabsTrigger>
            <TabsTrigger value="day">יום</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronRight className="w-4 h-4" /></Button>
          <h2 className="text-lg font-display font-semibold min-w-[160px] text-center">{getTitle()}</h2>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>היום</Button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {view === "month" && (
        <Card>
          <CardContent className="p-2 md:p-4">
            <div className="grid grid-cols-7 gap-px">
              {dayNames.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
              ))}
              {days.map((day) => {
                const dayAppts = getAppointmentsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[80px] md:min-h-[100px] p-1 rounded-lg border transition-colors cursor-pointer ${
                      isToday ? "border-primary bg-primary/5" : "border-transparent hover:bg-secondary/30"
                    } ${!isCurrentMonth ? "opacity-40" : ""}`}
                    onClick={() => { setCurrentDate(day); setView("day"); }}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayAppts.slice(0, 3).map((apt: any) => (
                        <button
                          key={apt.id}
                          onClick={(e) => { e.stopPropagation(); openEditDialog(apt); }}
                          className={`block w-full text-right text-[10px] md:text-xs px-1.5 py-0.5 rounded truncate text-primary-foreground ${
                            apt.treatment_type === "laser" ? "bg-laser" : "bg-electrolysis"
                          } hover:opacity-80 transition-opacity`}
                        >
                          {format(new Date(apt.scheduled_at), "HH:mm")} {apt.clients?.full_name}
                        </button>
                      ))}
                      {dayAppts.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{dayAppts.length - 3} עוד</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DAY VIEW - Staff Columns */}
      {view === "day" && (
        <Card>
          <CardContent className="p-2 md:p-4 overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Staff headers */}
              <div className="grid gap-px" style={{ gridTemplateColumns: `60px repeat(${Math.max(staffMembers.length, 1)}, 1fr)` }}>
                <div className="text-xs font-medium text-muted-foreground p-2">שעה</div>
                {staffMembers.length > 0 ? staffMembers.map((s: any) => (
                  <div key={s.user_id} className="text-xs font-medium text-center p-2 bg-secondary/30 rounded-t-lg">
                    {s.full_name || "ללא שם"}
                  </div>
                )) : (
                  <div className="text-xs font-medium text-center p-2 bg-secondary/30 rounded-t-lg">כל הטיפולים</div>
                )}
              </div>
              {/* Hour rows */}
              {HOURS.map((hour) => (
                <div key={hour} className="grid gap-px border-t border-border" style={{ gridTemplateColumns: `60px repeat(${Math.max(staffMembers.length, 1)}, 1fr)` }}>
                  <div className="text-xs text-muted-foreground p-2 min-h-[60px]">{String(hour).padStart(2, "0")}:00</div>
                  {(staffMembers.length > 0 ? staffMembers : [{ user_id: null }]).map((s: any) => {
                    const hourAppts = filteredAppointments.filter((a: any) => {
                      const d = new Date(a.scheduled_at);
                      if (!isSameDay(d, currentDate)) return false;
                      if (d.getHours() !== hour) return false;
                      if (s.user_id && a.staff_member_id !== s.user_id) return false;
                      return true;
                    });
                    return (
                      <div key={s.user_id || "all"} className="min-h-[60px] p-1 border-r border-border last:border-r-0">
                        {hourAppts.map((apt: any) => (
                          <button
                            key={apt.id}
                            onClick={() => openEditDialog(apt)}
                            className={`block w-full text-right text-xs px-2 py-1 rounded mb-1 text-primary-foreground ${
                              apt.treatment_type === "laser" ? "bg-laser" : "bg-electrolysis"
                            } hover:opacity-80 transition-opacity`}
                          >
                            <div className="font-medium">{apt.clients?.full_name}</div>
                            <div className="text-[10px] opacity-80">{apt.treatment_type === "laser" ? "לייזר" : "אלקטרוליזה"}</div>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WEEK VIEW - Staff Rows */}
      {view === "week" && (
        <Card>
          <CardContent className="p-2 md:p-4 overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Day headers */}
              <div className="grid gap-px" style={{ gridTemplateColumns: `100px repeat(7, 1fr)` }}>
                <div className="text-xs font-medium text-muted-foreground p-2">צוות</div>
                {weekDays.map((d) => (
                  <div key={d.toISOString()} className={`text-xs font-medium text-center p-2 rounded-t-lg ${isSameDay(d, new Date()) ? "bg-primary/10 text-primary" : "bg-secondary/30"}`}>
                    <div>{dayNames[d.getDay()]}</div>
                    <div>{format(d, "d/M")}</div>
                  </div>
                ))}
              </div>
              {/* Staff rows */}
              {(staffMembers.length > 0 ? staffMembers : [{ user_id: null, full_name: "כל הטיפולים" }]).map((s: any) => (
                <div key={s.user_id || "all"} className="grid gap-px border-t border-border" style={{ gridTemplateColumns: `100px repeat(7, 1fr)` }}>
                  <div className="text-xs font-medium p-2 min-h-[80px] flex items-start">{s.full_name || "ללא שם"}</div>
                  {weekDays.map((d) => {
                    const dayStaffAppts = filteredAppointments.filter((a: any) => {
                      if (!isSameDay(new Date(a.scheduled_at), d)) return false;
                      if (s.user_id && a.staff_member_id !== s.user_id) return false;
                      return true;
                    });
                    return (
                      <div key={d.toISOString()} className="min-h-[80px] p-1 border-r border-border last:border-r-0">
                        {dayStaffAppts.map((apt: any) => (
                          <button
                            key={apt.id}
                            onClick={() => openEditDialog(apt)}
                            className={`block w-full text-right text-[10px] px-1.5 py-0.5 rounded mb-0.5 text-primary-foreground ${
                              apt.treatment_type === "laser" ? "bg-laser" : "bg-electrolysis"
                            } hover:opacity-80`}
                          >
                            {format(new Date(apt.scheduled_at), "HH:mm")} {apt.clients?.full_name}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-laser" /> לייזר</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-electrolysis" /> אלקטרוליזה</div>
      </div>

      {/* Edit Treatment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">פרטי טיפול</DialogTitle></DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedAppointment.clients?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedAppointment.scheduled_at), "d/M/yyyy – HH:mm")}
                    {selectedAppointment.staff_member_id && (() => { const s = staffMembers.find((sm: any) => sm.user_id === selectedAppointment.staff_member_id); return s ? ` · ${s.full_name}` : ""; })()}
                  </p>
                </div>
                <Badge className={selectedAppointment.treatment_type === "laser" ? "bg-laser text-primary-foreground" : "bg-electrolysis text-primary-foreground"}>
                  {selectedAppointment.treatment_type === "laser" ? "לייזר" : "אלקטרוליזה"}
                </Badge>
              </div>

              <div className="space-y-3">
                <Label className="font-medium">אזורים ורמות חום</Label>
                {editAreas.map((area, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/50 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">אזור *</Label>
                      <Input value={area.area_name} onChange={(e) => { const u = [...editAreas]; u[i].area_name = e.target.value; setEditAreas(u); }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">רמת חום/אנרגיה *</Label>
                      <Input type="number" value={area.heat_level} onChange={(e) => { const u = [...editAreas]; u[i].heat_level = e.target.value; setEditAreas(u); }} />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setEditAreas([...editAreas, { area_name: "", heat_level: "" }])}>
                  + הוסף אזור
                </Button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">סטטוס תשלום</span>
                <Badge variant={selectedAppointment.payment_status === "debt" ? "destructive" : "default"}>
                  {selectedAppointment.payment_status === "paid" ? "שולם" : selectedAppointment.payment_status === "debt" ? "חוב" : "—"}
                </Badge>
              </div>

              <Button className="w-full" onClick={() => updateAreas.mutate()} disabled={updateAreas.isPending || editAreas.some((a) => !a.area_name || !a.heat_level)}>
                {updateAreas.isPending ? "שומר..." : "שמור שינויים"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
