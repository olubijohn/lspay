import { Bell, Home, Plus, UserRound, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  activeTab: string;
  onNavigate: (tab: string) => void;
  unreadCount: number;
}

const ITEMS = [
  { id: "overview", label: "Home", icon: Home },
  { id: "children", label: "Children", icon: Users },
  { id: "link", label: "Link", icon: Plus },
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "settings", label: "Account", icon: UserRound },
] as const;

/** Mobile bottom navigation for the parent portal, with a raised "Link a child" action in the middle. */
export function ParentBottomNav({ activeTab, onNavigate, unreadCount }: Props) {
  const isActive = (id: string) => activeTab === id || (id === "children" && activeTab.startsWith("child_"));

  return (
    <nav
      aria-label="Parent navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/90 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_30px_-12px_rgb(43_40_99/0.25)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = isActive(id);
          if (id === "link") {
            return (
              <li key={id} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  aria-label="Link a child"
                  data-testid="bottom-nav-link"
                  className={cn(
                    "-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-background bg-gold text-ink shadow-lg shadow-gold/40 transition-transform active:scale-95",
                    active && "ring-2 ring-ink-2"
                  )}
                >
                  <Plus className="h-6 w-6" strokeWidth={2.75} />
                </button>
              </li>
            );
          }
          return (
            <li key={id} className="flex justify-center">
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? "page" : undefined}
                data-testid={`bottom-nav-${id}`}
                className={cn(
                  "relative flex w-16 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-extrabold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-lilac dark:bg-accent")}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                </span>
                {label}
                {id === "notifications" && unreadCount > 0 && (
                  <span className="absolute right-2.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[9px] font-extrabold text-white ring-2 ring-card">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
