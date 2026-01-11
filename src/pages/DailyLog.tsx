import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, onSnapshot, doc, setDoc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { Cross, Smartphone, UtensilsCrossed, Wine, Droplets, Activity, BookOpen, ChevronDown, CheckCircle2, ChevronLeft, ChevronRight, MessageSquare, AlertCircle, Save } from 'lucide-react';
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
        dailyMotto: '', sleepHours: 0, sleepQuality: 0, bodyStatus: '', declutteredItem: '',
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





    // Bible Selector State
    const [selectedBook, setSelectedBook] = useState(NT_BOOKS[0]);
    const [isBookSelectorOpen, setIsBookSelectorOpen] = useState(false);

    // History State
    const [historyChapters, setHistoryChapters] = useState<Set<string>>(new Set());


    const [todaysWeight, setTodaysWeight] = useState<string>('');


    // --- Data Fetching ---
    useEffect(() => {
        // Reset state on date change (Optimistic Defaults)
        setDailyGoal({
            date: selectedDate,
            jesus: false, hungryOnly: false, noAlcohol: false, noSoda: false, phoneFreeEvening: false,
            dailyMotto: '', sleepHours: 0, sleepQuality: 0, bodyStatus: '', declutteredItem: '',
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

        setTodaysWeight('');
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

        // 3. Fellowship Logs (Current Day)
        const unsubFellowship = onSnapshot(doc(db, 'fellowship_logs', selectedDate), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as FellowshipLog;
                setFellowshipLog(prev => ({ ...prev, ...data }));
            }
        });

        // 3b. Fellowship Logs (History - All other days)
        // Note: For a larger app, we would query specific ranges or aggregate this.
        const qHistory = query(collection(db, 'fellowship_logs'));
        const unsubHistory = onSnapshot(qHistory, (snap) => {
            const history = new Set<string>();
            snap.docs.forEach(d => {
                if (d.id !== selectedDate) { // Exclude current selected day from "history"
                    const data = d.data() as FellowshipLog;
                    data.chaptersRead?.forEach(ch => history.add(ch));
                }
            });
            setHistoryChapters(history);
        });




        // 5. Active Books (Global)


        return () => { unsubDaily(); unsubFood(); unsubFellowship(); unsubHistory(); };
    }, [selectedDate]);


    // --- Handlers ---

    const updateGoal = async (updates: Partial<DailyGoal>) => {
        const newData = { ...dailyGoal, ...updates };
        setDailyGoal(newData);
        await setDoc(doc(db, 'daily_goals', selectedDate), newData, { merge: true });
    };






    const updateFood = async (updates: Partial<DailyFoodLog>) => {
        const newData = { ...foodLog, ...updates };
        setFoodLog(newData);
        await setDoc(doc(db, 'day_food_logs', selectedDate), newData, { merge: true });
        if (updates.eatWhenHungry !== undefined) updateGoal({ hungryOnly: updates.eatWhenHungry });
    };

    const toggleSodas = (val: boolean) => updateFood({ noSodas: val });

    const updateFellowship = async (updates: Partial<FellowshipLog>) => {
        const newData = { ...fellowshipLog, ...updates };
        setFellowshipLog(newData);
        await setDoc(doc(db, 'fellowship_logs', selectedDate), newData, { merge: true });
    };

    const toggleChapter = (book: string, chapter: number) => {
        const chapterStr = `${book} ${chapter}`;
        const current = fellowshipLog.chaptersRead || [];
        // If it's already in history, we generally don't toggle it off from history here, 
        // we only toggle the CURRENT day's record.
        // User logic: "Toggle" usually implies adding/removing from TODAY. 
        // If I read it in the past, and click it today, do I mark it as read AGAIN today? (Re-read?) -> Yes, valid.

        let updated;
        if (current.includes(chapterStr)) {
            updated = current.filter(c => c !== chapterStr);
        } else {
            updated = [...current, chapterStr];
        }
        updateFellowship({ chaptersRead: updated });
    };

    const isChapterReadToday = (book: string, chapter: number) => fellowshipLog.chaptersRead?.includes(`${book} ${chapter}`);
    const isChapterReadHistory = (book: string, chapter: number) => historyChapters.has(`${book} ${chapter}`);


    const saveWeight = async () => {
        if (!todaysWeight) return;
        setIsSaving(true);
        try {
            const now = new Date();
            const timeString = format(now, 'HH:mm:ss');
            await addDoc(collection(db, 'weight_logs'), {
                weight: Number(todaysWeight),
                date: Timestamp.fromDate(new Date(`${selectedDate}T${timeString}`)),
            });
            setTodaysWeight('');
            alert('Weight saved!');
        } catch (e) {
            console.error(e);
        }
        setIsSaving(false);
    };





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



                    {/* Weight (Keep - Simplified) */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Weight (kg)</label>
                        <div className="flex gap-2">
                            <input
                                type="number" step="0.1" value={todaysWeight} onChange={e => setTodaysWeight(e.target.value)}
                                className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-sm font-bold outline-none" placeholder="kg"
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



                    {/* Habits Grid (Updated) */}
                    <div className="grid grid-cols-3 gap-2">
                        {/* No Alcohol */}
                        <button
                            onClick={() => updateFood({ noAlcohol: !foodLog.noAlcohol })}
                            className={clsx("p-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-center",
                                foodLog.noAlcohol ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200 opacity-60"
                            )}
                        >
                            <Wine size={16} className={foodLog.noAlcohol ? "text-rose-600" : "text-slate-400"} />
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
                                const readToday = isChapterReadToday(selectedBook.name, chapter);
                                const readHistory = isChapterReadHistory(selectedBook.name, chapter);
                                return (
                                    <button
                                        key={chapter}
                                        onClick={() => toggleChapter(selectedBook.name, chapter)}
                                        className={clsx("aspect-square rounded flex items-center justify-center text-[10px] font-bold transition-all",
                                            readToday
                                                ? "bg-fuchsia-500 text-white shadow-sm"
                                                : readHistory
                                                    ? "bg-emerald-500 text-white shadow-sm opacity-80"
                                                    : "bg-white border border-slate-200 text-slate-300 hover:border-fuchsia-300"
                                        )}
                                        title={readToday ? "Read Today" : readHistory ? "Read in the past" : "Unread"}
                                    >
                                        {chapter}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {fellowshipLog.chaptersRead?.length > 0 && fellowshipLog.chaptersRead.map(ch => (
                                <span key={ch} className="px-1.5 py-0.5 bg-fuchsia-100 text-fuchsia-800 text-[9px] font-bold rounded border border-fuchsia-200">{ch}</span>
                            ))}
                        </div>
                    </div>





                    {/* Phone Free Evening Only (Moved) */}
                    <div className="mt-4">
                        <button
                            onClick={() => updateGoal({ phoneFreeEvening: !dailyGoal.phoneFreeEvening })}
                            className={clsx("w-full py-3 rounded-lg border-2 flex flex-row items-center justify-center gap-2 transition-all",
                                dailyGoal.phoneFreeEvening ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-100 text-slate-400 hover:border-indigo-100"
                            )}
                        >
                            <Smartphone size={18} /> <span className="text-xs font-bold uppercase">Phone Free Evening</span>
                        </button>
                    </div>
                </Card>

            </div>
        </Layout>
    );
}
