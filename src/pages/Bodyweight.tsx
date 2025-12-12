import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Activity, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

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

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<BodyweightLog> & { dateStr: string }>({ dateStr: '' });

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

    const startEditing = (log: BodyweightLog) => {
        setEditingId(log.id);
        setEditForm({
            type: log.type,
            count: log.count,
            dateStr: format(log.date.toDate(), "yyyy-MM-dd'T'HH:mm")
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            await updateDoc(doc(db, 'bodyweight_logs', editingId), {
                type: editForm.type,
                count: Number(editForm.count),
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
            await deleteDoc(doc(db, 'bodyweight_logs', id));
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
                        {logs.map((log) => {
                            if (editingId === log.id) {
                                return (
                                    <div key={log.id} className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <input type="datetime-local" value={editForm.dateStr} onChange={e => setEditForm({ ...editForm, dateStr: e.target.value })} className="p-2 border rounded text-sm" />
                                            <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as any })} className="p-2 border rounded text-sm">
                                                {['Pushups', 'Situps', 'Planking'].map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <input type="number" value={editForm.count} onChange={e => setEditForm({ ...editForm, count: Number(e.target.value) })} className="p-2 border rounded text-sm" placeholder="Count" />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-slate-500 hover:bg-slate-200 rounded text-sm">Cancel</button>
                                            <button onClick={saveEdit} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Save</button>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={log.id} className="group flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-full bg-slate-100 text-slate-500">
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800">{log.type}</p>
                                            <p className="text-xs text-slate-500">{format(log.date.toDate(), 'MMM d, h:mm a')}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <span className="text-2xl font-bold text-indigo-600">{log.count}</span>
                                            <span className="text-sm text-slate-400 ml-1">{log.type === 'Planking' ? 's' : 'reps'}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEditing(log)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"><Pencil size={16} /></button>
                                            <button onClick={() => deleteLog(log.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {logs.length === 0 && <p className="text-slate-400 text-center py-8">No logs yet.</p>}
                    </div>
                </Card>
            </div>
        </Layout>
    );
}
