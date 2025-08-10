import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite will handle the ?url import for the worker
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker?url';
import type { Transaction } from '@/types/transaction';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as unknown as string;

type TextItem = { str: string; transform?: number[] };

type ParsedLine = {
  text: string;
  parts: { str: string; x: number; y: number }[];
};

function roundToTolerance(value: number, tolerance: number): number {
  return Math.round(value / tolerance) * tolerance;
}

async function extractLinesFromPdf(arrayBuffer: ArrayBuffer): Promise<ParsedLine[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines: ParsedLine[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items into lines using y position tolerance
    const yTolerance = 2; // pixels
    const lineGroups = new Map<number, { str: string; x: number; y: number }[]>();

    for (const item of content.items as unknown as TextItem[]) {
      if (!item || typeof item.str !== 'string') continue;
      const transform = (item as any).transform as number[] | undefined;
      const x = transform?.[4] ?? 0;
      const y = transform?.[5] ?? 0;
      const key = roundToTolerance(y, yTolerance);
      const arr = lineGroups.get(key) ?? [];
      arr.push({ str: item.str, x, y });
      lineGroups.set(key, arr);
    }

    // Sort lines by y descending (top to bottom), and parts by x ascending (left to right)
    const sortedKeys = Array.from(lineGroups.keys()).sort((a, b) => b - a);
    for (const key of sortedKeys) {
      const parts = (lineGroups.get(key) ?? []).sort((a, b) => a.x - b.x);
      const text = parts.map(p => p.str).join(' ').replace(/\s{2,}/g, ' ').trim();
      if (text.length > 0) {
        allLines.push({ text, parts });
      }
    }
  }

  return allLines;
}

const MONTHS_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function normalizeDate(input: string): string | null {
  const t = input.trim();

  // YYYY-MM-DD
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // MM/DD/YYYY or MM-DD-YYYY
  m = t.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})\b/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;

  // DD/MM/YYYY
  m = t.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})\b/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  // Month DD, YYYY (e.g., Jan 31, 2024)
  m = t.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})/i);
  if (m) {
    const mm = MONTHS_MAP[m[1].slice(0,3).toLowerCase()];
    const dd = String(parseInt(m[2], 10)).padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }

  return null;
}

function extractNumbers(line: string): number[] {
  // Match monetary numbers with optional $ and commas, keep sign
  const matches = line.match(/-?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+(?:\.\d{2})/g);
  if (!matches) return [];
  return matches.map(m => parseFloat(m.replace(/\$/g, '').replace(/,/g, '').replace(/\s/g, '')))
    .filter(n => Number.isFinite(n));
}

function isHeaderOrFooter(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('page ') ||
    t.includes('statement period') ||
    t.includes('account number') ||
    t.includes('beginning balance') ||
    t.includes('ending balance') ||
    t.includes('total deposits') ||
    t.includes('total withdrawals') ||
    t.includes('summary')
  );
}

function inferType(amount: number, text: string): Transaction['type'] {
  const t = text.toLowerCase();
  if (t.includes('cr') || t.includes('credit')) return amount >= 0 ? 'credit' : 'debit';
  if (t.includes('dr') || t.includes('debit')) return amount < 0 ? 'debit' : 'credit';
  return amount >= 0 ? 'credit' : 'debit';
}

export async function parseTransactionsFromPdf(file: File): Promise<Transaction[]> {
  const arrayBuffer = await file.arrayBuffer();

  // Extract lines using positions for better table reconstruction
  const parsedLines = await extractLinesFromPdf(arrayBuffer);

  // If there is virtually no text, it's likely a scanned PDF
  if (parsedLines.length === 0) {
    throw new Error('This PDF appears to contain no extractable text (likely a scanned image). Use an OCR-processed PDF.');
  }

  const transactions: Transaction[] = [];

  for (const { text } of parsedLines) {
    if (isHeaderOrFooter(text)) continue;

    // Try to find a date anywhere in the line
    let date: string | null = null;
    const tokens = text.split(/\s+/);

    for (let i = 0; i < Math.min(tokens.length, 6); i += 1) {
      const d = normalizeDate(tokens[i]);
      if (d) { date = d; break; }
    }

    if (!date) continue;

    // Extract numeric fields; if 2+, assume last is balance and previous is amount
    const numbers = extractNumbers(text);
    if (numbers.length === 0) continue;

    let amount: number | null = null;
    let balance: number | undefined;

    if (numbers.length >= 2) {
      balance = numbers[numbers.length - 1];
      amount = numbers[numbers.length - 2];
    } else {
      amount = numbers[0];
    }

    if (amount === null) continue;

    // Determine description by removing date token and trailing number fields
    let description = text;

    // Remove the matched date portion at start if present
    const dateAtStart = normalizeDate(text);
    if (dateAtStart) {
      description = description.replace(/^(.*?\b)(?=\s)/, (m) => {
        // If first token is date, drop it
        const maybeDate = normalizeDate(m.trim());
        return maybeDate ? '' : m;
      }).trim();
    }

    // Remove trailing numeric chunks (amount and optionally balance)
    description = description.replace(/(-?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+(?:\.\d{2}))(\s+(-?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+(?:\.\d{2})))*\s*$/, '').trim();

    // Normalize type by sign and context cues
    const type = inferType(amount, text);

    transactions.push({
      id: `${date}-${transactions.length + 1}`,
      date,
      description: description || 'Transaction',
      amount,
      type,
      ...(balance !== undefined ? { balance } : {}),
    });
  }

  if (transactions.length === 0) {
    throw new Error('No transactions could be parsed from the PDF. Try another statement format or use OCR if scanned.');
  }

  return transactions;
}