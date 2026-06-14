import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutDashboard, Users, CreditCard, PoundSterling, Package } from "lucide-react";

export function TenantDashboard({ tenantId }: { tenantId: number }) {
  const { students, transactions, stockMovements, notifications } = useStore();
  
  const tenantStudents = students.filter(s => s.tenantId === tenantId);
  const activeCards = tenantStudents.filter(s => s.cardStatus === 'Active').length;
  
  const today = new Date().toISOString().split('T')[0];
  const todayTx = transactions.filter(t => t.tenantId === tenantId && t.date === today);
  const todayRev = todayTx.reduce((sum, t) => sum + t.amount, 0);
  
  const todaySales = stockMovements.filter(m => m.tenantId === tenantId && m.date === today && m.type === 'sale');
  const itemsSold = todaySales.reduce((sum, m) => sum + m.quantity, 0);

  const recentTx = transactions.filter(t => t.tenantId === tenantId).reverse().slice(0, 10);
  const unreadNotifs = notifications.filter(n => n.targetRole === 'tenant' && n.targetTenantId === tenantId && !n.isRead).slice(0, 3);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
        <LayoutDashboard className="text-primary" /> Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-card border-border shadow-xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-blue-500/10 rounded-xl"><Users className="w-8 h-8 text-blue-400" /></div>
            <div>
              <div className="text-muted-foreground text-sm mb-1 font-medium tracking-wide uppercase">Total Students</div>
              <div className="text-3xl font-black text-foreground">{tenantStudents.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-primary/10 rounded-xl"><CreditCard className="w-8 h-8 text-primary" /></div>
            <div>
              <div className="text-muted-foreground text-sm mb-1 font-medium tracking-wide uppercase">Active Cards</div>
              <div className="text-3xl font-black text-foreground">{activeCards}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-amber-500/10 rounded-xl"><PoundSterling className="w-8 h-8 text-amber-400" /></div>
            <div>
              <div className="text-muted-foreground text-sm mb-1 font-medium tracking-wide uppercase">Revenue Today</div>
              <div className="text-3xl font-black text-amber-400">₦{todayRev.toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-xl">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-purple-500/10 rounded-xl"><Package className="w-8 h-8 text-purple-400" /></div>
            <div>
              <div className="text-muted-foreground text-sm mb-1 font-medium tracking-wide uppercase">Items Sold Today</div>
              <div className="text-3xl font-black text-foreground">{itemsSold}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-card border-border lg:col-span-2 shadow-xl">
          <CardHeader>
            <CardTitle className="text-foreground">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-border rounded-lg overflow-hidden bg-background">
              <Table>
                <TableHeader className="bg-card/80">
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Student</TableHead>
                    <TableHead className="text-muted-foreground">Items</TableHead>
                    <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTx.map(tx => (
                    <TableRow key={tx.id} className="border-border/50">
                      <TableCell className="text-foreground text-sm">{tx.date}</TableCell>
                      <TableCell className="text-foreground font-medium">{tx.studentName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{tx.itemsString}</TableCell>
                      <TableCell className="text-primary font-bold text-right">₦{tx.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {recentTx.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No transactions recorded yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xl h-max">
          <CardHeader>
            <CardTitle className="text-foreground">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {unreadNotifs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground bg-background rounded-xl border border-border border-dashed">
                <p>All caught up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {unreadNotifs.map(n => (
                  <div key={n.id} className="p-4 bg-background border border-border rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-foreground text-sm">Update</div>
                      <div className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleDateString()}</div>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
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
