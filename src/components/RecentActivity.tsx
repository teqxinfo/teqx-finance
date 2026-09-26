import React, { useState, useMemo } from 'react';
import {
  History,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Trash2,
  Filter,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { formatINR } from '../utils/currency';

interface RecentActivityProps {
  transactions: Transaction[];
  onDeleteTransaction: (tx: Transaction) => void;
  isDeleting?: boolean;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  transactions,
  onDeleteTransaction,
  isDeleting = false,
}) => {
  const [filterType, setFilterType] = useState<'All' | TransactionType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(15);

  // Filter transactions matching search query against category or description
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (filterType !== 'All' && tx.type !== filterType) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchDesc = (tx.description || '').toLowerCase().includes(q);
          const matchCat = (tx.category || '').toLowerCase().includes(q);
          return matchDesc || matchCat;
        }
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [transactions, filterType, searchQuery]);

  const displayedTransactions = filteredTransactions.slice(0, limit);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* Header with Title and Type Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <span>Recent Activity</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Log entries from <span className="font-mono text-slate-300">Transactions</span> tab
          </p>
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl self-start sm:self-auto">
          {(['All', 'Income', 'Expense'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                filterType === type
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Dedicated Search Bar directly above the table */}
      <div className="mb-4">
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search transactions by category or description (e.g. Salary, Rent, Groceries)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-24 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Feedback and Results Counter */}
        {searchQuery.trim() && (
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Searching for: <strong className="text-emerald-400">"{searchQuery}"</strong>
            </span>
            <span className="font-mono">
              Found <strong className="text-white">{filteredTransactions.length}</strong> matching transaction{filteredTransactions.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto -mx-5 px-5 scrollbar-thin">
        {displayedTransactions.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500">
            <FileSpreadsheet className="w-10 h-10 stroke-[1.5] mb-2 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">No transactions found</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {searchQuery || filterType !== 'All' ? 'Try changing your search query or filters' : 'Add your first transaction above'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {displayedTransactions.map((tx) => {
                const isIncome = tx.type === 'Income';
                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Date */}
                    <td className="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {tx.date}
                    </td>

                    {/* Type badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isIncome
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="w-3 h-3 stroke-[3]" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 stroke-[3]" />
                        )}
                        <span>{tx.type}</span>
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-200 text-xs font-medium border border-slate-700/50">
                        {tx.category}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                      {tx.description || '—'}
                    </td>

                    {/* Amount */}
                    <td
                      className={`py-3 px-3 text-right font-mono font-bold whitespace-nowrap ${
                        isIncome ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatINR(tx.amount)}
                    </td>

                    {/* Delete Action (with user confirmation) */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(tx)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-70 group-hover:opacity-100"
                        title="Delete transaction from Google Sheets"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Show more button if there are many entries */}
      {filteredTransactions.length > limit && (
        <div className="mt-4 pt-3 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => setLimit((prev) => prev + 20)}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Show more transactions ({filteredTransactions.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
};
