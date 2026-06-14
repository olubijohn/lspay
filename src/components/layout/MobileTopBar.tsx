import { Menu } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/theme";

interface Props {
  title: string;
  icon: LucideIcon;
  onMenuClick: () => void;
}

export function MobileTopBar({ title, icon: Icon, onMenuClick }: Props) {
  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-20 h-14 bg-card/95 backdrop-blur border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-6 w-6 text-primary shrink-0" />
        <span className="text-foreground font-bold text-base truncate">{title}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <ThemeToggle />
        <button
          onClick={onMenuClick}
          className="text-foreground hover:text-primary p-2 -mr-2 shrink-0"
          aria-label="Open menu"
          data-testid="btn-mobile-menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
