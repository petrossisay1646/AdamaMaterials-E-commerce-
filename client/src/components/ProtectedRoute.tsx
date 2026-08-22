import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('BUYER' | 'SELLER' | 'STAFF' | 'ADMIN')[];
  /** If true, unauthenticated users are allowed through (public browsing ok).
   *  Only logged-in ADMIN/STAFF are redirected to their dashboard. */
  catalogRoute?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, catalogRoute }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Catalog routes: public browsing allowed, but redirect admin/staff ──────
  if (catalogRoute) {
    if (user && (user.role === 'ADMIN' || user.role === 'STAFF')) {
      // Send them straight to their dashboard — they have no shopping role
      const dashboard = user.role === 'ADMIN' ? '/admin-dashboard' : '/staff-dashboard';
      return <Navigate to={dashboard} replace />;
    }
    // Guest or BUYER/SELLER — allow through
    return <>{children}</>;
  }

  // ── Standard protected routes ─────────────────────────────────────────────
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
