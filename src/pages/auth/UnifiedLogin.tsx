import { useState } from "react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, AlertTriangle, ShieldCheck, Mail, Lock, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/theme";

export function UnifiedLogin() {
  const { systemUsers, parentUsers, login, loginParent, registerParent } = useStore();
  const [, setLocation] = useLocation();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();

    const sysUser = systemUsers.find(u => u.email.toLowerCase() === trimmed && u.isActive);
    if (sysUser) {
      const role = sysUser.role === "super_admin" ? "super_admin" : "tenant";
      const user = login(trimmed, password, role);
      if (user) {
        setLocation(role === "super_admin" ? "/super-admin" : "/tenant");
        return;
      }
      setError("Incorrect password.");
      return;
    }

    const user = loginParent(trimmed, password);
    if (user) {
      setLocation("/parent");
      return;
    }

    setError("Invalid email or password.");
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!regName || !email || !password || !regConfirm) { setError("Fill in all fields."); return; }
    if (password.length < 6) { setError("Password too short."); return; }
    if (password !== regConfirm) { setError("Passwords don't match."); return; }

    const trimmed = email.trim().toLowerCase();
    const existingParent = parentUsers.find(u => u.email.toLowerCase() === trimmed);
    const existingSys = systemUsers.find(u => u.email.toLowerCase() === trimmed);
    if (existingParent || existingSys) { setError("Email already exists."); return; }

    registerParent(regName, trimmed, password);
    setLocation("/parent");
  };

  return (
    <div className="min-h-screen w-full flex bg-[#f8fafc]">
      {/* Full screen split */}
      <div className="flex w-full min-h-screen">

        {/* Left Panel - Hidden on mobile */}
        <div className="hidden lg:block w-1/2 bg-[#020e1f] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full border border-slate-800/50 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full border border-slate-800/50 -translate-y-1/4 translate-x-1/4 pointer-events-none" />

          <div className="relative z-10 w-full h-full flex flex-col px-8 lg:px-16 py-6 lg:py-8 overflow-hidden">
            <div className="flex-shrink-0">
              <div className="flex items-center gap-3 mb-1">
                <img src="/logo-new.png" alt="LSPay Logo" className="w-7 h-7 rounded-md object-cover" />
                <span className="text-xl font-bold tracking-tight">LSPay</span>
              </div>
            </div>

            <div className="max-w-[460px] my-auto py-4 flex-shrink-0">
              <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-950/40 text-emerald-400 text-xs font-medium mb-4 border border-emerald-900/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2"></span>
                Trusted by 500+ schools
              </div>

              <h1 className="text-[2.75rem] font-medium tracking-tight mb-3 leading-[1.1] text-slate-100">
                Smart wallets. Safe campuses. Seamless school days.
              </h1>

              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Empower your school with a secure, cashless ecosystem where students use smart digital cards for frictionless campus purchases while parents effortlessly manage funds in real time.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0b172a] border border-[#1e293b] rounded-xl p-5">
                  <div className="text-2xl font-bold text-white mb-1">14,417</div>
                  <div className="text-xs text-slate-400">Active students</div>
                </div>
                <div className="bg-[#0b172a] border border-[#1e293b] rounded-xl p-5">
                  <div className="text-2xl font-bold text-white mb-1">12,363</div>
                  <div className="text-xs text-slate-400">Processed payments</div>
                </div>
                <div className="bg-[#0b172a] border border-[#1e293b] rounded-xl p-5">
                  <div className="text-2xl font-bold text-white mb-1">6,987</div>
                  <div className="text-xs text-slate-400">Meals served today</div>
                </div>
                <div className="bg-[#0b172a] border border-[#1e293b] rounded-xl p-5">
                  <div className="text-2xl font-bold text-white mb-1">2,654</div>
                  <div className="text-xs text-slate-400">Connected parents</div>
                </div>
              </div>
            </div>

            <div className="w-full flex flex-col gap-3 mt-auto flex-shrink-0">
              <div className="flex items-center gap-[14px]">
                {/* Shield Icon */}
                <a href="#" className="w-[42px] h-[42px] bg-white rounded-full flex items-center justify-center hover:opacity-80 transition-opacity shadow-sm">
                  <ShieldCheck className="w-[22px] h-[22px] text-[#1b6b3e]" />
                </a>
                {/* Paystack Icon */}
                <a href="#" className="w-[42px] h-[42px] bg-white rounded-full flex items-center justify-center hover:opacity-80 transition-opacity shadow-sm overflow-hidden">
                  <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT7i9MkVvsBIOH3m5flgQwcKouOUz9R_HLC7uv8iGpr9w&s=10" alt="Paystack" className="w-[40px] h-[40px] object-contain" />
                </a>
              </div>
              <div className="text-[12px] font-semibold text-white mt-2 mb-2">
                UMUSA Education Cloud (LSA Series)
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 py-6 relative bg-[#f5f5f0] text-slate-900">

          <div className="w-full max-w-[380px] mx-auto flex flex-col h-full justify-center items-center">

            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 shadow-lg overflow-hidden border-4 border-[#f8fafc] shrink-0">
              <img src="/logo-new.png" alt="LSPay Logo" className="w-full h-full object-cover" />
            </div>

            <div className="mb-8 text-center w-full">
              <h2 className="text-[1.75rem] font-medium text-slate-900 mb-2 tracking-tight">
                {isRegistering ? "Create an account" : "Welcome back"}
              </h2>
              <p className="text-slate-500 text-sm">
                {isRegistering ? "Sign up for an LSPay account to start tracking." : "Sign in to your LSPay account to continue managing payments."}
              </p>
            </div>

            {error && (
              <Alert className="bg-red-500/10 border-red-500/20 py-2 mb-6 w-full">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-600 text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="w-full text-left">
              {!isRegistering ? (
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="parent@example.com"
                        className="h-11 pl-10 bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-11 pl-10 pr-10 bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="remember" className="h-4 w-4 border-slate-300 rounded" />
                      <label htmlFor="remember" className="text-xs font-medium text-slate-500 cursor-pointer">
                        Remember me
                      </label>
                    </div>
                    <button type="button" className="text-xs font-medium text-blue-600 hover:underline">
                      Forgot password?
                    </button>
                  </div>

                  <Button type="submit" className="w-full h-11 bg-[#16274a] hover:bg-[#16274a]/90 text-white font-medium rounded-lg mt-2 flex items-center justify-center gap-2">
                    <LogIn className="w-4 h-4" /> Sign in to dashboard
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Full Name</Label>
                    <Input
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      placeholder="John Doe"
                      className="h-11 bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="h-11 pl-10 bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min 6 chars"
                        className="h-11 pl-10 pr-10 bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="password"
                        value={regConfirm}
                        onChange={e => setRegConfirm(e.target.value)}
                        placeholder="Repeat password"
                        className="h-11 pl-10 bg-white border-slate-200 text-slate-900 focus-visible:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 bg-[#16274a] hover:bg-[#16274a]/90 text-white font-medium rounded-lg mt-2 flex items-center justify-center gap-2">
                    <LogIn className="w-4 h-4" /> Create Parent Account
                  </Button>
                </form>
              )}

              <div className="text-center mt-6">
                <p className="text-xs text-slate-500">
                  {isRegistering ? "Already have an account? " : "Need a parent account? "}
                  <button type="button" onClick={() => { setIsRegistering(!isRegistering); setError(""); }} className="font-semibold text-blue-600 hover:underline">
                    {isRegistering ? "Sign in instead" : "Create one free"}
                  </button>
                </p>
              </div>

              <div className="text-center mt-8">
                <div className="flex items-center justify-center text-[10px] text-slate-400 gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Nigeria Data Protection Commission (NDPC) </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
