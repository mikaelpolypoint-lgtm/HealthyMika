import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card } from "../components/Ui";
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { calculateBadges } from '../utils/gamification';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Trophy, Medal, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { startOfMonth, subMonths, format } from 'date-fns';

export default function Sport() {
    // --- State ---
    const [cardioLogs, setCardioLogs] = useState<any[]>([]);
    const [workoutLogs, setWorkoutLogs] = useState<any[]>([]);
    const [bodyweightLogs, setBodyweightLogs] = useState<any[]>([]);
    const [foodLogs, setFoodLogs] = useState<any[]>([]); // Needed for badges calculation (Clean Eater)

    // --- Fetch Data ---
    useEffect(() => {
        const unsubCardio = onSnapshot(collection(db, 'cardio_logs'), s => setCardioLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubWorkouts = onSnapshot(collection(db, 'workouts'), s => setWorkoutLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubBodyweight = onSnapshot(collection(db, 'bodyweight_logs'), s => setBodyweightLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubFood = onSnapshot(collection(db, 'day_food_logs'), s => setFoodLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => {
            unsubCardio();
            unsubWorkouts();
            unsubBodyweight();
            unsubFood();
        };
    }, []);

    // --- Gamification Calculations ---
    const gamification = useMemo(() => {

        // 1. Streak
        // Simplified streak logic: Check if ANY activity exists for recent days continuously
        const allDates = new Set([
            ...cardioLogs.map(l => format(l.date.toDate(), 'yyyy-MM-dd')),
            ...workoutLogs.map(l => format(l.date.toDate(), 'yyyy-MM-dd')),
            ...bodyweightLogs.map(l => format(l.date.toDate(), 'yyyy-MM-dd')),
        ]);

        let streak = 0;
        let d = new Date();
        // Check today/yesterday first
        const todayStr = format(d, 'yyyy-MM-dd');
        if (!allDates.has(todayStr)) {
            d.setDate(d.getDate() - 1);
        }

        while (allDates.has(format(d, 'yyyy-MM-dd'))) {
            streak++;
            d.setDate(d.getDate() - 1);
        }

        // 2. Totals
        const totalRunDist = cardioLogs.filter(l => l.equipment === 'Running').reduce((a, b) => a + (b.distance || 0), 0);
        const totalBikeDist = cardioLogs.filter(l => l.equipment !== 'Running').reduce((a, b) => a + (b.distance || 0), 0);
        // Let's create 'totalDist' as purely running + biking for badges
        const rawDist = totalRunDist + totalBikeDist;

        // Count approximate sessions by unique dates for strength
        const strengthSessions = new Set(workoutLogs.map(l => format(l.date.toDate(), 'yyyy-MM-dd'))).size;

        const totalBwReps = bodyweightLogs.reduce((a, b) => a + (Number(b.count) || 0), 0);

        const totalGreenFood = foodLogs.filter(l => l.eatWhenHungry && l.noAlcohol && l.noSodas).length;

        // Count specific time-based badges
        const earlyBird = workoutLogs.filter(l => {
            const h = l.date.toDate().getHours();
            return h >= 4 && h < 9;
        }).length;

        const nightOwl = workoutLogs.filter(l => {
            const h = l.date.toDate().getHours();
            return h >= 20 || h < 2;
        }).length;

        const weekend = workoutLogs.filter(l => {
            const day = l.date.toDate().getDay();
            return day === 0 || day === 6;
        }).length;

        // Level (Simple XP calculation)
        // 10 XP per workout session, 1 XP per km run, 0.3 XP per km bike, 0.1 XP per BW rep
        const xp = (strengthSessions * 10) + (totalRunDist * 2) + (totalBikeDist * 0.5) + (totalBwReps * 0.05);
        const level = Math.floor(Math.sqrt(xp));
        const nextLevelXp = Math.pow(level + 1, 2);
        const currentLevelBaseXp = Math.pow(level, 2);
        const levelProgress = ((xp - currentLevelBaseXp) / (nextLevelXp - currentLevelBaseXp)) * 100;

        const badges = calculateBadges({
            streak,
            totalDist: rawDist,
            totalWorkouts: strengthSessions, // Use sessions not sets
            totalGreenFood, // From food logs
            level,
            totalBwReps,
            earlyBirdCount: earlyBird,
            nightOwlCount: nightOwl,
            weekendCount: weekend,
            totalChaptersRead: 0, // Not needed for Sport view
        });

        return {
            level,
            xp,
            levelProgress,
            badges,
            stats: {
                run: totalRunDist,
                bike: totalBikeDist,
                strength: strengthSessions,
                bw: totalBwReps
            }
        };
    }, [cardioLogs, workoutLogs, bodyweightLogs, foodLogs]);

    // --- Chart Data ---
    const chartData = useMemo(() => {
        // Last 6 months activity mix
        const months = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = subMonths(today, i);
            months.push(d);
        }

        return months.map(d => {
            const mStart = startOfMonth(d);
            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0); // End of month

            const inMonth = (date: any) => {
                const logDate = date.toDate ? date.toDate() : new Date(date);
                return logDate >= mStart && logDate <= mEnd;
            };

            const runKm = cardioLogs.filter(l => l.equipment === 'Running' && inMonth(l.date)).reduce((a, b) => a + (b.distance || 0), 0);
            const bikeKm = cardioLogs.filter(l => l.equipment !== 'Running' && inMonth(l.date)).reduce((a, b) => a + (b.distance || 0), 0);
            const strengthSets = workoutLogs.filter(l => inMonth(l.date)).length; // Use sets for volume visualization
            const bwReps = bodyweightLogs.filter(l => inMonth(l.date)).reduce((a, b) => a + (b.count || 0), 0);

            return {
                name: format(d, 'MMM'),
                Run: Math.round(runKm),
                Bike: Math.round(bikeKm),
                Strength: strengthSets,
                // Normalize BW to be visible on chart (e.g. / 10)
                Bodyweight: Math.round(bwReps / 100)
            };
        });
    }, [cardioLogs, workoutLogs, bodyweightLogs]);

    const pieData = [
        { name: 'Running (km)', value: gamification.stats.run, color: '#0ea5e9' },
        { name: 'Cycling (km)', value: gamification.stats.bike, color: '#6366f1' },
        { name: 'Strength (sessions)', value: gamification.stats.strength * 5, color: '#f43f5e' }, // Weight higher for viz
        { name: 'Bodyweight (reps/100)', value: gamification.stats.bw / 100, color: '#10b981' },
    ];

    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Sport Analytics 🏃‍♂️</h2>
                <p className="text-slate-500">Your central hub for all physical activities and achievements.</p>
            </header>

            {/* GAMIFICATION HEADER */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Level Card */}
                <Card className="bg-slate-900 text-white border-slate-800 md:col-span-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Trophy size={150} />
                    </div>
                    <div className="relative z-10 flex items-center gap-6">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-900/50">
                            <span className="text-4xl font-black text-white">{gamification.level}</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold mb-1">Level {gamification.level} Athlete</h3>
                            <div className="flex justify-between text-xs text-slate-400 mb-2 font-mono">
                                <span>{Math.floor(gamification.xp)} XP</span>
                                <span>Next Level</span>
                            </div>
                            <div className="w-full bg-slate-700/50 rounded-full h-4 backdrop-blur-sm border border-slate-600">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${gamification.levelProgress}%` }}
                                >
                                    <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-30"></div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">Keep logging activities to gain XP and level up!</p>
                        </div>
                    </div>
                </Card>

                {/* Quick Stats */}
                <Card className="flex flex-col justify-center">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Activity size={18} /> All-Time Stats</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Running</span>
                            <span className="font-bold text-slate-800">{gamification.stats.run.toFixed(1)} km</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Cycling</span>
                            <span className="font-bold text-slate-800">{gamification.stats.bike.toFixed(1)} km</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Strength Sessions</span>
                            <span className="font-bold text-slate-800">{gamification.stats.strength}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Bodyweight Reps</span>
                            <span className="font-bold text-slate-800">{gamification.stats.bw}</span>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* Badges Section */}
                <div className="lg:col-span-2">
                    <h3 className="font-bold text-xl text-slate-800 mb-4 flex items-center gap-2"><Medal className="text-yellow-500" /> Recent Achievements</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {gamification.badges.slice(0, 8).map(badge => {
                            const Icon = badge.icon;
                            // Tier colors
                            const tierColors = {
                                bronze: 'bg-orange-100 text-orange-700 border-orange-200',
                                silver: 'bg-slate-100 text-slate-700 border-slate-300',
                                gold: 'bg-yellow-100 text-yellow-700 border-yellow-300',
                                platinum: 'bg-cyan-100 text-cyan-700 border-cyan-300',
                                diamond: 'bg-indigo-100 text-indigo-700 border-indigo-300',
                            };
                            const style = badge.isEarned
                                ? tierColors[badge.tier]
                                : 'bg-slate-50 text-slate-300 border-dashed border-slate-200';

                            return (
                                <div key={badge.id} className={clsx("p-3 rounded-xl border flex flex-col items-center text-center transition-all hover:scale-105", style)}>
                                    <Icon size={24} className={clsx("mb-2", !badge.isEarned && "opacity-50")} />
                                    <h4 className={clsx("text-xs font-bold mb-1", !badge.isEarned && "text-slate-400")}>{badge.name}</h4>
                                    <p className="text-[10px] opacity-80 leading-tight">{badge.description}</p>
                                    {!badge.isEarned && (
                                        <div className="w-full bg-black/5 h-1 rounded-full mt-2">
                                            <div className="bg-brand-primary h-full rounded-full" style={{ width: `${Math.min(100, ((badge.progress || 0) / (badge.target || 1)) * 100)}%` }}></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Activity Distribution */}
                <div>
                    <h3 className="font-bold text-xl text-slate-800 mb-4">Activity Mix</h3>
                    <Card className="h-[300px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </div>
            </div>

            {/* Performance Charts */}
            <h3 className="font-bold text-xl text-slate-800 mb-4">Monthly Volume Trends</h3>
            <Card className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
                        <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend />
                        <Bar dataKey="Run" stackId="a" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Bike" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Strength" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Bodyweight" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </Card>

        </Layout>
    );
}
