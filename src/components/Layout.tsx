import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Scale, Bike, Dumbbell, Apple, Activity, LogOut, Menu, X, Settings, Footprints, BookOpen, PenTool, Trophy, Heart, GraduationCap, Leaf, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useState } from 'react';
import Logo from '../assets/MiKI_life_Logo.png';

const navItems = [
    { icon: PenTool, label: 'Daily', path: '/' },
    { icon: LayoutDashboard, label: 'Goals', path: '/dashboard' },
    { icon: GraduationCap, label: 'Life', path: '/life' },
    { icon: BookOpen, label: 'Books', path: '/books', indent: true },
    { icon: Wallet, label: 'Budget', path: '/budget', indent: true },

    { icon: Leaf, label: 'Less is More', path: '/less-is-more', indent: true },
    { icon: Heart, label: 'Health', path: '/health' },
    { icon: Scale, label: 'Weight', path: '/weight', indent: true },
    { icon: Apple, label: 'Food', path: '/food', indent: true },
    { icon: Trophy, label: 'Sport', path: '/sport' },
    { icon: Bike, label: 'Cycling', path: '/biking', indent: true },
    { icon: Footprints, label: 'Running', path: '/running', indent: true },
    { icon: Dumbbell, label: 'Strength', path: '/strength', indent: true },
    { icon: Activity, label: 'Bodyweight', path: '/bodyweight', indent: true },
    // Divider
    { type: 'divider' },
    { icon: Settings, label: 'Settings', path: '/settings' },
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
                <Link to="/" onClick={closeMenu}>
                    <img src={Logo} alt="MiKI Life" className="h-8 w-auto object-contain" />
                </Link>
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
                    <Link to="/" onClick={closeMenu}>
                        <img src={Logo} alt="MiKI Life" className="h-10 w-auto object-contain" />
                    </Link>
                    <button onClick={closeMenu} className="md:hidden text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item, i) => {
                        if (item.type === 'divider') {
                            return <div key={`divider-${i}`} className="my-2 h-px bg-slate-100" />
                        }

                        // Cast to ensure type safety for regular items
                        const navLink = item as { icon: typeof LayoutDashboard, label: string, path: string, indent?: boolean };
                        const isActive = location.pathname === navLink.path;
                        const Icon = navLink.icon;
                        const isChild = navLink.indent;

                        return (
                            <Link
                                key={navLink.path}
                                to={navLink.path}
                                onClick={closeMenu}
                                className={twMerge(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group font-medium relative",
                                    isActive
                                        ? "bg-brand-primary/5 text-brand-primary"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                                    isChild && "pl-8 text-sm py-2.5"
                                )}
                            >
                                {isActive && !isChild && <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-primary rounded-r-full" />}
                                {isActive && isChild && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-brand-primary rounded-r-full" />}

                                <Icon size={isChild ? 18 : 20} className={clsx("transition-transform group-hover:scale-105", isActive && "text-brand-primary")} />
                                <span>{navLink.label}</span>
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
