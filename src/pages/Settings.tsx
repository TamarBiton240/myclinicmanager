import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCog, Scissors, Palette, ClipboardList } from "lucide-react";
import AdminPinGate from "@/components/settings/AdminPinGate";
import StaffTab from "@/components/settings/StaffTab";
import AreasTab from "@/components/settings/AreasTab";
import TreatmentPlansTab from "@/components/settings/TreatmentPlansTab";
import ThemeTab from "@/components/settings/ThemeTab";

const Settings = () => {
  const { role } = useAuth();

  if (role !== "admin") {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">אין לך הרשאות לצפות בעמוד זה.</p></div>;
  }

  return (
    <AdminPinGate>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-display font-semibold">הגדרות</h1>

        <Tabs defaultValue="staff">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="staff"><UserCog className="w-3.5 h-3.5 ml-1" /> צוות</TabsTrigger>
            <TabsTrigger value="areas"><Scissors className="w-3.5 h-3.5 ml-1" /> אזורים</TabsTrigger>
            <TabsTrigger value="plans"><ClipboardList className="w-3.5 h-3.5 ml-1" /> תוכניות</TabsTrigger>
            <TabsTrigger value="theme"><Palette className="w-3.5 h-3.5 ml-1" /> עיצוב</TabsTrigger>
          </TabsList>

          <TabsContent value="staff"><StaffTab /></TabsContent>
          <TabsContent value="areas"><AreasTab /></TabsContent>
          <TabsContent value="plans"><TreatmentPlansTab /></TabsContent>
          <TabsContent value="theme"><ThemeTab /></TabsContent>
        </Tabs>
      </div>
    </AdminPinGate>
  );
};

export default Settings;
