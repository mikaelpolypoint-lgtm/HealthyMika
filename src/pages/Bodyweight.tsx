import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';

interface BodyweightLog {
    id: string;
    type: 'Situps' | 'Pushups' | 'Planking';
    count: number; // reps or seconds
    date: Timestamp;
}

export default function Bodyweight() {
    const [logs, setLogs] = useState<BodyweightLog[]>([]);
    const [type, setType] = useState<'Situps' | 'Pushups' | 'Planking'>('Pushups');
    const [count, setCount] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'bodyweight_logs'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BodyweightLog[];
            setLogs(data);
        });
        return () => unsubscribe();
    }, []);

    const handleAddLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!count) return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'bodyweight_logs'), {
                type,
                count: Number(count),
                date: Timestamp.now()
            });
            setCount('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <header>
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Bodyweight Exercises</h2>
                <p className="text-slate-500">Master your body. Track your core strength.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card>
                    <CardTitle>Log Exercise</CardTitle>
                    <form onSubmit={handleAddLog} className="space-y-6">
                        <div className="grid grid-cols-3 gap-2">
                            {['Pushups', 'Situps', 'Planking'].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t as any)}
                                    className={clsx(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all",
                                        type === t ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                    )}
                                >
                                    <span className="text-sm font-medium">{t}</span>
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Activity className="absolute left-3 top-3 text-slate-400" size={20} />
                            <input
                                type="number"
                                value={count}
                                onChange={e => setCount(e.target.value)}
                                placeholder={type === 'Planking' ? "Time (seconds)" : "Reps"}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-indigo-900/10">
                            {loading ? 'Saving...' : 'Add Log'}
                        </button>
                    </form>
                </Card>

                <Card className="md:col-span-2">
                    <CardTitle>Recent Activity</CardTitle>
                    <div className="space-y-3 mt-4">
                        {logs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-full bg-slate-100 text-slate-500">
                                        <CheckCircle2 size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{log.type}</p>
                                        <p className="text-xs text-slate-500">{log.date.toDate().toLocaleDateString()} at {log.date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-bold text-indigo-600">{log.count}</span>
                                    <span className="text-sm text-slate-400 ml-1">{log.type === 'Planking' ? 's' : 'reps'}</span>
                                </div>
                            </div>
                        ))}
                        {logs.length === 0 && <p className="text-slate-400 text-center py-8">No logs yet.</p>}
                    </div>
                </Card>
            </div>
        </Layout>
    );
}
