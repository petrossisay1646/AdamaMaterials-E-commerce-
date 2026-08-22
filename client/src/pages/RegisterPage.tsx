import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShoppingBag, Store, Sparkles } from 'lucide-react';
import GoogleSignInButton from '../components/GoogleSignInButton';

const RegisterPage: React.FC = () => {
  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
        {/* Brand Header */}
        <div className="text-center">
          <Link to="/" className="inline-flex flex-col items-center gap-3 mb-4 group">
            <div className="overflow-hidden rounded-2xl border-2 border-amber-400/60 shadow-xl bg-slate-900 group-hover:scale-105 transition-all">
              <img 
                src="/logo.png" 
                alt="AdaMaterials Logo" 
                className="w-20 h-24 sm:w-24 sm:h-28 object-cover" 
              />
            </div>
            <span className="text-2xl font-black text-slate-950 tracking-tight">
              Ada<span className="text-accent-600 font-black">Materials</span>
            </span>
          </Link>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign Up for AdaMaterials</h2>
          <p className="mt-1.5 text-sm text-slate-500 max-w-sm mx-auto">
            Create your marketplace account using your Google identity. Fast, secure, and password-free.
          </p>
        </div>

        {/* PRIMARY GOOGLE REGISTRATION */}
        <div className="pt-2 flex flex-col items-center">
          <div className="w-full bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col items-center gap-4 text-center">
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl border border-amber-400/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">1-Click Google Sign Up</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                We'll verify your Google identity, then you can choose whether to buy or sell.
              </p>
            </div>

            <div className="w-full flex justify-center pt-1">
              <GoogleSignInButton text="signup_with" onSuccessRedirect="/role-selection" />
            </div>
          </div>
        </div>

        {/* Value Props */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3 text-xs text-slate-600 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <span><strong>Buyers:</strong> Browse reusable scrap, order delivery, pay with Chapa.</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
              <Store className="w-4 h-4" />
            </div>
            <span><strong>Sellers:</strong> List industrial surplus, scrap metals, timber, and fixtures.</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-600 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span><strong>Secured:</strong> Protected escrow payments & verified Adama local depots.</span>
          </div>
        </div>

        {/* Existing Account Footer */}
        <div className="pt-2 text-center border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700 transition-colors">
              Sign in with Google
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
