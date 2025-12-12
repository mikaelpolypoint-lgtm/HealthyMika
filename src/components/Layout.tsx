import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Scale, Bike, Dumbbell, Apple, Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const navItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/' },
    { icon: Scale, label: 'Weight', path: '/weight' },
    { icon: Bike, label: 'Cardio', path: '/cardio' },
    { icon: Dumbbell, label: 'Strength', path: '/strength' },
    { icon: Activity, label: 'Bodyweight', path: '/bodyweight' },
    { icon: Apple, label: 'Food', path: '/food' },
];

export function Layout({ children }: { children: React.ReactNode }) {
    const location = useLocation();

    return (
        <div className="flex min-h-screen bg-brand-background font-sans text-slate-900">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-200 bg-white fixed inset-y-0 z-50 flex flex-col">
                <div className="p-6 border-b border-slate-100">
                    <h1 className="text-2xl font-bold text-brand-primary">
                        HealthyMika
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={twMerge(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group font-medium",
                                    isActive
                                        ? "bg-brand-primary/5 text-brand-primary border-r-2 border-brand-primary"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                <Icon size={20} className={clsx("transition-transform group-hover:scale-105", isActive && "text-brand-primary")} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 px-4 py-2">
                        <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold">M</div>
                        <div>
                            <p className="text-sm font-bold text-slate-700">Mikael</p>
                            <p className="text-xs text-slate-400">Pro Member</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
