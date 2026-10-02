import { naira } from "@/lib/money";
import { useState, useMemo } from "react";
import { useStore } from "@/store";
import { LspayParentAccessPanel, LspayParentBadge } from "@/components/LspayParentAccess";
import { CameraCaptureButton, asFileEvent } from "@/components/CameraCapture";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListScroll, Paged, PaginationBar } from "@/components/ui/paginated-list";
import { usePagination } from "@/lib/usePagination";
import { PhotoFilter, hasStudentPhoto, matchesPhotoFilter } from "@/lib/studentPhoto";
import { PRINT_FILTER_OPTIONS, PrintFilter, PrintListMatchDialog, PrintStatusButtons, matchesPrintFilter, printStatusLabel } from "@/components/PrintReady";
import { GUARDIAN_FILTER_OPTIONS, GuardianFilter, exportStudentsWithGuardians, fileSlug, guardiansByStudent, matchesGuardianFilter } from "@/lib/guardians";
import { GuardianCell } from "@/components/guardians/GuardianCell";
import { GuardianEditor, GuardianDraft, draftsFor, guardianDraftErrors } from "@/components/guardians/GuardianEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { GraduationCap, ArrowLeft, Banknote, Trash2, AlertTriangle, Search, Filter, RotateCcw, X, ChevronLeft, ChevronRight, Download, CheckCircle2, Ban, ClipboardList } from "lucide-react";
import { cardLifecycleLabel, Student } from "@/lib/types";

export function TenantStudents({ tenantId }: { tenantId: string }) {
  const { students, parentUsers, lspayGuardians, setPrintStatus, addLspayGuardian, updateLspayGuardian, removeLspayGuardian, refreshLspayParents, createStudent, updateStudent, deleteStudent, deleteStudents, markCardDelivered, transactions, tenants } = useStore();
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
  const [parentStatusFilter, setParentStatusFilter] = useState<GuardianFilter>("all");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>("all");
  const [printFilter, setPrintFilter] = useState<PrintFilter>("all");
  const [listCheckOpen, setListCheckOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

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
  const [guardianDrafts, setGuardianDrafts] = useState<GuardianDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setFirstName(""); setLastName(""); setStudentId(""); setClassName("");
    setHomeAddress(""); setBillingAddress(""); setSameAsHome(false);
    setGuardianDrafts([]); setFormError([]); setImageUrl("");
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
    setGuardianDrafts(draftsFor(s, lspayGuardians, parentUsers));
    setFormError([]);
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

  // Every LSPay guardian of each student: the one on the student record plus imported/added guardians.
  const guardianMap = useMemo(
    () => guardiansByStudent(tenantStudents, lspayGuardians.filter(g => g.tenantId === tenantId), parentUsers.filter(p => p.tenantId === tenantId)),
    [tenantStudents, lspayGuardians, parentUsers, tenantId],
  );
  const guardiansFor = (id: string) => guardianMap.get(id) ?? [];

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
        if (!matchesGuardianFilter(guardiansFor(s.id), parentStatusFilter)) return false;
      }
      if (!matchesPhotoFilter(s, photoFilter)) return false;
      if (!matchesPrintFilter(s, printFilter)) return false;

      return true;
    });
  }, [tenantStudents, searchQuery, classFilter, cardStatusFilter, lifecycleFilter, parentStatusFilter, photoFilter, printFilter, guardianMap]);

  const studentPage = usePagination(filteredStudents, `${searchQuery}|${classFilter}|${cardStatusFilter}|${lifecycleFilter}|${parentStatusFilter}|${photoFilter}|${printFilter}`);
  const paginatedStudents = studentPage.pageItems;

  const resetFilters = () => {
    setSearchQuery("");
    setClassFilter("all");
    setCardStatusFilter("all");
    setLifecycleFilter("all");
    setParentStatusFilter("all");
    setPhotoFilter("all");
    setPrintFilter("all");
  };

  const isFilterActive = searchQuery !== "" || classFilter !== "all" || cardStatusFilter !== "all" || lifecycleFilter !== "all" || parentStatusFilter !== "all" || photoFilter !== "all" || printFilter !== "all";

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

  // Saves the guardian rows: the main one on the student record, the others as LSPay guardians.
  const saveGuardians = async (studentId: string, original: { parentName?: string; parentEmail?: string; parentPhone?: string } | null) => {
    const problems: string[] = [];
    const record = guardianDrafts.find(r => r.isRecord);
    const next = { parentName: record?.name.trim() ?? "", parentEmail: record?.email.trim().toLowerCase() ?? "", parentPhone: record?.phone.trim() ?? "" };
    const before = lspayGuardians.filter(g => g.studentId === studentId);
    const kept = new Set(guardianDrafts.map(r => r.guardianId).filter(Boolean));
    // removals first, so the 3-guardian limit and email checks see the final list
    for (const g of before) if (!kept.has(g.id)) {
      const r = await removeLspayGuardian(g.id, { refresh: false });
      if (!r.success) problems.push(`${g.email}: ${r.message}`);
    }
    if (!original || original.parentName !== next.parentName || (original.parentEmail ?? "").toLowerCase() !== next.parentEmail || (original.parentPhone ?? "") !== next.parentPhone) {
      updateStudent(studentId, next);
    }
    for (const r of guardianDrafts) {
      if (r.isRecord) continue;
      const input = { name: r.name, email: r.email, phone: r.phone, relationship: r.relationship };
      if (r.guardianId) {
        const old = before.find(g => g.id === r.guardianId);
        if (old && old.name === r.name.trim() && old.email === r.email.trim().toLowerCase() && old.phone === r.phone.trim() && old.relationship === r.relationship) continue;
        const res = await updateLspayGuardian(r.guardianId, input, { refresh: false });
        if (!res.success) problems.push(`${r.email}: ${res.message}`);
      } else {
        const res = await addLspayGuardian(studentId, input, { tenantId, refresh: false });
        if (!res.success) problems.push(`${r.email}: ${res.message}`);
      }
    }
    await refreshLspayParents(tenantId);
    return problems;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = guardianDraftErrors(guardianDrafts);
    if (invalid.length) { setFormError(invalid); return; }
    setFormError([]);
    setSaving(true);
    const fullName = `${firstName} ${lastName}`.trim();
    const finalBilling = sameAsHome ? homeAddress : billingAddress;
    const finalImage = imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`;
    const record = guardianDrafts.find(r => r.isRecord);
    const parentName = record?.name.trim() ?? "";
    const parentEmail = record?.email.trim().toLowerCase() ?? "";

    let problems: string[] = [];
    if (editingId) {
      const original = tenantStudents.find(st => st.id === editingId) ?? null;
      updateStudent(editingId, {
        name: fullName,
        studentId,
        className,
        homeAddress,
        billingAddress: finalBilling,
        imageUrl: finalImage
      });
      problems = await saveGuardians(editingId, original);
    } else {
      const created = await createStudent({
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
      if (!created) { setSaving(false); return; }
      // createStudent only creates the record; the guardians are saved here (main one on the record, rest as LSPay guardians)
      problems = await saveGuardians(created.id, null);
    }
    setSaving(false);
    if (problems.length) {
      setFormError(["The student was saved, but some guardians were not:", ...problems]);
      return;
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
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
          <Card className="bg-card border-border lg:col-span-1 h-max shadow-sm lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto overscroll-contain">
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
                <div className="text-sm text-muted-foreground mb-1 font-medium tracking-wide ">Wallet Balance</div>
                <div className="text-4xl font-display text-primary">{naira(s.walletBalance)}</div>
              </div>

              <div className="space-y-4 text-left border-t border-border pt-6">
                <div>
                  <div className="text-xs text-muted-foreground tracking-wider font-bold mb-1">Limits</div>
                  <div className="text-foreground text-sm">Daily: {naira(s.dailyLimit)} | Monthly: {naira(s.monthlyLimit)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground tracking-wider font-bold mb-1">Home Address</div>
                  <div className="text-foreground text-sm">{s.homeAddress || <span className="text-muted-foreground">Not set</span>}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 flex flex-col gap-6 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto overscroll-contain">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <CardTitle className="text-foreground">Transaction History</CardTitle>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                <button onClick={() => setTxFilter('all')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>All</button>
                <button onClick={() => setTxFilter('in')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'in' ? 'bg-background text-green-500 shadow-sm' : 'text-muted-foreground hover:text-green-500'}`}>Money In</button>
                <button onClick={() => setTxFilter('out')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'out' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Money Out</button>
              </div>
            </CardHeader>
            <CardContent>
              <Paged items={sTx} resetKey={s.id}>{(pg) => (
              <div className="overflow-hidden border border-border rounded-lg bg-background">
                <ListScroll page={pg.page} offset="20rem">
                <Table>
                  <TableHeader className="bg-card/80">
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Date</TableHead>
                      <TableHead className="text-muted-foreground">Items</TableHead>
                      <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pg.pageItems.map(tx => (
                      <TableRow key={tx.id} className="border-border/50">
                        <TableCell className="text-foreground text-sm">{tx.date}</TableCell>
                        <TableCell className="text-foreground">{tx.itemsString}</TableCell>
                        <TableCell className={`font-bold text-right pr-4 ${tx.amount < 0 ? 'text-green-600' : 'text-foreground'}`}>{tx.amount < 0 ? '+' : '−'}{naira(Math.abs(tx.amount))}</TableCell>
                      </TableRow>
                    ))}
                    {sTx.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">No transactions recorded.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </ListScroll>
                <PaginationBar p={pg} label="transactions" />
              </div>
              )}</Paged>
            </CardContent>
          </Card>
          <LspayParentAccessPanel student={s} wide className="shadow-sm" />
          </div>
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
              <Button className="bg-primary hover:bg-primary-hover text-primary-foreground font-bold h-10 px-6 rounded-lg shadow-lg shadow-primary/20">Add Student</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-[860px] max-h-[90vh] overflow-y-auto">
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
                      <div className="flex gap-2">
                        <Input type="file" accept="image/*" onChange={handleFileChange} className="bg-card border-border text-foreground flex-1" />
                        <CameraCaptureButton size="icon" label="Take student photo" facing="user" onCapture={f => handleFileChange(asFileEvent(f))} />
                      </div>
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

                <div className="sm:col-span-2 mt-2 pt-4 border-t border-border">
                  <GuardianEditor rows={guardianDrafts} onChange={setGuardianDrafts} />
                </div>

                {formError.length > 0 && (
                  <div className="sm:col-span-2 rounded-xl bg-blush px-3 py-2 text-sm font-semibold text-red-700" role="alert">
                    {formError.map((m, i) => <div key={i}>{m}</div>)}
                  </div>
                )}

                <div className="col-span-2 flex justify-end mt-6">
                  <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary-hover text-primary-foreground h-12 px-8 font-bold text-lg w-full">
                    {saving ? "Saving…" : "Save Student Record"}
                  </Button>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={bulkBusy} className="font-bold text-green-700 border-green-600/40 hover:bg-mint"
              onClick={async () => { setBulkBusy(true); await setPrintStatus(selectedIds, null); setBulkBusy(false); }} data-testid="btn-bulk-ready">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark ready
            </Button>
            <Button variant="outline" size="sm" disabled={bulkBusy} className="font-bold text-red-700 border-red-500/40 hover:bg-blush"
              onClick={async () => { setBulkBusy(true); await setPrintStatus(selectedIds, "not_ready"); setBulkBusy(false); }} data-testid="btn-bulk-not-ready">
              <Ban className="w-4 h-4 mr-1.5" /> Mark not ready
            </Button>
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
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search student name, ID, class, parent..."
              className="pl-9 pr-8 bg-background border-border text-foreground h-10 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Class Filter */}
          <div>
            <Select value={classFilter} onValueChange={v => setClassFilter(v)}>
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
            <Select value={cardStatusFilter} onValueChange={v => setCardStatusFilter(v)}>
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
            <Select value={lifecycleFilter} onValueChange={v => setLifecycleFilter(v)}>
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
            <div className="w-64">
              <Select value={parentStatusFilter} onValueChange={v => setParentStatusFilter(v as GuardianFilter)}>
                <SelectTrigger className="bg-background border-border text-foreground h-8 text-xs">
                  <SelectValue placeholder="Parent Status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  {GUARDIAN_FILTER_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label} ({tenantStudents.filter(st => matchesGuardianFilter(guardiansFor(st.id), o.value)).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-52">
              <Select value={photoFilter} onValueChange={v => setPhotoFilter(v as PhotoFilter)}>
                <SelectTrigger className="bg-background border-border text-foreground h-8 text-xs" data-testid="select-photo-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All photos ({tenantStudents.length})</SelectItem>
                  <SelectItem value="with">With photo ({tenantStudents.filter(hasStudentPhoto).length})</SelectItem>
                  <SelectItem value="without">Without photo ({tenantStudents.length - tenantStudents.filter(hasStudentPhoto).length})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-56">
              <Select value={printFilter} onValueChange={v => setPrintFilter(v as PrintFilter)}>
                <SelectTrigger className="bg-background border-border text-foreground h-8 text-xs" data-testid="select-print-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  {PRINT_FILTER_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label} ({tenantStudents.filter(st => matchesPrintFilter(st, o.value)).length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={() => setListCheckOpen(true)} data-testid="btn-check-list">
              <ClipboardList className="w-3.5 h-3.5 mr-1.5" /> Check against my list
            </Button>

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
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            disabled={filteredStudents.length === 0}
            onClick={() => exportStudentsWithGuardians(
              `${fileSlug(tenants.find(t => t.id === tenantId)?.name ?? "school")}-students${isFilterActive ? "-filtered" : ""}`,
              filteredStudents, guardianMap,
              [{ header: "Card print", value: st => printStatusLabel(st.printStatus) }, { header: "Photo", value: st => (hasStudentPhoto(st) ? "Yes" : "No") }, { header: "Card status", value: st => st.cardStatus }, { header: "Wallet balance", value: st => st.walletBalance }],
            )}
            data-testid="btn-export-students"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export {isFilterActive ? "filtered list" : "all"} (Excel)
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <ListScroll page={studentPage.page} offset="24rem">
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
                <TableHead className="text-muted-foreground font-bold tracking-wider text-xs">Name / ID</TableHead>
                <TableHead className="text-muted-foreground font-bold tracking-wider text-xs">Class</TableHead>
                <TableHead className="text-muted-foreground font-bold tracking-wider text-xs">Parent Details</TableHead>
                <TableHead className="text-muted-foreground font-bold tracking-wider text-xs">Statuses</TableHead>
                <TableHead className="text-muted-foreground font-bold tracking-wider text-xs">Card print</TableHead>
                <TableHead className="text-right text-muted-foreground font-bold tracking-wider text-xs pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.map(s => {
                const isSelected = selectedIds.includes(s.id);
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
                      <GuardianCell guardians={guardiansFor(s.id)} />
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
                    <TableCell>
                      <PrintStatusButtons student={s} />
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-16">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    No students found. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-16">
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
          </ListScroll>
        </CardContent>
        <PaginationBar p={studentPage} label="students" />
      </Card>

      <PrintListMatchDialog
        open={listCheckOpen}
        onClose={() => setListCheckOpen(false)}
        students={classFilter !== "all" ? tenantStudents.filter(st => (st.className || "") === classFilter) : tenantStudents}
        scopeLabel={classFilter !== "all" ? `class ${classFilter}` : "the whole school"}
        schoolName={tenants.find(t => t.id === tenantId)?.name ?? "school"}
      />

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
