import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from './ToastContext';

export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  phoneNumber?: string;
  role: 'BUYER' | 'SELLER' | 'STAFF' | 'ADMIN';
  roles?: ('BUYER' | 'SELLER' | 'STAFF' | 'ADMIN')[];
  staffPermissions?: string[];
  isSellerApproved?: boolean;
  sellerProfile?: {
    shopName?: string;
    shopDescription?: string;
    shopAddress?: string;
    categoriesSold?: any[];
    shopLocation?: {
      type: string;
      coordinates: [number, number];
      address?: string;
    };
    approvalStatus?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    rejectionReason?: string;
  };
  buyerProfile?: {
    preferredContact?: string;
    defaultDeliveryNotes?: string;
  };
}

interface GoogleAuthResult {
  user: User | null;
  isNewUser?: boolean;
  needsRoleSelection?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  register: (name: string, email: string, password: string, role: string) => Promise<User | null>;
  googleLogin: (credential?: string, accessToken?: string) => Promise<GoogleAuthResult>;
  completeOnboarding: (data: any) => Promise<User | null>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast } = useToast();

  const checkAuth = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Listen for custom auth expiration event from api interceptor
    const handleAuthExpired = () => {
      setUser((prevUser) => {
        if (prevUser !== null) {
          showToast('Your session has expired. Please log in again.', 'warning');
        }
        return null;
      });
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, [showToast]);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data.success) {
        const loggedInUser: User = response.data.user;
        setUser(loggedInUser);
        showToast(`Welcome back, ${loggedInUser.name}!`, 'success');
        return loggedInUser;
      }
      return null;
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Login failed. Check your credentials.';
      showToast(msg, 'error');
      return null;
    }
  };

  const register = async (name: string, email: string, password: string, role: string): Promise<User | null> => {
    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      if (response.data.success) {
        const newUser: User = response.data.user;
        setUser(newUser);
        showToast('Registration successful! Welcome aboard.', 'success');
        return newUser;
      }
      return null;
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Registration failed. Try again.';
      showToast(msg, 'error');
      return null;
    }
  };

  const googleLogin = async (credential?: string, accessToken?: string): Promise<GoogleAuthResult> => {
    try {
      const response = await api.post('/auth/google', { credential, accessToken });
      if (response.data.success) {
        const loggedUser: User = response.data.user;
        setUser(loggedUser);
        showToast(`Signed in with Google as ${loggedUser.name}!`, 'success');
        return {
          user: loggedUser,
          isNewUser: response.data.isNewUser,
          needsRoleSelection: response.data.needsRoleSelection,
        };
      }
      return { user: null };
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Google sign-in failed. Please try again.';
      showToast(msg, 'error');
      return { user: null };
    }
  };

  const completeOnboarding = async (data: any): Promise<User | null> => {
    try {
      const response = await api.post('/auth/onboarding', data);
      if (response.data.success) {
        const updated: User = response.data.user;
        setUser(updated);
        showToast('Profile setup completed successfully!', 'success');
        return updated;
      }
      return null;
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to complete profile onboarding.';
      showToast(msg, 'error');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Proceed with local logout regardless of API failure
    } finally {
      setUser(null);
      showToast('Logged out successfully.', 'info');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        googleLogin,
        completeOnboarding,
        setUser,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

