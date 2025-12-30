import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, onSnapshot, deleteDoc, orderBy, addDoc, doc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2, ShoppingBag, TrendingDown, Plus, Calendar, DollarSign, X, Tag, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { clsx } from 'clsx';

// Interfaces
interface DailyGoal {
    id: string; // date YYYY-MM-DD
    declutteredItem?: string;
    declutterValue?: number; // Legacy or embedded value
}

interface DeclutterItem {
    id: string;
    name: string;
    value: number;
    date: Timestamp;
}

interface Investment {
    id: string;
    name: string;
    date: Timestamp;
    cost: number;
    category?: string;
    notes?: string;
    rating?: number;
}

export default function LessIsMore() {
    const [legacyItems, setLegacyItems] = useState<DailyGoal[]>([]);
    const [declutterItems, setDeclutterItems] = useState<DeclutterItem[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);

    const [activeTab, setActiveTab] = useState<'declutter' | 'invest'>('declutter');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State (Unified for both types mostly)
    const [formName, setFormName] = useState('');
    const [formValue, setFormValue] = useState('');
    const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [formCategory, setFormCategory] = useState('Tech');

    // Data Fetching
    useEffect(() => {
        // 1. Fetch Legacy Daily Goals (ReadOnly / Migrate)
        const qGoals = query(collection(db, 'daily_goals'));
        const unsubGoals = onSnapshot(qGoals, (snap) => {
            const items = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as DailyGoal))
                .filter(g => g.declutteredItem && g.declutteredItem.trim().length > 0)
                .sort((a, b) => b.id.localeCompare(a.id));
            setLegacyItems(items);
        });

        // 2. Fetch New Declutter Items
        const qDeclutter = query(collection(db, 'declutter_items'), orderBy('date', 'desc'));
        const unsubDeclutter = onSnapshot(qDeclutter, (snap) => {
            setDeclutterItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeclutterItem)));
        });

        // 3. Fetch Investments
        const qInvest = query(collection(db, 'investments'), orderBy('date', 'desc'));
        const unsubInvest = onSnapshot(qInvest, (snap) => {
            setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Investment)));
        });

        return () => {
            unsubGoals();
            unsubDeclutter();
            unsubInvest();
        };
    }, []);

    // Helper: Reset Form
    const resetForm = () => {
        setFormName('');
        setFormValue('');
        setFormDate(format(new Date(), 'yyyy-MM-dd'));
        setFormCategory('Tech');
        setEditingId(null);
        setIsAdding(false);
    };

    // Helper: populate form for edit
    const startEdit = (item: any, type: 'invest' | 'declutter') => {
        setEditingId(item.id);
        setFormName(type === 'invest' ? item.name : (item.name || item.declutteredItem));
        setFormValue(String(type === 'invest' ? item.cost : (item.value || 0)));
        // Handle Date: Timestamp vs String ID (Legacy)
        if (item.date) {
            setFormDate(format(item.date.toDate(), 'yyyy-MM-dd'));
        } else if (item.id.match(/^\d{4}-\d{2}-\d{2}$/)) {
            setFormDate(item.id);
        }
        setFormCategory(item.category || 'Tech');
        setIsAdding(true);
    };

    // SAVE Handlers
    const saveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formName) return;

        const val = Number(formValue) || 0;
        const dateTs = Timestamp.fromDate(new Date(formDate));

        if (activeTab === 'invest') {
            if (editingId) {
                await updateDoc(doc(db, 'investments', editingId), {
                    name: formName,
                    cost: val,
                    date: dateTs,
                    category: formCategory
                });
            } else {
                await addDoc(collection(db, 'investments'), {
                    name: formName,
                    cost: val,
                    date: dateTs,
                    category: formCategory,
                    rating: 0
                });
            }
        } else {
            // Declutter Tab
            if (editingId) {
                // Check if it's a legacy item (ID is a date string)
                if (editingId.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // MIGRATION: Create new doc, clear legacy field
                    const batch = writeBatch(db);
                    const newRef = doc(collection(db, 'declutter_items'));
                    batch.set(newRef, {
                        name: formName,
                        value: val,
                        date: dateTs
                    });
                    // Clear legacy
                    const legacyRef = doc(db, 'daily_goals', editingId);
                    batch.update(legacyRef, { declutteredItem: '' });
                    await batch.commit();
                } else {
                    // Normal Update
                    await updateDoc(doc(db, 'declutter_items', editingId), {
                        name: formName,
                        value: val,
                        date: dateTs
                    });
                }
            } else {
                await addDoc(collection(db, 'declutter_items'), {
                    name: formName,
                    value: val,
                    date: dateTs
                });
            }
        }
        resetForm();
    };


    const deleteItem = async (id: string, isLegacy: boolean = false) => {
        if (!confirm('Delete this item?')) return;

        if (activeTab === 'invest') {
            await deleteDoc(doc(db, 'investments', id));
        } else {
            if (isLegacy) {
                await updateDoc(doc(db, 'daily_goals', id), { declutteredItem: '' });
            } else {
                await deleteDoc(doc(db, 'declutter_items', id));
            }
        }
    };

    // Stats Calculation
    const currentYear = new Date().getFullYear();

    // Declutter Stats
    const declutterLegacyCount = legacyItems.filter(i => i.id.startsWith(String(currentYear))).length;
    const declutterNewItems = declutterItems.filter(i => i.date.toDate().getFullYear() === currentYear);
    const totalDeclutteredCount = declutterLegacyCount + declutterNewItems.length;
    const totalDeclutteredValue = declutterNewItems.reduce((a, b) => a + (b.value || 0), 0);

    // Invest Stats
    const investNewItems = investments.filter(i => i.date.toDate().getFullYear() === currentYear);
    const totalInvestCount = investNewItems.length;
    const totalInvestValue = investNewItems.reduce((a, b) => a + (b.cost || 0), 0);

    const netItemFlow = totalInvestCount - totalDeclutteredCount;

    return (
        <Layout>
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-2">Less Is More 🌿</h2>
                    <p className="text-slate-500">Simplify your life. Track what leaves and what enters.</p>
                </div>
            </header>

            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="p-6 bg-slate-50 border-slate-200">
                    <div className="flex items-center gap-3 mb-4 text-slate-500">
                        <div className="p-2 bg-white rounded-lg shadow-sm text-slate-600"><Trash2 size={24} /></div>
                        <span className="font-bold text-sm uppercase tracking-wider">Decluttered (2025)</span>
                    </div>
                    <div>
                        <span className="text-4xl font-bold text-slate-800">{totalDeclutteredCount}</span>
                        <span className="text-slate-400 font-medium ml-2">items</span>
                    </div>
                    <p className="text-xs font-bold text-slate-400 mt-2">Value: CHF {totalDeclutteredValue.toLocaleString()}</p>
                </Card>

                <Card className="p-6 bg-indigo-50 border-indigo-200">
                    <div className="flex items-center gap-3 mb-4 text-indigo-500">
                        <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600"><ShoppingBag size={24} /></div>
                        <span className="font-bold text-sm uppercase tracking-wider">Investments</span>
                    </div>
                    <div>
                        <span className="text-4xl font-bold text-indigo-900">{totalInvestCount}</span>
                        <span className="text-indigo-400 font-medium ml-2">items</span>
                    </div>
                    <p className="text-xs font-bold text-indigo-400 mt-2">Cost: CHF {totalInvestValue.toLocaleString()}</p>
                </Card>

                <Card className={clsx("p-6 border-2", netItemFlow <= 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100")}>
                    <div className={clsx("flex items-center gap-3 mb-4", netItemFlow <= 0 ? "text-emerald-600" : "text-rose-600")}>
                        <div className="p-2 bg-white rounded-lg shadow-sm"><TrendingDown size={24} /></div>
                        <span className="font-bold text-sm uppercase tracking-wider">Net Flow</span>
                    </div>
                    <div>
                        <span className={clsx("text-4xl font-bold", netItemFlow <= 0 ? "text-emerald-800" : "text-rose-800")}>
                            {netItemFlow > 0 ? '+' : ''}{netItemFlow}
                        </span>
                        <span className={clsx("font-medium ml-2 opacity-60", netItemFlow <= 0 ? "text-emerald-700" : "text-rose-700")}>items</span>
                    </div>
                    <p className={clsx("text-xs font-bold mt-2", netItemFlow <= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {netItemFlow <= 0 ? "Simplicity winning." : "Accumulation warning."}
                    </p>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button
                    onClick={() => { setActiveTab('declutter'); setIsAdding(false); setEditingId(null); }}
                    className={clsx("pb-3 px-2 font-bold flex items-center gap-2 transition-colors border-b-2", activeTab === 'declutter' ? "text-brand-primary border-brand-primary" : "text-slate-400 border-transparent hover:text-slate-600")}
                >
                    <Trash2 size={18} /> Decluttered History
                </button>
                <button
                    onClick={() => { setActiveTab('invest'); setIsAdding(false); setEditingId(null); }}
                    className={clsx("pb-3 px-2 font-bold flex items-center gap-2 transition-colors border-b-2", activeTab === 'invest' ? "text-brand-primary border-brand-primary" : "text-slate-400 border-transparent hover:text-slate-600")}
                >
                    <ShoppingBag size={18} /> Investments
                </button>
            </div>

            {/* Add/Edit Form */}
            {isAdding && (
                <Card className="mb-8 border-2 border-brand-primary/20 shadow-md animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-4">
                        <CardTitle>{editingId ? 'Edit Item' : `Add ${activeTab === 'invest' ? 'Investment' : 'Decluttered Item'}`}</CardTitle>
                        <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <form onSubmit={saveItem} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            value={formName} onChange={e => setFormName(e.target.value)}
                            placeholder="Item Name" className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold outline-none focus:border-brand-primary" autoFocus
                        />
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">CHF</span>
                            <input
                                type="number" value={formValue} onChange={e => setFormValue(e.target.value)}
                                placeholder="Value / Cost" className="pl-12 w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:border-brand-primary"
                            />
                        </div>
                        {activeTab === 'invest' && (
                            <select
                                value={formCategory} onChange={e => setFormCategory(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:border-brand-primary"
                            >
                                <option value="Tech">Tech</option>
                                <option value="Clothing">Clothing</option>
                                <option value="Home">Home</option>
                                <option value="Hobby">Hobby</option>
                                <option value="Other">Other</option>
                            </select>
                        )}
                        <input
                            type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                            className={clsx("bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none focus:border-brand-primary text-slate-500", activeTab !== 'invest' && "md:col-span-1")}
                        />
                        <button className="col-span-1 md:col-span-2 bg-brand-primary text-white font-bold py-2 rounded-lg hover:bg-sky-900 transition-colors shadow-lg shadow-brand-primary/20">
                            {editingId ? 'Save Changes' : 'Add Item'}
                        </button>
                    </form>
                </Card>
            )}

            {/* Lists */}
            <div className="space-y-4">
                {/* NEW Button (if not adding) */}
                {!isAdding && (
                    <button
                        onClick={() => { resetForm(); setIsAdding(true); }}
                        className="w-full py-4 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl flex items-center justify-center gap-2 text-slate-400 font-bold hover:bg-white hover:border-brand-primary hover:text-brand-primary transition-all group"
                    >
                        <span className="bg-slate-200 text-slate-500 p-1 rounded-full group-hover:bg-brand-primary group-hover:text-white transition-colors"><Plus size={16} /></span>
                        Record New {activeTab === 'invest' ? 'Investment' : 'Decluttered Item'}
                    </button>
                )}

                {/* Items List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeTab === 'invest' ? (
                        investments.map(item => (
                            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center gap-4 group hover:shadow-md transition-shadow">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mr-2 self-start md:self-center">
                                    <ShoppingBag size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-800 text-lg">{item.name}</h4>
                                        <span className="font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg text-sm">CHF {item.cost}</span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                                        <span className="flex items-center gap-1"><Calendar size={12} /> {format(item.date.toDate(), 'MMM d, yyyy')}</span>
                                        <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full"><Tag size={10} /> {item.category}</span>
                                    </div>
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => startEdit(item, 'invest')} className="p-2 text-slate-300 hover:text-brand-primary hover:bg-slate-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                                    <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <>
                            {declutterItems.map(item => (
                                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-4 group hover:shadow-md transition-shadow">
                                    <div className="bg-slate-100 p-3 rounded-full text-slate-500">
                                        <Trash2 size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <p className="font-bold text-slate-800">{item.name}</p>
                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">CHF {item.value || 0}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                            <Calendar size={12} /> {format(item.date.toDate(), 'MMMM d, yyyy')}
                                        </p>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button onClick={() => startEdit(item, 'declutter')} className="p-1 text-slate-300 hover:text-brand-primary"><Edit2 size={14} /></button>
                                        <button onClick={() => deleteItem(item.id)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                            {/* Legacy Items */}
                            {legacyItems.map(item => (
                                <div key={item.id} className="bg-slate-50 p-4 rounded-xl shadow-inner border border-slate-100 flex items-start gap-4 group opacity-75">
                                    <div className="bg-white p-3 rounded-full text-slate-400 border border-slate-100">
                                        <Trash2 size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <p className="font-bold text-slate-600">{item.declutteredItem} <span className="text-[10px] uppercase bg-slate-200 px-1 rounded text-slate-500">Legacy</span></p>
                                        </div>
                                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                            <Calendar size={12} /> {format(parseISO(item.id), 'MMMM d, yyyy')}
                                        </p>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                        <button onClick={() => startEdit({ id: item.id, name: item.declutteredItem }, 'declutter')} className="p-1 text-brand-primary bg-white shadow rounded text-xs px-2 font-bold">Unify</button>
                                        <button onClick={() => deleteItem(item.id, true)} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}
