import React from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import GoogleSignInButton from '../components/GoogleSignInButton';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();


  // Helper: map role to its dashboard path
  const dashboardFor = (role: string) => {
    switch (role) {
      case 'ADMIN':   return '/admin-dashboard';
      case 'STAFF':   return '/staff-dashboard';
      case 'SELLER':  return '/seller-dashboard';
      default:        return '/buyer-dashboard';
    }
  };

  const onSubmit = async (data: any) => {
    const loggedInUser = await login(data.email, data.password);
    if (loggedInUser) {
      // Navigate directly to role dashboard — avoids race condition where
      // React state hasn't propagated yet when navigating back to 'from'.
      navigate(dashboardFor(loggedInUser.role), { replace: true });
    }
  };


  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign In to AdaMaterials</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in with your Google account to access your dashboard
          </p>
        </div>

        {/* PRIMARY ACTION: Sign In with Google */}
        <div className="pt-2">
          <GoogleSignInButton text="signin_with" onSuccessRedirect="/buyer-dashboard" />
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-slate-400 font-semibold">Or staff / admin sign in</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            {/* Email */}
            <div className="mb-3">
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email', {
                    required: 'Email address is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                  className={`pl-9 block w-full rounded-xl border border-slate-200 bg-white py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-all ${errors.email ? 'border-rose-500 focus:ring-rose-500' : ''}`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-500 font-semibold">{errors.email.message as string}</p>
              )}
            </div>

            {/* Password */}
            <div className="mb-3">
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  className={`pl-9 block w-full rounded-xl border border-slate-200 bg-white py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm transition-all ${errors.password ? 'border-rose-500 focus:ring-rose-500' : ''}`}
                  placeholder="••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-500 font-semibold">{errors.password.message as string}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 shadow-md transition-all cursor-pointer"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In with Password'}
              {!isSubmitting && <ArrowRight className="w-4 h-4 ml-2 mt-0.5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
        </form>

        <div className="pt-2 text-center border-t border-slate-100">
          <p className="text-xs text-slate-500">
            New to AdaMaterials?{' '}
            <Link to="/register" className="font-bold text-primary-600 hover:text-primary-700 transition-colors">
              Sign up with Google
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
