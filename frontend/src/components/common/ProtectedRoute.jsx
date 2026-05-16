import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Loader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: 'var(--bg)',
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 40, height: 40,
        border: '3px solid var(--gray-200)',
        borderTopColor: 'var(--brand)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        margin: '0 auto 12px',
      }} />
      <div style={{ fontSize: 14, color: 'var(--gray-400)' }}>Loading…</div>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Still checking token validity — show spinner, never redirect yet
  if (loading) return <Loader />;

  // No user — go to login
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // Wrong role — send to correct home
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'superadmin' ? '/admin/dashboard' : '/hotel/dashboard'} replace />;
  }

  return children;
};

export default ProtectedRoute;
