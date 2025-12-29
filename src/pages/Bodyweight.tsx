import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity, CheckCircle2, Pencil, Trash2, Trophy, Flame, CalendarDays, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { format, isSameDay, subDays, startOfMonth, isAfter, getDay, startOfWeek, endOfWeek, eachDayOfInterval, subMonths } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';

interface BodyweightLog {
    id: string;
    type: 'Situps' | 'Pushups' | 'Planking';
    count: number; // reps or seconds
    date: Timestamp;
}

const TARGETS = {
    Pushups: 100,
    Situps: 50,
    Planking: 120 // seconds
};

export default function Bodyweight() {
    const [logs, setLogs] = useState<BodyweightLog[]>([]);
    const [type, setType] = useState<'Situps' | 'Pushups' | 'Planking'>('Pushups');
    const [count, setCount] = useState('');
    const [loading, setLoading] = useState(false);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<BodyweightLog> & { dateStr: string }>({ dateStr: '' });

    useEffect(() => {
        const q = query(collection(db, 'bodyweight_logs'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BodyweightLog[];
            setLogs(data);
        });
        return () => unsubscribe();
    }, []);

    // --- ANALYTICS ---

    const stats = useMemo(() => {
        const now = new Date();
        const todayLogs = logs.filter(l => isSameDay(l.date.toDate(), now));

        // 1. Daily Progress
        const todayTotals = {
            Pushups: todayLogs.filter(l => l.type === 'Pushups').reduce((a, b) => a + b.count, 0),
            Situps: todayLogs.filter(l => l.type === 'Situps').reduce((a, b) => a + b.count, 0),
            Planking: todayLogs.filter(l => l.type === 'Planking').reduce((a, b) => a + b.count, 0),
        };

        // 2. Monthly Totals
        const startMonth = startOfMonth(now);
        const monthLogs = logs.filter(l => isAfter(l.date.toDate(), startMonth));
        const monthTotals = {
            Pushups: monthLogs.filter(l => l.type === 'Pushups').reduce((a, b) => a + b.count, 0),
            Situps: monthLogs.filter(l => l.type === 'Situps').reduce((a, b) => a + b.count, 0),
            Planking: monthLogs.filter(l => l.type === 'Planking').reduce((a, b) => a + b.count, 0),
        };

        // 3. PRs (High Scores) - Max reps in single set
        const prs = {
            Pushups: Math.max(0, ...logs.filter(l => l.type === 'Pushups').map(l => l.count)),
            Situps: Math.max(0, ...logs.filter(l => l.type === 'Situps').map(l => l.count)),
            Planking: Math.max(0, ...logs.filter(l => l.type === 'Planking').map(l => l.count)),
        };

        // 4. Streak
        // Get unique days with ANY activity
        const activeDays = new Set(logs.map(l => format(l.date.toDate(), 'yyyy-MM-dd')));
        let currentStreak = 0;
        let dayCheck = now;

        // Check today first, if not, check yesterday (streak doesn't break until end of today)
        if (!activeDays.has(format(dayCheck, 'yyyy-MM-dd'))) {
            // If no logs today, streak is valid if yesterday was active
            dayCheck = subDays(dayCheck, 1);
        }

        while (activeDays.has(format(dayCheck, 'yyyy-MM-dd'))) {
            currentStreak++;
            dayCheck = subDays(dayCheck, 1);
        }

        // 5. Chart Data (Last 14 days)
        const chartData = [];
        for (let i = 13; i >= 0; i--) {
            const d = subDays(now, i);
            const dKey = format(d, 'yyyy-MM-dd');
            const dayLogs = logs.filter(l => isSameDay(l.date.toDate(), d));
            chartData.push({
                date: format(d, 'd'),
                fullDate: dKey,
                Pushups: dayLogs.filter(l => l.type === 'Pushups').reduce((a, b) => a + b.count, 0),
                Situps: dayLogs.filter(l => l.type === 'Situps').reduce((a, b) => a + b.count, 0),
                Planking: dayLogs.filter(l => l.type === 'Planking').reduce((a, b) => a + b.count, 0),
            });
        }

        return { todayTotals, monthTotals, prs, currentStreak, chartData };
    }, [logs]);


    // --- HANDLERS ---
    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!count) return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'bodyweight_logs'), {
                type,
                count: Number(count),
                date: Timestamp.now()
            });
            setCount('');
        } finally {
            setLoading(false);
        }
    };

    const startEditing = (log: BodyweightLog) => {
        setEditingId(log.id);
        setEditForm({
            type: log.type,
            count: log.count,
            dateStr: format(log.date.toDate(), "yyyy-MM-dd'T'HH:mm")
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            await updateDoc(doc(db, 'bodyweight_logs', editingId), {
                type: editForm.type,
                count: Number(editForm.count),
                date: Timestamp.fromDate(new Date(editForm.dateStr))
            });
            setEditingId(null);
        } catch (e) {
            console.error(e);
            alert('Failed to update');
        }
    };

    const deleteLog = async (id: string) => {
        if (confirm('Delete this entry?')) {
            await deleteDoc(doc(db, 'bodyweight_logs', id));
        }
    };

    return (
        <Layout>
            <header className="mb-6">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Bodyweight Mastery 💪</h2>
                <p className="text-slate-500">Track reps, build streaks, break records.</p>
            </header>

            {/* TOP STATS ROW */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {/* Streak */}
                <Card className="bg-orange-50 border-orange-100 flex flex-col justify-center items-center py-4">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-full mb-2">
                        <Flame size={24} className={stats.currentStreak > 0 ? "fill-orange-600 animate-pulse" : ""} />
                    </div>
                    <span className="text-3xl font-bold text-orange-700">{stats.currentStreak} Day{stats.currentStreak !== 1 && 's'}</span>
                    <span className="text-xs font-bold text-orange-400 uppercase">Current Streak</span>
                </Card>

                {/* PRs */}
                <Card className="bg-yellow-50 border-yellow-100 flex flex-col justify-center items-center py-4 relative overflow-hidden">
                    <Trophy className="absolute -right-4 -bottom-4 text-yellow-100 rotate-12" size={96} />
                    <div className="z-10 text-center">
                        <span className="text-xs font-bold text-yellow-600 uppercase mb-2 block">All Time Best</span>
                        <div className="text-sm font-bold text-slate-700">
                            <span className="text-yellow-600">{stats.prs.Pushups}</span> Pushups
                        </div>
                        <div className="text-sm font-bold text-slate-700">
                            <span className="text-yellow-600">{stats.prs.Situps}</span> Situps
                        </div>
                        <div className="text-sm font-bold text-slate-700">
                            <span className="text-yellow-600">{stats.prs.Planking}s</span> Plank
                        </div>
                    </div>
                </Card>

                {/* Monthly Volume */}
                <Card className="bg-indigo-50 border-indigo-100 flex flex-col justify-center items-center py-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mb-2">
                        <CalendarDays size={24} />
                    </div>
                    <div className="text-center">
                        <span className="text-2xl font-bold text-indigo-700 block">{stats.monthTotals.Pushups}</span>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">Monthly Pushups</span>
                    </div>
                </Card>

                {/* Daily Target Progress */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Daily Progress</h4>
                    {Object.keys(TARGETS).map(k => {
                        const key = k as keyof typeof TARGETS;
                        const current = stats.todayTotals[key];
                        const target = TARGETS[key];
                        const pct = Math.min(100, (current / target) * 100);

                        return (
                            <div key={key} className="mb-2 last:mb-0">
                                <div className="flex justify-between text-xs font-bold text-slate-700 mb-0.5">
                                    <span>{key}</span>
                                    <span className={pct >= 100 ? "text-emerald-500" : "text-slate-400"}>{current}/{target}</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className={clsx("h-full rounded-full transition-all duration-500", pct >= 100 ? "bg-emerald-500" : "bg-brand-primary")} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* CHART & INPUT ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* CHART */}
                <Card className="lg:col-span-2 min-h-[300px] flex flex-col">
                    <CardTitle className="mb-4 flex items-center gap-2"><TrendingUp size={18} /> Volume Last 14 Days</CardTitle>
                    <div className="flex-1 w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.chartData}>
                                <defs>
                                    <linearGradient id="colorPush" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorSit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Area type="monotone" dataKey="Pushups" stroke="#4f46e5" fillOpacity={1} fill="url(#colorPush)" strokeWidth={2} />
                                <Area type="monotone" dataKey="Situps" stroke="#10b981" fillOpacity={1} fill="url(#colorSit)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* LOGGING FORM (Redesigned) */}
                <Card>
                    <CardTitle>Log Set</CardTitle>
                    <form onSubmit={handleAddLog} className="space-y-6 mt-4">
                        <div className="grid grid-cols-3 gap-2">
                            {['Pushups', 'Situps', 'Planking'].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t as any)}
                                    className={clsx(
                                        "flex flex-col items-center justify-center p-2 rounded-xl border transition-all",
                                        type === t ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm ring-1 ring-indigo-200" : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                                    )}
                                >
                                    <span className="text-xs font-bold">{t}</span>
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Activity className="absolute left-3 top-3 text-slate-400" size={20} />
                            <input
                                type="number"
                                value={count}
                                onChange={e => setCount(e.target.value)}
                                placeholder={type === 'Planking' ? "Time (seconds)" : "Reps"}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-3xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                                autoFocus
                            />
                        </div>

                        {/* Quick Add Buttons */}
                        <div className="grid grid-cols-4 gap-2">
                            {[10, 20, 25, 50].map(val => (
                                <button
                                    key={val}
                                    type="button"
                                    onClick={() => setCount(val.toString())}
                                    className="bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 font-bold py-2 rounded-lg text-xs transition-colors"
                                >
                                    {val}
                                </button>
                            ))}
                        </div>

                        <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-900/10 active:scale-[0.98]">
                            {loading ? 'Saving...' : 'Add Log'}
                        </button>
                    </form>
                </Card>
            </div>

            {/* RECENT LOGS */}
            <Card>
                <CardTitle>History</CardTitle>
                <div className="space-y-2 mt-4 max-h-[400px] overflow-y-auto">
                    {logs.map((log) => {
                        if (editingId === log.id) {
                            return (
                                <div key={log.id} className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input type="datetime-local" value={editForm.dateStr} onChange={e => setEditForm({ ...editForm, dateStr: e.target.value })} className="p-2 border rounded text-xs w-full" />
                                        <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as any })} className="p-2 border rounded text-xs w-full">
                                            {['Pushups', 'Situps', 'Planking'].map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <input type="number" value={editForm.count} onChange={e => setEditForm({ ...editForm, count: Number(e.target.value) })} className="p-2 border rounded text-xs w-full" placeholder="Count" />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setEditingId(null)} className="px-3 py-1 text-slate-500 hover:bg-slate-200 rounded text-xs font-bold">Cancel</button>
                                        <button onClick={saveEdit} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-bold">Save</button>
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={log.id} className="group flex items-center justify-between p-3 bg-white hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={clsx("w-2 h-2 rounded-full", log.type === 'Pushups' ? "bg-indigo-500" : log.type === 'Situps' ? "bg-emerald-500" : "bg-amber-500")} />
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">{log.type}</p>
                                        <p className="text-[10px] text-slate-400">{format(log.date.toDate(), 'MMM d, h:mm a')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-lg font-bold text-slate-700">{log.count} <span className="text-xs font-medium text-slate-400">{log.type === 'Planking' ? 's' : 'reps'}</span></span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditing(log)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil size={14} /></button>
                                        <button onClick={() => deleteLog(log.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {logs.length === 0 && <p className="text-slate-400 text-center py-8 italic text-sm">No activity recorded yet.</p>}
                </div>
            </Card>
        </Layout>
    );
}
