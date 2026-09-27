import { Transaction } from '../types';
import { parseSpreadsheetFile, parseTableRows, isHtmlOrLoginResponse, ParsedSheetResult } from './sheetParser';
import { sheetsService } from '../services/sheetsService';

export interface GoogleSheetFetchResult {
  sheetId: string;
  sheetUrl: string;
  title: string;
  transactions: Transaction[];
  parsedResult: ParsedSheetResult;
  usedAuth: boolean;
}

/**
 * Extracts spreadsheet ID and optional GID from Google Sheets URL or raw ID
 */
export function extractGoogleSheetDetails(urlOrId: string): { sheetId: string; gid?: string } | null {
  const input = urlOrId.trim();
  if (!input) return null;

  // Check for standard docs.google.com/spreadsheets/d/ID URL
  const matchId = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  let sheetId = matchId ? matchId[1] : '';

  // If not matched by URL, check if the input itself is a raw 20+ character spreadsheet ID
  if (!sheetId && /^[a-zA-Z0-9-_]{20,}$/.test(input)) {
    sheetId = input;
  }

  if (!sheetId) return null;

  // Extract gid (sheet tab identifier) if present
  let gid: string | undefined;
  const gidMatch = input.match(/[?&#]gid=([0-9]+)/);
  if (gidMatch) {
    gid = gidMatch[1];
  }

  return { sheetId, gid };
}

/**
 * Fetches Google Sheet data directly via link or API and parses into Transactions.
 * Gracefully handles public/shared links, custom sheet tab names, and private sheets with OAuth.
 */
export async function fetchGoogleSheetDirect(
  urlOrId: string,
  accessToken?: string | null
): Promise<GoogleSheetFetchResult> {
  const details = extractGoogleSheetDetails(urlOrId);
  if (!details) {
    throw new Error('Invalid Google Sheet link. Please paste a valid Google Sheets URL (e.g. https://docs.google.com/spreadsheets/d/.../edit)');
  }

  const { sheetId, gid } = details;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit${gid ? `#gid=${gid}` : ''}`;
  let title = 'Google Sheet Tracker';
  let hadAuthWall = false;

  // =========================================================================
  // Strategy 1: Google Sheets REST API v4 (if user is authenticated with token)
  // =========================================================================
  if (accessToken) {
    try {
      const meta = await sheetsService.getSpreadsheet(accessToken, sheetId);
      title = meta.title || title;

      // Read transactions across all relevant data sheets
      const apiTransactions = await sheetsService.readTransactions(accessToken, sheetId);

      if (apiTransactions && apiTransactions.length > 0) {
        let totalInc = 0;
        let totalExp = 0;
        apiTransactions.forEach((t) => {
          if (t.type === 'Income') totalInc += t.amount;
          else totalExp += t.amount;
        });

        const parsedResult: ParsedSheetResult = {
          transactions: apiTransactions,
          sheetNames: meta.sheets.map((s) => s.title),
          totalIncome: totalInc,
          totalExpenses: totalExp,
          errors: [],
        };

        return {
          sheetId,
          sheetUrl,
          title,
          transactions: apiTransactions,
          parsedResult,
          usedAuth: true,
        };
      }
    } catch (apiErr: any) {
      console.warn('Sheets API attempt failed, trying public export endpoints:', apiErr.message);
    }
  }

  // =========================================================================
  // Strategy 2: Google Visualization API and Direct CSV/XLSX Export (Public/Shared)
  // =========================================================================
  // Priority 2A: Try downloading the full Excel workbook if accessible
  try {
    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
    const xlsxResp = await fetch(xlsxUrl);
    if (xlsxResp.ok) {
      const arrayBuffer = await xlsxResp.arrayBuffer();
      // Check if it's really a zip/xlsx buffer (starts with PK / 0x50 0x4B)
      const u8 = new Uint8Array(arrayBuffer.slice(0, 4));
      if (u8[0] === 0x50 && u8[1] === 0x4b) {
        const parsed = await parseSpreadsheetFile(new File([arrayBuffer], 'sheet.xlsx'));
        if (parsed.transactions.length > 0) {
          return {
            sheetId,
            sheetUrl,
            title,
            transactions: parsed.transactions,
            parsedResult: parsed,
            usedAuth: false,
          };
        }
      }
    }
  } catch {
    // Cross-origin redirect on binary download; fallback to GViz CSV
  }

  // Priority 2B: Query candidate GViz tabs
  const tabNamesToTry = ['Transactions', 'Income', 'Expenses', 'Expense', 'Sheet1'];
  const gatheredTransactions: Transaction[] = [];
  const discoveredSheets: string[] = [];

  // Try GID if specifically provided in the URL
  if (gid) {
    const gidUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
    try {
      const resp = await fetch(gidUrl);
      if (resp.ok) {
        const text = await resp.text();
        if (text && !isHtmlOrLoginResponse(text)) {
          const parsed = await parseSpreadsheetFile(text);
          if (parsed.transactions.length > 0) {
            gatheredTransactions.push(...parsed.transactions);
            discoveredSheets.push(`Tab-${gid}`);
          }
        } else if (text && isHtmlOrLoginResponse(text)) {
          hadAuthWall = true;
        }
      }
    } catch {}
  }

  // Try default active sheet
  const defaultUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
  try {
    const resp = await fetch(defaultUrl);
    if (resp.ok) {
      const text = await resp.text();
      if (text && !isHtmlOrLoginResponse(text)) {
        const parsed = await parseSpreadsheetFile(text);
        if (parsed.transactions.length > 0) {
          // Merge unique transactions
          const existingKeys = new Set(
            gatheredTransactions.map((t) => `${t.date}-${t.amount}-${t.description.trim().toLowerCase()}`)
          );
          for (const tx of parsed.transactions) {
            const key = `${tx.date}-${tx.amount}-${tx.description.trim().toLowerCase()}`;
            if (!existingKeys.has(key)) {
              gatheredTransactions.push(tx);
              existingKeys.add(key);
            }
          }
          discoveredSheets.push('Active Sheet');
        }
      } else if (text && isHtmlOrLoginResponse(text)) {
        hadAuthWall = true;
      }
    }
  } catch {}

  // Also query common tab names to avoid missing Income/Expenses split tabs
  for (const tab of tabNamesToTry) {
    const tabUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    try {
      const resp = await fetch(tabUrl);
      if (resp.ok) {
        const text = await resp.text();
        if (text && !isHtmlOrLoginResponse(text) && !text.includes('error_detailed_message')) {
          let defaultType: 'Income' | 'Expense' | null = null;
          if (tab.toLowerCase().includes('income')) defaultType = 'Income';
          if (tab.toLowerCase().includes('expense')) defaultType = 'Expense';

          const parsed = await parseSpreadsheetFile(text);
          if (parsed.transactions.length > 0) {
            const existingKeys = new Set(
              gatheredTransactions.map((t) => `${t.date}-${t.amount}-${t.description.trim().toLowerCase()}`)
            );
            for (const tx of parsed.transactions) {
              if (defaultType && !tx.type) tx.type = defaultType;
              const key = `${tx.date}-${tx.amount}-${tx.description.trim().toLowerCase()}`;
              if (!existingKeys.has(key)) {
                gatheredTransactions.push(tx);
                existingKeys.add(key);
              }
            }
            if (!discoveredSheets.includes(tab)) {
              discoveredSheets.push(tab);
            }
          }
        }
      }
    } catch {}
  }

  if (gatheredTransactions.length > 0) {
    // Sort descending by date
    gatheredTransactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let totalInc = 0;
    let totalExp = 0;
    gatheredTransactions.forEach((t) => {
      if (t.type === 'Income') totalInc += t.amount;
      else totalExp += t.amount;
    });

    const parsedResult: ParsedSheetResult = {
      transactions: gatheredTransactions,
      sheetNames: discoveredSheets,
      totalIncome: totalInc,
      totalExpenses: totalExp,
      errors: [],
    };

    return {
      sheetId,
      sheetUrl,
      title,
      transactions: gatheredTransactions,
      parsedResult,
      usedAuth: false,
    };
  }

  // If no transactions could be extracted:
  if (hadAuthWall) {
    throw new Error(
      'Access Restricted by Google: This Google Sheet requires Google Account permissions. To connect via link: in Google Sheets, click "Share" > change General access to "Anyone with the link (Viewer)". Or click "Sign In with Google" below to authenticate.'
    );
  }

  throw new Error(
    'Unable to load transactions from this Google Sheet link. Please ensure the link is correct and that the sheet is shared with "Anyone with the link can view".'
  );
}
