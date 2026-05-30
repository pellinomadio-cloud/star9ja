import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { User } from '../types';
import { saveUserToFirestore, getAllUsersFromFirestore } from '../firebase';

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

  // User Account Portfolio Editing States
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState<number>(0);
  const [editIsVIP, setEditIsVIP] = useState(false);
  const [editVipBalance, setEditVipBalance] = useState<number>(0);
  const [editLoanBalance, setEditLoanBalance] = useState<number>(0);
  const [editIsPMode, setEditIsPMode] = useState(false);
  const [editIsVMode, setEditIsVMode] = useState(false);
  const [editActivationStatus, setEditActivationStatus] = useState<User['activationStatus']>('inactive');
  const [editActivationPlan, setEditActivationPlan] = useState<User['activationPlan']>('weekly');
  const [hasImminentDeactivation, setHasImminentDeactivation] = useState(false);
  const [hasDeactivation, setHasDeactivation] = useState(false);

  const handleOpenEdit = (user: User) => {
    setSelectedUserForEdit(user);
    setEditName(user.name);
    setEditBalance(user.balance);
    setEditIsVIP(!!user.isVIP);
    setEditVipBalance(user.vipBalance || 0);
    setEditLoanBalance(user.loanBalance || 0);
    setEditIsPMode(!!user.isPMode);
    setEditIsVMode(!!user.isVMode);
    setEditActivationStatus(user.activationStatus || 'inactive');
    setEditActivationPlan(user.activationPlan || 'weekly');
    setHasImminentDeactivation(!!user.imminentDeactivationExpiry);
    setHasDeactivation(!!user.deactivationDate);
  };

  const handleSaveUserEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    const updated = usersList.map(u => {
      if (u.email.toLowerCase() === selectedUserForEdit.email.toLowerCase()) {
        const updatedUser: User = {
          ...u,
          name: editName.trim() || u.name,
          balance: Number(editBalance),
          isVIP: editIsVIP,
          vipBalance: Number(editVipBalance),
          loanBalance: Number(editLoanBalance),
          isPMode: editIsPMode,
          isVMode: editIsVMode,
          activationStatus: editActivationStatus,
        };

        if (editActivationStatus !== 'inactive') {
          updatedUser.activationPlan = editActivationPlan;
        } else {
          delete updatedUser.activationPlan;
        }

        // Imminent deactivation handler
        if (!hasImminentDeactivation) {
          delete updatedUser.imminentDeactivationExpiry;
        } else if (!u.imminentDeactivationExpiry) {
          // Set to 20 minutes from now if newly enabled
          updatedUser.imminentDeactivationExpiry = Date.now() + 20 * 60 * 1000;
        }

        // Deactivation handling
        if (!hasDeactivation) {
          delete updatedUser.deactivationDate;
        } else if (!u.deactivationDate) {
          // Marked as deactivated immediately
          updatedUser.deactivationDate = Date.now() - 1000;
        }

        return updatedUser;
      }
      return u;
    });

    saveUpdatedUsers(updated);
    setSelectedUserForEdit(null);
    triggerMessage("User portfolio modified and saved to live secure database!", "success");
  };

  // Load all users from Firebase Firestore
  const loadUsersFromStorage = async () => {
    try {
      const cloudList = await getAllUsersFromFirestore();
      if (cloudList && cloudList.length > 0) {
        setUsersList(cloudList);
      } else {
        setUsersList([]);
      }
    } catch (e) {
      console.error("Error reading users database from Firestore", e);
    }
  };

  useEffect(() => {
    loadUsersFromStorage();
  }, []);

  const saveUpdatedUsers = (updatedUsers: User[]) => {
    try {
      updatedUsers.forEach(u => {
        // Asynchronously update to Firestore
        saveUserToFirestore(u).catch((err) => {
          console.error("Failed to sync updated user to firestore:", err);
        });
      });
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
                    onClick={() => handleOpenEdit(item)}
                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-extrabold text-[9px] uppercase tracking-widest rounded-lg flex items-center space-x-1 transition-all active:scale-95"
                  >
                    <Icons.Edit size={11} />
                    <span>Edit Details</span>
                  </button>

                  <button 
                    type="button"
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
                    type="button"
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

      {/* EDIT USER ACCOUNT PORTFOLIO MODAL */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 bg-stone-950/70 z-[1000] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 my-8 max-h-[90vh] overflow-y-auto text-slate-800">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Manage Portfolio</span>
                <span className="text-sm font-black text-slate-800 uppercase truncate block max-w-[200px]">{selectedUserForEdit.name}</span>
                <span className="text-[9px] font-mono text-slate-500 truncate block max-w-[200px]">{selectedUserForEdit.email}</span>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedUserForEdit(null)}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
              >
                <Icons.X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4 text-left">
              {/* Account Holder Name */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Full Name</label>
                <input 
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs text-black border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                />
              </div>

              {/* Balances Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Main Balance (₦)</label>
                  <input 
                    type="number"
                    required
                    value={editBalance}
                    onChange={(e) => setEditBalance(Number(e.target.value))}
                    className="w-full text-xs text-black border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">VIP Balance (₦)</label>
                  <input 
                    type="number"
                    required
                    value={editVipBalance}
                    onChange={(e) => setEditVipBalance(Number(e.target.value))}
                    className="w-full text-xs text-black border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                  />
                </div>
              </div>

              {/* Loan Balance */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Loan Balance (₦)</label>
                <input 
                  type="number"
                  required
                  value={editLoanBalance}
                  onChange={(e) => setEditLoanBalance(Number(e.target.value))}
                  className="w-full text-xs text-black border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
                />
              </div>

              {/* Status Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Activation Status</label>
                  <select
                    value={editActivationStatus}
                    onChange={(e) => setEditActivationStatus(e.target.value as any)}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white font-semibold"
                  >
                    <option value="inactive">inactive</option>
                    <option value="pending">pending</option>
                    <option value="active">active</option>
                    <option value="banned">banned</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Activation Plan</label>
                  <select
                    value={editActivationPlan}
                    onChange={(e) => setEditActivationPlan(e.target.value as any)}
                    disabled={editActivationStatus === 'inactive'}
                    className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white disabled:bg-slate-50 disabled:text-slate-400 font-semibold"
                  >
                    <option value="weekly">weekly (N10k)</option>
                    <option value="monthly">monthly (N30k)</option>
                    <option value="yearly">yearly (N100k)</option>
                  </select>
                </div>
              </div>

              {/* Modes & Checkboxes Container */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status & Security Modes</span>
                
                {/* VIP Membership Mode */}
                <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={editIsVIP}
                    onChange={(e) => setEditIsVIP(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block leading-tight">VIP Status Vault</span>
                    <span className="text-[8.5px] text-slate-400 font-medium">Activates VIP interest yields and VIP-specific channels</span>
                  </div>
                </label>

                {/* PMode Status */}
                <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={editIsPMode}
                    onChange={(e) => setEditIsPMode(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block leading-tight">Pay Mode (PMode)</span>
                    <span className="text-[8.5px] text-slate-400 font-medium font-semibold">Controls advanced configurations for custom checkouts</span>
                  </div>
                </label>

                {/* VMode Status */}
                <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={editIsVMode}
                    onChange={(e) => setEditIsVMode(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block leading-tight">Verification Mode (VMode)</span>
                    <span className="text-[8.5px] text-slate-400 font-medium">Enforces system identity and security screening</span>
                  </div>
                </label>

                {/* Imminent Deactivation Warning Check */}
                <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={hasImminentDeactivation}
                    onChange={(e) => setHasImminentDeactivation(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block leading-tight">Force Imminent Activation screen</span>
                    <span className="text-[8.5px] text-slate-400 font-medium">Triggers the mandatory ₦10,000 activation payment requirements</span>
                  </div>
                </label>

                {/* Deactivation Trigger */}
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={hasDeactivation}
                    onChange={(e) => setHasDeactivation(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block leading-tight">Force Complete Account Deactivation</span>
                    <span className="text-[8.5px] text-slate-400 font-medium">Suspends the portfolio, requiring service reactivation checkouts</span>
                  </div>
                </label>
              </div>

              {/* Actions Grid */}
              <div className="flex space-x-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setSelectedUserForEdit(null)}
                  className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-wider rounded-xl transition-colors text-center"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 shadow-md text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center justify-center space-x-1"
                >
                  <Icons.CheckCircle size={12} />
                  <span>Save Portfolio</span>
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
