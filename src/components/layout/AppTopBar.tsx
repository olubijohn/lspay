import type { ReactNode } from "react";
import { Menu, type LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/theme";

interface Props {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  logoUrl?: string;
  /** Shows the hamburger on small screens. Leave out when the portal uses bottom navigation. */
  onMenuClick?: () => void;
  /** Right-hand actions, e.g. the notification bell. */
  actions?: ReactNode;
}

/** Top bar shared by every portal: title on the left, notifications and theme toggle on the right. */
export function AppTopBar({ title, subtitle, icon: Icon, logoUrl, onMenuClick, actions }: Props) {
  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 lg:left-64 lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="-ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent lg:hidden"
            aria-label="Open menu"
            data-testid="btn-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <span className="lg:hidden">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-xl border border-border bg-white object-contain p-0.5"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-gold">
              <Icon className="h-[18px] w-[18px]" />
            </span>
          )}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate font-display text-lg lg:text-xl">{title}</div>
          {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle className="h-10 w-10 rounded-full" />
        {actions}
      </div>
    </header>
  );
}
