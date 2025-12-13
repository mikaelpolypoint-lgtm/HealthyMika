import { useState, useEffect } from 'react';
import { Layout } from "../components/Layout";
import { Card, CardTitle } from "../components/Ui";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings as SettingsIcon, Save, Target } from 'lucide-react';

interface AppSettings {
    targetWeight: number;
    targetDate: string; // YYYY-MM-DD
}

export default function Settings() {
    const [settings, setSettings] = useState<AppSettings>({
        targetWeight: 85,
        targetDate: ''
    });
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            const docRef = doc(db, 'settings', 'global');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data() as AppSettings);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSaved(false);
        try {
            await setDoc(doc(db, 'settings', 'global'), settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error("Error saving settings: ", error);
            alert("Failed to save settings");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <header className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        <SettingsIcon size={24} />
                    </div>
                    <h2 className="text-3xl font-bold text-brand-primary">Settings</h2>
                </div>
                <p className="text-slate-500">Customize your goals and preferences.</p>
            </header>

            <div className="max-w-2xl">
                <Card>
                    <CardTitle>Goals & Targets</CardTitle>
                    <form onSubmit={handleSave} className="space-y-6 mt-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Target Weight (kg)</label>
                                <div className="relative">
                                    <Target className="absolute left-3 top-3 text-slate-400" size={20} />
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={settings.targetWeight}
                                        onChange={(e) => setSettings({ ...settings, targetWeight: Number(e.target.value) })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                        placeholder="e.g. 85.0"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">This will update your progress charts.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Target Date</label>
                                <input
                                    type="date"
                                    value={settings.targetDate}
                                    onChange={(e) => setSettings({ ...settings, targetDate: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-800 focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                                />
                                <p className="text-xs text-slate-500 mt-1">When do you want to achieve this goal?</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                            {saved && (
                                <span className="text-sm text-green-600 font-medium animate-in fade-in">
                                    Settings saved successfully!
                                </span>
                            )}
                            <div className="flex-1"></div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 bg-brand-primary hover:bg-sky-900 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-sky-900/10 active:scale-95 disabled:opacity-50 ml-auto"
                            >
                                <Save size={18} />
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </Card>
            </div>
        </Layout>
    );
}
