import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { subDays, format } from 'date-fns';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { Scale, Apple, Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

// --- Interfaces ---
interface WeightLog {
    id: string;
    weight: number;
    date: Timestamp;
}

interface DailyFoodLog {
    date: string; // YYYY-MM-DD
    eatWhenHungry: boolean;
    caloriesColor: 'dark-red' | 'red' | 'orange' | 'yellow' | 'light-green' | 'dark-green';
    coffees: number;
    noAlcohol: boolean;
    noSodas: boolean;
}

const CALORIE_COLORS = {
    'dark-green': '#047857',
    'light-green': '#34d399',
    'yellow': '#facc15',
    'orange': '#fb923c',
    'red': '#ef4444',
    'dark-red': '#7f1d1d'
};

const COLOR_LABELS = {
    'dark-green': 'Excellent',
    'light-green': 'Good',
    'yellow': 'Okay',
    'orange': 'High',
    'red': 'Bad',
    'dark-red': 'Excessive'
};

export default function Health() {
    const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
    const [foodLogs, setFoodLogs] = useState<DailyFoodLog[]>([]);
    const [goalWeight, setGoalWeight] = useState(85); // Default, ideally fetch from goals

    // --- Fetch Data ---
    useEffect(() => {
        // Fetch Weight Logs (Last 90 days for trend)
        const qWeight = query(collection(db, 'weight_logs'), orderBy('date', 'desc'), limit(90));
        const unsubWeight = onSnapshot(qWeight, (snap) => {
            setWeightLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as WeightLog)).reverse()); // Reverse for chart (oldest first)
        });

        // Fetch Food Logs (Last 90 days)
        const qFood = query(collection(db, 'day_food_logs'), orderBy('date', 'desc'), limit(90));
        const unsubFood = onSnapshot(qFood, (snap) => {
            setFoodLogs(snap.docs.map(d => d.data() as DailyFoodLog));
        });

        // Fetch Goal Weight
        const unsubGoals = onSnapshot(collection(db, 'goals'), (snap) => {
            const goals = snap.docs.map(d => d.data());
            const weightGoal = goals.find(g => g.slug === 'weight');
            if (weightGoal) setGoalWeight(weightGoal.yearlyTarget);
        });

        return () => { unsubWeight(); unsubFood(); unsubGoals(); };
    }, []);

    // --- Analytics ---

    // Weight Stats
    const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : 0;
    const initialWeight = weightLogs.length > 0 ? weightLogs[0].weight : 0;
    const weightDiff = currentWeight - initialWeight;
    const distToGoal = currentWeight - goalWeight;

    // Diet Stats (Last 30 days)
    const recentFoodLogs = useMemo(() => {
        const thirtyDaysAgo = subDays(new Date(), 30);
        return foodLogs.filter(l => new Date(l.date) >= thirtyDaysAgo);
    }, [foodLogs]);

    const dietQuality = useMemo(() => {
        if (recentFoodLogs.length === 0) return { good: 0, bad: 0, score: 0 };
        const goodDays = recentFoodLogs.filter(l => ['dark-green', 'light-green', 'yellow'].includes(l.caloriesColor)).length;
        const score = Math.round((goodDays / recentFoodLogs.length) * 100);
        return { good: goodDays, total: recentFoodLogs.length, score };
    }, [recentFoodLogs]);

    const habitSuccess = useMemo(() => {
        if (recentFoodLogs.length === 0) return { alcohol: 0, soda: 0 };
        const alcoholFree = recentFoodLogs.filter(l => l.noAlcohol).length;
        const sodaFree = recentFoodLogs.filter(l => l.noSodas).length;
        return {
            alcohol: Math.round((alcoholFree / recentFoodLogs.length) * 100),
            soda: Math.round((sodaFree / recentFoodLogs.length) * 100)
        };
    }, [recentFoodLogs]);

    // Chart Data Preparation
    const weightChartData = useMemo(() => {
        return weightLogs.map(l => ({
            date: format(l.date.toDate(), 'MMM d'),
            weight: l.weight,
            goal: goalWeight
        }));
    }, [weightLogs, goalWeight]);

    const foodPieData = useMemo(() => {
        const counts: Record<string, number> = {};
        recentFoodLogs.forEach(l => {
            const c = l.caloriesColor;
            counts[c] = (counts[c] || 0) + 1;
        });
        return Object.entries(counts).map(([color, value]) => ({
            name: COLOR_LABELS[color as keyof typeof COLOR_LABELS],
            value,
            color: CALORIE_COLORS[color as keyof typeof CALORIE_COLORS]
        }));
    }, [recentFoodLogs]);

    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Health Overview ❤️</h2>
                <p className="text-slate-500">Holistic view of your nutrition and body metrics.</p>
            </header>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Weight Card */}
                <Card className="flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><Scale size={16} /> Current Weight</h3>
                            {weightDiff !== 0 && (
                                <span className={clsx("text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1", weightDiff < 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                                    {weightDiff < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                    {Math.abs(weightDiff).toFixed(1)} kg (90d)
                                </span>
                            )}
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-slate-800">{currentWeight}</span>
                            <span className="text-sm text-slate-400 font-bold">kg</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-2">
                            {distToGoal > 0 ? `${distToGoal.toFixed(1)} kg to go` : "Goal Reached!"}
                        </p>
                    </div>
                </Card>

                {/* Diet Quality Card */}
                <Card className="flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><Apple size={16} /> Diet Quality (30d)</h3>
                            <span className={clsx("text-xs font-bold px-2 py-1 rounded-full",
                                dietQuality.score >= 80 ? "bg-emerald-100 text-emerald-700" :
                                    dietQuality.score >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                            )}>{dietQuality.score}%</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-800">{dietQuality.good}</span>
                            <span className="text-sm text-slate-400">good days</span>
                            <span className="text-sm text-slate-300">/ {dietQuality.total}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full mt-4 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dietQuality.score}%` }} />
                        </div>
                    </div>
                </Card>

                {/* Habits Card */}
                <Card className="flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 mb-4"><Activity size={16} /> Habit Adherence (30d)</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-600">Alcohol Free</span>
                                    <span className="font-bold text-slate-800">{habitSuccess.alcohol}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${habitSuccess.alcohol}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-600">Soda Free</span>
                                    <span className="font-bold text-slate-800">{habitSuccess.soda}%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${habitSuccess.soda}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Weight Trend Chart */}
                <Card className="h-[400px]">
                    <CardTitle className="mb-4">Weight Trend</CardTitle>
                    <ResponsiveContainer width="100%" height="85%">
                        <LineChart data={weightChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                                minTickGap={30}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                            />
                            <RechartsTooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="weight"
                                stroke="#f43f5e"
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                            {/* Goal Line */}
                            <Line
                                type="monotone"
                                dataKey="goal"
                                stroke="#10b981"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </Card>

                {/* Nutrition Breakdown */}
                <Card className="h-[400px]">
                    <CardTitle className="mb-4">Nutrition Quality Distribution</CardTitle>
                    <div className="h-[85%] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={foodPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {foodPieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </Layout>
    );
}
