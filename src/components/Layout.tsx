import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Scale, Bike, Dumbbell, Apple, Activity, LogOut, Menu, X, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useState } from 'react';

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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
    const closeMenu = () => setIsMobileMenuOpen(false);

    return (
        <div className="flex min-h-screen bg-brand-background font-sans text-slate-900">
            {/* Mobile Header */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-50 flex items-center justify-between px-4">
                <h1 className="text-xl font-bold text-brand-primary">MikaFit</h1>
                <button onClick={toggleMenu} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </header>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm"
                    onClick={closeMenu}
                />
            )}

            {/* Sidebar */}
            <aside className={twMerge(
                "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0",
                isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
            )}>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-brand-primary">
                        MikaFit
                    </h1>
                    <button onClick={closeMenu} className="md:hidden text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={closeMenu}
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

                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between px-2 py-2">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold flex-shrink-0">
                                {auth.currentUser?.email?.[0].toUpperCase() || 'U'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-slate-700 truncate">{auth.currentUser?.email || 'User'}</p>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <Link to="/settings" className="text-slate-400 hover:text-brand-primary transition-colors p-2" title="Settings">
                                <Settings size={18} />
                            </Link>
                            <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-500 transition-colors p-2" title="Sign Out">
                                <LogOut size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8 min-h-screen">
                <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
