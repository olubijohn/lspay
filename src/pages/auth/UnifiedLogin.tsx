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
  const { login, loginParent, lastAccessError } = useStore();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();

    const tenantUser = await login(trimmed, password, 'tenant');
    if (tenantUser) {
      setLocation(tenantUser.role === 'kiosk_operator' ? "/tenant?tab=pos" : "/tenant");
      return;
    }
    const adminUser = await login(trimmed, password, 'super_admin');
    if (adminUser) {
      setLocation("/super-admin");
      return;
    }
    const parentUser = await loginParent(trimmed, password);
    if (parentUser) {
      setLocation("/parent");
      return;
    }

    setError(lastAccessError() || "Invalid school number, username, email or password.");
  };


  return (
    <div className="min-h-screen w-full flex bg-paper">
      {/* Full screen split */}
      <div className="flex w-full min-h-screen">

        {/* Left Panel - Hidden on mobile */}
        <div className="hidden lg:block w-1/2 bg-ink text-white relative overflow-hidden on-ink">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full border border-white/10 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full border border-white/10 -translate-y-1/4 translate-x-1/4 pointer-events-none" />

          <div className="relative z-10 w-full h-full flex flex-col px-8 lg:px-16 py-10 lg:py-16 overflow-hidden">
            <div className="flex-shrink-0">
              <div className="flex items-center gap-3 mb-12">
                <img src="/logo-new.png" alt="LSPay Logo" className="w-7 h-7 rounded-md object-cover" />
                <span className="text-2xl font-display">LSPay</span>
              </div>
            </div>

            <div className="max-w-[460px] my-auto py-8 flex-shrink-0">
              <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 text-gold text-xs font-extrabold mb-8 border border-white/15">
                <span className="w-1.5 h-1.5 rounded-full bg-gold mr-2"></span>
                Trusted by 500+ schools
              </div>

              <h1 className="text-[2.75rem] mb-6 leading-[1.1] text-white">
                <span className="text-gold">Smart wallets.</span> Safe campuses. Seamless school days.
              </h1>

              <p className="text-lilac/80 text-sm mb-10 leading-relaxed">
                Empower your school with a <span className="text-mint font-bold">secure,</span> <span className="text-gold font-bold">cashless</span> ecosystem where students use smart digital cards for frictionless campus purchases while parents effortlessly manage funds in real time.
              </p>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
                  <div className="text-3xl font-display text-white mb-1">14,417</div>
                  <div className="text-xs text-lilac/70">Active students</div>
                </div>
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
                  <div className="text-3xl font-display text-white mb-1">12,363</div>
                  <div className="text-xs text-lilac/70">Processed payments</div>
                </div>
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
                  <div className="text-3xl font-display text-white mb-1">6,987</div>
                  <div className="text-xs text-lilac/70">Meals served today</div>
                </div>
                <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
                  <div className="text-3xl font-display text-white mb-1">2,654</div>
                  <div className="text-xs text-lilac/70">Connected parents</div>
                </div>
              </div>
            </div>

            <div className="w-full flex flex-col gap-3 mt-auto flex-shrink-0">
              <div className="flex items-center gap-[14px]">
                {/* Shield Icon */}
                <a href="#" className="w-[42px] h-[42px] bg-white rounded-full flex items-center justify-center hover:opacity-80 transition-opacity shadow-sm">
                  <ShieldCheck className="w-[22px] h-[22px] text-green" />
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
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 py-6 relative bg-paper text-ink">

          <div className="w-full max-w-[380px] xl:max-w-[420px] 2xl:max-w-[480px] mx-auto flex flex-col h-full justify-center items-center">

            <div className="w-24 h-24 xl:w-28 xl:h-28 bg-white rounded-full flex items-center justify-center mb-8 xl:mb-10 shadow-lg overflow-hidden border-4 border-lilac shrink-0">
              <img src="/logo-new.png" alt="LSPay Logo" className="w-full h-full object-cover" />
            </div>

            <div className="mb-8 xl:mb-10 text-center w-full">
              <h2 className="text-[1.75rem] xl:text-[2rem] text-ink mb-2 xl:mb-3">
                Welcome back
              </h2>
              <p className="text-slate-500 text-sm xl:text-base">
                Sign in to your LSPay account to continue managing payments.
              </p>
            </div>

            {error && (
              <Alert className="bg-blush border-coral/30 py-2 mb-6 w-full">
                <AlertTriangle className="h-4 w-4 text-coral" />
                <AlertDescription className="text-red-700 text-xs font-semibold">{error}</AlertDescription>
              </Alert>
            )}

            <div className="w-full text-left">
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-1.5 xl:space-y-2">
                    <Label className="text-xs xl:text-sm text-slate-500">Email, username or school number</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 xl:h-5 xl:w-5 text-slate-400" />
                      <Input
                        type="text"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="e.g. 12, adaeze or parent@example.com"
                        className="h-11 xl:h-12 pl-10 xl:pl-11 bg-white border-line text-ink focus-visible:ring-ink-2 text-sm xl:text-base"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 xl:space-y-2">
                    <Label className="text-xs xl:text-sm text-slate-500">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 xl:h-5 xl:w-5 text-slate-400" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-11 xl:h-12 pl-10 xl:pl-11 pr-10 xl:pr-11 bg-white border-line text-ink focus-visible:ring-ink-2 text-sm xl:text-base"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 xl:h-5 xl:w-5" /> : <Eye className="h-4 w-4 xl:h-5 xl:w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 xl:pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="remember" className="h-4 w-4 xl:h-5 xl:w-5 border-slate-300 rounded" />
                      <label htmlFor="remember" className="text-xs xl:text-sm font-medium text-slate-500 cursor-pointer">
                        Remember me
                      </label>
                    </div>
                    <button type="button" className="text-xs xl:text-sm font-extrabold text-ink-2 hover:underline">
                      Forgot password?
                    </button>
                  </div>

                  <Button type="submit" className="w-full h-11 xl:h-12 bg-ink hover:bg-ink-2 text-white rounded-xl mt-2 xl:mt-4 flex items-center justify-center gap-2 xl:text-base">
                    <LogIn className="w-4 h-4 xl:w-5 xl:h-5" /> Sign in to dashboard
                  </Button>
                </form>

              <div className="text-center mt-6 xl:mt-8">
                <p className="text-xs xl:text-sm text-slate-500">
                  <span className="font-extrabold text-ink-2">Parents:</span> your child's school gives you your LSPay login.
                  First time? Sign in with the temporary password you received and you'll choose your own.
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
