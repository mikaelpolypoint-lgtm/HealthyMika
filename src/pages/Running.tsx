import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Timer, Flame, MapPin, Pencil, Trash2, Footprints } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

interface CardioLog {
    id: string;
    equipment: 'Running';
    duration: number; // minutes
    distance: number; // km
    calories: number;
    date: Timestamp;
}

export default function Running() {
    const [logs, setLogs] = useState<CardioLog[]>([]);

    // Split duration state
    const [durationMin, setDurationMin] = useState('');
    const [durationSec, setDurationSec] = useState('');

    const [distance, setDistance] = useState('');
    const [calories, setCalories] = useState('');
    const [loading, setLoading] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<CardioLog> & { dateStr: string, durMin: string, durSec: string }>({ dateStr: '', durMin: '', durSec: '' });

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
                date: Timestamp.now()
            });
            setDurationMin('');
            setDurationSec('');
            setDistance('');
            setCalories('');
        } finally {
            setLoading(false);
        }
    };

    // Edit Handlers
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
            durSec: secs.toString()
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
                date: Timestamp.fromDate(new Date(editForm.dateStr))
            });
            setEditingId(null);
        } catch (e) {
            alert('Failed to update log');
            console.error(e);
        }
    };

    const deleteLog = async (id: string) => {
        if (confirm('Delete this session?')) {
            await deleteDoc(doc(db, 'cardio_logs', id));
        }
    };

    // Helper for calculations
    const calculateStats = (log: CardioLog | (Partial<CardioLog> & { dateStr: string })) => {
        const dist = Number(log.distance) || 0;
        const dur = Number(log.duration) || 0;

        if (dur === 0 || dist === 0) return { pace: '0:00' };

        // Pace: min/km
        const paceDec = dur / dist; // min/km (decimal)
        const paceMin = Math.floor(paceDec);
        const paceSec = Math.round((paceDec - paceMin) * 60);
        const pace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;

        return { pace };
    };

    const formatDuration = (totalMinutes: number) => {
        const mins = Math.floor(totalMinutes);
        const secs = Math.round((totalMinutes - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const chartData = logs.slice(0, 7).reverse().map(log => ({
        date: log.date.toDate().toLocaleDateString(undefined, { weekday: 'short' }),
        distance: log.distance,
        calories: log.calories
    }));

    return (
        <Layout>
            <header className="mb-6 flex items-center gap-3">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                    <Footprints size={32} />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary">Running</h2>
                    <p className="text-slate-500">Hit the road.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Entry Form */}
                <Card className="lg:col-span-1 h-fit">
                    <CardTitle>Log Run</CardTitle>
                    <form onSubmit={handleAddLog} className="space-y-6 mt-4">
                        <div className="space-y-4">
                            <div className="relative flex gap-2">
                                <div className="absolute left-3 top-3 text-slate-400 z-10"><Timer size={18} /></div>
                                <input
                                    type="number"
                                    value={durationMin}
                                    onChange={e => setDurationMin(e.target.value)}
                                    placeholder="Min"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none"
                                    inputMode="numeric"
                                />
                                <input
                                    type="number"
                                    value={durationSec}
                                    onChange={e => setDurationSec(e.target.value)}
                                    placeholder="Sec"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none"
                                    inputMode="numeric"
                                    max="59"
                                />
                            </div>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="Distance (km)" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none" inputMode="decimal" step="0.01" />
                            </div>
                            <div className="relative">
                                <Flame className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="Calories (kcal)" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none" inputMode="numeric" />
                            </div>
                        </div>

                        <button disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-orange-900/10 active:scale-95">
                            {loading ? 'Saving...' : 'Log Run'}
                        </button>
                    </form>
                </Card>

                {/* Charts & History */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardTitle>Distance & Calories</CardTitle>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="left" orientation="left" stroke="#06b6d4" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="distance" name="Dist (km)" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar yAxisId="right" dataKey="calories" name="Cals" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-700">Recent Runs</h3>
                        {logs.map(log => {
                            const isEditing = editingId === log.id;
                            const displayLog = isEditing
                                ? { ...editForm, duration: Number(editForm.durMin) + Number(editForm.durSec) / 60 }
                                : log;

                            const { pace } = calculateStats(displayLog as CardioLog);

                            if (isEditing) {
                                return (
                                    <div key={log.id} className="p-4 bg-orange-50/50 border border-orange-200 rounded-xl space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-slate-500 font-bold uppercase">Date</label>
                                                <input type="datetime-local" value={editForm.dateStr} onChange={e => setEditForm({ ...editForm, dateStr: e.target.value })} className="w-full p-2 bg-white rounded border border-orange-200 text-sm" />
                                            </div>
                                            <div />
                                            <div>
                                                <label className="text-xs text-slate-500 font-bold uppercase">Dist (km)</label>
                                                <input type="number" step="0.01" value={editForm.distance} onChange={e => setEditForm({ ...editForm, distance: Number(e.target.value) })} className="w-full p-2 bg-white rounded border border-orange-200 text-sm" />
                                            </div>
                                            <div className="flex gap-1">
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold uppercase">Min</label>
                                                    <input type="number" value={editForm.durMin} onChange={e => setEditForm({ ...editForm, durMin: e.target.value })} className="w-full p-2 bg-white rounded border border-orange-200 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold uppercase">Sec</label>
                                                    <input type="number" value={editForm.durSec} onChange={e => setEditForm({ ...editForm, durSec: e.target.value })} className="w-full p-2 bg-white rounded border border-orange-200 text-sm" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 font-bold uppercase">Cals</label>
                                                <input type="number" value={editForm.calories} onChange={e => setEditForm({ ...editForm, calories: Number(e.target.value) })} className="w-full p-2 bg-white rounded border border-orange-200 text-sm" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3 border-t border-orange-200 pt-3">
                                            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-slate-500 hover:bg-slate-100 rounded text-sm">Cancel</button>
                                            <button onClick={saveEdit} className="px-4 py-1 bg-orange-600 text-white rounded text-sm font-bold shadow-sm">Save Changes</button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={log.id} className="group flex flex-col sm:flex-row items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-orange-50 text-orange-600 border border-orange-100 shrink-0">
                                            <Footprints size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-800">Run</p>
                                            <p className="text-xs text-slate-500">{log.date.toDate().toLocaleDateString()} • {format(log.date.toDate(), 'h:mm a')}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between w-full sm:w-auto gap-8 mt-3 sm:mt-0">
                                        <div className="text-center sm:text-right">
                                            <p className="text-sm font-bold text-slate-800">{log.distance} km</p>
                                            <p className="text-xs text-slate-400">{formatDuration(log.duration)}</p>
                                        </div>
                                        <div className="text-center sm:text-right border-l border-slate-100 pl-4 sm:border-0 sm:pl-0">
                                            <p className="text-sm font-bold text-slate-800">{pace}</p>
                                            <p className="text-xs text-slate-400">min/km</p>
                                        </div>
                                        <div className="text-center sm:text-right border-l border-slate-100 pl-4 sm:border-0 sm:pl-0">
                                            <p className="text-sm font-bold text-slate-800">{log.calories}</p>
                                            <p className="text-xs text-slate-400">kcal</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity ml-auto sm:ml-0">
                                            <button onClick={() => startEditing(log)} className="p-2 text-slate-400 hover:text-brand-primary rounded-lg transition-all">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={() => deleteLog(log.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-all">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
