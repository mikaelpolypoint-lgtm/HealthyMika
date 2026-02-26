import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths, getISOWeek } from 'date-fns';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, ComposedChart, Bar, Tooltip
} from 'recharts';
import { Scale, Apple, Activity, TrendingDown, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
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

type TimeFilter = 'week' | 'month' | 'year';

export default function Health() {
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
    const [currentDate, setCurrentDate] = useState(new Date());

    const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
    const [foodLogs, setFoodLogs] = useState<DailyFoodLog[]>([]);
    const [goalWeight, setGoalWeight] = useState(85); // Default, ideally fetch from goals

    // --- Fetch Data ---
    useEffect(() => {
        // Fetch Weight Logs (Unlimited for full timeframe visibility)
        const qWeight = query(collection(db, 'weight_logs'), orderBy('date', 'desc'));
        const unsubWeight = onSnapshot(qWeight, (snap) => {
            setWeightLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as WeightLog)).reverse()); // Reverse for chart (oldest first)
        });

        // Fetch Food Logs
        const qFood = query(collection(db, 'day_food_logs'), orderBy('date', 'desc'));
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

    // --- Filters & Navigation ---
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
            return { start: START_OF_YEAR, end: new Date('2026-12-31') };
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


    // --- Analytics ---

    // Weight Stats
    // Weight Stats
    const filteredWeightLogs = useMemo(() => {
        return weightLogs.filter(l => {
            const d = l.date.toDate();
            return d >= dateRange.start && d <= dateRange.end;
        });
    }, [weightLogs, dateRange]);

    const currentWeight = filteredWeightLogs.length > 0 ? filteredWeightLogs[filteredWeightLogs.length - 1].weight : (weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : 0);
    const initialWeight = filteredWeightLogs.length > 0 ? filteredWeightLogs[0].weight : 0;
    const weightDiff = currentWeight - (initialWeight || currentWeight);
    const distToGoal = currentWeight - goalWeight;

    // Diet Stats (Filtered Range)
    const recentFoodLogs = useMemo(() => {
        return foodLogs.filter(l => {
            const d = new Date(l.date);
            return d >= dateRange.start && d <= dateRange.end;
        });
    }, [foodLogs, dateRange]);

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
        return filteredWeightLogs.map(l => ({
            date: format(l.date.toDate(), 'MMM d'),
            weight: l.weight,
            goal: goalWeight
        }));
    }, [filteredWeightLogs, goalWeight]);

    const correlationData = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];

        const combinedMap = new Map();
        const sortedWeights = [...weightLogs]; // Already fetched oldest first internally, wait: fetch is desc, then .reverse() is applied. So it's oldest first.

        let tempDate = new Date(dateRange.start);
        const endD = new Date(dateRange.end);
        const refToday = new Date();
        const capDate = endD > refToday ? refToday : endD;

        while (tempDate <= capDate) {
            const dStr = format(tempDate, 'yyyy-MM-dd');
            combinedMap.set(dStr, {
                date: dStr,
                displayDate: format(tempDate, 'MMM d'),
                weight: null,
                foodScore: 0,
                foodHex: '#f1f5f9',
                rawColor: 'none'
            });
            tempDate.setDate(tempDate.getDate() + 1);
        }

        let lastKnownWeight: number | null = null;
        const priorWeights = sortedWeights.filter(w => w.date.toDate() < dateRange.start);
        if (priorWeights.length > 0) {
            lastKnownWeight = priorWeights[priorWeights.length - 1].weight;
        }

        tempDate = new Date(dateRange.start);
        while (tempDate <= capDate) {
            const dStr = format(tempDate, 'yyyy-MM-dd');
            const mapItem = combinedMap.get(dStr);
            if (mapItem) {
                const logsForDay = sortedWeights.filter(w => format(w.date.toDate(), 'yyyy-MM-dd') === dStr);
                if (logsForDay.length > 0) {
                    lastKnownWeight = logsForDay[logsForDay.length - 1].weight;
                }
                mapItem.weight = lastKnownWeight;
            }
            tempDate.setDate(tempDate.getDate() + 1);
        }

        const colorScoreMap: Record<string, { score: number, hex: string }> = {
            'dark-green': { score: 5, hex: '#047857' },
            'light-green': { score: 4, hex: '#34d399' },
            'yellow': { score: 3, hex: '#facc15' },
            'orange': { score: 2, hex: '#fb923c' },
            'red': { score: 1, hex: '#ef4444' },
            'dark-red': { score: 0, hex: '#7f1d1d' },
        };

        recentFoodLogs.forEach(log => {
            const logDateStr = log.date;
            if (combinedMap.has(logDateStr)) {
                const mapItem = combinedMap.get(logDateStr);
                const colorData = colorScoreMap[log.caloriesColor];
                if (colorData) {
                    mapItem.foodScore = colorData.score;
                    mapItem.foodHex = colorData.hex;
                    mapItem.rawColor = log.caloriesColor;
                }
            }
        });

        return Array.from(combinedMap.values());
    }, [weightLogs, recentFoodLogs, dateRange]);

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
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-2">Health Overview ❤️</h2>
                    <p className="text-slate-500">Holistic view of your nutrition and body metrics.</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
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
                    {timeFilter !== 'year' && (
                        <div className="flex items-center gap-2 px-2">
                            <button onClick={handlePrev} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronLeft size={20} /></button>
                            <span className="text-sm font-bold text-slate-700 min-w-[140px] text-center">{periodLabel}</span>
                            <button onClick={handleNext} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronRight size={20} /></button>
                        </div>
                    )}
                </div>
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
                                    {Math.abs(weightDiff).toFixed(1)} kg ({timeFilter})
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
                            <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><Apple size={16} /> Diet Quality ({timeFilter})</h3>
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
                        <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 mb-4"><Activity size={16} /> Habit Adherence ({timeFilter})</h3>
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

            {/* --- CORRELATIONS --- */}
            <div className="mt-8">
                <Card className="p-4 md:p-6 overflow-hidden">
                    <div className="mb-6">
                        <h4 className="font-bold text-lg text-slate-800">Weight & Food Quality Correlation</h4>
                        <p className="text-sm text-slate-500">How your eating habits are impacting your weight trend over the selected period.</p>
                    </div>
                    <div className="h-[400px] w-full mt-4 -ml-4 pr-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={correlationData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="displayDate" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="weight" domain={['dataMin - 1', 'dataMax + 1']} stroke="#003A59" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} orientation="left" />
                                <YAxis yAxisId="food" hide={true} domain={[0, 6]} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                                    formatter={(value: any, name: any, props: any) => {
                                        if (name === "Weight") return [`${value} kg`, name];
                                        if (name === "Food Score") {
                                            const raw = props.payload.rawColor;
                                            return [raw && raw !== 'none' ? raw.replace('-', ' ') : 'No data', 'Food Quality'];
                                        }
                                        return [value, name];
                                    }}
                                />
                                <Legend iconType="circle" />
                                <Bar yAxisId="food" dataKey="foodScore" name="Food Score" radius={[4, 4, 0, 0]} barSize={16}>
                                    {correlationData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.foodHex} />
                                    ))}
                                </Bar>
                                <Line yAxisId="weight" type="monotone" dataKey="weight" name="Weight" stroke="#003A59" strokeWidth={3} dot={{ r: 4, fill: '#003A59', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex gap-4 mt-6 flex-wrap justify-center text-xs text-slate-500 font-medium">
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-700"></span> Excellent</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-400"></span> Good</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span> Okay</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400"></span> High</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Bad</div>
                    </div>
                </Card>
            </div>

        </Layout>
    );
}
