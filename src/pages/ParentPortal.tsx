import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, ShieldAlert, Wallet, Lock, History, Link as LinkIcon, Settings, Bell, CreditCard, LayoutDashboard, ShieldCheck, CheckCircle2 } from "lucide-react";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { Student, cardLifecycleLabel } from "@/lib/types";
import { launchPaystack, isPaystackConfigured } from "@/lib/paystack";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { useChartTheme } from "@/theme";
import { ParentSidebar } from "@/components/layout/ParentSidebar";

export function ParentPortal() {
  const chartTheme = useChartTheme();
  const { tenants, students, transactions, updateStudent, parentSession, updateParentUser, addParentChild, notifications, markNotificationRead, activateCard, addTransaction } = useStore();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<string>("overview");

  const [showAddChild, setShowAddChild] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regProcessing, setRegProcessing] = useState(false);

  const [topupAmount, setTopupAmount] = useState("");
  const [showTopupModal, setShowTopupModal] = useState<number | null>(null);
  const [topupError, setTopupError] = useState("");
  const [topupProcessing, setTopupProcessing] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState<{ name: string; amount: number } | null>(null);

  const [showPinModal, setShowPinModal] = useState<number | null>(null);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");

  const [showLimitsModal, setShowLimitsModal] = useState<number | null>(null);
  const [dailyLim, setDailyLim] = useState("");
  const [monthlyLim, setMonthlyLim] = useState("");

  const [showActivateModal, setShowActivateModal] = useState<number | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Start of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [phoneInput, setPhoneInput] = useState(parentSession?.phone ?? "");
  const [phoneSaved, setPhoneSaved] = useState(false);

  const [mobileNav, setMobileNav] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "in" | "out">("all");

  useEffect(() => {
    if (!parentSession) {
      setLocation('/');
    }
  }, [parentSession, setLocation]);

  if (!parentSession) return null;

  const linkedChildren = students.filter(s => parentSession.linkedStudentIds.includes(s.id));
  const parentNotifications = notifications.filter(n => n.targetRole === 'parent' && n.targetParentEmail === parentSession.email);

  const handleOpenAddChild = () => {
    if (linkedChildren.length > 0 && !authCode) {
      const tenant = tenants.find(t => t.id === linkedChildren[0].tenantId);
      if (tenant) {
        setAuthCode(tenant.enrollmentKey);
      }
    }
    setShowAddChild(true);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(""); setRegSuccess("");

    const codeMatch = authCode.match(/^SCH-([A-Z]{3})-2026$/i);
    if (!codeMatch) {
      setRegError("Invalid Authorization Code format.");
      return;
    }

    if (!isPaystackConfigured()) {
      setRegError("Payments are not available yet — the payment gateway has not been configured.");
      return;
    }

    setRegProcessing(true);
    launchPaystack({
      email: parentSession!.email,
      amountMajor: 1000,
      metadata: {
        custom_fields: [
          { display_name: "Action", variable_name: "action", value: "Enrollment Fee" },
          { display_name: "Auth Code", variable_name: "auth_code", value: authCode },
          { display_name: "Student ID", variable_name: "student_id", value: studentIdInput },
        ],
      },
      onSuccess: () => {
        const result = addParentChild(parentSession.id, authCode.toUpperCase(), studentIdInput.toUpperCase(), parentSession.email);

        if (result.success) {
          setRegSuccess(`Successfully linked student!`);
          setAuthCode(""); setStudentIdInput("");
          setRegProcessing(false);
          setTimeout(() => {
            setRegSuccess("");
            setShowAddChild(false);
          }, 2000);
        } else {
          setRegProcessing(false);
          setRegError(result.message || "Failed to link student.");
        }
      },
      onCancel: () => {
        setRegProcessing(false);
        setRegError("Payment was cancelled. You cannot link an account without the enrollment fee.");
      },
      onError: (message) => {
        setRegProcessing(false);
        setRegError(message);
      },
    });
  };

  const handleTopup = (e: React.FormEvent) => {
    e.preventDefault();
    setTopupError("");
    if (!showTopupModal || !topupAmount) return;
    const amount = Number(topupAmount);
    if (isNaN(amount) || amount <= 0) return;

    const child = students.find(s => s.id === showTopupModal);
    if (!child) return;

    if (!isPaystackConfigured()) {
      setTopupError("Payments are not available yet — the payment gateway has not been configured.");
      return;
    }

    const fee = amount * 0.04;
    const creditedAmount = amount - fee;

    setTopupProcessing(true);
    launchPaystack({
      email: parentSession!.email,
      amountMajor: amount,
      metadata: {
        custom_fields: [
          { display_name: "Student", variable_name: "student", value: child.name },
          { display_name: "Student ID", variable_name: "student_id", value: child.studentId },
        ],
      },
      onSuccess: () => {
        updateStudent(child.id, { walletBalance: child.walletBalance + creditedAmount });
        const tenant = tenants.find(t => t.id === child.tenantId);
        addTransaction({
          tenantId: child.tenantId,
          studentId: child.id,
          studentName: child.name,
          schoolName: tenant ? tenant.name : "Unknown School",
          itemsString: "Wallet Top-up",
          amount: -creditedAmount,
          cost: 0,
          date: new Date().toISOString().split('T')[0]
        });
        setTopupProcessing(false);
        setTopupAmount("");
        setShowTopupModal(null);
        setTopupSuccess({ name: child.name, amount: creditedAmount });
        window.setTimeout(() => setTopupSuccess(null), 5000);
      },
      onCancel: () => {
        setTopupProcessing(false);
        setTopupError("Payment was cancelled. Your wallet was not charged.");
      },
      onError: (message) => {
        setTopupProcessing(false);
        setTopupError(message);
      },
    });
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin1.length !== 4 || pin1 !== pin2) return;
    updateStudent(showPinModal!, { pin: pin1 });
    setPin1(""); setPin2("");
    setShowPinModal(null);
  };

  const handleChangeLimits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyLim || !monthlyLim) return;
    updateStudent(showLimitsModal!, {
      dailyLimit: Number(dailyLim),
      monthlyLimit: Number(monthlyLim)
    });
    setShowLimitsModal(null);
  };

  const handleToggleFreeze = (child: Student) => {
    if (child.cardStatus === "Issued" || child.cardStatus === "Unassigned") return;
    const newStatus = child.cardStatus === "Active" ? "Blocked" : "Active";
    updateStudent(child.id, { cardStatus: newStatus });
  };

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin1.length !== 4 || pin1 !== pin2 || !dailyLim || !monthlyLim) return;
    activateCard(showActivateModal!, pin1, Number(dailyLim), Number(monthlyLim));
    setPin1(""); setPin2(""); setDailyLim(""); setMonthlyLim("");
    setShowActivateModal(null);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {topupSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[10002] flex items-center gap-3 px-5 py-3 rounded-xl bg-green-600 text-white shadow-2xl animate-in fade-in slide-in-from-top-4" data-testid="topup-success">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">₦{topupSuccess.amount.toFixed(2)} added to {topupSuccess.name}'s wallet</span>
        </div>
      )}
      <ParentSidebar activeTab={activeTab} setActiveTab={setActiveTab} onAddChild={handleOpenAddChild} mobileOpen={mobileNav} onMobileOpenChange={setMobileNav} />
      <MobileTopBar title="Parent Portal" icon={ShieldCheck} onMenuClick={() => setMobileNav(true)} />

      <main className="flex-1 lg:ml-64 overflow-y-auto bg-background px-4 pb-6 pt-20 lg:px-8 lg:pb-8 lg:pt-8">
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* OVERVIEW DASHBOARD */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                  <LayoutDashboard className="text-primary" /> Family Overview
                </h1>
                <Button onClick={handleOpenAddChild} className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-lg shadow-lg shadow-primary/20 w-full sm:w-auto">
                  Link Child
                </Button>
              </div>

              {linkedChildren.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-xl border border-border border-dashed">
                  <LinkIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-foreground mb-2">No Children Linked</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6">Link your child's account using the Authorization Code and Student ID provided by their school.</p>
                  <Button onClick={handleOpenAddChild} className="bg-primary hover:bg-primary/90 text-white">Link Account Now</Button>
                </div>
              ) : (() => {
                const allTx = transactions.filter(t => linkedChildren.some(c => c.id === t.studentId));
                const totalBal = linkedChildren.reduce((sum, c) => sum + c.walletBalance, 0);

                const thisMonthStr = new Date().toISOString().slice(0, 7);
                const thisMonthTx = allTx.filter(t => t.date.startsWith(thisMonthStr));
                const spentThisMonth = thisMonthTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

                const childSpendData = linkedChildren.map(c => {
                  const spent = allTx.filter(t => t.studentId === c.id && t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
                  return { name: c.name.split(' ')[0], spent };
                });

                const dailyData = Object.entries(
                  allTx.reduce((acc, t) => {
                    if (t.amount > 0) {
                      acc[t.date] = (acc[t.date] || 0) + t.amount;
                    }
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([date, spend]) => ({ date, spend })).sort((a, b) => a.date.localeCompare(b.date));

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <Card className="bg-card border-border shadow-xl">
                        <CardContent className="p-6">
                          <div className="text-muted-foreground text-sm mb-1 font-medium tracking-wide uppercase">Linked Children</div>
                          <div className="text-4xl font-black text-foreground">{linkedChildren.length}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border shadow-xl">
                        <CardContent className="p-6">
                          <div className="text-muted-foreground text-sm mb-1 font-medium tracking-wide uppercase">Combined Balance</div>
                          <div className="text-4xl font-black text-primary">₦{totalBal.toFixed(2)}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border shadow-xl">
                        <CardContent className="p-6">
                          <div className="text-muted-foreground text-sm mb-1 font-medium tracking-wide uppercase">Total Transactions</div>
                          <div className="text-4xl font-black text-foreground">{allTx.length}</div>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border shadow-xl">
                        <CardContent className="p-6">
                          <div className="text-muted-foreground text-sm mb-1 font-medium tracking-wide uppercase">Spent This Month</div>
                          <div className="text-4xl font-black text-amber-400">₦{spentThisMonth.toFixed(2)}</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="bg-card border-border shadow-xl">
                        <CardHeader>
                          <CardTitle className="text-foreground">Spending by Child</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={childSpendData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                              <XAxis dataKey="name" stroke={chartTheme.axis} fontSize={12} />
                              <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={v => `₦${v}`} />
                              <RechartsTooltip cursor={{ fill: chartTheme.cursor }} contentStyle={chartTheme.tooltip} />
                              <Bar dataKey="spent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border shadow-xl">
                        <CardHeader>
                          <CardTitle className="text-foreground">Combined Spending Trend</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                              <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={12} />
                              <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={v => `₦${v}`} />
                              <RechartsTooltip contentStyle={chartTheme.tooltip} />
                              <Line type="monotone" dataKey="spend" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="bg-card border-border shadow-xl">
                      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                        <CardTitle className="text-foreground">Recent Transactions</CardTitle>
                        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                          <button onClick={() => setTxFilter('all')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>All</button>
                          <button onClick={() => setTxFilter('in')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'in' ? 'bg-background text-green-500 shadow-sm' : 'text-muted-foreground hover:text-green-500'}`}>Money In</button>
                          <button onClick={() => setTxFilter('out')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'out' ? 'bg-background text-red-500 shadow-sm' : 'text-muted-foreground hover:text-red-500'}`}>Money Out</button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-[400px] overflow-auto border border-border rounded-lg bg-background">
                          <Table>
                            <TableHeader className="bg-card/80 sticky top-0">
                              <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Date</TableHead>
                                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Child</TableHead>
                                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">School</TableHead>
                                <TableHead className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Items</TableHead>
                                <TableHead className="text-right text-muted-foreground font-bold uppercase tracking-wider text-xs pr-4">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {allTx.filter(tx => {
                                if (txFilter === 'in') return tx.amount < 0;
                                if (txFilter === 'out') return tx.amount > 0;
                                return true;
                              }).reverse().map(tx => (
                                <TableRow key={tx.id} className="border-border/50 hover:bg-muted/50">
                                  <TableCell className="text-foreground text-sm">{tx.date}</TableCell>
                                  <TableCell className="text-foreground font-medium">{tx.studentName}</TableCell>
                                  <TableCell className="text-muted-foreground text-sm">{tx.schoolName}</TableCell>
                                  <TableCell className="text-foreground text-sm">{tx.itemsString}</TableCell>
                                  <TableCell className={`font-bold text-right pr-4 ${tx.amount < 0 ? 'text-green-500' : 'text-red-500'}`}>{tx.amount < 0 ? '+' : '-'}₦{Math.abs(tx.amount).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                              {allTx.filter(tx => {
                                if (txFilter === 'in') return tx.amount < 0;
                                if (txFilter === 'out') return tx.amount > 0;
                                return true;
                              }).length === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transactions found.</TableCell>
                                  </TableRow>
                                )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}

          {/* PER CHILD VIEW */}
          {activeTab.startsWith("child_") && (() => {
            const childId = Number(activeTab.split("_")[1]);
            const child = students.find(s => s.id === childId);
            if (!child) return null;

            const childTx = transactions.filter(t => t.studentId === childId).reverse();
            const periodTx = childTx.filter(t => t.date >= startDate && t.date <= endDate);

            const moneyOutPeriod = periodTx.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
            const moneyInPeriod = periodTx.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

            const childDailyData = Object.entries(
              periodTx.reduce((acc, t) => {
                if (t.amount > 0) {
                  acc[t.date] = (acc[t.date] || 0) + t.amount;
                }
                return acc;
              }, {} as Record<string, number>)
            ).map(([date, spend]) => ({ date, spend })).sort((a, b) => a.date.localeCompare(b.date));

            const itemsMap: Record<string, number> = {};
            periodTx.forEach(t => {
              if (t.amount > 0) {
                t.itemsString.split(", ").forEach(p => {
                  const match = p.match(/(.+) x(\d+)/);
                  if (match) itemsMap[match[1]] = (itemsMap[match[1]] || 0) + Number(match[2]);
                });
              }
            });
            const topItems = Object.entries(itemsMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));

            return (
              <div className="space-y-8">
                {/* Header Card */}
                <div className="bg-card p-8 rounded-2xl border border-border relative overflow-hidden shadow-xl flex flex-col md:flex-row gap-8 items-center md:items-start">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

                  <img src={child.imageUrl} alt={child.name} className="w-32 h-32 rounded-full bg-background border-4 border-border z-10" />

                  <div className="flex-1 text-center md:text-left z-10">
                    <h2 className="text-3xl font-bold text-foreground mb-1">{child.name}</h2>
                    <p className="text-muted-foreground mb-4">{child.className} • {tenants.find(t => t.id === child.tenantId)?.name}</p>

                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      <Badge className={
                        child.cardLifecycleStatus === 'pending_assignment' ? 'bg-amber-500/20 text-amber-400 border-0' :
                          child.cardLifecycleStatus === 'assigned' ? 'bg-blue-500/20 text-blue-400 border-0' :
                            child.cardLifecycleStatus === 'ready' ? 'bg-cyan-500/20 text-cyan-400 border-0' :
                              child.cardLifecycleStatus === 'delivered' ? 'bg-purple-500/20 text-purple-400 border-0' :
                                'bg-primary/20 text-primary border-0'
                      }>
                        {cardLifecycleLabel(child.cardLifecycleStatus)}
                      </Badge>
                      <Badge variant="outline" className={child.cardStatus === 'Active' ? 'text-primary border-primary/50 bg-primary/30' : child.cardStatus === 'Blocked' ? 'text-red-400 border-red-900/50 bg-red-950/30' : 'text-amber-400 border-amber-900/50 bg-amber-950/30'}>
                        Card: {child.cardStatus}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-background p-6 rounded-xl border border-border text-center min-w-[220px] z-10 shadow-inner">
                    <div className="text-sm text-muted-foreground mb-1 font-medium tracking-wide uppercase">Wallet Balance</div>
                    <div className="text-5xl font-black text-primary">₦{child.walletBalance.toFixed(2)}</div>
                  </div>
                </div>

                {/* Alerts for Activation */}
                {(child.cardLifecycleStatus === 'ready' || child.cardLifecycleStatus === 'delivered') && (
                  <Alert className="bg-amber-900/20 border-amber-500/50">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <AlertTitle className="text-amber-400 text-lg font-bold ml-2">Action Required: Activate Card</AlertTitle>
                    <AlertDescription className="text-amber-200/80 ml-2 mt-2">
                      {child.cardLifecycleStatus === 'ready'
                        ? "Your child's card is ready for pickup. Please set a secure PIN and limits to activate it."
                        : "Card has been delivered. Please activate it below to enable purchases."}
                      <div className="mt-4">
                        <Button onClick={() => setShowActivateModal(child.id)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">Complete Activation</Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setShowTopupModal(child.id)}>
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary"><Wallet className="w-6 h-6" /></div>
                      <div className="font-bold text-foreground">Top Up Wallet</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => { setPin1(""); setPin2(""); setShowPinModal(child.id); }}>
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400"><Lock className="w-6 h-6" /></div>
                      <div className="font-bold text-foreground">Change PIN</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => { setDailyLim(child.dailyLimit.toString()); setMonthlyLim(child.monthlyLimit.toString()); setShowLimitsModal(child.id); }}>
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400"><Settings className="w-6 h-6" /></div>
                      <div className="font-bold text-foreground">Card Limits</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => handleToggleFreeze(child)}>
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${child.cardStatus === 'Blocked' ? 'bg-primary/20 text-primary' : 'bg-red-500/20 text-red-400'}`}>
                        {child.cardStatus === 'Blocked' ? <CreditCard className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                      </div>
                      <div className="font-bold text-foreground">{child.cardStatus === 'Blocked' ? 'Unfreeze Card' : 'Freeze Card'}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Reporting */}
                <Card className="bg-card border-border shadow-xl">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                    <CardTitle className="text-foreground flex items-center gap-2"><History className="w-5 h-5 text-muted-foreground" /> Spending Insights</CardTitle>
                    <div className="flex items-center gap-2 bg-background p-1.5 rounded-lg border border-border">
                      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-card border-border text-foreground h-9 w-auto text-sm" />
                      <span className="text-muted-foreground text-sm px-1">to</span>
                      <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-card border-border text-foreground h-9 w-auto text-sm" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                      <div className="bg-background p-4 rounded-xl border border-border">
                        <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Money In</div>
                        <div className="text-3xl font-black text-green-500">+₦{moneyInPeriod.toFixed(2)}</div>
                      </div>
                      <div className="bg-background p-4 rounded-xl border border-border">
                        <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Money Out</div>
                        <div className="text-3xl font-black text-red-500">-₦{moneyOutPeriod.toFixed(2)}</div>
                      </div>
                      <div className="bg-background p-4 rounded-xl border border-border">
                        <div className="text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">Most Frequent Item</div>
                        <div className="text-xl font-bold text-foreground mt-1 line-clamp-1">{topItems[0]?.name || "-"}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Daily Spending Trend</h4>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={childDailyData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                              <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={10} />
                              <YAxis stroke={chartTheme.axis} fontSize={10} tickFormatter={v => `₦${v}`} />
                              <RechartsTooltip contentStyle={chartTheme.tooltip} />
                              <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Top Items</h4>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topItems} layout="vertical" margin={{ left: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                              <XAxis type="number" stroke={chartTheme.axis} fontSize={10} />
                              <YAxis dataKey="name" type="category" stroke={chartTheme.axis} fontSize={10} width={90} />
                              <RechartsTooltip cursor={{ fill: chartTheme.cursor }} contentStyle={chartTheme.tooltip} />
                              <Bar dataKey="qty" fill="#10b981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-0">Transaction Log</h4>
                      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                        <button onClick={() => setTxFilter('all')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>All</button>
                        <button onClick={() => setTxFilter('in')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'in' ? 'bg-background text-green-500 shadow-sm' : 'text-muted-foreground hover:text-green-500'}`}>Money In</button>
                        <button onClick={() => setTxFilter('out')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'out' ? 'bg-background text-red-500 shadow-sm' : 'text-muted-foreground hover:text-red-500'}`}>Money Out</button>
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-auto border border-border rounded-lg bg-background">
                      <Table>
                        <TableHeader className="bg-card/80 sticky top-0">
                          <TableRow className="border-border">
                            <TableHead className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Date</TableHead>
                            <TableHead className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Items</TableHead>
                            <TableHead className="text-right text-muted-foreground font-bold text-xs uppercase tracking-wider pr-4">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {periodTx.filter(tx => {
                            if (txFilter === 'in') return tx.amount < 0;
                            if (txFilter === 'out') return tx.amount > 0;
                            return true;
                          }).map(tx => (
                            <TableRow key={tx.id} className="border-border/50 hover:bg-muted/50">
                              <TableCell className="text-foreground text-sm whitespace-nowrap">{tx.date}</TableCell>
                              <TableCell className="text-foreground text-sm">{tx.itemsString}</TableCell>
                              <TableCell className={`text-right font-bold pr-4 ${tx.amount < 0 ? 'text-green-500' : 'text-red-500'}`}>{tx.amount < 0 ? '+' : '-'}₦{Math.abs(tx.amount).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                          {periodTx.filter(tx => {
                            if (txFilter === 'in') return tx.amount < 0;
                            if (txFilter === 'out') return tx.amount > 0;
                            return true;
                          }).length === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No transactions found.</TableCell>
                              </TableRow>
                            )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-6">
                <Bell className="text-primary" /> Notifications
              </h1>

              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl">
                {parentNotifications.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No notifications.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {parentNotifications.map(n => (
                      <div key={n.id} className={`p-6 flex items-start gap-4 transition-colors ${!n.isRead ? 'bg-muted/50' : 'bg-card'}`}>
                        <div className={`p-3 rounded-full ${n.type === 'limit_exceeded' ? 'bg-amber-500/20 text-amber-500' : !n.isRead ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {n.type === 'limit_exceeded' ? <AlertTriangle className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`font-bold text-lg ${!n.isRead ? 'text-foreground' : 'text-foreground'}`}>{n.type === 'limit_exceeded' ? 'Spending Limit Alert' : 'Card Update'}</h4>
                            <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p className={`mb-3 ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{n.message}</p>
                          {!n.isRead && (
                            <div className="flex gap-3 mt-2">
                              {(n.type === 'card_ready' || n.type === 'card_delivered') && (
                                <Button size="sm" onClick={() => { setActiveTab(`child_${n.studentId}`); markNotificationRead(n.id); }} className="bg-primary hover:bg-primary/90 text-white">View Child Account</Button>
                              )}
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

          {/* SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 mb-6">
                <Settings className="text-primary" /> Account Settings
              </h1>
              <Card className="bg-card border-border shadow-xl max-w-2xl">
                <CardHeader>
                  <CardTitle className="text-foreground">Profile</CardTitle>
                  <CardDescription className="text-muted-foreground">Your name and email are managed by your school. You can update your contact number below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Full Name <span className="text-muted-foreground normal-case font-normal">(read-only)</span></Label>
                    <Input disabled value={parentSession.name} className="bg-background border-border text-muted-foreground cursor-not-allowed" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-bold uppercase tracking-wide">Email Address <span className="text-muted-foreground normal-case font-normal">(read-only)</span></Label>
                    <Input disabled value={parentSession.email} className="bg-background border-border text-muted-foreground cursor-not-allowed" />
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label className="text-foreground text-xs font-bold uppercase tracking-wide">Contact Phone Number</Label>
                    <div className="flex gap-3">
                      <Input
                        value={phoneInput}
                        onChange={e => { setPhoneInput(e.target.value); setPhoneSaved(false); }}
                        placeholder="+44 7700 000000"
                        className="bg-background border-border text-foreground flex-1"
                        data-testid="input-phone"
                      />
                      <Button
                        onClick={() => { updateParentUser(parentSession.id, { phone: phoneInput }); setPhoneSaved(true); }}
                        className="bg-primary hover:bg-primary/90 text-white shrink-0"
                        data-testid="btn-save-phone"
                      >
                        {phoneSaved ? "Saved ✓" : "Save"}
                      </Button>
                    </div>
                    {phoneSaved && <p className="text-primary text-xs">Phone number updated.</p>}
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">To update your name or email address, contact your school administrator.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}
      <Dialog open={showAddChild} onOpenChange={setShowAddChild}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Link Child Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4 mt-4">
            {regError && <Alert className="bg-red-900/30 border-red-500 text-red-400"><AlertTitle>{regError}</AlertTitle></Alert>}
            {regSuccess && <Alert className="bg-primary/30 border-primary text-primary"><AlertTitle>{regSuccess}</AlertTitle></Alert>}
            <div className="space-y-2">
              <Label className="text-foreground">School Authorization Code</Label>
              <Input value={authCode} onChange={e => setAuthCode(e.target.value.toUpperCase())} placeholder="SCH-XXX-2026" className="bg-background border-border text-foreground uppercase h-11" required />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Student ID</Label>
              <Input value={studentIdInput} onChange={e => setStudentIdInput(e.target.value.toUpperCase())} placeholder="STU-000" className="bg-background border-border text-foreground uppercase h-11" required />
            </div>
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                A termly school enrollment fee of <strong>₦1,000.00</strong> is required to link this account. Payments are processed securely by <strong>Paystack</strong>.
              </p>
            </div>
            <Button type="submit" disabled={regProcessing} className="w-full bg-primary hover:bg-primary/90 text-white mt-4 h-12 text-lg font-bold shadow-lg shadow-primary/20">
              {regProcessing ? "Opening secure checkout…" : "Pay ₦1,000 & Connect Account"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showTopupModal !== null} onOpenChange={(o) => { if (!o) { setShowTopupModal(null); setTopupError(""); } }}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Top Up Wallet</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTopup} className="mt-4">
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[10, 20, 50].map(amt => (
                <Button key={amt} type="button" variant="outline" onClick={() => setTopupAmount(amt.toString())} className="bg-background border-border text-foreground h-14 text-xl font-bold hover:bg-muted hover:border-primary">₦{amt}</Button>
              ))}
            </div>
            <div className="space-y-2 mb-4">
              <Label className="text-foreground">Custom Amount (₦)</Label>
              <Input type="number" step="0.01" min="1" value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="0.00" className="bg-background border-border text-foreground h-14 text-xl" required />
            </div>
            {topupError && (
              <div className="flex items-start gap-2 px-3 py-2.5 mb-4 rounded-lg bg-red-500/10 border border-red-500/30" data-testid="topup-error">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-400">{topupError}</p>
              </div>
            )}
            {topupAmount && !isNaN(Number(topupAmount)) && Number(topupAmount) > 0 && (
              <div className="flex items-start gap-2 px-3 py-2.5 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  -<strong>4% processing fee</strong> (₦{(Number(topupAmount) * 0.04).toFixed(2)}).<br />
                  Your child's wallet will be credited with <strong>₦{(Number(topupAmount) * 0.96).toFixed(2)}</strong>.
                </p>
              </div>
            )}
            <div className="flex items-start gap-2 px-3 py-2.5 mb-5 rounded-lg bg-muted/50 border border-border">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Payments are processed securely by <span className="font-semibold text-foreground">Paystack</span>. LSPay never sees or stores your card details.
              </p>
            </div>
            <Button type="submit" disabled={topupProcessing} className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-lg font-bold shadow-lg shadow-primary/20" data-testid="btn-process-payment">
              {topupProcessing ? "Opening secure checkout…" : "Pay with Card"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPinModal !== null} onOpenChange={(o) => !o && setShowPinModal(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Change PIN</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangePin} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-foreground">New 4-Digit PIN</Label>
              <Input type="password" maxLength={4} value={pin1} onChange={e => setPin1(e.target.value)} className="bg-background border-border text-foreground text-center text-2xl tracking-[1em] h-14" required />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Confirm PIN</Label>
              <Input type="password" maxLength={4} value={pin2} onChange={e => setPin2(e.target.value)} className="bg-background border-border text-foreground text-center text-2xl tracking-[1em] h-14" required />
            </div>
            {(pin1 && pin2 && pin1 !== pin2) && <p className="text-red-400 text-sm text-center">PINs do not match</p>}
            <Button type="submit" disabled={pin1.length !== 4 || pin1 !== pin2} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg font-bold mt-2">Update PIN</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showLimitsModal !== null} onOpenChange={(o) => !o && setShowLimitsModal(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Card Limits</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChangeLimits} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-foreground">Daily Limit (₦)</Label>
              <Input type="number" min="0" value={dailyLim} onChange={e => setDailyLim(e.target.value)} className="bg-background border-border text-foreground h-12" required />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Monthly Limit (₦)</Label>
              <Input type="number" min="0" value={monthlyLim} onChange={e => setMonthlyLim(e.target.value)} className="bg-background border-border text-foreground h-12" required />
            </div>
            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-lg font-bold mt-2">Save Limits</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showActivateModal !== null} onOpenChange={(o) => !o && setShowActivateModal(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2"><CreditCard className="text-primary" /> Activate Card</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleActivate} className="space-y-6 mt-2">
            <div className="p-4 bg-background rounded-xl border border-border text-muted-foreground text-sm">
              Please set a secure 4-digit PIN for purchases and define the spending limits. These can be changed later.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">4-Digit PIN</Label>
                <Input type="password" maxLength={4} value={pin1} onChange={e => setPin1(e.target.value)} className="bg-background border-border text-foreground text-center text-xl tracking-[0.5em] h-12" required />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Confirm PIN</Label>
                <Input type="password" maxLength={4} value={pin2} onChange={e => setPin2(e.target.value)} className="bg-background border-border text-foreground text-center text-xl tracking-[0.5em] h-12" required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Daily Limit (₦)</Label>
                <Input type="number" min="1" value={dailyLim} onChange={e => setDailyLim(e.target.value)} className="bg-background border-border text-foreground h-12" placeholder="10" required />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Monthly Limit (₦)</Label>
                <Input type="number" min="1" value={monthlyLim} onChange={e => setMonthlyLim(e.target.value)} className="bg-background border-border text-foreground h-12" placeholder="100" required />
              </div>
            </div>

            <Button type="submit" disabled={pin1.length !== 4 || pin1 !== pin2 || !dailyLim || !monthlyLim} className="w-full bg-primary hover:bg-primary/90 text-white h-14 text-lg font-bold mt-4 shadow-lg shadow-primary/20">
              Activate Card
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
