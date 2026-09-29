import { useState } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Users, CreditCard, Banknote, Package, ArrowDownLeft, ArrowUpRight, Bell, CheckCircle2, Receipt } from "lucide-react";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export function TenantDashboard({ tenantId }: { tenantId: string }) {
  const { students, transactions, stockMovements, notifications, tenants } = useStore();
  const [txFilter, setTxFilter] = useState<"all" | "in" | "out">("all");

  const tenantName = tenants.find(t => t.id === tenantId)?.name;

  const tenantStudents = students.filter(s => s.tenantId === tenantId);
  const activeCards = tenantStudents.filter(s => s.cardStatus === 'Active').length;
  const activePct = tenantStudents.length ? Math.round((activeCards / tenantStudents.length) * 100) : 0;

  const today = new Date().toISOString().split('T')[0];
  const todayTx = transactions.filter(t => t.tenantId === tenantId && t.date === today);
  const todayRev = todayTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

  const todaySales = stockMovements.filter(m => m.tenantId === tenantId && m.date === today && m.type === 'sale');
  const itemsSold = todaySales.reduce((sum, m) => sum + m.quantity, 0);

  const recentTx = transactions.filter(t => t.tenantId === tenantId).filter(tx => {
    if (txFilter === 'in') return tx.amount < 0;
    if (txFilter === 'out') return tx.amount > 0;
    return true;
  }).reverse().slice(0, 10);
  const unreadNotifs = notifications.filter(n => n.targetRole === 'tenant' && n.targetTenantId === tenantId && !n.isRead).slice(0, 3);

  const kpis = [
    { label: "Total Students", value: String(tenantStudents.length), sub: "Enrolled at your school", icon: Users, tint: "bg-sky text-blue-700", tone: "text-foreground" },
    { label: "Active Cards", value: String(activeCards), sub: `${activePct}% of students`, icon: CreditCard, tint: "bg-lilac text-purple-700", tone: "text-foreground" },
    { label: "Revenue Today", value: `₦${todayRev.toFixed(2)}`, sub: `${todayTx.length} transaction${todayTx.length === 1 ? "" : "s"} today`, icon: Banknote, tint: "bg-peach text-amber-700", tone: "text-amber-400" },
    { label: "Items Sold Today", value: String(itemsSold), sub: `${todaySales.length} sale record${todaySales.length === 1 ? "" : "s"}`, icon: Package, tint: "bg-mint text-green-700", tone: "text-foreground" },
  ];

  const filterBtn = (key: "all" | "in" | "out", label: string, activeTone: string, hoverTone: string) => (
    <button
      onClick={() => setTxFilter(key)}
      className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-extrabold rounded-lg transition-colors ${txFilter === key ? `bg-background ${activeTone} shadow-sm` : `text-muted-foreground ${hoverTone}`}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 md:space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
        <LayoutDashboard className="text-primary" /> Dashboard
      </h1>

      {/* ── Today hero ── */}
      <div className="on-ink relative overflow-hidden rounded-3xl bg-ink p-5 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-24 right-16 h-48 w-48 rounded-full bg-gold/15" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-lilac/80 truncate">
              {greeting()}{tenantName ? `, ${tenantName}` : ""}
            </div>
            <div className="mt-3 text-xs font-extrabold uppercase tracking-widest text-lilac/70">Revenue today</div>
            <div className="mt-1 font-display text-4xl sm:text-5xl text-gold break-all">₦{todayRev.toFixed(2)}</div>
            <div className="mt-1 text-sm text-lilac/80">
              {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-auto">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-lilac/70">Transactions</div>
              <div className="font-display text-2xl">{todayTx.length}</div>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-lilac/70">Items sold</div>
              <div className="font-display text-2xl">{itemsSold}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {kpis.map(k => (
          <Card key={k.label} className="bg-card border-border shadow-sm">
            <CardContent className="p-4 md:p-6">
              <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${k.tint}`}><k.icon className="h-4 w-4" /></span>
              <div className="text-muted-foreground text-xs mb-1 font-extrabold tracking-wide uppercase">{k.label}</div>
              <div className={`text-2xl md:text-3xl font-display truncate ${k.tone}`}>{k.value}</div>
              <div className="mt-1 text-xs text-muted-foreground truncate">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Recent transactions ── */}
        <Card className="bg-card border-border lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-foreground">Recent Transactions</CardTitle>
              <CardDescription>The latest 10 payments and top-ups at your school</CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border w-full sm:w-auto">
              {filterBtn('all', 'All', 'text-foreground', 'hover:text-foreground')}
              {filterBtn('in', 'Money In', 'text-green-500', 'hover:text-green-500')}
              {filterBtn('out', 'Money Out', 'text-red-500', 'hover:text-red-500')}
            </div>
          </CardHeader>
          <CardContent>
            {recentTx.length === 0 ? (
              <div className="text-center px-6 py-12 rounded-2xl border-2 border-dashed border-border">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-lilac text-ink-2"><Receipt className="h-5 w-5" /></span>
                <p className="font-extrabold text-foreground">No transactions recorded yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Payments and top-ups will show up here as they happen.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border overflow-hidden">
                {recentTx.map(tx => {
                  const isIn = tx.amount < 0;
                  return (
                    <li key={tx.id} className="flex items-center gap-3 px-3 py-3 sm:px-4 bg-background hover:bg-muted/40 transition-colors">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isIn ? 'bg-mint text-green-700' : 'bg-blush text-red-700'}`}>
                        {isIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-foreground text-sm truncate">{tx.studentName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          <span>{tx.date}</span>
                          {tx.itemsString && <span> · {tx.itemsString}</span>}
                        </div>
                      </div>
                      <div className={`shrink-0 font-display text-base sm:text-lg ${isIn ? 'text-green-500' : 'text-red-500'}`}>
                        {isIn ? '+' : '-'}₦{Math.abs(tx.amount).toFixed(2)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Alerts ── */}
        <Card className="bg-card border-border shadow-sm h-max">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-peach text-amber-700"><Bell className="h-4 w-4" /></span>
              <div className="space-y-0.5">
                <CardTitle className="text-foreground">Recent Alerts</CardTitle>
                <CardDescription>Unread updates for your school</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {unreadNotifs.length === 0 ? (
              <div className="text-center px-6 py-10 rounded-2xl border-2 border-dashed border-border">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-green-700"><CheckCircle2 className="h-5 w-5" /></span>
                <p className="font-extrabold text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">No unread alerts right now.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {unreadNotifs.map(n => (
                  <div key={n.id} className="flex gap-3 p-4 bg-background border border-border rounded-2xl">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="font-extrabold text-foreground text-sm">Update</div>
                        <div className="text-xs text-muted-foreground shrink-0">{new Date(n.createdAt).toLocaleDateString()}</div>
                      </div>
                      <p className="text-sm text-muted-foreground break-words">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
