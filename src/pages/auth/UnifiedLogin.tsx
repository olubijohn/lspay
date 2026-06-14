import { useState } from "react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 lg:p-8 bg-slate-100 dark:bg-[#090c15]">
      {/* Centered Floating Card with Border Radius */}
      <div className="flex w-full max-w-[1100px] h-auto lg:h-[calc(100vh-4rem)] lg:max-h-[700px] rounded-[2rem] overflow-hidden shadow-2xl bg-card border border-border">
        
        {/* Left Panel - Hidden on mobile */}
        <div className="hidden lg:flex w-1/2 bg-[#0f172a] text-white flex-col relative overflow-hidden p-10">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="z-10 flex items-center gap-3 mb-10">
            <img src="/logo.png" alt="LSPay Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold tracking-tight">LSPay</span>
          </div>

          <div className="z-10 flex-1 flex flex-col justify-center max-w-md">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/20 text-teal-400 text-xs font-semibold mb-6 border border-teal-500/30 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-2 animate-pulse"></span>
              SCHOOL PAYMENTS
            </div>
            
            <h1 className="text-4xl font-bold tracking-tight mb-4 leading-[1.1]">
              School payments,<br />
              <span className="text-amber-200 italic font-serif tracking-normal">fully in view.</span>
            </h1>
            
            <p className="text-slate-400 text-sm mb-8 leading-relaxed max-w-[90%]">
              Real-time analytics, smart alerts, and wallet tracking built for modern schools and parents.
            </p>

            <div className="grid grid-cols-3 gap-4 bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-sm mb-8">
              <div>
                <div className="text-xl font-bold text-white mb-0.5">₦2.4M</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Processed</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white mb-0.5">12k</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Students</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white flex items-center mb-0.5">
                  4.9<span className="text-sm ml-1 text-amber-400">★</span>
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Rating</div>
              </div>
            </div>

            {/* Faux Chart */}
            <div className="space-y-3 mt-auto">
              <div className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Transaction Volume · 6 Months</div>
              <div className="flex items-end gap-2 h-16">
                {[40, 60, 45, 80, 55, 95].map((height, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-slate-800 relative group transition-all">
                    <div 
                      className={`absolute bottom-0 w-full rounded-t-sm transition-all duration-500 ${i === 3 || i === 5 ? 'bg-teal-500' : 'bg-slate-700 group-hover:bg-slate-600'}`} 
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 py-6 relative bg-card">
          <div className="absolute top-6 right-6">
            <ThemeToggle />
          </div>

          <div className="w-full max-w-[360px] mx-auto flex flex-col h-full justify-center">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <img src="/logo.png" alt="LSPay Logo" className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold tracking-tight text-foreground">LSPay</span>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-1 font-serif tracking-tight">
                {isRegistering ? "Create an account" : "Welcome back"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {isRegistering ? "Sign up to track your child's wallet." : "Sign in to your LSPay account."}
              </p>
            </div>

            {error && (
              <Alert className="bg-red-500/10 border-red-500/20 py-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-600 text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {!isRegistering ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember" className="h-3.5 w-3.5 border-slate-300 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600" />
                    <label htmlFor="remember" className="text-xs font-medium leading-none text-slate-600 dark:text-slate-400 cursor-pointer">
                      Remember me
                    </label>
                  </div>
                  <button type="button" className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
                    Forgot password?
                  </button>
                </div>

                <Button type="submit" className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200 font-semibold rounded-lg mt-2">
                  Sign In to Dashboard
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Full Name</Label>
                  <Input
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="John Doe"
                    className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Confirm</Label>
                  <Input
                    type="password"
                    value={regConfirm}
                    onChange={e => setRegConfirm(e.target.value)}
                    placeholder="Repeat password"
                    className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200 font-semibold rounded-lg mt-2">
                  Create Parent Account
                </Button>
              </form>
            )}

            <div className="pt-4 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRegistering ? "Already have an account? " : "Don't have an account? "}
                <button 
                  onClick={() => { setIsRegistering(!isRegistering); setError(""); }}
                  className="font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                >
                  {isRegistering ? "Sign in here" : "Create one free"}
                </button>
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex justify-center gap-6">
              <div className="flex items-center text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-teal-500" />
                Secure Login
              </div>
              <div className="flex items-center text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-teal-500" />
                Verified
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
