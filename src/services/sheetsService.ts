import { CategoriesData, Transaction, TransactionType } from '../types';
import { DEFAULT_CATEGORIES } from '../data/mockData';
import { parseTableRows } from '../utils/sheetParser';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetMetadata {
  id: string;
  title: string;
  sheets: { id: number; title: string }[];
}

export const sheetsService = {
  /**
   * Fetch spreadsheet details
   */
  async getSpreadsheet(accessToken: string, spreadsheetId: string): Promise<SheetMetadata> {
    const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch spreadsheet (${res.status})`);
    }

    const data = await res.json();
    return {
      id: data.spreadsheetId,
      title: data.properties?.title || 'Personal Finance Tracker',
      sheets: (data.sheets || []).map((s: any) => ({
        id: s.properties?.sheetId,
        title: s.properties?.title,
      })),
    };
  },

  /**
   * Create a brand new Google Spreadsheet initialized with required tabs and headers
   */
  async createTrackerSpreadsheet(accessToken: string, title = 'Personal Finance Tracker'): Promise<SheetMetadata> {
    const createRes = await fetch(SHEETS_API_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title,
        },
        sheets: [
          {
            properties: {
              title: 'Transactions',
              gridProperties: { rowCount: 1000, columnCount: 10 },
            },
          },
          {
            properties: {
              title: 'Categories',
              gridProperties: { rowCount: 100, columnCount: 10 },
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create spreadsheet (${createRes.status})`);
    }

    const created = await createRes.json();
    const spreadsheetId = created.spreadsheetId;

    // Initialize headers and default categories
    await this.initializeHeadersAndCategories(accessToken, spreadsheetId);

    return {
      id: spreadsheetId,
      title,
      sheets: (created.sheets || []).map((s: any) => ({
        id: s.properties?.sheetId,
        title: s.properties?.title,
      })),
    };
  },

  /**
   * Seed headers and categories in newly created or blank sheets
   */
  async initializeHeadersAndCategories(accessToken: string, spreadsheetId: string): Promise<void> {
    // 1. Transactions Tab Headers (Date, Type, Category, Amount, Description, Pay By, Paid from :)
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Transactions!A1:G1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [['Date', 'Type', 'Category', 'Amount', 'Description', 'Pay By', 'Paid from :']],
      }),
    });

    // 2. Categories Tab Headers - Category columns initialized empty (all items removed)
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Categories!A1:B1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [['Income Categories', 'Expense Categories']],
      }),
    });
  },

  /**
   * Verify and add missing required tabs (safe against permission errors)
   */
  async ensureRequiredTabs(accessToken: string, spreadsheetId: string): Promise<void> {
    try {
      const meta = await this.getSpreadsheet(accessToken, spreadsheetId);
      const hasTransactions = meta.sheets.some((s) => s.title.toLowerCase().includes('trans'));
      const hasCategories = meta.sheets.some((s) => s.title.toLowerCase().includes('categor'));

      const requests: any[] = [];
      if (!hasTransactions && meta.sheets.length === 0) {
        requests.push({
          addSheet: {
            properties: { title: 'Transactions' },
          },
        });
      }
      if (!hasCategories && meta.sheets.length === 0) {
        requests.push({
          addSheet: {
            properties: { title: 'Categories' },
          },
        });
      }

      if (requests.length > 0) {
        await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests }),
        });
        await this.initializeHeadersAndCategories(accessToken, spreadsheetId);
      }
    } catch (err: any) {
      console.warn('ensureRequiredTabs skipped or not permitted (e.g. read-only sheet):', err?.message);
    }
  },

  /**
   * Read Categories from "Categories" tab safely
   */
  async readCategories(accessToken: string, spreadsheetId: string): Promise<CategoriesData> {
    try {
      const meta = await this.getSpreadsheet(accessToken, spreadsheetId);
      const catSheet = meta.sheets.find((s) => s.title.toLowerCase().includes('categor'));
      if (!catSheet) {
        return DEFAULT_CATEGORIES;
      }

      const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(catSheet.title)}'!A2:B100`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        return DEFAULT_CATEGORIES;
      }

      const data = await res.json();
      const rows: string[][] = data.values || [];

      const incomeCategories: string[] = [];
      const expenseCategories: string[] = [];

      rows.forEach((row) => {
        if (row[0] && row[0].trim() !== '') {
          const cat = row[0].trim();
          if (!incomeCategories.includes(cat)) {
            incomeCategories.push(cat);
          }
        }
        if (row[1] && row[1].trim() !== '') {
          const cat = row[1].trim();
          if (!expenseCategories.includes(cat)) {
            expenseCategories.push(cat);
          }
        }
      });

      return {
        incomeCategories: incomeCategories.length > 0 ? incomeCategories : DEFAULT_CATEGORIES.incomeCategories,
        expenseCategories: expenseCategories.length > 0 ? expenseCategories : DEFAULT_CATEGORIES.expenseCategories,
      };
    } catch {
      return DEFAULT_CATEGORIES;
    }
  },

  /**
   * Append a new category into the sheet
   */
  async addCategory(
    accessToken: string,
    spreadsheetId: string,
    type: TransactionType,
    categoryName: string
  ): Promise<void> {
    const cleanName = categoryName.trim();
    if (!cleanName) return;

    // Read current categories first to find next row
    const cats = await this.readCategories(accessToken, spreadsheetId);
    if (type === 'Income') {
      if (cats.incomeCategories.includes(cleanName)) return;
      const nextRow = cats.incomeCategories.length + 2; // +1 for 0-index, +1 for header
      await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Categories!A${nextRow}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[cleanName]],
        }),
      });
    } else {
      if (cats.expenseCategories.includes(cleanName)) return;
      const nextRow = cats.expenseCategories.length + 2;
      await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Categories!B${nextRow}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[cleanName]],
        }),
      });
    }
  },

  /**
   * Read transactions from all relevant sheet tabs (Transactions, Income, Expenses, Monthly tabs)
   */
  async readTransactions(accessToken: string, spreadsheetId: string, sheetTitle?: string): Promise<Transaction[]> {
    const meta = await this.getSpreadsheet(accessToken, spreadsheetId);

    let tabsToRead: { title: string; defaultType: TransactionType | null }[] = [];

    if (sheetTitle) {
      tabsToRead = [{ title: sheetTitle, defaultType: null }];
    } else {
      // Find candidate data sheets, excluding non-transaction tabs
      const candidateSheets = meta.sheets.filter((s) => {
        const lower = s.title.toLowerCase().trim();
        return (
          !lower.includes('categor') &&
          !lower.includes('dashboard') &&
          !lower.includes('summary') &&
          !lower.includes('setting') &&
          !lower.includes('config') &&
          !lower.includes('readme')
        );
      });

      // If there is an explicit "Transactions" tab, prioritize it
      const transTab = candidateSheets.find((s) => s.title.toLowerCase() === 'transactions');
      if (transTab) {
        tabsToRead = [{ title: transTab.title, defaultType: null }];
      } else if (candidateSheets.length > 0) {
        // Read candidate sheets (e.g. Income + Expenses, or Monthly sheets)
        tabsToRead = candidateSheets.map((s) => {
          const lower = s.title.toLowerCase();
          let defaultType: TransactionType | null = null;
          if (lower.includes('income') || lower.includes('receipt') || lower.includes('credit')) {
            defaultType = 'Income';
          } else if (lower.includes('expense') || lower.includes('debit') || lower.includes('spend')) {
            defaultType = 'Expense';
          }
          return { title: s.title, defaultType };
        });
      } else if (meta.sheets.length > 0) {
        tabsToRead = [{ title: meta.sheets[0].title, defaultType: null }];
      }
    }

    const allTransactions: Transaction[] = [];

    for (const tab of tabsToRead) {
      try {
        const res = await fetch(
          `${SHEETS_API_BASE}/${spreadsheetId}/values/'${encodeURIComponent(tab.title)}'!A1:Z3500`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          const rows: any[][] = data.values || [];
          if (rows.length > 0) {
            const parsed = parseTableRows(rows, tab.defaultType, tab.title);
            allTransactions.push(...parsed);
          }
        }
      } catch (err) {
        console.warn(`Could not read tab ${tab.title}:`, err);
      }
    }

    // Sort by date descending (newest first)
    allTransactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Re-index cleanly
    return allTransactions.map((tx, idx) => ({
      ...tx,
      rowIndex: idx + 2,
    }));
  },

  /**
   * Append a transaction to "Transactions" tab:
   * Writes [Date, Type, Category (empty ""), Amount, Description, Pay By, Pay from :]
   * Ensures Category column has all things removed.
   */
  async appendTransaction(
    accessToken: string,
    spreadsheetId: string,
    tx: Omit<Transaction, 'id' | 'rowIndex'>
  ): Promise<void> {
    const res = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Transactions!A:G:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[tx.date, tx.type, tx.category || '', tx.amount, tx.description, tx.payBy || 'Cash', tx.payFrom || 'Self']],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to record transaction (${res.status})`);
    }
  },

  /**
   * Clears all values from Category column (Column C) in the Transactions tab
   */
  async clearCategoryColumn(accessToken: string, spreadsheetId: string): Promise<void> {
    await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Transactions!C2:C5000:clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  },

  /**
   * Delete transaction row by row index (User confirmation dialog MUST precede this call)
   */
  async deleteTransaction(
    accessToken: string,
    spreadsheetId: string,
    rowIndex: number
  ): Promise<void> {
    // Look up the sheetId for "Transactions" tab
    const meta = await this.getSpreadsheet(accessToken, spreadsheetId);
    const txSheet = meta.sheets.find((s) => s.title === 'Transactions');
    if (!txSheet) {
      throw new Error('Transactions sheet tab not found');
    }

    const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: txSheet.id,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // 0-based inclusive
                endIndex: rowIndex, // 0-based exclusive
              },
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to delete row (${res.status})`);
    }
  },

  /**
   * Update the "Paid from :" person name in Column G for a specific row
   */
  async updatePaidFrom(
    accessToken: string,
    spreadsheetId: string,
    rowIndex: number,
    payerName: string
  ): Promise<void> {
    const res = await fetch(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Transactions!G${rowIndex}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[payerName]],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to update payer name (${res.status})`);
    }
  },
};
