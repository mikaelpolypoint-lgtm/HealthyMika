import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Flame, TrendingDown, Bike } from "lucide-react";

// Mock Data
const weightData = [
    { date: 'Mon', weight: 91.0 },
    { date: 'Tue', weight: 90.8 },
    { date: 'Wed', weight: 90.5 },
    { date: 'Thu', weight: 90.6 },
    { date: 'Fri', weight: 90.2 },
    { date: 'Sat', weight: 90.0 },
    { date: 'Sun', weight: 89.8 },
];

export default function Dashboard() {
    return (
        <Layout>
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-2">Dashboard</h2>
                    <p className="text-slate-500">Welcome back! You are on track to reach 85kg.</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-slate-500">Current Weight</p>
                    <p className="text-4xl font-bold text-brand-accent">89.8 <span className="text-lg text-slate-400 font-medium">kg</span></p>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-l-4 border-l-brand-primary">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-slate-500 text-sm mb-1">Calories Today</p>
                            <h4 className="text-2xl font-bold text-slate-800">2,100</h4>
                        </div>
                        <div className="p-3 bg-brand-primary/10 rounded-lg text-brand-primary">
                            <Flame size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <span className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-primary w-[70%]" />
                        </span>
                    </div>
                </Card>

                <Card className="border-l-4 border-l-emerald-500">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-slate-500 text-sm mb-1">Weight Loss</p>
                            <h4 className="text-2xl font-bold text-slate-800">-1.2 kg</h4>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-600">
                            <TrendingDown size={24} />
                        </div>
                    </div>
                    <p className="text-sm text-emerald-600 font-medium mt-4">4.8kg to goal</p>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-slate-500 text-sm mb-1">Active Time</p>
                            <h4 className="text-2xl font-bold text-slate-800">1h 20m</h4>
                        </div>
                        <div className="p-3 bg-orange-500/10 rounded-lg text-orange-600">
                            <Activity size={24} />
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 mt-4">Running & Cycling</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart */}
                <Card className="lg:col-span-2">
                    <CardTitle>Weight Trend</CardTitle>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weightData}>
                                <defs>
                                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#078091" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#078091" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ color: '#078091' }}
                                />
                                <Area type="monotone" dataKey="weight" stroke="#078091" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Side Panel / Food Status */}
                <div className="space-y-6">
                    <Card>
                        <CardTitle>Food Status</CardTitle>
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50 border border-green-100">
                                <div className="w-4 h-4 rounded-full bg-green-500 shadow-sm"></div>
                                <div>
                                    <p className="font-medium text-slate-800">Today</p>
                                    <p className="text-xs text-slate-500">Eating clean</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 opacity-60">
                                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                                <div>
                                    <p className="font-medium text-slate-800">Yesterday</p>
                                    <p className="text-xs text-slate-500">Moderate</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <CardTitle>Recent Training</CardTitle>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
                                        <Bike size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">Canyon Ride</p>
                                        <p className="text-xs text-slate-500">25 km • 180W</p>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400">2h ago</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </Layout>
    );
}
