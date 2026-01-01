import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { BookOpen, Trophy, Book, Library, GraduationCap, Trash2, ShoppingBag, Leaf } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid } from 'recharts';
import { clsx } from 'clsx';

interface BookItem {
    id: string;
    title: string;
    author?: string;
    progress: number;
    startedAt: Timestamp;
    finishedAt?: Timestamp;
    rating?: number;
    category?: string;
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
}

interface LegacyDeclutter {
    id: string; // date string
    declutteredItem?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
    'Theology': '#f59e0b', // Amber
    'Business': '#3b82f6', // Blue
    'Fiction': '#8b5cf6', // Violet
    'Biography': '#10b981', // Emerald
    'Health': '#ef4444', // Red
    'General': '#64748b', // Slate
};

export default function Life() {
    const [books, setBooks] = useState<BookItem[]>([]);
    const [declutterItems, setDeclutterItems] = useState<DeclutterItem[]>([]);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [legacyDeclutter, setLegacyDeclutter] = useState<LegacyDeclutter[]>([]);

    useEffect(() => {
        // 1. Books
        const unsubBooks = onSnapshot(collection(db, 'books'), (snap) => {
            setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() } as BookItem)));
        });

        // 2. Declutter Items (New)
        const unsubDeclutter = onSnapshot(collection(db, 'declutter_items'), (snap) => {
            setDeclutterItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeclutterItem)));
        });

        // 3. Investments
        const unsubInvest = onSnapshot(collection(db, 'investments'), (snap) => {
            setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Investment)));
        });

        // 4. Legacy Declutter
        const unsubLegacy = onSnapshot(collection(db, 'daily_goals'), (snap) => {
            setLegacyDeclutter(snap.docs
                .map(d => ({ id: d.id, ...d.data() } as LegacyDeclutter))
                .filter(d => d.declutteredItem && d.declutteredItem.trim().length > 0)
            );
        });

        return () => { unsubBooks(); unsubDeclutter(); unsubInvest(); unsubLegacy(); };
    }, []);

    // --- Book Stats ---
    const finishedBooks = books.filter(b => b.progress === 100);
    const readingBooks = books.filter(b => b.progress < 100 && b.progress > 0);

    const bookCategoryData = Object.entries(
        books.reduce((acc, book) => {
            const cat = book.category || 'General';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));




    // --- Less Is More Stats ---

    // Filter for current year for stats, or total? Let's do Total for overview, and Year for context if needed.
    // User asked for "stats and diagrams", let's provide totals and maybe a flow chart.

    const totalDeclutteredCount = declutterItems.length + legacyDeclutter.length;
    const totalInvestCount = investments.length;
    const netFlow = totalInvestCount - totalDeclutteredCount;

    // Monthly Flow Data (Last 6 Months or Year)
    const getMonthKey = (date: Date) => format(date, 'MMM yy');

    const flowDataMap: Record<string, { date: Date, in: number, out: number }> = {};

    // Populate Investments (In)
    investments.forEach(i => {
        const d = i.date.toDate();
        const key = getMonthKey(d);
        if (!flowDataMap[key]) flowDataMap[key] = { date: d, in: 0, out: 0 };
        flowDataMap[key].in += 1;
    });

    // Populate Declutter (Out) - New
    declutterItems.forEach(i => {
        const d = i.date.toDate();
        const key = getMonthKey(d);
        if (!flowDataMap[key]) flowDataMap[key] = { date: d, in: 0, out: 0 };
        flowDataMap[key].out += 1;
    });

    // Populate Declutter (Out) - Legacy
    legacyDeclutter.forEach(i => {
        const d = parseISO(i.id);
        const key = getMonthKey(d);
        if (!flowDataMap[key]) flowDataMap[key] = { date: d, in: 0, out: 0 };
        flowDataMap[key].out += 1;
    });

    const flowChartData = Object.entries(flowDataMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(-6); // Last 6 recorded months


    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Life & Growth 🌱</h2>
                <p className="text-slate-500">Overview of your personal development and simplification journey.</p>
            </header>

            {/* Quick Stats Row 1: Books */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 w-full animate-in slide-in-from-bottom-2">
                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><BookOpen size={24} /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Current Reads</p>
                        <p className="text-2xl font-black text-slate-700">{readingBooks.length}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-full"><Trophy size={24} /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Books Finished</p>
                        <p className="text-2xl font-black text-slate-700">{finishedBooks.length}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full"><Library size={24} /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Library Size</p>
                        <p className="text-2xl font-black text-slate-700">{books.length}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-full"><GraduationCap size={24} /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Top Category</p>
                        <p className="text-lg font-black text-slate-700 truncate w-24">
                            {bookCategoryData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}
                        </p>
                    </div>
                </Card>
            </div>

            {/* Quick Stats Row 2: Less Is More */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 w-full animate-in slide-in-from-bottom-4">
                <Card className="flex items-center gap-4 border-l-4 border-l-red-400">
                    <div className="p-3 bg-red-50 text-red-500 rounded-full"><Trash2 size={24} /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Total Decluttered</p>
                        <p className="text-2xl font-black text-slate-800">{totalDeclutteredCount}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4 border-l-4 border-l-indigo-400">
                    <div className="p-3 bg-indigo-50 text-indigo-500 rounded-full"><ShoppingBag size={24} /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Total Investments</p>
                        <p className="text-2xl font-black text-slate-800">{totalInvestCount}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-4 border-l-4 border-l-emerald-400">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full"><Leaf size={24} /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Net Item Flow</p>
                        <p className={clsx("text-2xl font-black", netFlow <= 0 ? "text-emerald-600" : "text-rose-500")}>
                            {netFlow > 0 ? '+' : ''}{netFlow}
                        </p>
                    </div>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                {/* 1. Life Balance Flow (Bar Chart) */}
                <Card className="h-80 flex flex-col">
                    <CardTitle>Item Flow (Last 6 Months)</CardTitle>
                    {flowChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={flowChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                                <RechartsTooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar dataKey="in" name="Investments" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="out" name="Decluttered" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-300 italic">No flow data yet.</div>
                    )}
                </Card>

                {/* 2. Reading Category Pie */}
                <Card className="h-80 flex flex-col">
                    <CardTitle>Reading Interests</CardTitle>
                    {bookCategoryData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={bookCategoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {bookCategoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-wrap justify-center gap-2 mt-2">
                                {bookCategoryData.map(c => (
                                    <div key={c.name} className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-500">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.name] || '#94a3b8' }} />
                                        {c.name}
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : <div className="flex-1 flex items-center justify-center text-slate-300 italic">No books logged.</div>}
                </Card>

            </div>

            {/* Currently Active Books (Keep, it's nice) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3">
                    <h3 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2"><Book size={20} /> Currently Reading</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {readingBooks.slice(0, 3).map(book => (
                            <div key={book.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow">
                                <div>
                                    <h4 className="font-bold text-slate-800">{book.title}</h4>
                                    <p className="text-xs text-slate-500 mb-2">{book.author}</p>
                                    <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{book.category}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-brand-primary">{book.progress}%</span>
                                </div>
                            </div>
                        ))}
                        {readingBooks.length === 0 && <p className="text-slate-400 italic">No books in progress.</p>}
                    </div>
                </div>
            </div>

        </Layout>
    );
}
