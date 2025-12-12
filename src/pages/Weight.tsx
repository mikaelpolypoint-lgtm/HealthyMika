import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Scale, Trash2, Pencil, X, Check } from 'lucide-react';
import { format } from 'date-fns';

interface WeightLog {
    id: string;
    weight: number;
    date: Timestamp;
}

export default function Weight() {
    const [logs, setLogs] = useState<WeightLog[]>([]);
    const [currentWeight, setCurrentWeight] = useState('');
    const [loading, setLoading] = useState(false);

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editWeight, setEditWeight] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'weight_logs'), orderBy('date', 'desc')); // Order desc for list
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as WeightLog[];
            setLogs(data);
        });
        return () => unsubscribe();
    }, []);

    const handleAddWeight = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentWeight) return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'weight_logs'), {
                weight: Number(currentWeight),
                date: Timestamp.now()
            });
            setCurrentWeight('');
        } catch (error: any) {
            console.error("Error adding document: ", error);
            alert(`Failed to save: ${error.message || error}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this entry?')) return;
        try {
            await deleteDoc(doc(db, 'weight_logs', id));
        } catch (error) {
            console.error("Error deleting document: ", error);
        }
    };

    const startEditing = (log: WeightLog) => {
        setEditingId(log.id);
        setEditWeight(log.weight.toString());
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditWeight('');
    };

    const saveEdit = async (id: string) => {
        if (!editWeight) return;
        try {
            await updateDoc(doc(db, 'weight_logs', id), {
                weight: Number(editWeight)
            });
            setEditingId(null);
            setEditWeight('');
        } catch (error) {
            console.error("Error updating document: ", error);
        }
    };

    // Group by day for chart
    const dailyData = logs.reduce((acc, log) => {
        const dateKey = format(log.date.toDate(), 'yyyy-MM-dd');
        if (!acc[dateKey]) {
            acc[dateKey] = { total: 0, count: 0, date: log.date.toDate() };
        }
        acc[dateKey].total += log.weight;
        acc[dateKey].count += 1;
        return acc;
    }, {} as Record<string, { total: number, count: number, date: Date }>);

    const chartData = Object.values(dailyData)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(day => ({
            date: format(day.date, 'MMM d'),
            weight: Number((day.total / day.count).toFixed(1))
        }));

    const latestWeight = chartData.length > 0 ? chartData[chartData.length - 1].weight : 91;
    const startWeight = 91;
    const goalWeight = 85;
    const progress = ((startWeight - latestWeight) / (startWeight - goalWeight)) * 100;

    return (
        <Layout>
            <header>
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Weight Tracker</h2>
                <p className="text-slate-500">Target: <span className="text-brand-accent font-bold">85kg</span> in 2 months</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <CardTitle>Progress Chart (Daily Average)</CardTitle>
                            <div className="flex gap-2">
                                <span className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 font-medium">Goal: 85kg</span>
                            </div>
                        </div>

                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#003A59" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#003A59" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <ReferenceLine y={85} label="Goal" stroke="#10B981" strokeDasharray="3 3" />
                                    <Area type="monotone" dataKey="weight" stroke="#003A59" strokeWidth={3} fill="url(#colorWeight)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card>
                        <CardTitle>History</CardTitle>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Time</th>
                                        <th className="px-4 py-3">Weight (kg)</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-900">
                                                {format(log.date.toDate(), 'MMM d, yyyy')}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {format(log.date.toDate(), 'h:mm a')}
                                            </td>
                                            <td className="px-4 py-3">
                                                {editingId === log.id ? (
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={editWeight}
                                                        onChange={(e) => setEditWeight(e.target.value)}
                                                        className="w-20 px-2 py-1 border border-brand-accent rounded text-slate-900"
                                                    />
                                                ) : (
                                                    <span className="font-bold text-slate-700">{log.weight}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {editingId === log.id ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => saveEdit(log.id)} className="text-emerald-600 hover:text-emerald-700"><Check size={18} /></button>
                                                        <button onClick={cancelEditing} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => startEditing(log)} className="text-slate-400 hover:text-brand-primary"><Pencil size={18} /></button>
                                                        <button onClick={() => handleDelete(log.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                                                No weight logs found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    {/* Input Card */}
                    <Card>
                        <CardTitle>Log Today</CardTitle>
                        <form onSubmit={handleAddWeight} className="space-y-4">
                            <div className="relative">
                                <Scale className="absolute left-3 top-3 text-slate-400" size={20} />
                                <input
                                    type="number"
                                    step="0.1"
                                    value={currentWeight}
                                    onChange={(e) => setCurrentWeight(e.target.value)}
                                    placeholder="Current Weight (kg)"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none transition-all placeholder:text-slate-400"
                                />
                            </div>
                            <button
                                disabled={loading}
                                className="w-full bg-brand-primary hover:bg-sky-900 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-sky-900/10 active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Log Weight'}
                            </button>
                        </form>
                    </Card>

                    {/* Stats Card */}
                    <Card className="bg-brand-primary text-white border-0">
                        <CardTitle><span className="text-white">Statistics</span></CardTitle>
                        <div className="space-y-4 mt-4">
                            <div className="flex justify-between items-center p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                                <span className="text-slate-200 text-sm">Average (Today)</span>
                                <span className="text-xl font-bold text-white">{latestWeight} kg</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                                <span className="text-slate-200 text-sm">Remaining</span>
                                <span className="text-xl font-bold text-amber-300">{(latestWeight - 85).toFixed(1)} kg</span>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-2.5 mt-2">
                                <div className="bg-emerald-400 h-2.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}></div>
                            </div>
                            <p className="text-xs text-right text-emerald-300">{progress.toFixed(0)}% to goal</p>
                        </div>
                    </Card>
                </div>
            </div>
        </Layout>
    );
}
