import { useState, useEffect, useMemo } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Dumbbell, Save, History, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';

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

    // Finnlo Autark 1500 Exercises
    const EXERCISE_CATALOG = [
        {
            id: 'chest-press',
            name: 'Bench Press',
            muscle: 'Chest',
            desc: 'Sit with back flat against pad. Push handles forward until arms are extended, then return slowly.',
            color: 'bg-red-100 text-red-600'
        },
        {
            id: 'butterfly',
            name: 'Butterfly',
            muscle: 'Chest',
            desc: 'Place forearms on pads. Push arms together in front of chest, squeezing pectorals.',
            color: 'bg-red-50 text-red-500'
        },
        {
            id: 'lat-pull',
            name: 'Lat Pulldown',
            muscle: 'Back',
            desc: 'Grip bar wide. Pull down to upper chest, squeezing shoulder blades together.',
            color: 'bg-blue-100 text-blue-600'
        },
        {
            id: 'rowing',
            name: 'Seated Row',
            muscle: 'Back',
            desc: 'Sit facing machine. Pull handles to waist while keeping back straight.',
            color: 'bg-blue-50 text-blue-500'
        },
        {
            id: 'shoulder-press',
            name: 'Shoulder Raise',
            muscle: 'Shoulders',
            desc: 'Using lower pulley, raise arm to side or front to shoulder height.',
            color: 'bg-orange-100 text-orange-600'
        },
        {
            id: 'tricep-push',
            name: 'Triceps Pushdown',
            muscle: 'Triceps',
            desc: 'Grip rope/bar at chest level. Push down until arms are fully extended.',
            color: 'bg-purple-100 text-purple-600'
        },
        {
            id: 'bicep-curl',
            name: 'Bicep Curl',
            muscle: 'Biceps',
            desc: 'Stand facing machine. Curl bar upwards towards chin, keeping elbows tucked.',
            color: 'bg-purple-50 text-purple-500'
        },
        {
            id: 'leg-ext',
            name: 'Leg Extension',
            muscle: 'Legs',
            desc: 'Place ankles behind lower pads. Extend legs until straight.',
            color: 'bg-emerald-100 text-emerald-600'
        },
        {
            id: 'leg-curl',
            name: 'Leg Curl',
            muscle: 'Legs',
            desc: 'Stand facing machine. Curl one leg back and up towards glutes.',
            color: 'bg-emerald-50 text-emerald-500'
        },
        {
            id: 'crunch',
            name: 'Ab Crunch',
            muscle: 'Abs',
            desc: 'Kneel facing machine holding rope behind neck. Crunch torso downwards.',
            color: 'bg-yellow-100 text-yellow-600'
        }
    ];

    const selectExercise = (ex: typeof EXERCISE_CATALOG[0]) => {
        setExercise(ex.name);
        // Optional: Pre-fill weight from PR or last history?
        // Let's just set focus or smooth scroll to form if needed
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };



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

    // PR Logic: Calculate max weight per exercise
    const prs = useMemo(() => {
        const records: Record<string, number> = {};
        workouts.forEach(w => {
            const name = w.exercise.trim(); // Normalize
            if (!records[name] || w.weight > records[name]) {
                records[name] = w.weight;
            }
        });
        return records;
    }, [workouts]);

    const [newPr, setNewPr] = useState<{ exercise: string, weight: number } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!exercise || !weight || !reps) return;

        // Check for PR
        const currentPr = prs[exercise.trim()] || 0;
        if (Number(weight) > currentPr) {
            setNewPr({ exercise: exercise, weight: Number(weight) });
            setTimeout(() => setNewPr(null), 5000); // Hide after 5s
        }

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

            {/* PR Celebration Banner */}
            {newPr && (
                <div className="mb-6 bg-yellow-400 text-yellow-900 p-4 rounded-xl shadow-lg animate-in slide-in-from-top flex items-center justify-between border-b-4 border-yellow-600">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🏆</span>
                        <div>
                            <h3 className="font-bold text-lg">NEW RECORD!</h3>
                            <p>You just crushed your {newPr.exercise} PR with <span className="font-bold">{newPr.weight}kg</span>!</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="flex flex-col gap-8">
                    <Card className="h-fit order-2 lg:order-1">
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

                    {/* Hall of Fame (PRs) */}
                    <Card className="h-fit bg-slate-900 text-white order-1 lg:order-2">
                        <CardTitle>
                            <div className="text-yellow-400 flex items-center gap-2">
                                <span>🏆</span> Hall of Fame
                            </div>
                        </CardTitle>
                        <p className="text-slate-400 text-xs mb-4">Your all-time heaviest lifts.</p>

                        <div className="space-y-3">
                            {Object.entries(prs)
                                .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
                                .slice(0, 5) // Top 5
                                .map(([name, weight]) => (
                                    <div key={name} className="flex justify-between items-center p-2 bg-slate-800 rounded border border-slate-700">
                                        <span className="font-medium text-slate-200">{name}</span>
                                        <span className="font-bold text-yellow-400 md:text-lg">{weight} <span className="text-xs text-slate-500 font-normal">kg</span></span>
                                    </div>
                                ))}
                            {Object.keys(prs).length === 0 && (
                                <p className="text-slate-600 text-center py-4">No records yet.</p>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Main Content Column */}
                <div className="lg:col-span-2 flex flex-col gap-8">
                    {/* Exercise Catalog */}
                    <Card className="h-fit">
                        <CardTitle>Exercise Catalog</CardTitle>
                        <p className="text-sm text-slate-500 mb-4">Select an exercise to log.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {EXERCISE_CATALOG.map(ex => (
                                <button
                                    key={ex.id}
                                    onClick={() => selectExercise(ex)}
                                    className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-brand-primary/30 hover:shadow-md transition-all text-left bg-white group"
                                >
                                    <div className={clsx("w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-lg font-bold", ex.color)}>
                                        {ex.name.substring(0, 2)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 group-hover:text-brand-primary transition-colors">{ex.name}</h4>
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{ex.desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </Card>

                    {/* History List */}
                    <Card>
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
            </div>

        </Layout>
    );
}
