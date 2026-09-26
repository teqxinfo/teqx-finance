import React from 'react';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, Minus, TrendingUp } from 'lucide-react';
import { TransactionType } from '../types';
import { formatINR, CURRENCY_SYMBOL } from '../utils/currency';

interface SummaryCardsProps {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  currencySymbol?: string;
  onQuickAdd?: (type: TransactionType) => void;
  showQuickButtons?: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalIncome,
  totalExpenses,
  netBalance,
  currencySymbol = CURRENCY_SYMBOL,
  onQuickAdd,
  showQuickButtons = true,
}) => {
  const formatMoney = (val: number) => {
    return formatINR(val);
  };

  const savingsRate = totalIncome > 0
    ? Math.max(0, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100))
    : 0;

  return (
    <div className="space-y-4">
      {/* Mobile Top Quick Action Banner: Large easy-to-tap Plus (+) and Minus (-) buttons */}
      {showQuickButtons && onQuickAdd && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onQuickAdd('Income')}
            className="flex items-center justify-center gap-2.5 py-3.5 px-4 bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-950/40 border border-emerald-400/30 active:scale-[0.98] transition-all"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
              <Plus className="w-4 h-4 stroke-[3]" />
            </div>
            <span className="text-sm tracking-wide">Add Income</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickAdd('Expense')}
            className="flex items-center justify-center gap-2.5 py-3.5 px-4 bg-gradient-to-r from-rose-600/90 to-pink-600/90 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-2xl shadow-lg shadow-rose-950/40 border border-rose-400/30 active:scale-[0.98] transition-all"
          >
            <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
              <Minus className="w-4 h-4 stroke-[3]" />
            </div>
            <span className="text-sm tracking-wide">Add Expense</span>
          </button>
        </div>
      )}

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Net Balance Card */}
        <div className="relative overflow-hidden bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all hover:border-slate-700">
          <div className="absolute top-0 right-0 p-5 pointer-events-none opacity-10">
            <Wallet className="w-16 h-16 text-slate-100" />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Balance</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              netBalance >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {netBalance >= 0 ? 'Surplus' : 'Deficit'}
            </span>
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono ${
            netBalance >= 0 ? 'text-white' : 'text-rose-400'
          }`}>
            {netBalance < 0 ? '-' : ''}{formatMoney(netBalance)}
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Savings rate: <strong className="text-slate-200 font-semibold">{savingsRate}%</strong></span>
          </div>
        </div>

        {/* Total Income Card */}
        <div className="relative overflow-hidden bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Income</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-400 font-mono">
            +{formatMoney(totalIncome)}
          </div>
          <p className="mt-2.5 text-xs text-slate-400">
            All registered revenue inflows
          </p>
        </div>

        {/* Total Expenses Card */}
        <div className="relative overflow-hidden bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all hover:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Expenses</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-400 font-mono">
            -{formatMoney(totalExpenses)}
          </div>
          <p className="mt-2.5 text-xs text-slate-400">
            Total expenditures recorded
          </p>
        </div>
      </div>
    </div>
  );
};
