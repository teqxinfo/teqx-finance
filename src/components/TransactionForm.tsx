import React, { useState, useEffect } from 'react';
import {
  Plus,
  Minus,
  Calendar,
  Tag,
  IndianRupee,
  FileText,
  PlusCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { CategoriesData, TransactionType, Transaction } from '../types';
import { formatINR, CURRENCY_SYMBOL } from '../utils/currency';

interface TransactionFormProps {
  categories: CategoriesData;
  initialType?: TransactionType;
  onSubmit: (tx: Omit<Transaction, 'id' | 'rowIndex'>) => Promise<void>;
  onAddCategory?: (type: TransactionType, categoryName: string) => Promise<void>;
  onClose?: () => void;
  isSubmitting?: boolean;
  isModal?: boolean;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  categories,
  initialType = 'Expense',
  onSubmit,
  onAddCategory,
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
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  
  // Custom new category modal/input state
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Synchronize category list whenever type changes or categories update
  const currentCategories = type === 'Income' ? categories.incomeCategories : categories.expenseCategories;

  useEffect(() => {
    if (initialType) {
      setType(initialType);
    }
  }, [initialType]);

  useEffect(() => {
    if (currentCategories.length > 0 && !currentCategories.includes(category)) {
      setCategory(currentCategories[0]);
    }
  }, [type, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    if (!category.trim()) {
      alert('Please select or add a category.');
      return;
    }

    try {
      await onSubmit({
        date,
        type,
        category: category.trim(),
        amount: parsedAmount,
        description: description.trim() || `${type} recorded`,
      });

      // Show temporary success feedback
      setSuccessMessage(`${type} of ${formatINR(parsedAmount)} recorded!`);
      setAmount('');
      setDescription('');

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

  const handleAddNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsSavingCategory(true);
    try {
      if (onAddCategory) {
        await onAddCategory(type, newCategoryName.trim());
      }
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsAddingNewCategory(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add category to spreadsheet.');
    } finally {
      setIsSavingCategory(false);
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
          Writes to Google Sheets <span className="font-mono text-slate-300">Transactions</span> tab
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

          {/* Dynamic Separated Categories Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Category ({type === 'Income' ? 'Tab Col A' : 'Tab Col B'})
              </label>
              <button
                type="button"
                onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <PlusCircle className="w-3 h-3" />
                <span>{isAddingNewCategory ? 'Cancel' : 'New Category'}</span>
              </button>
            </div>

            {isAddingNewCategory ? (
              <div className="p-3 bg-slate-950/80 border border-emerald-500/30 rounded-xl space-y-2">
                <p className="text-[11px] text-slate-400">
                  Add new {type.toLowerCase()} category to spreadsheet tab:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder={`e.g. ${type === 'Income' ? 'Consulting' : 'Pet Care'}`}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={isSavingCategory || !newCategoryName.trim()}
                    onClick={handleAddNewCategory}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {isSavingCategory ? 'Saving...' : 'Add'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Tag className="w-4 h-4" />
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-700/80 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                >
                  {currentCategories.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900 text-slate-100">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                placeholder="e.g. Client invoice #102, Grocery restock"
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
