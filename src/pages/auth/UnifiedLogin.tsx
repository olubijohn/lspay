import { useState } from "react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, ArrowRight, Eye, EyeOff, ShieldCheck, Store, Users, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/theme";

export function UnifiedLogin() {
  const { systemUsers, parentUsers, login, loginParent, registerParent } = useStore();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"email" | "password" | "register">("email");
  const [userType, setUserType] = useState<"super_admin" | "tenant" | "parent" | null>(null);
  const [error, setError] = useState("");
  const [regName, setRegName] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  const portalMeta = {
    super_admin: {
      label: "Super Admin Console",
      color: "text-primary",
      bg: "bg-primary/10 border-primary/30",
      icon: ShieldCheck,
    },
    tenant: {
      label: "School Admin Console",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/30",
      icon: Store,
    },
    parent: {
      label: "Parent Portal",
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/30",
      icon: Users,
    },
  };

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    const sysUser = systemUsers.find(u => u.email.toLowerCase() === trimmed && u.isActive);
    if (sysUser) {
      setUserType(sysUser.role === "super_admin" ? "super_admin" : "tenant");
      setStep("password");
      return;
    }

    const parentUser = parentUsers.find(u => u.email.toLowerCase() === trimmed);
    if (parentUser) {
      setUserType("parent");
      setStep("password");
      return;
    }

    setStep("register");
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (userType === "super_admin") {
      const user = login(email, password, "super_admin");
      if (user) { setLocation("/super-admin"); return; }
    } else if (userType === "tenant") {
      const user = login(email, password, "tenant");
      if (user) { setLocation("/tenant"); return; }
    } else if (userType === "parent") {
      const user = loginParent(email, password);
      if (user) { setLocation("/parent"); return; }
    }
    setError("Incorrect password. Please try again.");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!regName || !password || !regConfirm) { setError("Please fill in all fields."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== regConfirm) { setError("Passwords do not match."); return; }
    const existing = parentUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) { setError("An account with this email already exists."); return; }
    registerParent(regName, email, password);
    setLocation("/parent");
  };

  const portalInfo = userType ? portalMeta[userType] : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle variant="outline" />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 border border-primary/30 rounded-2xl mb-2">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">LSPay</h1>
          <p className="text-muted-foreground text-sm">Enter your email to get started</p>
        </div>

        <Card className="bg-card border-border shadow-2xl">
          <CardContent className="p-8 space-y-6">
            {portalInfo && step === "password" && (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${portalInfo.bg}`} data-testid="portal-indicator">
                <portalInfo.icon className={`h-5 w-5 ${portalInfo.color}`} />
                <div>
                  <span className={`text-sm font-bold ${portalInfo.color}`}>{portalInfo.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
                </div>
                <button
                  onClick={() => { setStep("email"); setPassword(""); setUserType(null); setError(""); }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                  data-testid="btn-change-email"
                >
                  Change
                </button>
              </div>
            )}

            {step === "email" && (
              <form onSubmit={handleEmailContinue} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-medium">Email Address</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoFocus
                    className="bg-background border-border text-foreground placeholder:text-muted-foreground h-12 text-base"
                    data-testid="input-email"
                  />
                </div>
                {error && (
                  <Alert className="bg-amber-900/20 border-amber-700/50">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <AlertDescription className="text-amber-300 text-sm">{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-base font-bold"
                  data-testid="btn-continue"
                >
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoFocus
                      className="bg-background border-border text-foreground h-12 text-base pr-12"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="btn-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && (
                  <Alert className="bg-red-900/20 border-red-700/50">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white h-12 text-base font-bold"
                  data-testid="btn-sign-in"
                >
                  Sign In
                </Button>
              </form>
            )}

            {step === "register" && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  <Users className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-purple-400 text-sm font-bold">New Parent Account</p>
                    <p className="text-xs text-muted-foreground">{email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setError(""); }}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Change
                  </button>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-medium">Full Name</Label>
                  <Input
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="Your full name"
                    className="bg-background border-border text-foreground h-12"
                    data-testid="input-reg-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-medium">Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="bg-background border-border text-foreground h-12"
                    data-testid="input-reg-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground text-sm font-medium">Confirm Password</Label>
                  <Input
                    type="password"
                    value={regConfirm}
                    onChange={e => setRegConfirm(e.target.value)}
                    placeholder="Repeat password"
                    className="bg-background border-border text-foreground h-12"
                    data-testid="input-reg-confirm"
                  />
                </div>
                {error && (
                  <Alert className="bg-red-900/20 border-red-700/50">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-red-300 text-sm">{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-base font-bold"
                  data-testid="btn-create-account"
                >
                  Create Parent Account
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="bg-card/50 border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Demo Credentials</p>
          <div className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
            <div className="flex justify-between"><span className="text-muted-foreground">Super Admin</span><span className="font-mono">admin@lspay.com</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">School Admin</span><span className="font-mono">sarah@greenwood.edu</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Kiosk Operator</span><span className="font-mono">james@greenwood.edu</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Parent</span><span className="font-mono">helen@family.com</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
