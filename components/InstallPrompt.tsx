import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser from automatically showing the quick prompt
      e.preventDefault();
      // Stash the event so we can trigger it custom on click
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show details
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Also check if app is already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                          (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Trigger prompt
    await deferredPrompt.prompt();
    
    // Wait for prompt decision
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA install choice outcome: ${outcome}`);
    
    // Discard prompt
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-2xl z-50 animate-bounce-short transition-all">
      <div className="flex items-start space-x-3">
        <img 
          src="/icon-192.jpg" 
          alt="star9ja" 
          className="w-12 h-12 rounded-xl object-cover border border-slate-800"
          referrerPolicy="no-referrer"
        />
        <div className="flex-1 text-left">
          <h4 className="text-sm font-black tracking-tight text-white uppercase">star9ja Mobile</h4>
          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
            Install star9ja directly onto your home screen for rapid offline banking and instant loading.
          </p>
        </div>
        <button 
          onClick={handleClose} 
          className="text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/60 active:scale-95 transition-all"
        >
          <Icons.X size={14} />
        </button>
      </div>
      <div className="mt-3.5 flex space-x-2">
        <button 
          onClick={handleClose} 
          className="flex-1 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-800 hover:bg-slate-700/80 rounded-xl transition-all active:scale-[0.98]"
        >
          Not Now
        </button>
        <button 
          onClick={handleInstallClick} 
          className="flex-1 py-2 text-[10px] font-black text-black uppercase tracking-wider bg-glow-blue hover:brightness-110 rounded-xl transition-all flex items-center justify-center space-x-1 shadow-lg shadow-cyan-500/10 active:scale-[0.98]"
        >
          <Icons.Download size={12} className="text-black" />
          <span>Install App</span>
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
