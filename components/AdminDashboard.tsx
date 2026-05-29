import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { User } from '../types';

interface AdminDashboardProps {
  onBack: () => void;
  onRefreshActiveUser: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack, onRefreshActiveUser }) => {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'banned'>('all');
  const [selectedUserForNotify, setSelectedUserForNotify] = useState<User | null>(null);
  const [notifText, setNotifText] = useState('');
  const [globalNotifText, setGlobalNotifText] = useState('');
  const [activeReceiptModalUrl, setActiveReceiptModalUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load all users from LocalStorage
  const loadUsersFromStorage = () => {
    try {
      const stored = localStorage.getItem('star9ja_users') || localStorage.getItem('naira9ja_users');
      if (stored) {
        const parsed = JSON.parse(stored);
        const list = Object.values(parsed) as User[];
        setUsersList(list);
      } else {
        setUsersList([]);
      }
    } catch (e) {
      console.error("Error reading users database", e);
    }
  };

  useEffect(() => {
    loadUsersFromStorage();
  }, []);

  const saveUpdatedUsers = (updatedUsers: User[]) => {
    try {
      const db: Record<string, User> = {};
      updatedUsers.forEach(u => {
        db[u.email.toLowerCase()] = u;
      });
      localStorage.setItem('star9ja_users', JSON.stringify(db));
      setUsersList(updatedUsers);
      
      // Notify parent app to reload the currently logged-in user state if they are affected
      onRefreshActiveUser();
    } catch (e) {
      triggerMessage("Failed to save changes to persistence database.", "error");
    }
  };

  const triggerMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  // --- ACTIONS ---

  // Approve activation
  const handleApprove = (targetEmail: string) => {
    const updated = usersList.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        const rewardBonus = u.activationPlan === 'weekly' ? 10000 : u.activationPlan === 'yearly' ? 100000 : 30000;
        const approveTx = {
          id: `trx-approve-${Date.now()}`,
          type: 'credit' as const,
          amount: rewardBonus,
          description: `Account Activated - ${u.activationPlan?.toUpperCase()} VIP Claim Bonus`,
          date: new Date().toISOString(),
          status: 'success' as const
        };
        const currentNotifications = u.notifications || [];
        const systemNotif = {
          id: `notif-appr-${Date.now()}`,
          text: `Congratulations! Your account activation (${u.activationPlan}) has been APPROVED. Daily high-volume bonus claimed, and ₦${rewardBonus.toLocaleString()} has been credited to your active vault.`,
          date: new Date().toISOString(),
          read: false
        };

        return {
          ...u,
          activationStatus: 'active' as const,
          balance: u.balance + rewardBonus,
          transactions: [approveTx, ...(u.transactions || [])],
          notifications: [systemNotif, ...currentNotifications]
        };
      }
      return u;
    });
    saveUpdatedUsers(updated);
    triggerMessage("User activation approved. Account is now active!", "success");
  };

  // Decline activation
  const handleDeclineSpeculative = (targetEmail: string) => {
    if (!confirm("Decline this activation request? User will be set back to Inactive status.")) return;
    const updated = usersList.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        const currentNotifications = u.notifications || [];
        const systemNotif = {
          id: `notif-decl-${Date.now()}`,
          text: "Registration Activation Declined: The transfer receipt uploaded was invalid or unverified. Please transfer again with correct price slips.",
          date: new Date().toISOString(),
          read: false
        };
        return {
          ...u,
          activationStatus: 'inactive' as const,
          activationPlan: undefined,
          activationSubmitTime: undefined,
          activationProofBase64: undefined,
          notifications: [systemNotif, ...currentNotifications]
        };
      }
      return u;
    });
    saveUpdatedUsers(updated);
    triggerMessage("Activation request declined and reset.", "success");
  };

  // Ban/Unban account
  const handleToggleBan = (targetEmail: string, isCurrentlyBanned: boolean) => {
    const actionText = isCurrentlyBanned ? "Unban account?" : "Ban this account? User will be blocked instantly from dashboard access.";
    if (!confirm(actionText)) return;

    const updated = usersList.map(u => {
      if (u.email.toLowerCase() === targetEmail.toLowerCase()) {
        return {
          ...u,
          activationStatus: isCurrentlyBanned ? ('inactive' as const) : ('banned' as const)
        };
      }
      return u;
    });
    saveUpdatedUsers(updated);
    triggerMessage(isCurrentlyBanned ? "User account unbanned successfully." : "User account BANNED permanently.", "success");
  };

  // Specific user notification trigger
  const handleSendUserNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForNotify || !notifText.trim()) return;

    const updated = usersList.map(u => {
      if (u.email.toLowerCase() === selectedUserForNotify.email.toLowerCase()) {
        const inbox = u.notifications || [];
        const item = {
          id: `notif-custom-${Date.now()}`,
          text: notifText.trim(),
          date: new Date().toISOString(),
          read: false
        };
        return {
          ...u,
          notifications: [item, ...inbox]
        };
      }
      return u;
    });
    saveUpdatedUsers(updated);
    setNotifText('');
    setSelectedUserForNotify(null);
    triggerMessage("Notification delivered successfully directly.", "success");
  };

  // Dynamic broadcast deployment
  const handleGlobalBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalNotifText.trim()) return;

    const text = globalNotifText.trim();
    const updated = usersList.map(u => {
      const inbox = u.notifications || [];
      const item = {
        id: `notif-global-${Date.now()}`,
        text: `[GLOBAL ANNOUNCEMENT] ${text}`,
        date: new Date().toISOString(),
        read: false
      };
      return {
        ...u,
        notifications: [item, ...inbox]
      };
    });
    saveUpdatedUsers(updated);
    setGlobalNotifText('');
    triggerMessage("Global announcement broadcasted to all active portfolios!", "success");
  };

  // Search/Filter matching query
  const filteredUsers = usersList.filter(u => {
    const matchesQuery = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'all') return matchesQuery;
    if (filter === 'pending') return matchesQuery && u.activationStatus === 'pending';
    if (filter === 'active') return matchesQuery && u.activationStatus === 'active';
    if (filter === 'banned') return matchesQuery && u.activationStatus === 'banned';
    return matchesQuery;
  });

  return (
    <div className="px-4 py-4 space-y-6 duration-500 animate-in fade-in pb-16 bg-bg-gray">
      {/* Title Header */}
      <div className="flex justify-between items-center bg-zinc-950 p-4 rounded-2xl text-white shadow-xl relative overflow-hidden">
        {/* Glow behind admin title */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-red-500/10 rounded-full blur-2xl"></div>
        <div className="flex items-center space-x-2 relative z-10">
          <div className="p-2 bg-red-650 bg-primary-blue rounded-xl shadow-lg border border-red-500/40">
            <Icons.Lock size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-black uppercase tracking-tight">SECURE VAULT</h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Admin Control Terminal</p>
          </div>
        </div>
        
        <button 
          onClick={onBack}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-black uppercase tracking-wider rounded-lg border border-zinc-700/60 transition-all active:scale-95 z-10 flex items-center space-x-1"
        >
          <Icons.LogOut size={12} />
          <span>Exit Panel</span>
        </button>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-xl border flex items-center space-x-2 text-xs uppercase font-black tracking-wide animate-in slide-in-from-top-3 ${
          statusMessage.type === 'success' ? 'bg-green-100 border-green-200 text-green-800' : 'bg-red-100 border-red-200 text-red-805 text-red-800'
        }`}>
          <Icons.CheckCircle size={15} />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Global Alert Broadcast Form */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3.5">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center">
          <Icons.Radio className="mr-1.5 text-red-500 animate-pulse text-xs" size={15} />
          Deploy Broadcast Alert
        </h3>
        <p className="text-[10px] text-slate-400 uppercase font-medium leading-none">
          Send a push alert directly into every user account notification drawer.
        </p>

        <form onSubmit={handleGlobalBroadcast} className="flex space-x-2">
          <input 
            type="text"
            placeholder="Type alert announcement, e.g. 'Bonus event active this weekend!'..."
            value={globalNotifText}
            onChange={(e) => setGlobalNotifText(e.target.value)}
            className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-red-500 text-black placeholder-slate-400"
          />
          <button 
            type="submit"
            className="px-4 bg-black hover:bg-zinc-800 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-md flex items-center space-x-1"
          >
            <Icons.Send size={12} />
            <span>Broadcast</span>
          </button>
        </form>
      </div>

      {/* Filters & Search Row */}
      <div className="space-y-3">
        <div className="relative">
          <Icons.Search className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search account portfolios by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-100 text-xs text-black placeholder-slate-400 rounded-2xl focus:outline-none focus:ring-1 focus:ring-red-500 shadow-sm"
          />
        </div>

        {/* Tab filters */}
        <div className="flex space-x-1.5 overflow-x-auto no-scrollbar">
          {(['all', 'pending', 'active', 'banned'] as const).map((tab) => {
            const count = usersList.filter(u => {
              if (tab === 'all') return true;
              return u.activationStatus === tab;
            }).length;
            return (
              <button 
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center space-x-1 border ${
                  filter === tab 
                    ? 'bg-slate-900 border-slate-900 text-white' 
                    : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span>{tab}</span>
                <span className={`rounded-full px-1.5 text-[8px] font-bold ${filter === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Users Accounts List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center text-slate-400 text-xs py-10">
            <Icons.User size={32} className="mx-auto text-slate-200 mb-2" />
            <p className="font-bold uppercase tracking-wider text-[10px]">No Account Portfolios Registered</p>
            <p className="text-[9px] mt-0.5">Matching filters yield zero results.</p>
          </div>
        ) : (
          filteredUsers.map((item) => {
            const isUserBanned = item.activationStatus === 'banned';
            const isUserPending = item.activationStatus === 'pending';
            const isUserActive = item.activationStatus === 'active';
            
            return (
              <div 
                key={item.email}
                className={`bg-white rounded-2xl border p-5 shadow-sm space-y-4 relative overflow-hidden transition-all ${
                  isUserBanned 
                    ? 'border-red-100 bg-red-50/10' 
                    : isUserPending 
                    ? 'border-yellow-250 border-glow-blue/20 bg-amber-50/10' 
                    : 'border-slate-100'
                }`}
              >
                {/* Floating Indicators */}
                <div className="absolute top-5 right-5 flex space-x-1 items-center">
                  <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest ${
                    isUserBanned 
                      ? 'bg-rose-100 text-rose-800' 
                      : isUserPending 
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : isUserActive 
                      ? 'bg-green-105 bg-green-100 text-green-800 border border-green-200' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {item.activationStatus || 'inactive'}
                  </span>
                </div>

                {/* Profile row */}
                <div className="flex items-center space-x-3 pr-20">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm">
                    {item.profileImage ? (
                      <img src={item.profileImage} alt="profile" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                    ) : (
                      item.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-black text-slate-800 truncate uppercase mt-0.5">{item.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{item.email}</p>
                    <p className="text-[10px] font-black text-slate-700 mt-1 uppercase">
                      Vault Balance: <span className="text-green-600 font-extrabold font-sans">₦{item.balance.toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                {/* Verification/Request panel if exists */}
                {isUserPending && (
                  <div className="bg-amber-500/5 rounded-xl border border-amber-500/10 p-3.5 space-y-3.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-black text-amber-800 tracking-wider">
                      <span className="flex items-center">
                        <Icons.AlertTriangle size={12} className="mr-1" />
                        Verification Proof Loaded
                      </span>
                      <span>Plan: {item.activationPlan}</span>
                    </div>

                    {/* Preview Receipt */}
                    {item.activationProofBase64 && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Receipt Receipt Slip</p>
                        <div className="relative group cursor-zoom-in w-full h-24 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                          <img 
                            src={item.activationProofBase64} 
                            alt="Receipt Base64" 
                            className="h-full w-auto object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <button 
                            onClick={() => setActiveReceiptModalUrl(item.activationProofBase64 || null)}
                            className="absolute inset-0 bg-stone-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black uppercase text-white tracking-widest"
                          >
                            Tap to Zoom Receipt
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Pending Controls */}
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleApprove(item.email)}
                        className="py-2.5 bg-green-600 hover:bg-green-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all active:scale-95 shadow-md flex items-center justify-center space-x-1"
                      >
                        <Icons.Check size={12} />
                        <span>Approve Activation</span>
                      </button>
                      <button 
                        onClick={() => handleDeclineSpeculative(item.email)}
                        className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all active:scale-95 shadow-md flex items-center justify-center space-x-1"
                      >
                        <Icons.X size={12} />
                        <span>Decline Receipt</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Main generic actions */}
                <div className="pt-2 border-t border-slate-50 flex flex-wrap gap-2 items-center">
                  <button 
                    onClick={() => {
                      setSelectedUserForNotify(item);
                      setNotifText('');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[9px] uppercase tracking-widest rounded-lg flex items-center space-x-1 transition-colors"
                  >
                    <Icons.Notification size={11} />
                    <span>Deliver Alert</span>
                  </button>

                  <button 
                    onClick={() => handleToggleBan(item.email, isUserBanned)}
                    className={`px-3 py-1.5 font-extrabold text-[9px] uppercase tracking-widest rounded-lg flex items-center space-x-1 transition-all active:scale-95 text-white ${
                      isUserBanned 
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-sm' 
                        : 'bg-rose-500 hover:bg-rose-600 shadow-sm'
                    }`}
                  >
                    <Icons.Ban size={11} />
                    <span>{isUserBanned ? 'Unban User' : 'Ban User'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ZOOM RECEIPT MODAL */}
      {activeReceiptModalUrl && (
        <div className="fixed inset-0 bg-stone-950/80 z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-350">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative border border-slate-100 space-y-4 p-5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Expanded Receipt Slip</span>
              <button 
                onClick={() => setActiveReceiptModalUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <Icons.X size={16} />
              </button>
            </div>
            
            <div className="w-full bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 p-2 flex items-center justify-center select-none shadow-inner max-h-[60vh]">
              <img src={activeReceiptModalUrl} alt="slip expanded" className="w-full h-auto max-h-[50vh] object-contain" referrerPolicy="no-referrer" />
            </div>

            <button 
              onClick={() => setActiveReceiptModalUrl(null)}
              className="w-full py-3.5 bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transform active:scale-95 transition-all text-center"
            >
              Close Receipt Image
            </button>
          </div>
        </div>
      )}

      {/* DELIVER ALERT SPECIFIC MODAL */}
      {selectedUserForNotify && (
        <div className="fixed inset-0 bg-stone-950/70 z-[1000] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-50">
              <div className="text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Deliver Alert To</span>
                <span className="text-xs font-black text-black uppercase">{selectedUserForNotify.name}</span>
              </div>
              <button 
                onClick={() => setSelectedUserForNotify(null)}
                className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-500"
              >
                <Icons.X size={15} />
              </button>
            </div>

            <form onSubmit={handleSendUserNotification} className="space-y-4">
              <textarea 
                rows={4}
                required
                placeholder="Type custom notification e.g.: 'Your withdrawal of ₦5,000 is on hold because you selected the wrong plan. Please upgrade to VIP.'"
                value={notifText}
                onChange={(e) => setNotifText(e.target.value)}
                className="w-full text-xs text-black border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white placeholder-slate-400"
              />

              <div className="flex space-x-2">
                <button 
                  type="button"
                  onClick={() => setSelectedUserForNotify(null)}
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-red-650 bg-primary-blue hover:bg-red-600 shadow-md text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center justify-center space-x-1"
                >
                  <Icons.Send size={11} />
                  <span>Deliver Alert</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
