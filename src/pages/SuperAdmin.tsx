import { useState, useMemo } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Shield, ShieldAlert, Building2, Users, Bell, CreditCard, LayoutDashboard, Plus, ChevronDown, ChevronRight, Receipt, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { SystemUser, AppNotification, CardLifecycleStatus, cardLifecycleLabel } from "@/lib/types";
import { SuperAdminSidebar } from "@/components/layout/SuperAdminSidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { Wallet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { useChartTheme } from "@/theme";
import { useNfcScanner } from "@/lib/useNfcScanner";
import { QrScanner } from "@/components/QrScanner";
import { Wifi } from "lucide-react";

export function SuperAdmin() {
  const chartTheme = useChartTheme();
  const { tenants, students, transactions, addTenant, assignCard, replaceCard, removeCard, systemUsers, createSystemUser, updateSystemUser, notifications, markNotificationRead, markCardReady } = useStore();
  const [activeTab, setActiveTab] = useState("overview");
  const [successMsg, setSuccessMsg] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  // Overview Filters
  const [filterSchool, setFilterSchool] = useState<string>("all");
  const [startDate, setStartDate] = useState("2026-06-01");
  const [endDate, setEndDate] = useState("2026-06-10");

  // Card Assignment State
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [cardType, setCardType] = useState("NFC");
  const [hardwareId, setHardwareId] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);

  // Card Assignment Studio filters & search
  const [cardSearch, setCardSearch] = useState("");
  const [cardFilterSchool, setCardFilterSchool] = useState<string>("all");
  const [cardFilterStatus, setCardFilterStatus] = useState<string>("all");
  const [cardActivatedStart, setCardActivatedStart] = useState("");
  const [cardActivatedEnd, setCardActivatedEnd] = useState("");
  const { supported: nfcSupported, status: nfcStatus, error: nfcError, start: startNfc } = useNfcScanner((id) => {
    setHardwareId(id);
    setCardType("NFC");
  });

  // School Modal
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  const [newSchoolCode, setNewSchoolCode] = useState("");
  const [newSchoolAddress, setNewSchoolAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Platform User Modal
  const [showPlatformUserModal, setShowPlatformUserModal] = useState(false);
  const [platformUserName, setPlatformUserName] = useState("");
  const [platformUserEmail, setPlatformUserEmail] = useState("");
  const [platformUserPassword, setPlatformUserPassword] = useState("");

  // Tenant User Modal
  const [showTenantUserModal, setShowTenantUserModal] = useState(false);
  const [selectedUserTenantId, setSelectedUserTenantId] = useState<string>("");
  const [tenantUserName, setTenantUserName] = useState("");
  const [tenantUserEmail, setTenantUserEmail] = useState("");
  const [tenantUserPassword, setTenantUserPassword] = useState("");
  const [tenantUserRole, setTenantUserRole] = useState<"tenant_admin" | "backoffice" | "kiosk_operator">("tenant_admin");

  // Transactions
  const [txFilterSchool, setTxFilterSchool] = useState<string>("all");
  const [txStartDate, setTxStartDate] = useState("2026-06-01");
  const [txEndDate, setTxEndDate] = useState("2026-06-10");
  const [expandedSchoolDay, setExpandedSchoolDay] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  const handleAddSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName || !newSchoolCode || !newSchoolAddress || !contactName || !contactEmail) return;
    const enrollmentKey = `SCH-${newSchoolCode.toUpperCase()}-2026`;
    const newTenant = addTenant({ name: newSchoolName, code: newSchoolCode.toUpperCase(), address: newSchoolAddress, contactName, contactEmail, enrollmentKey });
    const tempPassword = enrollmentKey.substring(0, 6).toLowerCase();
    createSystemUser({ name: contactName, email: contactEmail, passwordHash: tempPassword, role: "tenant_admin", tenantId: newTenant.id, isActive: true });
    showSuccess(`School provisioned! Enrollment Key: ${enrollmentKey} | Admin password: ${tempPassword}`);
    setNewSchoolName(""); setNewSchoolCode(""); setNewSchoolAddress(""); setContactName(""); setContactEmail("");
    setShowSchoolModal(false);
  };

  const handleAssignCard = () => {
    if (!selectedStudentId || !hardwareId) return;
    assignCard(Number(selectedStudentId), cardType, hardwareId);
    showSuccess("Card mapped and assigned successfully.");
    setHardwareId("");
  };

  const handleMarkReady = (id: number) => {
    markCardReady(id);
    showSuccess("Card marked as ready for pickup. Notification sent to tenant.");
  };

  const handleReplaceCard = (id: number) => {
    if (!hardwareId.trim()) return;
    replaceCard(id, cardType, hardwareId.trim());
    showSuccess("Card replaced. The new card has been linked to the student.");
    setReplaceMode(false);
    setHardwareId("");
  };

  const handleRemoveCard = (id: number) => {
    removeCard(id);
    showSuccess("Card removed. The student is now awaiting a new card.");
    setRemoveConfirm(false);
    setHardwareId("");
  };

  const handleAddPlatformUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!platformUserName || !platformUserEmail || !platformUserPassword) return;
    createSystemUser({ name: platformUserName, email: platformUserEmail, passwordHash: platformUserPassword, role: "super_admin", tenantId: null, isActive: true });
    showSuccess("Platform user added.");
    setPlatformUserName(""); setPlatformUserEmail(""); setPlatformUserPassword("");
    setShowPlatformUserModal(false);
  };

  const handleAddTenantUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserTenantId || !tenantUserName || !tenantUserEmail || !tenantUserPassword) return;
    createSystemUser({ name: tenantUserName, email: tenantUserEmail, passwordHash: tenantUserPassword, role: tenantUserRole, tenantId: Number(selectedUserTenantId), isActive: true });
    showSuccess("Tenant user added.");
    setTenantUserName(""); setTenantUserEmail(""); setTenantUserPassword("");
    setShowTenantUserModal(false);
  };

  const filteredTx = transactions.filter(t => {
    if (filterSchool !== "all" && t.tenantId !== Number(filterSchool)) return false;
    if (t.date < startDate || t.date > endDate) return false;
    return true;
  });

  const dailyRevData = Object.entries(
    filteredTx.reduce((acc, t) => { acc[t.date] = (acc[t.date] || 0) + t.amount; return acc; }, {} as Record<string, number>)
  ).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => a.date.localeCompare(b.date));

  // Transactions tab — roll-up by school × date
  const txFiltered = useMemo(() => transactions.filter(t => {
    if (txFilterSchool !== "all" && t.tenantId !== Number(txFilterSchool)) return false;
    if (t.date < txStartDate || t.date > txEndDate) return false;
    return true;
  }), [transactions, txFilterSchool, txStartDate, txEndDate]);

  // Group by date, then school
  const txRollup = useMemo(() => {
    const map: Record<string, Record<string, { schoolName: string; tenantId: number; total: number; count: number; txs: typeof transactions }>> = {};
    txFiltered.forEach(t => {
      if (!map[t.date]) map[t.date] = {};
      const key = t.tenantId.toString();
      if (!map[t.date][key]) map[t.date][key] = { schoolName: t.schoolName, tenantId: t.tenantId, total: 0, count: 0, txs: [] };
      map[t.date][key].total += t.amount;
      map[t.date][key].count += 1;
      map[t.date][key].txs.push(t);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [txFiltered]);

  // Card Assignment Studio — filtered & searched students
  const cardFilteredStudents = useMemo(() => {
    const q = cardSearch.trim().toLowerCase();
    return students.filter(s => {
      if (cardFilterSchool !== "all" && s.tenantId !== Number(cardFilterSchool)) return false;
      if (cardFilterStatus !== "all" && s.cardLifecycleStatus !== cardFilterStatus) return false;
      if (cardActivatedStart || cardActivatedEnd) {
        if (!s.activatedAt) return false;
        if (cardActivatedStart && s.activatedAt < cardActivatedStart) return false;
        if (cardActivatedEnd && s.activatedAt > cardActivatedEnd) return false;
      }
      if (q && !s.name.toLowerCase().includes(q) && !s.studentId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, cardFilterSchool, cardFilterStatus, cardActivatedStart, cardActivatedEnd, cardSearch]);

  const cardStatusBadgeClass = (status: CardLifecycleStatus) =>
    status === "pending_assignment" ? "bg-amber-500/20 text-amber-400 border-0" :
    status === "assigned" ? "bg-blue-500/20 text-blue-400 border-0" :
    status === "ready" ? "bg-cyan-500/20 text-cyan-400 border-0" :
    status === "delivered" ? "bg-purple-500/20 text-purple-400 border-0" :
    status === "activated" ? "bg-primary/20 text-primary border-0" :
    "bg-muted text-muted-foreground border-0";

  const cardStatusFilterOptions: { value: string; label: string }[] = [
    { value: "all", label: "All Statuses" },
    { value: "pending_assignment", label: "Awaiting Card" },
    { value: "assigned", label: "Assigned" },
    { value: "ready", label: "Ready" },
    { value: "delivered", label: "Collected" },
    { value: "activated", label: "Active" },
  ];

  const roleBadge = (role: string) => {
    const cls = role === "tenant_admin" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : role === "backoffice" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return <Badge variant="outline" className={cls}>{role.replace(/_/g, " ")}</Badge>;
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <SuperAdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} mobileOpen={mobileNav} onMobileOpenChange={setMobileNav} />
      <MobileTopBar title="LSPay" icon={Wallet} onMenuClick={() => setMobileNav(true)} />

      <main className="flex-1 lg:ml-64 overflow-y-auto bg-background px-4 pb-6 pt-20 lg:px-8 lg:pb-8 lg:pt-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {successMsg && (
            <Alert className="bg-primary/30 border border-primary text-primary">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* ─── OVERVIEW ─────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                  <LayoutDashboard className="text-primary" /> Global Overview
                </h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-card p-2 rounded-lg border border-border">
                  <Select value={filterSchool} onValueChange={setFilterSchool}>
                    <SelectTrigger className="w-full sm:w-44 bg-background border-border text-foreground" data-testid="select-filter-school">
                      <SelectValue placeholder="All Schools" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="all">All Schools</SelectItem>
                      {tenants.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="flex-1 min-w-[8rem] sm:flex-none sm:w-36 bg-background border-border text-foreground" data-testid="input-start-date" />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="flex-1 min-w-[8rem] sm:flex-none sm:w-36 bg-background border-border text-foreground" data-testid="input-end-date" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Schools", value: tenants.length, color: "text-foreground" },
                  { label: "Transaction Volume", value: `£${filteredTx.reduce((s, t) => s + t.amount, 0).toFixed(2)}`, color: "text-primary" },
                  { label: "Total Operations", value: filteredTx.length, color: "text-foreground" },
                  { label: "Active Students", value: students.filter(s => s.cardStatus === "Active" && (filterSchool === "all" || s.tenantId === Number(filterSchool))).length, color: "text-blue-400" },
                ].map(c => (
                  <Card key={c.label} className="bg-card border-border">
                    <CardContent className="p-6">
                      <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase mb-2">{c.label}</div>
                      <div className={`text-3xl font-black ${c.color}`}>{c.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-foreground">Revenue Trend</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyRevData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={12} />
                      <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={v => `£${v}`} />
                      <RechartsTooltip contentStyle={chartTheme.tooltip} />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-foreground">Recent Transactions</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader className="bg-background sticky top-0">
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">Date</TableHead>
                          <TableHead className="text-muted-foreground">School</TableHead>
                          <TableHead className="text-muted-foreground">Student</TableHead>
                          <TableHead className="text-muted-foreground">Items</TableHead>
                          <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTx.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No transactions in this range.</TableCell></TableRow>
                        ) : filteredTx.map(tx => (
                          <TableRow key={tx.id} className="border-border/50">
                            <TableCell className="text-foreground">{tx.date}</TableCell>
                            <TableCell className="text-foreground">{tx.schoolName}</TableCell>
                            <TableCell className="text-foreground">{tx.studentName}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{tx.itemsString}</TableCell>
                            <TableCell className="text-primary font-bold text-right">£{tx.amount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── TRANSACTIONS ─────────────────────────────────────── */}
          {activeTab === "transactions" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                  <Receipt className="text-primary" /> Transactions
                </h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-card p-2 rounded-lg border border-border">
                  <Select value={txFilterSchool} onValueChange={setTxFilterSchool}>
                    <SelectTrigger className="w-full sm:w-44 bg-background border-border text-foreground" data-testid="select-tx-school">
                      <SelectValue placeholder="All Schools" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="all">All Schools</SelectItem>
                      {tenants.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input type="date" value={txStartDate} onChange={e => setTxStartDate(e.target.value)} className="flex-1 min-w-[8rem] sm:flex-none sm:w-36 bg-background border-border text-foreground" />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="date" value={txEndDate} onChange={e => setTxEndDate(e.target.value)} className="flex-1 min-w-[8rem] sm:flex-none sm:w-36 bg-background border-border text-foreground" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Total Volume</div>
                    <div className="text-3xl font-black text-primary">£{txFiltered.reduce((s, t) => s + t.amount, 0).toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Total Transactions</div>
                    <div className="text-3xl font-black text-foreground">{txFiltered.length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide mb-2">Schools Active</div>
                    <div className="text-3xl font-black text-blue-400">{new Set(txFiltered.map(t => t.tenantId)).size}</div>
                  </CardContent>
                </Card>
              </div>

              {txRollup.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-xl border border-border">
                  <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No transactions match your filters.</p>
                </div>
              ) : txRollup.map(([date, schoolMap]) => {
                const dayTotal = Object.values(schoolMap).reduce((s, v) => s + v.total, 0);
                return (
                  <Card key={date} className="bg-card border-border overflow-hidden">
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/80">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-foreground font-bold text-lg">{date}</span>
                        <Badge variant="outline" className="text-muted-foreground border-border ml-2">{Object.values(schoolMap).reduce((s, v) => s + v.count, 0)} transactions</Badge>
                      </div>
                      <span className="text-primary font-black text-xl">£{dayTotal.toFixed(2)}</span>
                    </div>
                    <div className="divide-y divide-border">
                      {Object.entries(schoolMap).map(([tenantKey, data]) => {
                        const rowKey = `${date}-${tenantKey}`;
                        const isExpanded = expandedSchoolDay === rowKey;
                        return (
                          <div key={tenantKey}>
                            <button
                              onClick={() => setExpandedSchoolDay(isExpanded ? null : rowKey)}
                              className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                              data-testid={`btn-expand-${rowKey}`}
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                <span className="text-foreground font-medium">{data.schoolName}</span>
                                <Badge className="bg-muted text-muted-foreground border-0">{data.count} txs</Badge>
                              </div>
                              <span className="text-primary font-bold">£{data.total.toFixed(2)}</span>
                            </button>
                            {isExpanded && (
                              <div className="bg-background border-t border-border">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="border-border">
                                      <TableHead className="text-muted-foreground pl-14">Student</TableHead>
                                      <TableHead className="text-muted-foreground">Items</TableHead>
                                      <TableHead className="text-muted-foreground text-right pr-6">Amount</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {data.txs.map(tx => (
                                      <TableRow key={tx.id} className="border-border/40">
                                        <TableCell className="text-foreground pl-14 font-medium">{tx.studentName}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{tx.itemsString}</TableCell>
                                        <TableCell className="text-primary font-bold text-right pr-6">£{tx.amount.toFixed(2)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ─── SCHOOLS ──────────────────────────────────────────── */}
          {activeTab === "schools" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                  <Building2 className="text-primary" /> Schools
                </h1>
                <Button onClick={() => setShowSchoolModal(true)} className="bg-primary hover:bg-primary/90 text-white" data-testid="btn-provision-school">
                  <Plus className="h-4 w-4 mr-2" /> Provision School
                </Button>
              </div>

              <Card className="bg-card border-border">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-background">
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground px-6 py-4">School</TableHead>
                        <TableHead className="text-muted-foreground py-4">Enrollment Key</TableHead>
                        <TableHead className="text-muted-foreground py-4">Contact</TableHead>
                        <TableHead className="text-muted-foreground py-4 text-right pr-6">Students</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.map(t => (
                        <TableRow key={t.id} className="border-border/50">
                          <TableCell className="px-6 py-4">
                            <div className="text-foreground font-bold">{t.name}</div>
                            <div className="text-xs text-muted-foreground">{t.address}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-background text-primary border-primary/50 font-mono">{t.enrollmentKey}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-foreground">{t.contactName}</div>
                            <div className="text-xs text-muted-foreground">{t.contactEmail}</div>
                          </TableCell>
                          <TableCell className="text-foreground font-bold text-right pr-6">{students.filter(s => s.tenantId === t.id).length}</TableCell>
                        </TableRow>
                      ))}
                      {tenants.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No schools provisioned yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── CARD ASSIGNMENT ──────────────────────────────────── */}
          {activeTab === "cards" && (
            <div className="space-y-6 h-full flex flex-col">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <CreditCard className="text-primary" /> Card Assignment Studio
              </h1>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
                <div className="lg:col-span-7 bg-card border border-border rounded-xl flex flex-col overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-border space-y-3">
                    <div>
                      <h3 className="font-bold text-foreground">Card Registry</h3>
                      <p className="text-sm text-muted-foreground mt-1">Search, filter and select a student to manage their card</p>
                    </div>
                    <Input
                      value={cardSearch}
                      onChange={e => setCardSearch(e.target.value)}
                      placeholder="Search by student name or registration no…"
                      className="bg-background border-border text-foreground h-10"
                      data-testid="input-card-search"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Select value={cardFilterSchool} onValueChange={setCardFilterSchool}>
                        <SelectTrigger className="w-full sm:w-44 bg-background border-border text-foreground" data-testid="select-card-school">
                          <SelectValue placeholder="All Schools" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="all">All Schools</SelectItem>
                          {tenants.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={cardFilterStatus} onValueChange={setCardFilterStatus}>
                        <SelectTrigger className="w-full sm:w-44 bg-background border-border text-foreground" data-testid="select-card-status">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          {cardStatusFilterOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground w-full sm:w-auto">Activated between</span>
                      <Input type="date" value={cardActivatedStart} onChange={e => setCardActivatedStart(e.target.value)} className="flex-1 min-w-[8rem] sm:flex-none sm:w-40 bg-background border-border text-foreground" data-testid="input-card-activated-start" />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input type="date" value={cardActivatedEnd} onChange={e => setCardActivatedEnd(e.target.value)} className="flex-1 min-w-[8rem] sm:flex-none sm:w-40 bg-background border-border text-foreground" data-testid="input-card-activated-end" />
                      {(cardSearch || cardFilterSchool !== "all" || cardFilterStatus !== "all" || cardActivatedStart || cardActivatedEnd) && (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-9 text-muted-foreground hover:text-foreground"
                          onClick={() => { setCardSearch(""); setCardFilterSchool("all"); setCardFilterStatus("all"); setCardActivatedStart(""); setCardActivatedEnd(""); }}
                          data-testid="btn-clear-card-filters"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground" data-testid="text-card-result-count">{cardFilteredStudents.length} student{cardFilteredStudents.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex-1 overflow-auto bg-background">
                    <Table>
                      <TableHeader className="bg-card/80 sticky top-0">
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">School</TableHead>
                          <TableHead className="text-muted-foreground">Student</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground">Activated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cardFilteredStudents.map(s => (
                          <TableRow
                            key={s.id}
                            onClick={() => { setSelectedStudentId(s.id.toString()); setReplaceMode(false); setRemoveConfirm(false); setHardwareId(""); }}
                            className={`cursor-pointer border-border/50 transition-colors ${selectedStudentId === s.id.toString() ? "bg-primary/20" : "hover:bg-card/50"}`}
                            data-testid={`row-student-${s.id}`}
                          >
                            <TableCell className="text-foreground text-sm">{tenants.find(t => t.id === s.tenantId)?.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <img src={s.imageUrl} alt="" className="w-8 h-8 rounded-full bg-muted" onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/32x32/1e293b/94a3b8?text=${s.name[0]}`; }} />
                                <div>
                                  <div className="text-foreground font-medium">{s.name}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{s.studentId}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cardStatusBadgeClass(s.cardLifecycleStatus)}>
                                {cardLifecycleLabel(s.cardLifecycleStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm font-mono">{s.activatedAt ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                        {cardFilteredStudents.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No students match your filters.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="lg:col-span-5">
                  {selectedStudentId ? (() => {
                    const student = students.find(s => s.id === Number(selectedStudentId));
                    if (!student) return null;
                    return (
                      <Card className="bg-card border-border shadow-xl sticky top-8">
                        <CardHeader>
                          <CardTitle className="text-foreground flex items-center gap-3">
                            <img src={student.imageUrl} alt="" className="w-10 h-10 rounded-full bg-muted" onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/40x40/1e293b/94a3b8?text=${student.name[0]}`; }} />
                            <div>
                              <div>{student.name}</div>
                              <div className="text-sm font-normal text-muted-foreground">{student.className} · {tenants.find(t => t.id === student.tenantId)?.name}</div>
                            </div>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          {student.cardLifecycleStatus === "pending_assignment" ? (
                            <>
                              <div className="space-y-3">
                                <Label className="text-foreground">Card Type</Label>
                                <Select value={cardType} onValueChange={setCardType}>
                                  <SelectTrigger className="bg-background border-border text-foreground h-11" data-testid="select-card-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-card border-border text-foreground">
                                    <SelectItem value="NFC">NFC Smart Card</SelectItem>
                                    <SelectItem value="QR">QR Code Tag</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-3">
                                <Label className="text-foreground">Hardware ID / Payload</Label>
                                <Input value={hardwareId} onChange={e => setHardwareId(e.target.value)} placeholder="e.g. NFC-1234 — or tap Scan Card" className="bg-background border-border text-foreground h-11 font-mono" data-testid="input-hardware-id" />
                                <div className="grid grid-cols-2 gap-2">
                                  <Button type="button" variant="outline" onClick={startNfc} className="border-border text-foreground h-11 font-bold" data-testid="btn-scan-card-admin">
                                    <Wifi className="mr-2 h-4 w-4" />
                                    {nfcStatus === "scanning" ? "Scanning…" : "Scan NFC"}
                                  </Button>
                                  <QrScanner triggerClassName="border-border text-foreground h-11 font-bold" onResult={(text) => { setHardwareId(text); setCardType("QR"); }} />
                                </div>
                                {!nfcSupported && <p className="text-xs text-muted-foreground">Tip: NFC scanning works in Chrome or Edge on Android. QR scanning uses the device camera. You can also type the ID above on any device.</p>}
                                {nfcSupported && nfcError && <p className="text-xs text-red-400">{nfcError}</p>}
                                {nfcSupported && nfcStatus === "success" && hardwareId && <p className="text-xs text-primary">Card captured ✓ — review and assign below.</p>}
                              </div>
                              <Button onClick={handleAssignCard} className="w-full bg-primary hover:bg-primary/90 text-white h-11 font-bold" data-testid="btn-assign-card">
                                Assign & Map Card
                              </Button>
                            </>
                          ) : (
                            <>
                              {student.cardLifecycleStatus === "assigned" ? (
                                <div className="space-y-6 bg-background/50 p-6 rounded-xl border border-border text-center">
                                  <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto border border-blue-500/30">
                                    <CreditCard className="w-7 h-7 text-blue-400" />
                                  </div>
                                  <h3 className="text-lg font-bold text-foreground">Card Assigned</h3>
                                  <p className="text-muted-foreground text-sm">Hardware: <span className="font-mono text-foreground">{student.cardHardwareId}</span> ({student.cardType})</p>
                                  <Button onClick={() => handleMarkReady(student.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 font-bold" data-testid="btn-mark-ready">
                                    Mark as Ready for Pickup
                                  </Button>
                                  <p className="text-xs text-muted-foreground">This notifies the school tenant.</p>
                                </div>
                              ) : (
                                <div className="space-y-4 bg-background/50 p-6 rounded-xl border border-border text-center">
                                  <div className="w-14 h-14 bg-primary/15 rounded-full flex items-center justify-center mx-auto border border-primary/30">
                                    <CheckCircle2 className="w-7 h-7 text-primary" />
                                  </div>
                                  <Badge className={cardStatusBadgeClass(student.cardLifecycleStatus)}>
                                    {cardLifecycleLabel(student.cardLifecycleStatus)}
                                  </Badge>
                                  <p className="text-muted-foreground text-sm">Hardware: <span className="font-mono text-foreground">{student.cardHardwareId}</span> ({student.cardType})</p>
                                  {student.cardLifecycleStatus === "activated" && student.activatedAt && (
                                    <p className="text-xs text-muted-foreground">Activated on <span className="font-mono text-foreground">{student.activatedAt}</span></p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    {student.cardLifecycleStatus === "ready"
                                      ? "Ready for pickup — awaiting collection by the school."
                                      : student.cardLifecycleStatus === "delivered"
                                      ? "Collected — awaiting activation by the parent."
                                      : "Card is active and ready for purchases."}
                                  </p>
                                </div>
                              )}

                              <div className="space-y-3 pt-5 border-t border-border">
                                <div>
                                  <Label className="text-foreground text-sm font-semibold">Card Management</Label>
                                  <p className="text-xs text-muted-foreground mt-1">Lost or damaged card? Relink a replacement or remove the current one. The wallet balance is always kept.</p>
                                </div>

                                {!replaceMode && !removeConfirm && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <Button type="button" variant="outline" onClick={() => { setReplaceMode(true); setRemoveConfirm(false); setCardType(student.cardType || "NFC"); setHardwareId(""); }} className="border-border text-foreground h-10" data-testid="btn-replace-card">
                                      <RefreshCw className="mr-2 h-4 w-4" /> Replace / Relink
                                    </Button>
                                    <Button type="button" variant="outline" onClick={() => { setRemoveConfirm(true); setReplaceMode(false); }} className="border-red-900/50 text-red-400 hover:bg-red-950/30 hover:text-red-300 h-10" data-testid="btn-remove-card">
                                      <Trash2 className="mr-2 h-4 w-4" /> Remove Card
                                    </Button>
                                  </div>
                                )}

                                {replaceMode && (
                                  <div className="space-y-3 bg-background/50 p-4 rounded-xl border border-border">
                                    <div className="space-y-2">
                                      <Label className="text-foreground text-sm">New Card Type</Label>
                                      <Select value={cardType} onValueChange={setCardType}>
                                        <SelectTrigger className="bg-background border-border text-foreground h-10" data-testid="select-replace-card-type"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-card border-border text-foreground">
                                          <SelectItem value="NFC">NFC Smart Card</SelectItem>
                                          <SelectItem value="QR">QR Code Tag</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-foreground text-sm">New Hardware ID / Payload</Label>
                                      <Input value={hardwareId} onChange={e => setHardwareId(e.target.value)} placeholder="e.g. NFC-5678 — or tap Scan Card" className="bg-background border-border text-foreground h-10 font-mono" data-testid="input-replace-hardware-id" />
                                      <div className="grid grid-cols-2 gap-2">
                                        <Button type="button" variant="outline" onClick={startNfc} className="border-border text-foreground h-10 font-bold" data-testid="btn-scan-replace-card">
                                          <Wifi className="mr-2 h-4 w-4" /> {nfcStatus === "scanning" ? "Scanning…" : "Scan NFC"}
                                        </Button>
                                        <QrScanner triggerClassName="border-border text-foreground h-10 font-bold" onResult={(text) => { setHardwareId(text); setCardType("QR"); }} />
                                      </div>
                                      {nfcSupported && nfcError && <p className="text-xs text-red-400">{nfcError}</p>}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {student.cardLifecycleStatus === "activated"
                                        ? "Wallet balance, PIN and limits are kept. The new card stays active immediately."
                                        : "Wallet balance is kept. The new card re-enters the pickup flow."}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Button type="button" variant="ghost" onClick={() => { setReplaceMode(false); setHardwareId(""); }} className="text-muted-foreground h-10" data-testid="btn-cancel-replace">Cancel</Button>
                                      <Button type="button" onClick={() => handleReplaceCard(student.id)} disabled={!hardwareId.trim()} className="bg-primary hover:bg-primary/90 text-white h-10 font-bold" data-testid="btn-confirm-replace">Confirm Replacement</Button>
                                    </div>
                                  </div>
                                )}

                                {removeConfirm && (
                                  <div className="space-y-3 bg-red-950/20 p-4 rounded-xl border border-red-900/50">
                                    <p className="text-sm text-red-300">Remove this card from <span className="font-semibold">{student.name}</span>? The wallet balance is kept, but the card is unlinked and the student returns to "Awaiting Card".</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Button type="button" variant="ghost" onClick={() => setRemoveConfirm(false)} className="text-muted-foreground h-10" data-testid="btn-cancel-remove">Cancel</Button>
                                      <Button type="button" onClick={() => handleRemoveCard(student.id)} className="bg-red-600 hover:bg-red-700 text-white h-10 font-bold" data-testid="btn-confirm-remove">Remove Card</Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })() : (
                    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl p-8 bg-card/30">
                      <CreditCard className="w-14 h-14 mb-4 opacity-30" />
                      <p className="text-center text-sm">Select a student from the list to manage their card.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── PLATFORM USERS ───────────────────────────────────── */}
          {activeTab === "platform_users" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                  <Shield className="text-primary" /> Platform Users
                </h1>
                <Button onClick={() => setShowPlatformUserModal(true)} className="bg-primary hover:bg-primary/90 text-white" data-testid="btn-add-platform-user">
                  <Plus className="h-4 w-4 mr-2" /> Add User
                </Button>
              </div>
              <Card className="bg-card border-border">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-background">
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground px-6 py-4">User</TableHead>
                        <TableHead className="text-muted-foreground">Role</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-right px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {systemUsers.filter(u => u.tenantId === null).map(u => (
                        <TableRow key={u.id} className="border-border/50">
                          <TableCell className="px-6 py-4">
                            <div className="text-foreground font-bold">{u.name}</div>
                            <div className="text-sm text-muted-foreground">{u.email}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">super admin</Badge></TableCell>
                          <TableCell><Badge variant="outline" className={u.isActive ? "text-primary border-primary" : "text-muted-foreground border-border"}>{u.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="sm" onClick={() => updateSystemUser(u.id, { isActive: !u.isActive })} className="text-muted-foreground hover:text-foreground" data-testid={`btn-toggle-user-${u.id}`}>
                              {u.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── TENANT USERS ─────────────────────────────────────── */}
          {activeTab === "tenant_users" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                  <Users className="text-primary" /> Tenant Users
                </h1>
                <div className="flex items-center gap-3">
                  <Select value={selectedUserTenantId} onValueChange={setSelectedUserTenantId}>
                    <SelectTrigger className="w-full sm:w-52 bg-card border-border text-foreground" data-testid="select-tenant-for-users">
                      <SelectValue placeholder="Select School..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {tenants.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedUserTenantId && (
                    <Button onClick={() => setShowTenantUserModal(true)} className="bg-primary hover:bg-primary/90 text-white" data-testid="btn-add-tenant-user">
                      <Plus className="h-4 w-4 mr-2" /> Add User
                    </Button>
                  )}
                </div>
              </div>
              {selectedUserTenantId ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-background">
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground px-6 py-4">User</TableHead>
                          <TableHead className="text-muted-foreground">Role</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-right px-6">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {systemUsers.filter(u => u.tenantId === Number(selectedUserTenantId)).map(u => (
                          <TableRow key={u.id} className="border-border/50">
                            <TableCell className="px-6 py-4">
                              <div className="text-foreground font-bold">{u.name}</div>
                              <div className="text-sm text-muted-foreground">{u.email}</div>
                            </TableCell>
                            <TableCell>{roleBadge(u.role)}</TableCell>
                            <TableCell><Badge variant="outline" className={u.isActive ? "text-primary border-primary" : "text-muted-foreground border-border"}>{u.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                            <TableCell className="text-right px-6">
                              <Button variant="ghost" size="sm" onClick={() => updateSystemUser(u.id, { isActive: !u.isActive })} className="text-muted-foreground hover:text-foreground" data-testid={`btn-toggle-tenant-user-${u.id}`}>
                                {u.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {systemUsers.filter(u => u.tenantId === Number(selectedUserTenantId)).length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No users for this school.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-20 bg-card rounded-xl border border-border">
                  <Users className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a school to manage its users.</p>
                </div>
              )}
            </div>
          )}

          {/* ─── NOTIFICATIONS ────────────────────────────────────── */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Bell className="text-primary" /> Notifications
              </h1>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {notifications.filter(n => n.targetRole === "super_admin").length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No notifications.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.filter(n => n.targetRole === "super_admin").map(n => (
                      <div key={n.id} className={`p-6 flex items-start gap-4 ${!n.isRead ? "bg-muted/50" : "bg-card"}`}>
                        <div className={`p-3 rounded-full ${!n.isRead ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`font-bold ${!n.isRead ? "text-foreground" : "text-foreground"}`}>Card Assignment Request</h4>
                            <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p className={`mb-3 text-sm ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>{n.message}</p>
                          {!n.isRead && (
                            <div className="flex gap-3">
                              <Button size="sm" onClick={() => { setActiveTab("cards"); setSelectedStudentId(n.studentId.toString()); setReplaceMode(false); setRemoveConfirm(false); setHardwareId(""); markNotificationRead(n.id); }} className="bg-primary hover:bg-primary/90 text-white" data-testid={`btn-go-to-studio-${n.id}`}>
                                Go to Studio
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => markNotificationRead(n.id)} className="text-muted-foreground hover:text-foreground">Mark as Read</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─── SCHOOL MODAL ─────────────────────────────────────────── */}
      <Dialog open={showSchoolModal} onOpenChange={setShowSchoolModal}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Provision New School</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSchool} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">School Name</Label>
                <Input value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} placeholder="Oakwood High" className="bg-background border-border text-foreground" data-testid="input-school-name" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">3-Letter Code</Label>
                <Input value={newSchoolCode} onChange={e => setNewSchoolCode(e.target.value.toUpperCase())} maxLength={3} placeholder="OAK" className="bg-background border-border text-foreground uppercase" data-testid="input-school-code" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Address</Label>
              <Input value={newSchoolAddress} onChange={e => setNewSchoolAddress(e.target.value)} placeholder="123 Education Lane" className="bg-background border-border text-foreground" data-testid="input-school-address" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Contact Person Name</Label>
              <Input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Jane Doe" className="bg-background border-border text-foreground" data-testid="input-contact-name" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Contact Email (becomes Tenant Admin)</Label>
              <Input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="jane@school.edu" className="bg-background border-border text-foreground" data-testid="input-contact-email" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowSchoolModal(false)} className="text-muted-foreground">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6">Provision School</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── PLATFORM USER MODAL ──────────────────────────────────── */}
      <Dialog open={showPlatformUserModal} onOpenChange={setShowPlatformUserModal}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Add Platform User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPlatformUser} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-foreground">Full Name</Label>
              <Input value={platformUserName} onChange={e => setPlatformUserName(e.target.value)} className="bg-background border-border text-foreground" data-testid="input-platform-user-name" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Email</Label>
              <Input type="email" value={platformUserEmail} onChange={e => setPlatformUserEmail(e.target.value)} className="bg-background border-border text-foreground" data-testid="input-platform-user-email" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Password</Label>
              <Input type="text" value={platformUserPassword} onChange={e => setPlatformUserPassword(e.target.value)} className="bg-background border-border text-foreground" data-testid="input-platform-user-password" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowPlatformUserModal(false)} className="text-muted-foreground">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6">Create User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── TENANT USER MODAL ────────────────────────────────────── */}
      <Dialog open={showTenantUserModal} onOpenChange={setShowTenantUserModal}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Add Tenant User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTenantUser} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-foreground">Full Name</Label>
              <Input value={tenantUserName} onChange={e => setTenantUserName(e.target.value)} className="bg-background border-border text-foreground" data-testid="input-tenant-user-name" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Email</Label>
              <Input type="email" value={tenantUserEmail} onChange={e => setTenantUserEmail(e.target.value)} className="bg-background border-border text-foreground" data-testid="input-tenant-user-email" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Password</Label>
              <Input type="text" value={tenantUserPassword} onChange={e => setTenantUserPassword(e.target.value)} className="bg-background border-border text-foreground" data-testid="input-tenant-user-password" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Role</Label>
              <Select value={tenantUserRole} onValueChange={v => setTenantUserRole(v as typeof tenantUserRole)}>
                <SelectTrigger className="bg-background border-border text-foreground" data-testid="select-tenant-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                  <SelectItem value="backoffice">Backoffice</SelectItem>
                  <SelectItem value="kiosk_operator">Kiosk Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowTenantUserModal(false)} className="text-muted-foreground">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6">Create User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
