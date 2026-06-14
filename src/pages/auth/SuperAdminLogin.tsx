import { useState } from "react";
import { useStore } from "@/store";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Wallet } from "lucide-react";

export function SuperAdminLogin() {
  const { login } = useStore();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const user = login(email, password, 'super_admin');
    if (user) {
      setLocation("/super-admin");
    } else {
      setError("Invalid credentials or unauthorized access.");
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="flex items-center space-x-2 mb-8">
        <Wallet className="h-8 w-8 text-primary" />
        <div className="text-foreground font-bold text-2xl tracking-tight">LSPay</div>
      </div>
      
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/30 w-12 h-12 rounded-full flex items-center justify-center mb-4 border border-primary/30">
            <ShieldAlert className="text-primary w-6 h-6" />
          </div>
          <CardTitle className="text-2xl text-foreground">Super Admin Console</CardTitle>
          <CardDescription className="text-muted-foreground">Platform Management Access</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert className="bg-red-900/30 border-red-500 text-red-400 py-2">
                <AlertTitle className="text-sm font-medium">{error}</AlertTitle>
              </Alert>
            )}
            <div className="space-y-2">
              <Label className="text-foreground">Email Address</Label>
              <Input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="bg-background border-border text-foreground" 
                placeholder="admin@lspay.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Password</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="bg-background border-border text-foreground"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white mt-2">Sign In</Button>
            
            <div className="mt-4 p-3 bg-background rounded border border-border text-xs text-muted-foreground">
              <span className="block font-medium mb-1">Demo Credentials:</span>
              admin@lspay.com / admin123
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
