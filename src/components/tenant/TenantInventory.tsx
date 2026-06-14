import { useState } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Package, Image as ImageIcon, BarChart2, ArrowUpCircle, ShoppingCart, TrendingUp } from "lucide-react";
import { InventoryItem } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { useChartTheme } from "@/theme";

function ItemReportDialog({ item, tenantId, onClose }: { item: InventoryItem; tenantId: number; onClose: () => void }) {
  const chartTheme = useChartTheme();
  const { stockMovements, transactions } = useStore();

  const itemMovements = stockMovements
    .filter(m => m.itemId === item.id && m.tenantId === tenantId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const sales = itemMovements.filter(m => m.type === "sale");
  const restocks = itemMovements.filter(m => m.type === "restock");

  const totalSold = sales.reduce((s, m) => s + m.quantity, 0);
  const totalRestocked = restocks.reduce((s, m) => s + m.quantity, 0);
  const totalRevenue = totalSold * item.sellingPrice;
  const totalCost = totalSold * item.costPrice;
  const grossProfit = totalRevenue - totalCost;

  // Daily sales chart data
  const dailySalesMap: Record<string, number> = {};
  sales.forEach(m => { dailySalesMap[m.date] = (dailySalesMap[m.date] || 0) + m.quantity; });
  const dailySalesData = Object.entries(dailySalesMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, qty]) => ({ date, qty }));

  return (
    <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg overflow-hidden bg-background border border-border shrink-0">
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/40x40/1e293b/94a3b8?text=${item.name[0]}`; }} />
          </div>
          <div>
            <div className="text-xl font-bold">{item.name}</div>
            <div className="text-sm text-muted-foreground font-normal">{item.category} · £{item.sellingPrice.toFixed(2)} each</div>
          </div>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-6 mt-2">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Sold", value: `${totalSold} units`, color: "text-foreground", icon: ShoppingCart },
            { label: "Revenue", value: `£${totalRevenue.toFixed(2)}`, color: "text-primary", icon: TrendingUp },
            { label: "Gross Profit", value: `£${grossProfit.toFixed(2)}`, color: "text-blue-400", icon: BarChart2 },
            { label: "Restocked", value: `${totalRestocked} units`, color: "text-amber-400", icon: ArrowUpCircle },
          ].map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-background rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${c.color}`} />
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">{c.label}</span>
                </div>
                <div className={`text-xl font-black ${c.color}`}>{c.value}</div>
              </div>
            );
          })}
        </div>

        {/* Sales trend chart */}
        {dailySalesData.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">Daily Sales</h3>
            <div className="h-40 bg-background rounded-xl border border-border p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={10} />
                  <YAxis stroke={chartTheme.axis} fontSize={10} allowDecimals={false} />
                  <RechartsTooltip contentStyle={chartTheme.tooltip} />
                  <Bar dataKey="qty" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Sales log */}
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Sales Log
          </h3>
          <div className="rounded-xl border border-border overflow-hidden max-h-48 overflow-y-auto">
            <Table>
              <TableHeader className="bg-background sticky top-0">
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground text-right">Qty Sold</TableHead>
                  <TableHead className="text-muted-foreground text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No sales recorded.</TableCell></TableRow>
                ) : sales.map(m => (
                  <TableRow key={m.id} className="border-border/50">
                    <TableCell className="text-foreground text-sm">{m.date}</TableCell>
                    <TableCell className="text-foreground font-bold text-right">{m.quantity}</TableCell>
                    <TableCell className="text-primary font-bold text-right">£{(m.quantity * item.sellingPrice).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Restock log */}
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-amber-400" /> Restock Log
          </h3>
          <div className="rounded-xl border border-border overflow-hidden max-h-48 overflow-y-auto">
            <Table>
              <TableHeader className="bg-background sticky top-0">
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Note</TableHead>
                  <TableHead className="text-muted-foreground text-right">Qty Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restocks.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No restocks recorded.</TableCell></TableRow>
                ) : restocks.map(m => (
                  <TableRow key={m.id} className="border-border/50">
                    <TableCell className="text-foreground text-sm">{m.date}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{m.note || "—"}</TableCell>
                    <TableCell className="text-amber-400 font-bold text-right">+{m.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}

export function TenantInventory({ tenantId }: { tenantId: number }) {
  const { inventory, addInventory, updateInventory, deleteInventory } = useStore();
  const tenantInventory = inventory.filter(i => i.tenantId === tenantId);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reportItem, setReportItem] = useState<InventoryItem | null>(null);

  const [invName, setInvName] = useState("");
  const [invCategory, setInvCategory] = useState("Mains");
  const [invStock, setInvStock] = useState("");
  const [invCost, setInvCost] = useState("");
  const [invPrice, setInvPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setInvName(""); setInvCategory("Mains"); setInvStock(""); setInvCost(""); setInvPrice(""); setImageUrl("");
  };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setInvName(item.name);
    setInvCategory(item.category);
    setInvStock(item.stock.toString());
    setInvCost(item.costPrice.toString());
    setInvPrice(item.sellingPrice.toString());
    setImageUrl(item.imageUrl || "");
    setIsOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImageUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName || !invCost || !invPrice) return;
    const finalImage = imageUrl || `https://placehold.co/300x300/1e293b/94a3b8?text=${encodeURIComponent(invName)}`;
    if (editingId) {
      updateInventory(editingId, { name: invName, category: invCategory, stock: Number(invStock), costPrice: Number(invCost), sellingPrice: Number(invPrice), imageUrl: finalImage });
    } else {
      addInventory({ tenantId, name: invName, category: invCategory, stock: Number(invStock), costPrice: Number(invCost), sellingPrice: Number(invPrice), imageUrl: finalImage });
    }
    setIsOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Package className="text-primary" /> Inventory Catalog
        </h1>
        <Dialog open={isOpen} onOpenChange={open => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-lg" data-testid="btn-add-item">
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editingId ? "Edit Item" : "Add New Item"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
              <div className="col-span-2 flex items-center gap-6 p-4 bg-background rounded-xl border border-border">
                <div className="h-24 w-24 rounded-lg bg-card border border-border overflow-hidden flex items-center justify-center shrink-0">
                  {imageUrl ? <img src={imageUrl} alt="preview" className="h-full w-full object-cover" /> : <ImageIcon className="text-muted-foreground w-8 h-8" />}
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-foreground">Item Image</Label>
                  <div className="flex flex-col gap-2">
                    <Input type="file" accept="image/*" onChange={handleFileChange} className="bg-card border-border text-foreground text-sm" />
                    <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Or paste URL..." className="bg-card border-border text-foreground text-sm h-9" />
                  </div>
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-foreground">Item Name</Label>
                <Input value={invName} onChange={e => setInvName(e.target.value)} required className="bg-background border-border text-foreground h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Category</Label>
                <Select value={invCategory} onValueChange={setInvCategory}>
                  <SelectTrigger className="bg-background border-border text-foreground h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="Mains">Mains</SelectItem>
                    <SelectItem value="Snacks">Snacks</SelectItem>
                    <SelectItem value="Drinks">Drinks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Initial Stock</Label>
                <Input value={invStock} onChange={e => setInvStock(e.target.value)} type="number" min="0" required disabled={!!editingId} className="bg-background border-border text-foreground h-11 disabled:opacity-50" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Cost Price (£)</Label>
                <Input value={invCost} onChange={e => setInvCost(e.target.value)} type="number" step="0.01" min="0" required className="bg-background border-border text-foreground h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Selling Price (£)</Label>
                <Input value={invPrice} onChange={e => setInvPrice(e.target.value)} type="number" step="0.01" min="0" required className="bg-background border-border text-foreground h-11" />
              </div>
              <div className="col-span-2 flex justify-end mt-4">
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white h-12 px-8 font-bold text-lg w-full">Save Item</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border shadow-xl">
        <CardContent className="p-0">
          <div className="overflow-auto rounded-xl">
            <Table>
              <TableHeader className="bg-background">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground w-[80px] py-4">Image</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Item</TableHead>
                  <TableHead className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-right text-muted-foreground text-xs font-bold uppercase tracking-wider">Stock</TableHead>
                  <TableHead className="text-right text-muted-foreground text-xs font-bold uppercase tracking-wider">Cost</TableHead>
                  <TableHead className="text-right text-muted-foreground text-xs font-bold uppercase tracking-wider">Price</TableHead>
                  <TableHead className="text-right text-muted-foreground text-xs font-bold uppercase tracking-wider pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantInventory.map(item => (
                  <TableRow
                    key={item.id}
                    className="border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setReportItem(item)}
                    data-testid={`row-item-${item.id}`}
                  >
                    <TableCell className="py-3">
                      <div className="h-12 w-12 rounded bg-background border border-border overflow-hidden">
                        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/100x100/1e293b/94a3b8?text=${item.name.charAt(0)}`; }} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-foreground font-bold">{item.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <BarChart2 className="h-3 w-3" /> Click for report
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-background text-foreground border-border">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${item.stock < 10 ? "bg-amber-500/20 text-amber-400" : "bg-background text-foreground border border-border"}`}>
                        {item.stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground font-medium">£{item.costPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-primary font-bold text-lg">£{item.sellingPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="text-foreground hover:text-foreground hover:bg-muted" data-testid={`btn-edit-item-${item.id}`}>Edit</Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete item?")) deleteInventory(item.id); }} className="text-red-400 hover:bg-red-900/30 hover:text-red-300 w-8 h-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {tenantInventory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-16">No items in inventory.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Item Report Dialog */}
      <Dialog open={reportItem !== null} onOpenChange={open => { if (!open) setReportItem(null); }}>
        {reportItem && <ItemReportDialog item={reportItem} tenantId={tenantId} onClose={() => setReportItem(null)} />}
      </Dialog>
    </div>
  );
}
