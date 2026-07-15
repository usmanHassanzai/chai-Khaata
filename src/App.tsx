import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const PaymentDue = lazy(() => import('./pages/PaymentDue'));
const SubscriptionRenew = lazy(() => import('./pages/SubscriptionRenew'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Dukaan = lazy(() => import('./pages/Dukaan'));
const Godaam = lazy(() => import('./pages/Godaam'));
const Customers = lazy(() => import('./pages/Customers'));
const StockLedger = lazy(() => import('./pages/StockLedger'));
const AdminApprovals = lazy(() => import('./pages/AdminApprovals'));
const Settings = lazy(() => import('./pages/Settings'));

function PageFallback() {
  return (
    <div className="page" style={{ padding: '2rem', textAlign: 'center' }}>
      <p className="settings-note">Loading…</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/payment-due" element={<PaymentDue />} />
            <Route path="/subscription-renew" element={<SubscriptionRenew />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dukaan" element={<Dukaan />} />
                <Route path="/godaam" element={<Godaam />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/stock" element={<StockLedger />} />
                <Route path="/admin" element={<AdminApprovals />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
