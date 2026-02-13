import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Filter } from "lucide-react";

const Reports = () => {
  const { user } = useAuth();
  const [filterStaff, setFilterStaff] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDebt, setFilterDebt] = useState(false);

  const { data: treatments = [] } = useQuery({
    queryKey: ["all-treatments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name), treatment_areas(area_name, heat_level)")
        .order("scheduled_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: staffMembers = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const filtered = treatments.filter((t: any) => {
    if (filterStaff !== "all" && t.staff_member_id !== filterStaff) return false;
    if (filterType !== "all" && t.treatment_type !== filterType) return false;
    if (filterDebt && t.payment_status !== "debt") return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-3xl font-display font-semibold">דוחות</h1>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">סינון:</span>
          </div>
          <Select value={filterStaff} onValueChange={setFilterStaff}>
            <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue placeholder="כל הצוות" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל הצוות</SelectItem>
              {staffMembers.map((s: any) => (
                <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "ללא שם"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px] h-8 text-sm"><SelectValue /></SelectTrigger>
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
        </CardContent>
      </Card>

      {/* Airtable-style grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>לקוח</TableHead>
                  <TableHead>סוג טיפול</TableHead>
                  <TableHead>אזורים</TableHead>
                  <TableHead>מטפל/ת</TableHead>
                  <TableHead>תשלום</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      אין נתונים להצגה.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(t.scheduled_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{t.clients?.full_name}</TableCell>
                      <TableCell>
                        <Badge className={t.treatment_type === "laser" ? "bg-laser text-primary-foreground" : "bg-electrolysis text-primary-foreground"}>
                          {t.treatment_type === "laser" ? "לייזר" : "אלקטרוליזה"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.treatment_areas?.map((a: any) => `${a.area_name} (${a.heat_level})`).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{staffMembers.find((s: any) => s.user_id === t.staff_member_id)?.full_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={t.payment_status === "debt" ? "destructive" : "default"}>
                          {t.payment_status === "paid" ? "שולם" : t.payment_status === "debt" ? "חוב" : "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
