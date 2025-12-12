import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Dumbbell, Save, History, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Workout {
    id: string;
    exercise: string;
    weight: number;
    reps: number;
    date: Timestamp;
}

export default function Training() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [exercise, setExercise] = useState('');
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [loading, setLoading] = useState(false);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Workout> & { dateStr: string }>({ dateStr: '' });

    useEffect(() => {
        const q = query(collection(db, 'workouts'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Workout[];
            setWorkouts(data);
        });

        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!exercise || !weight || !reps) return;

        setLoading(true);
        try {
            await addDoc(collection(db, 'workouts'), {
                exercise,
                weight: Number(weight),
                reps: Number(reps),
                date: Timestamp.now()
            });
            setExercise('');
            setWeight('');
            setReps('');
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Error saving workout");
        } finally {
            setLoading(false);
        }
    };

    const startEditing = (log: Workout) => {
        setEditingId(log.id);
        setEditForm({
            exercise: log.exercise,
            weight: log.weight,
            reps: log.reps,
            dateStr: format(log.date.toDate(), "yyyy-MM-dd'T'HH:mm")
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        try {
            await updateDoc(doc(db, 'workouts', editingId), {
                exercise: editForm.exercise,
                weight: Number(editForm.weight),
                reps: Number(editForm.reps),
                date: Timestamp.fromDate(new Date(editForm.dateStr))
            });
            setEditingId(null);
        } catch (e) {
            console.error(e);
            alert('Failed to update');
        }
    };

    const deleteLog = async (id: string) => {
        if (confirm('Delete this set?')) {
            await deleteDoc(doc(db, 'workouts', id));
        }
    };

    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Strength Training</h2>
                <p className="text-slate-500">Track your progress on the <span className="text-rose-600 font-medium">Hammer Autark 1500</span>.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="h-fit">
                    <CardTitle>Log Set</CardTitle>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <Dumbbell className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Exercise (e.g. Lat Pulldown)"
                                value={exercise}
                                onChange={(e) => setExercise(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="number"
                                placeholder="Weight (kg)"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                            <input
                                type="number"
                                placeholder="Reps"
                                value={reps}
                                onChange={(e) => setReps(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-rose-900/10 disabled:opacity-50"
                        >
                            <Save size={18} />
                            {loading ? 'Saving...' : 'Save Set'}
                        </button>
                    </form>
                </Card>

                {/* History List */}
                <Card className="lg:col-span-2">
                    <CardTitle>Recent Sets</CardTitle>
                    <div className="space-y-3 mt-4">
                        {workouts.map((workout) => {
                            if (editingId === workout.id) {
                                return (
                                    <div key={workout.id} className="bg-rose-50/50 p-4 rounded-xl space-y-3 border border-rose-200">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                            <input type="datetime-local" value={editForm.dateStr} onChange={e => setEditForm({ ...editForm, dateStr: e.target.value })} className="p-2 border rounded text-sm" />
                                            <input type="text" value={editForm.exercise} onChange={e => setEditForm({ ...editForm, exercise: e.target.value })} className="p-2 border rounded text-sm" placeholder="Exercise" />
                                            <input type="number" value={editForm.weight} onChange={e => setEditForm({ ...editForm, weight: Number(e.target.value) })} className="p-2 border rounded text-sm" placeholder="Kg" />
                                            <input type="number" value={editForm.reps} onChange={e => setEditForm({ ...editForm, reps: Number(e.target.value) })} className="p-2 border rounded text-sm" placeholder="Reps" />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingId(null)} className="px-3 py-1 text-slate-500 hover:bg-slate-200 rounded text-sm">Cancel</button>
                                            <button onClick={saveEdit} className="px-3 py-1 bg-rose-600 text-white rounded text-sm">Save</button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={workout.id} className="group bg-white p-4 rounded-xl flex justify-between items-center border border-slate-200 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
                                            <History size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-lg text-slate-800">{workout.exercise}</p>
                                            <p className="text-slate-500 text-sm">
                                                {format(workout.date.toDate(), 'MMM d, h:mm a')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <span className="text-2xl font-bold text-rose-500">{workout.weight}</span>
                                            <span className="text-slate-400 ml-1 text-sm">kg</span>
                                            <span className="mx-2 text-slate-300">x</span>
                                            <span className="text-2xl font-bold text-slate-800">{workout.reps}</span>
                                            <span className="text-slate-400 ml-1 text-sm">reps</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEditing(workout)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Pencil size={16} /></button>
                                            <button onClick={() => deleteLog(workout.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {workouts.length === 0 && (
                            <p className="text-slate-400 text-center py-8">No workouts logged yet. Start training!</p>
                        )}
                    </div>
                </Card>
            </div>
        </Layout>
    );
}
