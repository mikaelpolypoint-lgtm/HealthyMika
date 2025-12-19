import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { Activity, Flame, Bike, Dumbbell, Apple, Scale, Calendar, ChevronRight, Lock, Crown, Footprints } from "lucide-react";
import { collection, query, orderBy, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isSameDay, isSameWeek, isSameMonth, format, subDays, getHours, isWeekend } from 'date-fns';
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

        return () => { unsubWeight(); unsubCardio(); unsubStrength(); unsubBodyweight(); unsubFood(); };
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
        const setsCount = filteredStrength.length;
        const totalVolume = filteredStrength.reduce((a, b) => a + (b.weight * b.reps), 0);

        // Bodyweight
        const bwCount = filteredBodyweight.length;

        // Food
        const foodScoreMap = { green: 3, yellow: 2, orange: 1, red: 0 };
        const avgFoodScore = filteredFood.length > 0
            ? filteredFood.reduce((a, b) => a + (foodScoreMap[b.status as keyof typeof foodScoreMap] || 0), 0) / filteredFood.length
            : 0;

        return {
            avgWeight,
            cardioDur,
            cardioDist,
            cardioCals,
            cyclingDur,
            cyclingDist,
            runningDur,
            runningDist,
            setsCount,
            totalVolume,
            bwCount,
            avgFoodScore,
            filteredWeight,
            filteredCardio,
            filteredFood,
            filteredStrength
        };
    }, [activeTab, weightLogs, cardioLogs, strengthLogs, bodyweightLogs, foodLogs]);

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

        const level = Math.floor(totalXp / 1000) + 1;
        const currentLevelStart = (level - 1) * 1000;
        const progressToNextLevel = ((totalXp - currentLevelStart) / (1000)) * 100;

        // 2. Calculate Stats for Badges
        const totalWorkouts = strengthLogs.length;
        const totalGreenFood = foodLogs.filter(l => l.status === 'green').length;

        // Time based stats
        let earlyBird = 0;
        let nightOwl = 0;
        let weekend = 0;

        const processTime = (d: Date) => {
            const h = getHours(d);
            if (h >= 4 && h < 9) earlyBird++;
            if (h >= 20 || h < 2) nightOwl++;
            if (isWeekend(d)) weekend++;
        };

        // Gather all dates
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
            weekendCount: weekend
        });

        // Group Badges by ID to show only relevant ones (Highest Earned + Next Target)
        const badgeGroups: Record<string, { earned: BadgeDef | null; next: BadgeDef | null }> = {};

        badgeList.forEach(b => {
            if (!badgeGroups[b.groupId]) badgeGroups[b.groupId] = { earned: null, next: null };

            if (b.isEarned) {
                const current = badgeGroups[b.groupId].earned;
                // Assuming list sorted by difficulty (or we just check target value)
                if (!current || (b.target || 0) > (current.target || 0)) {
                    badgeGroups[b.groupId].earned = b;
                }
            } else {
                const currentNext = badgeGroups[b.groupId].next;
                if (!currentNext || (b.target || 0) < (currentNext.target || 0)) {
                    badgeGroups[b.groupId].next = b;
                }
            }
        });

        const displayBadges = Object.values(badgeGroups).map(g => g.earned || g.next).filter(Boolean) as BadgeDef[];

        return { xp: totalXp, level, progressToNextLevel, badgeList, displayBadges };
    }, [weightLogs, cardioLogs, strengthLogs, bodyweightLogs, foodLogs, streak]);

    // Chart Data
    const weightChartData = useMemo(() => {
        return [...(stats.filteredWeight.length > 0 ? stats.filteredWeight : weightLogs.slice(0, 30))]
            .reverse()
            .map(l => ({
                date: format(l.date.toDate(), activeTab === 'Daily' ? 'HH:mm' : 'MMM d'),
                weight: l.weight
            }));
    }, [stats.filteredWeight, weightLogs, activeTab]);

    const activityDistribution = [
        { name: 'Cycling', value: stats.cyclingDur || 1, color: '#06b6d4' },
        { name: 'Running', value: stats.runningDur || 1, color: '#f97316' },
        { name: 'Strength', value: stats.setsCount * 3 || 1, color: '#f43f5e' },
        { name: 'Bodyweight', value: stats.bwCount * 2 || 1, color: '#8b5cf6' },
    ];

    return (
        <Layout>
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-1">Dashboard</h2>
                    <p className="text-slate-500">Your results. <span className="font-medium text-emerald-600">Level {gamification.level} Athlete</span></p>
                </div>

                <div className="bg-white p-1 rounded-xl border border-slate-200 flex shadow-sm">
                    {(['Daily', 'Weekly', 'Monthly', 'Overall'] as Tab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                                activeTab === tab ? "bg-brand-primary text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </header>

            {/* Level & Badges Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Level Card */}
                <div className="md:col-span-1 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg">
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
                                <span>Next Lvl: {Math.floor(100 - gamification.progressToNextLevel)}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                                    style={{ width: `${gamification.progressToNextLevel}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    {/* Background decorations */}
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
                    <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
                </div>

                {/* Badge Showcase */}
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
                        {gamification.displayBadges.length === 0 && (
                            <div className="w-full text-center py-4 text-slate-400 text-sm">Start logging to earn badges!</div>
                        )}
                        <div className="flex-shrink-0 w-8 flex items-center justify-center"></div>
                    </div>
                </Card>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <Card className="border-l-4 border-l-brand-primary bg-gradient-to-br from-white to-slate-50">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Weight</p>
                            <h3 className="text-3xl font-bold text-slate-800">{stats.avgWeight}<span className="text-sm font-normal text-slate-400 ml-1">kg</span></h3>
                            <p className="text-xs text-slate-500 mt-1">{activeTab} Avg.</p>
                        </div>
                        <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                            <Scale size={20} />
                        </div>
                    </div>
                </Card>

                <Card className="border-l-4 border-l-cyan-500 bg-gradient-to-br from-white to-cyan-50/30">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Endurance</p>
                            <h3 className="text-3xl font-bold text-slate-800">{stats.cardioDist.toFixed(1)}<span className="text-sm font-normal text-slate-400 ml-1">km</span></h3>
                            <p className="text-xs text-slate-500 mt-1">{stats.cardioCals} kcal burned</p>
                        </div>
                        <div className="p-3 bg-cyan-100/50 text-cyan-600 rounded-xl">
                            <Bike size={20} />
                        </div>
                    </div>
                </Card>

                <Card className="border-l-4 border-l-rose-500 bg-gradient-to-br from-white to-rose-50/30">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Training</p>
                            <h3 className="text-3xl font-bold text-slate-800">{stats.setsCount + stats.bwCount}</h3>
                            <p className="text-xs text-slate-500 mt-1">Sets & Exercises</p>
                        </div>
                        <div className="p-3 bg-rose-100/50 text-rose-600 rounded-xl">
                            <Dumbbell size={20} />
                        </div>
                    </div>
                </Card>

                <Card className={clsx("border-l-4 bg-gradient-to-br from-white",
                    stats.avgFoodScore > 2.5 ? "border-l-green-500 to-green-50/30" :
                        stats.avgFoodScore > 1.5 ? "border-l-yellow-500 to-yellow-50/30" : "border-l-red-500 to-red-50/30"
                )}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Nutrition</p>
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
