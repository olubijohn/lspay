import { useState } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, PackagePlus, Trash2 } from "lucide-react";

export function TenantBackoffice({ tenantId }: { tenantId: number }) {
  const { inventory, addInventory, updateInventory, deleteInventory, stockMovements, addStockMovement } = useStore();
  const tenantInventory = inventory.filter(i => i.tenantId === tenantId);
  const tenantStockMovements = stockMovements.filter(m => m.tenantId === tenantId);

  // Inventory Form
  const [invName, setInvName] = useState("");
  const [invCategory, setInvCategory] = useState("Mains");
  const [invStock, setInvStock] = useState("");
  const [invCost, setInvCost] = useState("");
  const [invPrice, setInvPrice] = useState("");

  // Restock Form
  const [restockItemId, setRestockItemId] = useState<string>("");
  const [restockQty, setRestockQty] = useState("");
  const [restockDate, setRestockDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [restockNote, setRestockNote] = useState("");

  const handleAddInventory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName || !invStock || !invCost || !invPrice) return;
    addInventory({
      tenantId,
      name: invName,
      category: invCategory,
      stock: Number(invStock),
      costPrice: Number(invCost),
      sellingPrice: Number(invPrice)
    });
    setInvName(""); setInvStock(""); setInvCost(""); setInvPrice("");
  };

  const handleRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItemId || !restockQty || !restockDate) return;
    const item = tenantInventory.find(i => i.id === Number(restockItemId));
    if (!item) return;

    addStockMovement({
      tenantId,
      itemId: item.id,
      itemName: item.name,
      date: restockDate,
      type: 'restock',
      quantity: Number(restockQty),
      note: restockNote
    });

    setRestockItemId(""); setRestockQty(""); setRestockNote("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Column 1: Inventory CRUD */}
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-primary">Inventory Catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleAddInventory} className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end bg-background p-4 rounded-lg border border-border">
              <div className="col-span-2 sm:col-span-4 space-y-1">
                <Label className="text-xs text-muted-foreground">Item Name</Label>
                <Input value={invName} onChange={e => setInvName(e.target.value)} placeholder="Name" className="bg-card border-border text-foreground h-9" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select value={invCategory} onValueChange={setInvCategory}>
                  <SelectTrigger className="bg-card border-border text-foreground h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="Mains">Mains</SelectItem>
                    <SelectItem value="Snacks">Snacks</SelectItem>
                    <SelectItem value="Drinks">Drinks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Initial Stock</Label>
                <Input value={invStock} onChange={e => setInvStock(e.target.value)} type="number" placeholder="Qty" className="bg-card border-border text-foreground h-9" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Cost (₦)</Label>
                <Input value={invCost} onChange={e => setInvCost(e.target.value)} type="number" step="0.01" placeholder="0.00" className="bg-card border-border text-foreground h-9" />
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Price (₦)</Label>
                <Input value={invPrice} onChange={e => setInvPrice(e.target.value)} type="number" step="0.01" placeholder="0.00" className="bg-card border-border text-foreground h-9" />
              </div>
              <Button type="submit" className="col-span-2 sm:col-span-4 bg-primary hover:bg-primary/90 text-white h-9">Add Item</Button>
            </form>

            <div className="max-h-[500px] overflow-auto border border-border rounded-md">
              <Table>
                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                  <TableRow className="border-b border-border">
                    <TableHead className="text-muted-foreground">Item</TableHead>
                    <TableHead className="text-muted-foreground">Category</TableHead>
                    <TableHead className="text-muted-foreground text-right">Stock</TableHead>
                    <TableHead className="text-muted-foreground text-right">Price</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantInventory.map(item => (
                    <TableRow key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                      <TableCell className="text-foreground font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-foreground border-border">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={item.stock < 10 ? "text-amber-500 font-bold" : "text-foreground font-bold"}>{item.stock}</span>
                      </TableCell>
                      <TableCell className="text-right text-primary font-medium">₦{item.sellingPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => deleteInventory(item.id)} className="text-red-400 hover:bg-red-900/30 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Column 2: Stock Management */}
      <div className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center"><PackagePlus className="w-5 h-5 mr-2" /> Daily Restocking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleRestock} className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-background p-4 rounded-lg border border-border">
              <div className="col-span-2 space-y-2">
                <Label className="text-foreground">Select Item</Label>
                <Select value={restockItemId} onValueChange={setRestockItemId}>
                  <SelectTrigger className="bg-card border-border text-foreground"><SelectValue placeholder="Choose item" /></SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground max-h-[300px]">
                    {tenantInventory.map(i => <SelectItem key={i.id} value={i.id.toString()}>{i.name} (Cur: {i.stock})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Quantity Added</Label>
                <Input type="number" min="1" value={restockQty} onChange={e => setRestockQty(e.target.value)} className="bg-card border-border text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Date</Label>
                <Input type="date" value={restockDate} onChange={e => setRestockDate(e.target.value)} className="bg-card border-border text-foreground" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-foreground">Note (Optional)</Label>
                <Input value={restockNote} onChange={e => setRestockNote(e.target.value)} placeholder="e.g. Weekly delivery" className="bg-card border-border text-foreground" />
              </div>
              <Button type="submit" className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white mt-2">Record Restock</Button>
            </form>

            <div>
              <h3 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">Recent Stock Movements</h3>
              <div className="max-h-[350px] overflow-auto border border-border rounded-md">
                <Table>
                  <TableHeader className="bg-background sticky top-0 z-10 shadow-sm">
                    <TableRow className="border-b border-border">
                      <TableHead className="text-muted-foreground">Date</TableHead>
                      <TableHead className="text-muted-foreground">Item</TableHead>
                      <TableHead className="text-muted-foreground">Type</TableHead>
                      <TableHead className="text-muted-foreground text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantStockMovements.slice(0, 30).map(m => (
                      <TableRow key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{m.date}</TableCell>
                        <TableCell className="text-foreground">
                          <div>{m.itemName}</div>
                          {m.note && <div className="text-xs text-muted-foreground">{m.note}</div>}
                        </TableCell>
                        <TableCell>
                          {m.type === 'restock' ? (
                            <Badge className="bg-primary/20 text-primary border-primary">Restock</Badge>
                          ) : (
                            <Badge className="bg-amber-600/20 text-amber-400 border-amber-900">Sale</Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${m.type === 'restock' ? 'text-primary' : 'text-amber-400'}`}>
                          {m.type === 'restock' ? '+' : '-'}{m.quantity}
                        </TableCell>
                      </TableRow>
                    ))}
                    {tenantStockMovements.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">No movements recorded yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
