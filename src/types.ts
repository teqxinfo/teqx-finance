export type TransactionType = 'Income' | 'Expense';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  rowIndex?: number; // Row index in Google Sheets (1-based, where 1 is header)
}

export interface CategoriesData {
  incomeCategories: string[];
  expenseCategories: string[];
}

export interface SpreadsheetInfo {
  id: string;
  name: string;
  url: string;
  lastSyncedAt?: string;
}

export interface GoogleUserProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
