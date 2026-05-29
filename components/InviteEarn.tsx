import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { User } from '../types';
import { getAllUsersFromFirestore } from '../firebase';

interface InviteEarnProps {
  user?: User;
  onBack: () => void;
}

const InviteEarn: React.FC<InviteEarnProps> = ({ user, onBack }) => {
  const [copied, setCopied] = useState(false);
  const [referredUsers, setReferredUsers] = useState<User[]>([]);
  const [isSyncingReferred, setIsSyncingReferred] = useState(false);

  // Generate Referral Link dynamically
  const userDomain = 'https://star9ja.top';
  const referralLink = `${userDomain}/?ref=${encodeURIComponent(user?.email || '')}`;
  const referralCode = user?.email?.toUpperCase() || '';

  // Sync referred list live from Firestore
  useEffect(() => {
    if (!user || !user.email) return;
    const cleanEmail = user.email.toLowerCase();

    // Fetch live updates from Firestore
    setIsSyncingReferred(true);
    getAllUsersFromFirestore()
      .then((allUsers) => {
        const cloudMatched = allUsers.filter(u => u.referredBy?.toLowerCase() === cleanEmail);
        setReferredUsers(cloudMatched);
      })
      .catch((err) => {
        console.error("Firestore live referrals fetch failed:", err);
      })
      .finally(() => {
        setIsSyncingReferred(false);
      });
  }, [user]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Mask user emails to maintain data privacy while confirming enrollment
  const maskEmail = (emailStr: string) => {
    if (!emailStr) return "User";
    const parts = emailStr.split('@');
    if (parts.length !== 2) return emailStr;
    const namePart = parts[0];
    const domainPart = parts[1];
    if (namePart.length <= 2) return `${namePart}**@${domainPart}`;
    return `${namePart.substring(0, 3)}***@${domainPart}`;
  };

  // Calculate sum earnings
  const totalReferred = referredUsers.length;
  const activeReferred = referredUsers.filter(u => u.activationStatus === 'active').length;
  const totalEarningsFromReferrals = activeReferred * 5000;

  return (
    <div className="px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3.5 bg-green-neon/10 rounded-full text-green-neon mb-2 shadow-inner">
          <Icons.Share2 size={32} className="animate-pulse" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Invite & Earn Portfolio</h2>
        <p className="text-xs text-gray-400 max-w-xs mx-auto">
          Share your referral code and link to accumulate <span className="font-bold text-green-neon">₦5,000</span> for every active friend who signs up!
        </p>
      </div>

      {/* Referral Link & Code Generator Block */}
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 flex flex-col space-y-4">
        <div>
          <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Your Personal Link</span>
          <div className="mt-1 flex items-center space-x-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 relative">
            <span className="text-xs text-gray-700 truncate font-mono select-all flex-1 pr-6">{referralLink}</span>
            <button 
              onClick={handleCopyLink}
              className="absolute right-2 p-1 text-gray-400 hover:text-green-600 focus:outline-none transition-colors"
            >
              {copied ? <Icons.Check size={16} className="text-green-500" /> : <Icons.Copy size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between space-x-4 pt-1">
          <div className="flex-1">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider block">Your Promo Code</span>
            <span className="text-sm font-black text-red-600 font-mono tracking-wider mt-0.5 block">{referralCode}</span>
          </div>
          
          <button 
            onClick={handleCopyLink}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white font-black text-xs rounded-xl shadow-[0_4px_10px_rgba(229,57,53,0.25)] hover:scale-103 transition-all flex items-center space-x-1.5"
          >
            {copied ? (
              <>
                <Icons.Check size={12} />
                <span>COPIED!</span>
              </>
            ) : (
              <>
                <Icons.Copy size={12} />
                <span>COPY URL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Referrals Stats Table & Counting Section */}
      <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-3.5 bg-red-600 rounded-full"></div>
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider">Referral Tracking Center</h3>
          </div>
          {isSyncingReferred && (
            <Icons.Sync className="animate-spin text-red-600" size={14} />
          )}
        </div>

        {/* Counter Summary Panel */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100/50 text-center">
            <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-widest block">Total Referred</span>
            <span className="text-lg font-black text-gray-800 mt-1 block">{totalReferred}</span>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100/50 text-center">
            <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-widest block">Activated</span>
            <span className="text-lg font-black text-green-600 mt-1 block">{activeReferred}</span>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100/50 text-center">
            <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-widest block">Earned Boost</span>
            <span className="text-lg font-black text-red-600 mt-1 block">₦{totalEarningsFromReferrals.toLocaleString()}</span>
          </div>
        </div>

        {/* referred accounts list */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider block">List of Referred Users</span>
          {referredUsers.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center border border-dashed border-gray-200">
              <Icons.User className="mx-auto text-gray-300 mb-2" size={24} />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">No referred accounts tracked yet</p>
              <p className="text-[10px] text-gray-400 mt-1">Share your link above to start growing your portfolio pipeline!</p>
            </div>
          ) : (
            referredUsers.map((item, id) => {
              const isActive = item.activationStatus === 'active';
              return (
                <div key={id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100/60 hover:bg-gray-100/40 transition-colors">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gray-200/60 text-gray-600 flex items-center justify-center font-black text-xs">
                      {item.name ? item.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-700 block">{item.name || 'Anonymous User'}</span>
                      <span className="text-[10px] font-mono text-gray-400 block leading-tight">{maskEmail(item.email)}</span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                      isActive 
                        ? 'bg-green-100 text-green-700 border border-green-200 animate-pulse' 
                        : item.activationStatus === 'banned'
                        ? 'bg-black text-white'
                        : item.activationStatus === 'pending'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-red-50 text-red-600 border border-red-100'
                    }`}>
                      {item.activationStatus || 'inactive'}
                    </span>
                    <span className="text-[9px] font-black text-gray-500 mt-0.5">
                      {isActive ? '+₦5,000' : '₦0'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <button 
        onClick={onBack} 
        className="w-full py-4 text-xs font-black tracking-widest uppercase text-gray-400 hover:text-white transition-colors"
      >
        Back to Dashboard
      </button>

    </div>
  );
};

export default InviteEarn;
