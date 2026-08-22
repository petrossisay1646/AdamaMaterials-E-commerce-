import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface Product {
  _id: string;
  name: string;
  price: number;
  condition: string;
  images: string[];
  quantity: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  subtotal: number;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addToCart: (productId: string, quantity: number) => Promise<boolean>;
  updateQuantity: (productId: string, quantity: number) => Promise<boolean>;
  removeFromCart: (productId: string) => Promise<boolean>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  const fetchCart = async () => {
    if (!user || user.role !== 'BUYER') return;
    setLoading(true);
    try {
      const response = await api.get('/cart');
      if (response.data.success) {
        setItems(response.data.cart.items || []);
        setSubtotal(response.data.cart.subtotal || 0);
      }
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch cart automatically when user logs in and is a BUYER
  useEffect(() => {
    if (user && user.role === 'BUYER') {
      fetchCart();
    } else {
      setItems([]);
      setSubtotal(0);
    }
  }, [user]);

  const addToCart = async (productId: string, quantity: number): Promise<boolean> => {
    try {
      const response = await api.post('/cart/add', { productId, quantity });
      if (response.data.success) {
        setItems(response.data.cart.items || []);
        setSubtotal(response.data.cart.subtotal || 0);
        showToast(response.data.message || 'Added to cart!', 'success');
        return true;
      }
      return false;
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to add item to cart.';
      showToast(msg, 'error');
      return false;
    }
  };

  const updateQuantity = async (productId: string, quantity: number): Promise<boolean> => {
    try {
      const response = await api.put('/cart/update', { productId, quantity });
      if (response.data.success) {
        setItems(response.data.cart.items || []);
        setSubtotal(response.data.cart.subtotal || 0);
        return true;
      }
      return false;
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update quantity.';
      showToast(msg, 'error');
      return false;
    }
  };

  const removeFromCart = async (productId: string): Promise<boolean> => {
    try {
      const response = await api.post('/cart/remove', { productId });
      if (response.data.success) {
        setItems(populatedItems => populatedItems.filter(item => item.product._id !== productId));
        setSubtotal(response.data.cart.subtotal || 0);
        showToast(response.data.message || 'Item removed.', 'info');
        return true;
      }
      return false;
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to remove item.';
      showToast(msg, 'error');
      return false;
    }
  };

  const clearCart = async () => {
    try {
      const response = await api.post('/cart/clear');
      if (response.data.success) {
        setItems([]);
        setSubtotal(0);
      }
    } catch (error) {
      console.error('Failed to clear cart:', error);
    }
  };

  return (
    <CartContext.Provider
      value={{
        items,
        subtotal,
        loading,
        fetchCart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
