import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { Activity, Bike, Dumbbell, Apple, Scale, Crown, Heart, BookOpen, Calendar } from "lucide-react";
import { collection, query, orderBy, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isSameDay, isSameWeek, isSameMonth, format, subDays, getHours, isWeekend, isSunday, startOfWeek, endOfWeek } from 'date-fns';
import { clsx } from 'clsx';
import { calculateBadges } from '../utils/gamification';
import type { BadgeDef } from '../utils/gamification';

// Types
type Tab = 'Daily' | 'Weekly' | 'Monthly' | 'Overall';

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState<Tab>('Weekly');
    const [goalWeight, setGoalWeight] = useState(85);

    // Data States
    const [weightLogs, setWeightLogs] = useState<any[]>([]);
    const [cardioLogs, setCardioLogs] = useState<any[]>([]);
    const [strengthLogs, setStrengthLogs] = useState<any[]>([]);
    const [bodyweightLogs, setBodyweightLogs] = useState<any[]>([]);
    const [foodLogs, setFoodLogs] = useState<any[]>([]);

    // New Data States for Fellowship & Sunday Review
    const [dailyGoalsLogs, setDailyGoalsLogs] = useState<any[]>([]);
    const [fellowshipLogs, setFellowshipLogs] = useState<any[]>([]);
    const [prayerCardsLogs, setPrayerCardsLogs] = useState<any[]>([]);

    useEffect(() => {
        // Fetch Settings
        getDoc(doc(db, 'settings', 'global')).then(snap => {
            if (snap.exists() && snap.data().targetWeight) {
                setGoalWeight(snap.data().targetWeight);
            }
        });

        const unsubWeight = onSnapshot(query(collection(db, 'weight_logs'), orderBy('date', 'desc')), s => setWeightLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubCardio = onSnapshot(query(collection(db, 'cardio_logs'), orderBy('date', 'desc')), s => setCardioLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubStrength = onSnapshot(query(collection(db, 'workouts'), orderBy('date', 'desc')), s => setStrengthLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubBodyweight = onSnapshot(query(collection(db, 'bodyweight_logs'), orderBy('date', 'desc')), s => setBodyweightLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubFood = onSnapshot(query(collection(db, 'food_logs'), orderBy('date', 'desc')), s => setFoodLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));

        // Fellowship Data
        const unsubDailyGoals = onSnapshot(collection(db, 'daily_goals'), s => setDailyGoalsLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubFellowship = onSnapshot(collection(db, 'fellowship_logs'), s => setFellowshipLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubPrayerCards = onSnapshot(collection(db, 'prayer_cards'), s => setPrayerCardsLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => {
            unsubWeight(); unsubCardio(); unsubStrength(); unsubBodyweight(); unsubFood();
            unsubDailyGoals(); unsubFellowship(); unsubPrayerCards();
        };
    }, []);

    // Streak Logic
    const streak = useMemo(() => {
        const allLogs = [...weightLogs, ...cardioLogs, ...strengthLogs, ...bodyweightLogs, ...foodLogs];
        const loggedDates = new Set(allLogs.map(l => format(l.date.toDate(), 'yyyy-MM-dd')));

        let current = new Date();
        // If today isn't logged, check if yesterday was to maintain streak
        if (!loggedDates.has(format(current, 'yyyy-MM-dd'))) {
            const yesterday = subDays(current, 1);
            if (!loggedDates.has(format(yesterday, 'yyyy-MM-dd'))) {
                return 0;
            }
            current = yesterday; // Start counting from yesterday
        }

        let count = 0;
        while (loggedDates.has(format(current, 'yyyy-MM-dd'))) {
            count++;
            current = subDays(current, 1);
        }
        return count;
    }, [weightLogs, cardioLogs, strengthLogs, bodyweightLogs, foodLogs]);

    // Aggregation Logic for Charts
    const stats = useMemo(() => {
        const now = new Date();
        const filterFn = (date: Timestamp) => {
            const d = date.toDate();
            if (activeTab === 'Daily') return isSameDay(d, now);
            if (activeTab === 'Weekly') return isSameWeek(d, now, { weekStartsOn: 1 });
            if (activeTab === 'Monthly') return isSameMonth(d, now);
            return true;
        };

        const filteredWeight = weightLogs.filter(l => filterFn(l.date));
        const filteredCardio = cardioLogs.filter(l => filterFn(l.date));
        const filteredStrength = strengthLogs.filter(l => filterFn(l.date));
        const filteredBodyweight = bodyweightLogs.filter(l => filterFn(l.date));
        const filteredFood = foodLogs.filter(l => filterFn(l.date));

        // Split Cardio
        const filteredCycling = filteredCardio.filter(l => l.equipment !== 'Running');
        const filteredRunning = filteredCardio.filter(l => l.equipment === 'Running');

        // Weight
        const latestWeight = weightLogs.length > 0 ? weightLogs[0].weight : 0;
        const avgWeight = filteredWeight.length > 0
            ? (filteredWeight.reduce((a, b) => a + b.weight, 0) / filteredWeight.length).toFixed(1)
            : latestWeight.toFixed(1);

        // Cardio Totals
        const cardioDur = filteredCardio.reduce((a, b) => a + b.duration, 0);
        const cardioDist = filteredCardio.reduce((a, b) => a + b.distance, 0);
        const cardioCals = filteredCardio.reduce((a, b) => a + b.calories, 0);

        // Cycling Specific
        const cyclingDur = filteredCycling.reduce((a, b) => a + b.duration, 0);
        const cyclingDist = filteredCycling.reduce((a, b) => a + b.distance, 0);

        // Running Specific
        const runningDur = filteredRunning.reduce((a, b) => a + b.duration, 0);
        const runningDist = filteredRunning.reduce((a, b) => a + b.distance, 0);

        // Strength
        const workoutCount = filteredStrength.length;
        const totalVolume = filteredStrength.reduce((a, b) => a + (b.weight * b.reps), 0);

        // Bodyweight
        const bwCount = filteredBodyweight.length;

        // Food
        const foodScoreMap = { green: 3, yellow: 2, orange: 1, red: 0 };
        const avgFoodScore = filteredFood.length > 0
            ? filteredFood.reduce((a, b) => a + (foodScoreMap[b.status as keyof typeof foodScoreMap] || 0), 0) / filteredFood.length
            : 0;

        // Goal Targets
        const TARGETS = {
            Weekly: { run: 3.5, bike: 35, workouts: 3 },
            Monthly: { run: 15, bike: 150, workouts: 13 }, // Approx
            Overall: { run: 182.5, bike: 1825, workouts: 156 }, // 2026 Goals
            Daily: { run: 0.5, bike: 5, workouts: 0 } // Rough daily avg
        };
        const currentTargets = TARGETS[activeTab];

        return {
            avgWeight,
            latestWeight,
            cardioDur,
            cardioDist,
            cardioCals,
            cyclingDur,
            cyclingDist,
            runningDur,
            runningDist,
            workoutCount, // Renamed from setsCount
            totalVolume,
            bwCount,
            avgFoodScore,
            filteredWeight,
            filteredCardio,
            filteredFood,
            filteredStrength,
            currentTargets
        };
    }, [activeTab, weightLogs, cardioLogs, strengthLogs, bodyweightLogs, foodLogs]);

    // Sunday Review Logic
    const sundayReviewData = useMemo(() => {
        const today = new Date();
        if (!isSunday(today)) return null;

        const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 1 }); // Sunday

        const filterByCurrentWeek = (logDate: Timestamp) => {
            const date = logDate.toDate();
            return date >= startOfCurrentWeek && date <= endOfCurrentWeek;
        };

        const weeklyDailyGoals = dailyGoalsLogs.filter(l => filterByCurrentWeek(l.date));
        const weeklyFellowshipLogs = fellowshipLogs.filter(l => filterByCurrentWeek(l.date));
        const weeklyPrayerCards = prayerCardsLogs.filter(l => filterByCurrentWeek(l.date));

        const dailyGoalsCompleted = weeklyDailyGoals.filter(l => l.completed).length;
        const dailyGoalsTotal = weeklyDailyGoals.length;
        const fellowshipCount = weeklyFellowshipLogs.length;
        const prayerCardsCount = weeklyPrayerCards.length;

        return {
            dailyGoalsCompleted,
            dailyGoalsTotal,
            fellowshipCount,
            prayerCardsCount,
            weekStartDate: format(startOfCurrentWeek, 'MMM dd'),
            weekEndDate: format(endOfCurrentWeek, 'MMM dd'),
        };
    }, [dailyGoalsLogs, fellowshipLogs, prayerCardsLogs]);

    // Gamification & Badges
    const gamification = useMemo(() => {
        // 1. Calculate XP
        let totalXp = 0;
        totalXp += weightLogs.length * 50;
        const totalDist = cardioLogs.reduce((acc, log) => acc + (log.distance || 0), 0);
        totalXp += Math.floor(totalDist * 10);
        totalXp += strengthLogs.length * 20;
        const totalBwReps = bodyweightLogs.reduce((acc, log) => acc + (log.count || 0), 0);
        totalXp += totalBwReps;
        const foodXp = foodLogs.reduce((acc, log) => {
            if (log.status === 'green') return acc + 50;
            if (log.status === 'yellow') return acc + 30;
            if (log.status === 'orange') return acc + 10;
            return acc + 5;
        }, 0);
        totalXp += foodXp;

        // Add Fellowship XP
        const totalChapters = fellowshipLogs.reduce((acc, log) => acc + (log.chaptersRead?.length || 0), 0);
        totalXp += totalChapters * 10; // 10 XP per chapter
        totalXp += prayerCardsLogs.length * 25; // 25 XP per prayer card created

        const level = Math.floor(totalXp / 1000) + 1;
        const currentLevelStart = (level - 1) * 1000;
        const progressToNextLevel = ((totalXp - currentLevelStart) / (1000)) * 100;

        // 2. Calculate Stats for Badges
        const totalWorkouts = strengthLogs.length;
        const totalGreenFood = foodLogs.filter(l => l.status === 'green').length;

        // Time based stats
        let earlyBird = 0, nightOwl = 0, weekend = 0;
        const processTime = (d: Date) => {
            const h = getHours(d);
            if (h >= 4 && h < 9) earlyBird++;
            if (h >= 20 || h < 2) nightOwl++;
            if (isWeekend(d)) weekend++;
        };
        const allLogDates: Date[] = [
            ...weightLogs.map(l => l.date.toDate()),
            ...cardioLogs.map(l => l.date.toDate()),
            ...strengthLogs.map(l => l.date.toDate()),
            ...bodyweightLogs.map(l => l.date.toDate()),
            ...foodLogs.map(l => l.date.toDate())
        ];
        allLogDates.forEach(d => processTime(d));

        const badgeList = calculateBadges({
            streak,
            totalDist,
            totalWorkouts,
            totalGreenFood,
            level,
            totalBwReps,
            earlyBirdCount: earlyBird,
            nightOwlCount: nightOwl,
            weekendCount: weekend,
            totalChaptersRead: totalChapters,
            totalPrayerCards: prayerCardsLogs.length
        });

        // Group Badges by ID to show only relevant ones (Highest Earned + Next Target)
        const badgeGroups: Record<string, { earned: BadgeDef | null; next: BadgeDef | null }> = {};
        badgeList.forEach(b => {
            if (!badgeGroups[b.groupId]) badgeGroups[b.groupId] = { earned: null, next: null };
            if (b.isEarned) {
                const current = badgeGroups[b.groupId].earned;
                if (!current || (b.target || 0) > (current.target || 0)) badgeGroups[b.groupId].earned = b;
            } else {
                const currentNext = badgeGroups[b.groupId].next;
                if (!currentNext || (b.target || 0) < (currentNext.target || 0)) badgeGroups[b.groupId].next = b;
            }
        });
        const displayBadges = Object.values(badgeGroups).map(g => g.earned || g.next).filter(Boolean) as BadgeDef[];

        return { xp: totalXp, level, progressToNextLevel, badgeList, displayBadges };
    }, [weightLogs, cardioLogs, strengthLogs, bodyweightLogs, foodLogs, streak, fellowshipLogs, prayerCardsLogs]);

    // Chart Data
    const weightChartData = useMemo(() => {
        const data = stats.filteredWeight
            .map(log => ({
                date: format(log.date.toDate(), 'MMM dd'),
                weight: log.weight,
            }))
            .reverse(); // Display chronologically
        return data;
    }, [stats.filteredWeight]);

    const activityDistribution = useMemo(() => {
        const data = [
            { name: 'Cardio', value: stats.cardioDur || 1, color: '#06b6d4' },
            { name: 'Strength', value: stats.workoutCount * 3 || 1, color: '#f43f5e' },
            { name: 'Bodyweight', value: stats.bwCount * 2 || 1, color: '#8b5cf6' },
            { name: 'Nutrition', value: stats.avgFoodScore * 10 || 1, color: '#22c55e' },
        ];
        // Filter out entries with value 0 or 1 (if it's just a placeholder)
        return data.filter(d => d.value > 1 || (d.name === 'Nutrition' && d.value > 0));
    }, [stats.cardioDur, stats.workoutCount, stats.bwCount, stats.avgFoodScore]);

    return (
        <Layout>
            {sundayReviewData && (
                <Card className="mb-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <CardTitle className="text-white">Sunday Review ({sundayReviewData.weekStartDate} - {sundayReviewData.weekEndDate})</CardTitle>
                        <Calendar size={24} className="text-blue-200" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white/10 p-4 rounded-lg flex flex-col items-center">
                            <BookOpen size={24} className="mb-2 text-blue-200" />
                            <p className="text-lg font-bold">{sundayReviewData.dailyGoalsCompleted}/{sundayReviewData.dailyGoalsTotal}</p>
                            <p className="text-sm text-blue-100">Daily Goals</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-lg flex flex-col items-center">
                            <Heart size={24} className="mb-2 text-blue-200" />
                            <p className="text-lg font-bold">{sundayReviewData.fellowshipCount}</p>
                            <p className="text-sm text-blue-100">Fellowship Logs</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-lg flex flex-col items-center">
                            <Activity size={24} className="mb-2 text-blue-200" />
                            <p className="text-lg font-bold">{stats.workoutCount + stats.filteredCardio.length}</p>
                            <p className="text-sm text-blue-100">Workouts</p>
                        </div>
                        <div className="bg-white/10 p-4 rounded-lg flex flex-col items-center">
                            <Apple size={24} className="mb-2 text-blue-200" />
                            <p className="text-lg font-bold">{stats.avgFoodScore.toFixed(1)}</p>
                            <p className="text-sm text-blue-100">Avg Food Score</p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-1">Dashboard</h2>
                    {gamification.displayBadges.length > 0 && gamification.displayBadges[0].tier === 'diamond' ? (
                        <p className="text-slate-500">Legendary Status. <span className="font-bold text-cyan-500">Diamond Athlete</span></p>
                    ) : (
                        <p className="text-slate-500">Your results. <span className="font-medium text-emerald-600">Level {gamification.level} Athlete</span></p>
                    )}
                </div>

                <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
                    {(['Daily', 'Weekly', 'Monthly', 'Overall'] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                                activeTab === tab ? "bg-brand-primary text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </header>

            {/* Level & Badges Row (Keep as is) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="md:col-span-1 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
                    {/* ... Level Card Logic ... */}
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-slate-400 font-medium text-sm mb-1">Current Level</p>
                                <h3 className="text-4xl font-bold text-white">{gamification.level}</h3>
                            </div>
                            <Crown className="text-amber-400" size={32} />
                        </div>

                        <div className="mt-6">
                            <div className="flex justify-between text-xs text-slate-400 mb-2">
                                <span>{Math.floor(gamification.xp)} XP</span>
                                <span>{Math.floor(100 - gamification.progressToNextLevel)}% to next</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                                    style={{ width: `${gamification.progressToNextLevel}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Badge Showcase (Keep as is just simplified in this replacement block if needed, but trying to preserve) */}
                <Card className="md:col-span-2 flex flex-col">
                    <CardTitle>Achievements</CardTitle>
                    <div className="mt-4 flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                        {gamification.displayBadges.sort((a, b) => (a.isEarned === b.isEarned) ? 0 : a.isEarned ? -1 : 1).map((badge) => (
                            <div key={badge.id} className={clsx("flex-shrink-0 w-32 flex flex-col items-center p-3 rounded-xl border transition-all relative group",
                                badge.isEarned ? "bg-white border-slate-200 shadow-sm" : "bg-slate-50 border-slate-100 opacity-70"
                            )}>
                                <div className={clsx("w-12 h-12 rounded-full flex items-center justify-center mb-2 shadow-inner",
                                    badge.tier === 'bronze' && "bg-orange-100 text-orange-700",
                                    badge.tier === 'silver' && "bg-slate-200 text-slate-600",
                                    badge.tier === 'gold' && "bg-amber-100 text-amber-600",
                                    badge.tier === 'platinum' && "bg-cyan-100 text-cyan-600",
                                    badge.tier === 'diamond' && "bg-fuchsia-100 text-fuchsia-600",
                                )}>
                                    <badge.icon size={24} />
                                </div>
                                <p className="text-xs font-bold text-center text-slate-800 line-clamp-1 truncate w-full">{badge.name}</p>
                                <p className="text-[10px] text-center text-slate-500 mb-2 h-6 leading-tight line-clamp-2">{badge.description}</p>
                                {badge.isEarned ? (
                                    <span className={clsx("text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mt-auto",
                                        badge.tier === 'bronze' && "bg-orange-50 text-orange-700",
                                        badge.tier === 'silver' && "bg-slate-100 text-slate-600",
                                        badge.tier === 'gold' && "bg-amber-50 text-amber-700",
                                        badge.tier === 'platinum' && "bg-cyan-50 text-cyan-700",
                                        badge.tier === 'diamond' && "bg-fuchsia-50 text-fuchsia-700",
                                    )}>{badge.tier}</span>
                                ) : (
                                    <div className="w-full bg-slate-200 h-1 rounded-full mt-auto">
                                        <div className="bg-slate-400 h-1 rounded-full" style={{ width: `${Math.min(100, ((badge.progress || 0) / (badge.target || 1)) * 100)}%` }}></div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {gamification.displayBadges.length === 0 && <div className="text-slate-400 text-sm p-4">Start working out to earn badges!</div>}
                    </div>
                </Card>
            </div>

            {/* Summary Cards - UPDATED with GOAL Context */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">

                {/* 1. Weight */}
                <Card className="border-l-4 border-l-brand-primary bg-gradient-to-br from-white to-slate-50">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Weight</p>
                            <h3 className="text-3xl font-bold text-slate-800">{stats.latestWeight}<span className="text-sm font-normal text-slate-400 ml-1">kg</span></h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Goal: <span className="font-medium text-brand-primary">{goalWeight} kg</span>
                            </p>
                        </div>
                        <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                            <Scale size={20} />
                        </div>
                    </div>
                    <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-primary" style={{ width: `${Math.min(100, Math.max(0, ((95 - stats.latestWeight) / (95 - goalWeight)) * 100))}%` }} />
                    </div>
                </Card>

                {/* 2. Endurance (Run/Bike Combined View or Split?) -> Showing Combined Dist vs Target */}
                <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-white to-cyan-50/30">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Endurance ({activeTab})</p>
                            <div className="flex items-baseline gap-1">
                                <h3 className="text-3xl font-bold text-slate-800">{stats.cardioDist.toFixed(1)}</h3>
                                <span className="text-sm font-medium text-slate-400">/ {(stats.currentTargets.run + stats.currentTargets.bike).toFixed(1)} km</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{stats.cardioCals} kcal burned</p>
                        </div>
                        <div className="p-3 bg-cyan-100/50 text-cyan-600 rounded-xl">
                            <Bike size={20} />
                        </div>
                    </div>
                    <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${Math.min(100, (stats.cardioDist / (stats.currentTargets.run + stats.currentTargets.bike)) * 100)}%` }} />
                    </div>
                </Card>

                {/* 3. Training (Workouts) */}
                <Card className="border-l-4 border-l-rose-500 bg-gradient-to-br from-white to-rose-50/30">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Workouts ({activeTab})</p>
                            <div className="flex items-baseline gap-1">
                                <h3 className="text-3xl font-bold text-slate-800">{stats.workoutCount}</h3>
                                {activeTab !== 'Daily' && <span className="text-sm font-medium text-slate-400">/ {stats.currentTargets.workouts}</span>}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Strength Sessions</p>
                        </div>
                        <div className="p-3 bg-rose-100/50 text-rose-600 rounded-xl">
                            <Dumbbell size={20} />
                        </div>
                    </div>
                    {activeTab !== 'Daily' && (
                        <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${Math.min(100, (stats.workoutCount / stats.currentTargets.workouts) * 100)}%` }} />
                        </div>
                    )}
                </Card>

                {/* 4. Nutrition */}
                <Card className={clsx("border-l-4 bg-gradient-to-br from-white",
                    stats.avgFoodScore > 2.5 ? "border-l-green-500 to-green-50/30" :
                        stats.avgFoodScore > 1.5 ? "border-l-yellow-500 to-yellow-50/30" : "border-l-red-500 to-red-50/30"
                )}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Nutrition ({activeTab})</p>
                            <h3 className={clsx("text-3xl font-bold",
                                stats.avgFoodScore > 2.5 ? "text-green-600" :
                                    stats.avgFoodScore > 1.5 ? "text-yellow-600" : "text-red-600"
                            )}>
                                {stats.avgFoodScore > 2.5 ? "Great" : stats.avgFoodScore > 1.5 ? "Good" : "Fair"}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">Average Status</p>
                        </div>
                        <div className="p-3 bg-white/50 text-slate-600 rounded-xl shadow-sm">
                            <Apple size={20} />
                        </div>
                    </div>
                    <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={clsx("h-full transition-all duration-1000",
                            stats.avgFoodScore > 2.5 ? "bg-green-500" : stats.avgFoodScore > 1.5 ? "bg-yellow-500" : "bg-red-500"
                        )} style={{ width: `${(stats.avgFoodScore / 3) * 100}%` }} />
                    </div>
                </Card>
            </div>

            {/* Main Content Areas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Weight Trend Chart */}
                <Card className="lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <CardTitle>Weight Trend ({activeTab})</CardTitle>
                        <div className="flex gap-2">
                            <div className="text-right">
                                <span className="text-xs text-slate-400 block">Goal</span>
                                <span className="font-bold text-emerald-600">{goalWeight.toFixed(1)} kg</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weightChartData}>
                                <defs>
                                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#003A59" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#003A59" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={30} />
                                <YAxis domain={['dataMin - 1', 'dataMax + 1']} stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '8px' }} />
                                <Area type="monotone" dataKey="weight" stroke="#003A59" strokeWidth={3} fill="url(#colorWeight)" animationDuration={1000} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Activity Breakdown */}
                <div className="space-y-6">
                    <Card className="flex flex-col h-full">
                        <CardTitle>Activity Mix</CardTitle>
                        <div className="flex-1 min-h-[250px] relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={activityDistribution}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {activityDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <Activity className="text-slate-300 mb-1" size={24} />
                                <span className="text-xs text-slate-400">Distribution</span>
                            </div>
                        </div>
                        <div className="flex justify-center gap-4 mt-4 flex-wrap">
                            {activityDistribution.map(d => (
                                <div key={d.name} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                    <span className="text-xs text-slate-600">{d.name}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </Layout>
    );
}
