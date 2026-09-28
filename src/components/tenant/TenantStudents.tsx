import { useState, useMemo } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { GraduationCap, ArrowLeft, Banknote, Trash2, AlertTriangle, Search, Filter, RotateCcw, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cardLifecycleLabel, Student } from "@/lib/types";

export function TenantStudents({ tenantId }: { tenantId: string }) {
  const { students, parentUsers, createStudent, updateStudent, deleteStudent, deleteStudents, markCardDelivered, transactions } = useStore();
  const tenantStudents = students.filter(s => s.tenantId === tenantId);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<"all" | "in" | "out">("all");

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [cardStatusFilter, setCardStatusFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [parentStatusFilter, setParentStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selection & Bulk Delete state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ mode: "single" | "selected" | "all"; id?: string; name?: string }>({ mode: "selected" });
  const [isDeleting, setIsDeleting] = useState(false);

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

  const triggerDeleteSingle = (id: string, name: string) => {
    setDeleteTarget({ mode: "single", id, name });
    setDeleteConfirmOpen(true);
  };

  const triggerDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setDeleteTarget({ mode: "selected" });
    setDeleteConfirmOpen(true);
  };

  const triggerDeleteAll = () => {
    if (tenantStudents.length === 0) return;
    setDeleteTarget({ mode: "all" });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteTarget.mode === "single" && deleteTarget.id) {
        await deleteStudent(deleteTarget.id);
        setSelectedIds(prev => prev.filter(x => x !== deleteTarget.id));
      } else if (deleteTarget.mode === "selected") {
        await deleteStudents(selectedIds, tenantId);
        setSelectedIds([]);
      } else if (deleteTarget.mode === "all") {
        await deleteStudents([], tenantId);
        setSelectedIds([]);
      }
      setDeleteConfirmOpen(false);
    } catch (e: any) {
      alert(e?.message || "Failed to delete student(s)");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to determine parent portal status
  const getParentStatus = (s: any): "linked" | "unlinked" | "no_info" => {
    const email = s.parentEmail?.trim().toLowerCase();
    const isLinked = parentUsers.some(
      p => (p.linkedStudentIds && p.linkedStudentIds.includes(s.id)) || (email && p.email?.trim().toLowerCase() === email)
    );
    if (isLinked) return "linked";
    if (email || s.parentName?.trim()) return "unlinked";
    return "no_info";
  };

  const availableClasses = useMemo(() => {
    return Array.from(new Set(tenantStudents.map(s => s.className?.trim()).filter(Boolean))).sort();
  }, [tenantStudents]);

  const filteredStudents = useMemo(() => {
    return tenantStudents.filter(s => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name?.toLowerCase().includes(q);
        const matchesId = s.studentId?.toLowerCase().includes(q);
        const matchesClass = s.className?.toLowerCase().includes(q);
        const matchesParentName = s.parentName?.toLowerCase().includes(q);
        const matchesParentEmail = s.parentEmail?.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesClass && !matchesParentName && !matchesParentEmail) return false;
      }

      if (classFilter !== "all" && s.className !== classFilter) return false;

      if (cardStatusFilter !== "all") {
        if (cardStatusFilter === "Unassigned") {
          if (s.cardStatus !== "Unassigned") return false;
        } else if (s.cardStatus !== cardStatusFilter) {
          return false;
        }
      }

      if (lifecycleFilter !== "all" && s.cardLifecycleStatus !== lifecycleFilter) return false;

      if (parentStatusFilter !== "all") {
        const pStatus = getParentStatus(s);
        if (parentStatusFilter !== pStatus) return false;
      }

      return true;
    });
  }, [tenantStudents, searchQuery, classFilter, cardStatusFilter, lifecycleFilter, parentStatusFilter, parentUsers]);

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    if (pageSize === -1) return filteredStudents;
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const resetFilters = () => {
    setSearchQuery("");
    setClassFilter("all");
    setCardStatusFilter("all");
    setLifecycleFilter("all");
    setParentStatusFilter("all");
    setCurrentPage(1);
  };

  const isFilterActive = searchQuery !== "" || classFilter !== "all" || cardStatusFilter !== "all" || lifecycleFilter !== "all" || parentStatusFilter !== "all";

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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
    const sTx = transactions.filter(t => t.studentId === s.id).filter(tx => {
      if (txFilter === 'in') return tx.amount < 0;
      if (txFilter === 'out') return tx.amount > 0;
      return true;
    }).reverse();

    return (
      <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
        <div className="flex items-center justify-between -ml-4 mb-2">
          <Button variant="ghost" onClick={() => setDetailStudentId(null)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Directory
          </Button>
        </div>
        
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
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <CardTitle className="text-foreground">Transaction History</CardTitle>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                <button onClick={() => setTxFilter('all')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>All</button>
                <button onClick={() => setTxFilter('in')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'in' ? 'bg-background text-green-500 shadow-sm' : 'text-muted-foreground hover:text-green-500'}`}>Money In</button>
                <button onClick={() => setTxFilter('out')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'out' ? 'bg-background text-red-500 shadow-sm' : 'text-muted-foreground hover:text-red-500'}`}>Money Out</button>
              </div>
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
                        <TableCell className={`font-bold text-right pr-4 ${tx.amount < 0 ? 'text-green-500' : 'text-red-500'}`}>{tx.amount < 0 ? '+' : '-'}₦{Math.abs(tx.amount).toFixed(2)}</TableCell>
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <GraduationCap className="text-primary" /> Student Directory
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {tenantStudents.length} student{tenantStudents.length === 1 ? "" : "s"} enrolled
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tenantStudents.length > 0 && (
            <Button
              variant="outline"
              className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 font-semibold"
              onClick={triggerDeleteAll}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Bulk Delete All
            </Button>
          )}
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
                  <Label className="text-foreground">Home Address <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
                  <Input value={homeAddress} onChange={e => setHomeAddress(e.target.value)} placeholder="Enter home address..." className="bg-background border-border text-foreground h-11" />
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
                      <Label className="text-foreground">Billing Address <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
                      <Input value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="Enter billing address..." className="bg-background border-border text-foreground h-11" />
                    </div>
                  )}
                </div>

                <div className="space-y-2 mt-4 pt-4 border-t border-border">
                  <Label className="text-foreground">Parent/Guardian Name <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
                  <Input value={parentName} onChange={e => setParentName(e.target.value)} placeholder="e.g. Mr. & Mrs. Okonkwo" className="bg-background border-border text-foreground h-11" />
                </div>
                <div className="space-y-2 mt-4 pt-4 border-t border-border">
                  <Label className="text-foreground">Parent/Guardian Email <span className="text-muted-foreground text-xs font-normal">(Optional)</span></Label>
                  <Input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)} placeholder="e.g. parent@example.com" className="bg-background border-border text-foreground h-11" />
                </div>

                <div className="col-span-2 flex justify-end mt-6">
                  <Button type="submit" className="bg-primary hover:bg-primary/90 text-white h-12 px-8 font-bold text-lg w-full">Save Student Record</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Selected Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="font-semibold text-foreground text-sm">
              {selectedIds.length} {selectedIds.length === 1 ? "student" : "students"} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={triggerDeleteSelected}
              className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 font-semibold"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Selected ({selectedIds.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* ─── FILTERS & STATUS BAR ───────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search student name, ID, class, parent..."
              className="pl-9 pr-8 bg-background border-border text-foreground h-10 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Class Filter */}
          <div>
            <Select value={classFilter} onValueChange={v => { setClassFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="bg-background border-border text-foreground h-10 text-xs">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground max-h-60">
                <SelectItem value="all">All Classes ({availableClasses.length})</SelectItem>
                {availableClasses.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Card Status Filter */}
          <div>
            <Select value={cardStatusFilter} onValueChange={v => { setCardStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="bg-background border-border text-foreground h-10 text-xs">
                <SelectValue placeholder="Card Status" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="all">All Card Statuses</SelectItem>
                <SelectItem value="Active">Card: Active</SelectItem>
                <SelectItem value="Unassigned">No Card / Unassigned</SelectItem>
                <SelectItem value="Blocked">Card: Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Card Lifecycle Filter */}
          <div>
            <Select value={lifecycleFilter} onValueChange={v => { setLifecycleFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="bg-background border-border text-foreground h-10 text-xs">
                <SelectValue placeholder="Card Lifecycle" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="all">All Lifecycle</SelectItem>
                <SelectItem value="pending_assignment">Unassigned (Pending)</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="ready">Ready for Pickup</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="activated">Activated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Second Row: Parent Link Status & Quick Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-56">
              <Select value={parentStatusFilter} onValueChange={v => { setParentStatusFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="bg-background border-border text-foreground h-8 text-xs">
                  <SelectValue placeholder="Parent Status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All Parent Statuses</SelectItem>
                  <SelectItem value="linked">✓ Parent Portal Linked</SelectItem>
                  <SelectItem value="unlinked">Pending Portal Sign-up</SelectItem>
                  <SelectItem value="no_info">No Guardian Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Filters
              </Button>
            )}

            <span className="text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filteredStudents.length}</span> of {tenantStudents.length} enrolled students
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Per page:</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="bg-background border-border text-foreground h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="-1">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card className="bg-card border-border shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-background border-b border-border">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[45px] py-4 pl-4">
                  <Checkbox
                    checked={filteredStudents.length > 0 && selectedIds.length === filteredStudents.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all students"
                  />
                </TableHead>
                <TableHead className="text-muted-foreground w-[50px] py-4">Photo</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Name / ID</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Class</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Parent Details</TableHead>
                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Statuses</TableHead>
                <TableHead className="text-right text-muted-foreground font-bold uppercase tracking-wider text-xs pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.map(s => {
                const isSelected = selectedIds.includes(s.id);
                const pStatus = getParentStatus(s);
                return (
                  <TableRow key={s.id} className={`border-b border-border/50 hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
                    <TableCell className="py-3 pl-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(s.id)}
                        aria-label={`Select ${s.name}`}
                      />
                    </TableCell>
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
                      <div className="text-foreground font-medium">{s.parentName || "—"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.parentEmail || "No email"}</div>
                      {pStatus === "linked" ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10 mt-1">
                          ✓ Parent Linked
                        </Badge>
                      ) : pStatus === "unlinked" ? (
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10 mt-1">
                          Pending Portal Sign-up
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60 italic block mt-0.5">No parent info</span>
                      )}
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
                        <Button variant="ghost" size="sm" onClick={() => triggerDeleteSingle(s.id, s.name)} className="text-red-400 hover:text-red-300 hover:bg-red-950/30">Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {tenantStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    No students found. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                    <Filter className="w-10 h-10 mx-auto mb-3 opacity-25" />
                    <p className="text-base font-semibold text-foreground mb-1">No students match your filter criteria</p>
                    <p className="text-sm text-muted-foreground mb-4">Try clearing one or more filters to view students.</p>
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset Filters
                    </Button>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background/50">
            <div className="text-xs text-muted-foreground">
              Page <span className="font-semibold text-foreground">{currentPage}</span> of{" "}
              <span className="font-semibold text-foreground">{totalPages}</span>
              {" "}· Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 text-xs"
              >
                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[450px]">
          <DialogHeader>
            <div className="flex items-center gap-3 text-red-500 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <DialogTitle className="text-xl">Confirm Student Deletion</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            {deleteTarget.mode === "single" ? (
              <p>
                Are you sure you want to permanently delete <b className="text-foreground">{deleteTarget.name}</b>? This will remove their card wallet and all associated data. This action cannot be undone.
              </p>
            ) : deleteTarget.mode === "selected" ? (
              <p>
                Are you sure you want to permanently delete <b className="text-foreground">{selectedIds.length}</b> selected student record(s)? Their wallets and cards will also be deleted. This action cannot be undone.
              </p>
            ) : (
              <p>
                Are you sure you want to permanently delete <b className="text-red-500">ALL {tenantStudents.length}</b> students enrolled in this school? This will completely clear the student directory, cards, and wallets.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {isDeleting ? "Deleting…" : deleteTarget.mode === "all" ? "Delete All Students" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
