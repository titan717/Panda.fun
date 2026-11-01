import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../../lib/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'pill' | 'compact';
}

export function PWAInstallButton({
  className = '',
  variant = 'pill'
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [installing, setInstalling] = useState(false);

  if (isInstalled) return null;

  const handleInstallClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInstallable) return;
    setInstalling(true);
    try {
      await install();
    } finally {
      setInstalling(false);
    }
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={handleInstallClick}
        disabled={!isInstallable || installing}
        className={`w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50 ${className}`}
        title="Install Kinoma app"
        aria-label="Install App"
      >
        <Download className="w-4 h-4 text-[#e8d0c0]" />
      </button>
    );
  }

  return (
    <button
      onClick={handleInstallClick}
      disabled={!isInstallable || installing}
      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/15 border border-white/20 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 ${className}`}
      title="Install Kinoma app"
    >
      <Download className="w-3.5 h-3.5 text-[#e8d0c0]" />
      <span>{installing ? 'Installing...' : 'Install Kinoma'}</span>
    </button>
  );
}
