/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
} from './services/googleAuth';
import { sheetsService } from './services/sheetsService';
import { DEFAULT_CATEGORIES, getInitialTransactions } from './data/mockData';
import {
  CategoriesData,
  GoogleUserProfile,
  SpreadsheetInfo,
  Transaction,
  TransactionType,
} from './types';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { MobileNav, MobileTab } from './components/MobileNav';
import { SummaryCards } from './components/SummaryCards';
import { TransactionForm } from './components/TransactionForm';
import { ExpensePieChart } from './components/ExpensePieChart';
import { TrendLineChart } from './components/TrendLineChart';
import { RecentActivity } from './components/RecentActivity';
import { GoogleSheetModal, CONFIGURED_SHEET_ID } from './components/GoogleSheetModal';
import { UploadSheetModal } from './components/UploadSheetModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { DateRangePicker, DateRange, getPresetDates } from './components/DateRangePicker';
import { formatINR } from './utils/currency';
import { CloudUpload } from 'lucide-react';

const DEFAULT_CONFIGURED_SPREADSHEET: SpreadsheetInfo = {
  id: CONFIGURED_SHEET_ID,
  name: 'Teqx Finance Tracker',
  url: `https://docs.google.com/spreadsheets/d/${CONFIGURED_SHEET_ID}/edit`,
};

export default function App() {
  // 0. App Authentication State (Client-side simple login)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('ledgerpulse_logged_in') === 'true';
  });

  // Google OAuth & Sheets State
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [spreadsheetInfo, setSpreadsheetInfo] = useState<SpreadsheetInfo | null>(() => {
    const saved = localStorage.getItem('ledgerpulse_spreadsheet');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIGURED_SPREADSHEET;
  });

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('ledgerpulse_transactions');
    return saved ? JSON.parse(saved) : getInitialTransactions();
  });

  const [categories, setCategories] = useState<CategoriesData>(() => {
    const saved = localStorage.getItem('ledgerpulse_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  // Date Range Filter State
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    ...getPresetDates('all_time'),
    preset: 'all_time',
  }));

  // UI state
  const [mobileTab, setMobileTab] = useState<MobileTab>('home');
  const [formInitialType, setFormInitialType] = useState<TransactionType>('Expense');
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Destructive Confirmation Modal state
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);

  // Save to localStorage cache as backup
  useEffect(() => {
    localStorage.setItem('ledgerpulse_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('ledgerpulse_categories', JSON.stringify(categories));
  }, [categories]);

  // Firebase auth initialization
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser({
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
        setAccessToken(token);
      },
      () => {
        // Auth not active
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Sync data with Google Sheets
  const syncWithGoogleSheets = useCallback(async (token: string, sheetId: string) => {
    setIsSyncing(true);
    try {
      // 1. Ensure required tabs exist
      await sheetsService.ensureRequiredTabs(token, sheetId);

      // 2. Fetch separated categories (Column A: Income, Column B: Expense)
      const fetchedCats = await sheetsService.readCategories(token, sheetId);
      setCategories(fetchedCats);

      // 3. Fetch transactions
      const fetchedTxs = await sheetsService.readTransactions(token, sheetId);
      if (fetchedTxs.length > 0) {
        setTransactions(fetchedTxs);
      } else {
        // If sheet is empty, optionally write initial transactions or keep empty
        console.log('Sheet is empty or has only headers.');
      }
    } catch (err) {
      console.error('Failed to sync with Google Sheets:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Trigger sync if spreadsheet and token are available
  useEffect(() => {
    if (accessToken && spreadsheetInfo?.id) {
      syncWithGoogleSheets(accessToken, spreadsheetInfo.id);
    }
  }, [accessToken, spreadsheetInfo?.id, syncWithGoogleSheets]);

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.profile);
        setAccessToken(result.accessToken);

        // Auto-create or connect spreadsheet if none active
        if (!spreadsheetInfo) {
          setIsSyncing(true);
          try {
            const newSheet = await sheetsService.createTrackerSpreadsheet(
              result.accessToken,
              'Personal Finance Tracker'
            );
            const info: SpreadsheetInfo = {
              id: newSheet.id,
              name: newSheet.title,
              url: `https://docs.google.com/spreadsheets/d/${newSheet.id}/edit`,
              lastSyncedAt: new Date().toISOString(),
            };
            setSpreadsheetInfo(info);
            localStorage.setItem('ledgerpulse_spreadsheet', JSON.stringify(info));
            await syncWithGoogleSheets(result.accessToken, newSheet.id);
          } catch (createErr) {
            console.error('Could not auto-create spreadsheet:', createErr);
            setIsSheetModalOpen(true);
          } finally {
            setIsSyncing(false);
          }
        }
      }
    } catch (err: any) {
      alert(`Google Sign-In failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleGoogleSignOut = async () => {
    await googleLogout();
    setGoogleUser(null);
    setAccessToken(null);
  };

  // Connect Existing Spreadsheet
  const handleConnectExistingSheet = async (sheetIdOrUrl: string) => {
    if (!accessToken) {
      alert('Please connect your Google account first.');
      return;
    }

    // Extract ID if URL is passed
    let sheetId = sheetIdOrUrl.trim();
    const match = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      sheetId = match[1];
    }

    setIsSyncing(true);
    try {
      const meta = await sheetsService.getSpreadsheet(accessToken, sheetId);
      const info: SpreadsheetInfo = {
        id: meta.id,
        name: meta.title,
        url: `https://docs.google.com/spreadsheets/d/${meta.id}/edit`,
        lastSyncedAt: new Date().toISOString(),
      };
      setSpreadsheetInfo(info);
      localStorage.setItem('ledgerpulse_spreadsheet', JSON.stringify(info));
      await syncWithGoogleSheets(accessToken, meta.id);
    } finally {
      setIsSyncing(false);
    }
  };

  // Create Brand New Spreadsheet
  const handleCreateNewSheet = async (title: string) => {
    if (!accessToken) {
      alert('Please connect your Google account first.');
      return;
    }

    setIsSyncing(true);
    try {
      const created = await sheetsService.createTrackerSpreadsheet(accessToken, title);
      const info: SpreadsheetInfo = {
        id: created.id,
        name: created.title,
        url: `https://docs.google.com/spreadsheets/d/${created.id}/edit`,
        lastSyncedAt: new Date().toISOString(),
      };
      setSpreadsheetInfo(info);
      localStorage.setItem('ledgerpulse_spreadsheet', JSON.stringify(info));
      await syncWithGoogleSheets(accessToken, created.id);
    } finally {
      setIsSyncing(false);
    }
  };

  // Add Transaction
  const handleAddTransaction = async (txData: Omit<Transaction, 'id' | 'rowIndex'>) => {
    setIsSubmitting(true);
    const newTx: Transaction = {
      ...txData,
      id: `tx-${Date.now()}`,
      rowIndex: transactions.length + 2,
    };

    try {
      // If connected to Google Sheets, write to the "Transactions" tab
      if (accessToken && spreadsheetInfo?.id) {
        await sheetsService.appendTransaction(accessToken, spreadsheetInfo.id, txData);
      }

      // Optimistically update local state
      setTransactions((prev) => [newTx, ...prev]);
    } catch (err: any) {
      console.error('Error writing transaction to Google Sheets:', err);
      // Still keep local if desired, but notify user
      setTransactions((prev) => [newTx, ...prev]);
      alert(`Saved locally. Warning: Google Sheets write error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Category to Google Sheets Categories tab
  const handleAddCategory = async (type: TransactionType, categoryName: string) => {
    const cleanName = categoryName.trim();
    if (!cleanName) return;

    if (accessToken && spreadsheetInfo?.id) {
      await sheetsService.addCategory(accessToken, spreadsheetInfo.id, type, cleanName);
    }

    setCategories((prev) => {
      if (type === 'Income') {
        return {
          ...prev,
          incomeCategories: prev.incomeCategories.includes(cleanName)
            ? prev.incomeCategories
            : [...prev.incomeCategories, cleanName],
        };
      } else {
        return {
          ...prev,
          expenseCategories: prev.expenseCategories.includes(cleanName)
            ? prev.expenseCategories
            : [...prev.expenseCategories, cleanName],
        };
      }
    });
  };

  // Delete Transaction (Destructive Action - Requires Mandatory Confirmation Modal)
  const handleDeleteTransaction = (tx: Transaction) => {
    setPendingDeleteTx(tx);
  };

  // Update Paid from (Person Name)
  const handleUpdatePaidFrom = async (tx: Transaction, newName: string) => {
    const cleanName = newName.trim() || 'Self';
    // Update local state immediately
    setTransactions((prev) =>
      prev.map((item) => (item.id === tx.id ? { ...item, payFrom: cleanName } : item))
    );

    // If connected to Google Sheets and has rowIndex, update remote spreadsheet
    if (accessToken && spreadsheetInfo?.id && tx.rowIndex) {
      try {
        await sheetsService.updatePaidFrom(accessToken, spreadsheetInfo.id, tx.rowIndex, cleanName);
      } catch (err: any) {
        console.error('Failed to sync updated payer name to Google Sheets:', err);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteTx) return;
    const target = pendingDeleteTx;
    setPendingDeleteTx(null);

    try {
      if (accessToken && spreadsheetInfo?.id && target.rowIndex) {
        await sheetsService.deleteTransaction(accessToken, spreadsheetInfo.id, target.rowIndex);
      }
      setTransactions((prev) => prev.filter((t) => t.id !== target.id));
    } catch (err: any) {
      console.error('Failed to delete from Google Sheets:', err);
      setTransactions((prev) => prev.filter((t) => t.id !== target.id));
      alert(`Removed from view. Note: Sheet deletion warning: ${err.message}`);
    }
  };

  // Month-End Sheet Upload: Apply parsed transactions to site & optionally to cloud sheet
  const handleApplyImport = async (
    newTransactions: Transaction[],
    mode: 'replace' | 'append',
    syncToGoogleSheets: boolean
  ) => {
    let updatedList: Transaction[] = [];

    if (mode === 'replace') {
      updatedList = newTransactions.map((tx, idx) => ({
        ...tx,
        rowIndex: idx + 2,
      }));
    } else {
      const existingKeys = new Set(
        transactions.map((t) => `${t.date}-${t.amount}-${t.description.trim().toLowerCase()}`)
      );
      const nonDuplicates = newTransactions.filter(
        (t) => !existingKeys.has(`${t.date}-${t.amount}-${t.description.trim().toLowerCase()}`)
      );
      updatedList = [
        ...transactions,
        ...nonDuplicates.map((tx, idx) => ({
          ...tx,
          rowIndex: transactions.length + idx + 2,
        })),
      ];
    }

    setTransactions(updatedList);
    localStorage.setItem('ledgerpulse_transactions', JSON.stringify(updatedList));

    if (syncToGoogleSheets && accessToken && spreadsheetInfo?.id) {
      setIsSyncing(true);
      try {
        if (mode === 'replace') {
          await sheetsService.initializeHeadersAndCategories(accessToken, spreadsheetInfo.id);
          const rows = updatedList.map((tx) => [
            tx.date,
            tx.type,
            '',
            tx.amount,
            tx.description,
            tx.payBy || 'UPI',
            tx.payFrom || 'Self',
          ]);
          if (rows.length > 0) {
            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetInfo.id}/values/Transactions!A2:G${rows.length + 1}?valueInputOption=USER_ENTERED`,
              {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ values: rows }),
              }
            );
          }
        } else {
          for (const tx of newTransactions) {
            await sheetsService.appendTransaction(accessToken, spreadsheetInfo.id, tx);
          }
        }
      } catch (err) {
        console.error('Failed to sync to Google Sheets:', err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Quick Add from Mobile Top Banner
  const handleQuickAdd = (type: TransactionType) => {
    setFormInitialType(type);
    if (window.innerWidth < 768) {
      setMobileTab('add');
    } else {
      setIsQuickAddModalOpen(true);
    }
  };

  // Filtered transactions based on DateRangePicker
  const filteredTransactions = useMemo(() => {
    if (dateRange.preset === 'all_time' && !dateRange.startDate && !dateRange.endDate) {
      return transactions;
    }
    return transactions.filter((tx) => {
      if (!tx.date) return false;
      if (dateRange.startDate && tx.date < dateRange.startDate) return false;
      if (dateRange.endDate && tx.date > dateRange.endDate) return false;
      return true;
    });
  }, [transactions, dateRange]);

  // Compute Human-readable label for selected range
  const dateRangeLabel = useMemo(() => {
    if (dateRange.preset === 'all_time') return 'All Time';
    if (dateRange.preset === 'this_month') return 'This Month';
    if (dateRange.preset === 'last_30_days') return 'Last 30 Days';
    if (dateRange.preset === 'this_year') return 'This Year';
    if (dateRange.startDate && dateRange.endDate) {
      return `${dateRange.startDate} – ${dateRange.endDate}`;
    }
    if (dateRange.startDate) return `From ${dateRange.startDate}`;
    if (dateRange.endDate) return `Until ${dateRange.endDate}`;
    return 'Custom Range';
  }, [dateRange]);

  // Calculations for Summary Cards (reflecting active date range)
  const { totalIncome, totalExpenses, netBalance } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === 'Income') {
        inc += tx.amount;
      } else {
        exp += tx.amount;
      }
    });
    return {
      totalIncome: inc,
      totalExpenses: exp,
      netBalance: inc - exp,
    };
  }, [filteredTransactions]);

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('ledgerpulse_logged_in');
    localStorage.removeItem('ledgerpulse_user');
    setIsAuthenticated(false);
  };

  // If user is not authenticated, display login screen
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-20 md:pb-8">
      {/* Header */}
      <Header
        onLogout={handleLogout}
        googleUser={googleUser}
        spreadsheetInfo={spreadsheetInfo}
        isSyncing={isSyncing}
        onRefreshData={() => {
          if (accessToken && spreadsheetInfo?.id) {
            syncWithGoogleSheets(accessToken, spreadsheetInfo.id);
          }
        }}
        onOpenSheetModal={() => setIsSheetModalOpen(true)}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-5">
        {/* ========================================================= */}
        {/* DESKTOP VIEW: Unified Single-Screen Grid Layout          */}
        {/* ========================================================= */}
        <div className="hidden md:flex flex-col gap-6">
          {/* Top Row: Summary Cards */}
          <SummaryCards
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            netBalance={netBalance}
            onQuickAdd={handleQuickAdd}
            showQuickButtons={false}
          />

          {/* DateRangePicker toolbar for desktop dashboard */}
          <DateRangePicker
            range={dateRange}
            onChange={setDateRange}
            filteredCount={filteredTransactions.length}
            totalCount={transactions.length}
          />

          {/* Middle Row: Two Analysis Charts side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Expense Pie Chart (5 cols) */}
            <div className="lg:col-span-5">
              <ExpensePieChart
                transactions={filteredTransactions}
                compact={false}
                dateRangeLabel={dateRangeLabel}
              />
            </div>

            {/* Income vs Expenditure Trend Line Chart (7 cols) */}
            <div className="lg:col-span-7">
              <TrendLineChart transactions={filteredTransactions} />
            </div>
          </div>

          {/* Bottom Row: Transaction Input Form + Recent Activity Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Input Form (4 cols) */}
            <div className="lg:col-span-4">
              <TransactionForm
                categories={categories}
                initialType={formInitialType}
                onSubmit={handleAddTransaction}
                onAddCategory={handleAddCategory}
                isSubmitting={isSubmitting}
              />
            </div>

            {/* Recent Activity Table (8 cols) */}
            <div className="lg:col-span-8">
              <RecentActivity
                transactions={filteredTransactions}
                onDeleteTransaction={handleDeleteTransaction}
                onUpdatePaidFrom={handleUpdatePaidFrom}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MOBILE VIEW: Tab Switcher & Sticky Bottom Navigation     */}
        {/* ========================================================= */}
        <div className="block md:hidden space-y-4">
          {/* Tab 1: HOME (Landing Page) */}
          {mobileTab === 'home' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Above the fold: Large easy-to-tap Plus (+) and Minus (-) buttons & Summary Cards */}
              <SummaryCards
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                netBalance={netBalance}
                onQuickAdd={handleQuickAdd}
                showQuickButtons={true}
              />

              {/* Date Range Filter */}
              <DateRangePicker
                range={dateRange}
                onChange={setDateRange}
                filteredCount={filteredTransactions.length}
                totalCount={transactions.length}
              />

              {/* Expense Pie Chart right away on Home */}
              <ExpensePieChart
                transactions={filteredTransactions}
                compact={true}
                dateRangeLabel={dateRangeLabel}
                onViewAllAnalytics={() => setMobileTab('analysis')}
              />

              {/* Quick Recent Activity preview */}
              <RecentActivity
                transactions={filteredTransactions.slice(0, 5)}
                onDeleteTransaction={handleDeleteTransaction}
                onUpdatePaidFrom={handleUpdatePaidFrom}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
              />
            </div>
          )}

          {/* Tab 2: ADD NEW */}
          {mobileTab === 'add' && (
            <div className="animate-in fade-in duration-200">
              <TransactionForm
                categories={categories}
                initialType={formInitialType}
                onSubmit={handleAddTransaction}
                onAddCategory={handleAddCategory}
                isSubmitting={isSubmitting}
              />
            </div>
          )}

          {/* Tab 3: ANALYSIS (Dedicated Visual Analytics Section) */}
          {mobileTab === 'analysis' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Date Range Picker */}
              <DateRangePicker
                range={dateRange}
                onChange={setDateRange}
                filteredCount={filteredTransactions.length}
                totalCount={transactions.length}
              />

              {/* Expense Pie Chart */}
              <ExpensePieChart
                transactions={filteredTransactions}
                compact={false}
                dateRangeLabel={dateRangeLabel}
              />

              {/* Trend Line Chart (Daily and Monthly) */}
              <TrendLineChart transactions={filteredTransactions} />
            </div>
          )}

          {/* Tab 4: HISTORY */}
          {mobileTab === 'history' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Date Range Picker */}
              <DateRangePicker
                range={dateRange}
                onChange={setDateRange}
                filteredCount={filteredTransactions.length}
                totalCount={transactions.length}
              />

              <RecentActivity
                transactions={filteredTransactions}
                onDeleteTransaction={handleDeleteTransaction}
                onUpdatePaidFrom={handleUpdatePaidFrom}
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
              />
            </div>
          )}
        </div>
      </main>

      {/* Mobile Sticky Bottom Nav Bar */}
      <MobileNav
        currentTab={mobileTab}
        onTabChange={(tab) => setMobileTab(tab)}
      />

      {/* Quick Add Modal (Desktop when Plus/Minus triggered or for rapid logging) */}
      {isQuickAddModalOpen && (
        <TransactionForm
          categories={categories}
          initialType={formInitialType}
          onSubmit={handleAddTransaction}
          onAddCategory={handleAddCategory}
          isSubmitting={isSubmitting}
          isModal={true}
          onClose={() => setIsQuickAddModalOpen(false)}
        />
      )}

      {/* Google Sheets Modal */}
      <GoogleSheetModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
        spreadsheetInfo={spreadsheetInfo}
        onConnectExisting={handleConnectExistingSheet}
        onCreateNewSheet={handleCreateNewSheet}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        isProcessing={isSyncing}
      />

      {/* Direct Google Sheet Upload / Month-End File Modal */}
      <UploadSheetModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onApplyImport={handleApplyImport}
        isGoogleSheetsConnected={!!(accessToken && spreadsheetInfo?.id)}
      />

      {/* Mandatory User Confirmation Dialog for Destructive Operations */}
      <ConfirmationModal
        isOpen={!!pendingDeleteTx}
        title="Delete Transaction?"
        message={`Are you sure you want to permanently delete this ${pendingDeleteTx?.type.toLowerCase()} record of ${formatINR(
          pendingDeleteTx?.amount || 0
        )}${pendingDeleteTx?.payBy ? ` via ${pendingDeleteTx.payBy}` : ''}${pendingDeleteTx?.payFrom ? ` from ${pendingDeleteTx.payFrom}` : ''} (${pendingDeleteTx?.description || 'No description'}) from your Google Sheets database? This operation modifies spreadsheet rows.`}
        confirmLabel="Delete from Sheets"
        cancelLabel="Keep Record"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteTx(null)}
      />
    </div>
  );
}
