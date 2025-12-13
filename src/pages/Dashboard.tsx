import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { Activity, Flame, Bike, Dumbbell, Apple, Scale, Calendar } from "lucide-react";
import { collection, query, orderBy, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isSameDay, isSameWeek, isSameMonth, format, subDays } from 'date-fns';
import { clsx } from 'clsx';

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
        let count = 0;

        // If today isn't logged, check if yesterday was to maintain streak
        if (!loggedDates.has(format(current, 'yyyy-MM-dd'))) {
            const yesterday = subDays(current, 1);
            if (!loggedDates.has(format(yesterday, 'yyyy-MM-dd'))) {
                return 0;
            }
            current = yesterday; // Start counting from yesterday
        }

        while (loggedDates.has(format(current, 'yyyy-MM-dd'))) {
            count++;
            current = subDays(current, 1);
        }
        return count;
    }, [weightLogs, cardioLogs, strengthLogs, bodyweightLogs, foodLogs]);

    // Aggregation Logic
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

        // Weight
        const latestWeight = weightLogs.length > 0 ? weightLogs[0].weight : 0;
        const avgWeight = filteredWeight.length > 0
            ? (filteredWeight.reduce((a, b) => a + b.weight, 0) / filteredWeight.length).toFixed(1)
            : latestWeight.toFixed(1);

        // Cardio
        const cardioDur = filteredCardio.reduce((a, b) => a + b.duration, 0);
        const cardioDist = filteredCardio.reduce((a, b) => a + b.distance, 0);
        const cardioCals = filteredCardio.reduce((a, b) => a + b.calories, 0);

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
            setsCount,
            totalVolume,
            bwCount,
            avgFoodScore,
            filteredWeight,
            filteredCardio,
            filteredFood,
            filteredStrength // Added this
        };
    }, [activeTab, weightLogs, cardioLogs, strengthLogs, bodyweightLogs, foodLogs]);

    // Chart Data Preparation
    const weightChartData = useMemo(() => {
        // Reverse for chart (oldest to newest)
        return [...(stats.filteredWeight.length > 0 ? stats.filteredWeight : weightLogs.slice(0, 30))]
            .reverse()
            .map(l => ({
                date: format(l.date.toDate(), activeTab === 'Daily' ? 'HH:mm' : 'MMM d'),
                weight: l.weight
            }));
    }, [stats.filteredWeight, weightLogs, activeTab]);

    const activityDistribution = [
        { name: 'Cardio', value: stats.cardioDur || 1, color: '#06b6d4' },
        { name: 'Strength', value: stats.setsCount * 3 || 1, color: '#f43f5e' }, // Approx 3 mins per set
        { name: 'Bodyweight', value: stats.bwCount * 2 || 1, color: '#8b5cf6' }, // Approx 2 mins per log
    ];

    const foodDistribution = useMemo(() => {
        const counts = { green: 0, yellow: 0, orange: 0, red: 0 };
        stats.filteredFood.forEach(l => {
            if (counts[l.status as keyof typeof counts] !== undefined) counts[l.status as keyof typeof counts]++;
        });
        return [
            { name: 'Great', value: counts.green, color: '#22c55e' },
            { name: 'Good', value: counts.yellow, color: '#eab308' },
            { name: 'Fair', value: counts.orange, color: '#f97316' },
            { name: 'Bad', value: counts.red, color: '#ef4444' },
        ].filter(x => x.value > 0);
    }, [stats.filteredFood]);

    // Gamification Logic
    const { xp, level, progressToNextLevel, earnedBadges, totalDist } = useMemo(() => {
        // 1. Calculate XP
        let totalXp = 0;

        // Weight: 50 XP per log
        totalXp += weightLogs.length * 50;

        // Cardio: 10 XP per km
        const totalDist = cardioLogs.reduce((acc, log) => acc + (log.distance || 0), 0);
        totalXp += Math.floor(totalDist * 10);

        // Strength: 5 XP per set
        const totalSets = strengthLogs.length; // Assuming 1 doc = 1 set for now based on previous structure, or simplify to doc count
        totalXp += strengthLogs.length * 20; // 20 XP per workout session log

        // Bodyweight: 1 XP per rep/sec
        const totalBwReps = bodyweightLogs.reduce((acc, log) => acc + (log.count || 0), 0);
        totalXp += totalBwReps;

        // Food: Green=50, Yellow=30, Orange=10, Red=5
        const foodXp = foodLogs.reduce((acc, log) => {
            if (log.status === 'green') return acc + 50;
            if (log.status === 'yellow') return acc + 30;
            if (log.status === 'orange') return acc + 10;
            return acc + 5;
        }, 0);
        totalXp += foodXp;

        // 2. Calculate Level
        // Level 1: 0-1000, Level 2: 1000-2000, etc.
        const currentLevel = Math.floor(totalXp / 1000) + 1;
        const xpForNextLevel = currentLevel * 1000;
        const currentLevelStart = (currentLevel - 1) * 1000;
        const progress = ((totalXp - currentLevelStart) / (1000)) * 100;

        // 3. Badges
        const badges = [
            { id: 'starter', name: 'Novice', desc: 'Logged your first activity', icon: '🌱', achieved: totalXp > 0 },
            { id: 'week-warrior', name: 'Week Warrior', desc: '7 Day Streak', icon: '⚔️', achieved: streak >= 7 },
            { id: 'marathoner', name: 'Marathoner', desc: 'Run 42km total', icon: '🏃', achieved: totalDist >= 42 },
            { id: 'ironborn', name: 'Ironborn', desc: '50 Strength Sessions', icon: '🦾', achieved: strengthLogs.length >= 50 },
            { id: 'clean-eater', name: 'Clean Eater', desc: '10 Great Meals', icon: '🥗', achieved: foodLogs.filter(l => l.status === 'green').length >= 10 },
            { id: 'master', name: 'Fitness Master', desc: 'Reach Level 10', icon: '👑', achieved: currentLevel >= 10 },
        ];

        return { xp: totalXp, level: currentLevel, progressToNextLevel: progress, earnedBadges: badges, totalDist };
    }, [weightLogs, cardioLogs, strengthLogs, bodyweightLogs, foodLogs, streak]);

    // Virtual Map Logic (Zurich -> Paris)
    const roadTrip = useMemo(() => {
        const totalKm = xp ? cardioLogs.reduce((acc, log) => acc + (log.distance || 0), 0) : 0;
        const milestones = [
            { name: 'Zurich', km: 0 },
            { name: 'Basel', km: 85 },
            { name: 'Mulhouse', km: 115 },
            { name: 'Dijon', km: 335 },
            { name: 'Paris', km: 600 } // Approx
        ];

        // Find current segment
        let nextCity = milestones[milestones.length - 1];
        let prevCity = milestones[0];

        for (let i = 0; i < milestones.length - 1; i++) {
            if (totalKm >= milestones[i].km && totalKm < milestones[i + 1].km) {
                prevCity = milestones[i];
                nextCity = milestones[i + 1];
                break;
            }
        }

        const segmentDist = nextCity.km - prevCity.km;
        const distInSegment = totalKm - prevCity.km;
        const percent = Math.min(100, Math.max(0, (distInSegment / segmentDist) * 100));

        return { totalKm, prevCity, nextCity, percent };
    }, [cardioLogs, xp]); // Re-calc when logs change

    // Daily Challenge Logic
    const dailyChallenge = useMemo(() => {
        const challenges = [
            { title: "Pushup Power", desc: "Do 30 pushups today", icon: <Activity size={20} /> },
            { title: "Step It Up", desc: "Walk 10,000 steps today", icon: <Bike size={20} /> }, // Using Bike as generic cardio icon
            { title: "Hydrate", desc: "Drink 2.5L of water", icon: <Flame size={20} /> },
            { title: "Core Crusher", desc: "Hold a plank for 2 mins", icon: <Dumbbell size={20} /> },
            { title: "Sugar Free", desc: "No sweets today!", icon: <Apple size={20} /> },
        ];
        // Simple seeded random based on date string
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const seed = todayStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return challenges[seed % challenges.length];
    }, []);


    return (
        <Layout>
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold text-brand-primary mb-1">Dashboard</h2>
                        {streak > 1 && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-600 border border-orange-200 rounded-full text-sm font-bold shadow-sm animate-pulse-slow">
                                <Flame size={16} className="fill-orange-500 text-orange-600" />
                                {streak} Day Streak!
                            </div>
                        )}
                        {streak === 1 && (
                            <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-sm font-medium">
                                <Activity size={16} />
                                Active Today
                            </div>
                        )}
                        <div className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full text-sm font-bold">
                            <span className="text-lg">Lvl {level}</span>
                        </div>
                    </div>
                    <p className="text-slate-500">Your health overview. <span className="font-medium text-emerald-600">Keep pushing!</span></p>
                </div>

                {/* Tab Switcher */}
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
                            {tab} Report
                        </button>
                    ))}
                </div>
            </header>

            {/* Level & Badges Row (New) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Level Card */}
                <div className="md:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white shadow-lg">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <p className="text-indigo-200 font-medium mb-1">Current Status</p>
                            <h3 className="text-3xl font-bold">Level {level}</h3>
                            <p className="text-sm text-indigo-100 mt-1">{Math.floor(xp)} XP Total</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold">{Math.floor(progressToNextLevel)}%</p>
                            <p className="text-xs text-indigo-200">to Level {level + 1}</p>
                        </div>
                    </div>
                    <div className="relative z-10 mt-4 h-3 w-full rounded-full bg-black/20">
                        <div
                            className="h-3 rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 shadow-[0_0_10px_rgba(251,191,36,0.6)] transition-all duration-1000 ease-out"
                            style={{ width: `${progressToNextLevel}%` }}
                        />
                    </div>
                    {/* Background decorations */}
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-indigo-900/40 blur-3xl" />
                </div>

                {/* Recent Badges */}
                <Card className="flex flex-col">
                    <CardTitle>Badges</CardTitle>
                    <div className="mt-4 grid grid-cols-4 gap-2">
                        {earnedBadges.map((badge) => (
                            <div key={badge.id} className={clsx("group relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all aspect-square",
                                badge.achieved ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100 opacity-50 grayscale"
                            )}>
                                <span className="text-2xl mb-1">{badge.icon}</span>
                                {badge.achieved && (
                                    <div className="absolute opacity-0 group-hover:opacity-100 -top-12 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs p-2 rounded w-32 text-center pointer-events-none transition-opacity z-20">
                                        <p className="font-bold">{badge.name}</p>
                                        <p className="font-normal opacity-80">{badge.desc}</p>
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Virtual Road Trip & Daily Challenge Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Map Card */}
                <Card>
                    <CardTitle>Virtual Road Trip (Zurich → Paris)</CardTitle>
                    <div className="mt-4">
                        <div className="flex justify-between items-center text-sm font-medium text-slate-700 mb-2">
                            <span>{roadTrip.prevCity.name}</span>
                            <span className="text-slate-400 text-xs">{(roadTrip.nextCity.km - roadTrip.prevCity.km).toFixed(0)} km segment</span>
                            <span>{roadTrip.nextCity.name}</span>
                        </div>
                        <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="absolute top-0 left-0 h-full bg-cyan-500 rounded-full transition-all duration-1000"
                                style={{ width: `${roadTrip.percent}%` }}
                            ></div>
                        </div>
                        <div className="mt-2 text-center">
                            <p className="text-xs text-slate-500">
                                Total Distance: <span className="font-bold text-slate-800">{roadTrip.totalKm.toFixed(1)} km</span>
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Daily Challenge Card */}
                <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                    <div className="flex items-start justify-between relative z-10">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded bg-white/20 text-xs font-bold uppercase tracking-wide">Daily Quest</span>
                            </div>
                            <h3 className="text-2xl font-bold mt-1">{dailyChallenge.title}</h3>
                            <p className="text-emerald-100 mt-1">{dailyChallenge.desc}</p>
                        </div>
                        <div className="p-3 bg-white/20 rounded-xl">
                            {dailyChallenge.icon}
                        </div>
                    </div>
                    <div className="mt-6 flex gap-3 relative z-10">
                        <button className="flex-1 bg-white text-emerald-600 font-bold py-2 rounded-lg text-sm hover:bg-emerald-50 transition-colors">
                            Accept Challenge
                        </button>
                    </div>
                    {/* Decor */}
                    <div className="absolute -right-6 -bottom-6 text-white/10">
                        <Activity size={120} />
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Cardio</p>
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
                        <div className="flex justify-center gap-4 mt-4">
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

            {/* Bottom Row: Food & Detailed Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardTitle>Nutrition Breakdown</CardTitle>
                    <div className="h-[200px] mt-4">
                        {foodDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={foodDistribution} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={50} tick={{ fontSize: 12 }} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                        {foodDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                No food logs for this period.
                            </div>
                        )}
                    </div>
                </Card>

                <Card>
                    <CardTitle>Highlights</CardTitle>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2 mb-2 text-slate-500">
                                <Bike size={16} />
                                <span className="text-xs font-bold uppercase">Max Dist</span>
                            </div>
                            <p className="text-xl font-bold text-slate-800">
                                {Math.max(...stats.filteredCardio.map(c => c.distance || 0), 0)} <span className="text-xs font-normal text-slate-400">km</span>
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2 mb-2 text-slate-500">
                                <Activity size={16} />
                                <span className="text-xs font-bold uppercase">Workouts</span>
                            </div>
                            <p className="text-xl font-bold text-slate-800">
                                {stats.setsCount} <span className="text-xs font-normal text-slate-400">Sets</span>
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2 mb-2 text-slate-500">
                                <Flame size={16} />
                                <span className="text-xs font-bold uppercase">Calories</span>
                            </div>
                            <p className="text-xl font-bold text-slate-800">
                                {stats.cardioCals} <span className="text-xs font-normal text-slate-400">kcal</span>
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2 mb-2 text-slate-500">
                                <Calendar size={16} />
                                <span className="text-xs font-bold uppercase">Days Active</span>
                            </div>
                            <p className="text-xl font-bold text-slate-800">
                                {new Set(stats.filteredCardio.concat(stats.filteredStrength).map(x => x.date.toDate().toDateString())).size}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </Layout>
    );
}
