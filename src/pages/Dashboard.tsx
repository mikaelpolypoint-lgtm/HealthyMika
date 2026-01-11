import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card } from "../components/Ui";

import {
    Bike, Dumbbell, Scale, ChevronLeft, ChevronRight,
    Crown, UtensilsCrossed, Wine, Smartphone, Footprints, Trash2, BookOpen
} from "lucide-react";
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx } from 'clsx';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, differenceInCalendarDays, addWeeks, subWeeks, addMonths, subMonths, format, getISOWeek } from 'date-fns';

// --- Types ---
type TimeFilter = 'week' | 'month' | 'year';

interface DailyGoal {
    id: string; // date string
    date: string;
    jesus: boolean;
    hungryOnly: boolean; // some variance in field names (check DailyLog vs Goals)
    noAlcohol: boolean;
    noSoda: boolean;
    phoneFree: boolean;
    phoneFreeEvening: boolean; // New field name in DailyLog
    declutteredItem?: string;
    completed?: boolean;
}

interface FoodLog {
    id: string; // date string
    date: string;
    eatWhenHungry: boolean;
    noAlcohol: boolean;
    noSodas: boolean;
    caloriesColor: string;
}


// --- Targets (Fallback Defaults) ---
// We keep these briefly as initial state or fallback but aim to replace usage.
const DEFAULT_TARGETS = {
    WEIGHT: 82,
    JESUS: { week: 7, month: 30, year: 365 },
    HUNGRY: { week: 6, month: 25, year: 300 },
    CLEAN: { week: 6, month: 25, year: 300 },
    PHONE: { week: 6, month: 25, year: 300 },
    RUN: { week: 3.5, month: 15, year: 182.5 },
    BIKE: { week: 35, month: 152, year: 1825 },
    STRENGTH: { week: 2, month: 9, year: 104 },
    NT_CHAPTERS: 260,
    BOOKS: { week: 0, month: 1, year: 12 },
    DECLUTTER: { week: 1, month: 4, year: 52 }
};

export default function Dashboard() {
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
    const [currentDate, setCurrentDate] = useState(new Date());

    // --- Data State ---
    const [goalsConfig, setGoalsConfig] = useState<any[]>([]); // Dynamic Goals from Settings
    const [weightLogs, setWeightLogs] = useState<any[]>([]);
    const [cardioLogs, setCardioLogs] = useState<any[]>([]);
    const [strengthLogs, setStrengthLogs] = useState<any[]>([]);
    const [dailyGoalsLogs, setDailyGoalsLogs] = useState<DailyGoal[]>([]);
    const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]); // specific day_food_logs
    const [fellowshipLogs, setFellowshipLogs] = useState<any[]>([]);
    const [bookLogs, setBookLogs] = useState<any[]>([]);
    const [declutterCollectionLogs, setDeclutterCollectionLogs] = useState<any[]>([]);

    // --- Loading ---
    useEffect(() => {
        const unsubGoals = onSnapshot(collection(db, 'goals'), s => {
            const goals = s.docs.map(d => ({ id: d.id, ...d.data() }));
            setGoalsConfig(goals);
        });

        const unsubWeight = onSnapshot(query(collection(db, 'weight_logs'), orderBy('date', 'desc')), s => setWeightLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubCardio = onSnapshot(query(collection(db, 'cardio_logs'), orderBy('date', 'desc')), s => setCardioLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubStrength = onSnapshot(query(collection(db, 'workouts'), orderBy('date', 'desc')), s => setStrengthLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubFood = onSnapshot(query(collection(db, 'day_food_logs'), orderBy('date', 'desc')), s => setFoodLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as FoodLog))));
        const unsubDailyGoals = onSnapshot(collection(db, 'daily_goals'), s => setDailyGoalsLogs(s.docs.map(d => ({ id: d.id, ...d.data() } as DailyGoal))));
        const unsubFellowship = onSnapshot(collection(db, 'fellowship_logs'), s => setFellowshipLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubBooks = onSnapshot(collection(db, 'books'), s => setBookLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubDeclutter = onSnapshot(collection(db, 'declutter_items'), s => setDeclutterCollectionLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => {
            unsubGoals();
            unsubWeight(); unsubCardio(); unsubStrength();
            unsubFood(); unsubDailyGoals(); unsubFellowship(); unsubBooks();
            unsubDeclutter();
        };
    }, []);

    // Helper to get target from dynamic config or fallback
    const getTarget = (slug: string, period: TimeFilter | 'fixed') => {
        const goal = goalsConfig.find(g => g.slug === slug);
        if (!goal) {
            // Fallback logic
            if (slug === 'weight') return DEFAULT_TARGETS.WEIGHT;
            // Map simple slugs to default keys for temporary safety
            const map: Record<string, any> = {
                'jesus': DEFAULT_TARGETS.JESUS,
                'hungry': DEFAULT_TARGETS.HUNGRY,
                'clean': DEFAULT_TARGETS.CLEAN,
                'phone': DEFAULT_TARGETS.PHONE,
                'run': DEFAULT_TARGETS.RUN,
                'bike': DEFAULT_TARGETS.BIKE,
                'strength': DEFAULT_TARGETS.STRENGTH,
                'nt': DEFAULT_TARGETS.NT_CHAPTERS,
                'books': DEFAULT_TARGETS.BOOKS,
                'declutter': DEFAULT_TARGETS.DECLUTTER
            };
            const def = map[slug];
            if (typeof def === 'number') return def;
            if (def && period !== 'fixed') return def[period];
            return 0;
        }

        if (period === 'fixed') return goal.yearlyTarget; // Usually fixed targets are yearly or single value
        if (period === 'week') return goal.weeklyTarget;
        if (period === 'month') return goal.monthlyTarget;
        if (period === 'year') return goal.yearlyTarget;
        return 0;
    };


    // --- Calculations ---
    const today = new Date();
    // Start of custom year or calendar year? Using custom for 'year' filter as per previous logic
    const START_OF_YEAR = new Date('2025-12-28');

    const dateRange = useMemo(() => {
        if (timeFilter === 'week') {
            return {
                start: startOfWeek(currentDate, { weekStartsOn: 1 }),
                end: endOfWeek(currentDate, { weekStartsOn: 1 })
            };
        } else if (timeFilter === 'month') {
            return {
                start: startOfMonth(currentDate),
                end: endOfMonth(currentDate)
            };
        } else {
            // Year - use custom start date
            return { start: START_OF_YEAR, end: new Date('2026-12-31') }; // Approx end
        }
    }, [timeFilter, currentDate]);

    const handlePrev = () => {
        if (timeFilter === 'week') setCurrentDate(d => subWeeks(d, 1));
        if (timeFilter === 'month') setCurrentDate(d => subMonths(d, 1));
    };

    const handleNext = () => {
        if (timeFilter === 'week') setCurrentDate(d => addWeeks(d, 1));
        if (timeFilter === 'month') setCurrentDate(d => addMonths(d, 1));
    };

    const periodLabel = useMemo(() => {
        if (timeFilter === 'week') return `Week ${getISOWeek(currentDate)} (${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d')})`;
        if (timeFilter === 'month') return format(currentDate, 'MMMM yyyy');
        return '2026 Season';
    }, [timeFilter, currentDate, dateRange]);

    // Projection Helpers
    const projectionStats = useMemo(() => {
        const totalDays = differenceInDays(dateRange.end, dateRange.start) + 1;

        // Days elapsed: Ensure we don't go beyond today or total days
        let daysElapsed = differenceInCalendarDays(today, dateRange.start) + 1;
        // If looking at a past period, elapsed is total. If future, 0.
        if (today > dateRange.end) daysElapsed = totalDays;
        if (today < dateRange.start) daysElapsed = 0;

        // Use a minimum of 1 day to avoid Infinity, but also concept of "current day pace"
        const effectiveElapsed = Math.max(1, daysElapsed); // Even on day 1 morning, we project based on what's done so far? 
        // Maybe better: if day 1, projection is volatile. But user asked for it. 
        // Better logic: If elapsed < 1 (start of day 1), maybe treat as 0.5? Let's stick to simple integers for now effectively.

        return { totalDays, daysElapsed: effectiveElapsed };
    }, [dateRange]);

    const getProjection = (current: number) => {
        if (projectionStats.daysElapsed === 0) return 0;
        const rate = current / projectionStats.daysElapsed;
        return Math.round(rate * projectionStats.totalDays);
    };

    // Helper to render projection text
    const RenderProjection = ({ current, unit }: { current: number, unit?: string }) => {
        const proj = getProjection(current);
        return (
            <span className="text-[10px] font-bold text-slate-400 uppercase">
                Trending to: <span className="text-slate-600">{proj}{unit ? ` ${unit}` : ''}</span>
            </span>
        );
    };

    // 1. Habits Progress
    const habitsStats = useMemo(() => {
        const isInRange = (d: Date) => d >= dateRange.start && d <= dateRange.end;

        const checkLog = (logs: any[], checkFn: (l: any) => boolean) => {
            return logs.filter(l => {
                const d = new Date(l.date || l.id); // support both Timestamp and string ID dates
                return isInRange(d) && checkFn(l);
            }).length;
        };

        const jesus = checkLog(dailyGoalsLogs, g => g.jesus);
        const hungry = checkLog(foodLogs, l => l.eatWhenHungry);
        const clean = checkLog(foodLogs, l => l.noAlcohol && l.noSodas);
        const phone = checkLog(dailyGoalsLogs, l => l.phoneFree || l.phoneFreeEvening);

        return {
            jesus: { val: jesus, target: getTarget('jesus', timeFilter) },
            hungry: { val: hungry, target: getTarget('hungry', timeFilter) },
            clean: { val: clean, target: getTarget('clean', timeFilter) },
            phone: { val: phone, target: getTarget('phone', timeFilter) }
        };
    }, [dailyGoalsLogs, foodLogs, dateRange, timeFilter, goalsConfig]);


    // 2. Physical & Life Progress
    const physicalStats = useMemo(() => {
        const isInRange = (d: Date) => d >= dateRange.start && d <= dateRange.end;

        const runLogs = cardioLogs.filter(l => l.equipment === 'Running' && isInRange(l.date.toDate()));
        const bikeLogs = cardioLogs.filter(l => l.equipment !== 'Running' && isInRange(l.date.toDate()));
        const strengthInPeriod = strengthLogs.filter(l => isInRange(l.date.toDate()));

        const runTotal = runLogs.reduce((a, b) => a + (b.distance || 0), 0);
        const bikeTotal = bikeLogs.reduce((a, b) => a + (b.distance || 0), 0);

        // Count Unique workout days (Sets -> Workouts)
        const uniqueWorkoutDates = new Set(strengthInPeriod.map(l => l.date.toDate().toDateString()));
        const strengthCount = uniqueWorkoutDates.size;

        // Weight
        const currentWeight = weightLogs.length > 0 ? weightLogs[0].weight : 0;

        // Declutter (New 'declutter_items' + Legacy 'daily_goals')
        const newDeclutterInPeriod = declutterCollectionLogs.filter(d => isInRange(d.date.toDate()));
        const legacyDeclutterInPeriod = dailyGoalsLogs.filter(d => d.declutteredItem && d.declutteredItem.trim().length > 0 && isInRange(new Date(d.id)));

        const declutterTotal = newDeclutterInPeriod.length + legacyDeclutterInPeriod.length;

        // Books: Count 'books' where progress === 100 AND finishedAt in range
        const booksRead = bookLogs.filter(b => b.progress === 100 && b.finishedAt && isInRange(b.finishedAt.toDate())).length;

        return {
            run: runTotal,
            bike: bikeTotal,
            strength: strengthCount,
            currentWeight,
            declutter: declutterTotal,
            books: booksRead
        };
    }, [cardioLogs, strengthLogs, weightLogs, dailyGoalsLogs, declutterCollectionLogs, bookLogs, dateRange]);

    // 3. NT Progress (Total or Period?)
    // "Read NT in a year" is a long term goal.
    // If filter is Week, user might want to know chapters read THIS WEEK vs Target Pace?
    // Let's show "Chapters read in period" vs "Target Pace for period"?
    // Or just keep it as "Total Progress" if Year, but "Pace" if Week.
    // Let's stick to "Chapters Read in Period" for now vs a calculated target.
    const ntStats = useMemo(() => {
        let chapters = 0;
        fellowshipLogs.forEach(l => {
            // Assuming l.date is a string in 'yyyy-MM-dd' format for comparison
            // Firebase Timestamps need .toDate()
            const logDate = new Date(l.date);
            if (logDate >= dateRange.start && logDate <= dateRange.end) {
                if (Array.isArray(l.chaptersRead)) {
                    chapters += l.chaptersRead.length;
                }
            }
        });

        const target = getTarget('nt', timeFilter);

        return { chapters, target };
    }, [fellowshipLogs, dateRange, timeFilter, goalsConfig]);





    // 5. Diagrams Data



    // -- RENDER TARGET GETTERS --
    const t_declutter = getTarget('declutter', timeFilter);
    const t_books = getTarget('books', timeFilter);
    const t_run = getTarget('run', timeFilter);
    const t_bike = getTarget('bike', timeFilter);
    const t_strength = getTarget('strength', timeFilter);

    // Special Weight Calculation (Linear Interpolation from Start Date)
    const t_weight = useMemo(() => {
        const wGoal = goalsConfig.find(g => g.slug === 'weight');
        if (!wGoal) return getTarget('weight', 'fixed');

        // 1. Define Goal Parameters
        const GOAL_START_DATE = new Date('2026-01-01'); // Fixed Start Date as requested
        const targetWeight = wGoal.yearlyTarget;

        // 2. Find Start Weight (Weight on or closest to Jan 1st)
        // We need a baseline. Let's find the log closest to Jan 1st 2026.
        // weightLogs is sorted by date DESC.
        const sortedLogs = [...weightLogs].sort((a, b) => a.date.seconds - b.date.seconds); // Sort ASC
        // Find first log ON or AFTER Jan 1st
        const startLog = sortedLogs.find(l => {
            const d = l.date.toDate();
            return d >= GOAL_START_DATE;
        }) || sortedLogs[0]; // Fallback to earliest available

        const startWeight = startLog?.weight || 90; // Fallback if no logs

        // 3. Define End Date
        const goalEndDate = wGoal.endDate ? new Date(wGoal.endDate) : new Date('2026-04-30'); // Default to end of April if not set

        // 4. Calculate Slope (Daily Loss)
        const totalDays = differenceInCalendarDays(goalEndDate, GOAL_START_DATE);
        const totalLoss = startWeight - targetWeight;
        const dailyLoss = totalLoss / Math.max(1, totalDays);

        // 5. Determine Target for Current View (End of the selected period)
        let targetDateForView = dateRange.end;

        // If viewing Year, usually we show the FINAL goal? 
        // Or if we want to see "Where should I be TODAY (or end of this year)", 
        // logic implies showing the curve value. 
        // However, usually "Yearly Goal" implies the final destination (85).
        if (timeFilter === 'year') return targetWeight;

        // Constraint: Don't project past the goal end date (Maintenance phase)
        if (targetDateForView > goalEndDate) targetDateForView = goalEndDate;

        // Calculate days passed since start
        const daysPassed = differenceInCalendarDays(targetDateForView, GOAL_START_DATE);

        // If checking a date BEFORE the start, expectation is start weight
        if (daysPassed < 0) return startWeight;

        // Linear Calculation
        const calculatedTarget = startWeight - (dailyLoss * daysPassed);

        return Number(calculatedTarget.toFixed(1));
    }, [goalsConfig, timeFilter, weightLogs, dateRange]);


    // Dynamic Colors
    const getGoalColor = (slug: string, fallback: string) => {
        const g = goalsConfig.find(c => c.slug === slug);
        return g?.color || fallback;
    };

    const c_jesus = getGoalColor('jesus', 'amber');
    const c_hungry = getGoalColor('hungry', 'emerald');
    const c_clean = getGoalColor('clean', 'blue');
    const c_phone = getGoalColor('phone', 'purple');

    const c_declutter = getGoalColor('declutter', 'slate');
    const c_books = getGoalColor('books', 'indigo');
    const c_nt = getGoalColor('nt', 'amber');
    const c_weight = getGoalColor('weight', 'rose');

    const c_run = getGoalColor('run', 'cyan');
    const c_bike = getGoalColor('bike', 'indigo');
    const c_strength = getGoalColor('strength', 'emerald');

    // -- RENDER --
    return (
        <Layout>
            {/* Header */}
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-2">Goals 🚀</h2>
                    <p className="text-slate-500">Track your progress and stay consistent.</p>
                </div>

                {/* Time Filter Controls & Navigation */}
                <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                    {/* Filter Tabs */}
                    <div className="flex bg-slate-200/50 p-1 rounded-xl">
                        {(['week', 'month', 'year'] as TimeFilter[]).map((filter) => (
                            <button
                                key={filter}
                                onClick={() => { setTimeFilter(filter); setCurrentDate(new Date()); }}
                                className={clsx(
                                    "px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all",
                                    timeFilter === filter ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    {/* Date Navigation (Only for Week/Month) */}
                    {timeFilter !== 'year' && (
                        <div className="flex items-center gap-2 px-2">
                            <button onClick={handlePrev} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronLeft size={20} /></button>
                            <span className="text-sm font-bold text-slate-700 min-w-[140px] text-center">{periodLabel}</span>
                            <button onClick={handleNext} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronRight size={20} /></button>
                        </div>
                    )}
                </div>
            </header>

            <div className="space-y-8">
                {/* --- 1. LIFE GOALS GRID (Declutter, Books, Weight, NT) --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Declutter */}
                    <Card className={clsx("p-4 md:p-6", `bg-${c_declutter}-50 border-${c_declutter}-200`)}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className={clsx("p-2 bg-white rounded-lg shadow-sm", `text-${c_declutter}-600`)}>
                                <Trash2 size={24} />
                            </div>
                            <h4 className="font-bold text-slate-700">Decluttering</h4>
                        </div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <span className="text-3xl font-bold text-slate-800">{physicalStats.declutter}</span>
                                <span className="text-sm text-slate-500 ml-1">/ {t_declutter} items</span>
                            </div>
                            <div className="text-right">
                                <span className={clsx("text-sm font-bold block", `text-${c_declutter}-600`)}>{Math.round((physicalStats.declutter / (t_declutter || 1)) * 100)}%</span>
                                <RenderProjection current={physicalStats.declutter} unit="items" />
                            </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div className={clsx("h-2 rounded-full transition-all duration-500", `bg-${c_declutter}-600`)} style={{ width: `${Math.min(100, (physicalStats.declutter / (t_declutter || 1)) * 100)}%` }}></div>
                        </div>
                    </Card>

                    {/* Books Read */}
                    <Card className={clsx("p-4 md:p-6", `bg-${c_books}-50 border-${c_books}-200`)}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className={clsx("p-2 bg-white rounded-lg shadow-sm", `text-${c_books}-600`)}>
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-700">Books Read</h4>
                            </div>
                        </div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <span className="text-3xl font-bold text-slate-800">{physicalStats.books}</span>
                                <span className="text-sm text-slate-500 ml-1">/ {t_books} books</span>
                            </div>
                            <div className="text-right">
                                <span className={clsx("text-sm font-bold block", `text-${c_books}-600`)}>{Math.round((physicalStats.books / Math.max(1, t_books)) * 100)}%</span>
                                <RenderProjection current={physicalStats.books} unit="books" />
                            </div>
                        </div>
                        <div className={clsx("w-full rounded-full h-2", `bg-${c_books}-200/50`)}>
                            <div className={clsx("h-2 rounded-full transition-all duration-500", `bg-${c_books}-500`)} style={{ width: `${Math.min(100, (physicalStats.books / Math.max(1, t_books)) * 100)}%` }}></div>
                        </div>
                    </Card>

                    {/* New Testament */}
                    <Card className={clsx("p-4 md:p-6", `bg-${c_nt}-50 border-${c_nt}-200`)}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className={clsx("p-2 bg-white rounded-lg shadow-sm", `text-${c_nt}-600`)}>
                                <BookOpen size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-700">New Testament</h4>
                            </div>
                        </div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <span className="text-3xl font-bold text-slate-800">{ntStats.chapters}</span>
                                <span className="text-sm text-slate-500 ml-1">/ {ntStats.target} ch</span>
                            </div>
                            <div className="text-right">
                                <span className={clsx("text-sm font-bold block", ntStats.chapters >= ntStats.target ? "text-emerald-500" : `text-${c_nt}-500`)}>
                                    {Math.round((ntStats.chapters / Math.max(1, ntStats.target)) * 100)}%
                                </span>
                                <RenderProjection current={ntStats.chapters} unit="ch" />
                            </div>
                        </div>
                        <div className={clsx("w-full rounded-full h-2", `bg-${c_nt}-200/50`)}>
                            <div className={clsx("h-2 rounded-full transition-all duration-500", `bg-${c_nt}-500`)} style={{ width: `${Math.min(100, (ntStats.chapters / Math.max(1, ntStats.target)) * 100)}%` }}></div>
                        </div>
                    </Card>

                    {/* Weight (Dynamic Target) */}
                    <Card className={clsx("p-4 md:p-6 relative overflow-hidden transition-all", `bg-${c_weight}-50 border-${c_weight}-200`)}>
                        <div className="flex items-center gap-2 mb-4 relative z-10">
                            <div className={clsx("p-2 bg-white rounded-lg shadow-sm", `text-${c_weight}-600`)}>
                                <Scale size={24} />
                            </div>
                            <h4 className="font-bold text-slate-700">Weight Goal</h4>
                            <span className="ml-auto text-xs font-bold uppercase bg-white/50 px-2 py-1 rounded text-slate-500">{timeFilter}ly Target</span>
                        </div>
                        <div className="flex justify-between items-end mb-2 relative z-10">
                            <div>
                                <span className="text-3xl font-bold text-slate-800">{physicalStats.currentWeight}</span>
                                <span className="text-sm text-slate-500 ml-1">/ {t_weight} kg</span>
                            </div>
                        </div>
                        <p className={clsx("text-xs mt-2 font-bold text-right", `text-${c_weight}-500`)}>
                            {physicalStats.currentWeight <= t_weight ? "Target Reached! 🎉" : `-${(physicalStats.currentWeight - t_weight).toFixed(1)} kg to go`}
                        </p>
                    </Card>
                </div>

                {/* --- 2. HABITS GRID --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Jesus */}
                    <Card className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Crown size={20} className={clsx(`text-${c_jesus}-500`)} />
                            <h4 className="font-bold text-slate-700 text-sm">Start w/ Jesus</h4>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className={clsx("font-bold", habitsStats.jesus.val >= (habitsStats.jesus.target || 0) ? `text-${c_jesus}-500` : `text-${c_jesus}-700`)}>
                                {Math.round((habitsStats.jesus.val / (habitsStats.jesus.target || 1)) * 100)}%
                            </span>
                            <span className={clsx(`text-${c_jesus}-700 font-medium`)}>
                                {habitsStats.jesus.val} / {habitsStats.jesus.target} days
                            </span>
                        </div>
                        <div className="mb-1 text-right"><RenderProjection current={habitsStats.jesus.val} unit="days" /></div>
                        <div className={clsx("w-full rounded-full h-2.5", `bg-${c_jesus}-100`)}>
                            <div className={clsx("h-2.5 rounded-full", `bg-${c_jesus}-500`)} style={{ width: `${Math.min(100, (habitsStats.jesus.val / (habitsStats.jesus.target || 1)) * 100)}%` }}></div>
                        </div>
                    </Card>

                    {/* Hungry */}
                    <Card className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <UtensilsCrossed size={20} className={clsx(`text-${c_hungry}-500`)} />
                            <h4 className="font-bold text-slate-700 text-sm">Hungry Only</h4>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className={clsx("font-bold", habitsStats.hungry.val >= (habitsStats.hungry.target || 0) ? `text-${c_hungry}-500` : `text-${c_hungry}-700`)}>
                                {Math.round((habitsStats.hungry.val / (habitsStats.hungry.target || 1)) * 100)}%
                            </span>
                            <span className={clsx(`text-${c_hungry}-700 font-medium`)}>
                                {habitsStats.hungry.val} / {habitsStats.hungry.target} days
                            </span>
                        </div>
                        <div className="mb-1 text-right"><RenderProjection current={habitsStats.hungry.val} unit="days" /></div>
                        <div className={clsx("w-full rounded-full h-2.5", `bg-${c_hungry}-100`)}>
                            <div className={clsx("h-2.5 rounded-full", `bg-${c_hungry}-500`)} style={{ width: `${Math.min(100, (habitsStats.hungry.val / (habitsStats.hungry.target || 1)) * 100)}%` }}></div>
                        </div>
                    </Card>

                    {/* Clean */}
                    <Card className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Wine size={20} className={clsx(`text-${c_clean}-500`)} />
                            <h4 className="font-bold text-slate-700 text-sm">No Alc/Soda</h4>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className={clsx("font-bold", habitsStats.clean.val >= (habitsStats.clean.target || 0) ? `text-${c_clean}-500` : `text-${c_clean}-700`)}>
                                {Math.round((habitsStats.clean.val / (habitsStats.clean.target || 1)) * 100)}%
                            </span>
                            <span className={clsx(`text-${c_clean}-700 font-medium`)}>
                                {habitsStats.clean.val} / {habitsStats.clean.target} days
                            </span>
                        </div>
                        <div className="mb-1 text-right"><RenderProjection current={habitsStats.clean.val} unit="days" /></div>
                        <div className={clsx("w-full rounded-full h-2.5", `bg-${c_clean}-100`)}>
                            <div className={clsx("h-2.5 rounded-full", `bg-${c_clean}-500`)} style={{ width: `${Math.min(100, (habitsStats.clean.val / (habitsStats.clean.target || 1)) * 100)}%` }}></div>
                        </div>
                    </Card>

                    {/* Phone */}
                    <Card className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Smartphone size={20} className={clsx(`text-${c_phone}-500`)} />
                            <h4 className="font-bold text-slate-700 text-sm">Phone Free</h4>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                            <span className={clsx("font-bold", habitsStats.phone.val >= (habitsStats.phone.target || 0) ? `text-${c_phone}-500` : `text-${c_phone}-700`)}>
                                {Math.round((habitsStats.phone.val / (habitsStats.phone.target || 1)) * 100)}%
                            </span>
                            <span className={clsx(`text-${c_phone}-700 font-medium`)}>
                                {habitsStats.phone.val} / {habitsStats.phone.target} days
                            </span>
                        </div>
                        <div className="mb-1 text-right"><RenderProjection current={habitsStats.phone.val} unit="days" /></div>
                        <div className={clsx("w-full rounded-full h-2.5", `bg-${c_phone}-100`)}>
                            <div className={clsx("h-2.5 rounded-full", `bg-${c_phone}-500`)} style={{ width: `${Math.min(100, (habitsStats.phone.val / (habitsStats.phone.target || 1)) * 100)}%` }}></div>
                        </div>
                    </Card>
                </div>

                {/* --- 3. SPORTS GOALS ROW --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Run */}
                    <Card className={clsx("p-4 md:p-6", `bg-${c_run}-50 border-${c_run}-200`)}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className={clsx("p-2 bg-white rounded-lg shadow-sm", `text-${c_run}-600`)}>
                                <Footprints size={24} />
                            </div>
                            <h4 className="font-bold text-slate-700">Running</h4>
                        </div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <span className="text-3xl font-bold text-slate-800">{physicalStats.run.toFixed(1)}</span>
                                <span className="text-sm text-slate-500 ml-1">/ {t_run} km</span>
                            </div>
                            <div className="text-right">
                                <span className={clsx("text-sm font-bold block", `text-${c_run}-600`)}>{Math.round((physicalStats.run / (t_run || 1)) * 100)}%</span>
                                <RenderProjection current={physicalStats.run} unit="km" />
                            </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div className={clsx("h-2 rounded-full", `bg-${c_run}-500`)} style={{ width: `${Math.min(100, (physicalStats.run / (t_run || 1)) * 100)}%` }}></div>
                        </div>
                    </Card>

                    {/* Bike */}
                    <Card className={clsx("p-4 md:p-6", `bg-${c_bike}-50 border-${c_bike}-200`)}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className={clsx("p-2 bg-white rounded-lg shadow-sm", `text-${c_bike}-600`)}>
                                <Bike size={24} />
                            </div>
                            <h4 className="font-bold text-slate-700">Cycling</h4>
                        </div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <span className="text-3xl font-bold text-slate-800">{physicalStats.bike.toFixed(1)}</span>
                                <span className="text-sm text-slate-500 ml-1">/ {t_bike} km</span>
                            </div>
                            <div className="text-right">
                                <span className={clsx("text-sm font-bold block", `text-${c_bike}-600`)}>{Math.round((physicalStats.bike / (t_bike || 1)) * 100)}%</span>
                                <RenderProjection current={physicalStats.bike} unit="km" />
                            </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div className={clsx("h-2 rounded-full", `bg-${c_bike}-500`)} style={{ width: `${Math.min(100, (physicalStats.bike / (t_bike || 1)) * 100)}%` }}></div>
                        </div>
                    </Card>

                    {/* Strength */}
                    <Card className={clsx("p-4 md:p-6", `bg-${c_strength}-50 border-${c_strength}-200`)}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className={clsx("p-2 bg-white rounded-lg shadow-sm", `text-${c_strength}-600`)}>
                                <Dumbbell size={24} />
                            </div>
                            <h4 className="font-bold text-slate-700">Strength</h4>
                        </div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <span className="text-3xl font-bold text-slate-800">{physicalStats.strength}</span>
                                <span className="text-sm text-slate-500 ml-1">/ {t_strength} workouts</span>
                            </div>
                            <div className="text-right">
                                <span className={clsx("text-sm font-bold block", `text-${c_strength}-600`)}>{Math.round((physicalStats.strength / (t_strength || 1)) * 100)}%</span>
                                <RenderProjection current={physicalStats.strength} />
                            </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                            <div className={clsx("h-2 rounded-full", `bg-${c_strength}-500`)} style={{ width: `${Math.min(100, (physicalStats.strength / (t_strength || 1)) * 100)}%` }}></div>
                        </div>
                    </Card>
                </div>
            </div>


        </Layout>
    );
}
