import { LayoutDashboard, GraduationCap, Package, TrendingUp, BarChart3, Monitor, Bell, LogOut, Store, Receipt, Users } from "lucide-react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ThemeToggle } from "@/theme";

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tenantName: string;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function TenantSidebar({ activeTab, setActiveTab, tenantName, mobileOpen, onMobileOpenChange }: Props) {
  const { session, logout, notifications } = useStore();
  const [, setLocation] = useLocation();

  const user = session.user;
  const unreadCount = notifications.filter(n => n.targetRole === "tenant" && n.targetTenantId === user?.tenantId && !n.isRead).length;

  const canSeeKiosk = user?.role === "tenant_admin" || user?.role === "kiosk_operator";
  const canSeeOthers = user?.role === "tenant_admin" || user?.role === "backoffice";

  let navItems: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [];

  if (canSeeOthers) {
    navItems.push(
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "students", label: "Students", icon: GraduationCap },
      { id: "inventory", label: "Inventory", icon: Package },
      { id: "stock", label: "Stock Management", icon: TrendingUp },
      { id: "transactions", label: "Transactions", icon: Receipt },
      { id: "reporting", label: "Reporting", icon: BarChart3 }
    );
  }
  if (canSeeKiosk) {
    navItems.push({ id: "kiosk", label: "Kiosk", icon: Monitor });
  }
  if (canSeeOthers) {
    navItems.push({ id: "notifications", label: "Notifications", icon: Bell, badge: unreadCount });
  }
  if (user?.role === "tenant_admin") {
    navItems.push({ id: "users", label: "Users", icon: Users });
  }

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  const handleNav = (id: string) => {
    setActiveTab(id);
    onMobileOpenChange?.(false);
  };

  const inner = (
    <>
      <div className="p-5 flex items-center space-x-3 border-b border-border">
        <Store className="h-7 w-7 text-primary shrink-0" />
        <span className="text-foreground font-bold text-base tracking-tight leading-tight line-clamp-2">{tenantName}</span>
      </div>

      <div className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              data-testid={`nav-tenant-${item.id}`}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${
                isActive
                  ? "bg-muted text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <Badge className="bg-red-500 hover:bg-red-600 text-white text-xs rounded-full px-1.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                  {item.badge}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-border space-y-3">
        <div className="flex items-center justify-between px-2">
          <div className="min-w-0">
            <div className="text-foreground font-medium text-sm truncate">{user?.name}</div>
            <div className="text-primary text-xs mt-0.5 uppercase tracking-wider font-bold">{user?.role?.replace(/_/g, " ")}</div>
          </div>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-950/30 h-9"
          data-testid="btn-tenant-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <>
      <div className="hidden lg:flex w-64 bg-card border-r border-border h-full fixed left-0 top-0 flex-col z-10">
        {inner}
      </div>
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 max-w-[80%] p-0 bg-card border-border flex flex-col [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SheetDescription className="sr-only">Tenant console navigation</SheetDescription>
          {inner}
        </SheetContent>
      </Sheet>
    </>
  );
}
