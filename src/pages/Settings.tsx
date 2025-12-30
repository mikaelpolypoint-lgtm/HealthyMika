import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, Button } from "../components/Ui";
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { clsx } from 'clsx';

// --- Types ---
export interface GoalConfig {
    id: string;
    slug: string; // Unique ID for logic mapping (e.g., 'run', 'bike', 'weight')
    name: string;
    description: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    targetType: 'value' | 'boolean'; // 'value' for numbers
    weeklyTarget: number;
    monthlyTarget: number;
    yearlyTarget: number;
    unit?: string; // kg, km, books, etc.
    color?: string; // hex or tailwind class for UI
}



export default function Settings() {
    const [goals, setGoals] = useState<GoalConfig[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<GoalConfig>>({});
    const [isAdding, setIsAdding] = useState(false);

    // Load Goals
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'goals'), (snap) => {
            const fetchedGoals = snap.docs.map(d => ({ id: d.id, ...d.data() } as GoalConfig));
            setGoals(fetchedGoals);
        });
        return () => unsub();
    }, []);



    const handleEdit = (goal: GoalConfig) => {
        setEditingId(goal.id);
        setEditForm(goal);
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditForm({});
        setIsAdding(false);
    };

    const handleSave = async () => {
        if (!editForm.name) return; // Basic validation

        if (editingId) {
            // Update
            await setDoc(doc(db, 'goals', editingId), editForm, { merge: true });
        } else {
            // Add
            await addDoc(collection(db, 'goals'), editForm);
        }
        handleCancel();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this goal?')) {
            await deleteDoc(doc(db, 'goals', id));
        }
    };

    const handleChange = (field: keyof GoalConfig, value: any) => {
        setEditForm(prev => {
            const updates: Partial<GoalConfig> = { [field]: value };

            // Auto-calculate relative targets
            if (typeof value === 'number' && !isNaN(value)) {
                const W_TO_Y = 52.1429; // 365 / 7
                const M_TO_Y = 12;
                const W_TO_M = 4.3452; // (365 / 7) / 12

                if (field === 'weeklyTarget') {
                    updates.yearlyTarget = parseFloat((value * W_TO_Y).toFixed(1));
                    updates.monthlyTarget = parseFloat((value * W_TO_M).toFixed(1));
                } else if (field === 'monthlyTarget') {
                    updates.yearlyTarget = parseFloat((value * M_TO_Y).toFixed(1));
                    updates.weeklyTarget = parseFloat((value / W_TO_M).toFixed(1));
                } else if (field === 'yearlyTarget') {
                    updates.monthlyTarget = parseFloat((value / M_TO_Y).toFixed(1));
                    updates.weeklyTarget = parseFloat((value / W_TO_Y).toFixed(1));
                }
            }
            return { ...prev, ...updates };
        });
    };

    return (
        <Layout>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-brand-primary">Settings & Goals ⚙️</h2>
                <div className="flex gap-2">
                    <Button onClick={() => { setIsAdding(true); setEditForm({ targetType: 'value' }); }}>
                        <Plus size={18} className="mr-2" /> Add Goal
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {isAdding && (
                    <GoalEditor
                        form={editForm}
                        onChange={handleChange}
                        onSave={handleSave}
                        onCancel={handleCancel}
                    />
                )}

                {goals.map(goal => (
                    <div key={goal.id}>
                        {editingId === goal.id ? (
                            <GoalEditor
                                form={editForm}
                                onChange={handleChange}
                                onSave={handleSave}
                                onCancel={handleCancel}
                            />
                        ) : (
                            <Card className={clsx("p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group transition-all",
                                `hover:border-${goal.color}-200 hover:shadow-md`
                            )}>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={clsx("w-3 h-3 rounded-full", `bg-${goal.color}-500`)}></div>
                                        <h3 className="text-xl font-bold text-slate-800">{goal.name}</h3>
                                        <span className="text-xs font-mono bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">
                                            {goal.slug}
                                        </span>
                                    </div>
                                    <p className="text-slate-500 text-sm mb-2">{goal.description}</p>
                                    <div className="flex flex-wrap gap-2 text-sm font-medium text-slate-600">
                                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                            Wk: {goal.weeklyTarget}
                                        </span>
                                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                            Mo: {goal.monthlyTarget}
                                        </span>
                                        <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                            Yr: {goal.yearlyTarget}
                                        </span>
                                        <span className="text-xs text-slate-400 self-center">{goal.unit}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="outline" size="sm" onClick={() => handleEdit(goal)}>
                                        <Edit2 size={16} />
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDelete(goal.id)}>
                                        <Trash2 size={16} />
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </div>
                ))}
            </div>
        </Layout>
    );
}

function GoalEditor({ form, onChange, onSave, onCancel }: {
    form: Partial<GoalConfig>,
    onChange: (field: keyof GoalConfig, val: any) => void,
    onSave: () => void,
    onCancel: () => void
}) {
    return (
        <Card className="p-6 border-2 border-brand-primary/20 shadow-lg bg-brand-primary/5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Goal Name</label>
                    <input
                        type="text"
                        value={form.name || ''}
                        onChange={e => onChange('name', e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none"
                        placeholder="e.g. Running"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Slug (Logic ID)</label>
                    <input
                        type="text"
                        value={form.slug || ''}
                        onChange={e => onChange('slug', e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none font-mono text-sm"
                        placeholder="e.g. run"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                    <input
                        type="text"
                        value={form.description || ''}
                        onChange={e => onChange('description', e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none"
                        placeholder="Brief description..."
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                    <input
                        type="date"
                        value={form.startDate || ''}
                        onChange={e => onChange('startDate', e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
                    <input
                        type="date"
                        value={form.endDate || ''}
                        onChange={e => onChange('endDate', e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none"
                    />
                </div>

                <div className="md:col-span-2 grid grid-cols-3 gap-4 bg-white p-3 rounded-lg border border-slate-200">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Weekly Target</label>
                        <input
                            type="number"
                            step="0.1"
                            value={form.weeklyTarget || 0}
                            onChange={e => onChange('weeklyTarget', parseFloat(e.target.value))}
                            className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Target</label>
                        <input
                            type="number"
                            step="0.1"
                            value={form.monthlyTarget || 0}
                            onChange={e => onChange('monthlyTarget', parseFloat(e.target.value))}
                            className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Yearly Target</label>
                        <input
                            type="number"
                            step="0.1"
                            value={form.yearlyTarget || 0}
                            onChange={e => onChange('yearlyTarget', parseFloat(e.target.value))}
                            className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit</label>
                    <input
                        type="text"
                        value={form.unit || ''}
                        onChange={e => onChange('unit', e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none"
                        placeholder="e.g. km"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Color Theme</label>
                    <select
                        value={form.color || 'slate'}
                        onChange={e => onChange('color', e.target.value)}
                        className="w-full p-2 rounded border border-slate-300 focus:border-brand-primary outline-none"
                    >
                        <option value="slate">Slate (Default)</option>
                        <option value="rose">Rose (Red)</option>
                        <option value="cyan">Cyan (Blue-Green)</option>
                        <option value="indigo">Indigo (Blue-Purple)</option>
                        <option value="emerald">Emerald (Green)</option>
                        <option value="amber">Amber (Orange)</option>
                        <option value="purple">Purple</option>
                    </select>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}><X size={18} className="mr-1" /> Cancel</Button>
                <Button onClick={onSave}><Save size={18} className="mr-1" /> Save Goal</Button>
            </div>
        </Card>
    );
}
