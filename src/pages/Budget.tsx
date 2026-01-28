import { useState, useMemo, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle, Button } from "../components/Ui";
import { Wallet, Plus, Trash2, PiggyBank, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
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

    monthlyAmounts: Record<number, number>; // 0 (Jan) -> 11 (Dec)
}

interface SavingsAccount {
    id: string;
    name: string;
    currentValue: number; // Renamed from initialBalance
    yearlyGoal: number;
}

// --- Constants ---

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CURRENT_YEAR = new Date().getFullYear();

export default function Budget() {
    // --- State: View & Date ---
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear] = useState(CURRENT_YEAR); // setSelectedYear unused for now
    const [showCategorySettings, setShowCategorySettings] = useState(false);

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

    // --- Helpers ---

    const getMonthlyAmount = (item: BudgetItem, month: number) => item.monthlyAmounts[month] || 0;

    const updateMonthlyAmount = async (id: string, type: 'income' | 'expense', month: number, value: number) => {
        const collectionName = type === 'income' ? 'budget_incomes' : 'budget_expenses';
        try {
            await updateDoc(doc(db, collectionName, id), {
                [`monthlyAmounts.${month}`]: value
            });
        } catch (e) {
            console.error("Error updating monthly amount", e);
        }
    };

    // --- Calculations ---

    // 1. Current View Totals
    const currentMonthIncome = useMemo(() => incomes.reduce((sum, item) => sum + getMonthlyAmount(item, selectedMonth), 0), [incomes, selectedMonth]);
    const currentMonthExpenseTotal = useMemo(() => expenses.reduce((sum, item) => sum + getMonthlyAmount(item, selectedMonth), 0), [expenses, selectedMonth]);
    const currentMonthSavingsAllocated = useMemo(() => expenses.filter(e => e.category === 'savings').reduce((sum, item) => sum + getMonthlyAmount(item, selectedMonth), 0), [expenses, selectedMonth]);
    const currentMonthConsumption = currentMonthExpenseTotal - currentMonthSavingsAllocated;
    const currentNetFlow = currentMonthIncome - currentMonthExpenseTotal; // Unallocated cash

    // 2. Yearly Totals
    const yearIncomeTotal = useMemo(() => incomes.reduce((sum, item) => sum + Object.values(item.monthlyAmounts).reduce((a, b) => a + b, 0), 0), [incomes]);
    const yearExpenseTotal = useMemo(() => expenses.reduce((sum, item) => sum + Object.values(item.monthlyAmounts).reduce((a, b) => a + b, 0), 0), [expenses]);

    // 3. Savings Accumulation (Running Balance)
    const getSavingsBalance = (savingsId: string, monthIndex: number) => {
        const account = savings.find(s => s.id === savingsId);
        if (!account) return 0;

        let total = account.currentValue;

        // Find all expenses linked to this savings account
        const linkedExpenses = expenses.filter(e => e.linkedSavingsId === savingsId);

        // Sum up contributions from Jan (0) to monthIndex
        for (let m = 0; m <= monthIndex; m++) {
            linkedExpenses.forEach(exp => {
                total += (exp.monthlyAmounts[m] || 0);
            });
        }
        return total;
    };

    // --- Actions ---

    const addItem = async (type: 'income' | 'expense') => {
        if (!newItem.name || !newItem.amount || !newItem.category) return;

        const amount = parseFloat(newItem.amount);
        const monthlyAmounts: Record<number, number> = {};
        const isRecurring = newItem.isRecurring;
        const oneTimeMonth = newItem.oneTimeMonth === '' ? selectedMonth : parseInt(newItem.oneTimeMonth);
        const lastMonth = newItem.lastOccurringMonth === '' ? 11 : parseInt(newItem.lastOccurringMonth);

        // Initialize all to 0
        for (let i = 0; i < 12; i++) monthlyAmounts[i] = 0;

        if (!isRecurring) {
            // One time
            monthlyAmounts[oneTimeMonth] = amount;
        } else {
            // Recurring logic
            let step = 1;
            if (newItem.recurrenceFrequency === 'quarterly') step = 3;
            else if (newItem.recurrenceFrequency === 'semiannual') step = 6;
            else if (newItem.recurrenceFrequency === 'yearly') step = 12;

            // Start usually at Jan (0) for budget planning? 
            // Or should we ask for "Start Month"? Assuming Start Jan for now as per typical Annual Budget
            // Using loop to fill
            for (let i = 0; i < 12; i += step) {
                if (i <= lastMonth) {
                    monthlyAmounts[i] = amount;
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
            monthlyAmounts
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
                            <Wallet className="w-6 h-6" /> Budget {selectedYear}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <button onClick={() => setSelectedMonth((m) => (m === 0 ? 11 : m - 1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronLeft size={16} /></button>
                            <span className="font-bold text-slate-700 w-24 text-center select-none">{MONTHS[selectedMonth]}</span>
                            <button onClick={() => setSelectedMonth((m) => (m === 11 ? 0 : m + 1))} className="p-1 hover:bg-slate-100 rounded-full"><ChevronRight size={16} /></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                                <div className="text-xs text-slate-400">
                                    Edit items for <span className="font-bold text-emerald-600">{MONTHS[selectedMonth]}</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {incomes.map(item => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg group border border-transparent hover:border-emerald-200 transition-colors">
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-700 text-sm">{item.name}</p>
                                            <span className="text-[10px] uppercase font-bold bg-white text-slate-400 px-1.5 py-0.5 rounded border border-slate-100">{item.category}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">CHF</span>
                                            <input
                                                type="number"
                                                value={getMonthlyAmount(item, selectedMonth)}
                                                onChange={(e) => updateMonthlyAmount(item.id, 'income', selectedMonth, parseFloat(e.target.value) || 0)}
                                                className="w-24 px-2 py-1 text-right font-mono font-bold text-emerald-600 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                                            />
                                        </div>
                                        <button onClick={() => deleteItem(item.id, 'income')} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
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
                                <div className="text-xs text-slate-400">
                                    Edit items for <span className="font-bold text-rose-600">{MONTHS[selectedMonth]}</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {expenses.map(item => (
                                    <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg group border border-transparent hover:border-rose-200 transition-colors">
                                        <div className="flex-1 min-w-0">
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
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">CHF</span>
                                            <input
                                                type="number"
                                                value={getMonthlyAmount(item, selectedMonth)}
                                                onChange={(e) => updateMonthlyAmount(item.id, 'expense', selectedMonth, parseFloat(e.target.value) || 0)}
                                                className="w-24 px-2 py-1 text-right font-mono font-bold text-rose-600 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-rose-500 outline-none"
                                            />
                                        </div>
                                        <button onClick={() => deleteItem(item.id, 'expense')} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
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
                        <CardTitle>Annual Grid View</CardTitle>
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
                                {incomes.map(item => (
                                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                            {item.name}
                                            <div className="text-[10px] text-slate-400 capitalize">{item.category}</div>
                                        </td>
                                        {MONTHS.map((_, idx) => (
                                            <td key={idx} className="p-1">
                                                <input
                                                    type="number"
                                                    value={item.monthlyAmounts[idx]}
                                                    onChange={(e) => updateMonthlyAmount(item.id, 'income', idx, parseFloat(e.target.value) || 0)}
                                                    className="w-full text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-emerald-300 rounded px-1 py-1 outline-none text-slate-600 focus:text-emerald-700 font-mono text-xs"
                                                />
                                            </td>
                                        ))}
                                        <td className="p-1 font-bold text-right text-emerald-700 bg-slate-50/50">
                                            {Object.values(item.monthlyAmounts).reduce((a, b) => a + b, 0).toLocaleString()}
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
                                                    value={item.monthlyAmounts[idx]}
                                                    onChange={(e) => updateMonthlyAmount(item.id, 'expense', idx, parseFloat(e.target.value) || 0)}
                                                    className="w-full text-right bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-rose-300 rounded px-1 py-1 outline-none text-slate-600 focus:text-rose-700 font-mono text-xs"
                                                />
                                            </td>
                                        ))}
                                        <td className="p-1 font-bold text-right text-rose-700 bg-slate-50/50">
                                            {Object.values(item.monthlyAmounts).reduce((a, b) => a + b, 0).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                )
                }

                {/* 5. Savings Projection (Live Accumulation) */}
                <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
                    <CardTitle className="text-indigo-800 flex items-center justify-between">
                        <div className="flex items-center gap-2"><PiggyBank size={20} /> Simulated Savings Balance ({MONTHS[selectedMonth]})</div>
                        <div className="text-xs font-normal text-indigo-400">Projections based on budget entries</div>
                    </CardTitle>
                    <div className="space-y-4">
                        {savings.map(acc => {
                            const currentBalance = getSavingsBalance(acc.id, selectedMonth);
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

            </div >
        </Layout >
    );
}
