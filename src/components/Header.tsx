import React from 'react';
import {
  Wallet,
  LogOut,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  Database,
  CloudUpload
} from 'lucide-react';
import { GoogleUserProfile, SpreadsheetInfo } from '../types';

interface HeaderProps {
  onLogout: () => void;
  googleUser: GoogleUserProfile | null;
  spreadsheetInfo: SpreadsheetInfo | null;
  isSyncing: boolean;
  onRefreshData: () => void;
  onOpenSheetModal: () => void;
  onOpenUploadModal: () => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onLogout,
  googleUser,
  spreadsheetInfo,
  isSyncing,
  onRefreshData,
  onOpenSheetModal,
  onOpenUploadModal,
  onGoogleSignIn,
  onGoogleSignOut,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 border border-emerald-400/30">
            <Wallet className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-white">Teqx Finance Tracker</span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                Sheets Live
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Income & Expenditure Tracking</p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sheets Connection Pill: displayed if spreadsheet is connected (via link or OAuth) */}
          {spreadsheetInfo ? (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs">
              <button
                type="button"
                onClick={onOpenSheetModal}
                className="flex items-center gap-2 text-slate-200 hover:text-emerald-400 transition-colors group"
                title="Google Sheets details and configuration"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline font-medium max-w-[140px] truncate">
                  {spreadsheetInfo.name || 'Connected Sheet'}
                </span>
              </button>

              {spreadsheetInfo.url && (
                <a
                  href={spreadsheetInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Open spreadsheet in Google Sheets"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <button
                type="button"
                onClick={onRefreshData}
                disabled={isSyncing}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                title="Sync & refresh data from Google Sheets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          ) : !googleUser ? (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="gsi-material-button text-xs h-[38px] px-3 font-semibold shadow-sm"
              title="Sign in with your Google account to connect live Google Sheets"
            >
              <div className="gsi-material-button-icon">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents hidden sm:inline">Connect Google Sheets</span>
              <span className="gsi-material-button-contents sm:hidden">Connect</span>
            </button>
          ) : null}

          {/* Month-End Sheet Upload Button */}
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all shadow-sm group"
            title="Upload month-end Google Sheets or Excel file to automatically update the site"
          >
            <CloudUpload className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Upload Sheet</span>
          </button>

          {/* User profile / Logout */}
          {googleUser && (
            <div className="relative group">
              <div className="flex items-center gap-2 pl-2">
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'Google User'}
                    className="w-8 h-8 rounded-full border border-slate-700 object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-600/30 text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                    {(googleUser.displayName || 'G')[0]}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Discrete Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 transition-all"
            title="Log out of application"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
