import * as XLSX from 'xlsx';
import { Transaction, TransactionType } from '../types';

export interface ParsedSheetResult {
  transactions: Transaction[];
  monthlySummary?: {
    month: string;
    income: number;
    expenses: number;
    net: number;
  }[];
  categoryExpenses?: {
    category: string;
    amount: number;
  }[];
  sheetNames: string[];
  totalIncome: number;
  totalExpenses: number;
  errors: string[];
}

/**
 * Clean and parse currency/number strings (handles ₹, $, commas, negatives, etc.)
 */
export function parseAmount(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);

  const str = String(val)
    .replace(/[₹$€£\s,]/g, '')
    .trim();

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Parse date values into standard 'YYYY-MM-DD' format
 */
export function parseDate(val: any): string {
  if (!val) {
    return new Date().toISOString().split('T')[0];
  }

  // Handle Excel serial date numbers
  if (typeof val === 'number') {
    // Excel base date is Dec 30, 1899
    const utc_days = Math.floor(val - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    if (!isNaN(date_info.getTime())) {
      return date_info.toISOString().split('T')[0];
    }
  }

  const str = String(val).trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // If DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try standard Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Parse an Excel file (.xlsx, .xls) or CSV / text file.
 */
export async function parseSpreadsheetFile(fileOrText: File | string): Promise<ParsedSheetResult> {
  let workbook: XLSX.WorkBook;

  if (typeof fileOrText === 'string') {
    workbook = XLSX.read(fileOrText, { type: 'string' });
  } else {
    const arrayBuffer = await fileOrText.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
  }

  const transactions: Transaction[] = [];
  const errors: string[] = [];
  const sheetNames = workbook.SheetNames || [];

  const monthlySummary: { month: string; income: number; expenses: number; net: number }[] = [];
  const categoryExpenses: { category: string; amount: number }[] = [];

  // 1. First, search for specific sheets: "Transactions", "Income", "Expenses"
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    // Convert sheet to 2D array
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rawRows.length === 0) continue;

    const lowerName = name.toLowerCase();

    // Check if this sheet is "Dashboard" or TEQX summary sheet
    if (lowerName.includes('dash') || lowerName.includes('summary')) {
      parseDashboardSheet(rawRows, monthlySummary, categoryExpenses);
      continue;
    }

    // Identify if sheet is specifically Income or Expenses
    let defaultType: TransactionType | null = null;
    if (lowerName.includes('income') || lowerName.includes('receipt')) {
      defaultType = 'Income';
    } else if (lowerName.includes('expense')) {
      defaultType = 'Expense';
    }

    // Parse transaction table
    const parsedFromSheet = parseTableRows(rawRows, defaultType, name);
    transactions.push(...parsedFromSheet);
  }

  // If no transactions were extracted from named sheets, attempt to parse the first sheet directly
  if (transactions.length === 0 && sheetNames.length > 0) {
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    const parsed = parseTableRows(rawRows, null, sheetNames[0]);
    transactions.push(...parsed);
  }

  // Deduplicate and assign row indexes
  const finalTransactions = transactions.map((tx, idx) => ({
    ...tx,
    id: tx.id || `uploaded-${Date.now()}-${idx + 1}`,
    rowIndex: idx + 2, // 1 is header
  }));

  // Calculate totals
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const tx of finalTransactions) {
    if (tx.type === 'Income') totalIncome += tx.amount;
    else totalExpenses += tx.amount;
  }

  return {
    transactions: finalTransactions,
    monthlySummary,
    categoryExpenses,
    sheetNames,
    totalIncome,
    totalExpenses,
    errors,
  };
}

/**
 * Parse rows of a tabular sheet (e.g. Transactions, Income, Expenses, Sheet1)
 */
function parseTableRows(
  rows: any[][],
  defaultType: TransactionType | null,
  sheetName: string
): Transaction[] {
  const result: Transaction[] = [];

  // Find header row (search first 15 rows)
  let headerRowIndex = -1;
  let colMap = {
    date: -1,
    type: -1,
    amount: -1,
    description: -1,
    payBy: -1,
    payFrom: -1,
    category: -1,
  };

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rowStrings = row.map((c) => String(c || '').toLowerCase().trim());

    const dateIdx = rowStrings.findIndex((s) => s.includes('date') || s === 'dt');
    const amountIdx = rowStrings.findIndex(
      (s) => s.includes('amount') || s.includes('total') || s.includes('val') || s === 'net'
    );

    if (dateIdx !== -1 || amountIdx !== -1) {
      headerRowIndex = r;
      colMap.date = dateIdx;
      colMap.amount = amountIdx;
      colMap.type = rowStrings.findIndex((s) => s === 'type' || s.includes('transaction type') || s.includes('cr/dr'));
      colMap.description = rowStrings.findIndex(
        (s) => s.includes('desc') || s.includes('particular') || s.includes('detail') || s.includes('note') || s.includes('memo')
      );
      colMap.payBy = rowStrings.findIndex(
        (s) => s.includes('pay by') || s.includes('payment method') || s.includes('mode') || s.includes('method')
      );
      colMap.payFrom = rowStrings.findIndex(
        (s) => s.includes('paid from') || s.includes('pay from') || s.includes('payer') || s.includes('person')
      );
      colMap.category = rowStrings.findIndex((s) => s.includes('category') || s.includes('head'));
      break;
    }
  }

  // If no clear header was found, use standard 7-column layout (A=Date, B=Type, C=Category, D=Amount, E=Desc, F=PayBy, G=PaidFrom)
  if (headerRowIndex === -1) {
    headerRowIndex = 0;
    colMap = {
      date: 0,
      type: 1,
      category: 2,
      amount: 3,
      description: 4,
      payBy: 5,
      payFrom: 6,
    };
  }

  // Parse data rows
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Check if row has at least an amount or date
    const rawAmount = colMap.amount !== -1 ? row[colMap.amount] : null;
    const amount = parseAmount(rawAmount);

    if (amount <= 0 && (!rawAmount || String(rawAmount).trim() === '')) {
      continue;
    }

    const rawDate = colMap.date !== -1 ? row[colMap.date] : null;
    const date = parseDate(rawDate);

    // Determine type (Income or Expense)
    let type: TransactionType = defaultType || 'Expense';
    if (colMap.type !== -1 && row[colMap.type]) {
      const typeStr = String(row[colMap.type]).toLowerCase().trim();
      if (typeStr.includes('inc') || typeStr.includes('credit') || typeStr.includes('cr') || typeStr.includes('deposit')) {
        type = 'Income';
      } else if (typeStr.includes('exp') || typeStr.includes('debit') || typeStr.includes('dr') || typeStr.includes('payment')) {
        type = 'Expense';
      }
    }

    const desc = colMap.description !== -1 && row[colMap.description]
      ? String(row[colMap.description]).trim()
      : `${type} recorded`;

    const payBy = colMap.payBy !== -1 && row[colMap.payBy]
      ? String(row[colMap.payBy]).trim()
      : 'UPI';

    const payFrom = colMap.payFrom !== -1 && row[colMap.payFrom]
      ? String(row[colMap.payFrom]).trim()
      : 'Self';

    result.push({
      id: `import-${sheetName}-${r}-${Date.now()}`,
      date,
      type,
      category: '', // Kept empty as requested
      amount,
      description: desc,
      payBy,
      payFrom,
    });
  }

  return result;
}

/**
 * Parse dashboard / summary sheets like TEQX Monthly Cash Flow table
 */
function parseDashboardSheet(
  rows: any[][],
  monthlySummary: { month: string; income: number; expenses: number; net: number }[],
  categoryExpenses: { category: string; amount: number }[]
) {
  let isParsingMonthly = false;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rowStrings = row.map((c) => String(c || '').trim());
    const rowLower = rowStrings.map((s) => s.toLowerCase());

    // Check for "Monthly Cash Flow" header
    if (rowLower.some((s) => s.includes('monthly cash flow') || s === 'month')) {
      isParsingMonthly = true;
      continue;
    }

    if (rowLower.some((s) => s.includes('how to use') || s.includes('connect. automate'))) {
      isParsingMonthly = false;
    }

    // If in monthly cash flow block
    if (isParsingMonthly && rowStrings[0]) {
      const monthStr = rowStrings[0];
      // Check if it's like Jan-2026, Feb-2026, or Month name
      if (/^[a-zA-Z]{3}-\d{4}$/.test(monthStr) || /^[a-zA-Z]+$/.test(monthStr)) {
        const inc = parseAmount(rowStrings[1]);
        const exp = parseAmount(rowStrings[2]);
        const net = parseAmount(rowStrings[3]);
        monthlySummary.push({
          month: monthStr,
          income: inc,
          expenses: exp,
          net: net !== 0 ? net : inc - exp,
        });
      }
    }

    // Check for Category Expense block (e.g. column 5 and 6)
    for (let c = 0; c < rowStrings.length - 1; c++) {
      const colText = rowStrings[c];
      const nextCol = rowStrings[c + 1];
      if (
        colText &&
        nextCol &&
        (colText.includes('Software') ||
          colText.includes('WhatsApp') ||
          colText.includes('Cloud') ||
          colText.includes('Marketing') ||
          colText.includes('Office') ||
          colText.includes('Salary') ||
          colText.includes('Taxes'))
      ) {
        const amt = parseAmount(nextCol);
        categoryExpenses.push({
          category: colText,
          amount: amt,
        });
      }
    }
  }
}
