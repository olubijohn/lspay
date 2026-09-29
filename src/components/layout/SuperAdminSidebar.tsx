import { LayoutDashboard, Building2, CreditCard, Shield, Users, Bell, LogOut, Wallet, Receipt } from "lucide-react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

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
      <div className="h-16 px-5 flex items-center gap-3 border-b border-border shrink-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
          <Wallet className="h-5 w-5" />
        </span>
        <span className="text-foreground font-display text-2xl">LSPay</span>
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
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${
                isActive
                  ? "bg-muted text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <Badge className="bg-coral hover:bg-coral border-0 text-white text-[11px] font-extrabold rounded-full px-1.5 min-w-[1.25rem] h-5 flex items-center justify-center">
                  {item.badge}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lilac font-display text-sm text-ink">
            {(session.user?.name ?? "SA").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("")}
          </span>
          <div className="min-w-0">
            <div className="text-foreground font-bold text-sm truncate">{session.user?.name}</div>
            <div className="text-primary text-[11px] uppercase tracking-widest font-extrabold">Super Admin</div>
          </div>
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
      <div className="hidden lg:flex w-64 bg-card border-r border-border h-full fixed left-0 top-0 flex-col z-10 app-sidebar">
        {inner}
      </div>
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 max-w-[80%] p-0 bg-card border-border flex flex-col [&>button]:hidden app-sidebar">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SheetDescription className="sr-only">Super admin console navigation</SheetDescription>
          {inner}
        </SheetContent>
      </Sheet>
    </>
  );
}
