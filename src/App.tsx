import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";
import { routes } from "./config/app-routes";

// Loading component for lazy-loaded pages
function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="relative h-24 w-24 flex items-center justify-center mb-4">
        <div className="absolute inset-0 -m-1 h-26 w-26 animate-spin rounded-full border-4 border-b-2 border-primary"></div>
        <img
          src="/enclave-logo.png"
          alt="Enclave Logo"
          className="relative w-15"
        />
      </div>
      <span className="text-lg text-muted-foreground text-center">
        Getting things ready for you...
      </span>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="enclave-ui-theme">
      <AuthProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {routes.map((route) => {
                const Component = route.component;
                const element = route.protected ? (
                  <ProtectedRoute>
                    <Component />
                  </ProtectedRoute>
                ) : (
                  <Component />
                );

                return (
                  <Route key={route.path} path={route.path} element={element} />
                );
              })}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {/* Catch-all route for invalid URLs - redirect to dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </Router>
        <Toaster position="top-center" />
      </AuthProvider>
    </ThemeProvider>
  );
}
export default App;
