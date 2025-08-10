import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { TransactionsList } from "@/components/TransactionsList";
import { DashboardStats } from "@/components/DashboardStats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, TrendingUp } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category?: string;
  balance?: number;
}

const Index = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock data for demonstration
  const sampleTransactions: Transaction[] = [
    {
      id: "1",
      date: "2024-01-15",
      description: "Direct Deposit - Salary",
      amount: 3500.00,
      type: "credit",
      category: "Income",
      balance: 5200.00
    },
    {
      id: "2", 
      date: "2024-01-14",
      description: "Grocery Store Purchase",
      amount: -125.50,
      type: "debit",
      category: "Food & Dining",
      balance: 1700.00
    },
    {
      id: "3",
      date: "2024-01-13", 
      description: "Coffee Shop",
      amount: -4.75,
      type: "debit",
      category: "Food & Dining",
      balance: 1825.50
    },
    {
      id: "4",
      date: "2024-01-12",
      description: "Online Transfer",
      amount: 1000.00,
      type: "credit", 
      category: "Transfer",
      balance: 1830.25
    }
  ];

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    
    // Simulate PDF processing delay
    setTimeout(() => {
      setTransactions(sampleTransactions);
      setIsProcessing(false);
    }, 2000);
  };

  const loadSampleData = () => {
    setTransactions(sampleTransactions);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Bank Statement Analytics</h1>
          <p className="text-xl text-muted-foreground">
            Upload your bank statement PDF to analyze your financial transactions
          </p>
        </div>

        {transactions.length === 0 ? (
          <div className="space-y-8">
            <FileUpload onFileSelect={handleFileSelect} />
            
            {isProcessing && (
              <Card className="max-w-2xl mx-auto">
                <CardContent className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-lg font-medium">Processing your bank statement...</p>
                  <p className="text-muted-foreground">This may take a few moments</p>
                </CardContent>
              </Card>
            )}

            <div className="text-center">
              <p className="text-muted-foreground mb-4">Don't have a PDF? Try our sample data</p>
              <Button onClick={loadSampleData} variant="outline">
                Load Sample Data
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <DashboardStats transactions={transactions} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Monthly Trends</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Coming soon - Monthly spending analysis</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChart className="h-5 w-5" />
                    <span>Category Breakdown</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Coming soon - Expense categorization</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Insights</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Coming soon - AI-powered insights</p>
                </CardContent>
              </Card>
            </div>
            
            <TransactionsList transactions={transactions} />
            
            <div className="text-center pt-4">
              <Button 
                onClick={() => setTransactions([])} 
                variant="outline"
              >
                Upload New Statement
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
