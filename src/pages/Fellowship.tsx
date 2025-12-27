import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, orderBy, onSnapshot, doc, setDoc, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Heart, BookOpen, MessageCircle, Plus, Trash2, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';

// --- Static Data: New Testament Books ---
const NT_BOOKS = [
    { name: 'Matthew', chapters: 28 }, { name: 'Mark', chapters: 16 }, { name: 'Luke', chapters: 24 }, { name: 'John', chapters: 21 },
    { name: 'Acts', chapters: 28 }, { name: 'Romans', chapters: 16 }, { name: '1 Corinthians', chapters: 16 }, { name: '2 Corinthians', chapters: 13 },
    { name: 'Galatians', chapters: 6 }, { name: 'Ephesians', chapters: 6 }, { name: 'Philippians', chapters: 4 }, { name: 'Colossians', chapters: 4 },
    { name: '1 Thessalonians', chapters: 5 }, { name: '2 Thessalonians', chapters: 3 }, { name: '1 Timothy', chapters: 6 }, { name: '2 Timothy', chapters: 4 },
    { name: 'Titus', chapters: 3 }, { name: 'Philemon', chapters: 1 }, { name: 'Hebrews', chapters: 13 }, { name: 'James', chapters: 5 },
    { name: '1 Peter', chapters: 5 }, { name: '2 Peter', chapters: 3 }, { name: '1 John', chapters: 5 }, { name: '2 John', chapters: 1 },
    { name: '3 John', chapters: 1 }, { name: 'Jude', chapters: 1 }, { name: 'Revelation', chapters: 22 }
];

// --- Interfaces ---
interface PrayerCard {
    id: string;
    title: string;
    createdAt: Timestamp;
    comments: { text: string; date: Timestamp }[];
}

interface DailyFellowshipLog {
    date: string;
    thoughts: string;
    chaptersRead: string[]; // e.g., ["Matthew 1", "Mark 2"]
}


export default function Fellowship() {
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Data State
    const [startedWithJesus, setStartedWithJesus] = useState(false);
    const [dailyLog, setDailyLog] = useState<DailyFellowshipLog>({ date: selectedDate, thoughts: '', chaptersRead: [] });
    const [prayerCards, setPrayerCards] = useState<PrayerCard[]>([]);

    // UI State
    const [newPrayerTitle, setNewPrayerTitle] = useState('');
    const [isAddPrayerOpen, setIsAddPrayerOpen] = useState(false);
    const [activePrayerId, setActivePrayerId] = useState<string | null>(null); // For showing comments
    const [newComment, setNewComment] = useState('');

    // Bible Selector State
    const [selectedBook, setSelectedBook] = useState(NT_BOOKS[0]);
    const [isBookSelectorOpen, setIsBookSelectorOpen] = useState(false);

    // --- Load Data ---
    useEffect(() => {
        // 1. Sync "Start with Jesus" from daily_goals
        const unsubDaily = onSnapshot(doc(db, 'daily_goals', selectedDate), (doc) => {
            if (doc.exists()) {
                setStartedWithJesus(doc.data().jesus || false);
            } else {
                setStartedWithJesus(false);
            }
        });

        // 2. Load Fellowhip Log (Thoughts, Chapters)
        const unsubLog = onSnapshot(doc(db, 'fellowship_logs', selectedDate), (doc) => {
            if (doc.exists()) {
                setDailyLog(doc.data() as DailyFellowshipLog);
            } else {
                setDailyLog({ date: selectedDate, thoughts: '', chaptersRead: [] });
            }
        });

        // 3. Load Prayer Cards (All)
        const qPrayers = query(collection(db, 'prayer_cards'), orderBy('createdAt', 'desc'));
        const unsubPrayers = onSnapshot(qPrayers, (snap) => {
            setPrayerCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as PrayerCard)));
        });

        return () => { unsubDaily(); unsubLog(); unsubPrayers(); };
    }, [selectedDate]);

    // --- Handlers: Start with Jesus ---
    const toggleJesus = async () => {
        const newVal = !startedWithJesus;
        setStartedWithJesus(newVal); // Optimistic
        await setDoc(doc(db, 'daily_goals', selectedDate), { jesus: newVal, date: selectedDate }, { merge: true });
    };

    // --- Handlers: Daily Log ---
    const updateLog = async (updates: Partial<DailyFellowshipLog>) => {
        // Optimistic
        const updated = { ...dailyLog, ...updates };
        setDailyLog(updated);
        await setDoc(doc(db, 'fellowship_logs', selectedDate), updated, { merge: true });
    };

    const toggleChapter = (book: string, chapter: number) => {
        const chapterStr = `${book} ${chapter}`;
        const current = dailyLog.chaptersRead || [];
        let updated;
        if (current.includes(chapterStr)) {
            updated = current.filter(c => c !== chapterStr);
        } else {
            updated = [...current, chapterStr];
        }
        updateLog({ chaptersRead: updated });
    };

    // --- Handlers: Prayer Cards ---
    const addPrayerCard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPrayerTitle.trim()) return;
        await addDoc(collection(db, 'prayer_cards'), {
            title: newPrayerTitle,
            createdAt: Timestamp.now(),
            comments: []
        });
        setNewPrayerTitle('');
        setIsAddPrayerOpen(false);
    };

    const deletePrayerCard = async (id: string) => {
        if (confirm("Delete this prayer card?")) await deleteDoc(doc(db, 'prayer_cards', id));
    };

    const addComment = async (prayerId: string) => {
        if (!newComment.trim()) return;
        const card = prayerCards.find(p => p.id === prayerId);
        if (!card) return;

        const newCommentObj = { text: newComment, date: Timestamp.now() };
        const updatedComments = [...(card.comments || []), newCommentObj];

        // Optimistic update local state for speed perception? Not strictly needed with onSnapshot but good practice
        // Skip local optimistic for arrays complex updates, rely on snapshot

        await setDoc(doc(db, 'prayer_cards', prayerId), { comments: updatedComments }, { merge: true });
        setNewComment('');
    };

    // --- UI Helpers ---
    const isChapterRead = (book: string, chapter: number) => dailyLog.chaptersRead?.includes(`${book} ${chapter}`);

    return (
        <Layout>
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-2 flex items-center gap-2">Fellowship <Heart className="fill-brand-primary text-brand-primary" /></h2>
                    <p className="text-slate-500">Walk with Jesus daily.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                    <CalendarIcon size={20} className="text-slate-400" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="outline-none text-slate-700 font-bold"
                    />
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* --- Left Column: Daily Log (lg:col-span-7) --- */}
                <div className="lg:col-span-7 space-y-6">

                    {/* 1. Start with Jesus */}
                    <Card>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Start Day with Jesus</CardTitle>
                                <p className="text-sm text-slate-500">Did you dedicate your morning to Him?</p>
                            </div>
                            <button
                                onClick={toggleJesus}
                                className={clsx("p-4 rounded-full transition-all duration-300",
                                    startedWithJesus ? "bg-amber-100 text-amber-600 ring-4 ring-amber-50" : "bg-slate-100 text-slate-300 hover:bg-slate-200"
                                )}
                            >
                                <CheckCircle2 size={32} strokeWidth={3} className={startedWithJesus ? "scale-110" : "scale-100"} />
                            </button>
                        </div>
                    </Card>

                    {/* 2. Journal / Thoughts */}
                    <Card>
                        <CardTitle className="flex items-center gap-2"><BookOpen size={20} /> Daily Thoughts & Journal</CardTitle>
                        <textarea
                            value={dailyLog.thoughts}
                            onChange={(e) => updateLog({ thoughts: e.target.value })}
                            placeholder="What is God speaking to you today? Write down your prayers and thoughts..."
                            className="w-full h-40 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 outline-none focus:ring-2 ring-brand-primary/50 transition-all placeholder:text-slate-400 leading-relaxed"
                        />
                    </Card>

                    {/* 3. Bible Tracker */}
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <CardTitle className="mb-0">Bible Study</CardTitle>

                            {/* Book Selector */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsBookSelectorOpen(!isBookSelectorOpen)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-700 transition"
                                >
                                    {selectedBook.name} <ChevronDown size={14} />
                                </button>

                                {isBookSelectorOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 max-h-64 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 z-20 p-2">
                                        {NT_BOOKS.map(book => (
                                            <button
                                                key={book.name}
                                                onClick={() => { setSelectedBook(book); setIsBookSelectorOpen(false); }}
                                                className={clsx("w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors",
                                                    selectedBook.name === book.name ? "text-brand-primary bg-brand-primary/5" : "text-slate-600"
                                                )}
                                            >
                                                {book.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Chapter Grid for Selected Book */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <h4 className="text-sm font-bold text-slate-500 uppercase mb-3 text-center">{selectedBook.name} Chapters</h4>
                            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                                {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(chapter => {
                                    const read = isChapterRead(selectedBook.name, chapter);
                                    return (
                                        <button
                                            key={chapter}
                                            onClick={() => toggleChapter(selectedBook.name, chapter)}
                                            className={clsx("aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-200",
                                                read ? "bg-emerald-500 text-white shadow-md scale-105" : "bg-white border border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-500"
                                            )}
                                        >
                                            {chapter}
                                        </button>
                                    )
                                })}
                            </div>
                            <p className="text-xs text-center text-slate-400 mt-3 italic">Click to mark read for {format(new Date(selectedDate), 'MMM do')}</p>
                        </div>

                        {/* Summary of what was read today */}
                        <div className="mt-4">
                            <span className="text-xs font-bold text-slate-400 uppercase">Read Today:</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {dailyLog.chaptersRead?.length === 0 && <span className="text-sm text-slate-400 italic">No chapters logged.</span>}
                                {dailyLog.chaptersRead?.map(entry => (
                                    <span key={entry} className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md border border-emerald-200">
                                        {entry}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </Card>

                </div>


                {/* --- Right Column: Prayer Cards (lg:col-span-5) --- */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-slate-700">Prayer Cards</h3>
                        <button
                            onClick={() => setIsAddPrayerOpen(!isAddPrayerOpen)}
                            className="flex items-center gap-1 text-sm font-bold text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-lg hover:bg-brand-primary/20 transition-colors"
                        >
                            <Plus size={16} /> New Card
                        </button>
                    </div>

                    {/* Add New Card Form */}
                    {isAddPrayerOpen && (
                        <form onSubmit={addPrayerCard} className="bg-white p-4 rounded-xl border border-brand-primary/30 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <input
                                autoFocus
                                value={newPrayerTitle}
                                onChange={e => setNewPrayerTitle(e.target.value)}
                                placeholder="Prayer title..."
                                className="w-full text-lg font-bold border-none outline-none placeholder:text-slate-300 text-slate-800 mb-2"
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsAddPrayerOpen(false)} className="text-xs font-bold text-slate-400 px-3 py-1.5 hover:text-slate-600">Cancel</button>
                                <button type="submit" className="text-xs font-bold bg-brand-primary text-white px-4 py-1.5 rounded-lg shadow-sm hover:bg-brand-primary-dark">Save</button>
                            </div>
                        </form>
                    )}

                    {/* Cards List */}
                    <div className="space-y-4">
                        {prayerCards.length === 0 && !isAddPrayerOpen && (
                            <div className="text-center py-10 opacity-50">
                                <Heart size={48} className="mx-auto mb-2 text-slate-300" />
                                <p className="text-slate-400 font-medium">No prayer cards yet.</p>
                            </div>
                        )}

                        {prayerCards.map(card => (
                            <div key={card.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden group">
                                <div className="p-4 cursor-pointer" onClick={() => setActivePrayerId(activePrayerId === card.id ? null : card.id)}>
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-800 text-lg leading-tight">{card.title}</h4>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deletePrayerCard(card.id); }}
                                            className="text-slate-300 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wide">
                                        Started {card.createdAt?.toDate().toLocaleDateString()}
                                    </p>

                                    <div className="flex items-center gap-1 mt-3 text-xs font-bold text-slate-400">
                                        <MessageCircle size={14} /> {card.comments?.length || 0} updates
                                        <ChevronRight size={14} className={clsx("ml-auto transition-transform", activePrayerId === card.id && "rotate-90")} />
                                    </div>
                                </div>

                                {/* Expanded Comments Section */}
                                {activePrayerId === card.id && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-4 animate-in fade-in">
                                        <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                                            {card.comments?.map((comment, idx) => (
                                                <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm text-sm">
                                                    <p className="text-slate-700 mb-1">{comment.text}</p>
                                                    <p className="text-[10px] text-slate-400 text-right">{new Date(comment.date.toDate()).toLocaleDateString()}</p>
                                                </div>
                                            ))}
                                            {(!card.comments || card.comments.length === 0) && <p className="text-xs text-slate-400 italic text-center py-2">No updates yet.</p>}
                                        </div>

                                        <div className="flex gap-2">
                                            <input
                                                value={newComment}
                                                onChange={e => setNewComment(e.target.value)}
                                                placeholder="Add an update..."
                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-primary"
                                                onKeyDown={e => e.key === 'Enter' && addComment(card.id)}
                                            />
                                            <button
                                                onClick={() => addComment(card.id)}
                                                className="bg-brand-primary text-white p-2 rounded-lg hover:bg-brand-primary-dark"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </Layout>
    );
}
