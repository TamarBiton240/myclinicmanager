import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface AdminPinGateProps {
  children: React.ReactNode;
}

const AdminPinGate = ({ children }: AdminPinGateProps) => {
  const [enteredPin, setEnteredPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState(false);

  const { data: adminPin } = useQuery({
    queryKey: ["admin-pin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_settings")
        .select("setting_value")
        .eq("setting_key", "admin_pin")
        .single();
      return (data?.setting_value as string) || "1234";
    },
  });

  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === adminPin) {
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex items-center justify-center py-20 animate-fade-in">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Lock className="w-10 h-10 mx-auto text-primary mb-2" />
          <CardTitle className="font-display">קוד גישה להגדרות</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="הקלידי קוד..."
              value={enteredPin}
              onChange={(e) => { setEnteredPin(e.target.value); setError(false); }}
              className="text-center text-lg tracking-widest"
              maxLength={10}
            />
            {error && <p className="text-sm text-destructive text-center">קוד שגוי</p>}
            <Button type="submit" className="w-full">כניסה</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPinGate;
