import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { collection, query, onSnapshot, doc, setDoc, Timestamp, addDoc, deleteDoc, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BookOpen, Star, Trash2, Edit2, Check, X, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

interface Book {
    id: string;
    title: string;
    author?: string;
    progress: number; // 0-100
    startedAt: Timestamp;
    finishedAt?: Timestamp;
    notes?: string;
    rating?: number; // 1-5
    category?: string; // e.g. "Theology", "Business", "Fiction"
}

export default function Learning() {
    const [books, setBooks] = useState<Book[]>([]);
    const [isAdding, setIsAdding] = useState(false);

    // New Book Form
    const [newTitle, setNewTitle] = useState('');
    const [newAuthor, setNewAuthor] = useState('');
    const [newCategory, setNewCategory] = useState('General');

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Book>>({});

    // Load Books
    useEffect(() => {
        const q = query(collection(db, 'books'), orderBy('startedAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Book)));
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
            category: newCategory,
            progress: 0,
            startedAt: Timestamp.now()
        });
        setNewTitle('');
        setNewAuthor('');
        setNewCategory('General');
        setIsAdding(false);
    };

    const deleteBook = async (id: string) => {
        if (confirm('Delete this book permanently?')) {
            await deleteDoc(doc(db, 'books', id));
        }
    };

    const updateBookProgress = async (id: string, val: number) => {
        const safeVal = Math.min(100, Math.max(0, val));
        await updateDoc(doc(db, 'books', id), {
            progress: safeVal,
            finishedAt: safeVal === 100 ? Timestamp.now() : null
        });
    };

    const startEditing = (book: Book) => {
        setEditingId(book.id);
        setEditForm({ ...book });
    };

    const saveEdit = async () => {
        if (!editingId || !editForm) return;
        await updateDoc(doc(db, 'books', editingId), editForm);
        setEditingId(null);
        setEditForm({});
    };

    // Derived Stats
    const booksRead2026 = books.filter(b => b.progress === 100 && b.finishedAt?.toDate().getFullYear() === 2026).length; // Adjust logic if needed for fiscal year
    // Simple filter for "Finished" generally for now or use the flag
    const finishedBooks = books.filter(b => b.progress === 100);
    const currentBooks = books.filter(b => b.progress < 100);

    return (
        <Layout>
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold text-brand-primary mb-2">Learning & Library 📚</h2>
                    <p className="text-slate-500">Sharpening the mind.</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-brand-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-sky-900 transition-colors"
                >
                    <Plus size={18} /> Add Book
                </button>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase">Current</span>
                    <p className="text-3xl font-bold text-slate-700">{currentBooks.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase">Finished</span>
                    <p className="text-3xl font-bold text-emerald-600">{finishedBooks.length}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase">Avg Rating</span>
                    <p className="text-3xl font-bold text-amber-500">
                        {(finishedBooks.reduce((a, b) => a + (b.rating || 0), 0) / (finishedBooks.filter(b => b.rating).length || 1)).toFixed(1)}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase">2026 Goal</span>
                    <p className="text-3xl font-bold text-blue-600">{finishedBooks.length}<span className="text-slate-300 text-lg">/12</span></p>
                </div>
            </div>

            {/* Add Book Form */}
            {isAdding && (
                <Card className="mb-8 border-2 border-brand-primary/10">
                    <CardTitle>Add New Book</CardTitle>
                    <form onSubmit={addBook} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            value={newTitle} onChange={e => setNewTitle(e.target.value)}
                            placeholder="Book Title" className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none font-bold"
                            autoFocus
                        />
                        <input
                            value={newAuthor} onChange={e => setNewAuthor(e.target.value)}
                            placeholder="Author (Optional)" className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none"
                        />
                        <select
                            value={newCategory} onChange={e => setNewCategory(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 outline-none"
                        >
                            <option value="General">General</option>
                            <option value="Theology">Theology</option>
                            <option value="Business">Business</option>
                            <option value="Fiction">Fiction</option>
                            <option value="Biography">Biography</option>
                            <option value="Health">Health</option>
                        </select>
                        <button className="bg-brand-primary text-white rounded-lg font-bold">Save Book</button>
                    </form>
                </Card>
            )}

            <div className="space-y-8">
                {/* CURRENTLY READING */}
                <section>
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">📖 Currently Reading</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {currentBooks.map(book => (
                            <Card key={book.id} className="relative group hover:shadow-md transition-all">
                                {editingId === book.id ? (
                                    <div className="space-y-3">
                                        <input
                                            value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                            className="w-full font-bold border-b border-brand-primary outline-none"
                                        />
                                        <input
                                            value={editForm.author} onChange={e => setEditForm({ ...editForm, author: e.target.value })}
                                            className="w-full text-sm border-b border-slate-200 outline-none" placeholder="Author"
                                        />
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button onClick={saveEdit} className="bg-emerald-500 text-white p-1 rounded"><Check size={16} /></button>
                                            <button onClick={() => setEditingId(null)} className="bg-slate-200 text-slate-500 p-1 rounded"><X size={16} /></button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-lg leading-tight">{book.title}</h4>
                                                <p className="text-xs text-slate-500 font-medium">{book.author || 'Unknown Author'}</p>
                                            </div>
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full">{book.category || 'Book'}</span>
                                        </div>

                                        <div className="mt-4">
                                            <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                                                <span>Progress</span>
                                                <span className="text-brand-primary">{book.progress}%</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="range" min="0" max="100"
                                                    value={book.progress}
                                                    onChange={(e) => updateBookProgress(book.id, Number(e.target.value))}
                                                    className="flex-1 accent-brand-primary h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>

                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-white/90 p-1 rounded-lg shadow-sm">
                                            <button onClick={() => startEditing(book)} className="text-slate-400 hover:text-brand-primary"><Edit2 size={14} /></button>
                                            <button onClick={() => deleteBook(book.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                                        </div>
                                    </>
                                )}
                            </Card>
                        ))}
                    </div>
                </section>

                {/* FINISHED BOOKS */}
                <section>
                    <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">✅ Finished Library</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {finishedBooks.map(book => (
                            <div key={book.id} className="bg-white border border-slate-100 rounded-xl p-4 opacity-80 hover:opacity-100 transition-opacity relative group">
                                {editingId === book.id ? (
                                    <div className="space-y-2 z-10 relative">
                                        <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full font-bold border-b" />
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <Star key={s} size={16}
                                                    className={s <= (editForm.rating || 0) ? "fill-amber-400 text-amber-400 cursor-pointer" : "text-slate-200 cursor-pointer"}
                                                    onClick={() => setEditForm({ ...editForm, rating: s })}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={saveEdit} className="text-emerald-600"><Check size={16} /></button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-slate-700 text-sm line-through decoration-slate-300">{book.title}</h4>
                                            {book.rating ? (
                                                <div className="flex text-amber-400"><span className="text-xs font-bold">{book.rating}</span><Star size={12} className="fill-amber-400" /></div>
                                            ) : (
                                                <span className="text-[10px] text-slate-300">Unrated</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400">{book.author}</p>
                                        <p className="text-[10px] text-slate-300 mt-2">Finished {book.finishedAt ? format(book.finishedAt.toDate(), 'MMM d, yyyy') : ''}</p>

                                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-white p-1 shadow-sm rounded">
                                            <button onClick={() => startEditing(book)} className="text-slate-400 hover:text-brand-primary"><Edit2 size={12} /></button>
                                            <button onClick={() => deleteBook(book.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </Layout>
    );
}
