import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Bike, Timer, Flame, MapPin, Pencil, Trash2, Zap, Globe, Upload, Mountain, StickyNote, Activity, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { format, startOfWeek } from 'date-fns';

// Bike Images
import imgHammer from '../assets/bikes/hammer_speed.png';
import imgUltimate from '../assets/bikes/canyon_ultimate.png';
import imgPrecede from '../assets/bikes/canyon_precede.png';
import imgTriban from '../assets/bikes/triban_gravel.png';

type EquipmentType = 'Hammer Speed Race' | 'Canyon Ultimate CF 7' | 'Canyon Precede:ON' | 'Triban RC 520';

interface CardioLog {
    id: string;
    equipment: EquipmentType | 'Running';
    duration: number; // minutes
    distance: number; // km
    calories: number;
    date: Timestamp;
    elevationGain?: number;
    elevationLoss?: number;
    feeling?: 'great' | 'good' | 'ok' | 'hard';
    notes?: string;
}

const EQUIPMENT_CONFIG: Record<EquipmentType, { image?: string; icon?: any; color: string; label: string }> = {
    'Hammer Speed Race': { image: imgHammer, color: 'bg-slate-900', label: 'Indoor Trainer' },
    'Canyon Ultimate CF 7': { image: imgUltimate, color: 'bg-white', label: 'Road Racer' },
    'Canyon Precede:ON': { image: imgPrecede, color: 'bg-yellow-400', label: 'City E-Bike' },
    'Triban RC 520': { image: imgTriban, color: 'bg-emerald-800', label: 'Gravel Bike' }
};

const FEELING_ICONS = { great: '🤩', good: '🙂', ok: '😐', hard: '😫' };
const FEELING_LABELS = { great: 'Great', good: 'Good', ok: 'Okay', hard: 'Hard' };

export default function Biking() {
    const [logs, setLogs] = useState<CardioLog[]>([]);
    const [equipment, setEquipment] = useState<EquipmentType>('Hammer Speed Race');

    // Form State
    const [durationMin, setDurationMin] = useState('');
    const [durationSec, setDurationSec] = useState('');
    const [distance, setDistance] = useState('');
    const [calories, setCalories] = useState('');
    const [elevationGain, setElevationGain] = useState('');
    const [feeling, setFeeling] = useState<CardioLog['feeling']>('good');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    // Editing & Import State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<CardioLog> & { dateStr: string, durMin: string, durSec: string }>({ dateStr: '', durMin: '', durSec: '' });
    const [importing] = useState(false);

    // Filters
    const [filterYear, setFilterYear] = useState<string>('all');
    const [filterBike, setFilterBike] = useState<string>('all');

    // Load Data
    useEffect(() => {
        const q = query(collection(db, 'cardio_logs'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as CardioLog))
                .filter(log => log.equipment !== 'Running');
            setLogs(data);
        });
        return () => unsubscribe();
    }, []);

    // Filter Logic
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const date = log.date.toDate();
            if (filterYear !== 'all' && date.getFullYear().toString() !== filterYear) return false;
            if (filterBike !== 'all' && log.equipment !== filterBike) return false;
            return true;
        });
    }, [logs, filterYear, filterBike]);

    // Live Speed Calculator
    const liveSpeed = useMemo(() => {
        const dist = parseFloat(distance);
        const mins = parseFloat(durationMin) || 0;
        const secs = parseFloat(durationSec) || 0;
        const totalMin = mins + (secs / 60);

        if (!dist || !totalMin) return null;
        return (dist / (totalMin / 60)).toFixed(1) + ' km/h';
    }, [distance, durationMin, durationSec]);

    // Stats Calculation
    const stats = useMemo(() => {
        if (logs.length === 0) return null;

        let totalDist = 0;
        let longestRide = 0;
        let maxSpeed = 0;
        let totalElev = 0;
        let totalCals = 0;

        // Progress goals
        const now = new Date();
        const startCurrentWeek = startOfWeek(now, { weekStartsOn: 0 }); // Sunday start
        let distThisWeek = 0;

        logs.forEach(log => {
            totalDist += log.distance;
            totalElev += (log.elevationGain || 0);
            totalCals += log.calories;
            if (log.distance > longestRide) longestRide = log.distance;

            const speed = log.distance / (log.duration / 60);
            if (speed > maxSpeed && log.duration > 10) maxSpeed = speed; // Filter glitches

            if (log.date.toDate() >= startCurrentWeek) {
                distThisWeek += log.distance;
            }
        });

        return {
            totalDist,
            totalRides: logs.length,
            longestRide,
            maxSpeed,
            totalElev,
            totalCals,
            distThisWeek
        };
    }, [logs]);

    // Grouped Logs for History
    const groupedLogs = useMemo(() => {
        const groups: Record<string, CardioLog[]> = {};
        filteredLogs.forEach(log => {
            const monthYear = format(log.date.toDate(), 'MMMM yyyy');
            if (!groups[monthYear]) groups[monthYear] = [];
            groups[monthYear].push(log);
        });
        return groups;
    }, [filteredLogs]);


    // Handlers
    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const totalDuration = Number(durationMin) + (Number(durationSec) / 60);
            await addDoc(collection(db, 'cardio_logs'), {
                equipment,
                duration: totalDuration,
                distance: Number(distance),
                calories: Number(calories),
                elevationGain: Number(elevationGain) || 0,
                date: Timestamp.now(),
                feeling,
                notes
            });
            // Reset
            setDurationMin(''); setDurationSec(''); setDistance(''); setCalories(''); setElevationGain(''); setNotes('');
        } finally {
            setLoading(false);
        }
    };

    const deleteLog = async (id: string) => {
        if (confirm('Delete this ride?')) await deleteDoc(doc(db, 'cardio_logs', id));
    };

    const startEditing = (log: CardioLog) => {
        setEditingId(log.id);
        const mins = Math.floor(log.duration);
        const secs = Math.round((log.duration - mins) * 60);
        setEditForm({
            equipment: log.equipment,
            duration: log.duration,
            distance: log.distance,
            calories: log.calories,
            dateStr: format(log.date.toDate(), "yyyy-MM-dd'T'HH:mm"),
            durMin: mins.toString(),
            durSec: secs.toString(),
            elevationGain: log.elevationGain,
            elevationLoss: log.elevationLoss,
            feeling: log.feeling,
            notes: log.notes
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const totalDuration = Number(editForm.durMin) + (Number(editForm.durSec) / 60);
        await updateDoc(doc(db, 'cardio_logs', editingId), {
            equipment: editForm.equipment as EquipmentType,
            duration: totalDuration,
            distance: Number(editForm.distance),
            calories: Number(editForm.calories),
            elevationGain: Number(editForm.elevationGain),
            date: Timestamp.fromDate(new Date(editForm.dateStr)),
            feeling: editForm.feeling,
            notes: editForm.notes
        });
        setEditingId(null);
    };

    // Chart Data (Last 30 Days)
    const chartData = useMemo(() => {
        return filteredLogs.slice(0, 15).reverse().map(log => ({
            date: format(log.date.toDate(), 'MMM d'),
            distance: log.distance,
            speed: log.distance / (log.duration / 60)
        }));
    }, [filteredLogs]);

    // Available Years for Filter
    const availableYears = useMemo(() => {
        const years = new Set(logs.map(l => l.date.toDate().getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [logs]);

    return (
        <Layout>
            <div className="max-w-6xl mx-auto pb-20">

                {/* Header */}
                <header className="mb-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                        <div className="p-4 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl shadow-lg shadow-cyan-200 text-white w-fit">
                            <Bike size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-4xl font-bold text-slate-800">Cycling</h2>
                            <p className="text-slate-500 font-medium">Choose your weapon. Ride further.</p>
                        </div>

                        {/* Goal Widgets */}
                        <div className="md:ml-auto flex gap-4">
                            {stats && (
                                <div className="bg-white border border-slate-200 rounded-xl p-2 px-4 shadow-sm">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Weekly Goal</span>
                                    <div className="flex items-end gap-2">
                                        <span className={clsx("text-xl font-bold", stats.distThisWeek >= 35 ? "text-emerald-500" : "text-slate-700")}>{stats.distThisWeek.toFixed(0)}</span>
                                        <span className="text-slate-400 text-sm font-bold mb-1">/ 35 km</span>
                                    </div>
                                </div>
                            )}
                            {stats && (
                                <div className="bg-white border border-slate-200 rounded-xl p-2 px-4 shadow-sm hidden md:block">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Yearly Goal</span>
                                    <div className="flex items-end gap-2">
                                        <span className={clsx("text-xl font-bold text-slate-700")}>{stats.totalDist.toFixed(0)}</span>
                                        <span className="text-slate-400 text-sm font-bold mb-1">/ 1825 km</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    {stats && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-in slide-in-from-top-4">
                            <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 border-none text-white overflow-hidden relative">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-2 opacity-80">
                                        <Globe size={18} className="text-cyan-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Total Dist</span>
                                    </div>
                                    <div className="text-3xl font-bold">{stats.totalDist.toFixed(0)} <span className="text-lg font-medium text-slate-500">km</span></div>
                                </div>
                                {/* Mini Progress Bar for 3000km goal */}
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
                                    <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, (stats.totalDist / 3000) * 100)}%` }} />
                                </div>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-2 text-slate-500">
                                    <Zap size={18} className="text-amber-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Max Speed</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-700">{stats.maxSpeed.toFixed(1)} <span className="text-lg font-medium text-slate-400">km/h</span></div>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-2 text-slate-500">
                                    <Mountain size={18} className="text-emerald-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Elevation</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-700">{(stats.totalElev / 1000).toFixed(2)} <span className="text-lg font-medium text-slate-400">km</span></div>
                            </Card>

                            <Card>
                                <div className="flex items-center gap-3 mb-2 text-slate-500">
                                    <MapPin size={18} className="text-blue-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Longest Ride</span>
                                </div>
                                <div className="text-3xl font-bold text-slate-700">{stats.longestRide.toFixed(1)} <span className="text-lg font-medium text-slate-400">km</span></div>
                            </Card>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-white border text-sm font-bold text-slate-600 rounded-lg px-3 py-2 outline-none">
                            <option value="all">All Years</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select value={filterBike} onChange={e => setFilterBike(e.target.value)} className="bg-white border text-sm font-bold text-slate-600 rounded-lg px-3 py-2 outline-none">
                            <option value="all">All Bikes</option>
                            {Object.keys(EQUIPMENT_CONFIG).map(e => <option key={e} value={e}>{EQUIPMENT_CONFIG[e as EquipmentType].label}</option>)}
                        </select>
                        <label className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded-lg cursor-pointer text-sm font-bold flex items-center gap-2 transition-colors ml-auto">
                            <Upload size={16} /> {importing ? '...' : 'Import CSV'}
                            <input type="file" accept=".csv" disabled={importing} className="hidden" />
                        </label>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* --- Left Col: Form --- */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="border-t-4 border-t-cyan-500 sticky top-4">
                            <CardTitle className="mb-6">Log Ride</CardTitle>
                            <form onSubmit={handleAddLog} className="space-y-6">

                                {/* Bike Selection Grid */}
                                <div className="grid grid-cols-2 gap-2">
                                    {(Object.keys(EQUIPMENT_CONFIG) as EquipmentType[]).map((eq) => {
                                        const config = EQUIPMENT_CONFIG[eq];
                                        const isSelected = equipment === eq;
                                        return (
                                            <button
                                                key={eq} type="button" onClick={() => setEquipment(eq)}
                                                className={clsx(
                                                    "relative rounded-xl border-2 transition-all p-2 flex flex-col items-center justify-center gap-2 aspect-square",
                                                    isSelected ? "border-cyan-500 bg-cyan-50/50" : "border-slate-100 bg-white hover:border-cyan-200"
                                                )}
                                            >
                                                {config.image ? (
                                                    <img src={config.image} className="w-full h-12 object-contain" alt={eq} />
                                                ) : <Bike className="text-slate-400" />}
                                                <span className={clsx("text-[9px] font-bold uppercase text-center leading-tight", isSelected ? "text-cyan-700" : "text-slate-400")}>{config.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Duration & Distance</label>
                                        <div className="flex gap-2 mb-2">
                                            <div className="relative flex-1">
                                                <input type="number" value={durationMin} onChange={e => setDurationMin(e.target.value)} placeholder="Min" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-center font-bold outline-none focus:ring-2 focus:ring-cyan-500" />
                                            </div>
                                            <div className="relative flex-1">
                                                <input type="number" value={durationSec} onChange={e => setDurationSec(e.target.value)} placeholder="Sec" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-center font-bold outline-none focus:ring-2 focus:ring-cyan-500" max="59" />
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pl-4 pr-12 font-bold text-lg outline-none focus:ring-2 focus:ring-cyan-500" step="0.01" />
                                            <span className="absolute right-4 top-4 text-sm font-bold text-slate-400">KM</span>
                                        </div>
                                        {/* Live Speed */}
                                        <div className={clsx("mt-2 flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all", liveSpeed ? "bg-cyan-50 text-cyan-700" : "bg-slate-50 text-slate-400")}>
                                            <span className="font-bold uppercase text-xs opacity-70">Avg Speed</span>
                                            <span className="font-mono font-bold">{liveSpeed || "--.- km/h"}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Calories</label>
                                            <input type="number" value={calories} onChange={e => setCalories(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-medium outline-none focus:ring-2 focus:ring-cyan-500" placeholder="kcal" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Elevation (m)</label>
                                            <input type="number" value={elevationGain} onChange={e => setElevationGain(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-medium outline-none focus:ring-2 focus:ring-cyan-500" placeholder="m" />
                                        </div>
                                    </div>

                                    {/* Feeling */}
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Feeling</label>
                                        <div className="flex justify-between bg-slate-50 rounded-xl p-2 border border-slate-100">
                                            {(['great', 'good', 'ok', 'hard'] as const).map(f => (
                                                <button key={f} type="button" onClick={() => setFeeling(f)} className={clsx("w-8 h-8 flex items-center justify-center rounded-lg transition-all text-lg", feeling === f ? "bg-white shadow-sm scale-110" : "opacity-40 hover:opacity-100")} title={FEELING_LABELS[f]}>
                                                    {FEELING_ICONS[f]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ride notes..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm min-h-[80px] outline-none focus:ring-2 focus:ring-cyan-500 resize-none" />
                                </div>

                                <button disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
                                    <Bike size={20} /> {loading ? 'Saving...' : 'Log Ride'}
                                </button>
                            </form>
                        </Card>
                    </div>

                    {/* --- Right Col: History --- */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Charts */}
                        <Card>
                            <div className="flex justify-between items-center mb-6">
                                <CardTitle>Distance Trend</CardTitle>
                            </div>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                        <Area type="monotone" dataKey="distance" stroke="#06b6d4" strokeWidth={3} fill="url(#colorDist)" animationDuration={1500} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Grouped History List */}
                        <div className="space-y-8">
                            {Object.entries(groupedLogs).map(([month, monthLogs]) => (
                                <div key={month} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <div className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 py-2 mb-2 flex items-center gap-2 border-b border-slate-200">
                                        <Calendar size={14} className="text-slate-400" />
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{month}</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {monthLogs.map(log => {
                                            const isEditing = editingId === log.id;
                                            const dateDay = format(log.date.toDate(), 'dd');
                                            const speed = (log.distance / (log.duration / 60)).toFixed(1);

                                            if (isEditing) return (
                                                <Card key={log.id} className="border-cyan-400 ring-4 ring-cyan-50">
                                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                                        <input type="datetime-local" value={editForm.dateStr} onChange={e => setEditForm({ ...editForm, dateStr: e.target.value })} className="p-2 border rounded" />
                                                        <input type="number" step="0.01" value={editForm.distance} onChange={e => setEditForm({ ...editForm, distance: parseFloat(e.target.value) })} className="p-2 border rounded" />
                                                        <div className="flex gap-2"><input type="number" value={editForm.durMin} onChange={e => setEditForm({ ...editForm, durMin: e.target.value })} className="p-2 border rounded w-full" placeholder="Min" /><input type="number" value={editForm.durSec} onChange={e => setEditForm({ ...editForm, durSec: e.target.value })} className="p-2 border rounded w-full" placeholder="Sec" /></div>
                                                        <input type="number" value={editForm.elevationGain} onChange={e => setEditForm({ ...editForm, elevationGain: parseFloat(e.target.value) })} className="p-2 border rounded" placeholder="Elev" />
                                                    </div>
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => setEditingId(null)} className="px-3 py-1 text-slate-500 text-xs font-bold">Cancel</button>
                                                        <button onClick={saveEdit} className="px-3 py-1 bg-cyan-600 text-white rounded text-xs font-bold">Save</button>
                                                    </div>
                                                </Card>
                                            );

                                            return (
                                                <div key={log.id} className="group bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-4 items-start md:items-center">
                                                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-slate-50 rounded-xl border border-slate-100 text-slate-400 shrink-0">
                                                        <span className="text-[10px] font-bold uppercase">{format(log.date.toDate(), 'EEE')}</span>
                                                        <span className="text-lg font-bold text-slate-700">{dateDay}</span>
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-bold text-slate-800 text-lg">{log.distance} km</h4>
                                                            {log.equipment && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase rounded-md tracking-wide">{EQUIPMENT_CONFIG[log.equipment as EquipmentType]?.label || log.equipment}</span>}
                                                            {log.feeling && <span title={FEELING_LABELS[log.feeling]}>{FEELING_ICONS[log.feeling]}</span>}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                                                            <span className="flex items-center gap-1"><Timer size={12} /> {Math.floor(log.duration)}m</span>
                                                            <span className="flex items-center gap-1"><Activity size={12} /> {speed} km/h</span>
                                                            {log.elevationGain ? <span className="flex items-center gap-1"><Mountain size={12} /> {log.elevationGain}m</span> : null}
                                                            <span className="flex items-center gap-1"><Flame size={12} /> {log.calories}</span>
                                                        </div>
                                                        {log.notes && (
                                                            <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg flex items-start gap-2">
                                                                <StickyNote size={12} className="mt-0.5 text-slate-400 shrink-0" />
                                                                {log.notes}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex md:flex-col gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity self-end md:self-center ml-auto md:ml-0">
                                                        <button onClick={() => startEditing(log)} className="p-2 text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 rounded-lg"><Pencil size={16} /></button>
                                                        <button onClick={() => deleteLog(log.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /></button>
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
