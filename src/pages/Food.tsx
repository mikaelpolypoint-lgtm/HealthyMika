import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';

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

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ status: FoodLog['status'], dateStr: string }>({ status: 'green', dateStr: '' });

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

    const startEditing = (log: FoodLog) => {
        setEditingId(log.id);
        setEditForm({
            status: log.status,
            dateStr: format(log.date.toDate(), "yyyy-MM-dd'T'HH:mm")
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            await updateDoc(doc(db, 'food_logs', editingId), {
                status: editForm.status,
                date: Timestamp.fromDate(new Date(editForm.dateStr))
            });
            setEditingId(null);
        } catch (e) {
            console.error(e);
            alert('Failed to update');
        }
    };

    const deleteLog = async (id: string) => {
        if (confirm('Delete this entry?')) {
            await deleteDoc(doc(db, 'food_logs', id));
        }
    };

    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Food Tracker</h2>
                <p className="text-slate-500">Keep your nutrition in check with the <span className="text-slate-900 font-medium">Ample System</span>.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="flex flex-col justify-center items-center py-12 h-fit">
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
                        {logs.map((log) => {
                            if (editingId === log.id) {
                                return (
                                    <div key={log.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <input type="datetime-local" value={editForm.dateStr} onChange={e => setEditForm({ ...editForm, dateStr: e.target.value })} className="p-2 border rounded text-sm w-full" />
                                            <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as any })} className="p-2 border rounded text-sm w-full">
                                                {Object.keys(statusConfig).map(s => (
                                                    <option key={s} value={s}>{statusConfig[s as keyof typeof statusConfig].label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-slate-500 hover:bg-slate-200 rounded text-sm">Cancel</button>
                                            <button onClick={saveEdit} className="px-3 py-1 bg-brand-primary text-white rounded text-sm">Save</button>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={log.id} className="group flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                    <div className={clsx("w-4 h-4 rounded-full flex-shrink-0", statusConfig[log.status].color)}></div>
                                    <div className="flex-grow">
                                        <p className="font-medium text-slate-800">{format(log.date.toDate(), 'EEEE, MMMM do')}</p>
                                        <p className="text-xs text-slate-500">{format(log.date.toDate(), 'h:mm a')}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={clsx("px-2 py-1 rounded text-xs font-bold uppercase", statusConfig[log.status].text, statusConfig[log.status].bg)}>
                                            {statusConfig[log.status].label}
                                        </span>
                                        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEditing(log)} className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-slate-50 rounded"><Pencil size={14} /></button>
                                            <button onClick={() => deleteLog(log.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {logs.length === 0 && <p className="text-slate-400 text-center">No logs yet.</p>}
                    </div>
                </Card>
            </div>
        </Layout>
    );
}
