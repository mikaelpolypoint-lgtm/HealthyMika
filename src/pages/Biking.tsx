import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Bike, Timer, Flame, MapPin, Pencil, Trash2, Trophy, Zap, Globe, Upload, Mountain } from 'lucide-react';
import { clsx } from 'clsx';
import { format, eachDayOfInterval, subDays, isSameDay } from 'date-fns';

// Bike Images
import imgHammer from '../assets/bikes/hammer_speed.png';
import imgUltimate from '../assets/bikes/canyon_ultimate.png';
import imgPrecede from '../assets/bikes/canyon_precede.png';
import imgTriban from '../assets/bikes/triban_gravel.png';

type EquipmentType = 'Hammer Speed Race' | 'Canyon Ultimate CF 7' | 'Canyon Precede:ON' | 'Triban RC 520';

interface CardioLog {
    id: string;
    equipment: EquipmentType | 'Running'; // Keeping Running for type safety
    duration: number; // minutes
    distance: number; // km
    calories: number;
    date: Timestamp;
    elevationGain?: number;
    elevationLoss?: number;
}

const EQUIPMENT_CONFIG: Record<EquipmentType, { image?: string; icon?: any; color: string; label: string }> = {
    'Hammer Speed Race': { image: imgHammer, color: 'bg-slate-900', label: 'Indoor Trainer' },
    'Canyon Ultimate CF 7': { image: imgUltimate, color: 'bg-white', label: 'Road Racer' },
    'Canyon Precede:ON': { image: imgPrecede, color: 'bg-yellow-400', label: 'City E-Bike' },
    'Triban RC 520': { image: imgTriban, color: 'bg-emerald-800', label: 'Gravel Bike' }
};

export default function Biking() {
    const [logs, setLogs] = useState<CardioLog[]>([]);
    const [equipment, setEquipment] = useState<EquipmentType>('Hammer Speed Race');

    // Split duration state
    const [durationMin, setDurationMin] = useState('');
    const [durationSec, setDurationSec] = useState('');

    const [distance, setDistance] = useState('');
    const [calories, setCalories] = useState('');
    const [loading, setLoading] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<CardioLog> & { dateStr: string, durMin: string, durSec: string }>({ dateStr: '', durMin: '', durSec: '' });
    const [importing, setImporting] = useState(false);

    // Filters
    const [filterYear, setFilterYear] = useState<string>('all');
    const [filterBike, setFilterBike] = useState<string>('all');
    const [filterMinDist, setFilterMinDist] = useState<string>('');

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

            // Year Filter
            if (filterYear !== 'all') {
                if (date.getFullYear().toString() !== filterYear) return false;
            }

            // Bike Filter
            if (filterBike !== 'all') {
                if (log.equipment !== filterBike) return false;
            }

            // Min Dist Filter
            if (filterMinDist) {
                if (log.distance < Number(filterMinDist)) return false;
            }

            return true;
        });
    }, [logs, filterYear, filterBike, filterMinDist]);

    const availableYears = useMemo(() => {
        const years = new Set(logs.map(l => l.date.toDate().getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }, [logs]);

    const parseGarminCSV = (text: string) => {
        const lines = text.split('\n');
        // Simple split for headers assumes no commas in header names
        const headers = lines[0].split(',').map(h => h.trim());

        const idxDate = headers.indexOf('Datum');
        const idxType = headers.indexOf('Aktivitätstyp');
        const idxDist = headers.indexOf('Distanz');
        const idxCal = headers.indexOf('Kalorien');
        const idxDur = headers.indexOf('Zeit');
        const idxGain = headers.indexOf('Anstieg gesamt');
        const idxLoss = headers.indexOf('Abstieg gesamt');

        const newLogs: Omit<CardioLog, 'id'>[] = [];

        // Updated CSV Line Parser
        const parseLine = (line: string) => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current);
            return result.map(cell => cell.replace(/^"|"$/g, '').trim());
        };

        // Mapping Logic
        const getEquipment = (type: string, date: Date): EquipmentType => {
            // "I got the Canyon Ultimate at the 2nd of August of 2025"
            // "Canyon Precede on October 10th of 2025"
            // "All earlier rides have been done with the Triban"

            const time = date.getTime();
            const dateUltimate = new Date('2025-08-02T00:00:00').getTime();
            const datePrecede = new Date('2025-10-10T00:00:00').getTime();

            // E-Bike is specific
            if (type === 'E-Bike-Fahren') {
                // Even if it's a couple days before the official "got it" date, it's likely the Precede
                // checking roughly Oct 2025
                return 'Canyon Precede:ON';
            }

            // Before getting the Ultimate (Aug 2, 2025), everything was Triban
            if (time < dateUltimate) {
                return 'Triban RC 520';
            }

            // After getting the Ultimate
            if (type === 'Rennradfahren') return 'Canyon Ultimate CF 7';
            if (type === 'Gravel/Offroad-Radfahren') return 'Triban RC 520';
            if (type === 'Radfahren') return 'Triban RC 520'; // Defaulting generic to Triban as requested

            return 'Canyon Ultimate CF 7'; // Fallback
        };

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const row = parseLine(line);

            // Safety check for row length? Or just rely on undefined checks
            const dateStr = row[idxDate];
            const type = row[idxType];

            if (!dateStr) continue;

            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                console.warn('Invalid date parsed:', dateStr, 'in line:', line);
                continue;
            }

            const eq = getEquipment(type, date);

            // Check duplicates
            const isDuplicate = logs.some(l =>
                Math.abs(l.date.toDate().getTime() - date.getTime()) < 1000 &&
                l.equipment === eq
            );
            if (isDuplicate) continue;

            // Duration "00:20:53" -> minutes
            const durStr = row[idxDur] || "00:00:00";
            const [h, m, s] = durStr.split(':').map(val => Number(val) || 0);
            const duration = (h * 60) + m + (s / 60);

            // Cals "1,128" -> 1128
            const calStr = (row[idxCal] || '').replace(/,/g, '');

            // Distance "8.01"
            const distStr = (row[idxDist] || '').replace(/,/g, '');

            const elevGain = (row[idxGain] || '').replace(/,/g, '');
            const elevLoss = (row[idxLoss] || '').replace(/,/g, '');

            newLogs.push({
                equipment: eq,
                date: Timestamp.fromDate(date),
                duration,
                distance: Number(distStr),
                calories: Number(calStr),
                elevationGain: Number(elevGain) || 0,
                elevationLoss: Number(elevLoss) || 0
            });
        }
        return newLogs;
    };

    const handleDeleteAll = async () => {
        if (!confirm('Are you sure you want to DELETE ALL biking logs? This cannot be undone.')) return;

        setImporting(true); // Re-use importing state for loading indicator
        try {
            const batchSize = 100;
            // Get all biking logs (equipment != Running)
            // Just use the local logs state to get IDs, safer and easier since we already fetched them
            const bikeLogs = logs;

            if (bikeLogs.length === 0) {
                alert('No logs to delete.');
                return;
            }

            // Delete in chunks to avoid overwhelming if many
            const deletePromises = bikeLogs.map(log => deleteDoc(doc(db, 'cardio_logs', log.id)));
            await Promise.all(deletePromises);

            alert(`Deleted ${bikeLogs.length} entries.`);
        } catch (err) {
            console.error(err);
            alert('Error deleting logs.');
        } finally {
            setImporting(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const text = await file.text();
            const newEntries = parseGarminCSV(text);

            if (newEntries.length === 0) {
                alert('No new entries found to import.');
                return;
            }

            if (confirm(`Found ${newEntries.length} new rides. Import them?`)) {
                // Batch add
                // Firestore batch limit is 500, we'll do promise.all for simplicity for now as list is small-ish
                await Promise.all(newEntries.map(entry => addDoc(collection(db, 'cardio_logs'), entry)));
                alert(`Successfully imported ${newEntries.length} rides!`);
            }
        } catch (err) {
            console.error(err);
            alert('Error parsing or uploading file.');
        } finally {
            setImporting(false);
            // Reset input
            e.target.value = '';
        }
    };

    // --- New Metrics Calculations ---
    const allTimeStats = useMemo(() => {
        if (logs.length === 0) return { totalDist: 0, prDistance: 0, prSpeed: 0, prCals: 0, totalElev: 0 };

        const totalDist = logs.reduce((a, b) => a + (b.distance || 0), 0);
        const totalElev = logs.reduce((a, b) => a + (b.elevationGain || 0), 0);

        // PRs
        const prDistance = Math.max(...logs.map(l => l.distance || 0));
        const prCals = Math.max(...logs.map(l => l.calories || 0));
        const prSpeed = Math.max(...logs.map(l => {
            const durLimit = l.duration > 15; // Ignore short burst glitches if any
            if (!durLimit) return 0;
            const val = (l.distance / (l.duration / 60));
            return isFinite(val) ? val : 0;
        }));

        return { totalDist, prDistance, prSpeed, prCals, totalElev };
    }, [logs]);

    // --- Heatmap Logic ---
    const heatmapData = useMemo(() => {
        const today = new Date();
        const start = subDays(today, 364); // Last 365 days
        const days = eachDayOfInterval({ start, end: today });

        return days.map(day => {
            const dayLogs = logs.filter(l => isSameDay(l.date.toDate(), day));
            return {
                date: day,
                count: dayLogs.length,
                totalDist: dayLogs.reduce((a, b) => a + b.distance, 0)
            };
        });
    }, [logs]);

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
                date: Timestamp.now(),
                elevationGain: 0, // Manual entry default
                elevationLoss: 0
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
            equipment: log.equipment,
            duration: log.duration,
            distance: log.distance,
            calories: log.calories,
            dateStr: format(log.date.toDate(), "yyyy-MM-dd'T'HH:mm"),
            durMin: mins.toString(),
            durSec: secs.toString(),
            elevationGain: log.elevationGain,
            elevationLoss: log.elevationLoss
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            const totalDuration = Number(editForm.durMin) + (Number(editForm.durSec) / 60);

            await updateDoc(doc(db, 'cardio_logs', editingId), {
                equipment: editForm.equipment as EquipmentType,
                duration: totalDuration,
                distance: Number(editForm.distance),
                calories: Number(editForm.calories),
                elevationGain: Number(editForm.elevationGain) || 0,
                elevationLoss: Number(editForm.elevationLoss) || 0,
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

        if (dur === 0 || dist === 0) return { speed: 0 };

        const speed = (dist / (dur / 60)).toFixed(1); // km/h
        return { speed };
    };

    const formatDuration = (totalMinutes: number) => {
        const mins = Math.floor(totalMinutes);
        const secs = Math.round((totalMinutes - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const chartData = filteredLogs.slice(0, 14).reverse().map(log => ({
        date: log.date.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        distance: log.distance,
        calories: log.calories
    }));

    return (
        <Layout>
            <header className="mb-6 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-2">Cycling Training</h2>
                    <p className="text-slate-500">Choose your weapon.</p>
                </div>

                <div className="flex gap-2 items-center flex-wrap justify-end">
                    {/* Filters */}
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                        <select
                            value={filterYear}
                            onChange={e => setFilterYear(e.target.value)}
                            className="text-sm bg-transparent border-none outline-none text-slate-600 font-bold px-2 py-1 cursor-pointer"
                        >
                            <option value="all">All Years</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                        <select
                            value={filterBike}
                            onChange={e => setFilterBike(e.target.value)}
                            className="text-sm bg-transparent border-none outline-none text-slate-600 font-bold px-2 py-1 cursor-pointer max-w-[150px]"
                        >
                            <option value="all">All Bikes</option>
                            {(Object.keys(EQUIPMENT_CONFIG) as EquipmentType[]).map(e => <option key={e} value={e}>{EQUIPMENT_CONFIG[e].label}</option>)}
                        </select>
                    </div>

                    <div className="flex bg-white items-center rounded-lg border border-slate-200 p-1 px-3 gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Min km</label>
                        <input
                            type="number"
                            className="w-12 text-sm bg-transparent border-none outline-none font-bold text-slate-600"
                            placeholder="0"
                            value={filterMinDist}
                            onChange={e => setFilterMinDist(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleDeleteAll}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors text-sm font-bold"
                        title="Delete All Bike Logs"
                    >
                        <Trash2 size={16} />
                    </button>

                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer transition-colors text-sm font-bold">
                        <Upload size={16} />
                        {importing ? 'Importing...' : 'Import'}
                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={importing} />
                    </label>
                </div>
            </header>

            {/* Motivation Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Ride Around The World */}
                <Card className="md:col-span-2 relative overflow-hidden bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white border-0 shadow-xl">
                    <div className="relative z-10 p-6 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Globe className="text-cyan-400" />
                                    Ride Across Europe
                                </h3>
                                <p className="text-slate-400 text-sm mt-1">Goal: 3,000 km</p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-bold text-cyan-400">{allTimeStats.totalDist.toFixed(1)} <span className="text-sm text-slate-400">km</span></p>
                                <p className="text-xs text-slate-500 mb-1">Total Distance</p>
                                <p className="text-xs font-mono text-cyan-600 flex items-center justify-end gap-1">
                                    <Mountain size={10} /> +{allTimeStats.totalElev.toLocaleString()}m
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 relative">
                            <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 relative transition-all duration-1000"
                                    style={{ width: `${Math.min(100, (allTimeStats.totalDist / 3000) * 100)}%` }}
                                >
                                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                                </div>
                            </div>
                            {/* Bike Icon moving along the bar */}
                            <div
                                className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000"
                                style={{ left: `${Math.min(100, (allTimeStats.totalDist / 3000) * 100)}%` }}
                            >
                                <div className="relative -top-8 -left-6 w-12 h-12">
                                    <img src={imgUltimate} className="w-full h-full object-contain filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] transform -rotate-12" alt="Progress Bike" />
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 mt-2 text-center w-full">{((allTimeStats.totalDist / 3000) * 100).toFixed(1)}% Completed</p>
                    </div>

                    {/* Background Decorative */}
                    <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-cyan-900/10 to-transparent pointer-events-none" />
                    <Globe className="absolute -bottom-10 -right-10 w-64 h-64 text-slate-800/20 rotate-12" />
                </Card>

                {/* PR Box */}
                <div className="bg-white rounded-2xl p-0.5 shadow-sm border border-slate-200 flex flex-col gap-px overflow-hidden">

                    <div className="p-4 bg-slate-50 flex items-center justify-between">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm"><Trophy size={16} className="text-amber-500" /> Personal Records</h3>
                    </div>

                    <div className="p-4 bg-white flex items-center justify-between group hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600"><MapPin size={18} /></div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Longest Ride</p>
                                <p className="font-bold text-slate-800">{allTimeStats.prDistance} km</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-white flex items-center justify-between group hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-rose-50 text-rose-600"><Zap size={18} /></div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Max Speed</p>
                                <p className="font-bold text-slate-800">{allTimeStats.prSpeed.toFixed(1)} km/h</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-white flex items-center justify-between group hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-50 text-orange-600"><Flame size={18} /></div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold">Max Burn</p>
                                <p className="font-bold text-slate-800">{allTimeStats.prCals} kcal</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Consistency Heatmap */}
            <Card className="mb-8 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                    <CardTitle>Consistency Heatmap (Last 365 Days)</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Less</span>
                        <div className="flex gap-1">
                            <div className="w-3 h-3 rounded bg-slate-100" />
                            <div className="w-3 h-3 rounded bg-cyan-200" />
                            <div className="w-3 h-3 rounded bg-cyan-400" />
                            <div className="w-3 h-3 rounded bg-cyan-600" />
                            <div className="w-3 h-3 rounded bg-cyan-800" />
                        </div>
                        <span>More</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1 bg-white justify-center sm:justify-start">
                    {heatmapData.map((d, i) => {
                        const intensity = d.count === 0 ? 0 : d.totalDist > 40 ? 4 : d.totalDist > 20 ? 3 : d.totalDist > 10 ? 2 : 1;
                        const colors = ['bg-slate-100', 'bg-cyan-200', 'bg-cyan-400', 'bg-cyan-600', 'bg-cyan-800'];

                        return (
                            <div
                                key={i}
                                className={clsx(
                                    "w-2.5 h-2.5 rounded-sm transition-all hover:scale-150 relative group",
                                    colors[intensity]
                                )}
                            >
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none mb-1 whitespace-nowrap z-20">
                                    {format(d.date, 'MMM d')}: {d.totalDist.toFixed(0)}km
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Entry Form & Selection */}
                <Card className="lg:col-span-1 h-fit">
                    <CardTitle>Log Ride</CardTitle>
                    <form onSubmit={handleAddLog} className="space-y-6 mt-4">

                        {/* Equipment Selection Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {(Object.keys(EQUIPMENT_CONFIG) as EquipmentType[]).map((eq) => {
                                const config = EQUIPMENT_CONFIG[eq];
                                const isSelected = equipment === eq;

                                return (
                                    <button
                                        key={eq}
                                        type="button"
                                        onClick={() => setEquipment(eq)}
                                        className={clsx(
                                            "relative rounded-2xl border-2 transition-all overflow-hidden flex flex-col items-center justify-center p-2 aspect-[4/3] group",
                                            isSelected ? "border-brand-accent bg-brand-primary/5 shadow-md scale-[1.02]" : "border-slate-100 bg-white hover:border-brand-primary/30"
                                        )}
                                    >
                                        {config.image ? (
                                            <div className="w-full h-20 mb-1 flex items-center justify-center">
                                                <img
                                                    src={config.image}
                                                    alt={eq}
                                                    className="max-h-full max-w-full object-contain filter drop-shadow-md transition-transform group-hover:scale-110"
                                                />
                                            </div>
                                        ) : (
                                            <div className={clsx("w-12 h-12 rounded-full flex items-center justify-center mb-2", config.color, "text-white")}>
                                                <config.icon size={24} />
                                            </div>
                                        )}
                                        <span className={clsx("text-[10px] font-bold uppercase text-center leading-tight", isSelected ? "text-brand-primary" : "text-slate-400")}>
                                            {config.label}
                                        </span>
                                        {isSelected && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-accent animate-pulse" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pt-4 border-t border-slate-100 space-y-4">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Selected Bike</span>
                                <span className="block text-lg font-bold text-brand-primary">{equipment}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative col-span-2 flex gap-2">
                                    <div className="absolute left-3 top-3 text-slate-400 z-10"><Timer size={18} /></div>
                                    <input
                                        type="number"
                                        value={durationMin}
                                        onChange={e => setDurationMin(e.target.value)}
                                        placeholder="Min"
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none"
                                        inputMode="numeric"
                                    />
                                    <input
                                        type="number"
                                        value={durationSec}
                                        onChange={e => setDurationSec(e.target.value)}
                                        placeholder="Sec"
                                        className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none"
                                        inputMode="numeric"
                                        max="59"
                                    />
                                </div>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="km" className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none" inputMode="decimal" step="0.01" />
                                </div>
                                <div className="relative">
                                    <Flame className="absolute left-3 top-3 text-slate-400" size={18} />
                                    <input type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="kcal" className="w-full bg-white border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none" inputMode="numeric" />
                                </div>
                            </div>
                        </div>

                        <button disabled={loading} className="w-full bg-brand-accent hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-cyan-900/10 active:scale-95">
                            {loading ? 'Saving...' : 'Log Ride'}
                        </button>
                    </form>
                </Card>

                {/* Charts & History */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardTitle>Performance History</CardTitle>
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
                        <h3 className="text-lg font-semibold text-slate-700">Recent Sessions ({filteredLogs.length})</h3>
                        {filteredLogs.map(log => {
                            const isEditing = editingId === log.id;
                            const displayLog = isEditing
                                ? { ...editForm, duration: Number(editForm.durMin) + Number(editForm.durSec) / 60 }
                                : log;

                            const { speed } = calculateStats(displayLog as CardioLog);
                            const eqConfig = EQUIPMENT_CONFIG[log.equipment as EquipmentType];

                            if (!eqConfig) return null; // Fallback


                            if (isEditing) {
                                return (
                                    <div key={log.id} className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-slate-500 font-bold uppercase">Date</label>
                                                <input type="datetime-local" value={editForm.dateStr} onChange={e => setEditForm({ ...editForm, dateStr: e.target.value })} className="w-full p-2 bg-white rounded border border-blue-200 text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 font-bold uppercase">Bike</label>
                                                <select
                                                    value={editForm.equipment}
                                                    onChange={e => setEditForm({ ...editForm, equipment: e.target.value as any })}
                                                    className="w-full p-2 bg-white rounded border border-blue-200 text-sm"
                                                >
                                                    {(Object.keys(EQUIPMENT_CONFIG) as EquipmentType[]).map(e => (
                                                        <option key={e} value={e}>{e}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 font-bold uppercase">Dist (km)</label>
                                                <input type="number" step="0.01" value={editForm.distance} onChange={e => setEditForm({ ...editForm, distance: Number(e.target.value) })} className="w-full p-2 bg-white rounded border border-blue-200 text-sm" />
                                            </div>
                                            <div className="flex gap-1">
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold uppercase">Min</label>
                                                    <input type="number" value={editForm.durMin} onChange={e => setEditForm({ ...editForm, durMin: e.target.value })} className="w-full p-2 bg-white rounded border border-blue-200 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold uppercase">Sec</label>
                                                    <input type="number" value={editForm.durSec} onChange={e => setEditForm({ ...editForm, durSec: e.target.value })} className="w-full p-2 bg-white rounded border border-blue-200 text-sm" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 font-bold uppercase">Cals</label>
                                                <input type="number" value={editForm.calories} onChange={e => setEditForm({ ...editForm, calories: Number(e.target.value) })} className="w-full p-2 bg-white rounded border border-blue-200 text-sm" />
                                            </div>
                                            <div className="flex gap-2">
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold uppercase">Up (m)</label>
                                                    <input type="number" value={editForm.elevationGain} onChange={e => setEditForm({ ...editForm, elevationGain: Number(e.target.value) })} className="w-full p-2 bg-white rounded border border-blue-200 text-sm" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 font-bold uppercase">Down</label>
                                                    <input type="number" value={editForm.elevationLoss} onChange={e => setEditForm({ ...editForm, elevationLoss: Number(e.target.value) })} className="w-full p-2 bg-white rounded border border-blue-200 text-sm" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-3 border-t border-blue-200 pt-3">
                                            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-slate-500 hover:bg-slate-100 rounded text-sm">Cancel</button>
                                            <button onClick={saveEdit} className="px-4 py-1 bg-blue-600 text-white rounded text-sm font-bold shadow-sm">Save Changes</button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={log.id} className="group flex flex-col sm:flex-row items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        {/* Avatar for Bike */}
                                        <div className={clsx("w-14 h-14 rounded-xl flex items-center justify-center p-1 bg-slate-50 border border-slate-100 shrink-0")}>
                                            {eqConfig?.image ? (
                                                <img src={eqConfig.image} alt={log.equipment} className="max-w-full max-h-full object-contain" />
                                            ) : (
                                                <Bike className="text-slate-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{log.equipment}</p>
                                            <p className="text-xs text-slate-500">{log.date.toDate().toLocaleDateString()} • {format(log.date.toDate(), 'h:mm a')}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between w-full sm:w-auto gap-4 mt-3 sm:mt-0">
                                        {log.elevationGain ? (
                                            <div className="text-center sm:text-right hidden md:block">
                                                <p className="text-sm font-bold text-slate-800 flex items-center justify-end gap-0.5"><Mountain size={12} className="text-emerald-500" /> {log.elevationGain}m</p>
                                                <p className="text-xs text-slate-400">Elevation</p>
                                            </div>
                                        ) : null}
                                        <div className="text-center sm:text-right">
                                            <p className="text-sm font-bold text-slate-800">{log.distance} km</p>
                                            <p className="text-xs text-slate-400">{formatDuration(log.duration)}</p>
                                        </div>
                                        <div className="text-center sm:text-right border-l border-slate-100 pl-4 sm:border-0 sm:pl-0">
                                            <p className="text-sm font-bold text-slate-800">{speed}</p>
                                            <p className="text-xs text-slate-400">km/h</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity ml-2">
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
