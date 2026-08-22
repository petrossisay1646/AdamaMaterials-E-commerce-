import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LandingPage from './pages/LandingPage';
import CatalogPage from './pages/CatalogPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import PaymentCallbackPage from './pages/PaymentCallbackPage';
import BuyerDashboard from './pages/BuyerDashboard';
import SellerDashboard from './pages/SellerDashboard';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';
import UnauthorizedPage from './pages/UnauthorizedPage';
import MarketplaceMapPage from './pages/MarketplaceMapPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import LiveDeliveryTrackingPage from './pages/LiveDeliveryTrackingPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <MainLayout>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />

                {/* Catalog — blocked for ADMIN and STAFF (they must use buyer/seller accounts to shop) */}
                <Route
                  path="/products"
                  element={
                    <ProtectedRoute allowedRoles={['BUYER', 'SELLER']} catalogRoute>
                      <CatalogPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products/:id"
                  element={
                    <ProtectedRoute allowedRoles={['BUYER', 'SELLER']} catalogRoute>
                      <ProductDetailsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Secure Buyer Routes */}
                <Route
                  path="/cart"
                  element={
                    <ProtectedRoute allowedRoles={['BUYER']}>
                      <CartPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute allowedRoles={['BUYER']}>
                      <CheckoutPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer-dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['BUYER']}>
                      <BuyerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Secure Seller Routes */}
                <Route
                  path="/seller-dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['SELLER']}>
                      <SellerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Secure Staff Routes */}
                <Route
                  path="/staff-dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['STAFF', 'ADMIN']}>
                      <StaffDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Secure Admin Routes */}
                <Route
                  path="/admin-dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Chapa Hosted Payment Return & Verification Route */}
                <Route
                  path="/payment/callback"
                  element={
                    <ProtectedRoute allowedRoles={['BUYER', 'SELLER', 'STAFF', 'ADMIN']}>
                      <PaymentCallbackPage />
                    </ProtectedRoute>
                  }
                />

                {/* Marketplace Map — public discovery for all users and visitors */}
                <Route path="/map" element={<MarketplaceMapPage />} />

                {/* Role Selection / Onboarding — for new users (post Google Sign-In) */}
                <Route
                  path="/role-selection"
                  element={
                    <ProtectedRoute allowedRoles={['BUYER', 'SELLER', 'STAFF', 'ADMIN']}>
                      <RoleSelectionPage />
                    </ProtectedRoute>
                  }
                />

                {/* Live Delivery Tracking */}
                <Route
                  path="/track-delivery/:orderId"
                  element={
                    <ProtectedRoute allowedRoles={['BUYER', 'SELLER', 'STAFF', 'ADMIN']}>
                      <LiveDeliveryTrackingPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </MainLayout>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
