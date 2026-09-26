import React, { useState, useMemo } from 'react';
import { PieChart as PieIcon, Calendar, ArrowRight, Tag } from 'lucide-react';
import { Transaction } from '../types';
import { formatINR } from '../utils/currency';

interface ExpensePieChartProps {
  transactions: Transaction[];
  compact?: boolean;
  onViewAllAnalytics?: () => void;
  dateRangeLabel?: string;
}

// Crisp, harmonious color palette for expense categories
const CATEGORY_COLORS = [
  '#f43f5e', // rose-500
  '#fb923c', // orange-400
  '#eab308', // yellow-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#d946ef', // fuchsia-500
  '#64748b', // slate-500
];

export const ExpensePieChart: React.FC<ExpensePieChartProps> = ({
  transactions,
  compact = false,
  onViewAllAnalytics,
  dateRangeLabel,
}) => {
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  // Compute expenses breakdown for provided transactions
  const { categoryData, totalMonthlyExpenses, monthLabel } = useMemo(() => {
    const now = new Date();
    const defaultMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    const effectiveLabel = dateRangeLabel || defaultMonthName;

    // Filter only Expense transactions
    const expenseTransactions = transactions.filter((tx) => tx.type === 'Expense');

    const categoryMap: { [category: string]: number } = {};
    let total = 0;

    expenseTransactions.forEach((tx) => {
      const cat = tx.payBy || tx.category || 'Expense';
      categoryMap[cat] = (categoryMap[cat] || 0) + tx.amount;
      total += tx.amount;
    });

    const sorted = Object.entries(categoryMap)
      .map(([cat, amount], index) => ({
        category: cat,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      categoryData: sorted,
      totalMonthlyExpenses: total,
      monthLabel: effectiveLabel,
    };
  }, [transactions, dateRangeLabel]);

  // Generate SVG donut arcs
  const size = 240;
  const strokeWidth = 36;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = 0;
  const slices = categoryData.map((item) => {
    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((cumulativeAngle / 100) * circumference);
    cumulativeAngle += item.percentage;

    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-rose-400" />
            <span>Current Month Expenses</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{monthLabel} breakdown</span>
          </p>
        </div>

        {compact && onViewAllAnalytics && (
          <button
            type="button"
            onClick={onViewAllAnalytics}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
          >
            <span>Full Analysis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {categoryData.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
          <PieIcon className="w-10 h-10 stroke-[1.5] mb-2 text-slate-600" />
          <p className="text-sm font-semibold text-slate-400">No expenses recorded for {monthLabel}</p>
          <p className="text-xs text-slate-500 mt-0.5">Use the Add Expense form to log an expenditure</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* SVG Donut Visual */}
          <div className="relative shrink-0 flex items-center justify-center">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="transform -rotate-90"
            >
              {/* Background circle track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="#1e293b"
                strokeWidth={strokeWidth}
              />
              {/* Slices */}
              {slices.map((slice, idx) => (
                <circle
                  key={slice.category}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={activeSlice === idx ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setActiveSlice(idx)}
                  onMouseLeave={() => setActiveSlice(null)}
                />
              ))}
            </svg>

            {/* Inner Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
              {activeSlice !== null && categoryData[activeSlice] ? (
                <>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate max-w-[120px]">
                    {categoryData[activeSlice].category}
                  </span>
                  <span className="text-lg font-bold text-white font-mono">
                    {formatINR(categoryData[activeSlice].amount)}
                  </span>
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded mt-0.5"
                    style={{ color: categoryData[activeSlice].color }}
                  >
                    {categoryData[activeSlice].percentage.toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Total Spent
                  </span>
                  <span className="text-xl font-extrabold text-white font-mono mt-0.5">
                    {formatINR(totalMonthlyExpenses)}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    {categoryData.length} {categoryData.length === 1 ? 'category' : 'categories'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Categories Legend List */}
          <div className="w-full flex-1 max-h-56 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
            {categoryData.map((item, idx) => {
              const isSelected = activeSlice === idx;
              return (
                <div
                  key={item.category}
                  onMouseEnter={() => setActiveSlice(idx)}
                  onMouseLeave={() => setActiveSlice(null)}
                  className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                    isSelected ? 'bg-slate-800/90 shadow-md' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {item.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs font-bold text-slate-100 font-mono">
                      {formatINR(item.amount)}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 font-mono w-12 text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
