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
 * Checks whether the fetched string is an HTML error / Google Login / cookie interstitial
 * rather than real CSV or tabular spreadsheet data.
 */
export function isHtmlOrLoginResponse(text: string): boolean {
  if (!text || !text.trim()) return true;
  const trimmed = text.trim();

  // HTML or XML tags at start
  if (
    trimmed.startsWith('<') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<style') ||
    trimmed.startsWith('<script') ||
    trimmed.startsWith('<div') ||
    trimmed.startsWith('<?xml')
  ) {
    return true;
  }

  // Google Login / Storage / Auth keywords anywhere in response
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('sign in to your google account') ||
    lower.includes('accounts.google.com') ||
    lower.includes('servicelogin') ||
    lower.includes('allow google sheets access to your necessary cookies') ||
    lower.includes('request-storage-access') ||
    lower.includes('too-many-login-redirects') ||
    lower.includes('google.visualization.query.setresponse({"version":"0.6","status":"error"')
  ) {
    return true;
  }

  return false;
}

/**
 * Clean and parse currency/number strings (handles ₹, $, commas, accounting parentheses, etc.)
 */
export function parseAmount(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.abs(val);

  let str = String(val).trim();
  if (!str) return 0;

  // Handle accounting parentheses format: (1,234.50) -> 1234.50
  const parenMatch = str.match(/\(\s*([0-9.,\s₹$€£Rs]+)\s*\)/i);
  if (parenMatch) {
    str = parenMatch[1];
  }

  // Remove currency signs, words, trailing /-, spaces, dr/cr tags
  str = str
    .replace(/[₹$€£\s]/g, '')
    .replace(/Rs\.?/gi, '')
    .replace(/\/[-–]/g, '')
    .replace(/\b(cr|dr|inr|usd)\b/gi, '')
    .trim();

  // Remove commas used as thousands separators (e.g. 1,50,000.50 -> 150000.50)
  str = str.replace(/,/g, '');

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Detects whether a raw amount representation was explicitly negative (expense/debit)
 */
export function isAmountNegative(val: any): boolean {
  if (typeof val === 'number') return val < 0;
  const str = String(val).trim();
  return (
    str.startsWith('-') ||
    str.endsWith('-') ||
    /^\(.*\)$/.test(str) ||
    /\bdr\b/i.test(str)
  );
}

/**
 * Check if a value is likely a date string or Excel date serial number
 */
export function isLikelyDate(val: any): boolean {
  if (!val) return false;
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'number') {
    // Excel date serial numbers typically between 25000 (1968) and 70000 (2091)
    return val >= 25000 && val <= 70000;
  }
  const str = String(val).trim();
  if (!str) return false;

  // Reject summary words that might be in first column
  const lower = str.toLowerCase();
  if (
    lower.includes('total') ||
    lower.includes('balance') ||
    lower.includes('summary') ||
    lower.includes('average') ||
    lower.includes('count')
  ) {
    return false;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(str)) return true;
  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(str)) return true;
  // Month DD, YYYY or DD Mon YYYY
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}/.test(str)) return true;
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/.test(str)) return true;

  const parsed = Date.parse(str);
  return !isNaN(parsed);
}

/**
 * Parse date values into standard 'YYYY-MM-DD' format without timezone distortion
 */
export function parseDate(val: any): string {
  if (!val) {
    return new Date().toISOString().split('T')[0];
  }

  // Handle native Date objects
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Handle Excel serial date numbers using SheetJS date decoder
  if (typeof val === 'number') {
    try {
      const parsedObj = (XLSX.SSF as any)?.parse_date_code?.(val);
      if (parsedObj && parsedObj.y && parsedObj.m && parsedObj.d) {
        const y = parsedObj.y;
        const m = String(parsedObj.m).padStart(2, '0');
        const d = String(parsedObj.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {}

    const utc_days = Math.floor(val - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    if (!isNaN(date_info.getTime())) {
      const y = date_info.getUTCFullYear();
      const m = String(date_info.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date_info.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // If YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If DD/MM/YYYY or DD-MM-YYYY (or MM/DD/YYYY)
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmyMatch) {
    let part1 = parseInt(dmyMatch[1], 10);
    let part2 = parseInt(dmyMatch[2], 10);
    let year = dmyMatch[3];
    if (year.length === 2) year = `20${year}`;

    let day = part1;
    let month = part2;

    // If month is > 12, part1 must be day and part2 month.
    // If part1 <= 12 and part2 > 12, part1 is month and part2 day.
    if (part1 <= 12 && part2 > 12) {
      month = part1;
      day = part2;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
 * Income keywords to automatically categorize transactions if Type column is missing
 */
const INCOME_KEYWORDS = [
  'salary',
  'stipend',
  'freelance',
  'bonus',
  'dividend',
  'interest',
  'refund',
  'cashback',
  'sales',
  'revenue',
  'commission',
  'deposit',
  'inflow',
  'rent received',
  'rental income',
  'credit',
  'cr',
  'profit',
  'consulting',
  'client payment',
];

/**
 * Summary row keywords to skip so totals and averages are not treated as transactions
 */
const SUMMARY_KEYWORDS = [
  'total',
  'subtotal',
  'sub-total',
  'grand total',
  'balance c/f',
  'balance b/f',
  'opening balance',
  'closing balance',
  'net balance',
  'monthly total',
  'yearly total',
  'average',
  'count',
];

/**
 * Parse an Excel file (.xlsx, .xls) or CSV / text file.
 */
export async function parseSpreadsheetFile(fileOrText: File | string): Promise<ParsedSheetResult> {
  // Guard against HTML error pages being treated as valid spreadsheets
  if (typeof fileOrText === 'string' && isHtmlOrLoginResponse(fileOrText)) {
    throw new Error(
      'Access Restricted by Google: This Google Sheet requires Google Account authorization. Please ensure the Google Sheet is shared with "Anyone with the link can view", or click "Connect Google Sheets" to sign in with your Google account.'
    );
  }

  let workbook: XLSX.WorkBook;

  if (typeof fileOrText === 'string') {
    workbook = XLSX.read(fileOrText, { type: 'string', cellDates: true });
  } else {
    const arrayBuffer = await fileOrText.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  }

  const transactions: Transaction[] = [];
  const errors: string[] = [];
  const sheetNames = workbook.SheetNames || [];

  const monthlySummary: { month: string; income: number; expenses: number; net: number }[] = [];
  const categoryExpenses: { category: string; amount: number }[] = [];

  // Parse each sheet in the workbook
  for (const name of sheetNames) {
    const lowerName = name.toLowerCase().trim();

    // Skip sheets that are strictly category listings, settings, or dashboard summaries
    if (
      lowerName === 'categories' ||
      lowerName.includes('category') ||
      lowerName === 'settings' ||
      lowerName === 'config'
    ) {
      continue;
    }

    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    // Convert sheet to 2D array
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rawRows.length === 0) continue;

    // Check if this sheet is a summary dashboard
    if (lowerName.includes('dash') || lowerName.includes('summary')) {
      parseDashboardSheet(rawRows, monthlySummary, categoryExpenses);
      continue;
    }

    // Identify if sheet is specifically Income or Expenses
    let defaultType: TransactionType | null = null;
    if (lowerName.includes('income') || lowerName.includes('receipt') || lowerName.includes('credit')) {
      defaultType = 'Income';
    } else if (lowerName.includes('expense') || lowerName.includes('debit') || lowerName.includes('spend')) {
      defaultType = 'Expense';
    }

    // Parse transaction table
    const parsedFromSheet = parseTableRows(rawRows, defaultType, name);
    transactions.push(...parsedFromSheet);
  }

  // Deduplicate and assign row indexes
  const finalTransactions = transactions.map((tx, idx) => ({
    ...tx,
    id: tx.id || `uploaded-${Date.now()}-${idx + 1}`,
    rowIndex: idx + 2,
  }));

  // Sort descending by date (latest first)
  finalTransactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

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
 * Universal table row parser for Google Sheets and CSVs.
 * Features:
 * - Tolerant header matching.
 * - Automatic heuristic column detection if no explicit header exists.
 * - Supports separate Debit (Expenses) & Credit (Income) columns.
 * - Filters out summary/total/balance rows to prevent inflated figures.
 * - Accurate date decoding without timezone drift.
 */
export function parseTableRows(
  rows: any[][],
  defaultType: TransactionType | null,
  sheetName: string
): Transaction[] {
  const result: Transaction[] = [];
  if (!rows || rows.length === 0) return result;

  // Find header row (search first 15 rows)
  let headerRowIndex = -1;
  let colMap = {
    date: -1,
    type: -1,
    amount: -1,
    debit: -1,
    credit: -1,
    description: -1,
    payBy: -1,
    payFrom: -1,
    category: -1,
  };

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rowStrings = row.map((c) =>
      String(c || '')
        .toLowerCase()
        .replace(/[:#]/g, '')
        .trim()
    );

    const dateIdx = rowStrings.findIndex(
      (s) =>
        s.includes('date') ||
        s === 'dt' ||
        s.includes('day') ||
        s.includes('time') ||
        s.includes('period') ||
        s.includes('month') ||
        s.includes('txn dt') ||
        s.includes('txn date') ||
        s.includes('posting date') ||
        s.includes('value date')
    );

    const amountIdx = rowStrings.findIndex(
      (s) =>
        (s.includes('amount') ||
          s.includes('total') ||
          s.includes('val') ||
          s === 'net' ||
          s.includes('price') ||
          s.includes('cost') ||
          s.includes('inr') ||
          s.includes('₹') ||
          s.includes('rs') ||
          s.includes('sum')) &&
        !s.includes('debit') &&
        !s.includes('credit') &&
        !s.includes('category')
    );

    const debitIdx = rowStrings.findIndex(
      (s) =>
        (s === 'debit' ||
          s === 'dr' ||
          s.includes('debit amount') ||
          s.includes('withdrawal') ||
          s.includes('outflow') ||
          s === 'expense' ||
          s === 'expenses' ||
          s === 'paid' ||
          s.includes('expense amount')) &&
        !s.includes('category') &&
        !s.includes('head') &&
        !s.includes('type') &&
        !s.includes('mode')
    );

    const creditIdx = rowStrings.findIndex(
      (s) =>
        (s === 'credit' ||
          s === 'cr' ||
          s.includes('credit amount') ||
          s.includes('deposit') ||
          s.includes('inflow') ||
          s.includes('receipt') ||
          s === 'income' ||
          s === 'received' ||
          s.includes('income amount')) &&
        !s.includes('category') &&
        !s.includes('head') &&
        !s.includes('type') &&
        !s.includes('mode')
    );

    if (dateIdx !== -1 || amountIdx !== -1 || (debitIdx !== -1 && creditIdx !== -1)) {
      headerRowIndex = r;
      colMap.date = dateIdx;
      colMap.amount = amountIdx;
      colMap.debit = debitIdx;
      colMap.credit = creditIdx;

      colMap.type = rowStrings.findIndex(
        (s) =>
          (s === 'type' ||
            s.includes('txn type') ||
            s.includes('transaction type') ||
            s.includes('cr/dr') ||
            s.includes('dr/cr') ||
            s.includes('flow') ||
            s.includes('entry type')) &&
          !s.includes('payment') &&
          !s.includes('category')
      );

      colMap.description = rowStrings.findIndex(
        (s) =>
          s.includes('desc') ||
          s.includes('particular') ||
          s.includes('detail') ||
          s.includes('narrat') ||
          s.includes('note') ||
          s.includes('memo') ||
          s.includes('remark') ||
          s.includes('merchant') ||
          s.includes('payee') ||
          s.includes('item') ||
          s.includes('purpose') ||
          s.includes('title') ||
          s.includes('reason')
      );

      colMap.payBy = rowStrings.findIndex(
        (s) =>
          s.includes('pay by') ||
          s.includes('payment method') ||
          s.includes('payment mode') ||
          s.includes('mode') ||
          s.includes('method') ||
          s.includes('channel') ||
          s.includes('bank') ||
          s.includes('account') ||
          s.includes('wallet') ||
          s.includes('via')
      );

      colMap.payFrom = rowStrings.findIndex(
        (s) =>
          s.includes('paid from') ||
          s.includes('pay from') ||
          s.includes('payer') ||
          s.includes('paid by') ||
          s.includes('person') ||
          s.includes('from') ||
          s.includes('who paid')
      );

      colMap.category = rowStrings.findIndex(
        (s) =>
          s.includes('category') ||
          s.includes('head') ||
          s.includes('classification') ||
          s.includes('tag') ||
          s.includes('group')
      );
      break;
    }
  }

  // If no clear header was matched, perform heuristic detection from sample data rows
  if (headerRowIndex === -1 || (colMap.amount === -1 && colMap.debit === -1 && colMap.credit === -1)) {
    headerRowIndex = 0; // Assume row 0 is header

    const sampleRows = rows.slice(1, 12);
    const maxCols = Math.max(...rows.slice(0, 12).map((r) => r.length), 0);

    const colDateScores: number[] = new Array(maxCols).fill(0);
    const colNumberScores: number[] = new Array(maxCols).fill(0);
    const colTextScores: number[] = new Array(maxCols).fill(0);

    sampleRows.forEach((r) => {
      r.forEach((cell, cIdx) => {
        if (cell === null || cell === undefined || cell === '') return;
        if (isLikelyDate(cell)) {
          colDateScores[cIdx]++;
        } else if (parseAmount(cell) > 0) {
          colNumberScores[cIdx]++;
        } else if (typeof cell === 'string' && cell.trim().length > 1) {
          colTextScores[cIdx]++;
        }
      });
    });

    // Best date column
    const bestDateCol = colDateScores.indexOf(Math.max(...colDateScores));
    if (colDateScores[bestDateCol] > 0) {
      colMap.date = bestDateCol;
    } else {
      colMap.date = 0;
    }

    // Best amount column
    let bestNumCol = -1;
    let maxNumScore = 0;
    colNumberScores.forEach((score, cIdx) => {
      if (cIdx !== colMap.date && score > maxNumScore) {
        maxNumScore = score;
        bestNumCol = cIdx;
      }
    });

    if (bestNumCol !== -1 && maxNumScore > 0) {
      colMap.amount = bestNumCol;
    } else {
      // Default to 7-column schema if heuristics inconclusive
      colMap = {
        date: 0,
        type: 1,
        category: 2,
        amount: 3,
        debit: -1,
        credit: -1,
        description: 4,
        payBy: 5,
        payFrom: 6,
      };
    }

    // Best description column
    let bestDescCol = -1;
    let maxTextScore = 0;
    colTextScores.forEach((score, cIdx) => {
      if (cIdx !== colMap.date && cIdx !== colMap.amount && score > maxTextScore) {
        maxTextScore = score;
        bestDescCol = cIdx;
      }
    });
    if (bestDescCol !== -1) {
      colMap.description = bestDescCol;
    }
  }

  // Parse data rows
  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Filter out summary/total/balance rows
    const firstCell = String(row[0] || '').toLowerCase().trim();
    const rowJoined = row.map((c) => String(c || '').toLowerCase().trim()).join(' ');

    const isSummaryRow = SUMMARY_KEYWORDS.some(
      (kw) => firstCell === kw || rowJoined.startsWith(kw) || rowJoined.includes(` ${kw}`)
    );
    if (isSummaryRow) {
      continue;
    }

    // 1. Check separate Debit / Credit columns
    if (colMap.debit !== -1 && colMap.credit !== -1) {
      const rawDebit = row[colMap.debit];
      const rawCredit = row[colMap.credit];
      const debitAmt = parseAmount(rawDebit);
      const creditAmt = parseAmount(rawCredit);

      if (debitAmt > 0) {
        const rawDate = colMap.date !== -1 ? row[colMap.date] : null;
        result.push(buildTransaction(row, colMap, 'Expense', debitAmt, rawDate, sheetName, r));
        continue;
      } else if (creditAmt > 0) {
        const rawDate = colMap.date !== -1 ? row[colMap.date] : null;
        result.push(buildTransaction(row, colMap, 'Income', creditAmt, rawDate, sheetName, r));
        continue;
      }
    }

    // 2. Single Amount column
    const rawAmount = colMap.amount !== -1 ? row[colMap.amount] : null;
    const amount = parseAmount(rawAmount);

    if (amount <= 0) {
      continue;
    }

    const rawDate = colMap.date !== -1 ? row[colMap.date] : null;

    // Determine type (Income or Expense)
    let type: TransactionType = defaultType || 'Expense';

    // A. If explicit Type column exists
    if (colMap.type !== -1 && row[colMap.type]) {
      const typeStr = String(row[colMap.type]).toLowerCase().trim();
      if (
        typeStr.includes('inc') ||
        typeStr.includes('credit') ||
        typeStr === 'cr' ||
        typeStr.includes('deposit') ||
        typeStr.includes('receipt') ||
        typeStr.includes('inflow') ||
        typeStr === '+'
      ) {
        type = 'Income';
      } else if (
        typeStr.includes('exp') ||
        typeStr.includes('debit') ||
        typeStr === 'dr' ||
        typeStr.includes('payment') ||
        typeStr.includes('spend') ||
        typeStr.includes('outflow') ||
        typeStr === '-'
      ) {
        type = 'Expense';
      }
    } else {
      // B. If no explicit Type column, check if amount is negative
      if (isAmountNegative(rawAmount)) {
        type = 'Expense';
      } else {
        // C. Check category and description for income indicators
        const descText = (
          (colMap.description !== -1 ? String(row[colMap.description] || '') : '') +
          ' ' +
          (colMap.category !== -1 ? String(row[colMap.category] || '') : '')
        ).toLowerCase();

        const isIncome = INCOME_KEYWORDS.some((kw) => descText.includes(kw));
        if (isIncome) {
          type = 'Income';
        } else if (defaultType) {
          type = defaultType;
        } else {
          type = 'Expense';
        }
      }
    }

    result.push(buildTransaction(row, colMap, type, amount, rawDate, sheetName, r));
  }

  return result;
}

/**
 * Helper to construct a normalized Transaction record from row cells
 */
function buildTransaction(
  row: any[],
  colMap: any,
  type: TransactionType,
  amount: number,
  rawDate: any,
  sheetName: string,
  rowIndex: number
): Transaction {
  const date = parseDate(rawDate);

  let desc = '';
  if (colMap.description !== -1 && row[colMap.description]) {
    desc = String(row[colMap.description]).trim();
  }
  if (!desc) {
    desc = `${type} recorded`;
  }

  let payBy = 'UPI';
  if (colMap.payBy !== -1 && row[colMap.payBy]) {
    const val = String(row[colMap.payBy]).trim();
    if (val) payBy = val;
  }

  let payFrom = 'Self';
  if (colMap.payFrom !== -1 && row[colMap.payFrom]) {
    const val = String(row[colMap.payFrom]).trim();
    if (val) payFrom = val;
  }

  let category = '';
  if (colMap.category !== -1 && row[colMap.category]) {
    category = String(row[colMap.category]).trim();
  }

  return {
    id: `import-${sheetName}-${rowIndex + 1}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date,
    type,
    category,
    amount,
    description: desc,
    payBy,
    payFrom,
    rowIndex: rowIndex + 1,
  };
}

/**
 * Parse dashboard / summary sheets like TEQX Monthly Cash Flow table
 */
function parseDashboardSheet(
  rows: any[][],
  monthlySummary: { month: string; income: number; expenses: number; net: number }[],
  categoryExpenses: { category: string; amount: number }[]
) {
  let inMonthlySection = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rowStr = row.map((c) => String(c || '').toLowerCase().trim());

    if (rowStr.some((s) => s.includes('monthly cash flow') || s.includes('cash flow summary'))) {
      inMonthlySection = true;
      continue;
    }

    if (inMonthlySection) {
      if (rowStr[0] && rowStr[0].includes('total')) {
        inMonthlySection = false;
        continue;
      }

      const monthName = String(row[0] || '').trim();
      const inc = parseAmount(row[1]);
      const exp = parseAmount(row[2]);

      if (monthName && (inc > 0 || exp > 0)) {
        monthlySummary.push({
          month: monthName,
          income: inc,
          expenses: exp,
          net: inc - exp,
        });
      }
    }
  }
}
