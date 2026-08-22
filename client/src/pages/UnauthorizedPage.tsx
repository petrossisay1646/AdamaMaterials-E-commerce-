import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const UnauthorizedPage: React.FC = () => {
  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center bg-white border border-slate-200 p-8 rounded-2xl shadow-xl space-y-6">
        <div className="inline-flex p-4 rounded-full bg-rose-50 border border-rose-100 text-rose-600 shadow-inner">
          <ShieldAlert className="w-12 h-12 animate-bounce" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Access Denied</h2>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            You don't have permission to view this page. Please log in with the right account or go back to the homepage.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Safety
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
