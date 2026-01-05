import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, doc, setDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx } from 'clsx';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { Wine, UtensilsCrossed, MessageSquare, Calendar as CalendarIcon, Droplets } from 'lucide-react';

// --- Types ---
interface DailyFoodLog {
    date: string; // YYYY-MM-DD
    eatWhenHungry: boolean; // Yes/No
    caloriesColor: CalorieColor;
    noAlcohol: boolean; // Yes/No
    noSodas: boolean; // Yes/No
    comment: string;
}

type CalorieColor = 'dark-red' | 'red' | 'orange' | 'yellow' | 'light-green' | 'dark-green';

const CALORIE_COLORS: { value: CalorieColor, label: string, tw: string, hex: string }[] = [
    { value: 'dark-green', label: 'Excellent', tw: 'bg-emerald-700', hex: '#047857' },
    { value: 'light-green', label: 'Good', tw: 'bg-emerald-400', hex: '#34d399' },
    { value: 'yellow', label: 'Okay', tw: 'bg-yellow-400', hex: '#facc15' },
    { value: 'orange', label: 'High', tw: 'bg-orange-400', hex: '#fb923c' },
    { value: 'red', label: 'Bad', tw: 'bg-red-500', hex: '#ef4444' },
    { value: 'dark-red', label: 'Excessive', tw: 'bg-red-900', hex: '#7f1d1d' },
];

export default function Food() {
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [logs, setLogs] = useState<Record<string, DailyFoodLog>>({});

    // Initial Form State (Default)
    const defaultLog: DailyFoodLog = {
        date: selectedDate,
        eatWhenHungry: true,
        caloriesColor: 'light-green',
        noAlcohol: true,
        noSodas: true,
        comment: ''
    };

    const currentLog = logs[selectedDate] || { ...defaultLog, date: selectedDate };

    useEffect(() => {
        // Load Logs (Last 60 days)
        const qLogs = query(collection(db, 'day_food_logs'), orderBy('date', 'desc'), limit(60));
        const unsub = onSnapshot(qLogs, (snap) => {
            const data: Record<string, DailyFoodLog> = {};
            snap.docs.forEach(d => {
                data[d.id] = d.data() as DailyFoodLog;
            });
            setLogs(data);
        });
        return () => unsub();
    }, []);

    // --- Handlers ---

    const updateLog = (updates: Partial<DailyFoodLog>) => {
        // Optimistic update logic if needed, but here we just update local form via key prop or specialized state?
        // Actually, let's just save automatically or have a save button. 
        // For smoother UX with a specific "Day View", auto-save is nice but "Comment" might need debounce.
        // Let's do simple Auto-Save for toggles, and maybe onBlur for inputs.
        // Or simpler: Just functions that save immediately to DB.

        const validDate = selectedDate; // Closure capture
        const merged = { ...currentLog, ...updates };

        // Save to DB
        setDoc(doc(db, 'day_food_logs', validDate), merged, { merge: true });
    };

    return (
        <Layout>
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-2">Nutrition Tracker 🍎</h2>
                    <p className="text-slate-500">Track habits, chemicals, and calories.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                    <CalendarIcon size={20} className="text-slate-400" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="outline-none text-slate-700 font-bold"
                    />
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* --- Left Column: Daily Input (lg:col-span-4) --- */}
                <div className="lg:col-span-5 space-y-6">

                    {/* Main Daily Form */}
                    <Card className="border-t-4 border-t-brand-primary">
                        <CardTitle className="mb-6 flex justify-between items-center">
                            <span>Analysis for {format(new Date(selectedDate), 'MMM do')}</span>
                            {/* Color Indicator Badge */}
                            <div className={clsx("w-6 h-6 rounded-full border-2 border-white shadow-sm",
                                CALORIE_COLORS.find(c => c.value === currentLog.caloriesColor)?.tw
                            )} />
                        </CardTitle>

                        <div className="space-y-6">

                            {/* 1. Calories Color */}
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Total Calories & Quality</label>
                                <div className="grid grid-cols-6 gap-2">
                                    {CALORIE_COLORS.map((c) => (
                                        <button
                                            key={c.value}
                                            onClick={() => updateLog({ caloriesColor: c.value })}
                                            className={clsx(
                                                "h-10 rounded-lg transition-all duration-200 hover:scale-105",
                                                c.tw,
                                                currentLog.caloriesColor === c.value ? "ring-2 ring-offset-2 ring-slate-400 scale-105 shadow-md" : "opacity-40 hover:opacity-100"
                                            )}
                                            title={c.label}
                                        />
                                    ))}
                                </div>
                                <p className="text-right text-xs text-slate-400 mt-1 font-bold">{CALORIE_COLORS.find(c => c.value === currentLog.caloriesColor)?.label}</p>
                            </div>

                            {/* 2. Eating Time - REMOVED */}

                            {/* 3. Toggles Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Eat When Hungry */}
                                <button
                                    onClick={() => updateLog({ eatWhenHungry: !currentLog.eatWhenHungry })}
                                    className={clsx("p-3 rounded-xl border flex flex-col items-center gap-2 transition-all",
                                        currentLog.eatWhenHungry ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200 opacity-60"
                                    )}
                                >
                                    <UtensilsCrossed size={20} className={currentLog.eatWhenHungry ? "text-emerald-600" : "text-slate-400"} />
                                    <span className={clsx("text-xs font-bold", currentLog.eatWhenHungry ? "text-emerald-700" : "text-slate-500")}>
                                        Hungry Only? {currentLog.eatWhenHungry ? "Yes" : "No"}
                                    </span>
                                </button>

                                {/* No Sodas */}
                                <button
                                    onClick={() => updateLog({ noSodas: !currentLog.noSodas })}
                                    className={clsx("p-3 rounded-xl border flex flex-col items-center gap-2 transition-all",
                                        currentLog.noSodas ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200 opacity-60"
                                    )}
                                >
                                    <Droplets size={20} className={currentLog.noSodas ? "text-blue-600" : "text-slate-400"} />
                                    <span className={clsx("text-xs font-bold", currentLog.noSodas ? "text-blue-700" : "text-slate-500")}>
                                        No Sodas? {currentLog.noSodas ? "Yes" : "No"}
                                    </span>
                                </button>

                                {/* No Alcohol */}
                                <button
                                    onClick={() => updateLog({ noAlcohol: !currentLog.noAlcohol })}
                                    className={clsx("p-3 rounded-xl border flex flex-col items-center gap-2 transition-all",
                                        currentLog.noAlcohol ? "bg-purple-50 border-purple-200" : "bg-white border-slate-200 opacity-60"
                                    )}
                                >
                                    <Wine size={20} className={currentLog.noAlcohol ? "text-purple-600" : "text-slate-400"} />
                                    <span className={clsx("text-xs font-bold", currentLog.noAlcohol ? "text-purple-700" : "text-slate-500")}>
                                        No Alcohol? {currentLog.noAlcohol ? "Yes" : "No"}
                                    </span>
                                </button>
                            </div>

                            {/* 4. Comment */}
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                                    <MessageSquare size={16} /> Comments
                                </label>
                                <textarea
                                    value={currentLog.comment}
                                    onChange={(e) => updateLog({ comment: e.target.value })}
                                    placeholder="What did you eat today? How do you feel?"
                                    className="w-full h-24 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 ring-brand-primary placeholder:text-slate-400"
                                />
                            </div>

                        </div>
                    </Card>
                </div>

                {/* --- Right Column: Visualization (lg:col-span-8) --- */}
                <div className="lg:col-span-7 space-y-6">

                    {/* 1. Monthly Overview (Heatmap-ish Grid) */}
                    <Card>
                        <CardTitle>Last 30 Days Quality</CardTitle>
                        <div className="grid grid-cols-7 sm:grid-cols-10 gap-2 mt-4">
                            {eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }).map(day => {
                                const dStr = format(day, 'yyyy-MM-dd');
                                const log = logs[dStr];
                                const color = log ? CALORIE_COLORS.find(c => c.value === log.caloriesColor) : null;

                                return (
                                    <div key={dStr} onClick={() => setSelectedDate(dStr)} className="flex flex-col items-center gap-1 group relative cursor-pointer hover:scale-110 transition-transform">
                                        <div
                                            className={clsx(
                                                "w-full aspect-square rounded-md transition-all",
                                                color ? color.tw : "bg-slate-100 border border-slate-200",
                                                selectedDate === dStr && "ring-2 ring-brand-primary ring-offset-1"
                                            )}
                                        />
                                        <span className={clsx("text-[10px] font-mono", selectedDate === dStr ? "text-brand-primary font-bold" : "text-slate-400")}>{format(day, 'd')}</span>

                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-white text-xs p-2 rounded z-10 whitespace-nowrap">
                                            {format(day, 'MMM do')}: {color?.label || 'No Data'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>

                    {/* 3. Streaks / Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {/* No Soda Streak */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                            <h4 className="text-xs font-bold text-blue-400 uppercase">Soda Free</h4>
                            <p className="text-2xl font-bold text-blue-700 mt-1">
                                {Object.values(logs).filter(l => l.noSodas).length} <span className="text-sm font-normal opacity-70">days</span>
                            </p>
                            <p className="text-[10px] text-blue-400 mt-1">Total Recorded</p>
                        </div>

                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center">
                            <h4 className="text-xs font-bold text-purple-400 uppercase">Alcohol Free</h4>
                            <p className="text-2xl font-bold text-purple-700 mt-1">
                                {Object.values(logs).filter(l => l.noAlcohol).length} <span className="text-sm font-normal opacity-70">days</span>
                            </p>
                            <p className="text-[10px] text-purple-400 mt-1">Total Recorded</p>
                        </div>

                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                            <h4 className="text-xs font-bold text-emerald-400 uppercase">Hungry Only</h4>
                            <p className="text-2xl font-bold text-emerald-700 mt-1">
                                {Object.values(logs).filter(l => l.eatWhenHungry).length} <span className="text-sm font-normal opacity-70">days</span>
                            </p>
                            <p className="text-[10px] text-emerald-400 mt-1">Total Recorded</p>
                        </div>
                    </div>
                </div>

            </div>
        </Layout >
    );
}
