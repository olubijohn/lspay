import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { StoreProvider, useStore } from "./store";
import { SuperAdmin } from "./pages/SuperAdmin";
import { TenantConsole } from "./pages/TenantConsole";
import { ParentPortal } from "./pages/ParentPortal";
import { UnifiedLogin } from "./pages/auth/UnifiedLogin";
import { ThemeProvider } from "./theme";

const queryClient = new QueryClient();

function Router() {
  const { session, parentSession } = useStore();

  const isAuthenticated = session.portal !== null || parentSession !== null;

  const getPortalComponent = () => {
    if (session.portal === "super_admin") return <SuperAdmin />;
    if (session.portal === "tenant") return <TenantConsole />;
    if (parentSession) return <ParentPortal />;
    return <UnifiedLogin />;
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans transition-colors">
      <main className="flex-1">
        <Switch>
          <Route path="/">{getPortalComponent()}</Route>
          <Route path="/super-admin">{session.portal === "super_admin" ? <SuperAdmin /> : <UnifiedLogin />}</Route>
          <Route path="/tenant">{session.portal === "tenant" ? <TenantConsole /> : <UnifiedLogin />}</Route>
          <Route path="/parent">{parentSession ? <ParentPortal /> : <UnifiedLogin />}</Route>
          <Route><NotFound /></Route>
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <StoreProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </StoreProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
