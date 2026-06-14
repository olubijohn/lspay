import { useState } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { GraduationCap, ArrowLeft, PoundSterling } from "lucide-react";
import { cardLifecycleLabel } from "@/lib/types";

export function TenantStudents({ tenantId }: { tenantId: number }) {
  const { students, parentUsers, createStudent, updateStudent, markCardDelivered, transactions } = useStore();
  const tenantStudents = students.filter(s => s.tenantId === tenantId);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detailStudentId, setDetailStudentId] = useState<number | null>(null);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [className, setClassName] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [sameAsHome, setSameAsHome] = useState(false);
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setFirstName(""); setLastName(""); setStudentId(""); setClassName("");
    setHomeAddress(""); setBillingAddress(""); setSameAsHome(false);
    setParentName(""); setParentEmail(""); setImageUrl("");
  };

  const openEdit = (s: any) => {
    setEditingId(s.id);
    const [f, ...l] = s.name.split(" ");
    setFirstName(f || "");
    setLastName(l.join(" ") || "");
    setStudentId(s.studentId);
    setClassName(s.className || "");
    setHomeAddress(s.homeAddress || "");
    setBillingAddress(s.billingAddress || "");
    setSameAsHome(s.homeAddress === s.billingAddress && !!s.homeAddress);
    setParentName(s.parentName || "");
    setParentEmail(s.parentEmail || "");
    setImageUrl(s.imageUrl && !s.imageUrl.includes('dicebear') ? s.imageUrl : "");
    setIsOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this student?")) {
      // In a real app, delete from store. For mock, just set inactive or ignore.
      alert("Delete not fully implemented in mock store.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${firstName} ${lastName}`.trim();
    const finalBilling = sameAsHome ? homeAddress : billingAddress;
    const finalImage = imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`;

    if (editingId) {
      updateStudent(editingId, {
        name: fullName,
        studentId,
        className,
        homeAddress,
        billingAddress: finalBilling,
        parentName,
        parentEmail,
        imageUrl: finalImage
      });
    } else {
      createStudent({
        tenantId,
        name: fullName,
        studentId,
        className,
        homeAddress,
        billingAddress: finalBilling,
        parentName,
        parentEmail,
        imageUrl: finalImage,
        cardStatus: "Unassigned",
        cardHardwareId: "",
        cardType: "NFC",
        walletBalance: 0,
        dailyLimit: 10,
        monthlyLimit: 100,
        pin: "",
        parentNotificationSent: false,
        cardLifecycleStatus: "pending_assignment"
      });
    }
    setIsOpen(false);
    resetForm();
  };

  if (detailStudentId) {
    const s = tenantStudents.find(st => st.id === detailStudentId);
    if (!s) return null;
    const sTx = transactions.filter(t => t.studentId === s.id).reverse();

    return (
      <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
        <Button variant="ghost" onClick={() => setDetailStudentId(null)} className="text-muted-foreground hover:text-foreground -ml-4 mb-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
        </Button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="bg-card border-border lg:col-span-1 h-max shadow-xl">
            <CardContent className="p-8 text-center">
              <Avatar className="h-32 w-32 mx-auto mb-6 border-4 border-border bg-background">
                <AvatarImage src={s.imageUrl} />
                <AvatarFallback>{s.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold text-foreground mb-1">{s.name}</h2>
              <p className="text-muted-foreground mb-6">{s.className} • ID: {s.studentId}</p>
              
              <div className="flex flex-col gap-2 mb-8">
                <Badge variant="outline" className={s.cardStatus === 'Active' ? 'text-primary border-primary bg-primary/30 w-max mx-auto' : s.cardStatus === 'Blocked' ? 'text-red-400 border-red-900 bg-red-950/30 w-max mx-auto' : 'text-amber-400 border-amber-900 bg-amber-950/30 w-max mx-auto'}>
                  Card: {s.cardStatus}
                </Badge>
                <Badge className={
                  s.cardLifecycleStatus === 'pending_assignment' ? 'bg-amber-500/20 text-amber-400 mx-auto border-0' : 
                  s.cardLifecycleStatus === 'assigned' ? 'bg-blue-500/20 text-blue-400 mx-auto border-0' : 
                  s.cardLifecycleStatus === 'ready' ? 'bg-cyan-500/20 text-cyan-400 mx-auto border-0' : 
                  s.cardLifecycleStatus === 'delivered' ? 'bg-purple-500/20 text-purple-400 mx-auto border-0' : 
                  'bg-primary/20 text-primary mx-auto border-0'
                }>
                  Status: {cardLifecycleLabel(s.cardLifecycleStatus)}
                </Badge>
              </div>

              <div className="bg-background p-6 rounded-xl border border-border text-center mb-6 shadow-inner">
                <div className="text-sm text-muted-foreground mb-1 font-medium tracking-wide uppercase">Wallet Balance</div>
                <div className="text-4xl font-black text-primary">₦{s.walletBalance.toFixed(2)}</div>
              </div>

              <div className="space-y-4 text-left border-t border-border pt-6">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Limits</div>
                  <div className="text-foreground text-sm">Daily: ₦{s.dailyLimit.toFixed(2)} | Monthly: ₦{s.monthlyLimit.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Parent / Guardian</div>
                  <div className="text-foreground text-sm font-medium">{s.parentName}</div>
                  <div className="text-muted-foreground text-xs mt-0.5">{s.parentEmail}</div>
                  {(() => {
                    const pu = parentUsers.find(p => p.email.toLowerCase() === s.parentEmail.toLowerCase());
                    return pu?.phone ? (
                      <div className="text-muted-foreground text-xs mt-0.5">📞 {pu.phone}</div>
                    ) : null;
                  })()}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Home Address</div>
                  <div className="text-foreground text-sm">{s.homeAddress}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border lg:col-span-2 shadow-xl">
            <CardHeader>
              <CardTitle className="text-foreground">Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-auto border border-border rounded-lg bg-background">
                <Table>
                  <TableHeader className="bg-card/80 sticky top-0">
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Date</TableHead>
                      <TableHead className="text-muted-foreground">Items</TableHead>
                      <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sTx.map(tx => (
                      <TableRow key={tx.id} className="border-border/50">
                        <TableCell className="text-foreground text-sm">{tx.date}</TableCell>
                        <TableCell className="text-foreground">{tx.itemsString}</TableCell>
                        <TableCell className="text-right text-primary font-bold">-₦{tx.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    {sTx.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">No transactions recorded.</TableCell>
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <GraduationCap className="text-primary" /> Student Directory
        </h1>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-lg shadow-lg shadow-primary/20">Add Student</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editingId ? 'Edit Student Profile' : 'Register New Student'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6">
              <div className="col-span-2 flex items-center gap-6 p-4 bg-background rounded-xl border border-border">
                <Avatar className="h-20 w-20 border-2 border-border bg-card">
                  <AvatarImage src={imageUrl || (firstName ? `https://api.dicebear.com/7.x/initials/svg?seed=${firstName} ${lastName}` : "")} />
                  <AvatarFallback className="text-muted-foreground text-sm">IMG</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Label className="text-foreground">Profile Image</Label>
                  <div className="flex gap-2">
                    <Input type="file" accept="image/*" onChange={handleFileChange} className="bg-card border-border text-foreground" />
                    <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Or paste URL..." className="bg-card border-border text-foreground" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">First Name</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} required className="bg-background border-border text-foreground h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Last Name</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} required className="bg-background border-border text-foreground h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Registration Number</Label>
                <Input value={studentId} onChange={e => setStudentId(e.target.value)} required className="bg-background border-border text-foreground h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Class / Year Group</Label>
                <Input value={className} onChange={e => setClassName(e.target.value)} required className="bg-background border-border text-foreground h-11" />
              </div>
              
              <div className="col-span-2 space-y-2 mt-4 pt-4 border-t border-border">
                <Label className="text-foreground">Home Address</Label>
                <Input value={homeAddress} onChange={e => setHomeAddress(e.target.value)} required className="bg-background border-border text-foreground h-11" />
              </div>
              
              <div className="col-span-2 space-y-3">
                <div className="flex items-center space-x-2 bg-background p-3 rounded-lg border border-border">
                  <Checkbox id="sameAddress" checked={sameAsHome} onCheckedChange={(checked) => setSameAsHome(!!checked)} className="border-border data-[state=checked]:bg-primary" />
                  <label htmlFor="sameAddress" className="text-sm font-medium leading-none text-foreground cursor-pointer">
                    Billing address is same as home address
                  </label>
                </div>
                {!sameAsHome && (
                  <div className="space-y-2">
                    <Label className="text-foreground">Billing Address</Label>
                    <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} required className="bg-background border-border text-foreground h-11" />
                  </div>
                )}
              </div>

              <div className="space-y-2 mt-4 pt-4 border-t border-border">
                <Label className="text-foreground">Parent/Guardian Name</Label>
                <Input value={parentName} onChange={e => setParentName(e.target.value)} required className="bg-background border-border text-foreground h-11" />
              </div>
              <div className="space-y-2 mt-4 pt-4 border-t border-border">
                <Label className="text-foreground">Parent/Guardian Email</Label>
                <Input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} required className="bg-background border-border text-foreground h-11" />
              </div>

              <div className="col-span-2 flex justify-end mt-6">
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-white h-12 px-8 font-bold text-lg w-full">Save Student Record</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-background border-b border-border">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground w-[60px] py-4">Photo</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Name / ID</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Class</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Parent Details</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Statuses</TableHead>
                <TableHead className="text-right text-muted-foreground font-bold uppercase tracking-wider text-xs pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenantStudents.map(s => (
                <TableRow key={s.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="py-3">
                    <Avatar className="h-10 w-10 border border-border bg-background">
                      <AvatarImage src={s.imageUrl} alt={s.name} />
                      <AvatarFallback className="text-muted-foreground text-xs">{s.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <div 
                      className="text-foreground font-bold cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setDetailStudentId(s.id)}
                    >
                      {s.name}
                    </div>
                    <div className="text-muted-foreground font-mono text-xs mt-0.5">{s.studentId}</div>
                  </TableCell>
                  <TableCell className="text-foreground">{s.className}</TableCell>
                  <TableCell>
                    <div className="text-foreground">{s.parentName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.parentEmail}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5 items-start">
                      <Badge className={
                        s.cardLifecycleStatus === 'pending_assignment' ? 'bg-amber-500/20 text-amber-400 border-0' : 
                        s.cardLifecycleStatus === 'assigned' ? 'bg-blue-500/20 text-blue-400 border-0' : 
                        s.cardLifecycleStatus === 'ready' ? 'bg-cyan-500/20 text-cyan-400 border-0' : 
                        s.cardLifecycleStatus === 'delivered' ? 'bg-purple-500/20 text-purple-400 border-0' : 
                        'bg-primary/20 text-primary border-0'
                      }>
                        {cardLifecycleLabel(s.cardLifecycleStatus)}
                      </Badge>
                      <Badge variant="outline" className={s.cardStatus === 'Active' ? 'text-primary border-primary/50 bg-primary/20 text-[10px]' : s.cardStatus === 'Blocked' ? 'text-red-400 border-red-900/50 bg-red-950/20 text-[10px]' : 'text-amber-400 border-amber-900/50 bg-amber-950/20 text-[10px]'}>
                        Card: {s.cardStatus}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex justify-end items-center gap-2">
                      {s.cardLifecycleStatus === 'ready' && (
                        <Button 
                          size="sm" 
                          onClick={() => markCardDelivered(s.id)} 
                          className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8"
                        >
                          Confirm Delivery
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)} className="text-muted-foreground hover:text-foreground hover:bg-muted">Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-300 hover:bg-red-950/30">Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tenantStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-16">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    No students found. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
