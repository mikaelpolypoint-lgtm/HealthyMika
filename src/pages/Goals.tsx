import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, onSnapshot, doc, setDoc, Timestamp, addDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { format, getWeek } from 'date-fns';
import { Cross, Smartphone, Trash2, UtensilsCrossed, Wine } from 'lucide-react';
import { clsx } from 'clsx';

interface DailyGoal {
    date: string; // YYYY-MM-DD
    jesus: boolean;
    hungryOnly: boolean;
    noAlcoholSoda: boolean;
    phoneFree: boolean;
}

interface LostItem {
    id: string;
    item: string;
    date: Timestamp;
}

interface ProjectGoal {
    id: string;
    name: string;
    progress: number; // 0-100
}



export default function Goals() {
    const [dailyGoals, setDailyGoals] = useState<Record<string, DailyGoal>>({});
    const [lostItems, setLostItems] = useState<LostItem[]>([]);
    const [projects, setProjects] = useState<ProjectGoal[]>([
        { id: 'miki-life', name: 'MiKI Life', progress: 0 },
        { id: 'tudu', name: 'Tudu', progress: 0 },
        { id: 'schweizologie', name: 'Schweizologie', progress: 0 }
    ]);
    const [casFinished, setCasFinished] = useState(false);
    const [totalRunDist, setTotalRunDist] = useState(0);
    const [totalBikeDist, setTotalBikeDist] = useState(0);
    const [currentWeight, setCurrentWeight] = useState(0);
    const [weeklyRun, setWeeklyRun] = useState(0);
    const [weeklyBike, setWeeklyBike] = useState(0);

    // Targets
    const WEIGHT_TARGET = 82;
    const WEIGHT_DEADLINE = new Date('2026-03-31');
    const RUN_YEARLY_TARGET = 182.5;
    const BIKE_YEARLY_TARGET = 1825;

    // Weekly Targets (Simple average for Cardio)
    const RUN_WEEKLY_TARGET = 3.5; // ~182.5 / 52
    const BIKE_WEEKLY_TARGET = 35; // ~1825 / 52

    const [newItem, setNewItem] = useState('');
    const [loadingItem, setLoadingItem] = useState(false);

    const [weeklyStrength, setWeeklyStrength] = useState(0);
    const [consistentStrengthWeeks, setConsistentStrengthWeeks] = useState(0);

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Load Data
    useEffect(() => {
        // Load Daily Goals (Jesus, Phone)
        const unsubDaily = onSnapshot(collection(db, 'daily_goals'), (snap) => {
            const data: Record<string, DailyGoal> = {};
            snap.docs.forEach(doc => {
                data[doc.id] = doc.data() as DailyGoal;
            });
            setDailyGoals(data);
        });

        // Load Food Logs (Last 14 days to cover current week)
        const qFood = query(collection(db, 'day_food_logs'), orderBy('date', 'desc'), limit(14));
        const unsubFood = onSnapshot(qFood, (snap) => {
            const data: Record<string, any> = {};
            snap.docs.forEach(d => {
                data[d.id] = d.data();
            });
            setRecentFoodLogs(data);
        });

        // Load Lost Items
        const qItems = query(collection(db, 'lost_items'), orderBy('date', 'desc'));
        const unsubItems = onSnapshot(qItems, (snap) => {
            setLostItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LostItem)));
        });

        // Load Project Progress & CAS (Stored in 'goals_meta' collection, doc '2026')
        const unsubMeta = onSnapshot(doc(db, 'goals_meta', '2026'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.projects) setProjects(data.projects);
                if (data.casFinished !== undefined) setCasFinished(data.casFinished);
            }
        });

        // Load latest weight
        const qWeight = query(collection(db, 'weight_logs'), orderBy('date', 'desc'), limit(1));
        const unsubWeight = onSnapshot(qWeight, (snap) => {
            if (!snap.empty) {
                setCurrentWeight(snap.docs[0].data().weight);
            }
        });

        // Calculate Run/Bike totals for 2026 (Starting 28.12.2025)
        const qCardio = query(collection(db, 'cardio_logs'));
        const unsubCardio = onSnapshot(qCardio, (snap) => {
            let runTotal = 0;
            let bikeTotal = 0;
            let runWeek = 0;
            let bikeWeek = 0;

            const now = new Date();
            const currentWeek = getWeek(now, { weekStartsOn: 0 });
            const currentYear = now.getFullYear();

            // Goals Start Date: 28.12.2025
            const GOAL_START_DATE = new Date('2025-12-28');
            GOAL_START_DATE.setHours(0, 0, 0, 0);

            snap.docs.forEach(d => {
                const data = d.data();
                const date = d.data().date.toDate();

                // Yearly Goals (2026 + Early Start)
                // Include data from 2025-12-28 onwards
                if (date >= GOAL_START_DATE) {
                    if (data.equipment === 'Running') runTotal += data.distance || 0;
                    else bikeTotal += data.distance || 0;
                }

                if (getWeek(date, { weekStartsOn: 0 }) === currentWeek && date.getFullYear() === currentYear) {
                    if (data.equipment === 'Running') runWeek += data.distance || 0;
                    else bikeWeek += data.distance || 0;
                }
            });
            setTotalRunDist(runTotal);
            setTotalBikeDist(bikeTotal);

            setWeeklyRun(runWeek);
            setWeeklyBike(bikeWeek);
        });

        return () => { unsubDaily(); unsubFood(); unsubItems(); unsubMeta(); unsubCardio(); unsubWeight(); };
    }, []);

    // Calculate Strength Consistency (Separate Effect)
    useEffect(() => {
        const q = query(collection(db, 'training_plan'));
        const unsub = onSnapshot(q, (snap) => {
            const completedByWeek: Record<string, number> = {};
            let thisWeekCount = 0;

            const now = new Date();
            const currentWeek = getWeek(now, { weekStartsOn: 0 }); // Use date-fns getWeek
            const currentYear = now.getFullYear();

            snap.docs.forEach(d => {
                const data = d.data();
                if (data.completed) {
                    // Group by Year-Week key to be safe across years
                    const key = `${data.week}`; // Plan uses explicit 'week' number (1-52)
                    completedByWeek[key] = (completedByWeek[key] || 0) + 1;

                    // Check if this specific plan item matches "current week"
                    if (data.date) {
                        const date = data.date.toDate();
                        if (getWeek(date, { weekStartsOn: 0 }) === currentWeek && date.getFullYear() === currentYear) {
                            thisWeekCount++;
                        }
                    }
                }
            });

            // Count consistent weeks (>= 2 workouts)
            const goodWeeks = Object.values(completedByWeek).filter(count => count >= 2).length;

            setConsistentStrengthWeeks(goodWeeks);
            setWeeklyStrength(thisWeekCount);
        });
        return () => unsub();
    }, []);

    const [recentFoodLogs, setRecentFoodLogs] = useState<Record<string, any>>({});
    const todayFood = recentFoodLogs[todayStr] || null;

    const [ntProgress, setNtProgress] = useState(0);

    // Load NT Progress (Fellowship Logs)
    useEffect(() => {
        const q = query(collection(db, 'fellowship_logs'));
        const unsub = onSnapshot(q, (snap) => {
            const uniqueChapters = new Set<string>();
            const START_DATE = '2025-12-28';

            snap.docs.forEach(d => {
                if (d.id >= START_DATE) {
                    const data = d.data();
                    if (data.chaptersRead && Array.isArray(data.chaptersRead)) {
                        data.chaptersRead.forEach((ch: string) => uniqueChapters.add(ch));
                    }
                }
            });
            setNtProgress(uniqueChapters.size);
        });
        return () => unsub();
    }, []);

    // Calculate Weekly Stats for Habits
    const currentWeekStats = (() => {
        const now = new Date();
        const currentWeek = getWeek(now, { weekStartsOn: 0 });
        const currentYear = now.getFullYear();

        // Helper to check if string date is in current week
        const isInCurrentWeek = (dateStr: string) => {
            const d = new Date(dateStr);
            return getWeek(d, { weekStartsOn: 0 }) === currentWeek && d.getFullYear() === currentYear;
        };

        const jesusCount = Object.values(dailyGoals).filter(g => isInCurrentWeek(g.date) && g.jesus).length;
        const hungryCount = Object.values(recentFoodLogs).filter(l => isInCurrentWeek(l.date) && l.eatWhenHungry).length;
        const cleanCount = Object.values(recentFoodLogs).filter(l => isInCurrentWeek(l.date) && l.noAlcohol && l.noSodas).length;
        const phoneFreeCount = Object.values(dailyGoals).filter(g => isInCurrentWeek(g.date) && g.phoneFree).length;


        return { jesusCount, hungryCount, cleanCount, phoneFreeCount };
    })();

    const [books, setBooks] = useState<{ id: string, title: string, progress: number }[]>([]);
    const [newBook, setNewBook] = useState('');

    useEffect(() => {
        const qBooks = query(collection(db, 'books'), orderBy('startedAt', 'desc'));
        const unsubBooks = onSnapshot(qBooks, (snap) => {
            setBooks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
        });
        return () => unsubBooks();
    }, []);

    // Book Handlers
    const addBook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBook) return;
        await addDoc(collection(db, 'books'), {
            title: newBook,
            progress: 0,
            startedAt: Timestamp.now()
        });
        setNewBook('');
    };

    const updateBookProgress = async (id: string, progress: number) => {
        setBooks(prev => prev.map(b => b.id === id ? { ...b, progress } : b));
        await setDoc(doc(db, 'books', id), { progress }, { merge: true });
    };

    const deleteBook = async (id: string) => {
        if (confirm('Remove this book?')) await deleteDoc(doc(db, 'books', id));
    };

    // Daily Goal Handlers
    const toggleDaily = async (field: keyof DailyGoal) => {
        if (field === 'jesus' || field === 'phoneFree') {
            const currentRef = doc(db, 'daily_goals', todayStr);
            const current = dailyGoals[todayStr] || { date: todayStr, jesus: false, phoneFree: false };
            const updated = { ...current, [field]: !current[field] };
            // Optimistic
            setDailyGoals(prev => ({ ...prev, [todayStr]: updated }));
            await setDoc(currentRef, updated, { merge: true });
        } else {
            // Food Logs fields
            const currentRef = doc(db, 'day_food_logs', todayStr);
            // Default assumes true if creating fresh? Or copy from Food Page logic.
            const safeFood = todayFood || { date: todayStr, eatWhenHungry: true, noAlcohol: true, noSodas: true };

            let updates = {};
            let optimistic = { ...safeFood };

            if (field === 'hungryOnly') {
                const newVal = !safeFood.eatWhenHungry;
                updates = { eatWhenHungry: newVal };
                optimistic.eatWhenHungry = newVal;
            } else if (field === 'noAlcoholSoda') {
                const areBothTrue = safeFood.noAlcohol && safeFood.noSodas;
                const newVal = !areBothTrue;
                updates = { noAlcohol: newVal, noSodas: newVal };
                optimistic.noAlcohol = newVal;
                optimistic.noSodas = newVal;
            }

            setRecentFoodLogs(prev => ({ ...prev, [todayStr]: optimistic }));
            await setDoc(currentRef, { ...updates, date: todayStr }, { merge: true });
        }
    };

    // Item Handler
    const addLostItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem) return;
        setLoadingItem(true);
        try {
            await addDoc(collection(db, 'lost_items'), {
                item: newItem,
                date: Timestamp.now()
            });
            setNewItem('');
        } catch (e) { console.error(e); }
        setLoadingItem(false);
    };

    const deleteItem = async (id: string) => deleteDoc(doc(db, 'lost_items', id));

    // Project Handler
    const updateProject = async (idx: number, val: number) => {
        const newProjects = [...projects];
        newProjects[idx].progress = val;
        setProjects(newProjects);
        await setDoc(doc(db, 'goals_meta', '2026'), { projects: newProjects }, { merge: true });
    };

    const toggleCas = async () => {
        const newVal = !casFinished;
        setCasFinished(newVal);
        await setDoc(doc(db, 'goals_meta', '2026'), { casFinished: newVal }, { merge: true });
    };

    // Derived Stats
    const runPercent = Math.min(100, (totalRunDist / RUN_YEARLY_TARGET) * 100);
    const bikePercent = Math.min(100, (totalBikeDist / BIKE_YEARLY_TARGET) * 100);

    const lostItemsTarget = 52; // 1 per week
    const lostItemsCount = lostItems.length;

    // Weight Calculation
    const weightLossNeeded = Math.max(0, currentWeight - WEIGHT_TARGET);
    const weeksUntilMarch = Math.max(1, Math.ceil((WEIGHT_DEADLINE.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 7)));
    const weightWeeklyRate = weightLossNeeded / weeksUntilMarch;

    // Helper for Progress Bar Color
    const getProgressColor = (current: number, target: number) => {
        if (current >= target) return 'bg-emerald-500';
        if (current >= target * 0.8) return 'bg-amber-500';
        return 'bg-rose-500';
    };



    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">2026 Goals 🎯</h2>
                <p className="text-slate-500">Focus on the journey.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. Weight Goal */}
                <Card className="relative overflow-hidden border-l-4 border-l-rose-500">
                    <CardTitle>Weight Loss</CardTitle>
                    <p className="text-sm text-slate-500 mb-4">Target: {WEIGHT_TARGET}kg by March 31</p>

                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <span className="text-4xl font-bold text-slate-800">{currentWeight}</span>
                            <span className="text-slate-400 font-bold ml-1">kg</span>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-500 uppercase">To Go</p>
                            <p className="text-xl font-bold text-rose-600">-{weightLossNeeded.toFixed(1)} kg</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mt-2">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-slate-500 uppercase">Weekly Pace Needed</span>
                            <span className="text-lg font-bold text-rose-600">-{weightWeeklyRate.toFixed(2)} kg/week</span>
                        </div>
                        <p className="text-[10px] text-slate-400 text-right">{weeksUntilMarch} weeks remaining</p>
                    </div>
                </Card>

                {/* 2. Running Goal */}
                <Card className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 rounded-bl-full -mr-8 -mt-8 z-0" />
                    <div className="relative z-10">
                        <CardTitle>Running</CardTitle>
                        <p className="text-sm text-slate-500 mb-4">Target: {RUN_YEARLY_TARGET} km</p>

                        {/* Weekly Breakdown */}
                        <div className="mb-4 bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-slate-100">
                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-1">
                                <span>This Week</span>
                                <span>Target: {RUN_WEEKLY_TARGET} km</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div className={clsx("h-2 rounded-full transition-all", getProgressColor(weeklyRun, RUN_WEEKLY_TARGET))} style={{ width: `${Math.min(100, (weeklyRun / RUN_WEEKLY_TARGET) * 100)}%` }} />
                                </div>
                                <span className="text-xs font-bold w-12 text-right">{weeklyRun.toFixed(1)}</span>
                            </div>
                        </div>

                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-3xl font-bold text-cyan-600">{totalRunDist.toFixed(1)}</span>
                            <span className="text-slate-400 mb-1 font-bold text-sm">/ {RUN_YEARLY_TARGET} km (Year)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-cyan-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${runPercent}%` }} />
                        </div>
                    </div>
                </Card>

                {/* 3. Biking Goal */}
                <Card className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 z-0" />
                    <div className="relative z-10">
                        <CardTitle>Cycling</CardTitle>
                        <p className="text-sm text-slate-500 mb-4">Target: {BIKE_YEARLY_TARGET} km</p>

                        {/* Weekly Breakdown */}
                        <div className="mb-4 bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-slate-100">
                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-1">
                                <span>This Week</span>
                                <span>Target: {BIKE_WEEKLY_TARGET} km</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div className={clsx("h-2 rounded-full transition-all", getProgressColor(weeklyBike, BIKE_WEEKLY_TARGET))} style={{ width: `${Math.min(100, (weeklyBike / BIKE_WEEKLY_TARGET) * 100)}%` }} />
                                </div>
                                <span className="text-xs font-bold w-12 text-right">{weeklyBike.toFixed(0)}</span>
                            </div>
                        </div>

                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-3xl font-bold text-indigo-600">{totalBikeDist.toFixed(0)}</span>
                            <span className="text-slate-400 mb-1 font-bold text-sm">/ {BIKE_YEARLY_TARGET} km (Year)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${bikePercent}%` }} />
                        </div>
                    </div>
                </Card>

                {/* 3. Daily Habits */}
                <Card className="md:col-span-2 lg:col-span-1 bg-gradient-to-br from-white to-slate-50">
                    <CardTitle>Weekly Habit Goals</CardTitle>
                    <div className="space-y-3 mt-4">

                        <button
                            onClick={() => toggleDaily('jesus')}
                            className={clsx("w-full p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition-all group hover:scale-[1.02]",
                                dailyGoals[todayStr]?.jesus ? "border-amber-400 bg-amber-50" : "border-slate-100 bg-white hover:border-amber-200"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                                    dailyGoals[todayStr]?.jesus ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-400"
                                )}>
                                    <Cross size={18} />
                                </div>
                                <div className="text-left">
                                    <span className="block font-bold text-slate-700 text-sm">Start with Jesus</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Goal: 6/week</span>
                                </div>
                            </div>

                            <div className="flex flex-col items-end">
                                <span className={clsx("text-lg font-bold", currentWeekStats.jesusCount >= 6 ? "text-emerald-500" : "text-slate-400")}>
                                    {currentWeekStats.jesusCount}<span className="text-xs text-slate-300">/6</span>
                                </span>
                            </div>
                        </button>

                        <button
                            onClick={() => toggleDaily('hungryOnly')}
                            className={clsx("w-full p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition-all group hover:scale-[1.02]",
                                todayFood?.eatWhenHungry ? "border-emerald-400 bg-emerald-50" : "border-slate-100 bg-white hover:border-emerald-200"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                                    todayFood?.eatWhenHungry ? "bg-emerald-400 text-white" : "bg-slate-100 text-slate-400"
                                )}>
                                    <UtensilsCrossed size={18} />
                                </div>
                                <div className="text-left">
                                    <span className="block font-bold text-slate-700 text-sm">Eat only when hungry</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Goal: 5/week</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={clsx("text-lg font-bold", currentWeekStats.hungryCount >= 5 ? "text-emerald-500" : "text-slate-400")}>
                                    {currentWeekStats.hungryCount}<span className="text-xs text-slate-300">/5</span>
                                </span>
                            </div>
                        </button>

                        <button
                            onClick={() => toggleDaily('noAlcoholSoda')}
                            className={clsx("w-full p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition-all group hover:scale-[1.02]",
                                (todayFood?.noAlcohol && todayFood?.noSodas) ? "border-blue-400 bg-blue-50" : "border-slate-100 bg-white hover:border-blue-200"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                                    (todayFood?.noAlcohol && todayFood?.noSodas) ? "bg-blue-400 text-white" : "bg-slate-100 text-slate-400"
                                )}>
                                    <Wine size={18} className="line-through" />
                                </div>
                                <div className="text-left">
                                    <span className="block font-bold text-slate-700 text-sm">No Alcohol / Soda</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Goal: 4/week</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={clsx("text-lg font-bold", currentWeekStats.cleanCount >= 4 ? "text-emerald-500" : "text-slate-400")}>
                                    {currentWeekStats.cleanCount}<span className="text-xs text-slate-300">/4</span>
                                </span>
                            </div>
                        </button>

                        <button
                            onClick={() => toggleDaily('phoneFree')}
                            className={clsx("w-full p-2.5 rounded-xl border-2 flex items-center justify-between gap-2 transition-all group hover:scale-[1.02]",
                                dailyGoals[todayStr]?.phoneFree ? "border-purple-400 bg-purple-50" : "border-slate-100 bg-white hover:border-purple-200"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={clsx("w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                                    dailyGoals[todayStr]?.phoneFree ? "bg-purple-400 text-white" : "bg-slate-100 text-slate-400"
                                )}>
                                    <Smartphone size={18} className="line-through" />
                                </div>
                                <div className="text-left">
                                    <span className="block font-bold text-slate-700 text-sm">Phone-free Evening</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Goal: 2/week</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={clsx("text-lg font-bold", currentWeekStats.phoneFreeCount >= 2 ? "text-emerald-500" : "text-slate-400")}>
                                    {currentWeekStats.phoneFreeCount}<span className="text-xs text-slate-300">/2</span>
                                </span>
                            </div>
                        </button>

                    </div>
                </Card>

                {/* 4. Lose Items */}
                <Card className="h-fit">
                    <CardTitle>Decluttering</CardTitle>
                    <p className="text-sm text-slate-500 mb-4">Lose 1 item per week (Target: 52)</p>

                    <form onSubmit={addLostItem} className="flex gap-2 mb-4">
                        <input
                            value={newItem}
                            onChange={e => setNewItem(e.target.value)}
                            placeholder="What did you get rid of?"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-brand-primary"
                        />
                        <button disabled={loadingItem} className="bg-brand-primary text-white px-4 rounded-lg font-bold text-sm">+</button>
                    </form>

                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {lostItems.map(item => (
                            <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100 group">
                                <span className="text-sm font-medium text-slate-700">{item.item}</span>
                                <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs font-bold text-right mt-2 text-brand-primary">{lostItemsCount} / {lostItemsTarget} items</p>
                </Card>

                {/* 5. Projects */}
                <Card>
                    <CardTitle>Projects & Learning</CardTitle>
                    <div className="space-y-6 mt-4">
                        {projects.map((p, idx) => (
                            <div key={p.id}>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-bold text-slate-700">{p.name}</span>
                                    <span className="text-xs font-bold text-slate-500">{p.progress}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="100"
                                    value={p.progress}
                                    onChange={e => updateProject(idx, Number(e.target.value))}
                                    className="w-full accent-brand-primary cursor-pointer"
                                />
                            </div>
                        ))}

                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-slate-700">CAS Finished?</span>
                                <button
                                    onClick={toggleCas}
                                    className={clsx("px-3 py-1 rounded-full text-xs font-bold transition-colors",
                                        casFinished ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                    )}
                                >
                                    {casFinished ? "YES! 🎉" : "Not yet"}
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 6. NT Reading Goal */}
                <Card className="h-fit relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-8 -mt-8 z-0" />
                    <div className="relative z-10">
                        <CardTitle>Read New Testament ✝️</CardTitle>
                        <p className="text-sm text-slate-500 mb-4">Goal: 260 Chapters</p>

                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-4xl font-bold text-amber-600">{ntProgress}</span>
                            <span className="text-slate-400 mb-1 font-bold text-sm">/ 260</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3">
                            <div className="bg-amber-500 h-3 rounded-full transition-all duration-1000 relative" style={{ width: `${Math.min(100, (ntProgress / 260) * 100)}%` }}>
                                <div className="absolute top-0 right-0 bottom-0 w-1 bg-white/20 rounded-r-full" />
                            </div>
                        </div>
                        <p className="text-xs text-right text-slate-400 mt-2 font-medium">Auto-tracked from Fellowship</p>
                    </div>
                </Card>

                {/* 4. Reading Challenge (New) */}
                <Card className="md:row-span-2 h-fit">
                    <CardTitle>Reading Challenge 📚</CardTitle>
                    <p className="text-sm text-slate-500 mb-4">Goal: 12 books in 2026</p>

                    {/* ... existing reading challenge code ... */}

                    {/* Progress Circle or Bar */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                            <div className="absolute top-0 left-0 bottom-0 bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(100, (books.filter(b => b.progress === 100).length / 12) * 100)}%` }}></div>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-bold text-blue-600">{books.filter(b => b.progress === 100).length}</span>
                            <span className="text-slate-400 font-bold ml-1">/ 12</span>
                        </div>
                    </div>

                    <form onSubmit={addBook} className="flex gap-2 mb-6">
                        <input
                            value={newBook}
                            onChange={e => setNewBook(e.target.value)}
                            placeholder="Start a new book..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-brand-primary"
                        />
                        <button className="bg-brand-primary text-white px-4 rounded-lg font-bold text-sm">+</button>
                    </form>

                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Currently Reading</h4>
                        {books.filter(b => b.progress < 100).length === 0 && <p className="text-sm text-slate-400 italic">No active books.</p>}
                        {books.filter(b => b.progress < 100).map(book => (
                            <div key={book.id} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm group hover:border-blue-100 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-slate-800">{book.title}</span>
                                    <button onClick={() => deleteBook(book.id)} className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="range"
                                        min="0" max="100"
                                        value={book.progress}
                                        onChange={(e) => updateBookProgress(book.id, Number(e.target.value))}
                                        className="flex-1 accent-blue-500 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-blue-600 w-8 text-right">{book.progress}%</span>
                                </div>
                            </div>
                        ))}

                        {books.filter(b => b.progress === 100).length > 0 && (
                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Finished Books ({books.filter(b => b.progress === 100).length})</h4>
                                <ul className="space-y-1">
                                    {books.filter(b => b.progress === 100).map(book => (
                                        <li key={book.id} className="text-sm text-slate-600 flex items-center gap-2">
                                            <span className="text-emerald-500">✓</span>
                                            <span className="line-through opacity-70">{book.title}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </Card>

                {/* 7. Strength Training Goal (New) */}
                <Card className="relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-full -mr-8 -mt-8 z-0" />
                    <div className="relative z-10">
                        <CardTitle>Strength Training 💪</CardTitle>
                        <p className="text-sm text-slate-500 mb-4">Target: 2 workouts/week (Consistency)</p>

                        {/* Weekly Breakdown */}
                        <div className="mb-4 bg-white/50 backdrop-blur-sm rounded-lg p-2 border border-slate-100">
                            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase mb-1">
                                <span>This Week</span>
                                <span>Target: 2 Workouts</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div className={clsx("h-2 rounded-full transition-all", getProgressColor(weeklyStrength, 2))} style={{ width: `${Math.min(100, (weeklyStrength / 2) * 100)}%` }} />
                                </div>
                                <span className="text-xs font-bold w-12 text-right">{weeklyStrength}/2</span>
                            </div>
                        </div>

                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-3xl font-bold text-rose-600">{consistentStrengthWeeks}</span>
                            <span className="text-slate-400 mb-1 font-bold text-sm">/ 52 Weeks (Year)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                            <div className="bg-rose-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (consistentStrengthWeeks / 52) * 100)}%` }} />
                        </div>
                        <p className="text-xs text-right text-slate-400 mt-2 font-medium">Weeks with ≥ 2 workouts</p>
                    </div>
                </Card>
            </div>
        </Layout>
    );
}
