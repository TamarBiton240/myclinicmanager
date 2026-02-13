import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LayoutDashboard, Users, CalendarDays, FileText, LogOut, Menu, X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "לוח בקרה", icon: LayoutDashboard },
  { to: "/clients", label: "לקוחות", icon: Users },
  { to: "/calendar", label: "יומן", icon: CalendarDays },
  { to: "/reports", label: "דוחות", icon: FileText },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { signOut, role } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 right-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 md:relative md:translate-x-0",
        mobileOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-xl font-display font-semibold text-sidebar-foreground">ניהול מרפאה</h1>
          <button className="md:hidden text-sidebar-foreground" onClick={() => setMobileOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === to
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 space-y-1">
          {role === "admin" && (
            <Link
              to="/settings"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/settings"
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Settings className="w-4 h-4" />
              הגדרות
            </Link>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            התנתקות
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-4 py-3 flex items-center md:hidden">
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <span className="mr-3 font-display font-semibold">ניהול מרפאה</span>
        </header>
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
