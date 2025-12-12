import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx } from 'clsx';
import { format } from 'date-fns';

interface FoodLog {
    id: string;
    status: 'green' | 'yellow' | 'orange' | 'red';
    date: Timestamp;
}

const statusConfig = {
    green: { label: 'Great', color: 'bg-green-500', hover: 'hover:bg-green-600', shadow: 'shadow-green-200', text: 'text-green-700', bg: 'bg-green-50' },
    yellow: { label: 'Good', color: 'bg-yellow-500', hover: 'hover:bg-yellow-600', shadow: 'shadow-yellow-200', text: 'text-yellow-700', bg: 'bg-yellow-50' },
    orange: { label: 'Fair', color: 'bg-orange-500', hover: 'hover:bg-orange-600', shadow: 'shadow-orange-200', text: 'text-orange-700', bg: 'bg-orange-50' },
    red: { label: 'Bad', color: 'bg-red-500', hover: 'hover:bg-red-600', shadow: 'shadow-red-200', text: 'text-red-700', bg: 'bg-red-50' },
};

export default function Food() {
    const [logs, setLogs] = useState<FoodLog[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'food_logs'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as FoodLog[];
            setLogs(data);
        });
        return () => unsubscribe();
    }, []);

    const handleLog = async (status: 'green' | 'yellow' | 'orange' | 'red') => {
        setLoading(true);
        try {
            await addDoc(collection(db, 'food_logs'), {
                status,
                date: Timestamp.now()
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Food Tracker</h2>
                <p className="text-slate-500">Keep your nutrition in check with the <span className="text-slate-900 font-medium">Ample System</span>.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="flex flex-col justify-center items-center py-12">
                    <CardTitle>How did you eat today?</CardTitle>
                    <div className="grid grid-cols-2 gap-6 mt-8">
                        {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((status) => (
                            <button
                                key={status}
                                disabled={loading}
                                onClick={() => handleLog(status)}
                                className={clsx(
                                    "w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50",
                                    statusConfig[status].color,
                                    statusConfig[status].hover,
                                    "shadow-xl",
                                    statusConfig[status].shadow
                                )}
                            >
                                <span className="text-2xl font-bold text-white drop-shadow-md">{statusConfig[status].label}</span>
                            </button>
                        ))}
                    </div>
                </Card>

                <Card>
                    <CardTitle>History</CardTitle>
                    <div className="space-y-3 mt-6">
                        {logs.map((log) => (
                            <div key={log.id} className="flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-100 shadow-sm">
                                <div className={clsx("w-4 h-4 rounded-full", statusConfig[log.status].color)}></div>
                                <div>
                                    <p className="font-medium text-slate-800">{format(log.date.toDate(), 'EEEE, MMMM do')}</p>
                                    <p className="text-xs text-slate-500">{format(log.date.toDate(), 'h:mm a')}</p>
                                </div>
                                <div className="ml-auto">
                                    <span className={clsx("px-2 py-1 rounded text-xs font-bold uppercase", statusConfig[log.status].text, statusConfig[log.status].bg)}>
                                        {statusConfig[log.status].label}
                                    </span>
                                </div>
                            </div>
                        ))}
                        {logs.length === 0 && <p className="text-slate-400 text-center">No logs yet.</p>}
                    </div>
                </Card>
            </div>
        </Layout>
    );
}
