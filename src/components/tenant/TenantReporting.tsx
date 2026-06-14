import { useState, useMemo } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useChartTheme } from "@/theme";
import { BarChart3, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

export function TenantReporting({ tenantId }: { tenantId: number }) {
  const chartTheme = useChartTheme();
  const { transactions, stockMovements, inventory, students } = useStore();
  const [startDate, setStartDate] = useState("2026-06-01");
  const [endDate, setEndDate] = useState("2026-06-10");
  const [appliedStart, setAppliedStart] = useState(startDate);
  const [appliedEnd, setAppliedEnd] = useState(endDate);
  
  const [selectedStockItem, setSelectedStockItem] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");

  const tenantInventory = inventory.filter(i => i.tenantId === tenantId);
  const tenantStudents = students.filter(s => s.tenantId === tenantId);

  const applyDates = () => {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  };

  const periodTx = useMemo(() => {
    return transactions.filter(t => 
      t.tenantId === tenantId && 
      t.date >= appliedStart && 
      t.date <= appliedEnd &&
      (selectedStudent === "all" || t.studentId === Number(selectedStudent))
    );
  }, [transactions, tenantId, appliedStart, appliedEnd, selectedStudent]);

  // Overview Stats
  const totalRev = periodTx.reduce((sum, t) => sum + t.amount, 0);
  const totalCogs = periodTx.reduce((sum, t) => sum + t.cost, 0);
  const netProfit = totalRev - totalCogs;
  const margin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;
  
  // Daily Revenue (Line Chart)
  const dailyRevData = useMemo(() => {
    const days: Record<string, number> = {};
    periodTx.forEach(t => {
      days[t.date] = (days[t.date] || 0) + t.amount;
    });
    return Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));
  }, [periodTx]);

  // Top Selling Items
  const topItemsData = useMemo(() => {
    const items: Record<string, number> = {};
    const periodMovements = stockMovements.filter(m => m.tenantId === tenantId && m.type === 'sale' && m.date >= appliedStart && m.date <= appliedEnd);
    periodMovements.forEach(m => {
      items[m.itemName] = (items[m.itemName] || 0) + m.quantity;
    });
    return Object.entries(items)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));
  }, [stockMovements, tenantId, appliedStart, appliedEnd]);

  // Category Breakdown
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    const periodSales = stockMovements.filter(m => m.tenantId === tenantId && m.type === 'sale' && m.date >= appliedStart && m.date <= appliedEnd);
    periodSales.forEach(sale => {
      const invItem = tenantInventory.find(i => i.id === sale.itemId);
      if (invItem) {
        cats[invItem.category] = (cats[invItem.category] || 0) + (invItem.sellingPrice * sale.quantity);
      }
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [stockMovements, tenantId, tenantInventory, appliedStart, appliedEnd]);

  // Student Spending
  const studentData = useMemo(() => {
    const sMap: Record<string, { total: number, count: number }> = {};
    periodTx.forEach(t => {
      if (!sMap[t.studentName]) sMap[t.studentName] = { total: 0, count: 0 };
      sMap[t.studentName].total += t.amount;
      sMap[t.studentName].count += 1;
    });
    return Object.entries(sMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, stats]) => ({
        name,
        spend: stats.total,
        txCount: stats.count,
        avg: stats.total / stats.count
      }));
  }, [periodTx]);

  // Specific Item Analysis
  const itemAnalysis = useMemo(() => {
    if (selectedStockItem === "all") return null;
    const itemId = Number(selectedStockItem);
    const item = tenantInventory.find(i => i.id === itemId);
    if (!item) return null;

    const moves = stockMovements.filter(m => m.tenantId === tenantId && m.itemId === itemId && m.date >= appliedStart && m.date <= appliedEnd);
    const sales = moves.filter(m => m.type === 'sale');
    const unitsSold = sales.reduce((sum, m) => sum + m.quantity, 0);
    const revenue = unitsSold * item.sellingPrice;

    const dailyMap: Record<string, number> = {};
    sales.forEach(s => {
      dailyMap[s.date] = (dailyMap[s.date] || 0) + s.quantity;
    });
    const dailySales = Object.entries(dailyMap).sort().map(([date, qty]) => ({ date, qty }));

    return { item, unitsSold, revenue, dailySales };
  }, [selectedStockItem, stockMovements, tenantId, appliedStart, appliedEnd, tenantInventory]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
        <BarChart3 className="text-primary" /> Analytics & Reporting
      </h1>

      <div className="bg-card p-5 rounded-xl border border-border shadow-xl flex flex-wrap items-end gap-5">
        <div className="space-y-2">
          <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Date Range</Label>
          <div className="flex items-center gap-2">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-background border-border text-foreground h-10 w-[140px]" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-background border-border text-foreground h-10 w-[140px]" />
            <Button onClick={applyDates} className="bg-primary hover:bg-primary/90 text-white h-10 px-6 font-bold shadow-lg shadow-primary/20">Apply Filters</Button>
          </div>
        </div>
        
        <div className="w-px h-10 bg-muted hidden md:block mx-2"></div>
        
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label className="text-muted-foreground font-bold uppercase tracking-wider text-xs flex items-center gap-1"><Filter className="w-3 h-3"/> Filter by Student</Label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger className="bg-background border-border text-foreground h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="all">All Students (Global View)</SelectItem>
              {tenantStudents.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Total Revenue</div>
            <div className="text-2xl font-black text-primary">£{totalRev.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Total COGS</div>
            <div className="text-2xl font-black text-amber-400">£{totalCogs.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Net Profit</div>
            <div className="text-2xl font-black text-blue-400">£{netProfit.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Profit Margin</div>
            <div className="text-2xl font-black text-foreground">{margin.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Transactions</div>
            <div className="text-2xl font-black text-foreground">{periodTx.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground mb-1 font-bold uppercase tracking-wider">Avg Order Val</div>
            <div className="text-2xl font-black text-foreground">£{periodTx.length ? (totalRev / periodTx.length).toFixed(2) : '0.00'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="bg-card border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-foreground">Daily Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyRevData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={12} tickMargin={10} />
                <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={(val) => `£${val}`} />
                <RechartsTooltip contentStyle={chartTheme.tooltip} formatter={(value: number) => [`£${value.toFixed(2)}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {selectedStudent === "all" ? (
          <Card className="bg-card border-border shadow-xl">
            <CardHeader>
              <CardTitle className="text-foreground">Revenue by Category</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {categoryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={chartTheme.tooltip} formatter={(value: number) => [`£${value.toFixed(2)}`, 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border shadow-xl">
            <CardHeader>
              <CardTitle className="text-foreground">Top 5 Purchased by Student</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItemsData} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                  <XAxis type="number" stroke={chartTheme.axis} fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke={chartTheme.axis} fontSize={12} width={100} tick={{ fill: chartTheme.tickText }} />
                  <RechartsTooltip contentStyle={chartTheme.tooltip} cursor={{ fill: chartTheme.cursor }} />
                  <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Item Specific Analysis */}
      <Card className="bg-card border-border shadow-xl overflow-hidden">
        <div className="bg-card/50 p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-foreground">Product Deep Dive</CardTitle>
          <Select value={selectedStockItem} onValueChange={setSelectedStockItem}>
            <SelectTrigger className="w-[280px] bg-background border-border text-foreground h-10">
              <SelectValue placeholder="Select item to analyze" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="all">Select an item...</SelectItem>
              {tenantInventory.map(i => <SelectItem key={i.id} value={i.id.toString()}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        <CardContent className="p-0">
          {itemAnalysis ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
              <div className="p-8 flex items-center gap-6">
                <div className="w-24 h-24 rounded-lg bg-background border border-border overflow-hidden shrink-0">
                  <img src={itemAnalysis.item.imageUrl} alt={itemAnalysis.item.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-foreground mb-1">{itemAnalysis.item.name}</h3>
                  <Badge className="bg-muted text-foreground border-0 mb-4">{itemAnalysis.item.category}</Badge>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Units Sold</div>
                      <div className="text-2xl font-black text-foreground">{itemAnalysis.unitsSold}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Revenue</div>
                      <div className="text-2xl font-black text-primary">£{itemAnalysis.revenue.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 lg:col-span-2 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={itemAnalysis.dailySales}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={10} />
                    <YAxis stroke={chartTheme.axis} fontSize={10} />
                    <RechartsTooltip contentStyle={chartTheme.tooltip} />
                    <Area type="monotone" dataKey="qty" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} name="Units Sold" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-muted-foreground">
              Select a specific product from the dropdown above to view its sales velocity and revenue contribution.
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudent === "all" && (
        <Card className="bg-card border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-foreground">Student Spending Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-auto border border-border rounded-lg bg-background">
              <Table>
                <TableHeader className="bg-card/80 sticky top-0">
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Student Name</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs text-right">Transactions</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs text-right">Total Spend</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs text-right">Avg Transaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentData.map((s, idx) => (
                    <TableRow key={idx} className="border-border/50 hover:bg-muted/50">
                      <TableCell className="text-foreground font-medium">{s.name}</TableCell>
                      <TableCell className="text-right text-foreground font-mono">{s.txCount}</TableCell>
                      <TableCell className="text-right text-primary font-bold">£{s.spend.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">£{s.avg.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {studentData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No spending data in this period.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
