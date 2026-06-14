import { LayoutDashboard, Building2, CreditCard, Shield, Users, Bell, LogOut, Wallet, Receipt } from "lucide-react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ThemeToggle } from "@/theme";

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function SuperAdminSidebar({ activeTab, setActiveTab, mobileOpen, onMobileOpenChange }: Props) {
  const { session, logout, notifications } = useStore();
  const [, setLocation] = useLocation();

  const unreadCount = notifications.filter(n => n.targetRole === "super_admin" && !n.isRead).length;

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "schools", label: "Schools", icon: Building2 },
    { id: "transactions", label: "Transactions", icon: Receipt },
    { id: "cards", label: "Card Assignment", icon: CreditCard },
    { id: "platform_users", label: "Platform Users", icon: Shield },
    { id: "tenant_users", label: "Tenant Users", icon: Users },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadCount },
  ];

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
      <div className="p-6 flex items-center space-x-3 border-b border-border">
        <Wallet className="h-8 w-8 text-primary shrink-0" />
        <span className="text-foreground font-bold text-xl tracking-tight">LSPay</span>
      </div>

      <div className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              data-testid={`nav-${item.id}`}
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
            <div className="text-foreground font-medium text-sm truncate">{session.user?.name}</div>
            <div className="text-primary text-xs mt-0.5 uppercase tracking-wider font-bold">Super Admin</div>
          </div>
          <ThemeToggle />
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-950/30 h-9"
          data-testid="btn-logout"
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
          <SheetDescription className="sr-only">Super admin console navigation</SheetDescription>
          {inner}
        </SheetContent>
      </Sheet>
    </>
  );
}
