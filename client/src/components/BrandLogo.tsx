import React from 'react';

interface BrandLogoProps {
  className?: string;
  showTagline?: boolean;
  variant?: 'full' | 'icon' | 'horizontal';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'h-10',
  showTagline = false,
  variant = 'full',
}) => {
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <rect width="64" height="64" rx="14" fill="#1E3A8A" />
        <path
          d="M11 13H16.5L23.5 44C23.75 45.2 24.4 46.2 25.4 47C26.3 47.7 27.5 48.1 28.7 48.1H54C55.2 48.1 56.3 47.7 57.3 47C58.2 46.2 58.8 45.2 59.1 44L63.5 25H19"
          stroke="#F97316"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="26.9" cy="57" r="2.5" fill="#38BDF8" />
        <circle cx="55.5" cy="57" r="2.5" fill="#38BDF8" />
      </svg>
    );
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Icon Emblem (Blue & Orange) */}
      <div className="relative p-2 bg-gradient-to-br from-blue-950 to-blue-900 rounded-xl shadow-md border border-blue-500/30 flex items-center justify-center flex-shrink-0">
        <svg
          width="28"
          height="28"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 10H14L21 42C21.3 43.2 22 44.3 23 45C24 45.7 25.2 46.1 26.4 46.1H52C53.2 46.1 54.4 45.7 55.3 45C56.3 44.3 56.9 43.2 57.2 42L62 23H17"
            stroke="#F97316"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="25" cy="55" r="3.5" fill="#38BDF8" />
          <circle cx="53.5" cy="55" r="3.5" fill="#38BDF8" />
        </svg>
      </div>

      {/* Brand Typography (Blue & Orange) */}
      <div className="flex flex-col">
        <div className="flex items-baseline font-black tracking-tight leading-none text-2xl sm:text-3xl">
          <span className="text-blue-600 font-black tracking-tight">re</span>
          <span className="text-orange-500 font-black tracking-tight">vola</span>
        </div>
        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">
          Every good thing deserves a second life
        </span>
      </div>
    </div>
  );
};

export default BrandLogo;
