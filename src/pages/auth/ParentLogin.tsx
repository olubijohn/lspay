import { useState } from "react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Wallet } from "lucide-react";

export function ParentLogin() {
  const { loginParent, registerParent } = useStore();
  const [, setLocation] = useLocation();
  
  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Reg state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regError, setRegError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const user = loginParent(loginEmail, loginPassword);
    if (user) {
      setLocation("/parent");
    } else {
      setLoginError("Invalid credentials.");
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    if (regPassword !== regConfirm) {
      setRegError("Passwords do not match.");
      return;
    }
    const user = registerParent(regName, regEmail, regPassword);
    if (user) {
      setLocation("/parent");
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="flex items-center space-x-2 mb-8">
        <Wallet className="h-8 w-8 text-primary" />
        <div className="text-foreground font-bold text-2xl tracking-tight">LSPay</div>
      </div>
      
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center pb-0">
          <div className="mx-auto bg-primary/30 w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-primary/30">
            <ShieldCheck className="text-primary w-6 h-6" />
          </div>
          <CardTitle className="text-2xl text-foreground">Parent Portal</CardTitle>
          <CardDescription className="text-muted-foreground">Manage your children's school wallets</CardDescription>
        </CardHeader>
        <CardContent className="mt-6">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-background border border-border">
              <TabsTrigger value="signin" className="data-[state=active]:bg-primary data-[state=active]:text-white">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-primary data-[state=active]:text-white">Create Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <Alert className="bg-red-900/30 border-red-500 text-red-400 py-2">
                    <AlertTitle className="text-sm font-medium">{loginError}</AlertTitle>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label className="text-foreground">Email Address</Label>
                  <Input 
                    type="email" 
                    value={loginEmail} 
                    onChange={e => setLoginEmail(e.target.value)} 
                    className="bg-background border-border text-foreground" 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Password</Label>
                  <Input 
                    type="password" 
                    value={loginPassword} 
                    onChange={e => setLoginPassword(e.target.value)} 
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white mt-2">Sign In</Button>
                
                <div className="mt-4 p-3 bg-background rounded border border-border text-xs text-muted-foreground">
                  <span className="block font-medium mb-1">Demo Credentials:</span>
                  helen@family.com / parent123
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleRegister} className="space-y-4">
                {regError && (
                  <Alert className="bg-red-900/30 border-red-500 text-red-400 py-2">
                    <AlertTitle className="text-sm font-medium">{regError}</AlertTitle>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label className="text-foreground">Full Name</Label>
                  <Input 
                    value={regName} 
                    onChange={e => setRegName(e.target.value)} 
                    className="bg-background border-border text-foreground" 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Email Address</Label>
                  <Input 
                    type="email" 
                    value={regEmail} 
                    onChange={e => setRegEmail(e.target.value)} 
                    className="bg-background border-border text-foreground" 
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Password</Label>
                  <Input 
                    type="password" 
                    value={regPassword} 
                    onChange={e => setRegPassword(e.target.value)} 
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Confirm Password</Label>
                  <Input 
                    type="password" 
                    value={regConfirm} 
                    onChange={e => setRegConfirm(e.target.value)} 
                    className="bg-background border-border text-foreground"
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white mt-2">Create Account</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
