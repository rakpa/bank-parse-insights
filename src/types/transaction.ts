export interface Transaction {
  id: string;
  date: string; // ISO date string
  description: string;
  amount: number; // positive for credit, negative for debit
  type: 'credit' | 'debit';
  category?: string;
  balance?: number;
}