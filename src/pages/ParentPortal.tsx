import { when } from "@/lib/datetime";
import { FitText } from "@/components/ui/fit-text";
import { ListScroll, Paged, PaginationBar } from "@/components/ui/paginated-list";
import { naira, nairaAxis } from "@/lib/money";
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
import { AlertTriangle, ShieldAlert, Wallet, Lock, History, Link as LinkIcon, Settings, Bell, CreditCard, ShoppingBag, ShieldCheck, CheckCircle2, ArrowDownLeft, ArrowUpRight, ChevronRight, Users, Plus, LogOut, FileText } from "lucide-react";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { NotificationCenter } from "@/components/layout/NotificationCenter";
import { ParentBottomNav } from "@/components/parent/ParentBottomNav";
import { LinkChildPage } from "@/components/parent/LinkChildPage";
import { PrivacyComplianceDialog } from "@/components/parent/PrivacyComplianceDialog";
import { ForceChangePassword } from "@/components/parent/ForceChangePassword";
import { PRIVACY_POLICY_VERSION } from "@/lib/privacyPolicy";
import { Student, Transaction, cardLifecycleLabel } from "@/lib/types";
import { launchPaystack, isPaystackConfigured } from "@/lib/paystack";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { useChartTheme } from "@/theme";
import { ParentSidebar } from "@/components/layout/ParentSidebar";


/** Child photo, or their initials when the school hasn't uploaded one. */
function ChildAvatar({ child, className }: { child: Student; className: string }) {
  const [failed, setFailed] = useState(false);
  if (child.imageUrl && !failed) {
    return <img src={child.imageUrl} alt="" onError={() => setFailed(true)} className={`${className} bg-lilac object-cover`} />;
  }
  const initials = child.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return <span className={`${className} flex items-center justify-center bg-lilac font-display text-ink`}>{initials}</span>;
}

/** Card list used instead of the transactions table on phones. */
function MobileTxList({ txs, showChild }: { txs: Transaction[]; showChild?: boolean }) {
  if (txs.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground md:hidden">No transactions found.</div>;
  }
  return (
    <ul className="divide-y divide-border md:hidden">
      {txs.map(tx => {
        const isIn = tx.amount < 0;
        return (
          <li key={tx.id} className="flex items-center gap-3 py-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isIn ? "bg-mint text-green-700" : "bg-muted text-muted-foreground"}`}>
              {isIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{tx.itemsString || (isIn ? "Wallet top-up" : "Purchase")}</div>
              <div className="truncate text-xs text-muted-foreground">
                {showChild ? `${tx.studentName} · ` : ""}{when(tx)}
              </div>
            </div>
            <div className={`shrink-0 font-display text-base ${isIn ? "text-green-600" : "text-foreground"}`}>
              {naira(Math.abs(tx.amount))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ParentPortal() {
  const chartTheme = useChartTheme();
  const { tenants, students, transactions, updateStudent, parentSession, updateParentUser, addParentChild, notifications, markNotificationRead, activateCard, setCardLimits, setCardFrozen, addTransaction, topupWallet, logoutParent } = useStore();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTabState] = useState<string>("overview");
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    document.getElementById("parent-main")?.scrollTo({ top: 0 });
  };

  // ISO time the parent accepted the privacy & compliance notice in this session; required before linking.
  const [privacyAcceptedAt, setPrivacyAcceptedAt] = useState<string | null>(null);
  const [showPrivacyReview, setShowPrivacyReview] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [regProcessing, setRegProcessing] = useState(false);

  const [topupAmount, setTopupAmount] = useState("");
  const [showTopupModal, setShowTopupModal] = useState<string | null>(null);
  const [topupError, setTopupError] = useState("");
  const [topupProcessing, setTopupProcessing] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState<{ name: string; amount: number } | null>(null);

  const [showPinModal, setShowPinModal] = useState<string | null>(null);
  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");

  const [showLimitsModal, setShowLimitsModal] = useState<string | null>(null);
  const [limitsBusy, setLimitsBusy] = useState(false);
  const [limitsError, setLimitsError] = useState("");
  const [dailyLim, setDailyLim] = useState("");
  const [monthlyLim, setMonthlyLim] = useState("");

  const [showActivateModal, setShowActivateModal] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Start of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [phoneInput, setPhoneInput] = useState(parentSession?.phone ?? "");
  const [phoneSaved, setPhoneSaved] = useState(false);

  const [txFilter, setTxFilter] = useState<"all" | "in" | "out">("all");

  useEffect(() => {
    if (!parentSession) {
      setLocation('/');
    }
  }, [parentSession, setLocation]);

  const [pickTopupChild, setPickTopupChild] = useState(false);   // must stay above the early returns

  if (!parentSession) return null;
  // Connected by the school with a temporary password: they must choose their own before anything else.
  if (parentSession.mustChangePassword) return <ForceChangePassword />;

  const linkedChildren = students.filter(s => parentSession.linkedStudentIds.includes(s.id));
  const parentNotifications = notifications.filter(n => n.targetRole === 'parent' && (n.targetParentEmail ?? '').toLowerCase() === parentSession.email.toLowerCase());
  const unreadCount = parentNotifications.filter(n => !n.isRead).length;
  const firstName = parentSession.name.split(" ")[0] || "there";
  const familyBalance = linkedChildren.reduce((sum, c) => sum + c.walletBalance, 0);

  const pageTitle =
    activeTab === "overview" ? "Family Overview" :
    activeTab === "children" ? "My Children" :
    activeTab === "link" ? "Link a Child" :
    activeTab === "notifications" ? "Notifications" :
    activeTab === "settings" ? "Account" :
    activeTab.startsWith("child_") ? (students.find(s => s.id === activeTab.slice(6))?.name ?? "Child") : "Parent Portal";

  const handleOpenAddChild = () => {
    if (linkedChildren.length > 0 && !authCode) {
      const tenant = tenants.find(t => t.id === linkedChildren[0].tenantId);
      if (tenant) {
        setAuthCode(tenant.enrollmentKey);
      }
    }
    setRegError(""); setRegSuccess("");
    setActiveTab("link");
  };

  // The middle "+" tops up a wallet (straight to the child when there is one, otherwise pick a child first).
  const openTopup = () => {
    if (linkedChildren.length === 0) { handleOpenAddChild(); return; }
    setTopupError(""); setTopupAmount("");
    if (linkedChildren.length === 1) setShowTopupModal(linkedChildren[0].id);
    else setPickTopupChild(true);
  };

  const handleNavigate = (tab: string) => {
    if (tab === "link") handleOpenAddChild();
    else if (tab === "topup") openTopup();
    else setActiveTab(tab);
  };

  const handleLogout = () => {
    logoutParent();
    setLocation('/');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(""); setRegSuccess("");

    if (!privacyAcceptedAt) {
      setRegError("Please review and accept the privacy & compliance notice first.");
      return;
    }

    const codeMatch = authCode.match(/^SCH-([A-Z]{3})-2026$/i);
    if (!codeMatch) {
      setRegError("Invalid Authorization Code format.");
      return;
    }

    // No enrollment fee: the school code, student ID and guardian email are checked on the server.
    setRegProcessing(true);
    try {
      const result = await addParentChild(parentSession.id, authCode.toUpperCase(), studentIdInput.toUpperCase(), {
        policyVersion: PRIVACY_POLICY_VERSION,
        acceptedAt: privacyAcceptedAt,
      });
      if (result.success) {
        setRegSuccess("Successfully linked student!");
        setAuthCode(""); setStudentIdInput("");
        setTimeout(() => {
          setRegSuccess("");
          setActiveTab("overview");
        }, 2000);
      } else {
        setRegError(result.message || "Failed to link student.");
      }
    } catch (err: any) {
      setRegError(err?.message ?? "Failed to link student. Please try again.");
    } finally {
      setRegProcessing(false);
    }
  };

  const handleTopup = (e: React.FormEvent) => {
    e.preventDefault();
    setTopupError("");
    if (!showTopupModal || !topupAmount) return;
    const amount = Number(topupAmount);
    if (isNaN(amount) || amount <= 0) return;

    const child = students.find(s => s.id === showTopupModal);
    if (!child) return;

    const tenant = tenants.find(t => t.id === child.tenantId);
    if (!tenant) {
      setTopupError("School not found.");
      return;
    }

    if (!isPaystackConfigured(tenant.paystackPublicKey)) {
      setTopupError("Payments are not available yet — the school has not configured their Paystack integration.");
      return;
    }

    const fee = amount * 0.04;
    const creditedAmount = amount - fee;

    setTopupProcessing(true);
    // Our Top Up dialog is modal: while it is open it blocks clicks on everything else on the page, including
    // Paystack's checkout (which opens in its own layer). So close it first, let it release the page, then open
    // Paystack. Cancel / errors reopen the dialog with the message; success shows the banner as before.
    const reopenWith = (message: string) => {
      setTopupProcessing(false);
      setTopupError(message);
      setShowTopupModal(child.id);
    };
    setShowTopupModal(null);
    window.setTimeout(() => {
    document.body.style.pointerEvents = "";
    launchPaystack({
      paystackPublicKey: tenant.paystackPublicKey,
      subaccount: tenant.paystackSubaccountCode,
      email: parentSession!.email,
      amountMajor: amount,
      metadata: {
        // checked by the lspay-wallet-topup edge function (and paystack-webhook) before the wallet is credited
        purpose: "lspay_topup", student_id: child.id,
        custom_fields: [
          { display_name: "Student", variable_name: "student", value: child.name },
          { display_name: "Student ID", variable_name: "student_id", value: child.studentId },
        ],
      },
      onSuccess: async (reference) => {
        try {
          await topupWallet(child.id, reference);
        } catch (err: any) {
          reopenWith(err?.message ?? "Payment could not be confirmed. Please contact the school if you were charged.");
          return;
        }
        setTopupProcessing(false);
        setTopupAmount("");
        setShowTopupModal(null);
        setTopupSuccess({ name: child.name, amount: creditedAmount });
        window.setTimeout(() => setTopupSuccess(null), 5000);
      },
      onCancel: () => reopenWith("Payment was cancelled. Your wallet was not charged."),
      onError: (message) => reopenWith(message),
    });
    }, 300);
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin1.length !== 4 || pin1 !== pin2) return;
    updateStudent(showPinModal!, { pin: pin1 });
    setPin1(""); setPin2("");
    setShowPinModal(null);
  };

  const handleChangeLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyLim || !monthlyLim) return;
    setLimitsBusy(true); setLimitsError("");
    const r = await setCardLimits(showLimitsModal!, Number(dailyLim), Number(monthlyLim));
    setLimitsBusy(false);
    if (!r.success) { setLimitsError(r.message ?? "Your limits were not saved. Please try again."); return; }
    setShowLimitsModal(null);
  };

  const handleToggleFreeze = (child: Student) => {
    if (child.cardStatus === "Issued" || child.cardStatus === "Unassigned") return;
    setCardFrozen(child.id, child.cardStatus === "Active").then((r) => {
      if (!r.success) window.alert(r.message ?? "The card was not updated. Please try again.");
    });
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
          <span className="text-sm font-semibold">{naira(topupSuccess.amount)} added to {topupSuccess.name}'s wallet</span>
        </div>
      )}
      <ParentSidebar activeTab={activeTab} setActiveTab={setActiveTab} onAddChild={handleOpenAddChild} />
      <AppTopBar
        title={pageTitle}
        subtitle={activeTab === "overview" ? `Hi ${firstName} 👋` : undefined}
        icon={ShieldCheck}
        actions={
          <NotificationCenter
            notifications={parentNotifications}
            onViewAll={() => setActiveTab("notifications")}
            onOpen={(n) => { if (n.studentId && students.some(s => s.id === n.studentId)) setActiveTab(`child_${n.studentId}`); }}
          />
        }
      />

      <main id="parent-main" className="flex-1 lg:ml-64 overflow-y-auto bg-background px-4 pt-20 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-8 lg:pb-10 lg:pt-24">
        <div key={activeTab} className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* OVERVIEW DASHBOARD */}
          {activeTab === "overview" && (
            <div className="space-y-6 md:space-y-8">

              {/* ── Family hero ── */}
              <div className="on-ink relative overflow-hidden rounded-3xl bg-ink p-5 text-white shadow-lg sm:p-7">
                <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/[0.07]" />
                <div className="pointer-events-none absolute -bottom-24 right-16 h-48 w-48 rounded-full bg-gold/15" />
                <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs font-extrabold tracking-widest text-lilac/70">Family balance</div>
                    <FitText className="mt-1 font-display text-4xl sm:text-5xl">{naira(familyBalance)}</FitText>
                    <div className="mt-1 text-sm text-lilac/80">
                      {linkedChildren.length === 0 ? "No children linked yet" : `Across ${linkedChildren.length} ${linkedChildren.length === 1 ? "child" : "children"}`}
                    </div>
                  </div>
                </div>

                {linkedChildren.length > 0 && (
                  <div className="relative -mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                    {linkedChildren.map(child => {
                      const initials = child.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <button
                          key={child.id}
                          onClick={() => setActiveTab(`child_${child.id}`)}
                          className="group flex min-w-[9.5rem] shrink-0 items-center gap-3 rounded-2xl bg-white/10 p-2.5 pr-4 text-left transition-colors hover:bg-white/15"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lilac text-ink ring-2 ring-white/20">
                            {child.imageUrl ? (
                              <img src={child.imageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-display">{initials}</span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-extrabold">{child.name.split(' ')[0]}</span>
                            <FitText className="block font-display text-sm text-gold">{naira(child.walletBalance)}</FitText>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {linkedChildren.length === 0 ? (
                <div className="text-center px-6 py-14 sm:py-20 bg-card rounded-3xl border-2 border-border border-dashed">
                  <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-lilac text-ink-2"><LinkIcon className="h-7 w-7" /></span>
                  <h3 className="font-display text-2xl text-foreground mb-2">No children linked</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6">Go to <b className="text-foreground">My Children</b> and tap <b className="text-foreground">+</b> to link your child with the Authorization Code and Student ID from their school.</p>
                  <Button onClick={() => setActiveTab("children")} variant="outline" className="h-11 rounded-2xl px-6"><Users /> Go to My Children</Button>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                      {[
                        { label: "Linked children", value: String(linkedChildren.length), icon: Users, tint: "bg-lilac text-ink-2", tone: "text-foreground" },
                        { label: "Combined balance", value: naira(totalBal), icon: Wallet, tint: "bg-mint text-green-700", tone: "text-primary" },
                        { label: "Transactions", value: String(allTx.length), icon: History, tint: "bg-sky text-blue-700", tone: "text-foreground" },
                        { label: "Spent this month", value: naira(spentThisMonth), icon: ArrowUpRight, tint: "bg-peach text-amber-700", tone: "text-amber-400" },
                      ].map(s => (
                        <Card key={s.label} className="bg-card border-border shadow-sm">
                          <CardContent className="p-4 md:p-6">
                            <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${s.tint}`}><s.icon className="h-4 w-4" /></span>
                            <div className="text-muted-foreground text-xs mb-1 font-extrabold tracking-wide ">{s.label}</div>
                            <FitText className={`text-2xl md:text-3xl font-display ${s.tone}`}>{s.value}</FitText>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="bg-card border-border shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-foreground">Spending by Child</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={childSpendData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                              <XAxis dataKey="name" stroke={chartTheme.axis} fontSize={12} />
                              <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={nairaAxis} />
                              <RechartsTooltip cursor={{ fill: chartTheme.cursor }} contentStyle={chartTheme.tooltip} />
                              <Bar dataKey="spent" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                      <Card className="bg-card border-border shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-foreground">Combined Spending Trend</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                              <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={12} />
                              <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={nairaAxis} />
                              <RechartsTooltip contentStyle={chartTheme.tooltip} />
                              <Line type="monotone" dataKey="spend" stroke="hsl(var(--chart-1))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--chart-1))' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="bg-card border-border shadow-sm">
                      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                        <CardTitle className="text-foreground">Recent Transactions</CardTitle>
                        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                          <button onClick={() => setTxFilter('all')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>All</button>
                          <button onClick={() => setTxFilter('in')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'in' ? 'bg-background text-green-500 shadow-sm' : 'text-muted-foreground hover:text-green-500'}`}>Money In</button>
                          <button onClick={() => setTxFilter('out')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'out' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Money Out</button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Paged items={allTx.filter(tx => txFilter === 'in' ? tx.amount < 0 : txFilter === 'out' ? tx.amount > 0 : true)} resetKey={txFilter}>{(pg) => (
                        <div className="overflow-hidden rounded-xl border border-border bg-background">
                        <ListScroll page={pg.page} offset="18rem" className="px-3 md:px-0">
                        <MobileTxList showChild txs={pg.pageItems} />
                        <div className="hidden md:block">
                          <Table>
                            <TableHeader className="bg-card/80">
                              <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground font-bold tracking-wider text-xs">Date</TableHead>
                                <TableHead className="text-muted-foreground font-bold tracking-wider text-xs">Child</TableHead>
                                <TableHead className="text-muted-foreground font-bold tracking-wider text-xs">School</TableHead>
                                <TableHead className="text-muted-foreground font-bold tracking-wider text-xs">Items</TableHead>
                                <TableHead className="text-right text-muted-foreground font-bold tracking-wider text-xs pr-4">Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pg.pageItems.map(tx => (
                                <TableRow key={tx.id} className="border-border/50 hover:bg-muted/50">
                                  <TableCell className="text-foreground text-sm">{when(tx)}</TableCell>
                                  <TableCell className="text-foreground font-medium">{tx.studentName}</TableCell>
                                  <TableCell className="text-muted-foreground text-sm">{tx.schoolName}</TableCell>
                                  <TableCell className="text-foreground text-sm">{tx.itemsString}</TableCell>
                                  <TableCell className={`font-bold text-right pr-4 ${tx.amount < 0 ? 'text-green-600' : 'text-foreground'}`}>{naira(Math.abs(tx.amount))}</TableCell>
                                </TableRow>
                              ))}
                              {pg.total === 0 && (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transactions found.</TableCell>
                                  </TableRow>
                                )}
                            </TableBody>
                          </Table>
                        </div>
                        </ListScroll>
                        <PaginationBar p={pg} label="transactions" />
                        </div>
                        )}</Paged>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}

          {/* PER CHILD VIEW */}
          {activeTab.startsWith("child_") && (() => {
            const childId = activeTab.split("_")[1];
            const child = students.find(s => s.id === childId);
            if (!child) return null;

            const childTx = transactions.filter(t => t.studentId === childId);   // newest first
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
                <div className="bg-card p-5 sm:p-8 rounded-3xl border border-border relative overflow-hidden shadow-sm flex flex-col md:flex-row gap-5 md:gap-8 items-center md:items-start">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-lilac rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

                  <ChildAvatar child={child} className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-full text-3xl border-4 border-card shadow-md ring-2 ring-lilac z-10" />

                  <div className="flex-1 text-center md:text-left z-10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{child.name}</h2>
                    <p className="text-muted-foreground mb-4">{child.className} • {tenants.find(t => t.id === child.tenantId)?.name}</p>

                    <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                      <Badge className={
                         child.cardLifecycleStatus === 'pending_assignment' ? 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 font-medium' :
                           child.cardLifecycleStatus === 'assigned' ? 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 font-medium' :
                             child.cardLifecycleStatus === 'ready' ? 'text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/30 font-medium' :
                               child.cardLifecycleStatus === 'delivered' ? 'text-purple-700 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/30 font-medium' :
                                 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-905/30 font-medium'
                       }>
                         {cardLifecycleLabel(child.cardLifecycleStatus)}
                       </Badge>
                       <Badge variant="outline" className={
                         child.cardStatus === 'Active'
                           ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800/30 dark:bg-emerald-950/20'
                           : child.cardStatus === 'Blocked'
                           ? 'text-red-700 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800/30 dark:bg-red-950/20'
                           : 'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-800/30 dark:bg-amber-950/20'
                       }>
                         Card: {child.cardStatus}
                       </Badge>
                    </div>
                  </div>

                  <div className="on-ink w-full md:w-auto bg-ink text-white p-5 sm:p-6 rounded-2xl text-center min-w-[220px] z-10 shadow-md">
                    <div className="text-xs text-lilac/70 mb-1 font-extrabold tracking-widest ">Wallet Balance</div>
                    <FitText className="text-4xl sm:text-5xl font-display">{naira(child.walletBalance)}</FitText>
                    <Button onClick={() => setShowTopupModal(child.id)} variant="highlight" size="sm" className="mt-3 h-9 rounded-xl px-4">
                      <Plus /> Top up
                    </Button>
                  </div>
                </div>

                {/* Alerts for Activation */}
                {(child.cardLifecycleStatus === 'ready' || child.cardLifecycleStatus === 'delivered') && (
                  <Alert className="bg-peach border-amber-500/40 rounded-2xl">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <AlertTitle className="text-amber-700 text-lg font-extrabold ml-2">Action Required: Activate Card</AlertTitle>
                    <AlertDescription className="text-amber-700 dark:text-amber-300 ml-2 mt-2">
                      {child.cardLifecycleStatus === 'ready'
                        ? "Your child's card is ready for pickup. Please set a secure PIN and limits to activate it."
                        : "Card has been delivered. Please activate it below to enable purchases."}
                      <div className="mt-4">
                        <Button onClick={() => setShowActivateModal(child.id)} variant="highlight" className="rounded-xl">Complete Activation</Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-card border-border hover:bg-muted/50 transition-all cursor-pointer shadow-md hover:shadow-lg" onClick={() => setShowTopupModal(child.id)}>
                    <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-mint flex items-center justify-center text-green-700"><Wallet className="w-6 h-6" /></div>
                      <div className="font-bold text-foreground text-sm">Top Up Wallet</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border hover:bg-muted/50 transition-all cursor-pointer shadow-md hover:shadow-lg" onClick={() => { setPin1(""); setPin2(""); setShowPinModal(child.id); }}>
                    <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-sky flex items-center justify-center text-blue-700"><Lock className="w-6 h-6" /></div>
                      <div className="font-bold text-foreground text-sm">Change PIN</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border hover:bg-muted/50 transition-all cursor-pointer shadow-md hover:shadow-lg" onClick={() => { setDailyLim(child.dailyLimit.toString()); setMonthlyLim(child.monthlyLimit.toString()); setLimitsError(""); setShowLimitsModal(child.id); }}>
                    <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-lilac flex items-center justify-center text-purple-700"><Settings className="w-6 h-6" /></div>
                      <div className="font-bold text-foreground text-sm">Card Limits</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border hover:bg-muted/50 transition-all cursor-pointer shadow-md hover:shadow-lg" onClick={() => handleToggleFreeze(child)}>
                    <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${child.cardStatus === 'Blocked' ? 'bg-mint text-green-700' : 'bg-blush text-red-700'}`}>
                        {child.cardStatus === 'Blocked' ? <CreditCard className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                      </div>
                      <div className="font-bold text-foreground text-sm">{child.cardStatus === 'Blocked' ? 'Unfreeze Card' : 'Freeze Card'}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Reporting */}
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                    <CardTitle className="text-foreground flex items-center gap-2"><History className="w-5 h-5 text-muted-foreground" /> Spending Insights</CardTitle>
                    <div className="flex w-full sm:w-auto items-center gap-2 bg-background p-1.5 rounded-xl border border-border">
                      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-card border-border text-foreground h-9 min-w-0 flex-1 sm:w-auto sm:flex-none text-sm" />
                      <span className="text-muted-foreground text-sm px-1">to</span>
                      <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-card border-border text-foreground h-9 min-w-0 flex-1 sm:w-auto sm:flex-none text-sm" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 mb-8">
                      <div className="bg-background p-4 rounded-xl border border-border">
                        <div className="text-muted-foreground text-xs font-bold tracking-wider mb-1">Money In</div>
                        <FitText className="text-3xl font-display text-green-500">{naira(moneyInPeriod)}</FitText>
                      </div>
                      <div className="bg-background p-4 rounded-xl border border-border">
                        <div className="text-muted-foreground text-xs font-bold tracking-wider mb-1">Money Out</div>
                        <FitText className="text-3xl font-display text-foreground">{naira(moneyOutPeriod)}</FitText>
                      </div>
                      <div className="bg-background p-4 rounded-xl border border-border">
                        <div className="text-muted-foreground text-xs font-bold tracking-wider mb-1">Most Frequent Item</div>
                        <div className="text-xl font-bold text-foreground mt-1 line-clamp-1">{topItems[0]?.name || "-"}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-muted-foreground tracking-wider">Daily Spending Trend</h4>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={childDailyData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                              <XAxis dataKey="date" stroke={chartTheme.axis} fontSize={10} />
                              <YAxis stroke={chartTheme.axis} fontSize={10} tickFormatter={nairaAxis} />
                              <RechartsTooltip contentStyle={chartTheme.tooltip} />
                              <Line type="monotone" dataKey="spend" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--chart-2))' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-muted-foreground tracking-wider">Top Items</h4>
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topItems} layout="vertical" margin={{ left: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                              <XAxis type="number" stroke={chartTheme.axis} fontSize={10} />
                              <YAxis dataKey="name" type="category" stroke={chartTheme.axis} fontSize={10} width={90} />
                              <RechartsTooltip cursor={{ fill: chartTheme.cursor }} contentStyle={chartTheme.tooltip} />
                              <Bar dataKey="qty" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <h4 className="text-sm font-bold text-muted-foreground tracking-wider mb-0">Transaction Log</h4>
                      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                        <button onClick={() => setTxFilter('all')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>All</button>
                        <button onClick={() => setTxFilter('in')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'in' ? 'bg-background text-green-500 shadow-sm' : 'text-muted-foreground hover:text-green-500'}`}>Money In</button>
                        <button onClick={() => setTxFilter('out')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${txFilter === 'out' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Money Out</button>
                      </div>
                    </div>
                    <Paged items={periodTx.filter(tx => txFilter === 'in' ? tx.amount < 0 : txFilter === 'out' ? tx.amount > 0 : true)} resetKey={txFilter}>{(pg) => (
                    <div className="overflow-hidden rounded-xl border border-border bg-background">
                    <ListScroll page={pg.page} offset="18rem" className="px-3 md:px-0">
                    <MobileTxList txs={pg.pageItems} />
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader className="bg-card/80">
                          <TableRow className="border-border">
                            <TableHead className="text-muted-foreground font-bold text-xs tracking-wider">Date</TableHead>
                            <TableHead className="text-muted-foreground font-bold text-xs tracking-wider">Items</TableHead>
                            <TableHead className="text-right text-muted-foreground font-bold text-xs tracking-wider pr-4">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pg.pageItems.map(tx => (
                            <TableRow key={tx.id} className="border-border/50 hover:bg-muted/50">
                              <TableCell className="text-foreground text-sm whitespace-nowrap">{when(tx)}</TableCell>
                              <TableCell className="text-foreground text-sm">{tx.itemsString}</TableCell>
                              <TableCell className={`text-right font-bold pr-4 ${tx.amount < 0 ? 'text-green-600' : 'text-foreground'}`}>{naira(Math.abs(tx.amount))}</TableCell>
                            </TableRow>
                          ))}
                          {pg.total === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No transactions found.</TableCell>
                              </TableRow>
                            )}
                        </TableBody>
                      </Table>
                    </div>
                    </ListScroll>
                    <PaginationBar p={pg} label="transactions" />
                    </div>
                    )}</Paged>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* CHILDREN LIST */}
          {activeTab === "children" && (
            <div className="space-y-6">
              <div className="flex items-center justify-end gap-3 sm:justify-between">
                <h1 className="text-3xl font-bold text-foreground hidden sm:flex items-center gap-3">
                  <Users className="text-primary" /> My Children
                </h1>
                {/* The only "add child" button in the parent app */}
                <Button onClick={handleOpenAddChild} variant="highlight" aria-label="Link a child" title="Link a child"
                  className="h-12 w-12 rounded-2xl p-0 shadow-md shadow-gold/30 sm:h-10 sm:w-auto sm:rounded-xl sm:px-4" data-testid="btn-link-child">
                  <Plus className="h-6 w-6 sm:h-4 sm:w-4" strokeWidth={2.75} /><span className="hidden sm:inline">Link a child</span>
                </Button>
              </div>
              {linkedChildren.length === 0 ? (
                <div className="text-center px-6 py-14 bg-card rounded-3xl border-2 border-border border-dashed">
                  <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-lilac text-ink-2"><Users className="h-7 w-7" /></span>
                  <h3 className="font-display text-2xl mb-2">No children yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">Tap <b className="text-foreground">+</b> above to link your first child and start managing their school wallet.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {linkedChildren.map(child => (
                    <button
                      key={child.id}
                      onClick={() => setActiveTab(`child_${child.id}`)}
                      className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                      data-testid={`child-card-${child.id}`}
                    >
                      <ChildAvatar child={child} className="h-14 w-14 shrink-0 rounded-2xl text-lg" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-extrabold">{child.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{child.className} · {tenants.find(t => t.id === child.tenantId)?.name}</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <FitText className="font-display text-lg text-primary">{naira(child.walletBalance)}</FitText>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${child.cardStatus === 'Active' ? 'bg-mint text-green-700' : child.cardStatus === 'Blocked' ? 'bg-blush text-red-700' : 'bg-peach text-amber-700'}`}>
                            {child.cardStatus}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LINK A CHILD */}
          {activeTab === "link" && (
            <LinkChildPage
              authCode={authCode}
              onAuthCodeChange={setAuthCode}
              studentId={studentIdInput}
              onStudentIdChange={setStudentIdInput}
              error={regError}
              success={regSuccess}
              processing={regProcessing}
              privacyAccepted={privacyAcceptedAt !== null}
              onPrivacyAccept={() => { setPrivacyAcceptedAt(new Date().toISOString()); setRegError(""); }}
              onSubmit={handleRegister}
              onBack={() => setActiveTab(linkedChildren.length ? "children" : "overview")}
            />
          )}

          {/* NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground hidden sm:flex items-center gap-3 mb-6">
                <Bell className="text-primary" /> Notifications
              </h1>

              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl">
                {parentNotifications.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No notifications.</p>
                  </div>
                ) : (
                  <Paged items={parentNotifications}>{(pg) => (<>
                  <ListScroll page={pg.page} offset="16rem" className="divide-y divide-border">
                    {pg.pageItems.map(n => (
                      <div key={n.id} className={`p-6 flex items-start gap-4 transition-colors ${!n.isRead ? 'bg-muted/50' : 'bg-card'}`}>
                        <div className={`p-3 rounded-full ${n.type === 'limit_exceeded' ? 'bg-amber-500/20 text-amber-500' : !n.isRead ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {n.type === 'limit_exceeded' ? <AlertTriangle className="w-6 h-6" /> : n.type === 'purchase' ? <ShoppingBag className="w-6 h-6" /> : n.type === 'topup' ? <Wallet className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`font-bold text-lg ${!n.isRead ? 'text-foreground' : 'text-foreground'}`}>{n.type === 'limit_exceeded' ? 'Spending Limit Alert' : n.type === 'purchase' ? 'Purchase' : n.type === 'topup' ? 'Wallet Topped Up' : 'Card Update'}</h4>
                            <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p className={`mb-3 ${!n.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>{n.message}</p>
                          {!n.isRead && (
                            <div className="flex gap-3 mt-2">
                              {(n.type === 'card_ready' || n.type === 'card_delivered') && (
                                <Button size="sm" onClick={() => { setActiveTab(`child_${n.studentId}`); markNotificationRead(n.id); }} className="bg-primary hover:bg-primary-hover text-primary-foreground">View Child Account</Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => markNotificationRead(n.id)} className="text-muted-foreground hover:text-foreground">Mark as Read</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </ListScroll>
                  <PaginationBar p={pg} label="notifications" />
                  </>)}</Paged>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground hidden sm:flex items-center gap-3 mb-6">
                <Settings className="text-primary" /> Account Settings
              </h1>
              <Card className="bg-card border-border shadow-sm max-w-2xl">
                <CardHeader>
                  <CardTitle className="text-foreground">Profile</CardTitle>
                  <CardDescription className="text-muted-foreground">Your name and email are managed by your school. You can update your contact number below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-bold tracking-wide">Full Name <span className="text-muted-foreground normal-case font-normal">(read-only)</span></Label>
                    <Input disabled value={parentSession.name} className="bg-background border-border text-muted-foreground cursor-not-allowed" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs font-bold tracking-wide">Email Address <span className="text-muted-foreground normal-case font-normal">(read-only)</span></Label>
                    <Input disabled value={parentSession.email} className="bg-background border-border text-muted-foreground cursor-not-allowed" />
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label className="text-foreground text-xs font-bold tracking-wide">Contact Phone Number</Label>
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
                        className="bg-primary hover:bg-primary-hover text-primary-foreground shrink-0"
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

              <Card className="bg-card border-border shadow-sm max-w-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPrivacyReview(true)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-green-700"><FileText className="h-4 w-4" /></span>
                  <span className="flex-1">
                    <span className="block font-extrabold">Privacy & compliance</span>
                    <span className="block text-xs text-muted-foreground">How LSPay handles your family's data</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 border-t border-border px-5 py-4 text-left transition-colors hover:bg-blush/60 lg:hidden"
                  data-testid="btn-parent-logout-mobile"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blush text-red-700"><LogOut className="h-4 w-4" /></span>
                  <span className="flex-1 font-extrabold text-red-700">Sign out</span>
                </button>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}
      <ParentBottomNav activeTab={activeTab} onNavigate={handleNavigate} unreadCount={unreadCount} />

      {/* Several children: choose whose wallet to top up */}
      <Dialog open={pickTopupChild} onOpenChange={setPickTopupChild}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader className="text-left">
            <DialogTitle className="font-display text-2xl">Top up whose wallet?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {linkedChildren.map(child => (
              <button key={child.id} type="button" data-testid={`topup-pick-${child.id}`}
                onClick={() => { setPickTopupChild(false); setShowTopupModal(child.id); }}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted">
                <ChildAvatar child={child} className="h-11 w-11 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold text-foreground">{child.name}</span>
                  <span className="block text-xs text-muted-foreground">Balance {naira(child.walletBalance)}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <PrivacyComplianceDialog
        open={showPrivacyReview}
        onOpenChange={setShowPrivacyReview}
        accepted={privacyAcceptedAt !== null}
        onAccept={() => setPrivacyAcceptedAt(new Date().toISOString())}
      />

      <Dialog open={showTopupModal !== null} onOpenChange={(o) => { if (!o) { setShowTopupModal(null); setTopupError(""); } }}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Top Up Wallet</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTopup} className="mt-4">
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[10, 20, 50].map(amt => (
                <Button key={amt} type="button" variant="outline" onClick={() => setTopupAmount(amt.toString())} className="bg-background border-border text-foreground h-14 text-xl font-bold hover:bg-muted hover:border-primary">{naira(amt, { decimals: 0 })}</Button>
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
                  <strong>Enrollment charge (4%): {naira((Number(topupAmount) * 0.04))}</strong> — covers infrastructure, payment gateway and transaction fees.<br />
                  Your child's wallet will be credited with <strong>{naira((Number(topupAmount) * 0.96))}</strong>.
                </p>
              </div>
            )}
            <div className="flex items-start gap-2 px-3 py-2.5 mb-5 rounded-lg bg-muted/50 border border-border">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Payments are processed securely by <span className="font-semibold text-foreground">Paystack</span>. LSPay never holds or stores your card or bank details — only who paid, what for, which child, the amount and the date and time.
              </p>
            </div>
            <Button type="submit" disabled={topupProcessing} className="w-full bg-primary hover:bg-primary-hover text-primary-foreground h-12 text-lg font-bold shadow-lg shadow-primary/20" data-testid="btn-process-payment">
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
            {limitsError && <p className="rounded-xl bg-blush px-3 py-2 text-sm font-semibold text-red-700" role="alert">{limitsError}</p>}
            <Button type="submit" disabled={limitsBusy} className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-lg font-bold mt-2">{limitsBusy ? "Saving…" : "Save Limits"}</Button>
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

            <Button type="submit" disabled={pin1.length !== 4 || pin1 !== pin2 || !dailyLim || !monthlyLim} className="w-full bg-primary hover:bg-primary-hover text-primary-foreground h-14 text-lg font-bold mt-4 shadow-lg shadow-primary/20">
              Activate Card
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
