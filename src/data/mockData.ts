import { CategoriesData, Transaction } from '../types';

export const DEFAULT_CATEGORIES: CategoriesData = {
  incomeCategories: [
    'Salary',
    'Freelance & Consulting',
    'Investment & Dividends',
    'Rental Income',
    'Bonus & Awards',
    'Other Income'
  ],
  expenseCategories: [
    'Housing & Rent',
    'Food & Groceries',
    'Dining & Cafes',
    'Utilities & Bills',
    'Transportation & Fuel',
    'Entertainment & Leisure',
    'Health & Medical',
    'Shopping & Goods',
    'Subscriptions & Software',
    'Travel & Holidays',
    'Personal Care',
    'Miscellaneous'
  ]
};

// Generate realistic transactions around current month
export const getInitialTransactions = (): Transaction[] => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  
  const formatDate = (day: number) => {
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
  };

  return [
    {
      id: 'tx-1',
      date: formatDate(1),
      type: 'Income',
      category: 'Salary',
      amount: 85000.00,
      description: 'Primary Employment Direct Deposit',
      rowIndex: 2
    },
    {
      id: 'tx-2',
      date: formatDate(2),
      type: 'Expense',
      category: 'Housing & Rent',
      amount: 24000.00,
      description: 'Monthly Apartment Rent Payment',
      rowIndex: 3
    },
    {
      id: 'tx-3',
      date: formatDate(3),
      type: 'Expense',
      category: 'Utilities & Bills',
      amount: 3250.00,
      description: 'Electricity & High-speed Fiber',
      rowIndex: 4
    },
    {
      id: 'tx-4',
      date: formatDate(5),
      type: 'Expense',
      category: 'Food & Groceries',
      amount: 6850.00,
      description: 'Weekly Organic Grocery Run',
      rowIndex: 5
    },
    {
      id: 'tx-5',
      date: formatDate(8),
      type: 'Income',
      category: 'Freelance & Consulting',
      amount: 25000.00,
      description: 'Frontend Design Project Milestone 1',
      rowIndex: 6
    },
    {
      id: 'tx-6',
      date: formatDate(10),
      type: 'Expense',
      category: 'Transportation & Fuel',
      amount: 3200.00,
      description: 'Vehicle Petrol & Metro Pass',
      rowIndex: 7
    },
    {
      id: 'tx-7',
      date: formatDate(12),
      type: 'Expense',
      category: 'Dining & Cafes',
      amount: 2450.00,
      description: 'Dinner with colleagues downtown',
      rowIndex: 8
    },
    {
      id: 'tx-8',
      date: formatDate(15),
      type: 'Income',
      category: 'Investment & Dividends',
      amount: 8400.00,
      description: 'Mutual Fund & Stock Dividends',
      rowIndex: 9
    },
    {
      id: 'tx-9',
      date: formatDate(17),
      type: 'Expense',
      category: 'Subscriptions & Software',
      amount: 1199.00,
      description: 'Cloud storage and music streaming',
      rowIndex: 10
    },
    {
      id: 'tx-10',
      date: formatDate(20),
      type: 'Expense',
      category: 'Food & Groceries',
      amount: 5400.00,
      description: 'Mid-month Supermarket restock',
      rowIndex: 11
    },
    {
      id: 'tx-11',
      date: formatDate(22),
      type: 'Expense',
      category: 'Entertainment & Leisure',
      amount: 2200.00,
      description: 'Movie tickets & weekend dining',
      rowIndex: 12
    },
    {
      id: 'tx-12',
      date: formatDate(24),
      type: 'Expense',
      category: 'Health & Medical',
      amount: 3500.00,
      description: 'Gym membership & pharmacy',
      rowIndex: 13
    }
  ];
};
