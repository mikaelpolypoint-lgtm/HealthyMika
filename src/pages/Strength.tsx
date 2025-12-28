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

interface PlannedWorkout {
    id: string;
    order: number;
    week: number;
    day: number;
    completed: boolean;
    date?: Timestamp; // Completed date
    exercises: {
        id: string;
        name: string;
        sets: number;
        reps: number;
        weight: number;
    }[];
}

export default function Training() {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [exercise, setExercise] = useState('');
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [loading, setLoading] = useState(false);

    // Finnlo Autark 1500 Exercises (Selected)
    const EXERCISE_CATALOG = [
        {
            id: 'bench-press',
            name: 'Vertical Fixed Bench Press',
            muscle: 'Chest',
            desc: 'Elbows bent at chest level, push forward not locking out.',
            color: 'bg-red-100 text-red-600'
        },
        {
            id: 'bicep-curl-stand',
            name: 'Standing Biceps Curls',
            muscle: 'Arms',
            desc: 'Stable stance, bend arms upwards keeping elbows fixed.',
            color: 'bg-purple-100 text-purple-600'
        },
        {
            id: 'lat-pull',
            name: 'Lat Pull Down',
            muscle: 'Back',
            desc: 'Pull bar slowly down to chest level.',
            color: 'bg-blue-100 text-blue-600'
        },
        {
            id: 'crunch',
            name: 'Abdominal Crunch',
            muscle: 'Abs',
            desc: 'Rope at neck, crunch upper body downwards.',
            color: 'bg-yellow-100 text-yellow-600'
        },
        {
            id: 'leg-ext',
            name: 'Leg Extension',
            muscle: 'Legs',
            desc: 'Stretch legs upwards from knee joints.',
            color: 'bg-emerald-100 text-emerald-600'
        }
    ];

    const selectExercise = (ex: typeof EXERCISE_CATALOG[0]) => {
        setExercise(ex.name);
        // Scroll to manual form if open, else maybe open it
        const form = document.getElementById('manual-log-form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
    };

    // --- Program Logic ---
    const [plan, setPlan] = useState<PlannedWorkout[]>([]);
    const [nextWorkout, setNextWorkout] = useState<PlannedWorkout | null>(null);
    const [generating, setGenerating] = useState(false);

    // Fetch Plan
    useEffect(() => {
        const q = query(collection(db, 'training_plan'), orderBy('order', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PlannedWorkout[];
            setPlan(data);
            const next = data.find(w => !w.completed);
            setNextWorkout(next || null);
        });
        return () => unsub();
    }, []);

    const generateYearlyPlan = async () => {
        if (!confirm('Generate a new yearly plan? This will create 156 planned workouts.')) return;
        setGenerating(true);
        try {
            const batchPromises = [];

            // Starting Config
            const config = {
                'bench-press': { weight: 35, sets: 2 },
                'bicep-curl-stand': { weight: 15, sets: 1 },
                'lat-pull': { weight: 25, sets: 2 },
                'crunch': { weight: 20, sets: 1 },
                'leg-ext': { weight: 40, sets: 1 }
            };

            const weeks = 52;
            const daysPerWeek = 3;
            let orderCounter = 1;

            // Progression: 4 week cycle. 
            // W1: 2x8-10, W2: 2x10-12, W3: 2x12-14, W4: 2x14-15 (Fail? Ok).
            // W5: +5kg, Reset to 2x8.

            // Simpler Linear: Increase reps target every week (3 sessions).
            // Cycle: 8, 10, 12, 14 reps. Then Weight pump.


            let weekOfCycle = 1; // 1-4

            for (let w = 1; w <= weeks; w++) {

                // Determine Reps & Weights for this week
                let repTarget = 8;
                if (weekOfCycle === 1) repTarget = 8;
                if (weekOfCycle === 2) repTarget = 10;
                if (weekOfCycle === 3) repTarget = 12;
                if (weekOfCycle === 4) repTarget = 14;

                for (let d = 1; d <= daysPerWeek; d++) {
                    const workoutExercises = EXERCISE_CATALOG.map(ex => {
                        const conf = config[ex.id as keyof typeof config];
                        return {
                            id: ex.id,
                            name: ex.name,
                            sets: conf.sets,
                            reps: repTarget,
                            weight: conf.weight
                        };
                    });

                    // Add doc
                    // Note: Use addDoc or setDoc with explicit ID. 
                    // Let's use setDoc with an ordered ID to make sorting easy/reliable if needed, or just let Firestore handle it and sort by 'order'.
                    // We'll create promises.
                    batchPromises.push(
                        addDoc(collection(db, 'training_plan'), {
                            order: orderCounter,
                            week: w,
                            day: d,
                            completed: false,
                            exercises: workoutExercises
                        })
                    );
                    orderCounter++;
                }

                // Progression for next week
                weekOfCycle++;
                if (weekOfCycle > 4) {
                    weekOfCycle = 1;
                    // Increase Weights
                    (Object.keys(config) as Array<keyof typeof config>).forEach(key => {
                        if (config[key].weight < 80) {
                            config[key].weight += 5;
                        }
                    });
                }
            }

            await Promise.all(batchPromises); // Might hit limits if 150 items. Firestore handles parallel requests well usually.
            // If it fails, we might need chunks. 156 requests is okay-ish.
        } catch (e) {
            console.error(e);
            alert('Error generating plan');
        } finally {
            setGenerating(false);
        }
    };

    // Execution State
    const [executing, setExecuting] = useState(false);
    const [executionData, setExecutionData] = useState<any[]>([]); // Copy of nextWorkout.exercises but mutable

    const startExecution = () => {
        if (!nextWorkout) return;
        setExecutionData(nextWorkout.exercises.map(e => ({ ...e, actualWeight: e.weight, actualReps: e.reps })));
        setExecuting(true);
    };

    const finishWorkout = async () => {
        if (!nextWorkout) return;
        setLoading(true);
        try {
            // 1. Log all exercises to 'workouts' collection
            const logPromises = executionData.map(e => {
                // We need to log X sets. The user input 'actualReps'/'actualWeight' applies to ALL sets for simplicity?
                // Or we iterate sets.
                // Request said "5-7 sets overall". 
                // e.sets is 1 or 2.
                const logs = [];
                for (let i = 0; i < e.sets; i++) {
                    logs.push(addDoc(collection(db, 'workouts'), {
                        exercise: e.name,
                        weight: Number(e.actualWeight),
                        reps: Number(e.actualReps),
                        date: Timestamp.now()
                    }));
                }
                return Promise.all(logs);
            });
            await Promise.all(logPromises);

            // 2. Mark plan as completed
            await updateDoc(doc(db, 'training_plan', nextWorkout.id), {
                completed: true,
                date: Timestamp.now()
            });

            setExecuting(false);
            setNextWorkout(null); // Will update via snapshot

            // Check for PRs (Simple check against session max)
            // ... (PR Logic existing handles PRs based on 'workouts' update which triggers snapshot... actually PR logic is local state 'prs' memoized on 'workouts'.
            // To show the banner immediately, we might need to manually check, but the 'workouts' snapshot will update and 'prs' will update.)

        } catch (e) {
            console.error(e);
            alert('Failed to save workout');
        } finally {
            setLoading(false);
        }
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
                    {/* Next Workout Card */}
                    <Card className="h-fit order-1 lg:order-1 border-l-4 border-l-rose-500">
                        <CardTitle className="flex justify-between items-center">
                            <span>Next Workout</span>
                            {plan.length === 0 && (
                                <button
                                    onClick={generateYearlyPlan}
                                    disabled={generating}
                                    className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-full text-slate-600 transition"
                                >
                                    {generating ? 'Generating...' : 'Create Yearly Plan'}
                                </button>
                            )}
                        </CardTitle>

                        {!nextWorkout && plan.length > 0 && (
                            <div className="py-8 text-center text-slate-500">
                                <p>All planned workouts completed! You are a beast! 🦁</p>
                            </div>
                        )}

                        {nextWorkout && !executing && (
                            <div className="mt-4">
                                <div className="flex justify-between items-baseline mb-4">
                                    <h4 className="text-xl font-bold text-slate-800">Week {nextWorkout.week} <span className="text-sm font-normal text-slate-400">/ Day {nextWorkout.day}</span></h4>
                                    <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded">
                                        {nextWorkout.exercises.reduce((a, b) => a + b.sets, 0)} Sets Total
                                    </span>
                                </div>

                                <div className="space-y-3 mb-6">
                                    {nextWorkout.exercises.map((ex, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                            <div>
                                                <p className="font-bold text-slate-700">{ex.name}</p>
                                                <p className="text-xs text-slate-400">{ex.sets} set{ex.sets > 1 ? 's' : ''}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-slate-800">{ex.weight}kg</span>
                                                <span className="text-xs text-slate-400 mx-2">x</span>
                                                <span className="font-bold text-slate-800">{ex.reps}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={startExecution}
                                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-rose-900/20 transition-all flex justify-center items-center gap-2"
                                >
                                    <Dumbbell size={20} />
                                    Start Workout
                                </button>
                            </div>
                        )}

                        {executing && (
                            <div className="mt-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                <p className="text-sm text-slate-500">Confirm your lifts. Adjust if you changed weight/reps.</p>

                                <div className="space-y-4">
                                    {executionData.map((ex, idx) => (
                                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold text-slate-700">{ex.name}</span>
                                                <span className="text-xs text-slate-400 font-bold uppercase">{ex.sets} Set{ex.sets > 1 ? 's' : ''}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1">Weight (kg)</label>
                                                    <input
                                                        type="number"
                                                        value={ex.actualWeight}
                                                        onChange={(e) => {
                                                            const newData = [...executionData];
                                                            newData[idx].actualWeight = e.target.value;
                                                            setExecutionData(newData);
                                                        }}
                                                        className="w-full p-2 rounded border border-slate-200 text-sm font-bold"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1">Reps</label>
                                                    <input
                                                        type="number"
                                                        value={ex.actualReps}
                                                        onChange={(e) => {
                                                            const newData = [...executionData];
                                                            newData[idx].actualReps = e.target.value;
                                                            setExecutionData(newData);
                                                        }}
                                                        className="w-full p-2 rounded border border-slate-200 text-sm font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setExecuting(false)}
                                        className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={finishWorkout}
                                        disabled={loading}
                                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 transition flex justify-center gap-2"
                                    >
                                        {loading ? 'Saving...' : 'Finish & Log'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card className="h-fit order-2 lg:order-2">
                        <CardTitle>Manual Log</CardTitle>
                        <form id="manual-log-form" onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                                className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg disabled:opacity-50"
                            >
                                <Save size={18} />
                                {loading ? 'Saving...' : 'Log Single Set'}
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
