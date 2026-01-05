import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Dumbbell, History, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

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

            await Promise.all(batchPromises);
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

    const finishWorkout = async () => {
        if (!nextWorkout) return;
        setLoading(true);
        try {
            // 1. Log all exercises to 'workouts' collection
            const logPromises = executionData.map(e => {
                const setsToRun = e.actualSets || e.sets;
                const logs = [];
                for (let i = 0; i < setsToRun; i++) {
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









    // --- Session Editing Logic ---
    const [sessionEditData, setSessionEditData] = useState<Workout[]>([]);
    const [deletedSessionIds, setDeletedSessionIds] = useState<string[]>([]);

    const startSessionEditing = (dateKey: string, logs: Workout[]) => {
        setEditingId(dateKey); // Using dateKey as ID for session mode
        setSessionEditData(logs.map(l => ({ ...l }))); // Deep copy
        setDeletedSessionIds([]);
        setEditForm({ ...editForm, dateStr: dateKey.replace(' ', 'T') });
    };

    const saveSessionEdit = async () => {
        setLoading(true);
        try {
            const dateObj = new Date(editForm.dateStr);
            const ts = Timestamp.fromDate(dateObj);

            // 1. Updates
            const updatePromises = sessionEditData.map(log => {
                if (log.id) {
                    return updateDoc(doc(db, 'workouts', log.id), {
                        exercise: log.exercise,
                        weight: Number(log.weight),
                        reps: Number(log.reps),
                        date: ts // Apply new date to all
                    });
                }
                return Promise.resolve();
            });

            // 2. Deletions
            const deletePromises = deletedSessionIds.map(id => deleteDoc(doc(db, 'workouts', id)));

            await Promise.all([...updatePromises, ...deletePromises]);
            setEditingId(null);
            setSessionEditData([]);
        } catch (e) {
            console.error(e);
            alert('Failed to save session');
        } finally {
            setLoading(false);
        }
    };

    const deleteSession = async (logs: Workout[]) => {
        if (!confirm(`Delete all ${logs.length} sets in this session?`)) return;
        setLoading(true);
        try {
            await Promise.all(logs.map(l => deleteDoc(doc(db, 'workouts', l.id))));
        } catch (e) {
            console.error(e);
            alert('Failed to delete session');
        } finally {
            setLoading(false);
        }
    };

    // --- Smart Start Logic ---
    // Override startExecution to use history
    const startExecution = () => {
        if (!nextWorkout) return;

        // Find most recent log for each exercise to determine defaults
        // Logic: For each exercise in plan, find the last workout with same name.
        const smartExercises = nextWorkout.exercises.map(ex => {
            // Filter workouts for this exercise, sort desc
            const history = workouts
                .filter(w => w.exercise.toLowerCase() === ex.name.toLowerCase()) // simple match
                .sort((a, b) => b.date.toMillis() - a.date.toMillis());

            const lastLog = history[0];

            let recommendedWeight = ex.weight;
            let recommendedReps = ex.reps;

            if (lastLog) {
                // "Take the last logged workout session and add (+1) to the reps"
                recommendedWeight = lastLog.weight;
                recommendedReps = lastLog.reps + 1;
            }

            return {
                ...ex,
                actualWeight: recommendedWeight,
                actualReps: recommendedReps,
                // Ensure sets is editable in UI, defaulting to plan sets
                actualSets: ex.sets
            };
        });

        setExecutionData(smartExercises);
        setExecuting(true);
    };

    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Strength Training</h2>
                <p className="text-slate-500">Track your progress on the <span className="text-rose-600 font-medium">Hammer Autark 1500</span>.</p>
            </header>



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
                                    {nextWorkout.exercises.map((ex, idx) => {
                                        // Calculate smart target for preview
                                        const history = workouts
                                            .filter(w => w.exercise.toLowerCase() === ex.name.toLowerCase())
                                            .sort((a, b) => b.date.toMillis() - a.date.toMillis());
                                        const lastLog = history[0];
                                        const displayWeight = lastLog ? lastLog.weight : ex.weight;
                                        const displayReps = lastLog ? lastLog.reps + 1 : ex.reps;

                                        return (
                                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                                <div>
                                                    <p className="font-bold text-slate-700">{ex.name}</p>
                                                    <p className="text-xs text-slate-400">{ex.sets} set{ex.sets > 1 ? 's' : ''}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-slate-800">{displayWeight}kg</span>
                                                    <span className="text-xs text-slate-400 mx-2">x</span>
                                                    <span className="font-bold text-rose-600">{displayReps}</span>
                                                    {lastLog && <span className="text-[10px] text-emerald-500 block font-bold">+1 from last</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1">Sets</label>
                                                    <input
                                                        type="number"
                                                        value={ex.actualSets || ex.sets}
                                                        onChange={(e) => {
                                                            const newData = [...executionData];
                                                            newData[idx].actualSets = Number(e.target.value);
                                                            setExecutionData(newData);
                                                        }}
                                                        className="w-full p-2 rounded border border-slate-200 text-sm font-bold"
                                                    />
                                                </div>
                                                <div className="flex flex-col">
                                                    <label className="text-[10px] text-slate-400 uppercase font-bold mb-1">Weight</label>
                                                    <input
                                                        type="number"
                                                        value={ex.actualWeight}
                                                        onChange={(e) => {
                                                            const newData = [...executionData];
                                                            newData[idx].actualWeight = Number(e.target.value);
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
                                                            newData[idx].actualReps = Number(e.target.value);
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




                </div>

                {/* Main Content Column */}
                <div className="lg:col-span-2 flex flex-col gap-8">


                    {/* History List */}
                    <Card>
                        <CardTitle>History (Sessions)</CardTitle>
                        <div className="space-y-6 mt-4">
                            {Object.entries(
                                workouts.reduce((groups, log) => {
                                    // Group by Date+Time (within 1 min margin or strict string match if logs created nicely)
                                    // Using strict string match for now as Timestamp.now() in batch usually shares second.
                                    // Actually, let's round to minute to be safe.
                                    const dateKey = format(log.date.toDate(), "yyyy-MM-dd HH:mm");
                                    if (!groups[dateKey]) groups[dateKey] = [];
                                    groups[dateKey].push(log);
                                    return groups;
                                }, {} as Record<string, Workout[]>)
                            ).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()) // Sort by date desc
                                .map(([dateKey, sessionLogs]) => {
                                    const isEditingSession = editingId === dateKey;

                                    if (isEditingSession) {
                                        return (
                                            <div key={dateKey} className="bg-rose-50/50 p-4 rounded-xl space-y-4 border border-rose-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-bold text-rose-700">Editing Session</h4>
                                                    <input
                                                        type="datetime-local"
                                                        value={editForm.dateStr}
                                                        onChange={e => setEditForm(prev => ({ ...prev, dateStr: e.target.value }))}
                                                        className="p-1 border rounded text-xs"
                                                    />
                                                </div>

                                                {/* We need a specialized edit form for sessions because 'editForm' currently is single-flat. 
                                                    Let's modify the component state to handle session editing or just map inputs here directly to a temp state?
                                                    Actually, let's use a local state or abuse 'editForm' to hold array? 
                                                    Ideally, we refactor 'editForm'. For now, I will use a clever hack or add a new state for 'sessionEditForm'.
                                                    
                                                    Since I cannot easily add new state variables inside this map, I must have added them to the main component body previously.
                                                    WAIT. I need to add 'sessionEditData' state to the component first. 
                                                    I'll assume I will add it. I'll write the JSX assuming 'sessionEditData' exists.
                                                */}
                                                <div className="space-y-2">
                                                    {sessionEditData.map((log, idx) => (
                                                        <div key={log.id || idx} className="grid grid-cols-12 gap-2 items-center">
                                                            <div className="col-span-5">
                                                                <input
                                                                    value={log.exercise}
                                                                    onChange={e => {
                                                                        const n = [...sessionEditData];
                                                                        n[idx].exercise = e.target.value;
                                                                        setSessionEditData(n);
                                                                    }}
                                                                    className="w-full p-2 border rounded text-xs font-bold"
                                                                    placeholder="Ex"
                                                                />
                                                            </div>
                                                            <div className="col-span-3">
                                                                <input
                                                                    type="number"
                                                                    value={log.weight}
                                                                    onChange={e => {
                                                                        const n = [...sessionEditData];
                                                                        n[idx].weight = Number(e.target.value);
                                                                        setSessionEditData(n);
                                                                    }}
                                                                    className="w-full p-2 border rounded text-xs"
                                                                    placeholder="kg"
                                                                />
                                                            </div>
                                                            <div className="col-span-3">
                                                                <input
                                                                    type="number"
                                                                    value={log.reps}
                                                                    onChange={e => {
                                                                        const n = [...sessionEditData];
                                                                        n[idx].reps = Number(e.target.value);
                                                                        setSessionEditData(n);
                                                                    }}
                                                                    className="w-full p-2 border rounded text-xs"
                                                                    placeholder="reps"
                                                                />
                                                            </div>
                                                            <div className="col-span-1 flex justify-center">
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm('Delete this line?')) {
                                                                            // Mark for deletion or remove from array? 
                                                                            // If it has ID, we must delete from DB. If not, just remove from UI.
                                                                            // Let's just remove from UI and handle deletion on Save (diffing) or simple "delete immediately" 
                                                                            // Simpler: Delete immediately from DB? No, that's dangerous in "Edit" mode.
                                                                            // Let's just filter it out.
                                                                            const n = sessionEditData.filter((_, i) => i !== idx);
                                                                            setSessionEditData(n);
                                                                            // Also we should keep track of deleted IDs to remove them from DB on save.
                                                                            if (log.id) setDeletedSessionIds(prev => [...prev, log.id]);
                                                                        }
                                                                    }}
                                                                    className="text-red-400 hover:text-red-600"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex justify-end gap-2 mt-4 border-t border-rose-200 pt-2">
                                                    <button onClick={() => { setEditingId(null); setSessionEditData([]); }} className="px-3 py-1 text-slate-500 hover:bg-slate-200 rounded text-sm font-bold">Cancel</button>
                                                    <button onClick={saveSessionEdit} className="px-3 py-1 bg-rose-600 text-white rounded text-sm font-bold shadow">Save Changes</button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={dateKey} className="group bg-white p-5 rounded-xl border border-slate-200 hover:shadow-md transition-all relative">
                                            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600">
                                                        <History size={16} />
                                                    </div>
                                                    <span className="font-bold text-slate-700 capitalize">
                                                        {format(new Date(dateKey), 'EEEE, MMM do')}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-mono">
                                                        {format(new Date(dateKey), 'HH:mm')}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => startSessionEditing(dateKey, sessionLogs)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                                        title="Edit Session"
                                                    >
                                                        <Pencil size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteSession(sessionLogs)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                        title="Delete Session"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Exercises Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                                {sessionLogs.map(log => (
                                                    <div key={log.id} className="flex justify-between items-center text-sm border-b border-slate-50 py-1 last:border-0">
                                                        <span className="font-medium text-slate-600 truncate mr-2">{log.exercise}</span>
                                                        <div className="flex items-center gap-1 font-mono">
                                                            <span className="font-bold text-slate-800">{log.weight}kg</span>
                                                            <span className="text-slate-300">x</span>
                                                            <span className="font-bold text-rose-600">{log.reps}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                            }
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
