import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto close after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      
      {/* Toast Render Overlay */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            let bgColor = 'bg-white text-slate-800 border-slate-200';
            let Icon = Info;
            let iconColor = 'text-blue-500';

            if (toast.type === 'success') {
              bgColor = 'bg-emerald-50 border-emerald-100 text-emerald-800';
              Icon = CheckCircle2;
              iconColor = 'text-emerald-600';
            } else if (toast.type === 'error') {
              bgColor = 'bg-rose-50 border-rose-100 text-rose-800';
              Icon = AlertCircle;
              iconColor = 'text-rose-600';
            } else if (toast.type === 'warning') {
              bgColor = 'bg-amber-50 border-amber-100 text-amber-800';
              Icon = AlertTriangle;
              iconColor = 'text-amber-600';
            }

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.15 } }}
                className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg glass ${bgColor}`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
                <div className="flex-1 text-sm font-medium">{toast.message}</div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
