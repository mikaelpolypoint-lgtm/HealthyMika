import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { Activity, Flame, Bike, Dumbbell, Apple, Scale, Calendar, Zap } from "lucide-react";
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { isSameDay, isSameWeek, isSameMonth, format } from 'date-fns';
import { clsx } from 'clsx';

// Types
type Tab = 'Daily' | 'Weekly' | 'Monthly' | 'Overall';

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState<Tab>('Weekly');

    // Data States
    const [weightLogs, setWeightLogs] = useState<any[]>([]);
    const [cardioLogs, setCardioLogs] = useState<any[]>([]);
    const [strengthLogs, setStrengthLogs] = useState<any[]>([]);
    const [bodyweightLogs, setBodyweightLogs] = useState<any[]>([]);
    const [foodLogs, setFoodLogs] = useState<any[]>([]);

    useEffect(() => {
        const unsubWeight = onSnapshot(query(collection(db, 'weight_logs'), orderBy('date', 'desc')), s => setWeightLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubCardio = onSnapshot(query(collection(db, 'cardio_logs'), orderBy('date', 'desc')), s => setCardioLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubStrength = onSnapshot(query(collection(db, 'workouts'), orderBy('date', 'desc')), s => setStrengthLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubBodyweight = onSnapshot(query(collection(db, 'bodyweight_logs'), orderBy('date', 'desc')), s => setBodyweightLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubFood = onSnapshot(query(collection(db, 'food_logs'), orderBy('date', 'desc')), s => setFoodLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => { unsubWeight(); unsubCardio(); unsubStrength(); unsubBodyweight(); unsubFood(); };
    }, []);

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


    return (
        <Layout>
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-1">Dashboard</h2>
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
                                <span className="font-bold text-emerald-600">85.0 kg</span>
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
                                <Zap size={16} />
                                <span className="text-xs font-bold uppercase">Max Power</span>
                            </div>
                            <p className="text-xl font-bold text-slate-800">
                                {Math.max(...stats.filteredCardio.map(c => c.power || 0), 0)} <span className="text-xs font-normal text-slate-400">W</span>
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
