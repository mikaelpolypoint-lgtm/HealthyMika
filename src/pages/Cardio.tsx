import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Bike, Timer, Zap, Flame, MapPin } from 'lucide-react';
import { clsx } from 'clsx';

interface CardioLog {
    id: string;
    equipment: 'Hammer Speed Race' | 'Canyon Ultimate CF 7';
    duration: number; // minutes
    distance: number; // km
    calories: number;
    power: number; // watts
    date: Timestamp;
}

export default function Cardio() {
    const [logs, setLogs] = useState<CardioLog[]>([]);
    const [equipment, setEquipment] = useState<'Hammer Speed Race' | 'Canyon Ultimate CF 7'>('Hammer Speed Race');
    const [duration, setDuration] = useState('');
    const [distance, setDistance] = useState('');
    const [calories, setCalories] = useState('');
    const [power, setPower] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'cardio_logs'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as CardioLog[];
            setLogs(data);
        });
        return () => unsubscribe();
    }, []);

    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addDoc(collection(db, 'cardio_logs'), {
                equipment,
                duration: Number(duration),
                distance: Number(distance),
                calories: Number(calories),
                power: Number(power),
                date: Timestamp.now()
            });
            setDuration('');
            setDistance('');
            setCalories('');
            setPower('');
        } finally {
            setLoading(false);
        }
    };

    const chartData = logs.slice(0, 7).reverse().map(log => ({
        date: log.date.toDate().toLocaleDateString(undefined, { weekday: 'short' }),
        distance: log.distance,
        power: log.power
    }));

    return (
        <Layout>
            <header>
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Cardio Training</h2>
                <p className="text-slate-500">Track your rides on the <span className="text-brand-accent font-medium">Hammer Speed Race</span> and <span className="text-purple-600 font-medium">Canyon Ultimate</span>.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Entry Form */}
                <Card className="lg:col-span-1 h-fit">
                    <CardTitle>Log Training</CardTitle>
                    <form onSubmit={handleAddLog} className="space-y-4">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <button
                                type="button"
                                onClick={() => setEquipment('Hammer Speed Race')}
                                className={clsx(
                                    "p-3 rounded-xl border text-sm font-medium transition-all",
                                    equipment === 'Hammer Speed Race' ? "bg-cyan-50 border-cyan-200 text-cyan-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                Hammer Speed Race
                            </button>
                            <button
                                type="button"
                                onClick={() => setEquipment('Canyon Ultimate CF 7')}
                                className={clsx(
                                    "p-3 rounded-xl border text-sm font-medium transition-all",
                                    equipment === 'Canyon Ultimate CF 7' ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                Canyon Ultimate
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="relative">
                                <Timer className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Duration (min)" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none" />
                            </div>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="Distance (km)" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none" />
                            </div>
                            <div className="relative">
                                <Flame className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="Calories (kcal)" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none" />
                            </div>
                            <div className="relative">
                                <Zap className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input type="number" value={power} onChange={e => setPower(e.target.value)} placeholder="Avg Power (Watts)" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none" />
                            </div>
                        </div>

                        <button disabled={loading} className="w-full mt-4 bg-brand-accent hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-cyan-900/10">
                            {loading ? 'Saving...' : 'Save Session'}
                        </button>
                    </form>
                </Card>

                {/* Charts & History */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardTitle>Performance Trends</CardTitle>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="left" orientation="left" stroke="#06b6d4" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#a855f7" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="distance" name="Distance (km)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                    <Bar yAxisId="right" dataKey="power" name="Power (W)" fill="#a855f7" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-700">Recent Sessions</h3>
                        {logs.map(log => (
                            <div key={log.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className={clsx("p-3 rounded-full", log.equipment.includes("Hammer") ? "bg-cyan-50 text-cyan-600" : "bg-purple-50 text-purple-600")}>
                                        <Bike size={20} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{log.equipment}</p>
                                        <p className="text-xs text-slate-500">{log.date.toDate().toLocaleDateString()} • {log.duration} min</p>
                                    </div>
                                </div>
                                <div className="flex gap-6 text-right">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{log.distance} km</p>
                                        <p className="text-xs text-slate-400">Dist</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{log.power} W</p>
                                        <p className="text-xs text-slate-400">Power</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{log.calories}</p>
                                        <p className="text-xs text-slate-400">Kcal</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
