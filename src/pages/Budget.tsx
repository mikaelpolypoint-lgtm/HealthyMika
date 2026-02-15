import { useState, useMemo, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle, Button } from "../components/Ui";
import { Wallet, Plus, Trash2, PiggyBank, ChevronLeft, ChevronRight, Settings, Filter, Pencil, Check, X, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// --- Types ---



interface BudgetItem {
    id: string;
    name: string;
    // We remove single 'amount' and 'frequency' as primary source of truth, 
    // but keep them for 'default' or 'template' values.
    // The source of truth for calculations is `monthlyAmounts`.
    defaultAmount: number;
    category: string;
    linkedSavingsId?: string;
    // Recurrence Attributes
    isRecurring: boolean;
    recurrenceFrequency?: 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
    lastOccurringMonth?: number; // 0-11, undefined = no end
    oneTimeMonth?: number; // 0-11, used if !isRecurring

    startYear?: number; // Year the item was created/starts
    monthlyAmounts: Record<string, number>; // "YYYY-M" -> value (or legacy "0"-"11" for 2026)
}

interface SavingsAccount {
    id: string;
    name: string;
    currentValue: number; // Renamed from initialBalance
    yearlyGoal: number;
}

// --- Constants ---

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BASE_YEAR = 2026;
const YEARS = [2026, 2027, 2028, 2029, 2030];

export default function Budget() {
    // --- State: View & Date ---
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(BASE_YEAR);
    const [showCategorySettings, setShowCategorySettings] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const navigate = useNavigate();

    // --- State: Editing ---
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', category: '' });

    // --- State: Categories ---
    const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
    const [incomeCategories, setIncomeCategories] = useState<string[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');

    // --- State: Data ---
    const [incomes, setIncomes] = useState<BudgetItem[]>([]);

    const [expenses, setExpenses] = useState<BudgetItem[]>([]);

    const [savings, setSavings] = useState<SavingsAccount[]>([]);

    // --- State: New Item Inputs ---
    const [newSavings, setNewSavings] = useState({ name: '', yearlyGoal: '' });
    const [newItem, setNewItem] = useState({
        name: '',
        amount: '',
        category: '',
        isSavingsLinked: false,
        linkedSavingsId: '',
        // Recurrence State
        isRecurring: true,
        recurrenceFrequency: 'monthly' as 'monthly' | 'quarterly' | 'semiannual' | 'yearly',
        lastOccurringMonth: '' as string, // "" means infinite
        oneTimeMonth: '' as string // "" means selectedMonth
    });

    // --- Effects: Fetch Data ---
    useEffect(() => {
        // Categories
        const unsubCats = onSnapshot(doc(db, 'budget_settings', 'categories'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setIncomeCategories(data.income || []);
                setExpenseCategories(data.expense || []);
            } else {
                // Initialize default categories if not exists
                setDoc(doc(db, 'budget_settings', 'categories'), {
                    income: ['polypoint', 'school sumiswald', 'else'],
                    expense: ['house', 'car', 'insurance', 'taxes', 'leisure', 'health', 'sport', 'kids', 'animals', 'creditcard', 'subscriptions', 'savings']
                });
            }
        });

        // Incomes
        const unsubIncomes = onSnapshot(collection(db, 'budget_incomes'), (snap) => {
            setIncomes(snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetItem)));
        });

        // Expenses
        const unsubExpenses = onSnapshot(collection(db, 'budget_expenses'), (snap) => {
            setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetItem)));
        });

        // Savings
        const unsubSavings = onSnapshot(collection(db, 'budget_savings'), (snap) => {
            setSavings(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavingsAccount)));
        });

        return () => {
            unsubCats();
            unsubIncomes();
            unsubExpenses();
            unsubSavings();
        };
    }, []);

    // --- Computed Data & Filtering ---

    const allCategories = useMemo(() => Array.from(new Set([...incomeCategories, ...expenseCategories])), [incomeCategories, expenseCategories]);

    const filteredIncomes = useMemo(() => {
        if (selectedCategories.length === 0) return incomes;
        return incomes.filter(i => selectedCategories.includes(i.category));
    }, [incomes, selectedCategories]);

    const filteredExpenses = useMemo(() => {
        if (selectedCategories.length === 0) return expenses;
        return expenses.filter(e => selectedCategories.includes(e.category));
    }, [expenses, selectedCategories]);

    // --- Helpers ---

    const getMonthlyAmount = (item: BudgetItem, year: number, month: number) => {
        // 1. Explicit override (supports year-month key)
        const specificKey = `${year}-${month}`;
        if (item.monthlyAmounts[specificKey] !== undefined) return item.monthlyAmounts[specificKey];

        // 2. Legacy 2026 (supports index key "0"-"11" mapping to 2026)
        // Note: Firestore keys are strings. Accessing with number relies on JS coercion, 
        // but for TS 'Record<string, number>' we should cast keys.
        if (year === 2026 && item.monthlyAmounts[String(month)] !== undefined) return item.monthlyAmounts[String(month)];

        // 3. Recurrence Logic
        if (item.isRecurring) {
            // Check Start Date
            const itemStartYear = item.startYear || BASE_YEAR;
            if (year < itemStartYear) return 0;

            // Check End Date
            // Ensure lastOccurringMonth is a valid number before comparing
            if (typeof item.lastOccurringMonth === 'number') {
                // If we are past 2026, it stops (assuming legacy constraint)
                if (year > BASE_YEAR) return 0;
                // If in 2026, check month
                if (year === BASE_YEAR && month > item.lastOccurringMonth) return 0;
            }

            // Frequency check relative to Jan 2026 (or Item Start)
            // We anchor to Jan 2026 for phase alignment across global timeline
            const absMonthDiff = (year - BASE_YEAR) * 12 + month;

            // Should not happen if year < BASE_YEAR, but strict check
            if (absMonthDiff < 0) return 0;

            let step = 1;
            if (item.recurrenceFrequency === 'quarterly') step = 3;
            else if (item.recurrenceFrequency === 'semiannual') step = 6;
            else if (item.recurrenceFrequency === 'yearly') step = 12;

            if (absMonthDiff % step === 0) {
                return item.defaultAmount;
            }
        }

        return 0;
    };

    const updateMonthlyAmount = async (id: string, type: 'income' | 'expense', year: number, month: number, value: number) => {
        const collectionName = type === 'income' ? 'budget_incomes' : 'budget_expenses';
        try {
            await updateDoc(doc(db, collectionName, id), {
                [`monthlyAmounts.${year}-${month}`]: value
            });
        } catch (e) {
            console.error("Error updating monthly amount", e);
        }
    };

    // --- Edit Item Details (Name/Category) ---
    const startEditing = (item: BudgetItem) => {
        setEditingId(item.id);
        setEditForm({ name: item.name, category: item.category });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({ name: '', category: '' });
    };

    const saveEdit = async (id: string, type: 'income' | 'expense') => {
        const collectionName = type === 'income' ? 'budget_incomes' : 'budget_expenses';
        try {
            await updateDoc(doc(db, collectionName, id), {
                name: editForm.name,
                category: editForm.category
            });
            setEditingId(null);
        } catch (e) {
            console.error("Error updating item details", e);
        }
    };

    // --- Calculations ---

    // 1. Current View Totals
    // 1. Current View Totals (Reactive to Filters)
    const currentMonthIncome = useMemo(() => filteredIncomes.reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, selectedMonth), 0), [filteredIncomes, selectedMonth, selectedYear]);
    const currentMonthExpenseTotal = useMemo(() => filteredExpenses.reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, selectedMonth), 0), [filteredExpenses, selectedMonth, selectedYear]);

    // Updated Savings Definition: Category 'savings' OR has a linkedSavingsId
    const currentMonthSavingsAllocated = useMemo(() =>
        filteredExpenses.filter(e => e.category === 'savings' || !!e.linkedSavingsId)
            .reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, selectedMonth), 0)
        , [filteredExpenses, selectedMonth, selectedYear]);

    // Consumption = Total Expenses - Savings (This assumes Savings are included in Total Expenses)
    // If Total Expenses includes Savings, then consumption is the remainder.
    const currentMonthConsumption = currentMonthExpenseTotal - currentMonthSavingsAllocated;
    const currentNetFlow = currentMonthIncome - currentMonthExpenseTotal; // Unallocated cash

    // 2. Yearly Totals (For Selected Year)
    // 2. Yearly Totals (For Selected Year) - Reactive to Filters
    const yearIncomeTotal = useMemo(() => {
        return filteredIncomes.reduce((sum, item) => {
            let itemYearSum = 0;
            for (let m = 0; m < 12; m++) itemYearSum += getMonthlyAmount(item, selectedYear, m);
            return sum + itemYearSum;
        }, 0);
    }, [filteredIncomes, selectedYear]);

    const yearExpenseTotal = useMemo(() => {
        return filteredExpenses.reduce((sum, item) => {
            let itemYearSum = 0;
            for (let m = 0; m < 12; m++) itemYearSum += getMonthlyAmount(item, selectedYear, m);
            return sum + itemYearSum;
        }, 0);
    }, [filteredExpenses, selectedYear]);

    // 3. Savings Accumulation (Running Balance from Start of 2026)
    const getSavingsBalance = (savingsId: string, currentYear: number, currentMonth: number) => {
        const account = savings.find(s => s.id === savingsId);
        if (!account) return 0;

        let total = account.currentValue;

        // Find all expenses linked to this savings account
        const linkedExpenses = expenses.filter(e => e.linkedSavingsId === savingsId);

        // Sum up contributions from 2026 Jan to currentYear/currentMonth
        for (let y = BASE_YEAR; y <= currentYear; y++) {
            const limitMonth = (y === currentYear) ? currentMonth : 11;
            for (let m = 0; m <= limitMonth; m++) {
                linkedExpenses.forEach(exp => {
                    total += getMonthlyAmount(exp, y, m);
                });
            }
        }
        return total;
    };

    // --- Actions ---

    const addItem = async (type: 'income' | 'expense') => {
        if (!newItem.name || !newItem.amount || !newItem.category) return;

        const amount = parseFloat(newItem.amount);
        const monthlyAmounts: Record<string, number> = {};
        const isRecurring = newItem.isRecurring;
        const oneTimeMonth = newItem.oneTimeMonth === '' ? selectedMonth : parseInt(newItem.oneTimeMonth);
        const lastMonth = newItem.lastOccurringMonth === '' ? 11 : parseInt(newItem.lastOccurringMonth);

        // Populate initial values for the selected year
        if (!isRecurring) {
            // One time
            monthlyAmounts[`${selectedYear}-${oneTimeMonth}`] = amount;
        } else {
            // Recurring logic - pre-fill selected year
            let step = 1;
            if (newItem.recurrenceFrequency === 'quarterly') step = 3;
            else if (newItem.recurrenceFrequency === 'semiannual') step = 6;
            else if (newItem.recurrenceFrequency === 'yearly') step = 12;

            // Anchor recurrence to Jan of selectedYear for the initial fill loop.
            // Note: global recurrence calculation anchors to BASE_YEAR (2026). 
            // If selectedYear > BASE_YEAR, we should ideally check phase.
            // But for simplicity of "Starting a new item", we fill valid slots in this year.

            // Calculate starting month index relative to Jan of selectedYear
            // If we want it to start NOW (selectedMonth)? Usually budget items start Jan regardless.
            // Let's stick to 0 (Jan) start logic.

            for (let i = 0; i < 12; i += step) {
                // Logic check: if this year is 2026, and lastMonth is set, respect it.
                // If year > 2026 and item implies infinite, fill all.
                const isLimited = (newItem.lastOccurringMonth !== '');
                if (!isLimited || i <= lastMonth) {
                    monthlyAmounts[`${selectedYear}-${i}`] = amount;
                }
            }
        }

        // We don't specify ID here, Firestore generates it
        const newItemObj: Omit<BudgetItem, 'id'> = {
            name: newItem.name,
            defaultAmount: amount,
            category: newItem.category,
            linkedSavingsId: newItem.isSavingsLinked ? newItem.linkedSavingsId : undefined,
            isRecurring,
            recurrenceFrequency: isRecurring ? newItem.recurrenceFrequency : undefined,
            lastOccurringMonth: (isRecurring && newItem.lastOccurringMonth !== '') ? lastMonth : undefined,
            oneTimeMonth: !isRecurring ? oneTimeMonth : undefined,
            monthlyAmounts,
            startYear: selectedYear
        };

        const cleanItem = Object.fromEntries(Object.entries(newItemObj).filter(([_, v]) => v !== undefined));

        try {
            if (type === 'income') {
                await addDoc(collection(db, 'budget_incomes'), cleanItem);
            } else {
                await addDoc(collection(db, 'budget_expenses'), cleanItem);
            }
            // Only clear input on success
            setNewItem({ ...newItem, name: '', amount: '' });
        } catch (e) {
            console.error("Error adding item", e);
        }
    };

    const deleteItem = async (id: string, type: 'income' | 'expense' | 'savings') => {
        let collectionName = '';
        if (type === 'income') collectionName = 'budget_incomes';
        else if (type === 'expense') collectionName = 'budget_expenses';
        else if (type === 'savings') collectionName = 'budget_savings';

        try {
            await deleteDoc(doc(db, collectionName, id));
        } catch (e) {
            console.error("Error deleting", e);
        }
    };

    const addCategory = async (type: 'income' | 'expense') => {
        if (!newCategoryName) return;
        const targetList = type === 'income' ? incomeCategories : expenseCategories;
        if (targetList.includes(newCategoryName)) return;

        const newData = [...targetList, newCategoryName];
        try {
            await updateDoc(doc(db, 'budget_settings', 'categories'), {
                [type]: newData
            });
            setNewCategoryName('');
        } catch (e) {
            console.error("Error adding category", e);
        }
    };

    // Removing a category - adding helper
    const removeCategory = async (type: 'income' | 'expense', name: string) => {
        const targetList = type === 'income' ? incomeCategories : expenseCategories;
        const newData = targetList.filter(c => c !== name);
        try {
            await updateDoc(doc(db, 'budget_settings', 'categories'), {
                [type]: newData
            });
        } catch (e) {
            console.error("Error removing category", e);
        }
    };

    const addSavings = async () => {
        if (!newSavings.name || !newSavings.yearlyGoal) return;
        try {
            await addDoc(collection(db, 'budget_savings'), {
                name: newSavings.name,
                currentValue: 0,
                yearlyGoal: parseFloat(newSavings.yearlyGoal) || 0
            });
            setNewSavings({ name: '', yearlyGoal: '' });
        } catch (e) {
            console.error("Error adding savings", e);
        }
    };

    const updateSavings = async (id: string, field: keyof SavingsAccount, value: any) => {
        try {
            await updateDoc(doc(db, 'budget_savings', id), {
                [field]: value
            });
        } catch (e) {
            console.error("Error updating savings", e);
        }
    };


    return (
        <Layout>
            <div className="flex flex-col gap-6">

                {/* 1. Header & Controls */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                        <h2 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
                            <Wallet className="w-6 h-6" /> Budget
                            <div className="flex bg-slate-100 rounded-lg p-1 gap-1 ml-2">
                                {YEARS.map(y => (
                                    <button
                                        key={y}
                                        onClick={() => setSelectedYear(y)}
                                        className={clsx(
                                            "px-2 py-0.5 text-xs font-bold rounded-md transition-all",
                                            selectedYear === y ? "bg-white text-brand-primary shadow-sm" : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {y}
                                    </button>
                                ))}
                            </div>
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <button onClick={() => setSelectedMonth((m) => (m === 0 ? 11 : m - 1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={16} /></button>
                            <span className="font-bold text-slate-700 w-24 text-center select-none">{MONTHS[selectedMonth]} {selectedYear}</span>
                            <button onClick={() => setSelectedMonth((m) => (m === 11 ? 0 : m + 1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate('/budget/analytics')}
                            className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 transition-colors"
                            title="Budget Analytics"
                        >
                            <PieChart size={20} />
                        </button>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={clsx("p-2 rounded-lg transition-colors border relative", showFilters || selectedCategories.length > 0 ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-transparent hover:bg-slate-50")}
                            title="Filter Categories"
                        >
                            <Filter size={20} />
                            {selectedCategories.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white font-bold">
                                    {selectedCategories.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setShowCategorySettings(!showCategorySettings)}
                            className={clsx("p-2 rounded-lg transition-colors border", showCategorySettings ? "bg-slate-100 border-slate-300" : "bg-white border-transparent hover:bg-slate-50")}
                            title="Manage Categories"
                        >
                            <Settings size={20} className="text-slate-600" />
                        </button>
                        <div className="bg-slate-100 p-1 rounded-lg flex items-center">
                            <button
                                onClick={() => setViewMode('monthly')}
                                className={clsx("px-3 py-1.5 text-xs font-bold rounded-md transition-all", viewMode === 'monthly' ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
                            >
                                Month
                            </button>
                            <button
                                onClick={() => setViewMode('yearly')}
                                className={clsx("px-3 py-1.5 text-xs font-bold rounded-md transition-all", viewMode === 'yearly' ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
                            >
                                Year Grid
                            </button>
                        </div>
                    </div>
                </header>

                {/* Filters Panel */}
                {showFilters && (
                    <Card className="animate-in slide-in-from-top-2 border-indigo-100 bg-indigo-50/50">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-indigo-900 text-sm flex items-center gap-2"><Filter size={16} /> Filter by Category</h3>
                            {selectedCategories.length > 0 && <button onClick={() => setSelectedCategories([])} className="text-xs text-indigo-400 hover:text-indigo-600">Clear All</button>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {allCategories.map(cat => {
                                const isSelected = selectedCategories.includes(cat);
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => {
                                            if (isSelected) setSelectedCategories(selectedCategories.filter(c => c !== cat));
                                            else setSelectedCategories([...selectedCategories, cat]);
                                        }}
                                        className={clsx(
                                            "px-2 py-1 rounded text-xs border transition-all",
                                            isSelected
                                                ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-sm"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                                        )}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                    </Card>
                )}

                {/* 2. Category Settings Modal/Panel */}
                {showCategorySettings && (
                    <Card className="animate-in slide-in-from-top-2 border-slate-300 bg-slate-50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700">Manage Categories</h3>
                            <button onClick={() => setShowCategorySettings(false)} className="text-xs text-slate-400 underline">Close</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Income Categories</h4>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {incomeCategories.map(c => (
                                        <span key={c} className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs flex items-center gap-1 group">
                                            {c}
                                            <button onClick={() => removeCategory('income', c)} className="hover:text-red-500 hidden group-hover:block">&times;</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 px-2 py-1 text-sm border rounded"
                                        placeholder="New category..."
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') addCategory('income'); }}
                                    />
                                    <Button size="sm" onClick={() => addCategory('income')}><Plus size={14} /></Button>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Expense Categories</h4>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {expenseCategories.map(c => (
                                        <span key={c} className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs flex items-center gap-1 group">
                                            {c}
                                            <button onClick={() => removeCategory('expense', c)} className="hover:text-red-500 hidden group-hover:block">&times;</button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 px-2 py-1 text-sm border rounded"
                                        placeholder="New category..."
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') addCategory('expense'); }}
                                    />
                                    <Button size="sm" onClick={() => addCategory('expense')}><Plus size={14} /></Button>
                                </div>
                            </div>
                        </div>

                        {/* Savings Account Management */}
                        <div className="mt-8 pt-4 border-t border-slate-200">
                            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Savings Accounts</h4>
                            <div className="space-y-2 mb-3">
                                {savings.map(s => (
                                    <div key={s.id} className="flex items-center gap-2 bg-indigo-50 p-2 rounded text-sm">
                                        <input
                                            value={s.name}
                                            onChange={(e) => updateSavings(s.id, 'name', e.target.value)}
                                            className="bg-transparent font-semibold text-indigo-900 border-none focus:ring-0 p-0 flex-1"
                                        />
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-indigo-400">Cur:</span>
                                            <input
                                                type="number"
                                                value={s.currentValue}
                                                onChange={(e) => updateSavings(s.id, 'currentValue', parseFloat(e.target.value))}
                                                className="w-16 bg-white border border-indigo-200 rounded px-1 text-right"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-indigo-400">Goal:</span>
                                            <input
                                                type="number"
                                                value={s.yearlyGoal}
                                                onChange={(e) => updateSavings(s.id, 'yearlyGoal', parseFloat(e.target.value))}
                                                className="w-16 bg-white border border-indigo-200 rounded px-1 text-right"
                                            />
                                        </div>
                                        <button onClick={() => deleteItem(s.id, 'savings')} className="text-indigo-300 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 px-2 py-1 text-sm border rounded"
                                    placeholder="New Account Name..."
                                    value={newSavings.name}
                                    onChange={e => setNewSavings({ ...newSavings, name: e.target.value })}
                                />
                                <input
                                    type="number"
                                    className="w-24 px-2 py-1 text-sm border rounded"
                                    placeholder="Goal"
                                    value={newSavings.yearlyGoal}
                                    onChange={e => setNewSavings({ ...newSavings, yearlyGoal: e.target.value })}
                                />
                                <Button size="sm" onClick={addSavings}><Plus size={14} /> Add</Button>
                            </div>
                        </div>
                    </Card>
                )}

                {/* 3. Overview Stats (Context Aware) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4 border-l-4 border-l-emerald-500">
                        <p className="text-[10px] uppercase font-bold text-slate-400">{viewMode === 'monthly' ? MONTHS[selectedMonth] : 'Year'} Income</p>
                        <p className="text-xl font-black text-slate-800">CHF {(viewMode === 'monthly' ? currentMonthIncome : yearIncomeTotal).toLocaleString()}</p>
                    </Card>
                    <Card className="p-4 border-l-4 border-l-rose-500">
                        <p className="text-[10px] uppercase font-bold text-slate-400">{viewMode === 'monthly' ? MONTHS[selectedMonth] : 'Year'} Expenses</p>
                        <p className="text-xl font-black text-slate-800">CHF {(viewMode === 'monthly' ? currentMonthConsumption : yearExpenseTotal).toLocaleString()}</p>
                    </Card>
                    <Card className="p-4 border-l-4 border-l-indigo-500">
                        <p className="text-[10px] uppercase font-bold text-slate-400">{viewMode === 'monthly' ? MONTHS[selectedMonth] : 'Year'} Saved</p>
                        <p className="text-xl font-black text-slate-800">CHF {(viewMode === 'monthly' ? currentMonthSavingsAllocated : 0).toLocaleString()}</p>
                        {viewMode === 'yearly' && <p className="text-[10px] text-slate-300 italic">See monthly breakdown</p>}
                    </Card>
                    <Card className={clsx("p-4 border-l-4", (viewMode === 'monthly' ? currentNetFlow : yearIncomeTotal - yearExpenseTotal) >= 0 ? "border-l-blue-500" : "border-l-orange-500")}>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Net Flow</p>
                        <p className={clsx("text-xl font-black", (viewMode === 'monthly' ? currentNetFlow : yearIncomeTotal - yearExpenseTotal) >= 0 ? "text-blue-600" : "text-orange-600")}>
                            CHF {(viewMode === 'monthly' ? currentNetFlow : yearIncomeTotal - yearExpenseTotal).toLocaleString()}
                        </p>
                    </Card>
                </div>

                {/* 4. Main Content: List or Grid */}
                {viewMode === 'monthly' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Monthly Income List */}
                        <Card>
                            <div className="flex justify-between items-center mb-4">
                                <CardTitle className="text-emerald-700 mb-0">Income</CardTitle>
                                <div className="flex items-center gap-4">
                                    <div className="text-sm font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                        CHF {currentMonthIncome.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {MONTHS[selectedMonth]} {selectedYear}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {filteredIncomes.map(item => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg group border border-transparent hover:border-emerald-200 transition-colors">
                                        <div className="flex-1">
                                            {editingId === item.id ? (
                                                <div className="flex flex-col gap-1">
                                                    <input
                                                        className="px-2 py-1 text-sm border rounded"
                                                        value={editForm.name}
                                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                    />
                                                    <select
                                                        className="px-2 py-1 text-xs border rounded"
                                                        value={editForm.category}
                                                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                                    >
                                                        {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="font-bold text-slate-700 text-sm">{item.name}</p>
                                                    <span className="text-[10px] uppercase font-bold bg-white text-slate-400 px-1.5 py-0.5 rounded border border-slate-100">{item.category}</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">CHF</span>
                                            <input
                                                type="number"
                                                value={getMonthlyAmount(item, selectedYear, selectedMonth)}
                                                onChange={(e) => updateMonthlyAmount(item.id, 'income', selectedYear, selectedMonth, parseFloat(e.target.value) || 0)}
                                                className="w-24 px-2 py-1 text-right font-mono font-bold text-emerald-600 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingId === item.id ? (
                                                <>
                                                    <button onClick={() => saveEdit(item.id, 'income')} className="p-1 text-emerald-500 hover:bg-emerald-100 rounded"><Check size={14} /></button>
                                                    <button onClick={cancelEditing} className="p-1 text-slate-400 hover:bg-slate-200 rounded"><X size={14} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEditing(item)} className="p-1 text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                                                    <button onClick={() => deleteItem(item.id, 'income')} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Add Income Mini Form */}
                                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                                    <input
                                        className="flex-1 px-3 py-2 text-xs border rounded bg-slate-50/50"
                                        placeholder="Name"
                                        value={newItem.name}
                                        onChange={e => setNewItem({ ...newItem, name: e.target.value, category: incomeCategories[0] || '' })}
                                    />
                                    <select
                                        className="px-2 py-2 text-xs border rounded bg-slate-50/50"
                                        value={newItem.category}
                                        onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                    >
                                        <option value="" disabled>Category</option>
                                        {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <input
                                        type="number"
                                        className="w-20 px-3 py-2 text-xs border rounded bg-slate-50/50"
                                        placeholder="CHF"
                                        value={newItem.amount}
                                        onChange={e => setNewItem({ ...newItem, amount: e.target.value })}
                                    />
                                    <Button size="sm" onClick={() => addItem('income')}><Plus size={16} /></Button>
                                </div>
                                <div className="flex gap-2 items-center bg-slate-50/50 p-2 rounded border border-slate-100 mt-1 flex-wrap">
                                    <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!newItem.isRecurring}
                                            onChange={e => setNewItem({ ...newItem, isRecurring: !e.target.checked })}
                                        />
                                        One-time
                                    </label>

                                    {!newItem.isRecurring ? (
                                        <select
                                            className="px-2 py-1 text-xs border rounded bg-white"
                                            value={newItem.oneTimeMonth}
                                            onChange={e => setNewItem({ ...newItem, oneTimeMonth: e.target.value })}
                                        >
                                            <option value="">{MONTHS[selectedMonth]} (Default)</option>
                                            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                                        </select>
                                    ) : (
                                        <>
                                            <select
                                                className="px-2 py-1 text-xs border rounded bg-white"
                                                value={newItem.recurrenceFrequency}
                                                onChange={e => setNewItem({ ...newItem, recurrenceFrequency: e.target.value as any })}
                                            >
                                                <option value="monthly">Monthly</option>
                                                <option value="quarterly">Quarterly</option>
                                                <option value="semiannual">Every 6 Months</option>
                                                <option value="yearly">Yearly</option>
                                            </select>
                                            <span className="text-xs text-slate-400">Ends:</span>
                                            <select
                                                className="px-2 py-1 text-xs border rounded bg-white"
                                                value={newItem.lastOccurringMonth}
                                                onChange={e => setNewItem({ ...newItem, lastOccurringMonth: e.target.value })}
                                            >
                                                <option value="">Never (Dec)</option>
                                                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                                            </select>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Monthly Expense List */}
                        <Card>
                            <div className="flex justify-between items-center mb-4">
                                <CardTitle className="text-rose-700 mb-0">Expenses</CardTitle>
                                <div className="flex items-center gap-4">
                                    <div className="text-sm font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
                                        CHF {currentMonthExpenseTotal.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {MONTHS[selectedMonth]} {selectedYear}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {filteredExpenses.map(item => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg group border border-transparent hover:border-rose-200 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            {editingId === item.id ? (
                                                <div className="flex flex-col gap-1">
                                                    <input
                                                        className="px-2 py-1 text-sm border rounded"
                                                        value={editForm.name}
                                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                    />
                                                    <select
                                                        className="px-2 py-1 text-xs border rounded"
                                                        value={editForm.category}
                                                        onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                                    >
                                                        {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-slate-700 text-sm truncate">{item.name}</p>
                                                        {item.category === 'savings' && <span className="text-[8px] uppercase font-black bg-indigo-100 text-indigo-500 px-1.5 py-0.5 rounded-full flex-shrink-0">Savings</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1 overflow-hidden">
                                                        <span className="text-[10px] uppercase font-bold bg-white text-slate-400 px-1.5 py-0.5 rounded border border-slate-100 truncate">{item.category}</span>
                                                        {item.linkedSavingsId && (
                                                            <span className="text-[10px] text-indigo-400 truncate flex items-center gap-0.5 max-w-[100px]">
                                                                → {savings.find(s => s.id === item.linkedSavingsId)?.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">CHF</span>
                                            <input
                                                type="number"
                                                value={getMonthlyAmount(item, selectedYear, selectedMonth)}
                                                onChange={(e) => updateMonthlyAmount(item.id, 'expense', selectedYear, selectedMonth, parseFloat(e.target.value) || 0)}
                                                className="w-24 px-2 py-1 text-right font-mono font-bold text-rose-600 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingId === item.id ? (
                                                <>
                                                    <button onClick={() => saveEdit(item.id, 'expense')} className="p-1 text-emerald-500 hover:bg-emerald-100 rounded"><Check size={14} /></button>
                                                    <button onClick={cancelEditing} className="p-1 text-slate-400 hover:bg-slate-200 rounded"><X size={14} /></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEditing(item)} className="p-1 text-slate-300 hover:text-slate-600"><Pencil size={14} /></button>
                                                    <button onClick={() => deleteItem(item.id, 'expense')} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Add Expense Mini Form */}
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            className="flex-1 px-3 py-2 text-xs border rounded bg-slate-50/50"
                                            placeholder="Expense Name"
                                            value={newItem.name}
                                            onChange={e => setNewItem({ ...newItem, name: e.target.value, category: expenseCategories[0] || '' })}
                                        />
                                        <select
                                            className="w-32 px-2 py-2 text-xs border rounded bg-slate-50/50"
                                            value={newItem.category}
                                            onChange={e => setNewItem({ ...newItem, category: e.target.value, isSavingsLinked: e.target.value === 'savings' })}
                                        >
                                            <option value="" disabled>Category</option>
                                            {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        {newItem.category === 'savings' && (
                                            <select
                                                className="flex-1 px-2 py-2 text-xs border rounded bg-indigo-50 border-indigo-100 text-indigo-700"
                                                value={newItem.linkedSavingsId}
                                                onChange={e => setNewItem({ ...newItem, linkedSavingsId: e.target.value })}
                                            >
                                                <option value="">Link to Account...</option>
                                                {savings.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        )}

                                        <div className={clsx("flex items-center gap-2", newItem.category !== 'savings' && "flex-1")}>
                                            <input
                                                type="number"
                                                className="w-full px-3 py-2 text-xs border rounded bg-slate-50/50"
                                                placeholder="Amount"
                                                value={newItem.amount}
                                                onChange={e => setNewItem({ ...newItem, amount: e.target.value })}
                                            />
                                        </div>
                                        <Button size="sm" onClick={() => addItem('expense')} className='w-12 flex justify-center'><Plus size={16} /></Button>
                                    </div>
                                    <div className="flex gap-2 items-center bg-slate-50/50 p-2 rounded border border-slate-100 mt-1 flex-wrap">
                                        <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!newItem.isRecurring}
                                                onChange={e => setNewItem({ ...newItem, isRecurring: !e.target.checked })}
                                            />
                                            One-time
                                        </label>

                                        {!newItem.isRecurring ? (
                                            <select
                                                className="px-2 py-1 text-xs border rounded bg-white"
                                                value={newItem.oneTimeMonth}
                                                onChange={e => setNewItem({ ...newItem, oneTimeMonth: e.target.value })}
                                            >
                                                <option value="">{MONTHS[selectedMonth]} (Default)</option>
                                                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                                            </select>
                                        ) : (
                                            <>
                                                <select
                                                    className="px-2 py-1 text-xs border rounded bg-white"
                                                    value={newItem.recurrenceFrequency}
                                                    onChange={e => setNewItem({ ...newItem, recurrenceFrequency: e.target.value as any })}
                                                >
                                                    <option value="monthly">Monthly</option>
                                                    <option value="quarterly">Quarterly</option>
                                                    <option value="semiannual">Every 6 Months</option>
                                                    <option value="yearly">Yearly</option>
                                                </select>
                                                <span className="text-xs text-slate-400">Ends:</span>
                                                <select
                                                    className="px-2 py-1 text-xs border rounded bg-white"
                                                    value={newItem.lastOccurringMonth}
                                                    onChange={e => setNewItem({ ...newItem, lastOccurringMonth: e.target.value })}
                                                >
                                                    <option value="">Never (Dec)</option>
                                                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                                                </select>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                ) : (
                    <Card className="overflow-x-auto">
                        <CardTitle>Annual Grid View {selectedYear}</CardTitle>
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
                                    <th className="p-3 font-bold sticky left-0 bg-slate-50 z-10 w-48 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Item</th>
                                    {MONTHS.map(m => <th key={m} className="p-3 font-bold text-right min-w-[100px]">{m.substring(0, 3)}</th>)}
                                    <th className="p-3 font-bold text-right min-w-[100px] bg-slate-100">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Incomes */}
                                <tr className="bg-emerald-50/50 border-b border-emerald-100"><td colSpan={14} className="p-2 font-bold text-emerald-700 text-xs uppercase tracking-wider pl-3">Income</td></tr>
                                {filteredIncomes.map(item => (
                                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {item.name}
                                            <div className="text-[10px] text-slate-400 capitalize">{item.category}</div>
                                        </td>
                                        {MONTHS.map((_, idx) => (
                                            <td key={idx} className="p-1">
                                                <input
                                                    type="number"
                                                    value={getMonthlyAmount(item, selectedYear, idx)}
                                                    onChange={(e) => updateMonthlyAmount(item.id, 'income', selectedYear, idx, parseFloat(e.target.value) || 0)}
                                                    className="w-full text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-emerald-300 rounded px-1 py-1 outline-none text-slate-600 focus:text-emerald-700 font-mono text-xs"
                                                />
                                            </td>
                                        ))}
                                        <td className="p-1 font-bold text-right text-emerald-700 bg-slate-50/50">
                                            {MONTHS.reduce((sum, _, m) => sum + getMonthlyAmount(item, selectedYear, m), 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {/* Expenses */}
                                <tr className="bg-rose-50/50 border-b border-rose-100"><td colSpan={14} className="p-2 font-bold text-rose-700 text-xs uppercase tracking-wider pl-3">Expenses</td></tr>
                                {expenses.map(item => (
                                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {item.name}
                                            <div className="text-[10px] text-slate-400 capitalize flex gap-1">
                                                {item.category}
                                                {item.category === 'savings' && <span className="font-bold text-indigo-500">SAV</span>}
                                            </div>
                                        </td>
                                        {MONTHS.map((_, idx) => (
                                            <td key={idx} className="p-1">
                                                <input
                                                    type="number"
                                                    value={getMonthlyAmount(item, selectedYear, idx)}
                                                    onChange={(e) => updateMonthlyAmount(item.id, 'expense', selectedYear, idx, parseFloat(e.target.value) || 0)}
                                                    className="w-full text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-rose-300 rounded px-1 py-1 outline-none text-slate-600 focus:text-rose-700 font-mono text-xs"
                                                />
                                            </td>
                                        ))}
                                        <td className="p-1 font-bold text-right text-rose-700 bg-slate-50/50">
                                            {MONTHS.reduce((sum, _, m) => sum + getMonthlyAmount(item, selectedYear, m), 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {/* Yearly Grid Footer with Summary Rows */}
                            <tfoot className="border-t-2 border-slate-300">
                                {/* Total Income Row */}
                                <tr className="bg-emerald-50">
                                    <td className="p-3 font-bold text-emerald-800 sticky left-0 bg-emerald-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Total Income</td>
                                    {MONTHS.map((_, m) => {
                                        const val = filteredIncomes.reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, m), 0);
                                        return <td key={m} className="p-2 text-right font-bold text-emerald-700 text-xs">{val.toLocaleString()}</td>
                                    })}
                                    <td className="p-2 text-right font-black text-emerald-900 bg-emerald-100">
                                        {yearIncomeTotal.toLocaleString()}
                                    </td>
                                </tr>
                                {/* Total Savings Row */}
                                <tr className="bg-indigo-50">
                                    <td className="p-3 font-bold text-indigo-800 sticky left-0 bg-indigo-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Total Savings</td>
                                    {MONTHS.map((_, m) => {
                                        const val = filteredExpenses
                                            .filter(e => e.category === 'savings' || !!e.linkedSavingsId)
                                            .reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, m), 0);
                                        return <td key={m} className="p-2 text-right font-bold text-indigo-700 text-xs">{val.toLocaleString()}</td>
                                    })}
                                    <td className="p-2 text-right font-black text-indigo-900 bg-indigo-100">
                                        {filteredExpenses.filter(e => e.category === 'savings' || !!e.linkedSavingsId)
                                            .reduce((sum, item) => {
                                                let itemYearSum = 0;
                                                for (let m = 0; m < 12; m++) itemYearSum += getMonthlyAmount(item, selectedYear, m);
                                                return sum + itemYearSum;
                                            }, 0).toLocaleString()}
                                    </td>
                                </tr>
                                {/* Total Expenses (Consumption) Row - Expenses excluding Savings */}
                                <tr className="bg-rose-50">
                                    <td className="p-3 font-bold text-rose-800 sticky left-0 bg-rose-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Expenses (Cons.)</td>
                                    {MONTHS.map((_, m) => {
                                        // Total Expenses minus Savings
                                        const totalExp = filteredExpenses.reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, m), 0);
                                        const savingsExp = filteredExpenses
                                            .filter(e => e.category === 'savings' || !!e.linkedSavingsId)
                                            .reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, m), 0);
                                        return <td key={m} className="p-2 text-right font-bold text-rose-700 text-xs">{(totalExp - savingsExp).toLocaleString()}</td>
                                    })}
                                    <td className="p-2 text-right font-black text-rose-900 bg-rose-100">
                                        {/* Year Total Consumption */}
                                        {(filteredExpenses.reduce((sum, item) => {
                                            let s = 0; for (let m = 0; m < 12; m++) s += getMonthlyAmount(item, selectedYear, m); return sum + s;
                                        }, 0) -
                                            filteredExpenses.filter(e => e.category === 'savings' || !!e.linkedSavingsId).reduce((sum, item) => {
                                                let s = 0; for (let m = 0; m < 12; m++) s += getMonthlyAmount(item, selectedYear, m); return sum + s;
                                            }, 0)).toLocaleString()}
                                    </td>
                                </tr>
                                {/* Delta Row (Net Flow) */}
                                <tr className="bg-slate-100 border-t border-slate-300">
                                    <td className="p-3 font-black text-slate-800 sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Delta</td>
                                    {MONTHS.map((_, m) => {
                                        const inc = filteredIncomes.reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, m), 0);
                                        const exp = filteredExpenses.reduce((sum, item) => sum + getMonthlyAmount(item, selectedYear, m), 0);
                                        const delta = inc - exp;
                                        return <td key={m} className={clsx("p-2 text-right font-black text-xs", delta >= 0 ? "text-blue-600" : "text-orange-600")}>{delta.toLocaleString()}</td>
                                    })}
                                    <td className={clsx("p-2 text-right font-black bg-slate-200", (yearIncomeTotal - yearExpenseTotal) >= 0 ? "text-blue-800" : "text-orange-800")}>
                                        {(yearIncomeTotal - yearExpenseTotal).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </Card>
                )
                }

                {/* 5. Savings Projection (Live Accumulation) */}
                <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
                    <CardTitle className="text-indigo-800 flex items-center justify-between">
                        <div className="flex items-center gap-2"><PiggyBank size={20} /> Simulated Savings Balance ({MONTHS[selectedMonth]} {selectedYear})</div>
                        <div className="text-xs font-normal text-indigo-400">Projections based on budget entries</div>
                    </CardTitle>
                    <div className="space-y-4">
                        {savings.map(acc => {
                            const currentBalance = getSavingsBalance(acc.id, selectedYear, selectedMonth);
                            const percent = Math.min((currentBalance / acc.yearlyGoal) * 100, 100);

                            return (
                                <div key={acc.id} className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <div>
                                            <h4 className="font-bold text-slate-700">{acc.name}</h4>
                                            <p className="text-xs text-slate-400">Goal: CHF {acc.yearlyGoal.toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-indigo-600">CHF {currentBalance.toLocaleString()}</p>
                                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide">Projected Balance</p>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                        {savings.length === 0 && <p className="text-slate-400 italic text-sm text-center">No savings accounts configured.</p>}
                    </div>
                </Card>

            </div>
        </Layout>
    );
}
