import React, { useState, useMemo } from 'react';
import {
  History,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Trash2,
  Filter,
  FileSpreadsheet,
  X,
  User,
  Pencil,
  Check,
  CloudUpload
} from 'lucide-react';
import { Transaction, TransactionType } from '../types';
import { formatINR } from '../utils/currency';

interface RecentActivityProps {
  transactions: Transaction[];
  onDeleteTransaction: (tx: Transaction) => void;
  onUpdatePaidFrom?: (tx: Transaction, newName: string) => Promise<void>;
  onOpenUploadModal?: () => void;
  isDeleting?: boolean;
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  transactions,
  onDeleteTransaction,
  onUpdatePaidFrom,
  onOpenUploadModal,
  isDeleting = false,
}) => {
  const [filterType, setFilterType] = useState<'All' | TransactionType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(15);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const startEditPaidFrom = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditingName(tx.payFrom || 'Self');
  };

  const handleSavePaidFrom = async (tx: Transaction) => {
    if (!onUpdatePaidFrom) {
      setEditingTxId(null);
      return;
    }
    setIsSavingName(true);
    try {
      await onUpdatePaidFrom(tx, editingName.trim() || 'Self');
      setEditingTxId(null);
    } finally {
      setIsSavingName(false);
    }
  };

  // Filter transactions matching search query against description, payBy, payFrom, or category
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (filterType !== 'All' && tx.type !== filterType) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchDesc = (tx.description || '').toLowerCase().includes(q);
          const matchPayBy = (tx.payBy || '').toLowerCase().includes(q);
          const matchPayFrom = (tx.payFrom || '').toLowerCase().includes(q);
          const matchCat = (tx.category || '').toLowerCase().includes(q);
          return matchDesc || matchPayBy || matchPayFrom || matchCat;
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

        {/* Action Controls: Upload Sheet & Filter Pills */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {onOpenUploadModal && (
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all shadow-sm"
              title="Upload monthly Google Sheet or Excel file to update transactions"
            >
              <CloudUpload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Upload Sheet</span>
            </button>
          )}

          {/* Type Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
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
                <th className="py-3 px-3">Pay By</th>
                <th className="py-3 px-3">Paid from :</th>
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

                    {/* Pay By */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-800/80 text-emerald-300 text-xs font-semibold border border-slate-700/60">
                        {tx.payBy || 'Cash'}
                      </span>
                    </td>

                    {/* Paid from : (Person who made the payment - Click or Pencil to Edit/Type Name) */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {editingTxId === tx.id ? (
                        <div className="inline-flex items-center gap-1.5 animate-in fade-in duration-100">
                          <input
                            type="text"
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSavePaidFrom(tx);
                              if (e.key === 'Escape') setEditingTxId(null);
                            }}
                            placeholder="Type person's name..."
                            className="px-2 py-1 bg-slate-950 border border-blue-500 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-28"
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePaidFrom(tx)}
                            disabled={isSavingName}
                            className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                            title="Save name"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTxId(null)}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditPaidFrom(tx)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/40 text-blue-300 hover:bg-blue-900/40 hover:text-blue-200 text-xs font-semibold border border-blue-800/40 hover:border-blue-700 transition-all group/btn text-left"
                          title="Click to change or type person name"
                        >
                          <User className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>{tx.payFrom || 'Self'}</span>
                          <Pencil className="w-2.5 h-2.5 text-blue-400/50 group-hover/btn:text-blue-300 opacity-0 group-hover/btn:opacity-100 transition-opacity ml-0.5" />
                        </button>
                      )}
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
