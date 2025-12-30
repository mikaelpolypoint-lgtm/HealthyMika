import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card } from "../components/Ui";
import { collection, query, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle2, Circle, ListChecks, Calendar } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { clsx } from 'clsx';
import { BarChart, Bar, Tooltip, ResponsiveContainer } from 'recharts';

// Interfaces
interface DailyTodo {
    id: string; // generated via timestamp usually
    text: string;
    completed: boolean;
    date: string; // YYYY-MM-DD - Linking it to creation date
}

export default function Tasks() {
    const [tasks, setTasks] = useState<DailyTodo[]>([]);
    const [viewMode, setViewMode] = useState<'all' | 'pending' | 'completed'>('all');

    // Data Fetching
    useEffect(() => {
        // We need to fetch ALL tasks across all daily_tasks docs. 
        // Currently DailyLog stores them in 'daily_tasks/{date}' doc as an array field 'tasks'.
        // This is tricky to query cleanly for "All Time" without cloud functions or changing schema.
        // Option B: We listen to the collection 'daily_tasks' and client-side merge. Assuming dataset isn't huge yet (User just started).

        const q = query(collection(db, 'daily_tasks'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let allTasks: DailyTodo[] = [];
            snapshot.docs.forEach(docSnap => {
                const date = docSnap.id;
                const dateTasks = (docSnap.data().tasks || []) as any[];
                // Map them to include their date if missing (or use doc ID)
                const mapped = dateTasks.map(t => ({
                    ...t,
                    date: t.date || date // Ensure date exists
                }));
                allTasks = [...allTasks, ...mapped];
            });
            // Sort by Date Descending
            allTasks.sort((a, b) => b.id.localeCompare(a.id));
            setTasks(allTasks);
        });

        return () => unsubscribe();
    }, []);

    // REFACTORING TO A BETTER SCHEMA FOR TASKS is recommended, but let's stick to reading 'daily_tasks' and maybe migrating or just handling logic here.
    // Actually, for this page to work WELL (editing status), the DailyLog implementation of storing tasks as an array inside a date-doc is limiting.
    // BUT I will implement the update logic by reading the doc for that date.

    const handleToggle = async (task: DailyTodo) => {
        try {
            // 1. Get current doc
            // Since we don't have the full doc data here immediately without querying, 
            // We can iterate the 'tasks' state to find the ones for this date? No, state might be stale or partial.

            // Let's standardise: We will update the WHOLE array for that date.
            // Find all tasks for this date from our local 'tasks' state, toggle the target, and save the array.
            const tasksForDay = tasks.filter(t => t.date === task.date);
            const updatedDayTasks = tasksForDay.map(t =>
                t.id === task.id ? { ...t, completed: !task.completed } : t
            );

            // Save back to Firestore
            await updateDoc(doc(db, 'daily_tasks', task.date), {
                tasks: updatedDayTasks
            });

        } catch (e) {
            console.error("Error toggling task:", e);
        }
    };


    // stats
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Chart Data (Last 7 Days Activity)
    const chartData = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = format(d, 'yyyy-MM-dd');

        const tasksForDay = tasks.filter(t => t.date === dateStr);
        const done = tasksForDay.filter(t => t.completed).length;
        const totalDay = tasksForDay.length;

        chartData.push({
            name: format(d, 'EEE'),
            total: totalDay,
            done: done,
            pending: totalDay - done
        });
    }

    const filteredTasks = tasks.filter(t => {
        if (viewMode === 'pending') return !t.completed;
        if (viewMode === 'completed') return t.completed;
        return true;
    });

    return (
        <Layout>
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-brand-primary mb-2">Tasks Overview ✅</h2>
                <p className="text-slate-500">Track, manage, and complete your daily missions.</p>
            </header>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <Card className="p-6 bg-white border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                        <ListChecks className="text-brand-primary" size={24} />
                        <h4 className="font-bold text-slate-700">Total Tasks</h4>
                    </div>
                    <span className="text-3xl font-bold text-slate-800">{total}</span>
                    <span className="text-xs text-slate-400 block mt-1">Recorded All Time</span>
                </Card>

                <Card className="p-6 bg-emerald-50 border-emerald-100">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="text-emerald-600" size={24} />
                        <h4 className="font-bold text-slate-700">Completed</h4>
                    </div>
                    <span className="text-3xl font-bold text-emerald-800">{completed}</span>
                    <span className="text-xs text-emerald-600/60 block mt-1">{completionRate}% Success Rate</span>
                </Card>

                <Card className="p-6 bg-amber-50 border-amber-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Circle className="text-amber-600" size={24} />
                        <h4 className="font-bold text-slate-700">Pending</h4>
                    </div>
                    <span className="text-3xl font-bold text-amber-800">{pending}</span>
                    <span className="text-xs text-amber-600/60 block mt-1">Action items</span>
                </Card>

                <Card className="p-4 bg-white border-slate-200 col-span-1 md:col-span-1 flex flex-col justify-center">
                    <h4 className="font-bold text-slate-500 text-xs uppercase mb-4">Last 7 Days Activity</h4>
                    <div className="h-24 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="done" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="pending" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Task List */}
            <div>
                {/* Filters */}
                <div className="flex gap-4 mb-4 border-b border-slate-200">
                    {(['all', 'pending', 'completed'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={clsx("pb-3 px-2 font-bold capitalize transition-colors border-b-2",
                                viewMode === mode ? "text-brand-primary border-brand-primary" : "text-slate-400 border-transparent hover:text-slate-600"
                            )}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTasks.map(task => (
                        <div key={`${task.date}-${task.id}`} className={clsx("p-4 rounded-xl border flex items-start gap-3 transition-all", task.completed ? "bg-slate-50 border-slate-100 opacity-75" : "bg-white border-slate-200 shadow-sm")}>
                            <button
                                onClick={() => handleToggle(task)}
                                className={clsx("mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-colors flex-shrink-0",
                                    task.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 hover:border-brand-primary"
                                )}
                            >
                                {task.completed && <CheckCircle2 size={14} />}
                            </button>
                            <div>
                                <p className={clsx("font-medium text-sm mb-1 line-clamp-2", task.completed ? "text-slate-500 line-through" : "text-slate-800")}>{task.text}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Calendar size={10} />
                                    <span>{format(new Date(task.date), 'MMM d, yyyy')}</span>
                                    {isSameDay(new Date(task.date), new Date()) && <span className="bg-brand-primary/10 text-brand-primary px-1.5 rounded font-bold text-[9px]">TODAY</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredTasks.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                            <ListChecks size={48} className="mx-auto mb-2 opacity-20" />
                            <p>No tasks found for this filter.</p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
