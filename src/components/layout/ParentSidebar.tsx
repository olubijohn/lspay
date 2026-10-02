import { LayoutDashboard, Bell, Settings, LogOut, ShieldCheck, Plus, Users } from "lucide-react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAddChild: () => void;
}

const navClass = (active: boolean) =>
  `w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${
    active ? "bg-muted text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
  }`;

/** Desktop navigation rail for the parent portal. On phones the bottom navigation takes over. */
export function ParentSidebar({ activeTab, setActiveTab, onAddChild }: Props) {
  const { parentSession, logoutParent, notifications, students } = useStore();
  const [, setLocation] = useLocation();

  if (!parentSession) return null;

  const unreadCount = notifications.filter(n => n.targetRole === 'parent' && (n.targetParentEmail ?? '').toLowerCase() === parentSession.email.toLowerCase() && !n.isRead).length;
  const linkedChildren = students.filter(s => parentSession.linkedStudentIds.includes(s.id));

  const handleLogout = () => {
    logoutParent();
    setLocation('/');
  };

  const initials = parentSession.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");

  return (
    <aside className="hidden lg:flex w-64 bg-card border-r border-border h-full fixed left-0 top-0 flex-col z-10 app-sidebar">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-border">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <span className="text-foreground font-display text-xl leading-tight">Parent Portal</span>
      </div>

      <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
        <Button onClick={onAddChild} variant="highlight" className="w-full h-11 rounded-xl" data-testid="add-child-btn">
          <Plus /> Link a child
        </Button>

        <div className="space-y-1">
          <button onClick={() => setActiveTab('overview')} className={navClass(activeTab === 'overview')}>
            <LayoutDashboard className="h-5 w-5" />
            <span className="flex-1 text-left">Overview</span>
          </button>
          <button onClick={() => setActiveTab('children')} className={navClass(activeTab === 'children')}>
            <Users className="h-5 w-5" />
            <span className="flex-1 text-left">My Children</span>
          </button>
        </div>

        <div>
          <div className="px-4 mb-2 text-[11px] font-extrabold text-muted-foreground tracking-widest">Children</div>
          <div className="space-y-1">
            {linkedChildren.length === 0 ? (
              <div className="px-4 py-2 text-sm text-muted-foreground">No children linked yet.</div>
            ) : (
              linkedChildren.map(child => (
                <button
                  key={child.id}
                  onClick={() => setActiveTab(`child_${child.id}`)}
                  className={navClass(activeTab === `child_${child.id}`).replace("py-2.5", "py-2")}
                >
                  {child.imageUrl ? (
                    <img src={child.imageUrl} alt="" className="w-7 h-7 rounded-full bg-muted object-cover ring-2 ring-white/10" />
                  ) : (
                    <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-full bg-lilac font-display text-[11px] text-ink">
                      {child.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="flex-1 text-left truncate">{child.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-1">
          <button onClick={() => setActiveTab('notifications')} className={navClass(activeTab === 'notifications')}>
            <Bell className="h-5 w-5" />
            <span className="flex-1 text-left">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-coral text-white text-[11px] font-extrabold rounded-full px-2 py-0.5 min-w-[1.5rem] text-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('settings')} className={navClass(activeTab === 'settings')}>
            <Settings className="h-5 w-5" />
            <span className="flex-1 text-left">Account</span>
          </button>
        </div>
      </div>

      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lilac font-display text-sm text-ink">{initials}</span>
          <div className="min-w-0">
            <div className="text-foreground font-bold text-sm truncate">{parentSession.name}</div>
            <div className="text-primary text-[11px] tracking-widest font-extrabold">Parent</div>
          </div>
        </div>
        <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-950/30 h-9">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
