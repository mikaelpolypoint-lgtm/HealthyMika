import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, onSnapshot, doc, setDoc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { Cross, Smartphone, UtensilsCrossed, Wine, Droplets, Calendar as CalendarIcon, Save, Loader2, Moon, CloudSun, Target, Bed, Activity, Pill, Droplet, Heart, Smile, BookOpen, Brain, Zap, Clock, Trash2, ListChecks, Plus, Sparkles, Scale, Search, ChevronDown, CheckCircle2, ChevronLeft, ChevronRight, MessageSquare, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

// --- Static Data: New Testament Books (for Bible Log) ---
const NT_BOOKS = [
    { name: 'Matthew', chapters: 28 }, { name: 'Mark', chapters: 16 }, { name: 'Luke', chapters: 24 }, { name: 'John', chapters: 21 },
    { name: 'Acts', chapters: 28 }, { name: 'Romans', chapters: 16 }, { name: '1 Corinthians', chapters: 16 }, { name: '2 Corinthians', chapters: 13 },
    { name: 'Galatians', chapters: 6 }, { name: 'Ephesians', chapters: 6 }, { name: 'Philippians', chapters: 4 }, { name: 'Colossians', chapters: 4 },
    { name: '1 Thessalonians', chapters: 5 }, { name: '2 Thessalonians', chapters: 3 }, { name: '1 Timothy', chapters: 6 }, { name: '2 Timothy', chapters: 4 },
    { name: 'Titus', chapters: 3 }, { name: 'Philemon', chapters: 1 }, { name: 'Hebrews', chapters: 13 }, { name: 'James', chapters: 5 },
    { name: '1 Peter', chapters: 5 }, { name: '2 Peter', chapters: 3 }, { name: '1 John', chapters: 5 }, { name: '2 John', chapters: 1 },
    { name: '3 John', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Revelation', chapters: 22 }
];

// --- Types ---

interface DailyGoal {
    date: string;

    // Morning Focus
    jesus: boolean;
    dailyMotto?: string;

    // Daily Todos
    // (Handled via separate subcollection or dedicated object state, merged in UI)

    // Recovery & Physiology
    sleepHours?: number;
    sleepQuality?: number; // 1-5

    // Productivity & Focus
    screenTimeRating?: number; // 1-5 Stars 
    phoneFreeEvening?: boolean;

    // Nutrition & Body
    hungryOnly: boolean;
    noAlcohol: boolean;
    noSoda: boolean;

    // Medications
    medications?: { [name: string]: number }; // e.g. { "Aspirin": 1, "Dafalgan": 0 }

    // Physical Health
    bodyStatus?: string; // Pain log / Recovery status

    // Decluttering
    declutteredItem?: string; // Daily item removed
}

interface DailyTodo {
    id: string; // generated via timestamp usually
    text: string;
    completed: boolean;
}

interface DailyFoodLog {
    date: string;
    eatWhenHungry: boolean;
    caloriesColor: 'dark-red' | 'red' | 'orange' | 'yellow' | 'light-green' | 'dark-green';
    eatingStart: string;
    eatingEnd: string;
    coffees: number;
    noAlcohol: boolean;
    noSodas: boolean;
    comment: string; // "Comment" field

    // Hydration
    water?: number; // glasses
}

interface FellowshipLog {
    date: string;
    thoughts: string;
    chaptersRead: string[];
}

interface Book {
    id: string;
    title: string;
    progress: number;
}


// Color Options for Food
const CALORIE_COLORS: { value: DailyFoodLog['caloriesColor'], label: string, tw: string }[] = [
    { value: 'dark-green', label: 'Excellent', tw: 'bg-emerald-700' },
    { value: 'light-green', label: 'Good', tw: 'bg-emerald-400' },
    { value: 'yellow', label: 'Okay', tw: 'bg-yellow-400' },
    { value: 'orange', label: 'High', tw: 'bg-orange-400' },
    { value: 'red', label: 'Bad', tw: 'bg-red-500' },
    { value: 'dark-red', label: 'Excessive', tw: 'bg-red-900' },
];

export default function DailyLog() {
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isSaving, setIsSaving] = useState(false);

    // --- State Management ---
    const [dailyGoal, setDailyGoal] = useState<DailyGoal>({
        date: selectedDate,
        jesus: false, hungryOnly: false, noAlcohol: false, noSoda: false, phoneFreeEvening: false,
        dailyMotto: '', sleepHours: 0, sleepQuality: 0, screenTimeRating: 0, bodyStatus: '', declutteredItem: '',
        medications: { "Aspirin": 0, "Dafalgan": 0, "Neocitran": 0 }
    });

    const [foodLog, setFoodLog] = useState<DailyFoodLog>({
        date: selectedDate,
        eatWhenHungry: true,
        caloriesColor: 'light-green',
        eatingStart: '12:00',
        eatingEnd: '20:00',
        coffees: 0,
        noAlcohol: true,
        noSodas: true,
        comment: '',
        water: 0
    });

    const [fellowshipLog, setFellowshipLog] = useState<FellowshipLog>({
        date: selectedDate,
        thoughts: '',
        chaptersRead: []
    });

    // Daily Todos (Array of objects)
    const [dailyTodos, setDailyTodos] = useState<DailyTodo[]>([]);
    const [newTodo, setNewTodo] = useState('');

    const [activeBooks, setActiveBooks] = useState<Book[]>([]); // Non-Bible Books

    // Bible Selector State
    const [selectedBook, setSelectedBook] = useState(NT_BOOKS[0]);
    const [isBookSelectorOpen, setIsBookSelectorOpen] = useState(false);


    const [todaysWeight, setTodaysWeight] = useState<string>('');

    // --- Data Fetching ---
    useEffect(() => {
        // Reset state on date change (Optimistic Defaults)
        setDailyGoal({
            date: selectedDate,
            jesus: false, hungryOnly: false, noAlcohol: false, noSoda: false, phoneFreeEvening: false,
            dailyMotto: '', sleepHours: 0, sleepQuality: 0, screenTimeRating: 0, bodyStatus: '', declutteredItem: '',
            medications: { "Aspirin": 0, "Dafalgan": 0, "Neocitran": 0 }
        });
        setFoodLog({
            date: selectedDate,
            eatWhenHungry: true,
            caloriesColor: 'light-green',
            eatingStart: '12:00',
            eatingEnd: '20:00',
            coffees: 0,
            noAlcohol: true,
            noSodas: true,
            comment: '',
            water: 0
        });
        setFellowshipLog({
            date: selectedDate,
            thoughts: '',
            chaptersRead: []
        });
        setDailyTodos([]);
        setTodaysWeight('');

        // 1. Daily Goals
        const unsubDaily = onSnapshot(doc(db, 'daily_goals', selectedDate), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as DailyGoal;
                // Merge default meds
                const mergedMeds = { "Aspirin": 0, "Dafalgan": 0, "Neocitran": 0, ...(data.medications || {}) };
                setDailyGoal(prev => ({ ...prev, ...data, medications: mergedMeds }));
            }
        });

        // 2. Food Logs
        const unsubFood = onSnapshot(doc(db, 'day_food_logs', selectedDate), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as DailyFoodLog;
                setFoodLog(prev => ({ ...prev, ...data }));
            }
        });

        // 3. Fellowship Logs
        const unsubFellowship = onSnapshot(doc(db, 'fellowship_logs', selectedDate), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as FellowshipLog;
                setFellowshipLog(prev => ({ ...prev, ...data }));
            }
        });

        // 4. Daily Todos
        const unsubTodos = onSnapshot(doc(db, 'daily_tasks', selectedDate), (doc) => {
            if (doc.exists() && doc.data().tasks) {
                setDailyTodos(doc.data().tasks);
            } else {
                setDailyTodos([]);
            }
        });


        // 5. Active Books (Global)
        const qBooks = query(collection(db, 'books'));
        const unsubBooks = onSnapshot(qBooks, (snap) => {
            const allBooks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Book));
            setActiveBooks(allBooks.filter(b => b.progress < 100));
        });

        return () => { unsubDaily(); unsubFood(); unsubFellowship(); unsubTodos(); unsubBooks(); };
    }, [selectedDate]);


    // --- Handlers ---

    const updateGoal = async (updates: Partial<DailyGoal>) => {
        const newData = { ...dailyGoal, ...updates };
        setDailyGoal(newData);
        await setDoc(doc(db, 'daily_goals', selectedDate), newData, { merge: true });
    };

    const updateMedication = (name: string, diff: number) => {
        const currentCount = dailyGoal.medications?.[name] || 0;
        const newCount = Math.max(0, currentCount + diff);
        const newMeds = { ...(dailyGoal.medications || {}), [name]: newCount };
        updateGoal({ medications: newMeds });
    };

    // Todo Handlers
    const saveTodos = async (newTodos: DailyTodo[]) => {
        setDailyTodos(newTodos);
        await setDoc(doc(db, 'daily_tasks', selectedDate), { tasks: newTodos }, { merge: true });
    };

    const addTodo = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodo.trim()) return;
        const task: DailyTodo = { id: Date.now().toString(), text: newTodo, completed: false };
        saveTodos([...dailyTodos, task]);
        setNewTodo('');
    };

    const toggleTodo = (id: string) => {
        const updated = dailyTodos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        saveTodos(updated);
    };

    const deleteTodo = (id: string) => {
        const updated = dailyTodos.filter(t => t.id !== id);
        saveTodos(updated);
    };


    const updateFood = async (updates: Partial<DailyFoodLog>) => {
        const newData = { ...foodLog, ...updates };
        setFoodLog(newData);
        await setDoc(doc(db, 'day_food_logs', selectedDate), newData, { merge: true });
        if (updates.eatWhenHungry !== undefined) updateGoal({ hungryOnly: updates.eatWhenHungry });
    };

    const updateFellowship = async (updates: Partial<FellowshipLog>) => {
        const newData = { ...fellowshipLog, ...updates };
        setFellowshipLog(newData);
        await setDoc(doc(db, 'fellowship_logs', selectedDate), newData, { merge: true });
    };

    const toggleChapter = (book: string, chapter: number) => {
        const chapterStr = `${book} ${chapter}`;
        const current = fellowshipLog.chaptersRead || [];
        let updated;
        if (current.includes(chapterStr)) {
            updated = current.filter(c => c !== chapterStr);
        } else {
            updated = [...current, chapterStr];
        }
        updateFellowship({ chaptersRead: updated });
    };

    const isChapterRead = (book: string, chapter: number) => fellowshipLog.chaptersRead?.includes(`${book} ${chapter}`);


    const saveWeight = async () => {
        if (!todaysWeight) return;
        setIsSaving(true);
        try {
            await addDoc(collection(db, 'weight_logs'), {
                weight: Number(todaysWeight),
                date: Timestamp.fromDate(new Date(selectedDate + 'T08:00:00')),
            });
            setTodaysWeight('');
            alert('Weight saved!');
        } catch (e) {
            console.error(e);
        }
        setIsSaving(false);
    };

    const updateBookProgress = async (id: string, newProgress: number) => {
        const safeProgress = Math.min(100, Math.max(0, newProgress));
        await setDoc(doc(db, 'books', id), { progress: safeProgress }, { merge: true });
    };

    // Auto-Sync Declutter to Goal Collection (Future)
    const handleDeclutterBlur = async () => { };

    // Date Navigation
    const prevDay = () => setSelectedDate(format(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() - 1)), 'yyyy-MM-dd'));
    const nextDay = () => setSelectedDate(format(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() + 1)), 'yyyy-MM-dd'));

    return (
        <Layout>
            <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-1">Daily Log ✍️</h2>
                    <p className="text-slate-500">Capture your day in one place.</p>
                </div>
                {/* Enhanced Date Switcher */}
                <div className="flex items-center gap-4 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                    <button onClick={prevDay} className="p-3 hover:bg-slate-50 rounded-xl text-slate-500 transition-colors"><ChevronLeft size={20} /></button>
                    <div className="flex flex-col items-center px-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{format(new Date(selectedDate), 'EEEE')}</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="outline-none text-slate-800 font-bold bg-transparent text-lg text-center w-36"
                        />
                    </div>
                    <button onClick={nextDay} className="p-3 hover:bg-slate-50 rounded-xl text-slate-500 transition-colors"><ChevronRight size={20} /></button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* 1. MORNING & FOCUS (Col 1) */}
                <Card className="space-y-6">
                    <CardTitle>Morning & Focus ☀️</CardTitle>

                    {/* Start With Jesus (Moved Here) */}
                    <button
                        onClick={() => updateGoal({ jesus: !dailyGoal.jesus })}
                        className={clsx("w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all duration-300 group",
                            dailyGoal.jesus ? "bg-amber-50 border-amber-300" : "bg-white border-slate-100 hover:border-amber-200"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className={clsx("p-2 rounded-full", dailyGoal.jesus ? "bg-amber-200 text-amber-700" : "bg-slate-100 text-slate-400")}>
                                <Cross size={20} />
                            </div>
                            <div className="text-left">
                                <span className={clsx("block text-sm font-bold", dailyGoal.jesus ? "text-amber-800" : "text-slate-600")}>Start with Jesus</span>
                                <span className="text-[10px] text-slate-400">Did you dedicate the morning?</span>
                            </div>
                        </div>
                        {dailyGoal.jesus && <CheckCircle2 size={24} className="text-amber-500 animate-in zoom-in" />}
                    </button>

                    {/* Daily Motto */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                            <Sparkles size={14} className="text-indigo-500" /> Daily Motto
                        </label>
                        <input
                            value={dailyGoal.dailyMotto || ''}
                            onChange={(e) => updateGoal({ dailyMotto: e.target.value })}
                            placeholder="Words to live by today..."
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium italic text-slate-700 outline-none focus:ring-2 ring-indigo-100"
                        />
                    </div>

                    {/* Todo List */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1"><ListChecks size={14} /> Daily Tasks</label>
                        <form onSubmit={addTodo} className="flex gap-2 mb-3">
                            <input
                                value={newTodo} onChange={e => setNewTodo(e.target.value)}
                                placeholder="Add task..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                            />
                            <button className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-3"><Plus size={16} /></button>
                        </form>
                        <div className="space-y-2">
                            {dailyTodos.map(todo => (
                                <div key={todo.id} className="flex items-center gap-2 group">
                                    <button
                                        onClick={() => toggleTodo(todo.id)}
                                        className={clsx("w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                            todo.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                                        )}
                                    >
                                        {todo.completed && <Cross size={12} className="rotate-45" />}
                                    </button>
                                    <span className={clsx("flex-1 text-sm transition-all", todo.completed ? "text-slate-300 line-through" : "text-slate-700")}>{todo.text}</span>
                                    <button onClick={() => deleteTodo(todo.id)} className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                                </div>
                            ))}
                            {dailyTodos.length === 0 && <p className="text-xs text-slate-300 italic">No tasks for today yet.</p>}
                        </div>
                    </div>

                    {/* Sleep Tracker */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1"><Bed size={14} /> Sleep Hours</label>
                            <div className="flex items-center gap-2">
                                <button className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold hover:bg-slate-200" onClick={() => updateGoal({ sleepHours: Math.max(0, (dailyGoal.sleepHours || 0) - 0.5) })}>-</button>
                                <span className="text-xl font-bold text-slate-700 w-12 text-center">{dailyGoal.sleepHours || 0}</span>
                                <button className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold hover:bg-slate-200" onClick={() => updateGoal({ sleepHours: (dailyGoal.sleepHours || 0) + 0.5 })}>+</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1"><Smile size={14} /> Quality (1-5)</label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        onClick={() => updateGoal({ sleepQuality: star })}
                                        className={clsx("w-6 h-8 rounded-md transition-all", (dailyGoal.sleepQuality || 0) >= star ? "bg-indigo-400 text-white" : "bg-slate-100 text-slate-300")}
                                    >★</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Weight (Keep) */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Weight (kg)</label>
                        <div className="flex gap-1">
                            <input
                                type="number" step="0.1" value={todaysWeight} onChange={e => setTodaysWeight(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold outline-none" placeholder="..."
                            />
                            <button onClick={saveWeight} disabled={isSaving} className="bg-brand-primary text-white p-1 rounded"><Save size={14} /></button>
                        </div>
                    </div>
                </Card>

                {/* 2. NUTRITION & BODY (Col 2) */}
                <Card className="space-y-6">
                    <CardTitle>Nutrition & Body 🍎</CardTitle>

                    {/* Calories Color & Comment (Added) */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><AlertCircle size={14} /> Nutrition Quality</label>
                            <div className="flex gap-1">
                                {CALORIE_COLORS.map(c => (
                                    <button
                                        key={c.value}
                                        onClick={() => updateFood({ caloriesColor: c.value })}
                                        title={c.label}
                                        className={clsx("w-4 h-4 rounded-full transition-transform hover:scale-125 border border-white shadow-sm",
                                            c.tw,
                                            foodLog.caloriesColor === c.value ? "ring-2 ring-slate-400 scale-110" : "opacity-30 hover:opacity-100"
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <MessageSquare className="absolute left-3 top-3 text-slate-400" size={16} />
                            <textarea
                                value={foodLog.comment || ''}
                                onChange={e => updateFood({ comment: e.target.value })}
                                placeholder="What did you eat today?"
                                className="w-full h-20 pl-9 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 ring-brand-primary placeholder:text-slate-400 resize-none"
                            />
                        </div>
                    </div>

                    {/* Eating Window (Added Back) */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Start (Fasting End)</span>
                            <input type="time" value={foodLog.eatingStart || "12:00"} onChange={(e) => updateFood({ eatingStart: e.target.value })} className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold outline-none" />
                        </div>
                        <span className="text-slate-300">→</span>
                        <div className="flex-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Stop (Fasting Start)</span>
                            <input type="time" value={foodLog.eatingEnd || "20:00"} onChange={(e) => updateFood({ eatingEnd: e.target.value })} className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold outline-none" />
                        </div>
                    </div>

                    {/* Water & Coffee Counter */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl border border-sky-100 bg-sky-50 flex flex-col items-center gap-2">
                            <span className="text-[10px] font-bold text-sky-600 uppercase flex items-center gap-1"><Droplet size={12} /> Water</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => updateFood({ water: Math.max(0, (foodLog.water || 0) - 1) })} className="w-6 h-6 bg-white rounded-full text-sky-500 shadow hover:bg-sky-100">-</button>
                                <span className="text-xl font-bold text-sky-800">{foodLog.water || 0}</span>
                                <button onClick={() => updateFood({ water: (foodLog.water || 0) + 1 })} className="w-6 h-6 bg-white rounded-full text-sky-500 shadow hover:bg-sky-100">+</button>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl border border-amber-100 bg-amber-50 flex flex-col items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">☕️ Coffee</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => updateFood({ coffees: Math.max(0, (foodLog.coffees || 0) - 1) })} className="w-6 h-6 bg-white rounded-full text-amber-500 shadow hover:bg-amber-100">-</button>
                                <span className="text-xl font-bold text-amber-800">{foodLog.coffees || 0}</span>
                                <button onClick={() => updateFood({ coffees: (foodLog.coffees || 0) + 1 })} className="w-6 h-6 bg-white rounded-full text-amber-500 shadow hover:bg-amber-100">+</button>
                            </div>
                        </div>
                    </div>

                    {/* Habits Grid (Updated) */}
                    <div className="grid grid-cols-3 gap-2">
                        {/* No Alcohol */}
                        <button
                            onClick={() => updateGoal({ noAlcohol: !dailyGoal.noAlcohol })}
                            className={clsx("p-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-center",
                                dailyGoal.noAlcohol ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200 opacity-60"
                            )}
                        >
                            <Wine size={16} className={dailyGoal.noAlcohol ? "text-rose-600" : "text-slate-400"} />
                            <span className="text-[9px] font-bold uppercase text-slate-500">No Alcohol</span>
                        </button>

                        {/* Eat When Hungry */}
                        <button
                            onClick={() => updateFood({ eatWhenHungry: !foodLog.eatWhenHungry })}
                            className={clsx("p-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-center",
                                foodLog.eatWhenHungry ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200 opacity-60"
                            )}
                        >
                            <UtensilsCrossed size={16} className={foodLog.eatWhenHungry ? "text-emerald-600" : "text-slate-400"} />
                            <span className="text-[9px] font-bold uppercase text-slate-500">Hungry</span>
                        </button>

                        {/* No Soda */}
                        <button
                            onClick={() => toggleSodas(!foodLog.noSodas)}
                            className={clsx("p-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-center",
                                foodLog.noSodas ? "bg-blue-50 border-blue-200" : "bg-white border-slate-200 opacity-60"
                            )}
                        >
                            <Droplets size={16} className={foodLog.noSodas ? "text-blue-600" : "text-slate-400"} />
                            <span className="text-[9px] font-bold uppercase text-slate-500">No Soda</span>
                        </button>
                    </div>

                    {/* Medications */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1"><Pill size={14} /> Medicaments</label>
                        <div className="space-y-3">
                            {['Aspirin', 'Dafalgan', 'Neocitran'].map(med => (
                                <div key={med} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                    <span className="text-xs font-bold text-slate-700">{med}</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateMedication(med, -1)} className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-500 font-bold">-</button>
                                        <span className="text-sm font-bold text-slate-800 w-4 text-center">{dailyGoal.medications?.[med] || 0}</span>
                                        <button onClick={() => updateMedication(med, 1)} className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-500 font-bold">+</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body Status / Pain Log */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase mb-2 block flex items-center gap-1"><Activity size={14} /> Body Status / Pain</label>
                        <textarea
                            value={dailyGoal.bodyStatus || ''}
                            onChange={(e) => updateGoal({ bodyStatus: e.target.value })}
                            placeholder="Sore knee? Great energy? Notes on training..."
                            className="w-full h-20 p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 ring-brand-primary placeholder:text-slate-400 resize-none"
                        />
                    </div>
                </Card>

                {/* 3. REFLECTION & GROWTH (Col 3) */}
                <Card className="space-y-6">
                    <CardTitle>Reflection & Growth 🌙</CardTitle>

                    {/* Bible Log (Like Fellowship Page) */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><BookOpen size={14} /> Bible Log</label>
                            <div className="relative">
                                <button onClick={() => setIsBookSelectorOpen(!isBookSelectorOpen)} className="text-[10px] font-bold bg-white px-2 py-1 rounded border border-slate-200 flex items-center gap-1">
                                    {selectedBook.name} <ChevronDown size={10} />
                                </button>
                                {isBookSelectorOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-32 max-h-48 overflow-y-auto bg-white rounded-lg shadow-xl border border-slate-200 z-20">
                                        {NT_BOOKS.map(b => (
                                            <button key={b.name} onClick={() => { setSelectedBook(b); setIsBookSelectorOpen(false); }} className="w-full text-left px-2 py-1 text-xs hover:bg-slate-50">{b.name}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-6 gap-1">
                            {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(chapter => {
                                const read = isChapterRead(selectedBook.name, chapter);
                                return (
                                    <button
                                        key={chapter}
                                        onClick={() => toggleChapter(selectedBook.name, chapter)}
                                        className={clsx("aspect-square rounded flex items-center justify-center text-[10px] font-bold transition-all",
                                            read ? "bg-emerald-500 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-300 hover:border-emerald-300"
                                        )}
                                    >
                                        {chapter}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {fellowshipLog.chaptersRead?.length > 0 && fellowshipLog.chaptersRead.map(ch => (
                                <span key={ch} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded border border-emerald-200">{ch}</span>
                            ))}
                        </div>
                    </div>

                    {/* Decluttering */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1"><Trash2 size={14} /> Daily Declutter</label>
                        <input
                            value={dailyGoal.declutteredItem || ''}
                            onChange={(e) => updateGoal({ declutteredItem: e.target.value })}
                            onBlur={handleDeclutterBlur}
                            placeholder="Item removed today..."
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-primary"
                        />
                    </div>

                    {/* Reading (Non-Bible) */}
                    <div>
                        <label className="text-xs font-bold text-indigo-500 uppercase mb-2 block flex items-center justify-between">
                            <span className="flex items-center gap-1"><BookOpen size={14} /> Reading (Non-Bible)</span>
                            <span className="text-[10px] font-normal text-slate-400">Updates Global Progress</span>
                        </label>

                        {activeBooks.length === 0 ? (
                            <p className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded">No active books. Add one in Learning!</p>
                        ) : (
                            <div className="space-y-3">
                                {activeBooks.map(book => (
                                    <div key={book.id} className="bg-white border border-slate-100 rounded-lg p-2 shadow-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-slate-700 truncate w-32">{book.title}</span>
                                            <span className="text-[10px] font-bold text-indigo-600">{book.progress}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min="0" max="100" value={book.progress}
                                                onChange={e => updateBookProgress(book.id, Number(e.target.value))}
                                                className="flex-1 accent-indigo-500 h-1 bg-slate-200 rounded appearance-none"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Screen Time Rating & Phone Free */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Screen Rating</label>
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        onClick={() => updateGoal({ screenTimeRating: star })}
                                        className={clsx("w-5 h-7 rounded transition-all", (dailyGoal.screenTimeRating || 0) >= star ? "bg-indigo-400 text-white" : "bg-slate-100 text-slate-300")}
                                    >★</button>
                                ))}
                            </div>
                        </div>
                        <button
                            onClick={() => updateGoal({ phoneFreeEvening: !dailyGoal.phoneFreeEvening })}
                            className={clsx("px-2 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all",
                                dailyGoal.phoneFreeEvening ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-400"
                            )}
                        >
                            <Smartphone size={16} /> <span className="text-[10px] font-bold uppercase text-center">Phone Free Eve</span>
                        </button>
                    </div>
                </Card>

            </div>
        </Layout>
    );
}
