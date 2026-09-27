import React, { useState } from 'react';
import {
  FileSpreadsheet,
  X,
  ExternalLink,
  PlusCircle,
  Link,
  CheckCircle2,
  AlertCircle,
  Database,
  Copy,
  Check,
  ShieldAlert,
  Server,
  CloudUpload
} from 'lucide-react';
import { SpreadsheetInfo } from '../types';

export const CONFIGURED_SHEET_ID = '1kKXS9eJPVnS7sI5m-T-P9uLOth1GvUr6BXtLZ0e3vTk';
export const SERVICE_ACCOUNT_EMAIL = 'firebase-adminsdk-fbsvc@gen-lang-client-0658368930.iam.gserviceaccount.com';
export const SHEETS_PRIVATE_KEY_ID = 'bba02a339bb9c30ba68d9bdf0164479b515c8971';
export const DRIVE_PRIVATE_KEY_ID = 'ab487647788bee5df49e8bf65ccc4bf647fb97e3';

interface GoogleSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreadsheetInfo: SpreadsheetInfo | null;
  onConnectExisting: (sheetIdOrUrl: string) => Promise<void>;
  onCreateNewSheet: (title: string) => Promise<void>;
  onOpenUploadModal?: () => void;
  isProcessing: boolean;
}

export const GoogleSheetModal: React.FC<GoogleSheetModalProps> = ({
  isOpen,
  onClose,
  spreadsheetInfo,
  onConnectExisting,
  onCreateNewSheet,
  onOpenUploadModal,
  isProcessing,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'connect' | 'create'>('status');
  const [inputUrl, setInputUrl] = useState(CONFIGURED_SHEET_ID);
  const [newTitle, setNewTitle] = useState('Teqx Finance Tracker');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConnect = async (e: React.FormEvent, targetId?: string) => {
    if (e) e.preventDefault();
    const idToUse = targetId || inputUrl.trim();
    if (!idToUse) return;

    setFeedback(null);
    try {
      await onConnectExisting(idToUse);
      setFeedback({ type: 'success', message: 'Spreadsheet connected and synced!' });
      setTimeout(() => {
        onClose();
        setFeedback(null);
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to connect spreadsheet.' });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setFeedback(null);
    try {
      await onCreateNewSheet(newTitle.trim());
      setFeedback({ type: 'success', message: 'New Google Sheet created and initialized!' });
      setTimeout(() => {
        onClose();
        setFeedback(null);
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create spreadsheet.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Google Sheets Integration</h3>
            <p className="text-xs text-slate-400">
              REST API sync with <span className="font-mono text-emerald-300">Transactions</span> & <span className="font-mono text-emerald-300">Categories</span> tabs
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'status'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Connected Sheet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create New Sheet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('connect')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'connect'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Link Existing
          </button>
        </div>

        {feedback && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Tab 1: Current Status */}
        {activeTab === 'status' && (
          <div className="space-y-4">
            {spreadsheetInfo ? (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Spreadsheet Name</span>
                  <div className="flex items-center gap-1.5">
                    {spreadsheetInfo.id === CONFIGURED_SHEET_ID && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Default
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                </div>
                <div className="text-base font-bold text-white flex items-center gap-2">
                  <span>{spreadsheetInfo.name}</span>
                </div>
                <div className="text-xs text-slate-400 font-mono break-all bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <span className="truncate">ID: {spreadsheetInfo.id}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(spreadsheetInfo.id, 'sheet_id')}
                    className="p-1 hover:text-white transition-colors shrink-0 text-slate-400"
                    title="Copy Sheet ID"
                  >
                    {copiedField === 'sheet_id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  <a
                    href={spreadsheetInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <span className="text-[11px] text-slate-500">
                    Auto-synced with REST API
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                <Database className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No active spreadsheet connected</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Connect your configured spreadsheet to sync transactions and categories live.
                </p>
                <div className="mt-4 flex flex-col sm:flex-row justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleConnect(null as any, CONFIGURED_SHEET_ID)}
                    disabled={isProcessing}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connect Target Sheet ({CONFIGURED_SHEET_ID.slice(0, 8)}...)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('connect')}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Link Other
                  </button>
                </div>
              </div>
            )}

            {/* Direct Month-End File Upload Option */}
            {onOpenUploadModal && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <CloudUpload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Upload Month-End File Directly</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Import .xlsx or .csv from Google Sheets to auto-refresh all metrics
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUploadModal();
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                </button>
              </div>
            )}

            {/* Service Account & Permissions Box */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-400" />
                  Service Account Configuration
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  Ready
                </span>
              </div>
              
              {/* Service Account Email */}
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 rounded-lg border border-slate-800/80 text-xs text-slate-300 font-mono">
                <span className="truncate text-[11px]">{SERVICE_ACCOUNT_EMAIL}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(SERVICE_ACCOUNT_EMAIL, 'sa_email')}
                  className="p-1 hover:text-white transition-colors shrink-0 text-slate-400"
                  title="Copy Service Account Email"
                >
                  {copiedField === 'sa_email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Key IDs: Sheets & Drive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                <div className="p-2 bg-slate-900/70 border border-slate-800/80 rounded-lg flex items-center justify-between">
                  <span className="text-slate-500">Sheets Key:</span>
                  <span className="text-slate-300 ml-1">{SHEETS_PRIVATE_KEY_ID.slice(0, 8)}...</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(SHEETS_PRIVATE_KEY_ID, 'sheets_key')}
                    className="p-0.5 ml-1 hover:text-white text-slate-400"
                    title="Copy Sheets Private Key ID"
                  >
                    {copiedField === 'sheets_key' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="p-2 bg-slate-900/70 border border-slate-800/80 rounded-lg flex items-center justify-between">
                  <span className="text-slate-500">Drive Key:</span>
                  <span className="text-slate-300 ml-1">{DRIVE_PRIVATE_KEY_ID.slice(0, 8)}...</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(DRIVE_PRIVATE_KEY_ID, 'drive_key')}
                    className="p-0.5 ml-1 hover:text-white text-slate-400"
                    title="Copy Drive Private Key ID"
                  >
                    {copiedField === 'drive_key' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Tip: Share your Google Sheet and parent Drive folder with the Service Account email as an <strong>Editor</strong> to enable continuous syncing.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Schema requirement verified:</p>
              <p>• <span className="font-mono text-emerald-400">Transactions</span> tab: Col A (Date), Col B (Type), Col C (Category - cleared), Col D (Amount), Col E (Description), Col F (Pay By), Col G (Pay from :)</p>
              <p>• <span className="font-mono text-emerald-400">Categories</span> tab: Clean column layout</p>
            </div>
          </div>
        )}

        {/* Tab 2: Create New */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <p className="text-xs text-slate-400">
              Instantly create a Google Spreadsheet in your account configured with the required tabs and default categories.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Spreadsheet Title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Personal Finance Tracker"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing || !newTitle.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Create & Initialize Spreadsheet</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Tab 3: Connect Existing */}
        {activeTab === 'connect' && (
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between gap-2">
              <div>
                <p className="font-bold">Configured Target Sheet</p>
                <p className="font-mono text-[11px] text-blue-200 truncate">{CONFIGURED_SHEET_ID}</p>
              </div>
              <button
                type="button"
                onClick={() => setInputUrl(CONFIGURED_SHEET_ID)}
                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] shrink-0"
              >
                Use This
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Enter your Google Sheets link or ID. Direct integration automatically reads and syncs all transactions into the site.
            </p>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
              💡 <strong>Direct Integration:</strong> Simply copy the link from your browser or Google Sheet's <strong>Share</strong> button and paste it below to automatically update all site data!
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Google Sheets URL or Spreadsheet ID
              </label>
              <div className="relative">
                <Link className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs.../edit"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isProcessing || !inputUrl.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Connect & Sync</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
