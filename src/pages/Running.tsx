import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Timer, Flame, MapPin, Pencil, Trash2, Footprints, Trophy, Calendar, TrendingUp, StickyNote, Activity } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import { clsx } from 'clsx';

// --- Interfaces ---
interface CardioLog {
    id: string;
    equipment: 'Running';
    duration: number; // minutes
    distance: number; // km
    calories: number;
    date: Timestamp;
    feeling?: 'great' | 'good' | 'ok' | 'hard';
    notes?: string;
}

const FEELING_ICONS = {
    great: '🤩',
    good: '🙂',
    ok: '😐',
    hard: '😫'
};

const FEELING_LABELS = {
    great: 'Great',
    good: 'Good',
    ok: 'Okay',
    hard: 'Hard'
};

export default function Running() {
    // --- State ---
    const [logs, setLogs] = useState<CardioLog[]>([]);

    // Form State
    const [durationMin, setDurationMin] = useState('');
    const [durationSec, setDurationSec] = useState('');
    const [distance, setDistance] = useState('');
    const [calories, setCalories] = useState('');
    const [feeling, setFeeling] = useState<CardioLog['feeling']>('good');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<CardioLog> & { dateStr: string, durMin: string, durSec: string }>({
        dateStr: '', durMin: '', durSec: ''
    });

    // --- Data Fetching ---
    useEffect(() => {
        const q = query(collection(db, 'cardio_logs'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as CardioLog))
                .filter(log => log.equipment === 'Running');
            setLogs(data);
        });
        return () => unsubscribe();
    }, []);

    // --- Computed Stats ---

    // 1. Live Pace Calculator (Form)
    const livePace = useMemo(() => {
        const dist = parseFloat(distance);
        const mins = parseFloat(durationMin) || 0;
        const secs = parseFloat(durationSec) || 0;
        const totalMin = mins + (secs / 60);

        if (!dist || !totalMin) return null;

        const paceDec = totalMin / dist;
        const paceMin = Math.floor(paceDec);
        const paceSec = Math.round((paceDec - paceMin) * 60);
        return `${paceMin}:${paceSec.toString().padStart(2, '0')}/km`;
    }, [distance, durationMin, durationSec]);

    // 2. Personal Bests & Totals
    const stats = useMemo(() => {
        if (logs.length === 0) return null;

        let totalDist = 0;
        let longestRun = 0;
        let bestPace = Infinity; // Lower is better
        let totalCals = 0;

        // Weekly Progress
        const now = new Date();
        const startCurrentWeek = startOfWeek(now, { weekStartsOn: 0 }); // Sunday start
        let distThisWeek = 0;

        logs.forEach(log => {
            totalDist += log.distance;
            totalCals += log.calories;
            if (log.distance > longestRun) longestRun = log.distance;

            const pace = log.duration / log.distance;
            if (pace < bestPace && log.distance > 1) bestPace = pace; // Min 1km to count for pace PB

            // Check week (Sunday start)
            if (log.date.toDate() >= startCurrentWeek) {
                distThisWeek += log.distance;
            }
        });

        // Format Best Pace
        const bpMin = Math.floor(bestPace);
        const bpSec = Math.round((bestPace - bpMin) * 60);
        const bestPaceStr = (bestPace !== Infinity) ? `${bpMin}:${bpSec.toString().padStart(2, '0')}` : '-';

        return {
            totalDist,
            totalRuns: logs.length,
            longestRun,
            bestPaceStr,
            totalCals,
            distThisWeek
        };
    }, [logs]);

    // 3. Chart Data (Last 30 Days)
    const chartData = useMemo(() => {
        return logs.slice(0, 15).reverse().map(log => ({
            date: format(log.date.toDate(), 'MMM d'),
            distance: log.distance,
            pace: log.duration / log.distance // decimal min/km
        }));
    }, [logs]);

    // 4. Grouped Logs (By Month)
    const groupedLogs = useMemo(() => {
        const groups: Record<string, CardioLog[]> = {};
        logs.forEach(log => {
            const monthYear = format(log.date.toDate(), 'MMMM yyyy');
            if (!groups[monthYear]) groups[monthYear] = [];
            groups[monthYear].push(log);
        });
        return groups;
    }, [logs]);


    // --- Handlers ---

    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const totalDuration = Number(durationMin) + (Number(durationSec) / 60);

            await addDoc(collection(db, 'cardio_logs'), {
                equipment: 'Running',
                duration: totalDuration,
                distance: Number(distance),
                calories: Number(calories),
                date: Timestamp.now(),
                feeling,
                notes
            });
            // Reset
            setDurationMin('');
            setDurationSec('');
            setDistance('');
            setCalories('');
            setNotes('');
            setFeeling('good');
        } finally {
            setLoading(false);
        }
    };

    const startEditing = (log: CardioLog) => {
        setEditingId(log.id);
        const mins = Math.floor(log.duration);
        const secs = Math.round((log.duration - mins) * 60);

        setEditForm({
            equipment: 'Running',
            duration: log.duration,
            distance: log.distance,
            calories: log.calories,
            dateStr: format(log.date.toDate(), "yyyy-MM-dd'T'HH:mm"),
            durMin: mins.toString(),
            durSec: secs.toString(),
            feeling: log.feeling,
            notes: log.notes
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            const totalDuration = Number(editForm.durMin) + (Number(editForm.durSec) / 60);
            await updateDoc(doc(db, 'cardio_logs', editingId), {
                equipment: 'Running',
                duration: totalDuration,
                distance: Number(editForm.distance),
                calories: Number(editForm.calories),
                date: Timestamp.fromDate(new Date(editForm.dateStr)),
                feeling: editForm.feeling,
                notes: editForm.notes
            });
            setEditingId(null);
        } catch (e) {
            console.error(e);
            alert('Error updating log');
        }
    };

    const deleteLog = async (id: string) => {
        if (confirm('Delete this run forever?')) {
            await deleteDoc(doc(db, 'cardio_logs', id));
        }
    };

    const calculatePaceStr = (dur: number, dist: number) => {
        if (!dist || !dur) return '-';
        const val = dur / dist;
        const m = Math.floor(val);
        const s = Math.round((val - m) * 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Layout>
            <div className="max-w-6xl mx-auto pb-20">

                {/* --- Header Section --- */}
                <header className="mb-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-4 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl shadow-lg shadow-orange-200 text-white">
                            <Footprints size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-4xl font-bold text-slate-800">Running</h2>
                            <p className="text-slate-500 font-medium">Track your miles, pace, and progress.</p>
                        </div>
                        {stats && (
                            <div className="ml-auto bg-slate-100 rounded-xl p-2 px-4 hidden md:block">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Weekly Goal</span>
                                <div className="flex items-end gap-2">
                                    <span className={clsx("text-xl font-bold", stats.distThisWeek >= 3.5 ? "text-emerald-500" : "text-slate-700")}>{stats.distThisWeek.toFixed(1)}</span>
                                    <span className="text-slate-400 text-sm font-bold mb-1">/ 3.5 km</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats Grid */}
                    {stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-in slide-in-from-top-4">
                            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-none text-white">
                                <div className="flex items-center gap-3 mb-2 opacity-80">
                                    <TrendingUp size={18} className="text-emerald-400" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Total Dist</span>
                                </div>
                                <div className="text-3xl font-bold">{stats.totalDist.toFixed(1)} <span className="text-lg font-medium text-slate-500">km</span></div>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-2 text-slate-500">
                                    <Trophy size={18} className="text-amber-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Fastest Pace</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-700">{stats.bestPaceStr} <span className="text-lg font-medium text-slate-400">/km</span></div>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-2 text-slate-500">
                                    <MapPin size={18} className="text-blue-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Longest Run</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-700">{stats.longestRun.toFixed(2)} <span className="text-lg font-medium text-slate-400">km</span></div>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-2 text-slate-500">
                                    <Flame size={18} className="text-orange-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Total Burn</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-700">{(stats.totalCals / 1000).toFixed(1)}k <span className="text-lg font-medium text-slate-400">kcal</span></div>
                            </Card>
                        </div>
                    )}
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* --- Left Col: Form --- */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="border-t-4 border-t-orange-500 sticky top-4">
                            <CardTitle className="mb-6">Log Run</CardTitle>
                            <form onSubmit={handleAddLog} className="space-y-5">
                                {/* Duration */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Duration</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                value={durationMin}
                                                onChange={e => setDurationMin(e.target.value)}
                                                placeholder="00"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-center font-bold text-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                                inputMode="numeric"
                                            />
                                            <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-bold">MIN</span>
                                        </div>
                                        <span className="text-2xl text-slate-300 font-light flex items-center">:</span>
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                value={durationSec}
                                                onChange={e => setDurationSec(e.target.value)}
                                                placeholder="00"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-center font-bold text-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                                inputMode="numeric"
                                                max="59"
                                            />
                                            <span className="absolute right-3 top-3.5 text-xs text-slate-400 font-bold">SEC</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Distance & Pace */}
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Distance</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={distance}
                                            onChange={e => setDistance(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-12 text-slate-800 font-bold text-lg focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                                            inputMode="decimal"
                                            step="0.01"
                                        />
                                        <span className="absolute right-4 top-4 text-sm font-bold text-slate-400">KM</span>
                                    </div>
                                    {/* Live Pace Indicator */}
                                    <div className={clsx("mt-2 flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all",
                                        livePace ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"
                                    )}>
                                        <span className="font-bold uppercase text-xs opacity-70">Calculated Pace</span>
                                        <span className="font-mono font-bold">{livePace || "--:-- /km"}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Calories</label>
                                        <input
                                            type="number"
                                            value={calories}
                                            onChange={e => setCalories(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                                            inputMode="numeric"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Feeling</label>
                                        <div className="flex justify-between bg-slate-50 rounded-xl p-2 border border-slate-100">
                                            {(['great', 'good', 'ok', 'hard'] as const).map(f => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setFeeling(f)}
                                                    className={clsx("w-8 h-8 flex items-center justify-center rounded-lg transition-all text-lg",
                                                        feeling === f ? "bg-white shadow-sm scale-110" : "opacity-40 hover:opacity-100"
                                                    )}
                                                    title={FEELING_LABELS[f]}
                                                >
                                                    {FEELING_ICONS[f]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="How did it go? Weather, shoes, terrain..."
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 min-h-[80px] text-sm text-slate-700 focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                                    />
                                </div>

                                <button disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
                                    <Footprints size={20} />
                                    {loading ? 'Saving...' : 'Log Run'}
                                </button>
                            </form>
                        </Card>
                    </div>

                    {/* --- Right Col: Charts & History --- */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Enhanced Chart */}
                        <Card>
                            <div className="flex justify-between items-center mb-6">
                                <CardTitle>Performance Trends</CardTitle>
                                <div className="flex gap-2 text-xs font-bold text-slate-400 uppercase bg-slate-100 p-1 rounded-lg">
                                    <span className="bg-white px-2 py-1 rounded shadow-sm text-slate-700">Last 15</span>
                                </div>
                            </div>

                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} tickMargin={10} />
                                        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                                            itemStyle={{ color: '#fff' }}
                                            labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '12px' }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="distance"
                                            name="Distance (km)"
                                            stroke="#f97316"
                                            strokeWidth={3}
                                            fill="url(#colorDist)"
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Grouped History List */}
                        <div className="space-y-6">
                            {Object.entries(groupedLogs).map(([month, monthLogs]) => (
                                <div key={month} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 py-2 mb-2 flex items-center gap-2 border-b border-slate-200">
                                        <Calendar size={14} className="text-slate-400" />
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{month}</h3>
                                    </div>

                                    <div className="space-y-3">
                                        {monthLogs.map(log => {
                                            const isEditing = editingId === log.id;
                                            const pace = calculatePaceStr(log.duration, log.distance);
                                            const dateDay = format(log.date.toDate(), 'dd');
                                            const dateWeekday = format(log.date.toDate(), 'EEE');

                                            // Edit Mode
                                            if (isEditing) {
                                                return (
                                                    <Card key={log.id} className="border-orange-400 ring-4 ring-orange-50 relative z-20">
                                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                                            <input type="datetime-local" value={editForm.dateStr} onChange={e => setEditForm({ ...editForm, dateStr: e.target.value })} className="p-2 border rounded" />
                                                            <input type="number" step="0.01" value={editForm.distance} onChange={e => setEditForm({ ...editForm, distance: parseFloat(e.target.value) })} className="p-2 border rounded" />
                                                            <div className="flex gap-2">
                                                                <input type="number" value={editForm.durMin} onChange={e => setEditForm({ ...editForm, durMin: e.target.value })} className="p-2 border rounded flex-1" placeholder="Min" />
                                                                <input type="number" value={editForm.durSec} onChange={e => setEditForm({ ...editForm, durSec: e.target.value })} className="p-2 border rounded flex-1" placeholder="Sec" />
                                                            </div>
                                                            <input type="text" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="p-2 border rounded" placeholder="Notes" />
                                                        </div>
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-slate-500 font-bold text-xs">Cancel</button>
                                                            <button onClick={saveEdit} className="px-3 py-1 bg-orange-500 text-white rounded font-bold text-xs">Save</button>
                                                        </div>
                                                    </Card>
                                                )
                                            }

                                            // View Mode
                                            return (
                                                <div key={log.id} className="group bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-orange-200 transition-all flex flex-col md:flex-row gap-4 items-start md:items-center">

                                                    {/* Date Badge */}
                                                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 shrink-0">
                                                        <span className="text-[10px] font-bold uppercase">{dateWeekday}</span>
                                                        <span className="text-lg font-bold text-slate-700">{dateDay}</span>
                                                    </div>

                                                    {/* Main Info */}
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-bold text-slate-800 text-lg">{log.distance} km</h4>
                                                            {log.feeling && (
                                                                <span className="text-base" title={`Feeling: ${FEELING_LABELS[log.feeling]}`}>{FEELING_ICONS[log.feeling]}</span>
                                                            )}
                                                            {log.distance >= 10 && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold uppercase rounded-md tracking-wide">Long Run</span>}
                                                            {log.distance < 5 && pace.startsWith('4') && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold uppercase rounded-md tracking-wide">Fast</span>}
                                                        </div>

                                                        <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                                                            <div className="flex items-center gap-1">
                                                                <Timer size={12} />
                                                                {Math.floor(log.duration)}m {Math.round((log.duration % 1) * 60)}s
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Activity size={12} />
                                                                {pace} /km
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Flame size={12} />
                                                                {log.calories} kcal
                                                            </div>
                                                        </div>

                                                        {log.notes && (
                                                            <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg flex items-start gap-2">
                                                                <StickyNote size={12} className="mt-0.5 text-slate-400 shrink-0" />
                                                                {log.notes}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex md:flex-col gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity self-end md:self-center ml-auto md:ml-0">
                                                        <button
                                                            onClick={() => startEditing(log)}
                                                            className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteLog(log.id)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </div>
        </Layout>
    );
}
