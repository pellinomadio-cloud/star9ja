import React, { useState } from 'react';
import { Icons } from './Icons';
import { User } from '../types';

interface BuyNairaCodeProps {
  user: User;
  onUpdateUser: (fields: Partial<User>) => void;
  onBack: () => void;
}

const PLANS = [
  {
    id: 'weekly',
    name: 'Weekly Plan',
    price: 8000,
    duration: '7 Days Access',
    description: 'Unlock standard bank transfers, basic trial tools, and daily ₦5k claim limits.',
    badge: 'Standard Starter',
    icon: Icons.Clock,
    color: 'border-slate-250 bg-white'
  },
  {
    id: 'monthly',
    name: 'Monthly Plan',
    price: 16000,
    duration: '30 Days Access',
    description: 'Unlock high account limits, daily ₦100k claim speed-ups, and active standard loan approval.',
    badge: 'Most Popular',
    icon: Icons.Upgrade,
    color: 'border-red-500 bg-red-50/40',
    popular: true
  },
  {
    id: 'yearly',
    name: 'Yearly Plan',
    price: 50000,
    duration: '365 Days Access',
    description: 'Lifetime maximum VIP limits, raw priority support, and absolute ultra-VIP eligibility.',
    badge: 'Super Saver',
    icon: Icons.Reward,
    color: 'border-yellow-500 bg-yellow-50/30',
    premium: true
  }
];

const BuyNairaCode: React.FC<BuyNairaCodeProps> = ({ user, onUpdateUser, onBack }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('monthly');
  const [step, setStep] = useState<'plan_select' | 'payment_upload'>(
    user.activationStatus === 'pending' ? 'payment_upload' : 'plan_select'
  );
  
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofBase64, setProofBase64] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const accountNumber = "5276179936";
  const selectedPlan = PLANS.find(p => p.id === selectedPlanId) || PLANS[1];

  const handleCopy = () => {
    navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Please upload an image file (PNG, JPG, JPEG) as receipt proof");
      return;
    }
    setProofFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const generateMockReceipt = () => {
    // Generate a sleek canvas-based mockup receipt for testing convenience
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 400, 400);
      gradient.addColorStop(0, '#111827');
      gradient.addColorStop(1, '#1f2937');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 400, 400);

      // Gold badge border
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 4;
      ctx.strokeRect(15, 15, 370, 370);

      // Receipt details
      ctx.font = '24px Georgia';
      ctx.fillStyle = '#D97706';
      ctx.fillText('star9ja Bank Slip', 100, 60);

      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('==================================', 40, 100);
      ctx.fillText(`TRANSACTION ID: TX-${Math.floor(Math.random() * 900000) + 100000}`, 40, 130);
      ctx.fillText(`PLAN CHOSEN   : ${selectedPlan.name.toUpperCase()}`, 40, 160);
      ctx.fillText(`AMOUNT PAID   : ₦${selectedPlan.price.toLocaleString()}`, 40, 190);
      ctx.fillText(`DESTINATION   : Moniepoint MFB`, 40, 220);
      ctx.fillText('ACCOUNT NO    : 5276179936', 40, 250);
      ctx.fillText('STATUS        : SUCCESSFUL', 40, 280);
      ctx.fillText(`DATE/TIME     : ${new Date().toLocaleString()}`, 40, 310);
      ctx.fillText('==================================', 40, 340);

      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('AUTOMATIC RECEIPT PROOF DELIVERED', 80, 365);

      const mockDataUrl = canvas.toDataURL('image/png');
      setProofBase64(mockDataUrl);
      
      // Create a dummy file object
      const dummyFile = new File(["mock_receipt"], "mock_receipt_proof.png", { type: "image/png" });
      setProofFile(dummyFile);
    }
  };

  const handleConfirmSubmit = () => {
    if (!proofBase64) {
      alert("Please upload payment receipt proof to proceed.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      onUpdateUser({
        activationStatus: 'pending',
        activationPlan: selectedPlanId as any,
        activationSubmitTime: Date.now(),
        activationProofBase64: proofBase64
      });
      setSubmitting(false);
      setStep('payment_upload');
    }, 1500);
  };

  const handleCancelSubmission = () => {
    if (confirm("Are you sure you want to cancel this pending activation request? This will clear your current submission.")) {
      onUpdateUser({
        activationStatus: 'inactive',
        activationPlan: undefined,
        activationSubmitTime: undefined,
        activationProofBase64: undefined
      });
      setStep('plan_select');
      setProofFile(null);
      setProofBase64('');
    }
  };

  // --- RENDERING VIEWS ---

  // Standard Pending View
  if (user.activationStatus === 'pending') {
    const formattedSubmitTime = user.activationSubmitTime 
      ? new Date(user.activationSubmitTime).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    
    return (
      <div className="px-4 py-8 space-y-6 animate-in fade-in duration-500 max-w-md mx-auto">
        <div className="text-center space-y-3">
          <div className="relative inline-flex items-center justify-center p-3">
            {/* Spinning/pulsing neon circular progress wrapper */}
            <span className="absolute inset-0 rounded-full border-4 border-dashed border-red-500 animate-spin opacity-55"></span>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center relative shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <Icons.Clock size={36} className="text-red-500 animate-pulse" />
            </div>
          </div>
          <div>
            <span className="px-3 py-1 rounded-full text-[10px] font-black bg-yellow-100 text-yellow-800 uppercase tracking-widest border border-yellow-200">
              PENDING VERIFICATION
            </span>
            <h2 className="text-2xl font-black text-slate-800 mt-2 uppercase tracking-tight">Active In 30 Minutes</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed mt-1">
              Thank you for choosing star9ja! Your submitted payment proof is currently under manual admin verification.
            </p>
          </div>
        </div>

        {/* Current Request Summary Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Submission Details</h4>
          <div className="grid grid-cols-2 gap-y-3 text-xs">
            <div>
              <p className="text-slate-400 uppercase font-bold text-[10px]">Verification Plan</p>
              <p className="text-black font-black uppercase">{user.activationPlan ? `${user.activationPlan} Plan` : 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-bold text-[10px]">Amount Sent</p>
              <p className="text-black font-black">
                ₦{user.activationPlan === 'weekly' ? '8,000' : user.activationPlan === 'yearly' ? '50,000' : '16,000'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-bold text-[10px]">Submitted At</p>
              <p className="text-black font-black">{formattedSubmitTime}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase font-bold text-[10px]">Estimated Approval</p>
              <p className="text-green-600 font-extrabold uppercase tracking-wide">~30 Mins Waiting</p>
            </div>
          </div>

          {/* Render receipt preview if saved */}
          {user.activationProofBase64 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-50">
              <p className="text-slate-400 uppercase font-bold text-[10px] tracking-wider text-center">Receipt Proof Preview</p>
              <div className="w-full h-32 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shadow-inner">
                <img 
                  src={user.activationProofBase64} 
                  alt="Receipt uploaded" 
                  className="h-full w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-3">
          <button 
            onClick={onBack}
            className="w-full py-4 bg-slate-900 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-xl transform active:scale-95 transition-all text-center flex items-center justify-center space-x-2"
          >
            <Icons.Home size={15} />
            <span>Go to Dashboard</span>
          </button>
          
          <button 
            onClick={handleCancelSubmission}
            className="w-full py-3 bg-white text-rose-500 font-bold border border-rose-100 hover:bg-rose-50 rounded-xl text-xs uppercase tracking-widest transform active:scale-95 transition-all text-center flex items-center justify-center space-x-1"
          >
            <Icons.X size={15} />
            <span>Cancel and Re-submit</span>
          </button>
        </div>
      </div>
    );
  }

  // Active View
  if (user.activationStatus === 'active') {
    return (
      <div className="px-4 py-16 text-center space-y-6 animate-in zoom-in-95 duration-500 max-w-sm mx-auto">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto relative border border-green-200 shadow-md">
          <div className="absolute inset-0 rounded-full border-4 border-green-500 bg-green-500/10 animate-ping opacity-25"></div>
          <Icons.ShieldCheck size={44} className="text-green-500" />
        </div>
        <div>
          <span className="px-3 py-1 rounded-full text-[10px] font-black bg-green-100 text-green-800 uppercase tracking-widest">
            ACCOUNT ACTIVE
          </span>
          <h2 className="text-2xl font-black text-slate-800 mt-3 uppercase tracking-tighter">Verification Confirmed</h2>
          <p className="text-xs text-slate-400 leading-relaxed mt-2 uppercase tracking-normal">
            You are currently on a premium active user status. Your unlimited withdrawals, maximum limits, and bonus eligibility are active.
          </p>
        </div>
        <button 
          onClick={onBack}
          className="w-full py-4 bg-black text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg transform active:scale-95 transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Standard Plan Select Step
  if (step === 'plan_select') {
    return (
      <div className="px-4 py-4 space-y-6 duration-500 animate-in fade-in max-w-md mx-auto pb-12">
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Activate star9ja Account</h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mt-1">
            Choose a premium plan below to activate withdrawal, loans, and custom claims.
          </p>
        </div>

        {/* Plans Loop */}
        <div className="space-y-3">
          {PLANS.map((plan) => {
            const PlanIcon = plan.icon;
            const isSelected = selectedPlanId === plan.id;
            return (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                  isSelected 
                    ? `${plan.id === 'weekly' ? 'border-slate-800 bg-slate-50/40' : plan.id === 'yearly' ? 'border-yellow-500 bg-yellow-50/10' : 'border-red-500 bg-red-50/30'} shadow-md scale-[1.01]` 
                    : 'border-slate-100 bg-white hover:border-slate-300'
                }`}
              >
                {/* Floating Badge */}
                <div className={`absolute top-4 right-4 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                  isSelected 
                    ? (plan.premium ? 'bg-yellow-500 text-white' : plan.popular ? 'bg-red-500 text-white' : 'bg-slate-800 text-white')
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {plan.badge}
                </div>

                <div className="flex items-start space-x-3.5 pr-20">
                  <div className={`p-2.5 rounded-xl border ${
                    isSelected 
                      ? (plan.premium ? 'bg-yellow-100 text-yellow-600 border-yellow-200' : plan.popular ? 'bg-red-100 text-red-600 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200')
                      : 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}>
                    <PlanIcon size={22} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{plan.name}</h3>
                    <p className="text-[11px] text-slate-400 leading-normal font-medium">{plan.description}</p>
                    <div className="flex items-center space-x-2 pt-1.5">
                      <span className="text-base font-black text-slate-900">₦{plan.price.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">/ {plan.duration}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="pt-2">
          <button 
            onClick={() => setStep('payment_upload')}
            className="w-full py-4.5 bg-red-650 bg-primary-blue hover:bg-red-600 font-black text-sm uppercase tracking-widest text-white rounded-xl shadow-xl transform active:scale-95 transition-all text-center flex items-center justify-center space-x-2"
          >
            <span>Proceed with Account Activation</span>
            <Icons.ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  // Make Payment and Proof Upload Step
  return (
    <div className="px-4 py-4 space-y-6 duration-500 animate-in fade-in max-w-md mx-auto pb-12">
      {/* Header with back trigger */}
      <div className="flex items-center space-x-2 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
        <button 
          onClick={() => setStep('plan_select')}
          className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors"
        >
          <Icons.ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Activating Plan</p>
          <p className="text-xs font-black text-slate-800 uppercase truncate">{selectedPlan.name} (₦{selectedPlan.price.toLocaleString()})</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 border border-cyan-200 uppercase tracking-widest">
          STEP 2 / 2
        </span>
      </div>

      {/* Account Info */}
      <div className="space-y-3">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center">Transfer Price into official Vault</p>
        
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-blue"></div>
          
          <div className="text-center pt-1.5 pb-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Required Amount</p>
            <h1 className="text-3xl font-black text-black drop-shadow-sm">₦{selectedPlan.price.toLocaleString()}</h1>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-50">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Account Number</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-base font-black text-slate-800 tracking-widerCopy">{accountNumber}</span>
                <button 
                  onClick={handleCopy}
                  className={`p-1.5 rounded-lg transition-all ${copied ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {copied ? <Icons.Check size={14} /> : <Icons.Copy size={14} />}
                </button>
              </div>
            </div>
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Bank Name</span>
              <span className="font-black text-slate-800 uppercase">Moniepoint MFB</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wide">Account Name</span>
              <span className="font-black text-slate-800 uppercase text-right tracking-tight text-[11px]">Awwal Onimsi Abdulsalam</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Receipt Proof</p>
        </div>

        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center space-y-2 cursor-pointer transition-all text-center relative ${
            dragActive ? 'border-primary-blue bg-red-50/10' : ''
          } ${
            proofFile ? 'border-green-500 bg-green-50/10' : 'border-slate-200 bg-white hover:border-slate-400'
          }`}
        >
          <input 
            type="file" 
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            id="activation-proof-input"
          />
          {proofFile ? (
            <div className="space-y-1.5 p-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
                <Icons.CheckCircle size={22} className="text-green-600" />
              </div>
              <p className="text-[11px] font-black text-green-600 uppercase tracking-wider">Receipt Loaded Successfully</p>
              <p className="text-[10px] text-slate-400 truncate max-w-xs">{proofFile.name} (~{(proofFile.size/1024).toFixed(1)} KB)</p>
            </div>
          ) : (
            <div className="p-3">
              <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
                <Icons.Upload size={20} />
              </div>
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Drag & drop slip here</p>
              <p className="text-[10px] text-slate-400 mt-0.5">or tap to browse your phone images</p>
            </div>
          )}
        </div>
      </div>

      {proofBase64 && (
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Receipt Thumbnail</p>
          <div className="w-full h-32 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
            <img src={proofBase64} alt="Proof" className="h-full w-auto object-contain" referrerPolicy="no-referrer" />
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="space-y-3.5">
        <button 
          onClick={handleConfirmSubmit}
          disabled={submitting}
          className={`w-full py-4 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center space-x-2 transition-all ${
            submitting 
              ? 'bg-slate-300 cursor-not-allowed' 
              : 'bg-black hover:bg-slate-800 transform active:scale-95'
          }`}
        >
          {submitting ? (
            <Icons.Sync size={15} className="animate-spin" />
          ) : (
            <Icons.ShieldCheck size={16} />
          )}
          <span>{submitting ? 'Submitting Vault Request...' : 'Submit Activation Proof'}</span>
        </button>

        <p className="text-[9.5px] text-slate-400 leading-relaxed uppercase tracking-normal text-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          Our specialized team verifies bank receipts in ~30 minutes manually.<br />
          <span className="font-extrabold text-red-500">Notice: Uploading screens of false transactions triggers device lock block.</span>
        </p>
      </div>
    </div>
  );
};

export default BuyNairaCode;
