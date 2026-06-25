import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAppStore, useGigStore, useSettingsStore } from "@/store";

import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import ImportTab from "@/pages/Import";
import SetView from "@/pages/Set";
import Layout from "@/components/Layout";
import GigProvider from "@/components/GigProvider";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, setToken } = useAppStore();
  const { data: me, isLoading, error } = useGetMe({ 
    query: { 
      enabled: !token,
      queryKey: getGetMeQueryKey(),
      retry: false
    } 
  });

  useEffect(() => {
    if (error) {
      setToken(null);
      localStorage.removeItem("songbook_token");
    }
  }, [error, setToken]);

  // If we already have a token (just logged in or restored from storage), show the app.
  if (token) {
    return <>{children}</>;
  }

  // Otherwise wait for the /me check on initial load.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!me?.authenticated) {
    return <Login />;
  }

  return <>{children}</>;
}

function Router() {
  const role = useGigStore((s) => s.role);

  // Participants are music-view only: pin them to the host's song no matter what
  // URL they're on (or navigate to). Home handles the host-song / waiting view.
  if (role === "participant") {
    return <Home />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/import" component={ImportTab} />
      <Route path="/sets/:id" component={SetView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const theme = useSettingsStore(state => state.theme) || 'dark';
  const accentColor = useSettingsStore(state => state.accentColor);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (accentColor) {
      root.style.setProperty('--primary', accentColor);
      root.style.setProperty('--accent', accentColor);
    }
  }, [accentColor]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGuard>
          <GigProvider>
            <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
              <Layout>
                <Router />
              </Layout>
            </WouterRouter>
          </GigProvider>
        </AuthGuard>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;