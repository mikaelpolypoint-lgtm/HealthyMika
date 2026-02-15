import { useState, useMemo, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { ChevronLeft, Wallet } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import clsx from 'clsx';

// --- Types (Mirrors Budget.tsx) ---
interface BudgetItem {
    id: string;
    name: string;
    defaultAmount: number;
    category: string;
    linkedSavingsId?: string;
    isRecurring: boolean;
    recurrenceFrequency?: 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
    lastOccurringMonth?: number;
    oneTimeMonth?: number;
    startYear?: number;
    monthlyAmounts: Record<string, number>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BASE_YEAR = 2026;
const YEARS = [2026, 2027, 2028, 2029, 2030];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'];

export default function BudgetAnalytics() {
    const navigate = useNavigate();
    const [selectedYear, setSelectedYear] = useState(BASE_YEAR);
    const [incomes, setIncomes] = useState<BudgetItem[]>([]);
    const [expenses, setExpenses] = useState<BudgetItem[]>([]);

    // --- Data Fetching ---
    useEffect(() => {
        const unsubIncomes = onSnapshot(collection(db, 'budget_incomes'), (snap) => {
            setIncomes(snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetItem)));
        });
        const unsubExpenses = onSnapshot(collection(db, 'budget_expenses'), (snap) => {
            setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetItem)));
        });
        return () => { unsubIncomes(); unsubExpenses(); };
    }, []);

    // --- Helpers ---
    const getMonthlyAmount = (item: BudgetItem, year: number, month: number) => {
        const specificKey = `${year}-${month}`;
        if (item.monthlyAmounts[specificKey] !== undefined) return item.monthlyAmounts[specificKey];
        if (year === 2026 && item.monthlyAmounts[String(month)] !== undefined) return item.monthlyAmounts[String(month)];

        if (item.isRecurring) {
            const itemStartYear = item.startYear || BASE_YEAR;
            if (year < itemStartYear) return 0;
            if (typeof item.lastOccurringMonth === 'number') {
                if (year > BASE_YEAR) return 0;
                if (year === BASE_YEAR && month > item.lastOccurringMonth) return 0;
            }
            const absMonthDiff = (year - BASE_YEAR) * 12 + month;
            if (absMonthDiff < 0) return 0;
            let step = 1;
            if (item.recurrenceFrequency === 'quarterly') step = 3;
            else if (item.recurrenceFrequency === 'semiannual') step = 6;
            else if (item.recurrenceFrequency === 'yearly') step = 12;
            if (absMonthDiff % step === 0) return item.defaultAmount;
        }
        return 0;
    };

    // --- Chart Data Generators ---

    // 1. Monthly Overview (Income vs Expense vs Savings)
    const monthlyData = useMemo(() => {
        return MONTHS.map((name, index) => {
            const inc = incomes.reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, index), 0);

            const allExp = expenses.reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, index), 0);
            const savings = expenses
                .filter(e => e.category === 'savings' || !!e.linkedSavingsId)
                .reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, index), 0);

            const consumption = allExp - savings;

            return {
                name,
                income: inc,
                consumption: consumption,
                savings: savings,
                net: inc - allExp
            };
        });
    }, [incomes, expenses, selectedYear]);

    // 2. Expense Category Breakdown (Yearly Total)
    const expenseCategoryData = useMemo(() => {
        const catMap = new Map<string, number>();
        expenses.forEach(item => {
            let total = 0;
            for (let m = 0; m < 12; m++) total += getMonthlyAmount(item, selectedYear, m);
            if (total > 0) {
                // Treat savings as separate or exclude? Let's keep savings as a category if it's there
                const cat = (item.category === 'savings' || !!item.linkedSavingsId) ? 'Savings / Invest' : item.category;
                catMap.set(cat, (catMap.get(cat) || 0) + total);
            }
        });
        return Array.from(catMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [expenses, selectedYear]);

    // 3. Income Category Breakdown (Yearly Total)
    const incomeCategoryData = useMemo(() => {
        const catMap = new Map<string, number>();
        incomes.forEach(item => {
            let total = 0;
            for (let m = 0; m < 12; m++) total += getMonthlyAmount(item, selectedYear, m);
            if (total > 0) {
                catMap.set(item.category, (catMap.get(item.category) || 0) + total);
            }
        });
        return Array.from(catMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [incomes, selectedYear]);


    return (
        <Layout>
            <div className="flex flex-col gap-6">

                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/budget')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <ChevronLeft size={24} className="text-slate-600" />
                        </button>
                        <h2 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
                            <Wallet className="w-6 h-6" /> Budget Analytics
                        </h2>
                    </div>
                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                        {YEARS.map(y => (
                            <button
                                key={y}
                                onClick={() => setSelectedYear(y)}
                                className={clsx(
                                    "px-3 py-1 text-xs font-bold rounded-md transition-all",
                                    selectedYear === y ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* 1. Monthly Trends (Bar Chart) */}
                    <Card className="col-span-1 md:col-span-2 h-[400px]">
                        <CardTitle>Monthly Cash Flow ({selectedYear})</CardTitle>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `CHF ${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [`CHF ${value.toLocaleString()}`, '']}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="consumption" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" barSize={20} />
                                <Bar dataKey="savings" name="Savings" fill="#6366f1" radius={[4, 4, 0, 0]} stackId="a" barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>

                    {/* 2. Expense Breakdown (Pie Chart) */}
                    <Card className="h-[400px]">
                        <CardTitle>Expenses by Category</CardTitle>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={expenseCategoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {expenseCategoryData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `CHF ${value.toLocaleString()}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>

                    {/* 3. Income Breakdown (Pie/Bar) */}
                    <Card className="h-[400px]">
                        <CardTitle>Income Sources</CardTitle>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={incomeCategoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {incomeCategoryData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 5) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `CHF ${value.toLocaleString()}`} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>

                    {/* 4. Net Flow Accumulation (Area Chart) */}
                    <Card className="col-span-1 md:col-span-2 h-[300px]">
                        <CardTitle>Cumulative Net Savings/Flow</CardTitle>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <Tooltip />
                                <Area type="monotone" dataKey="net" stroke="#3b82f6" fillOpacity={1} fill="url(#colorNet)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Card>

                </div>
            </div>
        </Layout>
    );
}
