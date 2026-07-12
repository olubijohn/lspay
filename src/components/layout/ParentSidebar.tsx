import { LayoutDashboard, Bell, Settings, LogOut, ShieldCheck, Plus } from "lucide-react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ThemeToggle } from "@/theme";

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAddChild: () => void;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function ParentSidebar({ activeTab, setActiveTab, onAddChild, mobileOpen, onMobileOpenChange }: Props) {
  const { parentSession, logoutParent, notifications, students } = useStore();
  const [, setLocation] = useLocation();

  if (!parentSession) return null;

  const unreadCount = notifications.filter(n => n.targetRole === 'parent' && n.targetParentEmail === parentSession.email && !n.isRead).length;
  const linkedChildren = students.filter(s => parentSession.linkedStudentIds.includes(s.id));

  const handleLogout = () => {
    logoutParent();
    setLocation('/');
  };

  const handleNav = (tab: string) => {
    setActiveTab(tab);
    onMobileOpenChange?.(false);
  };

  const inner = (
    <>
      <div className="p-6 flex items-center space-x-3 border-b border-border">
        <ShieldCheck className="h-8 w-8 text-primary shrink-0" />
        <span className="text-foreground font-bold text-xl tracking-tight leading-tight">Parent Portal</span>
      </div>

      <div className="flex-1 py-6 px-4 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          <button
            onClick={() => handleNav('overview')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
              activeTab === 'overview' ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="flex-1 text-left">Overview</span>
          </button>
        </div>

        <div>
          <div className="px-4 mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>My Children</span>
            <button onClick={onAddChild} className="hover:text-primary transition-colors" data-testid="add-child-btn">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-1">
            {linkedChildren.length === 0 ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">No children linked yet.</div>
            ) : (
              linkedChildren.map(child => (
                <button
                  key={child.id}
                  onClick={() => handleNav(`child_${child.id}`)}
                  className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                    activeTab === `child_${child.id}` ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  <img src={child.imageUrl} alt={child.name} className="w-6 h-6 rounded-full bg-muted border border-border" />
                  <span className="flex-1 text-left truncate">{child.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-1">
          <button
            onClick={() => handleNav('notifications')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
              activeTab === 'notifications' ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Bell className="h-5 w-5" />
            <span className="flex-1 text-left">Notifications</span>
            {unreadCount > 0 && (
              <Badge className="bg-red-500 hover:bg-red-600 text-white rounded-full px-2 py-0.5 min-w-[1.5rem] flex items-center justify-center">
                {unreadCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => handleNav('settings')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
              activeTab === 'settings' ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="flex-1 text-left">Settings</span>
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-border space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="min-w-0">
            <div className="text-foreground font-medium truncate">{parentSession.name}</div>
            <div className="text-primary text-xs mt-1 uppercase tracking-wider font-bold">Parent</div>
          </div>
          <ThemeToggle />
        </div>
        <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-950/30">
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
          <SheetDescription className="sr-only">Parent portal navigation</SheetDescription>
          {inner}
        </SheetContent>
      </Sheet>
    </>
  );
}
