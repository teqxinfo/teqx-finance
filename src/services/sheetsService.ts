import { CategoriesData, Transaction, TransactionType } from '../types';
import { DEFAULT_CATEGORIES } from '../data/mockData';

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
   * Verify and add missing required tabs
   */
  async ensureRequiredTabs(accessToken: string, spreadsheetId: string): Promise<void> {
    const meta = await this.getSpreadsheet(accessToken, spreadsheetId);
    const hasTransactions = meta.sheets.some((s) => s.title === 'Transactions');
    const hasCategories = meta.sheets.some((s) => s.title === 'Categories');

    const requests: any[] = [];
    if (!hasTransactions) {
      requests.push({
        addSheet: {
          properties: { title: 'Transactions' },
        },
      });
    }
    if (!hasCategories) {
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
  },

  /**
   * Read Categories from "Categories" tab:
   * Column A is Income Categories, Column B is Expense Categories
   */
  async readCategories(accessToken: string, spreadsheetId: string): Promise<CategoriesData> {
    const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Categories!A2:B100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to read categories (${res.status})`);
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
   * Read transactions from "Transactions" tab:
   * Columns: Date (A), Type (B), Category (C), Amount (D), Description (E), Pay By (F), Pay from : (G)
   */
  async readTransactions(accessToken: string, spreadsheetId: string): Promise<Transaction[]> {
    const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/Transactions!A2:G2000`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to read transactions (${res.status})`);
    }

    const data = await res.json();
    const rows: any[][] = data.values || [];

    const transactions: Transaction[] = [];

    rows.forEach((row, idx) => {
      const date = row[0] || '';
      const type = (row[1] || 'Expense') as TransactionType;
      // Category column is cleared / kept empty as requested
      const category = '';
      const rawAmount = typeof row[3] === 'string' ? row[3].replace(/[₹$,\s]/g, '').replace(/Rs\.?/gi, '') : row[3];
      const amount = parseFloat(rawAmount) || 0;
      const description = row[4] || '';
      const payBy = row[5] || '';
      const payFrom = row[6] || '';

      if (date || amount > 0 || description || payBy || payFrom) {
        transactions.push({
          id: `row-${idx + 2}-${Date.now()}`,
          date,
          type: type === 'Income' ? 'Income' : 'Expense',
          category,
          amount,
          description,
          payBy,
          payFrom,
          rowIndex: idx + 2, // 1-based index (row 1 is header)
        });
      }
    });

    return transactions;
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
          // Notice: 3rd element (Category column) is explicitly empty string ""
          values: [[tx.date, tx.type, '', tx.amount, tx.description, tx.payBy || 'Cash', tx.payFrom || 'Self']],
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
