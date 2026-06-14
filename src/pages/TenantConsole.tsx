import { useState, useEffect } from "react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { TenantSidebar } from "@/components/layout/TenantSidebar";
import { TenantStudents } from "@/components/tenant/TenantStudents";
import { TenantInventory } from "@/components/tenant/TenantInventory";
import { TenantStockManagement } from "@/components/tenant/TenantStockManagement";
import { TenantReporting } from "@/components/tenant/TenantReporting";
import { TenantKiosk } from "@/components/tenant/TenantKiosk";
import { TenantDashboard } from "@/components/tenant/TenantDashboard";
import {
  Bell, CreditCard, Receipt, XCircle, AlertTriangle,
  Users, Plus, Monitor, Store,
} from "lucide-react";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function TenantConsole() {
  const {
    session, tenants, transactions, cancelTransaction, students,
    notifications, markNotificationRead, systemUsers, createSystemUser, updateSystemUser,
  } = useStore();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Kiosk confirmation
  const [showKioskConfirm, setShowKioskConfirm] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  // Transactions
  const [txStartDate, setTxStartDate] = useState("2026-06-01");
  const [txEndDate, setTxEndDate] = useState("2026-06-10");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState("");

  // User management
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"tenant_admin" | "backoffice" | "kiosk_operator">("backoffice");
  const [userSuccessMsg, setUserSuccessMsg] = useState("");

  const user = session.user;
  const tenantId = user?.tenantId;
  const activeTenant = tenants.find(t => t.id === tenantId);

  useEffect(() => {
    if (!user || session.portal !== "tenant") {
      setLocation("/");
      return;
    }
    if (user.role === "kiosk_operator") {
      setActiveTab("kiosk");
    } else if (user.role === "backoffice" && activeTab === "dashboard") {
      setActiveTab("inventory");
    }
  }, [user, session.portal, setLocation]);

  if (!user || !activeTenant) return null;

  const canSeeKiosk = user.role === "tenant_admin" || user.role === "kiosk_operator";
  const canSeeOthers = user.role === "tenant_admin" || user.role === "backoffice";
  const isAdmin = user.role === "tenant_admin";

  // Intercept kiosk tab to show confirmation
  const handleSetActiveTab = (tab: string) => {
    if (tab === "kiosk") {
      setShowKioskConfirm(true);
      return;
    }
    setActiveTab(tab);
  };

  if (activeTab === "kiosk" && canSeeKiosk) {
    return <TenantKiosk tenantId={activeTenant.id} onExit={() => setActiveTab(user.role === "kiosk_operator" ? "kiosk" : "dashboard")} />;
  }

  const tenantNotifications = notifications.filter(n => n.targetRole === "tenant" && n.targetTenantId === activeTenant.id);

  const tenantTxs = transactions.filter(t => {
    if (t.tenantId !== activeTenant.id) return false;
    if (t.date < txStartDate || t.date > txEndDate) return false;
    return true;
  });
  const txTotal = tenantTxs.reduce((s, t) => s + t.amount, 0);

  const tenantSystemUsers = systemUsers.filter(u => u.tenantId === activeTenant.id);

  const handleConfirmCancel = () => {
    if (cancelId === null) return;
    const tx = transactions.find(t => t.id === cancelId);
    cancelTransaction(cancelId);
    setCancelId(null);
    setCancelSuccessMsg(`Transaction refunded — £${tx?.amount.toFixed(2) ?? ""} returned to ${tx?.studentName}'s wallet.`);
    setTimeout(() => setCancelSuccessMsg(""), 5000);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) return;
    createSystemUser({ name: newUserName, email: newUserEmail, passwordHash: newUserPassword, role: newUserRole, tenantId: activeTenant.id, isActive: true });
    setUserSuccessMsg(`User ${newUserName} added.`);
    setNewUserName(""); setNewUserEmail(""); setNewUserPassword(""); setNewUserRole("backoffice");
    setShowUserModal(false);
    setTimeout(() => setUserSuccessMsg(""), 4000);
  };

  const roleBadge = (role: string) => {
    const cls = role === "tenant_admin" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : role === "backoffice" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return <Badge variant="outline" className={cls}>{role.replace(/_/g, " ")}</Badge>;
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <TenantSidebar activeTab={activeTab} setActiveTab={handleSetActiveTab} tenantName={activeTenant.name} mobileOpen={mobileNav} onMobileOpenChange={setMobileNav} />
      <MobileTopBar title={activeTenant.name} icon={Store} onMenuClick={() => setMobileNav(true)} />

      <main className="flex-1 lg:ml-64 overflow-y-auto bg-background px-4 pb-6 pt-20 lg:px-8 lg:pb-8 lg:pt-8">
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {cancelSuccessMsg && (
            <Alert className="bg-primary/30 border border-primary text-primary">
              <Receipt className="h-4 w-4 text-primary" />
              <AlertDescription>{cancelSuccessMsg}</AlertDescription>
            </Alert>
          )}
          {userSuccessMsg && (
            <Alert className="bg-primary/30 border border-primary text-primary">
              <Users className="h-4 w-4 text-primary" />
              <AlertDescription>{userSuccessMsg}</AlertDescription>
            </Alert>
          )}

          {activeTab === "dashboard" && canSeeOthers && <TenantDashboard tenantId={activeTenant.id} />}
          {activeTab === "students" && canSeeOthers && <TenantStudents tenantId={activeTenant.id} />}
          {activeTab === "inventory" && canSeeOthers && <TenantInventory tenantId={activeTenant.id} />}
          {activeTab === "stock" && canSeeOthers && <TenantStockManagement tenantId={activeTenant.id} />}
          {activeTab === "reporting" && canSeeOthers && <TenantReporting tenantId={activeTenant.id} />}

          {/* ─── TRANSACTIONS ───────────────────────────────────── */}
          {activeTab === "transactions" && canSeeOthers && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
                  <Receipt className="text-primary" /> Transactions
                </h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-card p-2 rounded-lg border border-border">
                  <Input type="date" value={txStartDate} onChange={e => setTxStartDate(e.target.value)} className="flex-1 min-w-[8rem] sm:flex-none sm:w-36 bg-background border-border text-foreground" />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input type="date" value={txEndDate} onChange={e => setTxEndDate(e.target.value)} className="flex-1 min-w-[8rem] sm:flex-none sm:w-36 bg-background border-border text-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Period Revenue", value: `£${txTotal.toFixed(2)}`, color: "text-primary" },
                  { label: "Transactions", value: tenantTxs.length, color: "text-foreground" },
                  { label: "Unique Students", value: new Set(tenantTxs.map(t => t.studentId)).size, color: "text-blue-400" },
                ].map(c => (
                  <Card key={c.label} className="bg-card border-border">
                    <CardContent className="p-6">
                      <div className="text-muted-foreground text-xs uppercase tracking-wide mb-2">{c.label}</div>
                      <div className={`text-3xl font-black ${c.color}`}>{c.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="bg-card border-border overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-background">
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground px-6 py-4">Date</TableHead>
                        <TableHead className="text-muted-foreground">Student</TableHead>
                        <TableHead className="text-muted-foreground">Items</TableHead>
                        <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                        <TableHead className="text-right px-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenantTxs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-20" />
                            No transactions in this date range.
                          </TableCell>
                        </TableRow>
                      ) : tenantTxs.map(tx => {
                        const student = students.find(s => s.id === tx.studentId);
                        return (
                          <TableRow key={tx.id} className="border-border/50 hover:bg-card/50">
                            <TableCell className="text-muted-foreground px-6 py-4 text-sm">{tx.date}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {student && <img src={student.imageUrl} alt="" className="w-7 h-7 rounded-full bg-muted shrink-0" onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/28x28/1e293b/94a3b8?text=${tx.studentName[0]}`; }} />}
                                <div>
                                  <div className="text-foreground font-medium text-sm">{tx.studentName}</div>
                                  {student && <div className="text-xs text-muted-foreground">{student.className}</div>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-xs truncate">{tx.itemsString}</TableCell>
                            <TableCell className="text-primary font-bold text-right">£{tx.amount.toFixed(2)}</TableCell>
                            <TableCell className="text-right px-6">
                              <Button variant="ghost" size="sm" onClick={() => setCancelId(tx.id)} className="text-red-500 hover:text-red-400 hover:bg-red-950/30 h-8 px-3">
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── USER MANAGEMENT ────────────────────────────────── */}
          {activeTab === "users" && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                  <Users className="text-primary" /> Console Users
                </h1>
                <Button onClick={() => setShowUserModal(true)} className="bg-primary hover:bg-primary/90 text-white" data-testid="btn-add-user">
                  <Plus className="h-4 w-4 mr-2" /> Add User
                </Button>
              </div>
              <Card className="bg-card border-border overflow-hidden">
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
                      {tenantSystemUsers.map(u => (
                        <TableRow key={u.id} className="border-border/50">
                          <TableCell className="px-6 py-4">
                            <div className="text-foreground font-bold">{u.name}</div>
                            <div className="text-sm text-muted-foreground">{u.email}</div>
                          </TableCell>
                          <TableCell>{roleBadge(u.role)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={u.isActive ? "text-primary border-primary" : "text-muted-foreground border-border"}>
                              {u.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-6">
                            <Button variant="ghost" size="sm" onClick={() => updateSystemUser(u.id, { isActive: !u.isActive })} className="text-muted-foreground hover:text-foreground" data-testid={`btn-toggle-user-${u.id}`}>
                              {u.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {tenantSystemUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No users added yet.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── NOTIFICATIONS ──────────────────────────────────── */}
          {activeTab === "notifications" && canSeeOthers && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Bell className="text-primary" /> Notifications
              </h1>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                {tenantNotifications.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No notifications.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {tenantNotifications.map(n => (
                      <div key={n.id} className={`p-6 flex items-start gap-4 ${!n.isRead ? "bg-muted/50" : "bg-card"}`}>
                        <div className={`p-3 rounded-full ${!n.isRead ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`font-bold ${!n.isRead ? "text-foreground" : "text-foreground"}`}>Card Update</h4>
                            <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p className={`mb-3 text-sm ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>{n.message}</p>
                          {!n.isRead && (
                            <div className="flex gap-3">
                              <Button size="sm" onClick={() => { setActiveTab("students"); markNotificationRead(n.id); }} className="bg-primary hover:bg-primary/90 text-white">View Student</Button>
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

      {/* ─── KIOSK CONFIRMATION ─────────────────────────────── */}
      <Dialog open={showKioskConfirm} onOpenChange={setShowKioskConfirm}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Monitor className="h-5 w-5 text-primary" /> Open Kiosk Mode
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-foreground text-sm">You are about to enter full-screen kiosk mode. This is intended for a dedicated terminal.</p>
            <p className="text-muted-foreground text-xs">You will need your login password to exit kiosk mode.</p>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" onClick={() => setShowKioskConfirm(false)} className="text-muted-foreground">Cancel</Button>
            <Button
              onClick={() => { setShowKioskConfirm(false); setActiveTab("kiosk"); }}
              className="bg-primary hover:bg-primary/90 text-white"
              data-testid="btn-confirm-kiosk"
            >
              Open Kiosk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── CANCEL TRANSACTION DIALOG ──────────────────────── */}
      <Dialog open={cancelId !== null} onOpenChange={open => { if (!open) setCancelId(null); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" /> Cancel Transaction
            </DialogTitle>
          </DialogHeader>
          {cancelId !== null && (() => {
            const tx = transactions.find(t => t.id === cancelId);
            if (!tx) return null;
            return (
              <div className="space-y-4 py-2">
                <p className="text-foreground text-sm">Refund <span className="font-bold text-primary">£{tx.amount.toFixed(2)}</span> to <span className="font-bold text-foreground">{tx.studentName}</span>'s wallet?</p>
                <div className="bg-background rounded-lg p-3 text-sm text-muted-foreground space-y-1">
                  <div className="flex justify-between"><span>Items</span><span className="text-foreground">{tx.itemsString}</span></div>
                  <div className="flex justify-between"><span>Date</span><span className="text-foreground">{tx.date}</span></div>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-3">
            <Button variant="ghost" onClick={() => setCancelId(null)} className="text-muted-foreground">Keep</Button>
            <Button onClick={handleConfirmCancel} className="bg-red-600 hover:bg-red-700 text-white">Refund & Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ADD USER MODAL ─────────────────────────────────── */}
      <Dialog open={showUserModal} onOpenChange={setShowUserModal}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Add Console User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-foreground">Full Name</Label>
              <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} className="bg-background border-border text-foreground" data-testid="input-new-user-name" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Email</Label>
              <Input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="bg-background border-border text-foreground" data-testid="input-new-user-email" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Password</Label>
              <Input type="text" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} className="bg-background border-border text-foreground" data-testid="input-new-user-password" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Role</Label>
              <Select value={newUserRole} onValueChange={v => setNewUserRole(v as typeof newUserRole)}>
                <SelectTrigger className="bg-background border-border text-foreground" data-testid="select-new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="tenant_admin">Tenant Admin — full console access</SelectItem>
                  <SelectItem value="backoffice">Backoffice — inventory, stock & reporting</SelectItem>
                  <SelectItem value="kiosk_operator">Kiosk Operator — kiosk only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowUserModal(false)} className="text-muted-foreground">Cancel</Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6">Create User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
