import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category?: string;
  balance?: number;
}

interface DashboardStatsProps {
  transactions: Transaction[];
}

export function DashboardStats({ transactions }: DashboardStatsProps) {
  const totalCredit = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalDebit = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const netFlow = totalCredit - totalDebit;
  
  const currentBalance = transactions.length > 0 
    ? transactions[transactions.length - 1]?.balance || netFlow
    : 0;

  const avgTransactionAmount = transactions.length > 0 
    ? transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / transactions.length
    : 0;

  const stats = [
    {
      title: "Current Balance",
      value: currentBalance,
      icon: DollarSign,
      color: currentBalance >= 0 ? "text-success" : "text-destructive",
      prefix: "$"
    },
    {
      title: "Total Credits",
      value: totalCredit,
      icon: TrendingUp,
      color: "text-success",
      prefix: "$"
    },
    {
      title: "Total Debits",
      value: totalDebit,
      icon: TrendingDown,
      color: "text-destructive",
      prefix: "$"
    },
    {
      title: "Net Flow",
      value: netFlow,
      icon: Activity,
      color: netFlow >= 0 ? "text-success" : "text-destructive",
      prefix: "$"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.color}`}>
              {stat.prefix}{Math.abs(stat.value).toFixed(2)}
            </div>
            {stat.title === "Current Balance" && (
              <p className="text-xs text-muted-foreground">
                From {transactions.length} transactions
              </p>
            )}
            {stat.title === "Net Flow" && (
              <p className="text-xs text-muted-foreground">
                Average: ${avgTransactionAmount.toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}