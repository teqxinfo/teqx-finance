import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Minus,
  Calendar,
  IndianRupee,
  FileText,
  CreditCard,
  CheckCircle2,
  X,
  Wallet,
  User,
  UserCheck
} from 'lucide-react';
import { CategoriesData, TransactionType, Transaction } from '../types';
import { formatINR, CURRENCY_SYMBOL } from '../utils/currency';

interface TransactionFormProps {
  categories?: CategoriesData;
  initialType?: TransactionType;
  onSubmit: (tx: Omit<Transaction, 'id' | 'rowIndex'>) => Promise<void>;
  onAddCategory?: (type: TransactionType, categoryName: string) => Promise<void>;
  onClose?: () => void;
  isSubmitting?: boolean;
  isModal?: boolean;
}

const PAYMENT_METHODS = [
  'UPI',
  'Cash',
  'Credit Card',
  'Debit Card',
  'Net Banking',
  'Cheque',
  'Other'
];

const QUICK_PAYERS = [
  'Self',
  'Partner',
  'Office',
  'Family',
  'Friend'
];

export const TransactionForm: React.FC<TransactionFormProps> = ({
  initialType = 'Expense',
  onSubmit,
  onClose,
  isSubmitting = false,
  isModal = false,
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [description, setDescription] = useState('');
  const [payBy, setPayBy] = useState('UPI');
  const [customPayBy, setCustomPayBy] = useState('');
  const [payFrom, setPayFrom] = useState('Self');
  const payFromInputRef = useRef<HTMLInputElement>(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (initialType) {
      setType(initialType);
    }
  }, [initialType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    const effectivePayBy = payBy === 'Other' 
      ? (customPayBy.trim() || 'Other')
      : payBy;

    const effectivePayFrom = payFrom.trim() || 'Self';

    try {
      await onSubmit({
        date,
        type,
        // Category column is cleared / kept empty as requested
        category: '',
        amount: parsedAmount,
        description: description.trim() || `${type} recorded`,
        payBy: effectivePayBy,
        payFrom: effectivePayFrom,
      });

      // Show temporary success feedback
      setSuccessMessage(`${type} of ${formatINR(parsedAmount)} recorded!`);
      setAmount('');
      setDescription('');
      if (payBy === 'Other') setCustomPayBy('');
      setPayFrom('Self');

      setTimeout(() => {
        setSuccessMessage('');
        if (isModal && onClose) {
          onClose();
        }
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to submit transaction.');
    }
  };

  const content = (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl relative">
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
          {type === 'Income' ? (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
          ) : (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400" />
          )}
          <span>Log New Transaction</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Writes to Google Sheets <span className="font-mono text-slate-300">Transactions</span> tab with <span className="font-mono text-emerald-400">Pay By</span>
        </p>
      </div>

      {successMessage ? (
        <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-200">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-slate-100">{successMessage}</p>
          <p className="text-xs text-slate-400 mt-1">Spreadsheet synchronized</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selector (Income vs Expense) */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setType('Income')}
                className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                  type === 'Income'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Income</span>
              </button>
              <button
                type="button"
                onClick={() => setType('Expense')}
                className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                  type === 'Expense'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Minus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Expense</span>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Amount ({CURRENCY_SYMBOL})
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <IndianRupee className="w-4 h-4" />
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 text-base font-semibold font-mono placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
            {/* Quick amount shortcuts */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
              {[100, 500, 1000, 2000, 5000, 10000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val.toString())}
                  className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0"
                >
                  +{CURRENCY_SYMBOL}{val >= 1000 ? `${val / 1000}k` : val}
                </button>
              ))}
            </div>
          </div>

          {/* Pay By Dropdown & Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                Pay By (Payment Method)
              </label>
              <span className="text-[10px] text-slate-500">Google Sheets Col F</span>
            </div>

            {/* Quick Selector Pills */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {['UPI', 'Cash', 'Credit Card', 'Debit Card', 'Net Banking'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setPayBy(method);
                    setCustomPayBy('');
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    payBy === method
                      ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Dropdown Selector */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Wallet className="w-4 h-4" />
              </div>
              <select
                value={payBy}
                onChange={(e) => setPayBy(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method} className="bg-slate-900 text-slate-100">
                    {method}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Input when 'Other' is chosen */}
            {payBy === 'Other' && (
              <div className="mt-2 animate-in fade-in duration-150">
                <input
                  type="text"
                  required
                  value={customPayBy}
                  onChange={(e) => setCustomPayBy(e.target.value)}
                  placeholder="Specify custom payment method (e.g. Crypto, Gift Card, Cheque #)..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-emerald-500/40 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Paid from : (Person who made payment - Direct text input) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Paid from :</span>
                <span className="text-[11px] font-medium text-blue-400 lowercase">(type name of person)</span>
              </label>
              <span className="text-[10px] text-slate-500">Google Sheets Col G</span>
            </div>

            {/* Direct Editable Text Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserCheck className="w-4 h-4 text-blue-400" />
              </div>
              <input
                ref={payFromInputRef}
                type="text"
                required
                autoComplete="off"
                value={payFrom}
                onChange={(e) => setPayFrom(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Type person's name here (e.g. Anand, Rahul, Priya)..."
                className="w-full pl-9 pr-10 py-2.5 bg-slate-950/90 border border-slate-700 hover:border-slate-600 focus:border-blue-500 rounded-xl text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
              />
              {payFrom && (
                <button
                  type="button"
                  onClick={() => {
                    setPayFrom('');
                    payFromInputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                  title="Clear to type a new name"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Fill Suggestions */}
            <div className="flex items-center flex-wrap gap-1.5 mt-2">
              <span className="text-[11px] text-slate-400 font-medium">Quick fill:</span>
              {QUICK_PAYERS.map((person) => (
                <button
                  key={person}
                  type="button"
                  onClick={() => {
                    setPayFrom(person);
                  }}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all ${
                    payFrom.trim().toLowerCase() === person.toLowerCase()
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {person}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPayFrom('');
                  payFromInputRef.current?.focus();
                }}
                className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-900 border border-slate-700/80 text-blue-400 hover:bg-blue-500/10 transition-colors"
              >
                + Type name
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              You can type any person's name directly in the box above.
            </p>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Description (Optional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <FileText className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Client invoice #102, Grocery restock, Dinner with team"
                className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2.5 px-4 rounded-xl text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                type === 'Income'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
              }`}
            >
              {isSubmitting ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Save to Google Sheets</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
        <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

