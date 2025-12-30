import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { BookOpen, Trophy, Book, Library, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

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

    useEffect(() => {
        const q = query(collection(db, 'books'));
        const unsub = onSnapshot(q, (snap) => {
            setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() } as BookItem)));
        });
        return () => unsub();
    }, []);

    // --- Stats Calculation ---
    const finishedBooks = books.filter(b => b.progress === 100);
    const readingBooks = books.filter(b => b.progress < 100 && b.progress > 0);
    // Let's rely on book count for now.

    // 1. Reading Distribution (Pie)
    const categoryData = Object.entries(
        books.reduce((acc, book) => {
            const cat = book.category || 'General';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value }));

    // 2. Books Finished by Month (Bar) - last 6 months
    const booksByMonth = finishedBooks.reduce((acc, book) => {
        if (!book.finishedAt) return acc;
        const key = format(book.finishedAt.toDate(), 'MMM');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Sort logic would be needed for correct month order, simple mock for visualization:
    const barData = Object.entries(booksByMonth).map(([name, count]) => ({ name, count }));


    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Life & Growth 🌱</h2>
                <p className="text-slate-500">Overview of your personal development journey.</p>
            </header>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 w-full">
                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Current Reads</p>
                        <p className="text-2xl font-black text-slate-700">{readingBooks.length}</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
                        <Trophy size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Books Finished</p>
                        <p className="text-2xl font-black text-slate-700">{finishedBooks.length}</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
                        <Library size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Total Library</p>
                        <p className="text-2xl font-black text-slate-700">{books.length}</p>
                    </div>
                </Card>

                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Top Category</p>
                        <p className="text-lg font-black text-slate-700 truncate w-24">
                            {categoryData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}
                        </p>
                    </div>
                </Card>
            </div>

            {/* Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Category Distribution */}
                <Card className="h-80 flex flex-col">
                    <CardTitle>Reading Interests</CardTitle>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {categoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#94a3b8'} />
                                ))}
                            </Pie>
                            <RechartsTooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                        {categoryData.map(c => (
                            <div key={c.name} className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-500">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.name] || '#94a3b8' }} />
                                {c.name}
                            </div>
                        ))}
                    </div>
                </Card>

                {/* 2. Recent Finish Activity */}
                <Card className="h-80 flex flex-col">
                    <CardTitle>Books Finished (Monthly)</CardTitle>
                    {barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} />
                                <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-300 italic text-sm">
                            No books finished yet. Keep reading!
                        </div>
                    )}
                </Card>
            </div>

            {/* Recent Books List Section */}
            <div className="mt-8">
                <h3 className="text-xl font-bold text-slate-700 mb-4 flex items-center gap-2"><Book size={20} /> Currently Active</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {readingBooks.slice(0, 3).map(book => (
                        <div key={book.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-start shadow-sm">
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

        </Layout>
    );
}
