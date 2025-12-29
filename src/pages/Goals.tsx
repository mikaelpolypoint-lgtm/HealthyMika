import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, onSnapshot, doc, setDoc, Timestamp, addDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { getWeek } from 'date-fns';
import { Trash2, Smartphone, Wine, UtensilsCrossed, Cross } from 'lucide-react';
import { clsx } from 'clsx';

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

interface DailyGoal {
    date: string;
    jesus: boolean;
    hungryOnly: boolean;
    noAlcoholSoda: boolean;
    phoneFree: boolean;
}

export default function Goals() {
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

    // Habits Stats
    const [dailyGoals, setDailyGoals] = useState<Record<string, DailyGoal>>({});
    const [recentFoodLogs, setRecentFoodLogs] = useState<Record<string, any>>({});
    const [habitsWeeklyStatus, setHabitsWeeklyStatus] = useState<any>({});
    const [habitsYearlyStatus, setHabitsYearlyStatus] = useState<any>({});


    // Targets
    const WEIGHT_TARGET = 82;
    const WEIGHT_DEADLINE = new Date('2026-03-31');
    const RUN_YEARLY_TARGET = 182.5;
    const BIKE_YEARLY_TARGET = 1825;

    // Weekly Targets (Simple average for Cardio)
    const RUN_WEEKLY_TARGET = 3.5;
    const BIKE_WEEKLY_TARGET = 35;

    const [newItem, setNewItem] = useState('');
    const [loadingItem, setLoadingItem] = useState(false);

    const [weeklyStrength, setWeeklyStrength] = useState(0);
    const [consistentStrengthWeeks, setConsistentStrengthWeeks] = useState(0);



    // Load Data
    useEffect(() => {
        // Load Lost Items
        const qItems = query(collection(db, 'lost_items'), orderBy('date', 'desc'));
        const unsubItems = onSnapshot(qItems, (snap) => {
            setLostItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LostItem)));
        });

        // Load Project Progress & CAS
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

        // 1. Daily Goals (Habits)
        const qDaily = query(collection(db, 'daily_goals'));
        const unsubDaily = onSnapshot(qDaily, (snap) => {
            const data: Record<string, DailyGoal> = {};
            snap.docs.forEach(doc => { data[doc.id] = doc.data() as DailyGoal; });
            setDailyGoals(data);
        });

        // 2. Food Logs (All for yearly stats)
        const qFood = query(collection(db, 'day_food_logs'));
        const unsubFood = onSnapshot(qFood, (snap) => {
            const data: Record<string, any> = {};
            snap.docs.forEach(d => { data[d.id] = d.data(); });
            setRecentFoodLogs(data);
        });

        // Calculate Run/Bike totals for 2026
        const qCardio = query(collection(db, 'cardio_logs'));
        const unsubCardio = onSnapshot(qCardio, (snap) => {
            let runTotal = 0;
            let bikeTotal = 0;
            let runWeek = 0;
            let bikeWeek = 0;

            const now = new Date();
            const currentWeek = getWeek(now, { weekStartsOn: 0 });
            const currentYear = now.getFullYear();
            const GOAL_START_DATE = new Date('2025-12-28');
            GOAL_START_DATE.setHours(0, 0, 0, 0);

            snap.docs.forEach(d => {
                const data = d.data();
                const date = d.data().date.toDate();

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

        return () => { unsubItems(); unsubMeta(); unsubCardio(); unsubWeight(); unsubDaily(); unsubFood(); };
    }, []);

    // Calculate Habits Stats
    useEffect(() => {
        const now = new Date();
        const currentWeek = getWeek(now, { weekStartsOn: 0 });
        const currentYear = now.getFullYear();
        const GOAL_START_DATE = new Date('2025-12-28');

        // Helper
        const isInCurrentWeek = (dateStr: string) => {
            const d = new Date(dateStr);
            return getWeek(d, { weekStartsOn: 0 }) === currentWeek && d.getFullYear() === currentYear;
        };
        const isInYear = (dateStr: string) => new Date(dateStr) >= GOAL_START_DATE;

        // Weekly Counts
        const wJesus = Object.values(dailyGoals).filter(g => isInCurrentWeek(g.date) && g.jesus).length;
        const wHungry = Object.values(recentFoodLogs).filter(l => isInCurrentWeek(l.date) && l.eatWhenHungry).length;
        const wClean = Object.values(recentFoodLogs).filter(l => isInCurrentWeek(l.date) && l.noAlcohol && l.noSodas).length;
        const wPhone = Object.values(dailyGoals).filter(g => isInCurrentWeek(g.date) && g.phoneFree).length;

        // Yearly Counts
        const yJesus = Object.values(dailyGoals).filter(g => isInYear(g.date) && g.jesus).length;
        const yHungry = Object.values(recentFoodLogs).filter(l => isInYear(l.date) && l.eatWhenHungry).length;
        const yClean = Object.values(recentFoodLogs).filter(l => isInYear(l.date) && l.noAlcohol && l.noSodas).length;
        const yPhone = Object.values(dailyGoals).filter(g => isInYear(g.date) && g.phoneFree).length;

        setHabitsWeeklyStatus({ jesus: wJesus, hungry: wHungry, clean: wClean, phone: wPhone });
        setHabitsYearlyStatus({ jesus: yJesus, hungry: yHungry, clean: yClean, phone: yPhone });

    }, [dailyGoals, recentFoodLogs]);


    // Calculate Strength Consistency
    useEffect(() => {
        const q = query(collection(db, 'training_plan'));
        const unsub = onSnapshot(q, (snap) => {
            const completedByWeek: Record<string, number> = {};
            let thisWeekCount = 0;
            const now = new Date();
            const currentWeek = getWeek(now, { weekStartsOn: 0 });
            const currentYear = now.getFullYear();

            snap.docs.forEach(d => {
                const data = d.data();
                if (data.completed) {
                    const key = `${data.week}`;
                    completedByWeek[key] = (completedByWeek[key] || 0) + 1;
                    if (data.date) {
                        const date = data.date.toDate();
                        if (getWeek(date, { weekStartsOn: 0 }) === currentWeek && date.getFullYear() === currentYear) {
                            thisWeekCount++;
                        }
                    }
                }
            });
            const goodWeeks = Object.values(completedByWeek).filter(count => count >= 2).length;
            setConsistentStrengthWeeks(goodWeeks);
            setWeeklyStrength(thisWeekCount);
        });
        return () => unsub();
    }, []);

    const [ntProgress, setNtProgress] = useState(0);

    // Load NT Progress
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

    const lostItemsTarget = 52;
    const lostItemsCount = lostItems.length;

    // Weight Calculation
    const weightLossNeeded = Math.max(0, currentWeight - WEIGHT_TARGET);
    const weeksUntilMarch = Math.max(1, Math.ceil((WEIGHT_DEADLINE.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 7)));
    const weightWeeklyRate = weightLossNeeded / weeksUntilMarch;

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

                {/* HABITS GOALS (New Section) */}
                <Card className="col-span-full">
                    <CardTitle>Habits Consistency 🔄</CardTitle>
                    <p className="text-sm text-slate-500 mb-6">Building the foundation day by day.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                        {/* 1. Start with Jesus */}
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-amber-200 text-amber-700 rounded-lg"><Cross size={18} /></div>
                                <span className="font-bold text-slate-700">Start w/ Jesus</span>
                            </div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block">Weekly</span>
                                    <span className={clsx("text-2xl font-bold", habitsWeeklyStatus.jesus >= 6 ? "text-emerald-600" : "text-amber-600")}>{habitsWeeklyStatus.jesus}<span className="text-sm text-slate-400">/6</span></span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-slate-400 uppercase block">Yearly</span>
                                    <span className="text-xl font-bold text-slate-600">{habitsYearlyStatus.jesus}<span className="text-sm text-slate-300">/312</span></span>
                                </div>
                            </div>
                            <div className="w-full bg-white rounded-full h-1.5"><div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (habitsYearlyStatus.jesus / 312) * 100)}%` }}></div></div>
                        </div>

                        {/* 2. Eat When Hungry */}
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-200 text-emerald-700 rounded-lg"><UtensilsCrossed size={18} /></div>
                                <span className="font-bold text-slate-700">Hungry Only</span>
                            </div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block">Weekly</span>
                                    <span className={clsx("text-2xl font-bold", habitsWeeklyStatus.hungry >= 5 ? "text-emerald-600" : "text-emerald-600")}>{habitsWeeklyStatus.hungry}<span className="text-sm text-slate-400">/5</span></span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-slate-400 uppercase block">Yearly</span>
                                    <span className="text-xl font-bold text-slate-600">{habitsYearlyStatus.hungry}<span className="text-sm text-slate-300">/260</span></span>
                                </div>
                            </div>
                            <div className="w-full bg-white rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (habitsYearlyStatus.hungry / 260) * 100)}%` }}></div></div>
                        </div>

                        {/* 3. No Soda/Alcohol */}
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-blue-200 text-blue-700 rounded-lg"><Wine size={18} className="line-through" /></div>
                                <span className="font-bold text-slate-700">No Alc/Soda</span>
                            </div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block">Weekly</span>
                                    <span className={clsx("text-2xl font-bold", habitsWeeklyStatus.clean >= 4 ? "text-emerald-600" : "text-blue-600")}>{habitsWeeklyStatus.clean}<span className="text-sm text-slate-400">/4</span></span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-slate-400 uppercase block">Yearly</span>
                                    <span className="text-xl font-bold text-slate-600">{habitsYearlyStatus.clean}<span className="text-sm text-slate-300">/208</span></span>
                                </div>
                            </div>
                            <div className="w-full bg-white rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (habitsYearlyStatus.clean / 208) * 100)}%` }}></div></div>
                        </div>

                        {/* 4. Phone Free */}
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-purple-200 text-purple-700 rounded-lg"><Smartphone size={18} className="line-through" /></div>
                                <span className="font-bold text-slate-700">Phone Free</span>
                            </div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase block">Weekly</span>
                                    <span className={clsx("text-2xl font-bold", habitsWeeklyStatus.phone >= 2 ? "text-emerald-600" : "text-purple-600")}>{habitsWeeklyStatus.phone}<span className="text-sm text-slate-400">/2</span></span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-slate-400 uppercase block">Yearly</span>
                                    <span className="text-xl font-bold text-slate-600">{habitsYearlyStatus.phone}<span className="text-sm text-slate-300">/104</span></span>
                                </div>
                            </div>
                            <div className="w-full bg-white rounded-full h-1.5"><div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (habitsYearlyStatus.phone / 104) * 100)}%` }}></div></div>
                        </div>
                    </div>
                </Card>

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
