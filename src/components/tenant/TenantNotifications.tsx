import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2 } from "lucide-react";

export function TenantNotifications({ tenantId }: { tenantId: number }) {
  const { notifications, markNotificationRead } = useStore();
  
  const tenantNotifs = notifications
    .filter(n => n.targetRole === 'tenant' && n.targetTenantId === tenantId)
    .reverse();

  const unreadCount = tenantNotifs.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Bell className="text-primary" /> Notifications
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-2 py-0.5 rounded-full ml-2">
              {unreadCount} new
            </span>
          )}
        </h1>
      </div>

      <Card className="bg-card border-border shadow-xl">
        <CardHeader>
          <CardTitle className="text-foreground">Alerts & Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tenantNotifs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No notifications right now.</p>
              </div>
            ) : (
              tenantNotifs.map(n => (
                <div key={n.id} className={`flex items-start justify-between p-4 rounded-lg border ${n.isRead ? 'bg-background border-border opacity-70' : 'bg-primary/5 border-primary/20'}`}>
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {n.type === 'card_ready' ? 'Card Ready for Pickup' : 
                         n.type === 'card_pending' ? 'Card Pending' : 
                         n.type === 'card_delivered' ? 'Card Collected' : 'Alert'}
                      </span>
                      <span className="text-xs text-muted-foreground">{n.createdAt.split('T')[0]}</span>
                    </div>
                    <p className="text-sm text-foreground">{n.message}</p>
                  </div>
                  {!n.isRead && (
                    <Button variant="ghost" size="sm" onClick={() => markNotificationRead(n.id)} className="shrink-0 text-primary hover:text-primary/80">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Read
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
