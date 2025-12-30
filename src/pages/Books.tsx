import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, onSnapshot, doc, Timestamp, addDoc, deleteDoc, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Star, Trash2, Edit2, Check, X, Plus, BookOpen, Flame, Calendar, Upload, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';

interface Book {
    id: string;
    title: string;
    author?: string;
    totalPages: number;
    pagesRead: number;
    coverUrl?: string; // URL for book cover
    startedAt: Timestamp;
    finishedAt?: Timestamp; // If present, book is finished
    notes?: string;
    rating?: number; // 1-5
    streak?: number; // Days in a row read (mock for now or calculated)
}

// Mock Settings for Goal (Replace with actual settings fetch if available)
const YEARLY_GOAL = 12;

export default function Books() {
    const [books, setBooks] = useState<Book[]>([]);
    const [isAdding, setIsAdding] = useState(false);

    // New Book Form
    const [newTitle, setNewTitle] = useState('');
    const [newAuthor, setNewAuthor] = useState('');
    const [newTotalPages, setNewTotalPages] = useState<string>(''); // usage as string for input
    const [newCoverUrl, setNewCoverUrl] = useState('');
    const [newStartDate, setNewStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isUploading, setIsUploading] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Book>>({});

    // Load Books
    useEffect(() => {
        const q = query(collection(db, 'books'), orderBy('startedAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setBooks(snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    // Migrations / Defaults for old data
                    totalPages: data.totalPages || 300,
                    pagesRead: data.pagesRead || (data.progress ? Math.round((data.progress / 100) * (data.totalPages || 300)) : 0),
                    streak: data.streak || 0
                } as Book;
            }));
        });
        return () => unsub();
    }, []);

    // Handlers
    const addBook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle) return;
        await addDoc(collection(db, 'books'), {
            title: newTitle,
            author: newAuthor,
            totalPages: Number(newTotalPages) || 300,
            pagesRead: 0,
            coverUrl: newCoverUrl,
            startedAt: newStartDate ? Timestamp.fromDate(new Date(newStartDate)) : Timestamp.now(),
            streak: 0
        });
        setNewTitle('');
        setNewAuthor('');
        setNewTotalPages('');
        setNewCoverUrl('');
        setNewStartDate(format(new Date(), 'yyyy-MM-dd'));
        setIsAdding(false);
    };

    const deleteBook = async (id: string) => {
        if (confirm('Delete this book permanently?')) {
            await deleteDoc(doc(db, 'books', id));
        }
    };

    const updatePagesRead = async (id: string, newPage: number, total: number) => {
        const safePage = Math.min(total, Math.max(0, newPage));
        const isFinished = safePage === total;

        await updateDoc(doc(db, 'books', id), {
            pagesRead: safePage,
            finishedAt: isFinished ? Timestamp.now() : null
        });
    };

    const handleDataUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        // Validation (Max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert("File is too large. Max 2MB.");
            return;
        }

        setIsUploading(true);
        try {
            const storageRef = ref(storage, `covers/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const url = await getDownloadURL(snapshot.ref);
            if (isEdit) {
                setEditForm(prev => ({ ...prev, coverUrl: url }));
            } else {
                setNewCoverUrl(url);
            }
        } catch (error) {
            console.error("Upload failed", error);
            alert("Upload failed. Try again.");
        } finally {
            setIsUploading(false);
        }
    };

    const startEditing = (book: Book) => {
        setEditingId(book.id);
        setEditForm({ ...book });
    };

    const saveEdit = async () => {
        if (!editingId || !editForm) return;

        // Handle Date Objects if edited (mocking simpler date update for now via text inputs or similar?? 
        // For simpler UX, we'll just update fields present in form)

        await updateDoc(doc(db, 'books', editingId), editForm);
        setEditingId(null);
        setEditForm({});
    };

    // Derived Stats
    const finishedBooks = books.filter(b => b.pagesRead >= b.totalPages);
    const currentBooks = books.filter(b => b.pagesRead < b.totalPages);
    const booksThisYear = finishedBooks.filter(b => b.finishedAt && b.finishedAt.toDate().getFullYear() === new Date().getFullYear());


    return (
        <Layout>
            <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-2">Books Library 📚</h2>
                    <p className="text-slate-500">Track your reading journey, page by page.</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-brand-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-sky-900 transition-colors shadow-lg shadow-brand-primary/20"
                >
                    <Plus size={18} /> Add Book
                </button>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Current</span>
                    <p className="text-3xl font-bold text-slate-700">{currentBooks.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Pages Read</span>
                    <p className="text-3xl font-bold text-indigo-600">{books.reduce((a, b) => a + b.pagesRead, 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Avg Rating</span>
                    <p className="text-3xl font-bold text-amber-500">
                        {(finishedBooks.reduce((a, b) => a + (b.rating || 0), 0) / (finishedBooks.filter(b => b.rating).length || 1)).toFixed(1)}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <span className="text-xs font-bold text-slate-400 uppercase">{new Date().getFullYear()} Goal</span>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <p className="text-3xl font-bold text-brand-primary">{booksThisYear.length}</p>
                        <span className="text-slate-400 text-sm font-bold">/ {YEARLY_GOAL}</span>
                    </div>
                    {/* Progress Bar Background */}
                    <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full">
                        <div
                            className="h-full bg-brand-primary transition-all duration-1000"
                            style={{ width: `${Math.min(100, (booksThisYear.length / YEARLY_GOAL) * 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Add Book Form */}
            {isAdding && (
                <Card className="mb-8 border-2 border-brand-primary/10 animate-in slide-in-from-top-4">
                    <CardTitle>Add New Book</CardTitle>
                    <form onSubmit={addBook} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            value={newTitle} onChange={e => setNewTitle(e.target.value)}
                            placeholder="Book Title" className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none font-bold col-span-2 md:col-span-1"
                            autoFocus
                        />
                        <input
                            value={newAuthor} onChange={e => setNewAuthor(e.target.value)}
                            placeholder="Author" className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none"
                        />
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={newTotalPages} onChange={e => setNewTotalPages(e.target.value)}
                                placeholder="Total Pages" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none"
                            />
                            <input
                                type="date"
                                value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none text-slate-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <input
                                value={newCoverUrl} onChange={e => setNewCoverUrl(e.target.value)}
                                placeholder="Cover Image URL (https://...)"
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none text-xs font-mono text-slate-500"
                            />
                            <label className={clsx("cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 rounded-lg px-3 flex items-center justify-center transition-colors", isUploading && "opacity-50 pointer-events-none")}>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDataUpload(e, false)} />
                                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            </label>
                        </div>
                        <button className="bg-brand-primary text-white rounded-lg font-bold py-2 col-span-2 hover:bg-sky-900 transition-colors" disabled={isUploading}>Start Reading</button>
                    </form>
                </Card>
            )}

            <div className="space-y-12">
                {/* CURRENTLY READING */}
                <section>
                    <h3 className="text-xl font-bold text-slate-700 mb-6 flex items-center gap-2"><BookOpen className="text-brand-primary" /> Currently Reading</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {currentBooks.map(book => (
                            <div key={book.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4 h-48 relative group hover:shadow-md transition-all">
                                {/* Cover Image */}
                                <div className="w-28 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shadow-inner relative">
                                    {book.coverUrl ? (
                                        <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <BookOpen size={32} />
                                        </div>
                                    )}
                                    {/* Streak Badge */}
                                    {book.streak ? (
                                        <div className="absolute top-1 left-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                            <Flame size={8} fill="currentColor" /> {book.streak}
                                        </div>
                                    ) : null}
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col justify-between py-1">
                                    {editingId === book.id ? (
                                        <div className="space-y-2 text-xs">
                                            <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full font-bold border-b p-1" />
                                            <input value={editForm.author} onChange={e => setEditForm({ ...editForm, author: e.target.value })} className="w-full border-b p-1" placeholder="Author" />
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    value={editForm.totalPages}
                                                    onChange={e => setEditForm({ ...editForm, totalPages: Number(e.target.value) })}
                                                    className="w-16 border-b p-1" placeholder="Pages"
                                                />
                                                <input
                                                    type="date"
                                                    value={editForm.startedAt ? format(editForm.startedAt.toDate(), 'yyyy-MM-dd') : ''}
                                                    onChange={e => setEditForm({ ...editForm, startedAt: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : Timestamp.now() })}
                                                    className="flex-1 border-b p-1"
                                                />
                                            </div>
                                            <div className="flex gap-1 items-center">
                                                <input value={editForm.coverUrl} onChange={e => setEditForm({ ...editForm, coverUrl: e.target.value })} className="flex-1 border-b p-1" placeholder="Cover URL" />
                                                <label className="cursor-pointer text-slate-400 hover:text-brand-primary p-1">
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleDataUpload(e, true)} />
                                                    <Upload size={14} />
                                                </label>
                                            </div>

                                            <div className="flex justify-end gap-2 mt-2">
                                                <button onClick={saveEdit} className="bg-emerald-500 text-white p-1 rounded"><Check size={14} /></button>
                                                <button onClick={() => setEditingId(null)} className="bg-slate-200 text-slate-500 p-1 rounded"><X size={14} /></button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <h4 className="font-bold text-slate-800 leading-tight mb-1 line-clamp-2" title={book.title}>{book.title}</h4>
                                                <p className="text-xs text-slate-500 font-medium mb-2">{book.author || 'Unknown'}</p>
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-2xl font-bold text-slate-700">{book.pagesRead} <span className="text-xs text-slate-400 font-normal">/ {book.totalPages}</span></span>
                                                    <span className="text-xs font-bold text-brand-primary">{Math.round((book.pagesRead / book.totalPages) * 100)}%</span>
                                                </div>
                                                {/* Progress Bar with Slider */}
                                                <input
                                                    type="range" min="0" max={book.totalPages}
                                                    value={book.pagesRead}
                                                    onChange={(e) => updatePagesRead(book.id, Number(e.target.value), book.totalPages)}
                                                    className="w-full accent-brand-primary h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>

                                            {/* Started At Date */}
                                            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                                                <Calendar size={10} /> {format(book.startedAt.toDate(), 'MMM d, yyyy')}
                                            </p>
                                        </>
                                    )}
                                </div>

                                {/* Hover Actions */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/80 backdrop-blur-sm p-1 rounded-lg">
                                    <button onClick={() => startEditing(book)} className="text-slate-400 hover:text-brand-primary p-1"><Edit2 size={12} /></button>
                                    <button onClick={() => deleteBook(book.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                        {/* Card to Add new */}
                        <button onClick={() => setIsAdding(true)} className="border-2 border-dashed border-slate-200 rounded-2xl h-48 flex flex-col items-center justify-center text-slate-400 hover:border-brand-primary hover:text-brand-primary transition-all gap-2 group">
                            <div className="p-3 bg-slate-50 rounded-full group-hover:bg-sky-50 transition-colors"><Plus size={24} /></div>
                            <span className="font-bold text-sm">Add Next Read</span>
                        </button>
                    </div>
                </section>

                {/* FINISHED BOOKS */}
                <section>
                    <h3 className="text-xl font-bold text-slate-700 mb-6 flex items-center gap-2">✅ Library of Done</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {finishedBooks.map(book => (
                            <div key={book.id} className="group relative">
                                {/* Simple Book Cover View */}
                                <div className="aspect-[2/3] bg-slate-200 rounded-lg shadow-sm border border-slate-200 overflow-hidden relative transition-transform hover:-translate-y-1 hover:shadow-md">
                                    {book.coverUrl ? (
                                        <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center bg-slate-100">
                                            <BookOpen size={24} className="mb-2 opacity-50" />
                                            <span className="text-[10px] font-bold line-clamp-3 leading-tight text-slate-500">{book.title}</span>
                                        </div>
                                    )}

                                    {/* Rating Badge */}
                                    {book.rating && (
                                        <div className="absolute top-1 right-1 bg-black/50 backdrop-blur-md text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                                            {book.rating} <Star size={8} className="fill-amber-400 text-amber-400" />
                                        </div>
                                    )}
                                </div>

                                {/* Hover Details / Edit */}
                                {editingId === book.id ? (
                                    <div className="absolute inset-0 bg-white z-20 p-2 rounded shadow-xl flex flex-col gap-2 text-xs border border-brand-primary overflow-y-auto">
                                        <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="font-bold border-b" />
                                        <div className="flex gap-1">
                                            <div className="flex flex-col gap-1 w-full">
                                                <label className="text-[10px] text-slate-400 font-bold">Start</label>
                                                <input
                                                    type="date"
                                                    value={editForm.startedAt ? format(editForm.startedAt.toDate(), 'yyyy-MM-dd') : ''}
                                                    onChange={e => setEditForm({ ...editForm, startedAt: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : Timestamp.now() })}
                                                    className="w-full border-b p-0.5 text-[10px]"
                                                />
                                                <label className="text-[10px] text-slate-400 font-bold">End</label>
                                                <input
                                                    type="date"
                                                    value={editForm.finishedAt ? format(editForm.finishedAt.toDate(), 'yyyy-MM-dd') : ''}
                                                    onChange={e => setEditForm({ ...editForm, finishedAt: e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : undefined })}
                                                    className="w-full border-b p-0.5 text-[10px]"
                                                />
                                                <label className="text-[10px] text-slate-400 font-bold">Pages</label>
                                                <input
                                                    type="number"
                                                    value={editForm.totalPages}
                                                    onChange={e => setEditForm({ ...editForm, totalPages: Number(e.target.value) })}
                                                    className="w-full border-b p-0.5 text-[10px]" placeholder="Pages"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-1 justify-center py-2">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <Star key={s} size={12} className={s <= (editForm.rating || 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"} onClick={() => setEditForm({ ...editForm, rating: s })} />
                                            ))}
                                        </div>
                                        <div className="mt-auto flex justify-between">
                                            <button onClick={() => deleteBook(book.id)} className="text-red-400"><Trash2 size={14} /></button>
                                            <button onClick={saveEdit} className="text-emerald-500"><Check size={14} /></button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
                                        <button onClick={() => startEditing(book)} className="bg-white text-slate-500 p-1 rounded-full shadow hover:text-brand-primary"><Edit2 size={10} /></button>
                                    </div>
                                )}

                                <p className="text-xs font-medium text-slate-700 mt-2 truncate">{book.title}</p>
                                <p className="text-[10px] text-slate-400 truncate">{book.author}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </Layout>
    );
}
