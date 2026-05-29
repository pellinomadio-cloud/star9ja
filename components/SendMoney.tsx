import React, { useState } from 'react';
import { Icons } from './Icons';
import { User } from '../types';

interface SendMoneyProps {
  user: User;
  onTransfer: (amount: number, recipientInfo: string) => void;
  onSubscribeRedirect: () => void;
  onGoHome: () => void;
  onActivateClick?: () => void;
}

const banks = [
  "OPAY",
  "PALMPAY",
  "KUDA",
  "MONIEPOINT",
  "Access Bank",
  "GTBank",
  "Zenith Bank",
  "UBA",
  "First Bank",
  "Fidelity Bank",
  "Union Bank",
  "FCMB",
  "Sterling Bank"
];

const SendMoney: React.FC<SendMoneyProps> = ({ user, onTransfer, onSubscribeRedirect, onGoHome, onActivateClick }) => {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [bank, setBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate deactivation state dynamically
  const isDeactivated = user.deactivationDate && Date.now() > user.deactivationDate;

  const handleAccountNumberBlur = () => {
    // No longer auto-filling name as per request guidelines
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isDeactivated) {
        setError("Account is deactivated");
        return;
    }

    if (!accountName) {
        setError("Please enter the Account Name");
        return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
        setError("Please enter a valid amount");
        return;
    }

    if (transferAmount > user.balance) {
        setError("Insufficient funds");
        return;
    }

    setIsLoading(true);

    // Simulate API transfer call
    setTimeout(() => {
        onTransfer(transferAmount, `Withdrawal to ${bank} - ${accountName}`);
        setIsLoading(false);
        setStep('success');
    }, 1500);
  };

  // If the account's activationStatus is not active, display the locked state screen redirecting to activation
  if (user?.activationStatus !== 'active') {
    return (
      <div className="px-4 py-12 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95 duration-500 max-w-sm mx-auto">
        <div className="relative">
          <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto shadow-md relative z-10">
            <Icons.Ban size={36} className="text-red-500 animate-pulse" />
          </div>
          {/* Animated decorative ring */}
          <div className="absolute inset-0 rounded-full border border-red-500/20 animate-ping opacity-30 scale-110"></div>
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-800 uppercase tracking-widest border border-red-200">
            WITHDRAWAL LOCKED
          </span>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight pt-1">Account Activation Required</h2>
          <p className="text-xs text-slate-400 leading-relaxed uppercase tracking-normal">
            Your star9ja withdrawal route is currently suspended.<br />
            To secure instant payouts, loans approval, and registered transactions, please activate your account portfolio.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl w-full border border-slate-100 space-y-1 text-left">
          <p className="text-[10px] text-slate-400 font-extrabold uppercase">Activation Privileges:</p>
          <ul className="text-[10.5px] text-slate-500 font-medium space-y-1">
            <li className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce"></span>
              <span>Enable direct bank withdrawals instantly</span>
            </li>
            <li className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              <span>Daily cash withdraw limits up to ₦150k</span>
            </li>
            <li className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              <span>VIP Priority manual verification nodes</span>
            </li>
          </ul>
        </div>

        <div className="w-full space-y-3 pt-2">
          <button 
            type="button"
            onClick={onActivateClick}
            className="w-full py-4.5 bg-black hover:bg-slate-800 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-xl transform active:scale-95 transition-all flex items-center justify-center space-x-1.5"
          >
            <Icons.ShieldCheck size={15} />
            <span>ACTIVATE ACCOUNT PORTFOLIO</span>
          </button>
          
          <button 
            type="button"
            onClick={onGoHome}
            className="w-full py-3.5 bg-white border border-slate-100 hover:bg-slate-50 text-slate-500 font-bold rounded-xl text-xs uppercase tracking-widest transform active:scale-95 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (isDeactivated) {
    return (
        <div className="px-4 py-10 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-300">
           <div className="w-24 h-24 bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <Icons.Ban size={48} className="text-red-400" />
          </div>
          <div>
              <h2 className="text-2xl font-bold text-white mb-2">Withdrawal Restricted</h2>
              <div className="bg-red-900/20 p-4 rounded-xl border border-red-800">
                 <p className="text-red-300 font-bold text-sm leading-relaxed">
                     User must pay 20,000 naira to activate account, using a POS.
                 </p>
              </div>
          </div>
          <button 
              onClick={onGoHome}
              className="w-full max-w-sm bg-gray-800 text-white font-bold py-3 rounded-full transition-all"
          >
              Back to Dashboard
          </button>
        </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="px-4 py-8 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-300">
         <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-4 relative border border-green-200">
            <div className="absolute inset-0 rounded-full border-4 border-green-500 opacity-20 animate-ping"></div>
            <Icons.Check size={48} className="text-green-500" />
        </div>
        <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Withdrawal Successful!</h2>
            <p className="text-gray-500 text-sm">
                You successfully withdrew <span className="font-bold text-slate-800">₦{parseFloat(amount).toLocaleString()}</span> to {accountName}.
            </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl w-full max-w-sm border border-slate-100">
            <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-xs text-gray-500">Bank</span>
                <span className="text-sm font-bold text-slate-800">{bank}</span>
            </div>
             <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-xs text-gray-500">Account</span>
                <span className="text-sm font-bold text-slate-800">{accountNumber}</span>
            </div>
            <div className="flex justify-between py-2">
                <span className="text-xs text-gray-500">Transaction ID</span>
                <span className="text-xs font-mono text-slate-700">TRX-{Math.floor(Math.random() * 100000000)}</span>
            </div>
        </div>
        <button 
            onClick={onGoHome}
            className="w-full max-w-sm bg-black text-white font-bold py-3 rounded-full shadow-md transition-all"
        >
            Done
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-sm mx-auto text-left">
      <div className="text-center">
         <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Withdraw to Bank</h2>
         <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">Direct Vault Cashout Route</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
             <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg text-center border border-red-100 font-bold uppercase tracking-wider animate-pulse">
                {error}
              </div>
        )}

        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Bank</label>
            <div className="relative">
                <select
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    required
                    className="w-full p-3.5 bg-slate-50 border border-slate-150 rounded-xl appearance-none text-slate-800 font-bold focus:ring-2 focus:ring-black outline-none text-xs"
                >
                    <option value="" disabled>Choose a bank</option>
                    {banks.map(b => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>
                <Icons.ChevronRight className="absolute right-3.5 top-4 text-slate-500 rotate-90" size={17} />
            </div>
        </div>

        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Account Number</label>
            <input
                type="number"
                value={accountNumber}
                onChange={(e) => {
                    if (e.target.value.length <= 10) setAccountNumber(e.target.value);
                }}
                onBlur={handleAccountNumberBlur}
                placeholder="0123456789"
                required
                className="w-full p-3.5 bg-slate-50 border border-slate-150 rounded-xl text-slate-850 placeholder-slate-350 focus:ring-2 focus:ring-black outline-none font-mono text-base tracking-widest font-black"
            />
        </div>

        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Account Name</label>
            <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Receiver Name"
                required
                className="w-full p-3.5 bg-slate-50 border border-slate-150 rounded-xl text-slate-800 font-bold text-xs focus:ring-2 focus:ring-black outline-none"
            />
        </div>

        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Amount</label>
            <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-slate-400 font-black text-xs">₦</span>
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    required
                    className="w-full p-3.5 pl-8 bg-slate-50 border border-slate-150 rounded-xl text-slate-850 font-black text-base focus:ring-2 focus:ring-black outline-none"
                />
            </div>
            <p className="text-[10px] text-slate-400 text-right mt-1.5 font-bold uppercase tracking-wider pr-1">
                Available: ₦{user.balance.toLocaleString()}
            </p>
        </div>

        <button
            type="submit"
            disabled={isLoading || !bank || !accountNumber || !amount || !accountName}
            className="w-full py-4 bg-black hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg transition-all mt-6 flex items-center justify-center space-x-2"
        >
          {isLoading ? (
              <span>Processing Payout...</span>
          ) : (
              <>
                  <span>Withdraw Money</span>
                  <Icons.ArrowUpRight size={15} />
              </>
          )}
        </button>
      </form>
    </div>
  );
};

export default SendMoney;
