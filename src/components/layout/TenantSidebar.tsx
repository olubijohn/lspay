import { useRef, useState, useEffect } from "react";
import { LayoutDashboard, GraduationCap, Package, TrendingUp, BarChart3, Monitor, Bell, LogOut, Store, Receipt, Users, Camera } from "lucide-react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tenantName: string;
  logoUrl?: string;
  onUploadLogo?: (file: File) => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function TenantSidebar({ activeTab, setActiveTab, tenantName, logoUrl, onUploadLogo, mobileOpen, onMobileOpenChange }: Props) {
  const { session, logout, notifications } = useStore();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

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

  const initials = (tenantName || "School")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadLogo) {
      onUploadLogo(file);
    }
  };

  const inner = (
    <>
      <div className="h-16 px-4 flex items-center space-x-3 border-b border-border shrink-0">
        <div className="relative group shrink-0">
          {logoUrl && !imgError ? (
            <img
              key={logoUrl}
              src={logoUrl}
              alt={tenantName}
              className="h-10 w-10 rounded-xl object-contain bg-white p-1 border border-border shadow-sm shrink-0"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center text-primary font-black text-sm tracking-wider shadow-sm shrink-0">
              {initials || <Store className="h-5 w-5" />}
            </div>
          )}
          {onUploadLogo && (user?.role === "tenant_admin" || user?.role === "super_admin") && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Change school logo"
                className="absolute -bottom-1 -right-1 p-1 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="w-3 h-3 text-primary" />
              </button>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-foreground font-bold text-sm tracking-tight leading-tight line-clamp-2">{tenantName}</span>
        </div>
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
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${
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
            {(user?.name ?? "U").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("")}
          </span>
          <div className="min-w-0">
            <div className="text-foreground font-bold text-sm truncate">{user?.name}</div>
            <div className="text-primary text-[11px] uppercase tracking-widest font-extrabold">{user?.role?.replace(/_/g, " ")}</div>
          </div>
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
      <div className="hidden lg:flex w-64 bg-card border-r border-border h-full fixed left-0 top-0 flex-col z-10 app-sidebar">
        {inner}
      </div>
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 max-w-[80%] p-0 bg-card border-border flex flex-col [&>button]:hidden app-sidebar">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SheetDescription className="sr-only">Tenant console navigation</SheetDescription>
          {inner}
        </SheetContent>
      </Sheet>
    </>
  );
}
