import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { CallProvider } from "@/contexts/CallContext";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Learning from "./pages/Learning";
import CallPage from "./pages/CallPage";
import CallScreen from "./pages/CallScreen";
import Profile from "./pages/Profile";
import AdminRecording from "./pages/AdminRecording";
import ColoringPage from "./pages/ColoringPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useUser();
  if (loading) return <div className="min-h-screen gradient-primary" />;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useUser();
  if (loading) return <div className="min-h-screen gradient-primary" />;
  if (user) return <Navigate to="/home" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <>
    <IncomingCallOverlay />
    <Routes>
      <Route path="/" element={<PublicRoute><Onboarding /></PublicRoute>} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/learn" element={<ProtectedRoute><Learning /></ProtectedRoute>} />
      <Route path="/call" element={<ProtectedRoute><CallPage /></ProtectedRoute>} />
      <Route path="/call-screen" element={<ProtectedRoute><CallScreen /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/admin/recording" element={<ProtectedRoute><AdminRecording /></ProtectedRoute>} />
      <Route path="/coloring" element={<ProtectedRoute><ColoringPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <UserProvider>
        <CallProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </CallProvider>
      </UserProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
