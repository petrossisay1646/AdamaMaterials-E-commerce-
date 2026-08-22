import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface GoogleSignInButtonProps {
  onSuccessRedirect?: string;
  text?: 'continue_with' | 'signup_with' | 'signin_with';
  label?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ 
  onSuccessRedirect = '/',
  text = 'continue_with',
  label,
}) => {
  const { googleLogin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const btnContainerRef = useRef<HTMLDivElement>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    // Load Google Identity Services script if not present
    if (typeof window !== 'undefined') {
      if (window.google?.accounts?.id) {
        setGisLoaded(true);
        initGoogle();
      } else {
        const scriptId = 'google-gsi-client-script';
        let script = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (!script) {
          script = document.createElement('script');
          script.id = scriptId;
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          document.body.appendChild(script);
        }
        script.onload = () => {
          setGisLoaded(true);
          initGoogle();
        };
      }
    }
  }, [googleClientId]);

  const initGoogle = () => {
    if (window.google?.accounts?.id && googleClientId && btnContainerRef.current) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCallback,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        btnContainerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(btnContainerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: text,
          shape: 'pill',
          logo_alignment: 'left',
        });
      } catch (err) {
        console.error('GIS initialization error:', err);
      }
    }
  };

  const handleGoogleCallback = async (response: any) => {
    if (!response?.credential) return;
    setLoading(true);
    try {
      const result = await googleLogin(response.credential);
      if (result?.user) {
        if (result.needsRoleSelection || result.isNewUser) {
          navigate('/role-selection');
        } else if (result.user.role === 'SELLER') {
          navigate('/seller-dashboard');
        } else if (result.user.role === 'ADMIN') {
          navigate('/admin-dashboard');
        } else if (result.user.role === 'STAFF') {
          navigate('/staff-dashboard');
        } else {
          navigate(onSuccessRedirect);
        }
      }
    } catch (error) {
      console.error('Google login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualClick = () => {
    if (!googleClientId) {
      alert('Google Sign-In requires VITE_GOOGLE_CLIENT_ID to be configured in your environment.');
      return;
    }
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-2">
      {/* Container for Official Google Rendered Button */}
      {googleClientId && (
        <div ref={btnContainerRef} className="w-full min-h-[44px] flex items-center justify-center"></div>
      )}

      {/* Fallback button when GIS is not yet loaded, loading, or client ID is missing */}
      {(!googleClientId || !gisLoaded || loading) && (
        <button
          type="button"
          onClick={handleManualClick}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-60"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? 'Authenticating with Google...' : 'Continue with Google'}</span>
        </button>
      )}
    </div>
  );
};

export default GoogleSignInButton;