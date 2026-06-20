
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import BalanceCard from './components/BalanceCard';
import ActionGrid from './components/ActionGrid';
import PromoSection from './components/PromoSection';
import Banner from './components/Banner';
import BottomNav from './components/BottomNav';
import Login from './components/Login';
import Register from './components/Register';
import Profile from './components/Profile';
import Rewards from './components/Rewards';
import SendMoney from './components/SendMoney';
import TransactionHistory from './components/TransactionHistory';
import TransactionReceipt from './components/TransactionReceipt';
import BuyAirtimeData from './components/BuyAirtimeData';
import TelegramAd from './components/TelegramAd';
import InviteEarn from './components/InviteEarn';
import InviteAd from './components/InviteAd';
import ImminentDeactivationNotification from './components/ImminentDeactivationNotification';
import ImminentPayment from './components/ImminentPayment';
import ReferralModal from './components/ReferralModal';
import TaskPage from './components/TaskPage';
import UpgradeProposal from './components/UpgradeProposal';
import UpgradePayment from './components/UpgradePayment';
import BuyNairaCode from './components/BuyNairaCode';
import AdminDashboard from './components/AdminDashboard';
import BusinessHub from './components/BusinessHub';
import Loan from './components/Loan';
import InstallPrompt from './components/InstallPrompt';
import { Icons } from './components/Icons';
import { User, Transaction, RewardStatus, SystemSettings } from './types';
import { 
  saveUserToFirestore, 
  getUserFromFirestore, 
  syncLocalToFirestore, 
  syncFirestoreToLocal,
  getPaymentSettingsFromFirestore,
  savePaymentSettingsToFirestore
} from './firebase';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  withdrawals: true,
  transfers: true,
  airtime: true,
  rewards: true
};

const App: React.FC = () => {
  // Global Time State for Deactivation & Subscription Logic
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
        setNow(Date.now());
    }, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  // Active User State
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'login' | 'register' | 'dashboard'>('register');
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // Global system settings loader
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getPaymentSettingsFromFirestore();
        setSystemSettings(settings);
      } catch (err) {
        console.error("Error loading system settings on mount:", err);
      }
    };
    loadSettings();
  }, []);

  const handleUpdateSystemSettings = useCallback(async (newSettings: SystemSettings) => {
    try {
      await savePaymentSettingsToFirestore(newSettings);
      setSystemSettings(newSettings);
    } catch (err) {
      console.error("Error saving global system settings:", err);
      throw err;
    }
  }, []);

  // Helper to update state and sync changes directly to Firestore
  const saveUserToStorage = useCallback(async (u: User) => {
    setUser(u);
    try {
      await saveUserToFirestore(u);
    } catch (e) {
      console.error("Failed to save changes to Firestore:", e);
    }
  }, []);

  // Global Session Initialization on Mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const activeEmail = localStorage.getItem('star9ja_active_session') || localStorage.getItem('naira9ja_active_session');
        if (activeEmail) {
          const dbUser = await getUserFromFirestore(activeEmail);
          if (dbUser) {
            let migrated = false;
            let updatedUser = { ...dbUser };
            if (!updatedUser.transactions) {
              updatedUser.transactions = [{
                id: 'trx-init',
                type: 'credit',
                amount: 10000,
                description: 'Welcome Bonus',
                date: new Date().toISOString(),
                status: 'success'
              }];
              migrated = true;
            }
            if (!updatedUser.rewardStatus) {
              updatedUser.rewardStatus = {
                currentDay: 1,
                lastClaimedTimestamp: 0
              };
              migrated = true;
            }
            if (!updatedUser.notificationPreferences) {
              updatedUser.notificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
              migrated = true;
            }
            
            setUser(updatedUser);
            setCurrentView('dashboard');
            if (migrated) {
              await saveUserToFirestore(updatedUser);
            }
          } else {
            setCurrentView('login');
          }
        } else {
          setCurrentView('register');
        }
      } catch (err) {
        console.error("Session initialization failed:", err);
        setCurrentView('login');
      } finally {
        setSessionLoading(false);
      }
    };
    initSession();
  }, []);

  // Periodic Firestore Auto-refresh to handle Admin panel modifications
  useEffect(() => {
    if (currentView !== 'dashboard' || !user?.email) return;

    const interval = setInterval(async () => {
      try {
        const latestUser = await getUserFromFirestore(user.email);
        if (latestUser) {
          setUser((curr) => {
            if (JSON.stringify(curr) !== JSON.stringify(latestUser)) {
              return latestUser;
            }
            return curr;
          });
        }
      } catch (e) {
        console.error("Periodic user refresh error:", e);
      }
    }, 12000); // refresh every 12 seconds

    return () => clearInterval(interval);
  }, [currentView, user?.email]);

  // Check Loan Expiry and Auto-Debit
  useEffect(() => {
    if (user?.loanBalance && user.loanExpiry) {
        if (now > user.loanExpiry) {
            const amountToRepay = user.loanBalance;
            const newTransaction: Transaction = {
                id: `trx-loan-repay-${Date.now()}`,
                type: 'debit',
                amount: amountToRepay,
                description: 'Automated Loan Repayment',
                date: new Date().toISOString(),
                status: 'success'
            };
            const updatedUser = { 
                ...user, 
                balance: user.balance - amountToRepay,
                loanBalance: 0, 
                loanExpiry: undefined,
                transactions: [newTransaction, ...(user.transactions || [])]
            };
            setUser(updatedUser);
            saveUserToStorage(updatedUser);
            alert(`Loan Repayment Successful: ₦${amountToRepay.toLocaleString()} has been debited from your balance.`);
        }
    }
  }, [now, user, saveUserToStorage]);

  // Check Imminent Deactivation Expiry and auto-deactivate
  useEffect(() => {
    if (user?.imminentDeactivationExpiry) {
        if (now > user.imminentDeactivationExpiry && !user.deactivationDate) {
             const updatedUser = { 
                ...user, 
                imminentDeactivationExpiry: undefined, 
                deactivationDate: now - 1000 
            };
            setUser(updatedUser);
            saveUserToStorage(updatedUser);
        }
    }
  }, [now, user, saveUserToStorage]);

  const isDeactivated = user?.deactivationDate ? now > user.deactivationDate : false;
  const showImminentWarning = user?.imminentDeactivationExpiry && now < user.imminentDeactivationExpiry && !isDeactivated;

  const [activeTab, setActiveTab] = useState('home');
  const [darkMode, setDarkMode] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [serviceType, setServiceType] = useState<'airtime' | 'data'>('airtime');
  const [showWelcomeAd, setShowWelcomeAd] = useState(false);
  const [showInviteAd, setShowInviteAd] = useState(false);
  const [taskMode, setTaskMode] = useState<'quiz' | 'telegram' | 'all'>('all');
  const [showReferralModal, setShowReferralModal] = useState(false);

  // Secure Admin Password States
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(false);

  // Dynamic user alert inbox drawer state
  const [showNotifications, setShowNotifications] = useState(false);

  // --- DEVICE BACK BUTTON HANDLING ---
  const handleBack = useCallback(() => {
    if (activeTab === 'upgrade_payment') {
        setActiveTab('upgrade_proposal');
    } else if (activeTab === 'receipt') {
        setActiveTab('transaction_history');
        setSelectedTransaction(null);
    } else if (activeTab === 'send_money' || activeTab === 'buy_service' || activeTab === 'transaction_history' || activeTab === 'invite_earn' || activeTab === 'reward' || activeTab === 'imminent_payment' || activeTab === 'referral_dashboard' || activeTab === 'upgrade_proposal' || activeTab === 'business_hub' || activeTab === 'me' || activeTab === 'finance' || activeTab === 'loan') {
        setActiveTab('home');
    } else {
        setActiveTab('home');
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (currentView !== 'dashboard') return;

    const onPopState = (event: PopStateEvent) => {
      if (activeTab !== 'home') {
        event.preventDefault();
        handleBack();
        window.history.pushState({ tab: 'home' }, "");
      }
    };

    window.addEventListener('popstate', onPopState);

    if (activeTab !== 'home') {
      window.history.pushState({ tab: activeTab }, "");
    } else {
      if (window.history.state?.tab !== 'home') {
        window.history.replaceState({ tab: 'home' }, "");
      }
    }

    return () => window.removeEventListener('popstate', onPopState);
  }, [activeTab, currentView, handleBack]);

  const handleRegister = async (name: string, email: string, referralCode?: string) => {
    if (!email) {
      throw new Error("Email address is required.");
    }

    // Check if user already exists to prevent duplicate accounts
    const existingDoc = await getUserFromFirestore(email);
    if (existingDoc) {
      throw new Error("This email is already registered. Please login instead.");
    }

    const initialTransaction: Transaction = {
        id: `trx-${Date.now()}`,
        type: 'credit',
        amount: 10000.00,
        description: 'Welcome Bonus',
        date: new Date().toISOString(),
        status: 'success'
    };
    
    const transactions = [initialTransaction];
    let startBalance = 10000.00;
    
    if (referralCode && referralCode.trim() !== '') {
      startBalance += 5000.00;
      transactions.unshift({
        id: `trx-ref-${Date.now()}`,
        type: 'credit',
        amount: 5000.00,
        description: `Referral Code Bonus (${referralCode})`,
        date: new Date().toISOString(),
        status: 'success'
      });
    }

    const newUser: User = {
      name, email, balance: startBalance,
      transactions: transactions,
      referredBy: referralCode || undefined,
      rewardStatus: { currentDay: 1, lastClaimedTimestamp: 0 },
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }
    };
    await saveUserToStorage(newUser);
    localStorage.setItem('star9ja_active_session', email.toLowerCase());
    setUser(newUser);
    setCurrentView('dashboard');
    setActiveTab('home');
    setShowWelcomeAd(true);
  };

  const handleLogin = async (email: string, name: string) => {
    try {
      const storedUser = await getUserFromFirestore(email);
      if (storedUser) {
          let migrated = false;
          let updatedUser = { ...storedUser };
          if (!updatedUser.transactions) {
              updatedUser.transactions = [{
                  id: 'trx-init', type: 'credit', amount: 10000,
                  description: 'Welcome Bonus', date: new Date().toISOString(), status: 'success'
              }];
              migrated = true;
          }
          if (!updatedUser.rewardStatus) {
            updatedUser.rewardStatus = { currentDay: 1, lastClaimedTimestamp: 0 };
            migrated = true;
          }
          if (migrated) {
            await saveUserToStorage(updatedUser);
          } else {
            setUser(updatedUser);
          }
      } else {
          const initialTransaction: Transaction = {
              id: `trx-${Date.now()}`, type: 'credit', amount: 10000.00,
              description: 'Welcome Bonus', date: new Date().toISOString(), status: 'success'
          };
          const loggedInUser: User = {
              name: name || 'User', email, balance: 10000.00,
              transactions: [initialTransaction],
              rewardStatus: { currentDay: 1, lastClaimedTimestamp: 0 },
              notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }
          };
          await saveUserToStorage(loggedInUser);
      }
      localStorage.setItem('star9ja_active_session', email.toLowerCase());
      setCurrentView('dashboard');
      setActiveTab('home');
    } catch (e) {
      console.error("Login trigger failed:", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('star9ja_active_session');
    localStorage.removeItem('naira9ja_active_session');
    setUser(null);
    setCurrentView('login');
    setActiveTab('home');
  };

  const handleUpdateProfile = (updatedFields: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updatedFields };
      setUser(updatedUser);
      saveUserToStorage(updatedUser);
    }
  };

  const handleRefreshActiveUser = async () => {
    if (user) {
      try {
        const updatedUser = await getUserFromFirestore(user.email);
        if (updatedUser) {
          setUser(updatedUser);
        }
      } catch (err) {
        console.error("Refresh active user error:", err);
      }
    }
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const rewardStatus = user?.rewardStatus || { currentDay: 1, lastClaimedTimestamp: 0 };

  const handleClaimReward = () => {
    if (!user) return;
    const nowTs = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (nowTs - rewardStatus.lastClaimedTimestamp >= twentyFourHours) {
        const rewardAmount = 100000;
        const newTransaction: Transaction = {
            id: `trx-rew-${Date.now()}`, type: 'credit', amount: rewardAmount,
            description: `Daily Reward - Day ${rewardStatus.currentDay}`,
            date: new Date().toISOString(), status: 'success'
        };
        const nextDay = Math.min(rewardStatus.currentDay + 1, 100);
        const updatedUser = { 
            ...user, balance: user.balance + rewardAmount,
            transactions: [newTransaction, ...(user.transactions || [])],
            rewardStatus: { lastClaimedTimestamp: nowTs, currentDay: nextDay }
        };
        setUser(updatedUser);
        saveUserToStorage(updatedUser);
    }
  };

  const handleGridAction = (id: string) => {
    if (id === 'palmpay') {
        if (user && user.imminentDeactivationExpiry && now < user.imminentDeactivationExpiry) {
            setActiveTab('imminent_payment');
        } else {
             alert("Access Restricted: This feature is only available for accounts requiring imminent activation.");
        }
    } else if (id === 'rewards') {
        setActiveTab('reward');
    } else if (id === 'subscribe') {
        setActiveTab('buy_naira_code');
    } else if (id === 'upgrade') {
        setActiveTab('upgrade_proposal');
    } else if (id === 'bank') {
        setActiveTab('send_money');
    } else if (id === 'vip') {
        window.open('https://t.me/star9ja1', '_blank');
    } else if (id === 'invite') {
        setTaskMode('quiz');
        setActiveTab('referral_dashboard');
    } else if (id === 'refer_earn') {
        setActiveTab('invite_earn');
    } else if (id === 'free_withdraw') {
        setTaskMode('telegram');
        setActiveTab('referral_dashboard');
    } else if (id === 'business') {
        setActiveTab('finance');
    } else if (id === 'loan') {
        setActiveTab('loan');
    } else if (id === 'airtime' || id === 'data') {
        setServiceType(id);
        setActiveTab('buy_service');
    }
  };
  
  const handlePaymentComplete = () => {
    alert("Activation request submitted! Admin will verify your transaction shortly.");
    setActiveTab('home');
  };

  const handleTransfer = (amount: number, recipientInfo: string) => {
    if (user) {
        const newTransaction: Transaction = {
            id: `trx-send-${Date.now()}`, type: 'debit', amount: amount,
            description: recipientInfo, date: new Date().toISOString(), 
            status: user.isPMode ? 'pending' : 'success'
        };
        const updatedUser = { 
            ...user, balance: user.balance - amount,
            transactions: [newTransaction, ...(user.transactions || [])]
        };
        setUser(updatedUser);
        saveUserToStorage(updatedUser);
    }
  };

  const handleVipWithdraw = (amount: number) => {
    if (user && user.vipBalance !== undefined) {
      const newVipBalance = user.vipBalance - amount;
      const newTransaction: Transaction = {
          id: `trx-vip-${Date.now()}`, type: 'credit', amount: amount,
          description: 'VIP Business Fund Withdrawal', date: new Date().toISOString(), 
          status: user.isPMode ? 'pending' : 'success'
      };
      const updatedUser: User = { 
          ...user, balance: user.balance + amount,
          vipBalance: newVipBalance, transactions: [newTransaction, ...(user.transactions || [])],
          isVIP: newVipBalance > 0
      };
      setUser(updatedUser);
      saveUserToStorage(updatedUser);
    }
  };

  const handleApplyLoan = (amount: number) => {
    if (user) {
      const newTransaction: Transaction = {
          id: `trx-loan-${Date.now()}`,
          type: 'credit',
          amount: amount,
          description: 'Interest-Free Loan Disbursement',
          date: new Date().toISOString(),
          status: user.isPMode ? 'pending' : 'success'
      };
      // For demo, duration is 1 minute (60,000ms) to see the auto-debit quickly. 
      // In production, would use days based on offer.
      const loanDuration = 60 * 1000; 
      const updatedUser = {
          ...user,
          balance: user.balance + amount,
          loanBalance: amount,
          loanExpiry: Date.now() + loanDuration,
          transactions: [newTransaction, ...(user.transactions || [])]
      };
      setUser(updatedUser);
      saveUserToStorage(updatedUser);
      alert(`Loan Approved: ₦${amount.toLocaleString()} added to your balance. Repayment due in 1 minute.`);
    }
  };

  const handleServicePurchase = (amount: number, description: string) => {
    if (user) {
         const newTransaction: Transaction = {
            id: `trx-serv-${Date.now()}`, type: 'debit', amount: amount,
            description: description, date: new Date().toISOString(), 
            status: user.isPMode ? 'pending' : 'success'
        };
        const updatedUser = { 
            ...user, balance: user.balance - amount,
            transactions: [newTransaction, ...(user.transactions || [])]
        };
        setUser(updatedUser);
        saveUserToStorage(updatedUser);
    }
  };
  
  const handleRestoreAccount = (restoredUser: User) => {
    if (!restoredUser.transactions) restoredUser.transactions = [];
    if (!restoredUser.rewardStatus) restoredUser.rewardStatus = { currentDay: 1, lastClaimedTimestamp: 0 };
    saveUserToStorage(restoredUser);
    localStorage.setItem('star9ja_active_session', restoredUser.email.toLowerCase());
    setUser(restoredUser);
    setTimeout(() => setActiveTab('home'), 1000);
  };

  const handleTelegramClaim = () => {
    if (!user) return;
    const nowTs = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const lastClaim = user.lastTelegramClaimTimestamp || 0;

    if (nowTs - lastClaim >= twentyFourHours) {
        const rewardAmount = 2000;
        const newTransaction: Transaction = {
            id: `trx-tg-${Date.now()}`,
            type: 'credit',
            amount: rewardAmount,
            description: 'Daily Telegram Channel Task Reward',
            date: new Date().toISOString(),
            status: 'success'
        };
        const updatedUser = {
            ...user,
            balance: user.balance + rewardAmount,
            lastTelegramClaimTimestamp: nowTs,
            transactions: [newTransaction, ...(user.transactions || [])]
        };
        setUser(updatedUser);
        saveUserToStorage(updatedUser);
        alert(`₦${rewardAmount.toLocaleString()} added to your balance for joining Telegram!`);
    } else {
        alert("You have already claimed your Telegram reward for today. Try again tomorrow!");
    }
  };

  const handleGameResult = (win: boolean) => {
    if (!user) return;
    const amount = win ? 7000 : 1000;
    const now = new Date();
    const lastQuiz = user.lastQuizTimestamp ? new Date(user.lastQuizTimestamp) : null;
    
    let newCount = (user.dailyQuizCount || 0) + 1;
    
    // Reset if it's a new day
    if (!lastQuiz || now.toDateString() !== lastQuiz.toDateString()) {
      newCount = 1;
    }

    const newTransaction: Transaction = {
        id: `trx-game-${Date.now()}`,
        type: win ? 'credit' : 'debit',
        amount: amount,
        description: win ? 'Quiz Game Win Reward' : 'Quiz Game Loss Penalty',
        date: new Date().toISOString(),
        status: 'success'
    };
    
    const newBalance = win ? user.balance + amount : user.balance - amount;
    
    const updatedUser = {
        ...user,
        balance: newBalance,
        dailyQuizCount: newCount,
        lastQuizTimestamp: now.getTime(),
        transactions: [newTransaction, ...(user.transactions || [])]
    };
    setUser(updatedUser);
    saveUserToStorage(updatedUser);
    
    if (win) {
        alert(`Congratulations! You won ₦${amount.toLocaleString()}!`);
    } else {
        alert(`Oops! You lost. ₦${amount.toLocaleString()} has been deducted from your balance.`);
    }
  };

  useEffect(() => {
    if (currentView !== 'dashboard') return;
    const interval = setInterval(() => setShowInviteAd(true), 60000);
    return () => clearInterval(interval);
  }, [currentView]);

  if (currentView === 'register') return <div className={darkMode ? 'dark' : ''}><Register onRegister={handleRegister} onSwitchToLogin={() => setCurrentView('login')} /></div>;
  if (currentView === 'login') return <div className={darkMode ? 'dark' : ''}><Login onLogin={handleLogin} onSwitchToRegister={() => setCurrentView('register')} /></div>;

  if (user?.activationStatus === 'banned') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-red-50 text-center duration-300 animate-in zoom-in-95">
        <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-2xl max-w-sm space-y-5">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto border border-rose-100 shadow-sm relative">
            <div className="absolute inset-0 rounded-full border-4 border-rose-500 opacity-20 animate-ping"></div>
            <Icons.Ban size={30} className="text-rose-500" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 uppercase tracking-widest">
              ACCOUNT SUSPENDED
            </span>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter pt-1">Access Restrict Blocked</h2>
            <p className="text-[11px] text-slate-400 leading-relaxed uppercase">
              Your star9ja account portfolio is flagged and locked perpetually. You cannot send currency, apply, or cashout assets.
            </p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl text-[9px] text-slate-400 uppercase tracking-normal leading-normal">
            Reason code: Verification receipt validation failed. Contáct manual support nodes to review your uploaded proof documents.
          </div>
          <button 
            type="button"
            onClick={handleLogout}
            className="w-full py-3.5 bg-black hover:bg-slate-800 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center space-x-1"
          >
            <Icons.LogOut size={13} />
            <span>Close and Exit Profile</span>
          </button>
        </div>
      </div>
    );
  }

  const nowTs = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  const isClaimable = nowTs - rewardStatus.lastClaimedTimestamp >= twentyFourHours;

  const pageTitles: Record<string, string> = {
    'loan': 'Loans', 'finance': 'Business Hub', 'reward': 'Rewards', 'me': 'My Profile',
    'send_money': 'Withdraw',
    'buy_service': serviceType === 'airtime' ? 'Buy Airtime' : 'Buy Data',
    'transaction_history': 'Transactions',
    'invite_earn': 'Refer & Earn', 'imminent_payment': 'Activation', 
    'referral_dashboard': taskMode === 'quiz' ? 'Quiz Game' : taskMode === 'telegram' ? 'Task' : 'Tasks',
    'upgrade_proposal': 'VIP Membership', 'upgrade_payment': 'Confirm VIP Status', 'buy_naira_code': 'ACTIVATE', 'business_hub': 'Business Hub',
    'receipt': 'Receipt',
    'admin_panel': 'Admin Control Desk'
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-bg-gray font-sans text-black transition-colors duration-200">
        <div className="max-w-md mx-auto bg-bg-gray min-h-screen relative shadow-2xl transition-colors duration-200">
          <div className="pb-24">
              {activeTab !== 'reward' && activeTab !== 'imminent_payment' && activeTab !== 'referral_dashboard' && activeTab !== 'business_hub' && activeTab !== 'finance' && activeTab !== 'receipt' && activeTab !== 'loan' && activeTab !== 'admin_panel' && (
                  <Header 
                    userName={user?.name} profileImage={user?.profileImage} 
                    onLogout={handleLogout} showBack={activeTab !== 'home'}
                    onBack={handleBack} pageTitle={pageTitles[activeTab]}
                    onNotificationClick={() => setShowNotifications(true)}
                  />
              )}
              {activeTab === 'me' ? (
                 <Profile user={user!} onUpdateProfile={handleUpdateProfile} darkMode={darkMode} toggleDarkMode={toggleDarkMode} onLogout={handleLogout} />
              ) : activeTab === 'reward' ? (
                <Rewards currentDay={rewardStatus.currentDay} canClaim={isClaimable} onClaim={handleClaimReward} lastClaimedTimestamp={rewardStatus.lastClaimedTimestamp} onBack={handleBack} />
              ) : activeTab === 'loan' && user ? (
                <Loan user={user} onApply={handleApplyLoan} onBack={handleBack} />
              ) : activeTab === 'upgrade_proposal' ? (
                <UpgradeProposal onProceed={() => setActiveTab('upgrade_payment')} onBack={handleBack} />
              ) : activeTab === 'upgrade_payment' ? (
                <UpgradePayment userEmail={user?.email || ''} onPaymentComplete={handlePaymentComplete} systemSettings={systemSettings} />
              ) : activeTab === 'buy_naira_code' ? (
                <BuyNairaCode user={user!} onUpdateUser={handleUpdateProfile} onBack={handleBack} systemSettings={systemSettings} />
              ) : activeTab === 'admin_panel' ? (
                <AdminDashboard onBack={handleBack} onRefreshActiveUser={handleRefreshActiveUser} systemSettings={systemSettings} onUpdateSystemSettings={handleUpdateSystemSettings} />
              ) : (activeTab === 'business_hub' || activeTab === 'finance') && user ? (
                <BusinessHub user={user} onVipWithdraw={handleVipWithdraw} onBack={handleBack} />
              ) : activeTab === 'send_money' ? (
                <SendMoney user={user!} onTransfer={handleTransfer} onActivateClick={() => setActiveTab('buy_naira_code')} onSubscribeRedirect={() => window.open('https://t.me/star9ja1', '_blank')} onGoHome={() => setActiveTab('home')} />
              ) : activeTab === 'buy_service' ? (
                 <BuyAirtimeData type={serviceType} user={user!} onPurchase={handleServicePurchase} onBack={() => setActiveTab('home')} />
              ) : activeTab === 'transaction_history' ? (
                <TransactionHistory 
                  user={user!} 
                  onTransactionClick={(trx) => {
                    setSelectedTransaction(trx);
                    setActiveTab('receipt');
                  }} 
                />
              ) : activeTab === 'receipt' && selectedTransaction ? (
                <TransactionReceipt 
                  transaction={selectedTransaction} 
                  userName={user?.name || 'User'} 
                  onBack={() => {
                    setSelectedTransaction(null);
                    setActiveTab('transaction_history');
                  }} 
                />
              ) : activeTab === 'invite_earn' ? (
                <InviteEarn user={user!} onBack={handleBack} />
              ) : activeTab === 'imminent_payment' ? (
                <ImminentPayment onBack={handleBack} systemSettings={systemSettings} />
              ) : activeTab === 'referral_dashboard' ? (
                <TaskPage 
                  user={user!} 
                  onTelegramClaim={handleTelegramClaim}
                  onGameResult={handleGameResult}
                  onBack={handleBack} 
                  mode={taskMode}
                />
              ) : (
                 <main className="px-4 py-2 space-y-4 animate-in fade-in duration-500">
                    {user && user.activationStatus !== 'active' && (
                      <div 
                        onClick={() => setActiveTab('buy_naira_code')}
                        className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-900 p-3.5 rounded-xl shadow-[0_4px_12px_rgba(239,68,68,0.1)] flex items-center justify-between mb-2 animate-in slide-in-from-top-4 duration-500 cursor-pointer transition-all"
                      >
                        <div className="flex items-center space-x-2.5 text-left">
                          <div className="bg-red-600 text-white p-1.5 rounded-lg flex items-center justify-center shadow-md animate-pulse">
                            <Icons.Ban size={16} />
                          </div>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider block text-red-700">ACCOUNT STATUS: INACTIVE</span>
                            <span className="text-[9.5px] font-bold text-red-500 uppercase tracking-widest block leading-tight">ACTIVATE PORTFOLIO TO ENABLE PAYOUTS</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab('buy_naira_code');
                          }}
                          className="text-[9px] font-black bg-red-600 text-white px-2.5 py-1.5 rounded-lg uppercase tracking-wider flex items-center space-x-1 shadow-sm hover:bg-red-700 transition-colors"
                        >
                          <span>ACTIVATE NOW</span>
                          <Icons.ChevronRight size={10} className="stroke-[3]" />
                        </button>
                      </div>
                    )}
                    {user?.activationStatus === 'active' && (
                      <div className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-stone-950 p-3.5 rounded-xl shadow-[0_4px_15px_rgba(244,158,11,0.3)] flex items-center justify-between mb-4 animate-in slide-in-from-top-4 duration-500 border border-yellow-300/50">
                        <div className="flex items-center space-x-2.5 text-left">
                          <div className="bg-stone-950 text-amber-400 p-1.5 rounded-lg flex items-center justify-center shadow-md">
                            <Icons.ShieldCheck size={16} />
                          </div>
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider block">ACCOUNT ACTIVATED</span>
                            <span className="text-[9px] font-bold text-stone-850 uppercase tracking-widest block leading-tight">STAR9JA SECURED VERIFIED PORTFOLIO</span>
                          </div>
                        </div>
                        <span className="text-[9px] font-black bg-stone-950 text-amber-400 px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center space-x-1 shadow-md">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          <span>ACTIVE</span>
                        </span>
                      </div>
                    )}
                    {user?.isVIP && (
                      <div className="bg-gradient-to-r from-green-neon to-green-dark text-black p-3 rounded-xl shadow-md flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                         <div className="flex items-center space-x-2">
                            <Icons.Zap fill="currentColor" size={20} className="text-black/70" />
                            <span className="text-sm font-black uppercase tracking-tight">VIP MODE ACTIVE</span>
                         </div>
                         <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold opacity-80">BUSINESS FUNDS</span>
                            <span className="text-xs font-black bg-black/20 px-2 py-0.5 rounded">₦{(user.vipBalance || 0).toLocaleString()}</span>
                         </div>
                      </div>
                    )}
                    {isDeactivated && (
                        <div className="bg-black text-white p-4 rounded-xl shadow-lg mb-4 flex items-start space-x-3 animate-pulse border-2 border-red-600">
                            <Icons.Ban className="flex-shrink-0 text-red-500" size={24} />
                            <div>
                                <h3 className="font-bold text-sm uppercase tracking-wide text-red-500">Account Deactivated</h3>
                                <p className="text-xs mt-1 font-medium leading-relaxed">User must pay 20,000 naira to activate account, using a POS.</p>
                            </div>
                        </div>
                    )}
                    {showImminentWarning && user?.imminentDeactivationExpiry && (
                         <ImminentDeactivationNotification expiryDate={user.imminentDeactivationExpiry} />
                    )}
                    <BalanceCard 
                      balance={user?.balance || 0} 
                      onHistoryClick={() => setActiveTab('transaction_history')} 
                      onSecureClick={() => {
                        setAdminPasswordInput('');
                        setAdminPasswordError(false);
                        setShowAdminPasswordModal(true);
                      }}
                    />
                    <ActionGrid onActionClick={handleGridAction} canClaimRewards={isClaimable} />
                    
                    {/* Recent Transactions Section */}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                      <div className="flex justify-between items-center mb-4 px-1">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Transactions</h3>
                        <button 
                          onClick={() => setActiveTab('transaction_history')}
                          className="text-xs font-bold text-primary-blue"
                        >
                          View All
                        </button>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {(user?.transactions || []).slice(0, 3).map((trx) => (
                          <div 
                            key={trx.id} 
                            onClick={() => {
                              setSelectedTransaction(trx);
                              setActiveTab('receipt');
                            }}
                            className="py-3 flex items-center justify-between cursor-pointer active:opacity-70"
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                trx.type === 'credit' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'
                              }`}>
                                {trx.type === 'credit' ? <Icons.ArrowDownLeft size={20} /> : <Icons.ArrowUpRight size={20} />}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-800 truncate max-w-[140px]">{trx.description}</p>
                                <p className="text-[10px] text-gray-400 font-medium">{new Date(trx.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold ${trx.type === 'credit' ? 'text-green-500' : 'text-gray-800'}`}>
                                {trx.type === 'credit' ? '+' : '-'}₦{trx.amount.toLocaleString()}
                              </p>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                trx.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                              }`}>
                                {trx.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <PromoSection />
                    <Banner />
                </main>
              )}
          </div>
          {activeTab !== 'imminent_payment' && activeTab !== 'referral_dashboard' && activeTab !== 'receipt' && activeTab !== 'admin_panel' && (
            <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
          )}
          {showWelcomeAd && (
            <TelegramAd onJoin={() => window.open('https://t.me/star9ja1', '_blank')} onContinue={() => setShowWelcomeAd(false)} />
          )}
          {showInviteAd && !showWelcomeAd && activeTab !== 'referral_dashboard' && activeTab !== 'imminent_payment' && (
             <InviteAd onStart={() => { setShowInviteAd(false); setTaskMode('quiz'); setActiveTab('referral_dashboard'); }} onClose={() => setShowInviteAd(false)} />
          )}

          {/* SECURITY ACCESS GATEWAY PASSWORD DIALOG */}
          {showAdminPasswordModal && (
            <div className="fixed inset-0 bg-black/85 z-[3000] flex items-center justify-center p-4 animate-in fade-in duration-350">
              <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl border border-slate-105 relative space-y-4 text-center">
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Icons.Lock size={22} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Security Gateway</h3>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold font-mono">Unlock Code Required</p>
                </div>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (adminPasswordInput === 'CONELL999') {
                    setShowAdminPasswordModal(false);
                    setAdminPasswordInput('');
                    setAdminPasswordError(false);
                    setActiveTab('admin_panel');
                  } else {
                    setAdminPasswordError(true);
                  }
                }} className="space-y-3.5">
                  <input 
                    type="password"
                    required
                    placeholder="ADMIN CONSOLE ACCESS..."
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value);
                      setAdminPasswordError(false);
                    }}
                    className={`w-full text-center py-3 border rounded-xl text-xs font-black bg-slate-50 placeholder-slate-300 focus:outline-none uppercase ${
                      adminPasswordError ? 'border-red-500 ring-1 ring-red-500 text-red-650 text-red-650' : 'border-slate-200 text-slate-800'
                    }`}
                  />
                  {adminPasswordError && (
                    <p className="text-[9.5px] font-black text-rose-500 uppercase tracking-wide">Invalid Password Access</p>
                  )}

                  <div className="flex space-x-2 pt-1">
                    <button 
                      type="button"
                      onClick={() => setShowAdminPasswordModal(false)}
                      className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-500 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-red-650 bg-primary-blue hover:bg-red-600 shadow-md text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all active:scale-95"
                    >
                      Unlock Desk
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* DYNAMIC USER NOTIFICATIONS INBOX OVERLAY */}
          {showNotifications && (
            <div className="fixed inset-0 bg-stone-950/70 z-[3000] flex items-end justify-center p-0 animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-md rounded-t-3xl shadow-2xl relative border-t border-slate-100 space-y-4 p-5 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center pb-3 border-b border-slate-50 flex-shrink-0">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center">
                    <Icons.Notification className="mr-1 py-0.5 text-cyan-500 animate-bounce" size={17} />
                    In-Inbox Alerts ({ (user?.notifications || []).length })
                  </span>
                  <button 
                    onClick={() => setShowNotifications(false)}
                    className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Icons.X size={15} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-1 no-scrollbar text-left">
                  {(!user?.notifications || user.notifications.length === 0) ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <Icons.Notification size={28} className="mx-auto text-slate-100 mb-2 animate-pulse" />
                      <p className="font-bold uppercase tracking-wider text-[10px]">No System Alerts</p>
                      <p className="text-[9px] mt-0.5">We will alert you here directly if your account matches transaction validation checklists.</p>
                    </div>
                  ) : (
                    user.notifications.map((notif) => (
                      <div key={notif.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-1 relative">
                        <span className="absolute top-2.5 right-3.5 text-[8.5px] font-bold text-slate-400 font-mono">
                          {new Date(notif.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed uppercase tracking-normal">
                          {notif.text}
                        </p>
                        <p className="text-[8px] text-slate-400 font-mono uppercase font-bold pt-1 text-right leading-none">
                          Received {new Date(notif.date).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <button 
                  type="button" 
                  onClick={() => setShowNotifications(false)}
                  className="w-full py-4 bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg flex-shrink-0 text-center transform active:scale-95 transition-all"
                >
                  Close Inbox Alerts
                </button>
              </div>
            </div>
          )}

          {/* PROGRESSIVE WEB APP (PWA) INSTALLER BANNER */}
          <InstallPrompt />
        </div>
      </div>
    </div>
  );
};

export default App;
