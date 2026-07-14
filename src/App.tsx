import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Dukaan from './pages/Dukaan';
import Godaam from './pages/Godaam';
import AdminApprovals from './pages/AdminApprovals';
import ForgotPassword from './pages/ForgotPassword';
import Landing from './pages/Landing';
import Login from './pages/Login';
import PaymentDue from './pages/PaymentDue';
import Register from './pages/Register';
import SubscriptionRenew from './pages/SubscriptionRenew';
import Settings from './pages/Settings';
import StockLedger from './pages/StockLedger';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  );
}
