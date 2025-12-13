import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx } from 'clsx';
import { format, differenceInHours, differenceInMinutes, isSameDay } from 'date-fns';
import { Pencil, Trash2, Droplets, Timer, Plus, Minus } from 'lucide-react';

interface FoodLog {
    id: string;
    status: 'green' | 'yellow' | 'orange' | 'red';
    date: Timestamp;
}

interface WaterLog {
    id: string;
    amount: number; // in ml
    date: Timestamp;
}

interface FastingLog {
    id: string;
    startTime: Timestamp;
    endTime: Timestamp;
    date: Timestamp; // Reference date
}

const statusConfig = {
    green: { label: 'Great', color: 'bg-green-500', hover: 'hover:bg-green-600', shadow: 'shadow-green-200', text: 'text-green-700', bg: 'bg-green-50' },
    yellow: { label: 'Good', color: 'bg-yellow-500', hover: 'hover:bg-yellow-600', shadow: 'shadow-yellow-200', text: 'text-yellow-700', bg: 'bg-yellow-50' },
    orange: { label: 'Fair', color: 'bg-orange-500', hover: 'hover:bg-orange-600', shadow: 'shadow-orange-200', text: 'text-orange-700', bg: 'bg-orange-50' },
    red: { label: 'Bad', color: 'bg-red-500', hover: 'hover:bg-red-600', shadow: 'shadow-red-200', text: 'text-red-700', bg: 'bg-red-50' },
};

export default function Food() {
    // State
    const [logs, setLogs] = useState<FoodLog[]>([]);
    const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
    const [fastingLogs, setFastingLogs] = useState<FastingLog[]>([]);
    const [loading, setLoading] = useState(false);

    // Fasting Form State
    const [fastDate, setFastDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [fastStart, setFastStart] = useState('20:00');
    const [fastEnd, setFastEnd] = useState('12:00');

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ status: FoodLog['status'], dateStr: string }>({ status: 'green', dateStr: '' });

    useEffect(() => {
        // Food Logs
        const qFood = query(collection(db, 'food_logs'), orderBy('date', 'desc'));
        const unsubFood = onSnapshot(qFood, (s) => setLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as FoodLog))));

        // Water Logs
        const qWater = query(collection(db, 'water_logs'), orderBy('date', 'desc'));
        const unsubWater = onSnapshot(qWater, (s) => setWaterLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as WaterLog))));

        // Fasting Logs
        const qFasting = query(collection(db, 'fasting_logs'), orderBy('date', 'desc'));
        const unsubFasting = onSnapshot(qFasting, (s) => setFastingLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as FastingLog))));

        return () => { unsubFood(); unsubWater(); unsubFasting(); };
    }, []);

    // --- Actions ---

    const handleLog = async (status: 'green' | 'yellow' | 'orange' | 'red') => {
        setLoading(true);
        try {
            await addDoc(collection(db, 'food_logs'), { status, date: Timestamp.now() });
        } finally { setLoading(false); }
    };

    const addWater = async () => {
        try { await addDoc(collection(db, 'water_logs'), { amount: 250, date: Timestamp.now() }); } catch (e) { console.error(e); }
    };

    const removeWater = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try { await deleteDoc(doc(db, 'water_logs', id)); } catch (e) { console.error(e); }
    };

    const saveFast = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Construct timestamps
            // Start is usually on 'fastDate' (e.g. yesterday evening)
            // End is usually 'fastDate' + 1 day (e.g. today noon)
            // But user might input for "today" meaning fast started yesterday.
            // Let's simplify: User inputs "Date of Fast" which is the day the fast ENDED/Measured.

            // Actually, simplest is: select date, select start time (could be previous day), select end time.
            // Let's assume input is "Fast Date" (e.g. Today), and user enters Start (Yesterday 20:00) and End (Today 12:00).

            const baseDate = new Date(fastDate);
            const start = new Date(`${fastDate}T${fastStart}`);
            const end = new Date(`${fastDate}T${fastEnd}`);

            // If start > end, assume start was previous day
            if (start > end) {
                start.setDate(start.getDate() - 1);
            }

            await addDoc(collection(db, 'fasting_logs'), {
                startTime: Timestamp.fromDate(start),
                endTime: Timestamp.fromDate(end),
                date: Timestamp.fromDate(baseDate)
            });
        } catch (e) {
            console.error(e);
            alert("Error saving fast");
        } finally {
            setLoading(false);
        }
    };

    const deleteFast = async (id: string) => {
        if (confirm("Delete this fast?")) await deleteDoc(doc(db, 'fasting_logs', id));
    };

    // --- Computations ---

    const todayWater = useMemo(() => {
        const today = new Date();
        return waterLogs
            .filter(l => isSameDay(l.date.toDate(), today))
            .reduce((acc, l) => acc + l.amount, 0);
    }, [waterLogs]);

    const waterGoal = 2500;
    const waterPercent = Math.min(100, (todayWater / waterGoal) * 100);

    // Editing Logic
    const startEditing = (log: FoodLog) => {
        setEditingId(log.id);
        setEditForm({
            status: log.status,
            dateStr: format(log.date.toDate(), "yyyy-MM-dd'T'HH:mm")
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            await updateDoc(doc(db, 'food_logs', editingId), {
                status: editForm.status,
                date: Timestamp.fromDate(new Date(editForm.dateStr))
            });
            setEditingId(null);
        } catch (e) { console.error(e); alert('Failed to update'); }
    };

    const deleteLog = async (id: string) => {
        if (confirm('Delete this entry?')) { await deleteDoc(doc(db, 'food_logs', id)); }
    };

    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Nutrition & Fasting</h2>
                <p className="text-slate-500">Fuel your body efficiently.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Water Tracker */}
                <Card className="h-fit bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-none shadow-lg shadow-blue-200">
                    <CardTitle>
                        <div className="text-white flex items-center gap-2">
                            <Droplets className="fill-white" size={20} /> Hydration
                        </div>
                    </CardTitle>
                    <div className="flex flex-col items-center mt-6 relative">
                        {/* Circular Progress */}
                        <div className="relative w-40 h-40 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-blue-800/30" />
                                <circle cx="80" cy="80" r="70" stroke="white" strokeWidth="12" fill="transparent" strokeDasharray={440} strokeDashoffset={440 - (440 * waterPercent) / 100} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <span className="text-3xl font-bold">{todayWater}</span>
                                <span className="text-sm opacity-80">/ {waterGoal} ml</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 mt-8 w-full">
                            <button onClick={addWater} className="flex-1 bg-white text-blue-600 py-3 rounded-xl font-bold hover:bg-blue-50 transition active:scale-95 flex items-center justify-center gap-2">
                                <Plus size={18} /> Add 250ml
                            </button>
                        </div>
                        <p className="mt-4 text-xs opacity-70 text-center">Tap logs below to remove mistaken entries.</p>
                    </div>

                    {/* Mini Recent Water Logs (to delete if needed) */}
                    <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        {waterLogs.filter(l => isSameDay(l.date.toDate(), new Date())).slice(0, 5).map(l => (
                            <button key={l.id} onClick={(e) => removeWater(e, l.id)} className="w-6 h-6 rounded-full bg-blue-400/50 hover:bg-red-400 flex items-center justify-center text-[10px] transition-colors" title="Remove">
                                💧
                            </button>
                        ))}
                    </div>
                </Card>

                {/* 2. Fasting Tracker */}
                <Card className="h-fit lg:col-span-2">
                    <CardTitle>
                        <div className="flex items-center gap-2 mb-4">
                            <Timer className="text-purple-600" size={20} /> Intermittent Fasting
                        </div>
                    </CardTitle>

                    {/* Fasting Form */}
                    <form onSubmit={saveFast} className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Fast Date</label>
                                <input type="date" required value={fastDate} onChange={e => setFastDate(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white" />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Start Time</label>
                                    <input type="time" required value={fastStart} onChange={e => setFastStart(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">End Time</label>
                                    <input type="time" required value={fastEnd} onChange={e => setFastEnd(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white" />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition">
                                Log Fast
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">*If Start Time is greater than End Time (e.g. 20:00 {'>'} 12:00), it assumes Start was the previous day.</p>
                    </form>

                    {/* Fasting History */}
                    <div className="space-y-3">
                        {fastingLogs.map(log => {
                            const start = log.startTime.toDate();
                            const end = log.endTime.toDate();
                            const hours = (differenceInMinutes(end, start) / 60).toFixed(1);

                            return (
                                <div key={log.id} className="group flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-purple-200 hover:shadow-sm transition bg-white">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                            <Timer size={18} />
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-700 text-lg">{hours}h</span>
                                            <div className="text-xs text-slate-500 flex gap-2">
                                                <span>{format(start, 'MMM d, HH:mm')}</span>
                                                <span>→</span>
                                                <span>{format(end, 'HH:mm')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => deleteFast(log.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )
                        })}
                        {fastingLogs.length === 0 && <p className="text-center text-slate-400 my-4">No fasts recorded.</p>}
                    </div>
                </Card>

                {/* 3. Food Quality (Existing) */}
                <Card className="flex flex-col justify-center items-center py-8 h-fit lg:col-span-3">
                    <CardTitle>Meal Quality Tracker</CardTitle>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 w-full max-w-2xl px-4">
                        {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((status) => (
                            <button
                                key={status}
                                disabled={loading}
                                onClick={() => handleLog(status)}
                                className={clsx(
                                    "aspect-square rounded-2xl flex flex-col items-center justify-center transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50",
                                    statusConfig[status].color,
                                    statusConfig[status].hover,
                                    "shadow-lg",
                                    statusConfig[status].shadow
                                )}
                            >
                                <span className="text-xl font-bold text-white drop-shadow-md">{statusConfig[status].label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Brief Recent Food History */}
                    <div className="mt-8 w-full border-t border-slate-100 pt-6">
                        <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 text-center">Recent Meals</h4>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {logs.slice(0, 8).map(log => (
                                <div key={log.id}
                                    className={clsx("px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2",
                                        statusConfig[log.status].bg, statusConfig[log.status].text, "border-transparent"
                                    )}>
                                    <span>{format(log.date.toDate(), 'dd/MM HH:mm')}</span>
                                    <button onClick={() => deleteLog(log.id)} className="hover:text-red-600"><Trash2 size={10} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </Card>

            </div>
        </Layout>
    );
}
