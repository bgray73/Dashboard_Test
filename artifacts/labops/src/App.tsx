import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Layout } from "@/components/layout";
import { Toaster } from "@/components/ui/toaster";
import { Dashboard } from "@/pages/Dashboard";
import { Devices } from "@/pages/Devices";
import { DeviceDetail } from "@/pages/DeviceDetail";
import { Monitoring } from "@/pages/Monitoring";
import { Reports } from "@/pages/Reports";
import { SavedConfigs } from "@/pages/SavedConfigs";
import { ConfigGenerator } from "@/pages/ConfigGenerator";
import { Subnet } from "@/pages/Subnet";
import { PingTool } from "@/pages/PingTool";
import { Tools } from "@/pages/Tools";
import { SettingsPage } from "@/pages/SettingsPage";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Layout>
          <ErrorBoundary>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/devices" component={Devices} />
              <Route path="/devices/:id" component={DeviceDetail} />
              <Route path="/monitoring" component={Monitoring} />
              <Route path="/reports" component={Reports} />
              <Route path="/config-generator/saved" component={SavedConfigs} />
              <Route path="/config-generator" component={ConfigGenerator} />
              <Route path="/tools/subnet" component={Subnet} />
              <Route path="/tools/ping" component={PingTool} />
              <Route path="/tools" component={Tools} />
              <Route path="/settings" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </ErrorBoundary>
        </Layout>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
