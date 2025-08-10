import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite will handle the ?url import for the worker
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker?url';
import type { Transaction } from '@/types/transaction';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as unknown as string;

function parseAmountFromLine(line: string): number | null {
  // Capture the last monetary amount in the line (e.g., 1,234.56 or -45.67)
  const amountMatches = line.match(/(-?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+(?:\.\d{2}))/g);
  if (!amountMatches || amountMatches.length === 0) return null;
  const raw = amountMatches[amountMatches.length - 1]
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '');
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function findDateAtStart(line: string): string | null {
  const trimmed = line.trim();
  // Support YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})\b/,
    /^(\d{2})\/(\d{2})\/(\d{4})\b/,
    /^(\d{2})-(\d{2})-(\d{4})\b/,
  ];
  for (const rx of patterns) {
    const m = trimmed.match(rx);
    if (m) {
      // Normalize to YYYY-MM-DD
      if (rx === patterns[0]) {
        return `${m[1]}-${m[2]}-${m[3]}`;
      }
      const month = m[1];
      const day = m[2];
      const year = m[3];
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

export async function parseTransactionsFromPdf(file: File): Promise<Transaction[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => ('str' in item ? item.str : '') as string);
    fullText += strings.join(' ') + '\n';
  }

  const lines = fullText
    .split(/\n|\r|\r\n/g)
    .map(l => l.replace(/\s{2,}/g, ' ').trim())
    .filter(l => l.length > 0);

  const transactions: Transaction[] = [];

  for (const line of lines) {
    const date = findDateAtStart(line);
    const amount = parseAmountFromLine(line);

    if (!date || amount === null) continue;

    // Heuristic: remove the date at start, and the trailing amount to get description
    let description = line;
    if (date) {
      description = description.replace(date, '').trim();
      // Also remove date in MM/DD/YYYY or MM-DD-YYYY if present differently
      description = description.replace(/^(\d{2})[\/-](\d{2})[\/-](\d{4})\b/, '').trim();
    }
    const amountStr = (amount < 0 ? '-' : '') + Math.abs(amount).toFixed(2);
    description = description.replace(new RegExp(`${amountStr.replace('.', '\\.')}$`), '').trim();

    const type: Transaction['type'] = amount >= 0 ? 'credit' : 'debit';

    transactions.push({
      id: `${date}-${transactions.length + 1}`,
      date,
      description: description || 'Transaction',
      amount,
      type,
    });
  }

  // If nothing was parsed, throw to allow caller to fallback
  if (transactions.length === 0) {
    throw new Error('No transactions could be parsed from the PDF.');
  }

  return transactions;
}