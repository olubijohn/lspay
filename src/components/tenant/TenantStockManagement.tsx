import { useState } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Plus } from "lucide-react";

export function TenantStockManagement({ tenantId }: { tenantId: number }) {
  const { inventory, stockMovements, addStockMovement } = useStore();
  const tenantInventory = inventory.filter(i => i.tenantId === tenantId);
  const tenantStockMovements = stockMovements.filter(m => m.tenantId === tenantId);

  const [restockItemId, setRestockItemId] = useState<string>("");
  const [restockQty, setRestockQty] = useState("");
  const [restockDate, setRestockDate] = useState(new Date().toISOString().split('T')[0]);
  const [restockNote, setRestockNote] = useState("");

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
    <div className="space-y-8 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
        <TrendingUp className="text-primary" /> Stock Management
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-card border-border shadow-xl lg:col-span-1 h-max">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Record Restock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRestock} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-foreground">Select Item</Label>
                <Select value={restockItemId} onValueChange={setRestockItemId}>
                  <SelectTrigger className="bg-background border-border text-foreground h-11">
                    <SelectValue placeholder="Choose item" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground max-h-[300px]">
                    {tenantInventory.map(i => (
                      <SelectItem key={i.id} value={i.id.toString()}>
                        {i.name} (Current: {i.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Quantity Added</Label>
                <Input type="number" min="1" required value={restockQty} onChange={e => setRestockQty(e.target.value)} className="bg-background border-border text-foreground h-11 font-bold text-lg" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Date</Label>
                <Input type="date" required value={restockDate} onChange={e => setRestockDate(e.target.value)} className="bg-background border-border text-foreground h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Note (Optional)</Label>
                <Input value={restockNote} onChange={e => setRestockNote(e.target.value)} placeholder="e.g. Weekly delivery" className="bg-background border-border text-foreground h-11" />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white h-12 font-bold text-lg mt-2 shadow-lg shadow-primary/20">
                Submit Restock
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-foreground">Stock Movement Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-auto border-t border-border bg-background rounded-b-xl">
              <Table>
                <TableHeader className="bg-card/80 sticky top-0">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs py-4 pl-6">Date</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Item</TableHead>
                    <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Type</TableHead>
                    <TableHead className="text-right text-muted-foreground font-bold uppercase tracking-wider text-xs pr-6">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantStockMovements.map(m => (
                    <TableRow key={m.id} className="border-border/50 hover:bg-muted/50 transition-colors">
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap pl-6">{m.date}</TableCell>
                      <TableCell className="text-foreground">
                        <div className="font-medium text-base">{m.itemName}</div>
                        {m.note && <div className="text-xs text-muted-foreground mt-0.5">{m.note}</div>}
                      </TableCell>
                      <TableCell>
                        {m.type === 'restock' ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1">Restock</Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 px-3 py-1">Sale</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-black text-xl pr-6 ${m.type === 'restock' ? 'text-primary' : 'text-amber-400'}`}>
                        {m.type === 'restock' ? '+' : '-'}{m.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                  {tenantStockMovements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-16">No movements recorded yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
