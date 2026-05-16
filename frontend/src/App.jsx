import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppShell from './components/layout/AppShell';

import LoginPage          from './pages/auth/LoginPage';
import RegisterPage       from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage  from './pages/auth/ResetPasswordPage';

import SADashboard from './pages/superadmin/Dashboard';
import SAHotelList from './pages/superadmin/HotelList';
import { PaidHotels, PaymentHistory, ManagePlans, EmailReminders, OverallSummary } from './pages/superadmin/SuperAdminPages';
import EmailSettings from './pages/superadmin/EmailSettings';

import HotelDashboard  from './pages/hotel/HotelDashboard';
import QRManagement    from './pages/hotel/QRManagement';
import FoodManagement  from './pages/hotel/FoodManagement';
import { ServiceRequests, FoodOrders } from './pages/hotel/OrdersAndRequests';
import Analytics       from './pages/hotel/Analytics';
import UpgradePlan     from './pages/hotel/UpgradePlan';
import GuestLanding    from './pages/guest/GuestLanding';

const SA = ({ children }) => (
  <ProtectedRoute allowedRoles={['superadmin']}>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);
const HA = ({ children }) => (
  <ProtectedRoute allowedRoles={['hoteladmin']}>
    <AppShell>{children}</AppShell>
  </ProtectedRoute>
);

// AuthProvider wraps BrowserRouter so auth state survives route changes
const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{ style: { fontFamily: 'var(--font)', fontSize: '14px', fontWeight: 500 } }}
      />
      <Routes>
        <Route path="/login"                  element={<LoginPage />} />
        <Route path="/register"               element={<RegisterPage />} />
        <Route path="/forgot-password"        element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token"  element={<ResetPasswordPage />} />
        <Route path="/guest/:qrToken"         element={<GuestLanding />} />

        <Route path="/admin/dashboard"    element={<SA><SADashboard /></SA>} />
        <Route path="/admin/summary"      element={<SA><OverallSummary /></SA>} />
        <Route path="/admin/hotels"       element={<SA><SAHotelList /></SA>} />
        <Route path="/admin/paid-hotels"  element={<SA><PaidHotels /></SA>} />
        <Route path="/admin/payments"     element={<SA><PaymentHistory /></SA>} />
        <Route path="/admin/plans"        element={<SA><ManagePlans /></SA>} />
        <Route path="/admin/reminders"    element={<SA><EmailReminders /></SA>} />
        <Route path="/admin/email-settings" element={<SA><EmailSettings /></SA>} />

        <Route path="/hotel/dashboard"         element={<HA><HotelDashboard /></HA>} />
        <Route path="/hotel/qr"                element={<HA><QRManagement /></HA>} />
        <Route path="/hotel/food"              element={<HA><FoodManagement /></HA>} />
        <Route path="/hotel/service-requests"  element={<HA><ServiceRequests /></HA>} />
        <Route path="/hotel/food-orders"       element={<HA><FoodOrders /></HA>} />
        <Route path="/hotel/analytics"         element={<HA><Analytics /></HA>} />
        <Route path="/hotel/upgrade"           element={<HA><UpgradePlan /></HA>} />

        <Route path="/"   element={<Navigate to="/login" replace />} />
        <Route path="*"   element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
