import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  User,
  RefreshCw,
  Layers,
  ChevronRight,
  Database,
  CloudUpload
} from 'lucide-react';
import { Transaction } from '../types';
import { formatINR } from '../utils/currency';
import { parseSpreadsheetFile, ParsedSheetResult } from '../utils/sheetParser';

interface UploadSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyImport: (
    newTransactions: Transaction[],
    mode: 'replace' | 'append',
    syncToGoogleSheets: boolean
  ) => Promise<void>;
  isGoogleSheetsConnected: boolean;
}

export const UploadSheetModal: React.FC<UploadSheetModalProps> = ({
  isOpen,
  onClose,
  onApplyImport,
  isGoogleSheetsConnected,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedSheetResult | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [syncToCloud, setSyncToCloud] = useState(isGoogleSheetsConnected);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setIsParsing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFileName(file.name);

    try {
      const result = await parseSpreadsheetFile(file);

      // If no standard transactions were detected, check if monthly summary was found
      if (result.transactions.length === 0 && result.monthlySummary && result.monthlySummary.length > 0) {
        // Convert monthly summary into mock/representative transactions for the site
        const generatedTx: Transaction[] = [];
        result.monthlySummary.forEach((m, idx) => {
          if (m.income > 0) {
            generatedTx.push({
              id: `gen-inc-${idx}`,
              date: `2026-09-01`,
              type: 'Income',
              category: '',
              amount: m.income,
              description: `Monthly Income (${m.month})`,
              payBy: 'Net Banking',
              payFrom: 'Self',
            });
          }
          if (m.expenses > 0) {
            generatedTx.push({
              id: `gen-exp-${idx}`,
              date: `2026-09-15`,
              type: 'Expense',
              category: '',
              amount: m.expenses,
              description: `Monthly Expenses (${m.month})`,
              payBy: 'UPI',
              payFrom: 'Self',
            });
          }
        });
        result.transactions = generatedTx;
      }

      if (result.transactions.length === 0) {
        setErrorMsg(
          'Could not find transactions in this file. Please ensure it has columns for Date, Amount, and Description or is exported from Google Sheets.'
        );
        setParsedData(null);
      } else {
        setParsedData(result);
      }
    } catch (err: any) {
      console.error('Error parsing sheet:', err);
      setErrorMsg(`Failed to parse file: ${err.message || 'Invalid format'}`);
      setParsedData(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pastedText.trim()) return;
    setIsParsing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFileName('Pasted Clipboard / CSV');

    try {
      const result = await parseSpreadsheetFile(pastedText);

      // Fallback for TEQX Dashboard text
      if (result.transactions.length === 0 && result.monthlySummary && result.monthlySummary.length > 0) {
        const generatedTx: Transaction[] = [];
        result.monthlySummary.forEach((m, idx) => {
          if (m.income > 0) {
            generatedTx.push({
              id: `gen-inc-${idx}`,
              date: `2026-09-01`,
              type: 'Income',
              category: '',
              amount: m.income,
              description: `Monthly Income (${m.month})`,
              payBy: 'Net Banking',
              payFrom: 'Self',
            });
          }
          if (m.expenses > 0) {
            generatedTx.push({
              id: `gen-exp-${idx}`,
              date: `2026-09-15`,
              type: 'Expense',
              category: '',
              amount: m.expenses,
              description: `Monthly Expenses (${m.month})`,
              payBy: 'UPI',
              payFrom: 'Self',
            });
          }
        });
        result.transactions = generatedTx;
      }

      if (result.transactions.length === 0) {
        setErrorMsg('No readable transactions detected in pasted text. Make sure headers are included.');
        setParsedData(null);
      } else {
        setParsedData(result);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to parse pasted data: ${err.message}`);
      setParsedData(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleApply = async () => {
    if (!parsedData || parsedData.transactions.length === 0) return;
    setIsApplying(true);
    setErrorMsg(null);

    try {
      await onApplyImport(parsedData.transactions, importMode, syncToCloud && isGoogleSheetsConnected);
      setSuccessMsg(
        `Successfully updated site with ${parsedData.transactions.length} transactions!`
      );
      setTimeout(() => {
        onClose();
        setParsedData(null);
        setFileName(null);
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(`Failed to update site: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CloudUpload className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Upload Google Sheet / Month-End File</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Auto Sync
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Upload your Google Sheet (.xlsx, .csv) at month-end to instantly refresh all site metrics, charts, and activity.
            </p>
          </div>
        </div>

        {/* Tabs: Upload File vs Paste Data */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File (.xlsx, .csv)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste Sheet Data</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'upload' ? (
            <div>
              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-950/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  {isParsing ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  ) : (
                    <FileSpreadsheet className="w-6 h-6" />
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-200">
                  {fileName ? fileName : 'Click to select or drag & drop your Google Sheet file'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports Google Sheets exports: <strong className="text-slate-300">.xlsx</strong>,{' '}
                  <strong className="text-slate-300">.csv</strong> (TEQX Finance, Transactions, Income, Expenses)
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Paste Sheet Rows / CSV Text
              </label>
              <textarea
                rows={5}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste copied cells from your Google Sheet or CSV here..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 resize-none"
              />
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={isParsing || !pastedText.trim()}
                className="mt-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
              >
                {isParsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span>Parse Pasted Content</span>
              </button>
            </div>
          )}

          {/* Parsed Results Overview & Verification */}
          {parsedData && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Sheet Parsed Successfully
                </span>
                {parsedData.sheetNames.length > 0 && (
                  <span className="text-[11px] text-slate-400">
                    Sheets: {parsedData.sheetNames.join(', ')}
                  </span>
                )}
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-400">Total Entries</div>
                  <div className="text-lg font-bold text-slate-100 font-mono">
                    {parsedData.transactions.length}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/80 border border-emerald-500/20 rounded-xl">
                  <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Income
                  </div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">
                    {formatINR(parsedData.totalIncome)}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/80 border border-rose-500/20 rounded-xl">
                  <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3" /> Expenses
                  </div>
                  <div className="text-lg font-bold text-rose-400 font-mono">
                    {formatINR(parsedData.totalExpenses)}
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-1.5">
                  Preview Transactions (first {Math.min(parsedData.transactions.length, 5)} entries)
                </div>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60 max-h-44">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900/60">
                        <th className="p-2">Date</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Paid from :</th>
                        <th className="p-2">Description</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {parsedData.transactions.slice(0, 5).map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/30">
                          <td className="p-2 font-mono text-slate-400 whitespace-nowrap">{tx.date}</td>
                          <td className="p-2 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                tx.type === 'Income'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="p-2 text-blue-300 font-medium whitespace-nowrap flex items-center gap-1">
                            <User className="w-3 h-3 text-blue-400" />
                            <span>{tx.payFrom || 'Self'}</span>
                          </td>
                          <td className="p-2 text-slate-300 max-w-xs truncate">{tx.description}</td>
                          <td
                            className={`p-2 text-right font-mono font-bold whitespace-nowrap ${
                              tx.type === 'Income' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {formatINR(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Settings */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Update Settings
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      importMode === 'replace'
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-slate-800 bg-slate-900/50 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Replace & Refresh (Recommended)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Replaces the site's records with this month-end sheet for 100% accurate reconciliation.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      importMode === 'append'
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-slate-800 bg-slate-900/50 text-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Append / Merge
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Keeps existing records and appends new transactions to the database.
                      </div>
                    </div>
                  </label>
                </div>

                {isGoogleSheetsConnected && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 pt-1">
                    <input
                      type="checkbox"
                      checked={syncToCloud}
                      onChange={(e) => setSyncToCloud(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    <span>Also synchronize all imported rows into your connected Google Sheet</span>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!parsedData || parsedData.transactions.length === 0 || isApplying}
            onClick={handleApply}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            {isApplying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Site...</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-3.5 h-3.5" />
                <span>Update Site With Sheet Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
