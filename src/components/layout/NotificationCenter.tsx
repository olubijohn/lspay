import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Bell, BellOff, CheckCheck, Clock, CreditCard, PackageCheck, ShoppingBag, Wallet } from "lucide-react";
import { useStore } from "@/store";
import type { AppNotification } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const META: Record<AppNotification["type"], { title: string; icon: typeof Bell; tint: string }> = {
  limit_exceeded: { title: "Spending limit alert", icon: AlertTriangle, tint: "bg-peach text-amber-700" },
  card_pending: { title: "Card pending", icon: Clock, tint: "bg-sky text-blue-700" },
  card_ready: { title: "Card ready for pickup", icon: CreditCard, tint: "bg-mint text-green-700" },
  card_delivered: { title: "Card collected", icon: PackageCheck, tint: "bg-lilac text-purple-700" },
  purchase: { title: "Purchase", icon: ShoppingBag, tint: "bg-sky text-blue-700" },
  topup: { title: "Wallet topped up", icon: Wallet, tint: "bg-mint text-green-700" },
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : formatDistanceToNow(d, { addSuffix: true });
}

interface Props {
  notifications: AppNotification[];
  /** Opens the full notifications page. */
  onViewAll?: () => void;
  /** Called when a notification row is clicked, after it is marked read. */
  onOpen?: (n: AppNotification) => void;
  className?: string;
}

/** Bell + popover inbox that sits at the top right of every portal. */
export function NotificationCenter({ notifications, onViewAll, onOpen, className }: Props) {
  const { markNotificationRead } = useStore();
  const [open, setOpen] = useState(false);

  const sorted = [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = sorted.filter(n => !n.isRead);

  const handleOpen = (n: AppNotification) => {
    if (!n.isRead) markNotificationRead(n.id);
    if (onOpen) {
      onOpen(n);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unread.length ? `Notifications, ${unread.length} unread` : "Notifications"}
          data-testid="btn-notifications"
          className={cn(
            "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open && "bg-accent",
            className
          )}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-extrabold text-white ring-2 ring-background">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <div className="font-display text-lg leading-tight">Notifications</div>
            <div className="text-xs text-muted-foreground">
              {unread.length ? `${unread.length} unread` : "You're all caught up"}
            </div>
          </div>
          {unread.length > 0 && (
            <button
              type="button"
              onClick={() => unread.forEach(n => markNotificationRead(n.id))}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-extrabold text-primary transition-colors hover:bg-accent"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[min(26rem,60dvh)] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-muted-foreground">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lilac text-ink-2"><BellOff className="h-5 w-5" /></span>
              <p className="text-sm">No notifications yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sorted.slice(0, 20).map(n => {
                const meta = META[n.type] ?? META.card_pending;
                const Icon = meta.icon;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleOpen(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60",
                        !n.isRead && "bg-lilac/40"
                      )}
                    >
                      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.tint)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-sm", n.isRead ? "font-bold" : "font-extrabold")}>{meta.title}</span>
                          {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-coral" aria-hidden />}
                        </span>
                        <span className={cn("mt-0.5 line-clamp-2 block text-[13px] leading-snug", n.isRead ? "text-muted-foreground" : "text-foreground")}>{n.message}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={() => { setOpen(false); onViewAll(); }}
            className="block w-full border-t border-border bg-muted/40 px-4 py-2.5 text-center text-sm font-extrabold text-primary transition-colors hover:bg-accent"
          >
            View all notifications
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
