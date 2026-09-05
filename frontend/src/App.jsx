import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import RecoveryCases from './pages/RecoveryCases';
import RunRecovery from './pages/RunRecovery';
import AuditLog from './pages/AuditLog';

function AppShell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="relative flex-1 min-w-0">
        <div className="mx-auto px-6 md:px-8 py-7 max-w-[1360px]">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/cases" element={<RecoveryCases />} />
            <Route path="/run" element={<RunRecovery />} />
            <Route path="/audit" element={<AuditLog />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
